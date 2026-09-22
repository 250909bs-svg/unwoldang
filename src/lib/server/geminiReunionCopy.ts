/**
 * 재회운 웹툰형 컷 카피 — 응답 스키마 · 프롬프트 하드스펙 · 컷 단위 검증 (명세 §4-4, §4-5).
 *
 * ## 왜 별도 파일인가
 *
 * `geminiReportService.ts` 의 3단 검증(`evaluateGeneratedProse`)은 **base 에 대응 값이 있는
 * 필드**만 다룬다. 대응 값이 없으면 `no-base-anchor` 로 무조건 거부한다 — 되돌릴 곳이
 * 없으면 per-field fallback 자체가 성립하지 않기 때문이다. `reunionCopy` 는 `sections` 를
 * 대체하지 않고 **병행하는 additive 필드**이고, 컷마다 base 컷이 있으므로 되돌릴 곳은
 * 있지만 필드 경로가 리포트 본문과 전혀 다르다. 그래서 그 경로를 타지 않는 별도 검증을 둔다.
 *
 * ## 모델이 정하는 것과 정하지 못하는 것
 *
 * 모델이 쓰는 것은 `bubbles[].text` / `narration` / `caption` 과, 근거 배지에 **어느 용어를
 * 달지** 뿐이다. 판정값(state·조건 개수·날짜·sceneKey·layout·chapterId·cutId·mask)은
 * 스키마에 아예 존재하지 않는다. 용어의 **번역문도 모델이 쓰지 않는다** —
 * `REUNION_TERM_GLOSSARY` 가 유일한 번역이고, 모델은 키만 고른다.
 *
 * ## 컷 단위 all-or-nothing
 *
 * 필드 단위가 아니라 **컷 단위**로 채택/거부한다. 한 컷 안의 말풍선 2개와 나레이션은
 * 같은 장면을 함께 만들기 때문에, 하나는 모델 문장이고 하나는 결정론 문장인 상태가
 * 화면에서 가장 나쁘다(톤이 한 컷 안에서 갈린다). 컷이 거부되면 그 컷은 통째로 base 다.
 */

import {
  REUNION_BUBBLE_SPEC,
  REUNION_NARRATION_SPEC,
  findReunionTextViolations,
  isReunionGlossaryTerm,
  translateReunionTerm,
  REUNION_TERM_KEYS,
  REUNION_TERM_GLOSSARY
} from '../reunion/glossary';
import { serializeReunionBannedPhrases } from '../reunion/bannedPhrases';
import type { ReunionAgeBand } from '../reunion/ageBand';
import type { ReunionIntentContext } from './reunionIntentGuard';
import { REUNION_UNDELETABLE_COPY } from '../reunion/safetyCopy';
import type {
  ReunionBubble,
  ReunionBubblePosition,
  ReunionBubbleTone,
  ReunionCut,
  ReunionReportPayload
} from '../reunion/reportTypes';
import type { SajuReportData } from '../saju/report';
import {
  findNewTextViolations,
  findRemovedUndeletableCopy,
  findUnknownEntities,
  isPermanentlyLockedProse,
  type EntityUniverse
} from './geminiProseGuard';

/** 캡션 상한. 명세 §4-4. */
const CAPTION_MAX_CHARS = 60;

const BUBBLE_POSITIONS: readonly ReunionBubblePosition[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right'
];
const BUBBLE_TONES: readonly ReunionBubbleTone[] = ['calm', 'direct', 'warm', 'withholding'];

/* ------------------------------------------------------------------ *
 * 모델 응답 모양
 * ------------------------------------------------------------------ */

export interface ReunionCopyDraftBubble {
  position?: string;
  tone?: string;
  text?: string;
}

export interface ReunionCopyDraftCut {
  cutId?: string;
  bubbles?: ReunionCopyDraftBubble[];
  narration?: string;
  caption?: string;
  /** `[용어] 한 줄 번역` 형식. 번역문은 무시하고 사전 값을 쓴다. */
  evidenceBadge?: string;
  claimRefs?: string[];
}

/* ------------------------------------------------------------------ *
 * 어느 컷이 모델에게 열리는가
 * ------------------------------------------------------------------ */

/**
 * 영구 잠금 컷 — 모델이 한 글자도 쓸 수 없다.
 *
 * - `beat` 컷: 내용 없는 순검정 침묵이다. 글자가 들어오면 침묵이 사라진다.
 * - `undeletable` / `undeletableCopyId` 컷: 삭제 불가 문구 7개를 싣고 있다(§6-F).
 * - `copyExemption` 컷: 금지 표현을 **부정하기 위해** 인용하는 컷이라 검사에서 빠져 있다.
 *   검사가 빠진 자리에 모델을 들이면 금지 표현이 그대로 통과한다.
 * - 문구 자체가 영구 잠금 구간인 컷: base 문장이 삭제 불가 문구를 포함한다.
 */
export function isLockedReunionCut(cut: ReunionCut): boolean {
  if (cut.layout === 'beat') return true;
  if (cut.undeletable || cut.undeletableCopyId) return true;
  if (cut.copyExemption) return true;
  if (isPermanentlyLockedProse(cut.narration)) return true;
  if (isPermanentlyLockedProse(cut.caption)) return true;
  return cut.bubbles.some((bubble) => isPermanentlyLockedProse(bubble.text));
}

/** 모델이 쓸 수 있는 자리가 하나라도 있는 컷인가. */
export function isWritableReunionCut(cut: ReunionCut): boolean {
  if (isLockedReunionCut(cut)) return false;
  return cut.bubbles.length > 0 || Boolean(cut.narration) || Boolean(cut.caption);
}

export function writableReunionCuts(payload: ReunionReportPayload): ReunionCut[] {
  return payload.chapters.flatMap((chapter) => chapter.cuts.filter(isWritableReunionCut));
}

/* ------------------------------------------------------------------ *
 * responseSchema (명세 §4-4)
 * ------------------------------------------------------------------ */

/**
 * `cutId` 는 **base 가 정한 집합의 enum** 으로 못박는다.
 *
 * 현재 `partialSchema` 는 `enum` · `maxItems` · `minItems` · `required` 를 하나도 쓰지 않고
 * 형식 통제를 전부 자연어에 맡기고 있는데, 웹툰 구조는 자연어로 통제되지 않는다.
 * 매칭 키를 모델이 정하게 두면 병합이 무너지므로 여기서만은 enum 을 쓴다.
 */
export function buildReunionCopySchema(payload: ReunionReportPayload) {
  const cuts = writableReunionCuts(payload);
  if (cuts.length === 0) return null;

  return {
    type: 'ARRAY',
    maxItems: cuts.length,
    items: {
      type: 'OBJECT',
      required: ['cutId', 'claimRefs'],
      properties: {
        cutId: { type: 'STRING', enum: cuts.map((cut) => cut.id) },
        bubbles: {
          type: 'ARRAY',
          maxItems: REUNION_BUBBLE_SPEC.maxBubblesPerCut,
          items: {
            type: 'OBJECT',
            required: ['position', 'tone', 'text'],
            properties: {
              position: { type: 'STRING', enum: [...BUBBLE_POSITIONS] },
              tone: { type: 'STRING', enum: [...BUBBLE_TONES] },
              text: { type: 'STRING' }
            }
          }
        },
        narration: { type: 'STRING' },
        caption: { type: 'STRING' },
        evidenceBadge: { type: 'STRING', enum: REUNION_TERM_KEYS.map((term) => `[${term}]`) },
        claimRefs: { type: 'ARRAY', minItems: 1, items: { type: 'STRING' } }
      }
    }
  };
}

/* ------------------------------------------------------------------ *
 * 프롬프트 하드스펙 (명세 §4-5)
 * ------------------------------------------------------------------ */

function cutSlotBrief(cut: ReunionCut) {
  return {
    cutId: cut.id,
    layout: cut.layout,
    slots: {
      bubbles: cut.bubbles.length,
      narration: Boolean(cut.narration),
      caption: Boolean(cut.caption)
    },
    /** 이 컷이 전달해야 하는 내용. 문장을 베끼는 게 아니라 같은 사실을 다시 쓰는 기준이다. */
    deterministic: {
      bubbles: cut.bubbles.map((bubble) => bubble.text),
      narration: cut.narration,
      caption: cut.caption
    }
  };
}

/**
 * 컷 카피 하드스펙을 프롬프트에 **그대로 박는다.**
 *
 * 숫자는 전부 `REUNION_BUBBLE_SPEC` · `REUNION_NARRATION_SPEC` 상수에서 읽는다.
 * 프롬프트에 숫자를 손으로 적으면 상수를 고친 날 프롬프트만 옛 값을 말하게 된다.
 */
export function buildReunionCopyDirectives(
  payload: ReunionReportPayload,
  band: ReunionAgeBand | null = null
): string {
  const cuts = writableReunionCuts(payload);
  const spec = REUNION_BUBBLE_SPEC;
  const narration = REUNION_NARRATION_SPEC;

  return [
    '=== REUNION CUT COPY (love-reunion only) ===',
    'You are writing the spoken lines of a scroll-format report. Each cut is one screen.',
    `Bubble text: at most ${spec.maxChars} characters, at most ${spec.maxLines} lines, at most ${spec.maxCharsPerLine} characters per line, at most ${spec.maxBubblesPerCut} bubbles per cut.`,
    'Put the line breaks in yourself with \\n. Do not leave wrapping to the renderer. Break right after a meaning unit and leave the decisive word on the last line.',
    'A standalone emphasis cut is 5 characters or fewer.',
    `Narration: ${narration.maxLines} lines or fewer, ${narration.maxCharsPerLine} characters per line or fewer, ${narration.maxChars} characters total or fewer.`,
    `Caption: ${CAPTION_MAX_CHARS} characters or fewer.`,
    'Cut dialogue carries zero myeongri terms and states only the result, 25 characters or fewer.',
    `Terms live only in evidenceBadge. Choose one key from this glossary and nothing else: ${REUNION_TERM_KEYS.join(' / ')}. The server supplies the translation, so send only the bracketed key (예: [상관]). Never write your own translation.`,
    'Never mix a term and a cut line in one sentence. That two-layer separation is what makes the report readable.',
    'Every cut you return must carry claimRefs with at least one real evidence ID from the catalog in this request. A cut with no claimRef, or with an ID that does not exist, is discarded and the deterministic cut is rendered instead.',
    'Only these cut ids exist, and you may not invent one. Each cut has fixed slots: write only the slots it has, and never add a bubble to a cut that has none.',
    'Over-length text is discarded, not truncated. A half-cut sentence inside a speech bubble is the worst possible outcome, so stay well inside the limits.',
    'BANNED EXPRESSIONS (the server checks every sentence you write against this table):',
    serializeReunionBannedPhrases(band || payload.ageBand || undefined),
    'UNDELETABLE LINES (these must never be paraphrased, shortened, or moved; their cuts are not in the writable list):',
    Object.entries(REUNION_UNDELETABLE_COPY)
      .map(([id, value]) => `- ${id}: ${value.replace(/\n/gu, ' / ')}`)
      .join('\n'),
    `WRITABLE CUTS (${cuts.length}):`,
    JSON.stringify(cuts.map(cutSlotBrief))
  ].join('\n');
}

/* ------------------------------------------------------------------ *
 * 컷 단위 검증 · 병합
 * ------------------------------------------------------------------ */

export type ReunionCopyRejectionCode =
  | 'unknown-cut-id'
  | 'locked-cut'
  | 'missing-citation'
  | 'unknown-evidence-id'
  | 'no-base-anchor'
  | 'copy-spec-violation'
  | 'unknown-glossary-term'
  | 'unknown-entity'
  | 'banned-phrase'
  | 'undeletable-copy-removed';

export interface ReunionCopyRejection {
  path: string;
  code: ReunionCopyRejectionCode;
  message: string;
}

export interface ReunionCopyReview {
  payload: ReunionReportPayload;
  accepted: number;
  rejected: number;
  rejectionsByReason: Record<string, number>;
  rejections: ReunionCopyRejection[];
}

interface ReunionCopyGuardContext {
  universe: EntityUniverse;
  serviceId: SajuReportData['serviceId'];
  knownEvidenceIds: ReadonlySet<string>;
  /** 밴드별 금지어. 넘기지 않으면 공통 49개만 검사된다. */
  band?: ReunionAgeBand | null;
  /** 차단·거절·학대 신호. 의도 가드의 추가 규칙을 켠다. */
  intent?: ReunionIntentContext | null;
}

interface AcceptedCutCopy {
  bubbles?: ReunionBubble[];
  narration?: string;
  caption?: string;
  evidenceBadgeTerm?: string;
  claimRefs: string[];
}

/** 한 컷을 검증한다. 채택하면 덮어쓸 값을, 거부하면 사유를 돌려준다. */
function reviewCut(
  cut: ReunionCut,
  draft: ReunionCopyDraftCut,
  context: ReunionCopyGuardContext
): { copy: AcceptedCutCopy } | { rejection: ReunionCopyRejection } {
  const path = `reunionCopy.${cut.id}`;
  const reject = (code: ReunionCopyRejectionCode, message: string) => ({
    rejection: { path, code, message }
  });

  const claimRefs = (draft.claimRefs || [])
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    .map((id) => id.trim());

  if (claimRefs.length === 0) {
    return reject('missing-citation', `재회 컷에 근거 ID가 없습니다 (${path}).`);
  }

  const unknownRef = claimRefs.find((id) => !context.knownEvidenceIds.has(id));
  if (unknownRef) {
    return reject('unknown-evidence-id', `재회 컷이 존재하지 않는 근거를 인용했습니다 (${path}): ${unknownRef}`);
  }

  /**
   * 모델 문장 하나를 검사한다. base 문장이 있는 자리만 열린다.
   * 자리 자체가 없으면 되돌릴 곳이 없으므로 `no-base-anchor` 다 —
   * 모델이 컷 구성을 바꾸는 경로를 여기서 닫는다.
   */
  const checkText = (
    label: string,
    candidate: string,
    baseText: string | undefined,
    spec: { maxChars: number; maxLines: number; maxCharsPerLine: number } | null,
    allowMyeongriTerms: boolean
  ): ReunionCopyRejection | null => {
    if (baseText === undefined) {
      return { path: `${path}.${label}`, code: 'no-base-anchor', message: `${path}.${label} 자리는 base 컷에 없습니다.` };
    }
    if (isPermanentlyLockedProse(baseText)) {
      return { path: `${path}.${label}`, code: 'locked-cut', message: `${path}.${label} 는 영구 잠금 문구입니다.` };
    }
    if (spec) {
      const violations = findReunionTextViolations(candidate, spec, { allowMyeongriTerms });
      if (violations.length > 0) {
        return {
          path: `${path}.${label}`,
          code: 'copy-spec-violation',
          message: `${path}.${label} 카피 규격 위반: ${violations.map((item) => `${item.rule}(${item.detail})`).join(', ')}`
        };
      }
    } else if (candidate.replace(/\n/gu, '').length > CAPTION_MAX_CHARS) {
      return {
        path: `${path}.${label}`,
        code: 'copy-spec-violation',
        message: `${path}.${label} 캡션이 ${CAPTION_MAX_CHARS}자를 넘었습니다.`
      };
    }

    const unknownEntities = findUnknownEntities(candidate, context.universe);
    if (unknownEntities.length > 0) {
      return {
        path: `${path}.${label}`,
        code: 'unknown-entity',
        message: `${path}.${label} 에 결정론 계산에 없는 값이 있습니다: ${unknownEntities
          .map((entity) => `${entity.kind}=${entity.token}`)
          .join(', ')}`
      };
    }

    const bannedHits = findNewTextViolations(candidate, baseText, context.serviceId, {
      band: context.band,
      intent: context.intent
    });
    if (bannedHits.length > 0) {
      return {
        path: `${path}.${label}`,
        code: 'banned-phrase',
        message: `${path}.${label} 에 금지 표현이 있습니다: ${bannedHits.join(', ')}`
      };
    }

    const removed = findRemovedUndeletableCopy(candidate, baseText);
    if (removed.length > 0) {
      return {
        path: `${path}.${label}`,
        code: 'undeletable-copy-removed',
        message: `${path}.${label} 가 삭제 불가 문구를 지웠습니다: ${removed.join(' / ')}`
      };
    }

    return null;
  };

  const copy: AcceptedCutCopy = { claimRefs };

  const draftBubbles = (draft.bubbles || []).filter((bubble) => typeof bubble?.text === 'string');
  if (draftBubbles.length > 0) {
    if (cut.bubbles.length === 0) {
      return reject('no-base-anchor', `${path} 는 말풍선이 없는 컷입니다.`);
    }
    if (draftBubbles.length > Math.min(cut.bubbles.length, REUNION_BUBBLE_SPEC.maxBubblesPerCut)) {
      return reject('copy-spec-violation', `${path} 말풍선 개수가 base 컷(${cut.bubbles.length}개)을 넘었습니다.`);
    }

    const bubbles: ReunionBubble[] = [];
    for (let index = 0; index < draftBubbles.length; index += 1) {
      const candidate = (draftBubbles[index].text || '').trim();
      const baseBubble = cut.bubbles[index];
      const rejection = checkText(`bubbles.${index}`, candidate, baseBubble?.text, REUNION_BUBBLE_SPEC, false);
      if (rejection) return { rejection };
      const position = draftBubbles[index].position;
      const tone = draftBubbles[index].tone;
      bubbles.push({
        /* 위치·톤은 모델이 고를 수 있지만, 값이 집합 밖이면 base 를 쓴다. */
        position: BUBBLE_POSITIONS.includes(position as ReunionBubblePosition)
          ? (position as ReunionBubblePosition)
          : baseBubble.position,
        tone: BUBBLE_TONES.includes(tone as ReunionBubbleTone)
          ? (tone as ReunionBubbleTone)
          : baseBubble.tone,
        text: candidate,
        /* `kind` 는 연출 결정이라 스키마에 없다. base 값을 그대로 유지한다. */
        kind: baseBubble.kind
      });
    }
    /* 모델이 일부만 돌려주면 남은 인덱스는 base 말풍선을 그대로 쓴다. */
    copy.bubbles = [...bubbles, ...cut.bubbles.slice(bubbles.length)];
  }

  if (typeof draft.narration === 'string' && draft.narration.trim()) {
    const candidate = draft.narration.trim();
    const rejection = checkText('narration', candidate, cut.narration, REUNION_NARRATION_SPEC, false);
    if (rejection) return { rejection };
    copy.narration = candidate;
  }

  if (typeof draft.caption === 'string' && draft.caption.trim()) {
    const candidate = draft.caption.trim();
    const rejection = checkText('caption', candidate, cut.caption, null, true);
    if (rejection) return { rejection };
    copy.caption = candidate;
  }

  if (typeof draft.evidenceBadge === 'string' && draft.evidenceBadge.trim()) {
    const term = draft.evidenceBadge.trim().replace(/^\[/u, '').split(']')[0].trim();
    if (!isReunionGlossaryTerm(term)) {
      return reject('unknown-glossary-term', `${path} 근거 배지 용어가 사전에 없습니다: ${term}`);
    }
    copy.evidenceBadgeTerm = term;
  }

  if (!copy.bubbles && copy.narration === undefined && copy.caption === undefined) {
    return reject('no-base-anchor', `${path} 에 채택할 문장이 없습니다.`);
  }

  return { copy };
}

function applyCutCopy(cut: ReunionCut, copy: AcceptedCutCopy): ReunionCut {
  const term = copy.evidenceBadgeTerm;
  const translation = term ? translateReunionTerm(term) : null;

  return {
    ...cut,
    bubbles: copy.bubbles || cut.bubbles,
    narration: copy.narration ?? cut.narration,
    caption: copy.caption ?? cut.caption,
    /* 번역문은 사전 값만 쓴다. 모델은 어느 용어를 달지만 고른다. */
    evidenceBadges: term && translation
      ? [{ term, translation, claimRefs: copy.claimRefs }]
      : cut.evidenceBadges
  };
}

/**
 * 컷 카피를 검증해 병합한다. 거부된 컷은 base 컷이 그대로 남는다.
 *
 * `lockCommercialReportFacts` **이후에** 호출해야 한다. lock 이 `reunion` 을 base 값으로
 * 통째 복원하므로, 그 전에 병합하면 여기서 채택한 문장이 전부 사라진다.
 */
export function reviewReunionCopy(
  payload: ReunionReportPayload,
  drafts: ReunionCopyDraftCut[] | undefined,
  context: ReunionCopyGuardContext
): ReunionCopyReview {
  const rejections: ReunionCopyRejection[] = [];
  const accepted = new Map<string, AcceptedCutCopy>();
  const writableIds = new Set(writableReunionCuts(payload).map((cut) => cut.id));
  const cutById = new Map<string, ReunionCut>(
    payload.chapters.flatMap((chapter) => chapter.cuts.map((cut) => [cut.id, cut] as [string, ReunionCut]))
  );

  (drafts || []).forEach((draft) => {
    const cutId = typeof draft?.cutId === 'string' ? draft.cutId.trim() : '';
    const cut = cutId ? cutById.get(cutId) : undefined;

    if (!cut) {
      rejections.push({
        path: `reunionCopy.${cutId || '(no cutId)'}`,
        code: 'unknown-cut-id',
        message: `base 에 없는 컷 id 입니다: ${cutId || '(없음)'}`
      });
      return;
    }
    if (!writableIds.has(cut.id) || accepted.has(cut.id)) {
      rejections.push({
        path: `reunionCopy.${cut.id}`,
        code: 'locked-cut',
        message: accepted.has(cut.id)
          ? `같은 컷을 두 번 돌려줬습니다: ${cut.id}`
          : `모델이 쓸 수 없는 컷입니다: ${cut.id}`
      });
      return;
    }

    const result = reviewCut(cut, draft, context);
    if ('rejection' in result) {
      rejections.push(result.rejection);
      return;
    }
    accepted.set(cut.id, result.copy);
  });

  const mergedPayload: ReunionReportPayload = accepted.size === 0
    ? payload
    : {
        ...payload,
        chapters: payload.chapters.map((chapter) => ({
          ...chapter,
          cuts: chapter.cuts.map((cut) => {
            const copy = accepted.get(cut.id);
            return copy ? applyCutCopy(cut, copy) : cut;
          })
        }))
      };

  const rejectionsByReason = rejections.reduce<Record<string, number>>((result, rejection) => {
    result[rejection.code] = (result[rejection.code] || 0) + 1;
    return result;
  }, {});

  return {
    payload: mergedPayload,
    accepted: accepted.size,
    rejected: rejections.length,
    rejectionsByReason,
    rejections
  };
}

/** 사전 키 개수. 테스트가 프롬프트 직렬화와 스키마 enum 을 같은 값으로 잠근다. */
export const REUNION_GLOSSARY_SIZE = Object.keys(REUNION_TERM_GLOSSARY).length;
