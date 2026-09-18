import type {
  BirthLocationData,
  BirthTimePrecision,
  DayBoundaryPolicy,
  IntakeFormData,
  PartnerBirthData,
  ServiceId
} from '../../api/mockData';
import type { PastLifeAnalysisContext } from '../analysisPayload';
import { normalizeIntakeFormData } from '../intakeDataContract';
import { normalizeLoveFocus } from '../loveFocus';
import { normalizeLoveReaction } from '../mz-love-fact/microChoice';
import { validateIntakeBirthInputs } from '../birthInputValidation';
import type { ReunionContext } from '../reunion/types';
import { validateReunionContext } from '../reunion/validation';
import { buildDeterministicSajuBasis, type DeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildQuestionContext, buildRelationshipPersonalizationContext } from '../personalizationContext';
import { buildPastLifeProfile } from '../saju/pastLifeProfile';
import { normalizeFormDataWithKasi } from './kasiCalendarService';
import {
  buildPremiumSajuPromptContext,
  LOVE_REUNION_AUTHORED_PROSE_CONTRACT,
  LOVE_REUNION_OUTPUT_SAFETY_OVERRIDE,
  LOVE_REUNION_STYLE_DIRECTIVES,
  LOVE_REUNION_VOICE_SPEC,
  PREMIUM_SAJU_FACT_CONSTRAINTS,
  PREMIUM_SAJU_HUMAN_SENSORY_POLICY,
  PREMIUM_SAJU_PROMPT_VERSION,
  PREMIUM_SAJU_REPORT_MODE,
  PREMIUM_SAJU_STRICT_ECHO_RULE,
  PREMIUM_SAJU_STYLE_DIRECTIVES,
  PREMIUM_SAJU_SYSTEM_PROMPT
} from '../saju/premiumReportPrompt';
import {
  type ActionPlan,
  type QuestionAnswerBlock,
  type ReportCard,
  type ReportDetail,
  type ReportSection,
  type SajuReportData
} from '../saju/report';
import { buildSajuReport, findLoveReunionSafetyViolations } from '../saju/reportBuilder';
import { findReportConsistencyViolations } from '../saju/reportConsistency';
import { findCustomerReportTextViolations, finalizeCustomerReport } from '../saju/reportPresentation';
import {
  hasMalformedReportEvidenceReference,
  lockCommercialReportFacts,
  parseReportEvidenceReferences,
  stripReportEvidenceReferences
} from '../saju/v2/reportFactGuard';
import {
  buildEntityUniverse,
  buildReportFactAnchors,
  findMisattributedClaims,
  findNewReunionProseSafetyFindings,
  findNewTextViolations,
  findRemovedUndeletableCopy,
  findUnknownEntities,
  isPermanentlyLockedProse,
  resolveGuardAgeBand,
  resolveProseGuardMode,
  type EntityUniverse,
  type ProseGuardMode,
  type ReportFactAnchors,
  type ReunionIntentContext
} from './geminiProseGuard';
import { isContactWithheld, toReunionIntentContext } from './reunionIntentGuard';
import { serializeReunionBannedPhrases } from '../reunion/bannedPhrases';
import {
  LOVE_REUNION_PROSE_TEMPERATURE,
  proseGuardModeForServiceId,
  STRICT_ECHO_PROSE_TEMPERATURE
} from '../saju/promptRelease';
import type { ReunionAgeBand } from '../reunion/ageBand';
import {
  buildReunionCopyDirectives,
  buildReunionCopySchema,
  reviewReunionCopy,
  type ReunionCopyDraftCut,
  type ReunionCopyReview
} from './geminiReunionCopy';

type RelationshipStatus = IntakeFormData['relationshipStatus'] | null | undefined;
type RelationshipDuration = IntakeFormData['relationshipDuration'] | null | undefined;

export type ReportRequestBody = {
  serviceId?: ServiceId;
  productId?: string;
  payload?: {
    contractVersion?: string;
    serviceId?: ServiceId;
    user?: {
      name?: string;
      gender?: 'male' | 'female';
    };
    birth?: {
      calendar?: 'solar' | 'lunar';
      isLeapMonth?: boolean;
      date?: string;
      time?: string | null;
      isUnknownTime?: boolean;
      precision?: BirthTimePrecision;
      dayBoundaryPolicy?: DayBoundaryPolicy;
      location?: BirthLocationData | null;
      locationText?: string;
    };
    partner?: PartnerBirthData | null;
    relationship?: {
      status?: RelationshipStatus;
      duration?: RelationshipDuration;
      microChoice?: IntakeFormData['loveReaction'];
      focus?: IntakeFormData['loveFocus'];
    };
    pastLifeContext?: PastLifeAnalysisContext | null;
    reunionContext?: ReunionContext | null;
    questions?: string[];
  };
  reportMode?: string;
  promptVersion?: string;
  debug?: boolean;
};

export type GeminiDraft = {
  heroNote?: string;
  summary?: Partial<SajuReportData['summary']>;
  keyTakeaways?: Partial<ReportCard>[];
  questionAnswers?: Partial<QuestionAnswerBlock>[];
  sections?: Array<{
    id: string;
    paragraphs?: string[];
    bullets?: string[];
    callout?: Partial<NonNullable<ReportSection['callout']>>;
    details?: Partial<ReportDetail>[];
    cards?: Partial<ReportCard>[];
  }>;
  currentDayun?: Partial<SajuReportData['currentDayun']>;
  nextDayun?: Partial<SajuReportData['nextDayun']>;
  actionPlan?: Partial<ActionPlan>;
  /**
   * 재회운 웹툰형 컷 카피 (명세 §4-4). `sections` 를 대체하지 않는 additive 필드다.
   * 검증·병합은 `geminiReunionCopy.ts` 가 컷 단위로 따로 한다 — 리포트 본문 필드
   * 경로를 타지 않으므로 `walkGeminiDraft` 는 이 필드를 보지 않는다.
   */
  reunionCopy?: ReunionCopyDraftCut[];
};

const DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 22000;

export type GeminiUsage = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  thoughtsTokenCount: number;
  cachedContentTokenCount: number;
  totalTokenCount: number;
};

export type ReportResponsePayload = {
  provider: 'gemini' | 'deterministic-fallback';
  reportMode: string;
  promptVersion: string;
  report: SajuReportData;
  debug?: {
    deterministicBasis: ReturnType<typeof buildDeterministicSajuBasis>;
  };
  usage?: GeminiUsage;
};

type EnvRecord = Record<string, string | undefined>;

function getEnv() {
  const maybeProcess = globalThis as {
    process?: {
      env?: EnvRecord;
    };
  };

  return maybeProcess.process?.env ?? {};
}

function getGeminiRequestTimeoutMs(env: EnvRecord) {
  const configured = Number(env.GEMINI_REQUEST_TIMEOUT_MS);

  if (Number.isFinite(configured) && configured >= 10000) {
    return configured;
  }

  return DEFAULT_GEMINI_REQUEST_TIMEOUT_MS;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * 길이 초과는 **자르지 않고 그 필드를 버린다**(명세 §4-1 e).
 *
 * `slice` 로 자르면 말풍선이나 문단이 문장 중간에서 끊긴 채 고객에게 나간다.
 * 버리면 병합 단계에서 결정론 base 값이 그대로 남으므로 항상 완결된 문장이 나간다.
 */
/**
 * 길이 초과 폐기 감시통.
 *
 * `safeText` 는 자기 경로를 모르므로 **건수와 상한만** 모은다(검증자 지적의
 * '경로별 또는 건수' 중 건수 쪽). 이게 없으면 길이 초과로 사라진 필드가
 * `aiFields.rejected` 에도 로그에도 안 잡혀 관측 분모가 왜곡된다 —
 * `accepted + rejected` 가 '모델이 시도한 필드 수' 가 아니라
 * '살아서 검증까지 간 필드 수' 가 된다.
 *
 * `sanitizeGeminiDraft` 는 동기 함수이고 요청당 한 번만 돌므로 모듈 스코프 통으로
 * 충분하다. `sanitizeGeminiDraftWithAudit` 가 try/finally 로 설치하고 반드시 해제한다.
 */
let lengthDiscardSink: string[] | null = null;

function safeText(value: unknown, maxLength = 6000) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) {
    lengthDiscardSink?.push(`cap=${maxLength} len=${trimmed.length}`);
    return undefined;
  }
  return trimmed;
}

/**
 * 배열은 **인덱스를 보존한다.**
 *
 * 이전에는 버려진 항목을 `filter` 로 압축했는데, 검증이 `draft[i]` 와 `base[i]` 를
 * 짝지어 보기 때문에(`DraftReviewer.list`) 한 항목이 길이 초과로 빠지면 뒤의 모든
 * 문장이 한 칸씩 당겨져 **다른 자리의 base 문장과 비교된다.** echo 모드에서는
 * 어차피 전부 거부됐지만, 새 문장을 쓰는 authored 모드에서는 조용히 다른 슬롯에
 * 들어간다. 빠진 자리는 빈 문자열로 남기고, 검증 계층이 falsy 를 '후보 없음'
 * (= base 유지)으로 읽는다.
 */
function safeTextArray(value: unknown, maxItems: number, maxLength = 3000) {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .slice(0, maxItems)
    .map((item) => safeText(item, maxLength) ?? '');
  return items.some((item) => item.length > 0) ? items : undefined;
}

export function sanitizeGeminiDraft(value: unknown, base: SajuReportData): GeminiDraft {
  const root = asRecord(value);
  if (!root) {
    throw new Error('Gemini JSON 최상위 값이 객체가 아닙니다.');
  }

  const summary = asRecord(root.summary);
  const rawCards = Array.isArray(root.keyTakeaways) ? root.keyTakeaways : [];
  const rawAnswers = Array.isArray(root.questionAnswers) ? root.questionAnswers : [];
  const rawSections = Array.isArray(root.sections) ? root.sections : [];
  const currentDayun = asRecord(root.currentDayun);
  const nextDayun = asRecord(root.nextDayun);
  const actionPlan = asRecord(root.actionPlan);

  const keyTakeaways = base.keyTakeaways.flatMap((baseCard) => {
    const match = rawCards
      .map(asRecord)
      .find((candidate) => candidate && candidate.title === baseCard.title);
    if (!match) return [];
    return [{
      title: baseCard.title,
      body: safeText(match.body, 2400),
      badge: safeText(match.badge, 120)
    }];
  });

  const questionAnswers = base.questionAnswers.flatMap((baseAnswer) => {
    const match = rawAnswers
      .map(asRecord)
      .find((candidate) => candidate && candidate.question === baseAnswer.question);
    if (!match) return [];
    return [{
      question: baseAnswer.question,
      title: safeText(match.title, 500),
      analysis: safeText(match.analysis, 12000),
      advice: safeTextArray(match.advice, 10, 2000)
    }];
  });

  const sections = base.sections
    .filter((baseSection) => !baseSection.id.endsWith('-v2'))
    .flatMap((baseSection) => {
      const match = rawSections
        .map(asRecord)
        .find((candidate) => candidate && candidate.id === baseSection.id);
      if (!match) return [];
      const rawSectionCards = Array.isArray(match.cards) ? match.cards : [];
      const rawDetails = Array.isArray(match.details) ? match.details : [];
      const callout = asRecord(match.callout);
      return [{
        id: baseSection.id,
        paragraphs: safeTextArray(match.paragraphs, 30, 5000),
        bullets: safeTextArray(match.bullets, 40, 3000),
        callout: callout
          ? {
              title: safeText(callout.title, 300),
              body: safeText(callout.body, 4000)
            }
          : undefined,
        cards: (baseSection.cards || []).flatMap((baseCard) => {
          const card = rawSectionCards
            .map(asRecord)
            .find((candidate) => candidate && candidate.title === baseCard.title);
          return card
            ? [{
                title: baseCard.title,
                body: safeText(card.body, 3000),
                badge: safeText(card.badge, 120)
              }]
            : [];
        }),
        details: (baseSection.details || []).flatMap((baseDetail) => {
          const detail = rawDetails
            .map(asRecord)
            .find((candidate) => candidate && candidate.summary === baseDetail.summary);
          return detail
            ? [{ summary: baseDetail.summary, content: safeText(detail.content, 8000) }]
            : [];
        })
      }];
    });

  /**
   * 컷 카피는 **base 가 정한 컷 id 집합에 없으면 그 항목을 통째 폐기한다.**
   * `sanitizeGeminiDraft` 가 title/question/id/summary/day 에 이미 쓰는 패턴 그대로다.
   * 매칭 키를 모델이 정하게 두면 병합이 무너진다.
   */
  const sanitizeReunionCopy = (rawValue: unknown): ReunionCopyDraftCut[] | undefined => {
    const cutIds = new Set(base.reunion?.cutIds || []);
    if (cutIds.size === 0 || !Array.isArray(rawValue)) return undefined;

    const cuts = rawValue.flatMap((item) => {
      const record = asRecord(item);
      const cutId = record ? safeText(record.cutId, 24) : undefined;
      if (!record || !cutId || !cutIds.has(cutId)) return [];

      const rawBubbles = Array.isArray(record.bubbles) ? record.bubbles : [];
      return [{
        cutId,
        bubbles: rawBubbles
          .slice(0, 4)
          .map(asRecord)
          .flatMap((bubble) => {
            const text = bubble ? safeText(bubble.text, 200) : undefined;
            return text
              ? [{
                  text,
                  position: bubble ? safeText(bubble.position, 24) : undefined,
                  tone: bubble ? safeText(bubble.tone, 24) : undefined
                }]
              : [];
          }),
        narration: safeText(record.narration, 200),
        caption: safeText(record.caption, 200),
        evidenceBadge: safeText(record.evidenceBadge, 120),
        claimRefs: safeTextArray(record.claimRefs, 8, 160)?.filter(Boolean)
      }];
    });

    return cuts.length > 0 ? cuts : undefined;
  };

  const sanitizeDays = (
    rawValue: unknown,
    baseDays: SajuReportData['actionPlan']['luckyDays']
  ) => {
    const rawDays = Array.isArray(rawValue) ? rawValue : [];
    return baseDays.flatMap((baseDay) => {
      const match = rawDays
        .map(asRecord)
        .find((candidate) => candidate && Number(candidate.day) === baseDay.day);
      const reason = match ? safeText(match.reason, 1500) : undefined;
      return reason ? [{ day: baseDay.day, reason }] : [];
    });
  };

  return {
    heroNote: safeText(root.heroNote, 4000),
    summary: summary
      ? {
          title: safeText(summary.title, 500),
          analysis: safeTextArray(summary.analysis, 12, 5000),
          advice: safeTextArray(summary.advice, 20, 2500)
        }
      : undefined,
    keyTakeaways: keyTakeaways.length ? keyTakeaways : undefined,
    questionAnswers: questionAnswers.length ? questionAnswers : undefined,
    sections: sections.length ? sections : undefined,
    currentDayun: currentDayun
      ? {
          summary: safeText(currentDayun.summary, 5000),
          focus: safeText(currentDayun.focus, 2500),
          caution: safeText(currentDayun.caution, 2500)
        }
      : undefined,
    nextDayun: nextDayun
      ? {
          summary: safeText(nextDayun.summary, 5000),
          focus: safeText(nextDayun.focus, 2500),
          caution: safeText(nextDayun.caution, 2500)
        }
      : undefined,
    actionPlan: actionPlan
      ? {
          title: safeText(actionPlan.title, 500),
          priorities: safeTextArray(actionPlan.priorities, 20, 2000),
          dos: safeTextArray(actionPlan.dos, 20, 2000),
          avoids: safeTextArray(actionPlan.avoids, 20, 2000),
          luckyDays: sanitizeDays(actionPlan.luckyDays, base.actionPlan.luckyDays),
          unluckyDays: sanitizeDays(actionPlan.unluckyDays, base.actionPlan.unluckyDays)
        }
      : undefined,
    reunionCopy: sanitizeReunionCopy(root.reunionCopy)
  };
}

export interface SanitizedGeminiDraft {
  draft: GeminiDraft;
  /** 길이 상한을 넘어 sanitize 단계에서 사라진 필드. `cap=2400 len=2571` 형태. */
  dropped: readonly string[];
}

/**
 * `sanitizeGeminiDraft` + 폐기 관측.
 *
 * 프로덕션 경로는 이쪽을 쓴다. `sanitizeGeminiDraft` 는 관측이 필요 없는
 * 기존 테스트 호출자를 위해 그대로 남긴다.
 */
export function sanitizeGeminiDraftWithAudit(
  value: unknown,
  base: SajuReportData
): SanitizedGeminiDraft {
  const sink: string[] = [];
  lengthDiscardSink = sink;
  try {
    return { draft: sanitizeGeminiDraft(value, base), dropped: sink };
  } finally {
    lengthDiscardSink = null;
  }
}

type EvidenceScope = 'interpretation' | 'temporal' | 'compatibility';

interface EvidenceCatalog {
  byScope: Record<EvidenceScope, Set<string>>;
  scopesById: Map<string, Set<EvidenceScope>>;
}

const ALL_EVIDENCE_SCOPES: EvidenceScope[] = ['interpretation', 'temporal', 'compatibility'];
const TEMPORAL_SECTION_IDS = new Set(['fortune', 'year', 'ten', 'detail12', 'detailRel', 'detailSal', 'month']);
const MIXED_SECTION_IDS = new Set(['business', 'money', 'career', 'love']);

function collectEvidenceCatalog(basis: DeterministicSajuBasis): EvidenceCatalog {
  const byScope: EvidenceCatalog['byScope'] = {
    interpretation: new Set<string>(),
    temporal: new Set<string>(),
    compatibility: new Set<string>()
  };
  const scopesById = new Map<string, Set<EvidenceScope>>();
  const add = (scope: EvidenceScope, id: unknown) => {
    if (typeof id !== 'string' || !id.trim()) return;
    const normalized = id.trim();
    byScope[scope].add(normalized);
    const scopes = scopesById.get(normalized) || new Set<EvidenceScope>();
    scopes.add(scope);
    scopesById.set(normalized, scopes);
  };
  const addMany = (scope: EvidenceScope, ids: unknown) => {
    if (Array.isArray(ids)) ids.forEach((id) => add(scope, id));
  };

  const interpretation = basis.commercialV2.interpretation;
  if (interpretation) {
    const visitInterpretation = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visitInterpretation);
        return;
      }
      Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
        if ((key === 'id' || key === 'ruleId') && typeof child === 'string') {
          add('interpretation', child);
        }
        visitInterpretation(child);
      });
    };
    visitInterpretation(interpretation);
  }

  const temporal = basis.commercialV2.temporal;
  temporal?.relations.forEach((item) => add('temporal', item.id));
  temporal?.tenGodActivations.forEach((item) => {
    add('temporal', item.id);
    addMany('temporal', item.evidenceIds);
  });
  temporal?.findings.forEach((item) => {
    add('temporal', item.id);
    addMany('temporal', item.evidenceIds);
  });

  const compatibility = basis.commercialV2.compatibility;
  compatibility?.crossRelations.forEach((item) => add('compatibility', item.id));
  compatibility?.facts.forEach((item) => {
    add('compatibility', item.id);
    addMany('compatibility', item.relationIds);
  });
  compatibility?.dimensions.forEach((item) => {
    add('compatibility', item.id);
    addMany('compatibility', item.evidenceIds);
  });
  if (compatibility) {
    addMany('compatibility', compatibility.dayMaster.conclusion.evidenceIds);
    addMany('compatibility', compatibility.spousePalace.relationIds);
    addMany('compatibility', compatibility.spousePalace.conclusion.evidenceIds);
    add('compatibility', compatibility.elementExchange.personAReceives.evidenceId);
    add('compatibility', compatibility.elementExchange.personBReceives.evidenceId);
    addMany('compatibility', compatibility.elementExchange.conclusion.evidenceIds);
    addMany('compatibility', compatibility.overview.evidenceIds);
  }

  return { byScope, scopesById };
}

function availableScopes(scopes: EvidenceScope[], catalog: EvidenceCatalog) {
  return scopes.filter((scope) => catalog.byScope[scope].size > 0);
}

function primaryEvidenceScopes(basis: DeterministicSajuBasis, catalog: EvidenceCatalog) {
  // Top-level summaries and action plans intentionally combine natal and
  // timing interpretation; narrower structures below use stricter scopes.
  const scopes: EvidenceScope[] = ['interpretation', 'temporal'];
  if (basis.commercialV2.compatibility) scopes.push('compatibility');
  return availableScopes(scopes, catalog);
}

function questionEvidenceScopes(
  question: string,
  basis: DeterministicSajuBasis,
  catalog: EvidenceCatalog
) {
  const scopes: EvidenceScope[] = ['interpretation'];
  if (/언제|시기|올해|내년|이번|다음|월|년|대운|세운|월운|이직|이동|재회/.test(question)) {
    scopes.push('temporal');
  }
  if (/궁합|상대|연애|사랑|결혼|배우자|남자친구|여자친구|파트너|관계/.test(question)) {
    scopes.push('compatibility');
  }
  if (basis.commercialV2.compatibility) scopes.push('compatibility');
  return availableScopes([...new Set(scopes)], catalog);
}

function sectionEvidenceScopes(
  sectionId: string,
  basis: DeterministicSajuBasis,
  catalog: EvidenceCatalog
) {
  if (TEMPORAL_SECTION_IDS.has(sectionId)) {
    return availableScopes(['temporal'], catalog);
  }

  const scopes: EvidenceScope[] = ['interpretation'];
  if (MIXED_SECTION_IDS.has(sectionId)) scopes.push('temporal');
  if (sectionId === 'love' && basis.commercialV2.compatibility) scopes.push('compatibility');
  return availableScopes(scopes, catalog);
}

/** 거부 사유 코드. engineMeta 관측 카운터의 키로 그대로 쓰이므로 ASCII 로만 짓는다. */
export type ProseRejectionCode =
  | 'malformed-citation'
  | 'missing-citation'
  | 'citation-only'
  | 'unknown-evidence-id'
  | 'out-of-scope-evidence'
  | 'no-base-anchor'
  | 'base-mismatch'
  | 'unknown-entity'
  | 'banned-phrase'
  | 'undeletable-copy-removed'
  /** 값은 실재하지만 **다른 자리의 값**이다. `일주는 임자`(실제 무자) 같은 모순. */
  | 'misattributed-claim'
  /** 검증은 통과했지만 상위 구조가 버려져 고객에게 도달하지 않은 필드. */
  | 'dropped-with-parent'
  /** sanitize 단계에서 길이 상한을 넘어 폐기된 필드. 검증까지 오지 못한다. */
  | 'length-discard';

export interface ProseRejection {
  path: string;
  code: ProseRejectionCode;
  message: string;
}

/**
 * 산문 한 필드를 검증한다. **throw 하지 않고 거부 사유를 돌려준다.**
 *
 * 이 반환형 변경이 per-field fallback 의 전제다. 이전에는 첫 실패가 곧 throw 였고,
 * `assertGeminiEvidenceReferences` 를 감싼 try/catch 가 draft 전체를 버렸다.
 *
 * 세 단계는 순서대로 걸린다:
 *   ① 범위 검사 — 근거 인용 형식과 scope. 모드와 무관하게 항상 적용된다.
 *   ②③ 는 `authored` 모드에서만. `strict-echo` 에서는 기존 바이트 일치가 그대로 남는다.
 *
 * 영구 잠금 구간(삭제 불가 문구·법정 고지가 들어 있는 필드)은 `authored` 모드에서도
 * 바이트 일치를 유지한다(명세 §4-6).
 */
function evaluateGeneratedProse(
  path: string,
  value: string,
  permittedScopes: EvidenceScope[],
  catalog: EvidenceCatalog,
  expected: string | undefined,
  context: ProseGuardContext
): ProseRejection | null {
  const reject = (code: ProseRejectionCode, message: string): ProseRejection => ({ path, code, message });

  if (hasMalformedReportEvidenceReference(value)) {
    return reject('malformed-citation', `Gemini 근거 인용 형식이 잘못되었습니다 (${path}).`);
  }

  const references = parseReportEvidenceReferences(value);
  if (references.length === 0 || references.some((reference) => reference.ids.length === 0)) {
    return reject('missing-citation', `Gemini 생성 문장에 근거 ID가 없습니다 (${path}).`);
  }

  const body = stripReportEvidenceReferences(value);
  if (!body) {
    return reject('citation-only', `Gemini 생성 문장에 근거 인용 외 설명이 없습니다 (${path}).`);
  }

  for (const reference of references) {
    for (const id of reference.ids) {
      const actualScopes = catalog.scopesById.get(id);
      if (!actualScopes) {
        return reject(
          'unknown-evidence-id',
          `Gemini가 존재하지 않는 명리 근거를 인용했습니다 (${path}): ${id}`
        );
      }
      if (!permittedScopes.some((scope) => actualScopes.has(scope))) {
        return reject(
          'out-of-scope-evidence',
          `Gemini가 문장 범위와 무관한 명리 근거를 인용했습니다 (${path}): ${id}`
        );
      }
    }
  }

  if (expected === undefined) {
    // 되돌릴 base 값이 없는 필드는 어떤 모드에서도 채택하지 않는다.
    // 실패 시 되돌릴 곳이 없으면 per-field fallback 자체가 성립하지 않는다.
    return reject(
      'no-base-anchor',
      `Gemini 생성 문장이 결정론적 기본 문구와 일치하지 않습니다 (${path}).`
    );
  }

  /*
   * 삭제 불가 문구 검사를 **엄격 일치 분기보다 먼저** 둔다.
   *
   * 이전 순서에서는 이 사유가 도달 불가능한 죽은 분기였다 — 삭제 불가 조각이 base 에
   * 있으면 `isPermanentlyLockedProse` 가 true 가 되어 위쪽 strict 분기에서 이미
   * `base-mismatch` 로 반환됐기 때문이다. 문구를 지운 것과 문구는 남겼지만 다른 곳을
   * 바꾼 것은 관측상 구분되어야 한다(`rejectionsByReason` 로 원인을 지목하는 계약).
   */
  const removed = findRemovedUndeletableCopy(body, expected);
  if (removed.length > 0) {
    return reject(
      'undeletable-copy-removed',
      `Gemini 문장이 삭제 불가 문구를 지웠습니다 (${path}): ${removed.join(' / ')}`
    );
  }

  const strictEquality = context.mode === 'strict-echo' || isPermanentlyLockedProse(expected);
  if (strictEquality) {
    if (body !== expected.trim()) {
      return reject(
        'base-mismatch',
        `Gemini 생성 문장이 결정론적 기본 문구와 일치하지 않습니다 (${path}).`
      );
    }
    return null;
  }

  // ② 엔티티 화이트리스트
  const unknownEntities = findUnknownEntities(body, context.universe);
  if (unknownEntities.length > 0) {
    const detail = unknownEntities.map((entity) => `${entity.kind}=${entity.token}`).join(', ');
    return reject(
      'unknown-entity',
      `Gemini 문장에 결정론 계산에 없는 값이 있습니다 (${path}): ${detail}`
    );
  }

  // ②-b 귀속 검사. 집합에는 있지만 다른 자리의 값을 가져다 붙인 주장을 잡는다.
  const misattributed = findMisattributedClaims(body, context.anchors);
  if (misattributed.length > 0) {
    const detail = misattributed
      .map((claim) => `${claim.subject}:${claim.claimed}!=${claim.actual}`)
      .join(', ');
    return reject(
      'misattributed-claim',
      `Gemini 문장이 계산값과 다른 값을 그 자리에 붙였습니다 (${path}): ${detail}`
    );
  }

  // ③ 금지 표현 선검사 + 의도 단위 안전 판정
  const textViolations = findNewTextViolations(body, expected, context.serviceId, {
    band: context.band,
    intent: context.intent
  });
  if (textViolations.length > 0) {
    return reject(
      'banned-phrase',
      `Gemini 문장에 금지 표현이 있습니다 (${path}): ${textViolations.join(', ')}`
    );
  }

  return null;
}

interface ProseGuardContext {
  mode: ProseGuardMode;
  universe: EntityUniverse;
  /** 귀속 검사용 결정론 값. `일간`·기둥·도움 오행·오행 극값·십성 강약. */
  anchors: ReportFactAnchors;
  serviceId: SajuReportData['serviceId'];
  /** 밴드별 금지어. `null` 이면 공통 49개만 검사된다. */
  band: ReunionAgeBand | null;
  /** 차단·거절·학대 신호. 의도 가드의 추가 규칙을 켠다. */
  intent: ReunionIntentContext | null;
}

export interface GeminiDraftReview {
  /** 채택된 필드만 남고 거부된 필드는 base 값으로 되돌려진 draft. */
  draft: GeminiDraft;
  mode: ProseGuardMode;
  accepted: number;
  rejected: number;
  /** 사유 코드별 집계. engineMeta 관측 카운터로 그대로 나간다. */
  rejectionsByReason: Record<string, number>;
  rejections: ProseRejection[];
  /** 채택된 필드 경로. 병합 후 계열 되돌리기가 채택 수를 재계산하는 데 쓴다. */
  acceptedPaths: readonly string[];
}

class DraftReviewer {
  readonly rejections: ProseRejection[] = [];
  /** 채택된 경로. `dropAccepted` 와 병합 후 계열 되돌리기가 채택 수 재계산에 쓴다. */
  readonly acceptedFieldPaths: string[] = [];
  accepted = 0;

  constructor(
    private readonly catalog: EvidenceCatalog,
    private readonly context: ProseGuardContext
  ) {}

  /** 채택하면 값을, 거부하면 `undefined` 를 돌려준다(= 병합 시 base 값이 남는다). */
  field(
    path: string,
    value: string | undefined,
    expected: string | undefined,
    scopes: EvidenceScope[]
  ): string | undefined {
    if (!value) return undefined;
    const rejection = evaluateGeneratedProse(path, value, scopes, this.catalog, expected, this.context);
    if (rejection) {
      this.rejections.push(rejection);
      return undefined;
    }
    this.accepted += 1;
    this.acceptedFieldPaths.push(path);
    return value;
  }

  /**
   * 채택했지만 **부모와 함께 버려진** 필드를 되돌린다.
   *
   * `callout` 은 `body` 가 살아남은 경우에만 유지되는데, `title` 만 채택되고 `body` 가
   * 거부되면 `accepted` 는 이미 1 올라간 상태에서 `callout` 이 통째로 사라진다.
   * 그러면 `accepted > 0` 인데 모델이 쓴 문장은 고객에게 하나도 안 가고,
   * `accepted === 0` 게이트가 바이트 단위로 결정론과 같은 리포트를 `provider: 'gemini'`
   * 로 라벨한다. 내용상 무해하지만 관측 계약이 깨진다 —
   * `aiFields` 로 채택률을 보는 다음 단계가 분모를 잘못 읽는다.
   */
  dropAccepted(path: string) {
    const index = this.acceptedFieldPaths.indexOf(path);
    if (index < 0) return;
    this.acceptedFieldPaths.splice(index, 1);
    this.accepted -= 1;
    this.rejections.push({
      path,
      code: 'dropped-with-parent',
      message: `Gemini 문장이 상위 구조와 함께 폐기되었습니다 (${path}).`
    });
  }

  /**
   * 배열은 **base 길이를 유지하고 인덱스 단위로 채운다**(명세 §4-1 d).
   *
   * 이전에는 `matched.paragraphs?.filter(Boolean) || section.paragraphs` 로 배열을 통째
   * 교체했기 때문에, 모델이 5개 문단 중 1개만 돌려주면 섹션이 조용히 4개 잘린 채
   * 고객에게 나갔다. base 길이로 고정하면 그 사고가 구조적으로 불가능해진다.
   */
  list(
    path: string,
    values: ReadonlyArray<string | undefined> | undefined,
    baseValues: readonly string[] | undefined,
    scopes: EvidenceScope[]
  ): string[] | undefined {
    const draftValues = values || [];
    const base = baseValues || [];
    const limit = Math.max(draftValues.length, base.length);
    const acceptedByIndex = new Map<number, string>();

    for (let index = 0; index < limit; index += 1) {
      const candidate = draftValues[index];
      const kept = this.field(`${path}.${index}`, candidate, base[index], scopes);
      if (kept !== undefined) acceptedByIndex.set(index, kept);
    }

    if (base.length === 0 || acceptedByIndex.size === 0) return undefined;
    return base.map((baseValue, index) => acceptedByIndex.get(index) ?? baseValue);
  }
}

function walkGeminiDraft(
  draft: GeminiDraft,
  basis: DeterministicSajuBasis,
  base: SajuReportData,
  reviewer: DraftReviewer,
  catalog: EvidenceCatalog
): GeminiDraft {
  const primaryScopes = primaryEvidenceScopes(basis, catalog);
  const temporalScopes = availableScopes(['temporal'], catalog);

  const heroNote = reviewer.field('heroNote', draft.heroNote, base.heroNote, primaryScopes);

  const summary = draft.summary
    ? {
        title: reviewer.field('summary.title', draft.summary.title, base.summary.title, primaryScopes),
        analysis: reviewer.list('summary.analysis', draft.summary.analysis, base.summary.analysis, primaryScopes),
        advice: reviewer.list('summary.advice', draft.summary.advice, base.summary.advice, primaryScopes)
      }
    : undefined;

  const keyTakeaways = draft.keyTakeaways?.map((card, index) => {
    const baseCard = base.keyTakeaways.find((candidate) => candidate.title === card.title);
    return {
      title: card.title,
      body: reviewer.field(`keyTakeaways.${index}.body`, card.body, baseCard?.body, primaryScopes),
      badge: reviewer.field(`keyTakeaways.${index}.badge`, card.badge, baseCard?.badge, primaryScopes)
    };
  }).filter((card) => card.body !== undefined || card.badge !== undefined);

  const questionAnswers = draft.questionAnswers?.map((answer, index) => {
    const baseAnswer = base.questionAnswers.find((candidate) => candidate.question === answer.question);
    const scopes = questionEvidenceScopes(answer.question || '', basis, catalog);
    return {
      question: answer.question,
      title: reviewer.field(`questionAnswers.${index}.title`, answer.title, baseAnswer?.title, scopes),
      analysis: reviewer.field(`questionAnswers.${index}.analysis`, answer.analysis, baseAnswer?.analysis, scopes),
      advice: reviewer.list(`questionAnswers.${index}.advice`, answer.advice, baseAnswer?.advice, scopes)
    };
  }).filter((answer) => (
    answer.title !== undefined || answer.analysis !== undefined || answer.advice !== undefined
  ));

  const sections = draft.sections?.map((section, index) => {
    const baseSection = base.sections.find((candidate) => candidate.id === section.id);
    const scopes = sectionEvidenceScopes(section.id, basis, catalog);
    const callout = section.callout
      ? {
          title: reviewer.field(
            `sections.${index}.callout.title`,
            section.callout.title,
            baseSection?.callout?.title,
            scopes
          ),
          body: reviewer.field(
            `sections.${index}.callout.body`,
            section.callout.body,
            baseSection?.callout?.body,
            scopes
          )
        }
      : undefined;
    /*
     * `callout` 은 `body` 가 없으면 아래에서 통째로 버려진다. 그런데 `title` 은 이미
     * `accepted` 에 계상됐다. 버려지는 필드를 채택으로 세면 관측 분모가 어긋난다.
     */
    if (callout && callout.body === undefined && callout.title !== undefined) {
      reviewer.dropAccepted(`sections.${index}.callout.title`);
    }

    return {
      id: section.id,
      paragraphs: reviewer.list(
        `sections.${index}.paragraphs`,
        section.paragraphs,
        baseSection?.paragraphs,
        scopes
      ),
      bullets: reviewer.list(`sections.${index}.bullets`, section.bullets, baseSection?.bullets, scopes),
      callout: callout?.body !== undefined ? callout : undefined,
      cards: section.cards?.map((card, cardIndex) => {
        const baseCard = baseSection?.cards?.find((candidate) => candidate.title === card.title);
        return {
          title: card.title,
          body: reviewer.field(`sections.${index}.cards.${cardIndex}.body`, card.body, baseCard?.body, scopes),
          badge: reviewer.field(`sections.${index}.cards.${cardIndex}.badge`, card.badge, baseCard?.badge, scopes)
        };
      }).filter((card) => card.body !== undefined || card.badge !== undefined),
      details: section.details?.map((detail, detailIndex) => {
        const baseDetail = baseSection?.details?.find((candidate) => candidate.summary === detail.summary);
        return {
          summary: detail.summary,
          content: reviewer.field(
            `sections.${index}.details.${detailIndex}.content`,
            detail.content,
            baseDetail?.content,
            scopes
          )
        };
      }).filter((detail) => detail.content !== undefined)
    };
  }).filter((section) => (
    section.paragraphs !== undefined ||
    section.bullets !== undefined ||
    section.callout !== undefined ||
    (section.cards?.length || 0) > 0 ||
    (section.details?.length || 0) > 0
  ));

  const reviewFortuneWindow = (
    key: 'currentDayun' | 'nextDayun',
    value: GeminiDraft['currentDayun']
  ) => {
    if (!value) return undefined;
    const reviewed = {
      summary: reviewer.field(`${key}.summary`, value.summary, base[key].summary, temporalScopes),
      focus: reviewer.field(`${key}.focus`, value.focus, base[key].focus, temporalScopes),
      caution: reviewer.field(`${key}.caution`, value.caution, base[key].caution, temporalScopes)
    };
    return reviewed.summary === undefined && reviewed.focus === undefined && reviewed.caution === undefined
      ? undefined
      : reviewed;
  };

  const currentDayun = reviewFortuneWindow('currentDayun', draft.currentDayun);
  const nextDayun = reviewFortuneWindow('nextDayun', draft.nextDayun);

  const reviewDays = (
    key: 'luckyDays' | 'unluckyDays',
    days: NonNullable<GeminiDraft['actionPlan']>['luckyDays']
  ) => days?.map((day, index) => {
    const baseDay = base.actionPlan[key].find((candidate) => candidate.day === day.day);
    return {
      day: day.day,
      reason: reviewer.field(
        `actionPlan.${key}.${index}.reason`,
        day.reason,
        baseDay?.reason,
        temporalScopes
      )
    };
  }).filter((day): day is { day: number; reason: string } => typeof day.reason === 'string');

  const actionPlan = draft.actionPlan
    ? {
        title: reviewer.field('actionPlan.title', draft.actionPlan.title, base.actionPlan.title, primaryScopes),
        priorities: reviewer.list(
          'actionPlan.priorities',
          draft.actionPlan.priorities,
          base.actionPlan.priorities,
          primaryScopes
        ),
        dos: reviewer.list('actionPlan.dos', draft.actionPlan.dos, base.actionPlan.dos, primaryScopes),
        avoids: reviewer.list('actionPlan.avoids', draft.actionPlan.avoids, base.actionPlan.avoids, primaryScopes),
        luckyDays: reviewDays('luckyDays', draft.actionPlan.luckyDays),
        unluckyDays: reviewDays('unluckyDays', draft.actionPlan.unluckyDays)
      }
    : undefined;

  return {
    heroNote,
    summary,
    keyTakeaways: keyTakeaways?.length ? keyTakeaways : undefined,
    questionAnswers: questionAnswers?.length ? questionAnswers : undefined,
    sections: sections?.length ? sections : undefined,
    currentDayun,
    nextDayun,
    actionPlan
  };
}

/**
 * 필드별로 채택/거부를 판정한다 (명세 §4-1 b).
 *
 * all-or-nothing 을 대체한다. 실패한 필드만 base 로 되돌리고 나머지는 채택한다.
 * 이게 없으면 `cloudrun-api` 의 `reportService.generatePaid()` 가
 * `provider === 'deterministic-fallback'` 을 실패로 처리해 ledger 가 failed 로 남고
 * `reportJson` 캐시가 저장되지 않는다(같은 결제로 재요청 시 전체 재실행).
 */
export interface ReviewGeminiDraftOptions {
  mode?: ProseGuardMode;
  /** 유료 요청의 재회 맥락. 차단·거절·학대 신호를 가드까지 실어 보낸다. */
  reunionContext?: ReunionContext | null;
}

export function reviewGeminiDraft(
  draft: GeminiDraft,
  basis: DeterministicSajuBasis,
  base: SajuReportData,
  modeOrOptions: ProseGuardMode | ReviewGeminiDraftOptions = {}
): GeminiDraftReview {
  const options: ReviewGeminiDraftOptions =
    typeof modeOrOptions === 'string' ? { mode: modeOrOptions } : modeOrOptions;
  const reunionContext = options.reunionContext ?? null;
  const mode =
    options.mode ??
    resolveProseGuardMode({
      serviceId: base.serviceId,
      reunionContext,
      questions: basis.input.questions
    });

  const catalog = collectEvidenceCatalog(basis);

  if (Object.values(catalog.byScope).every((ids) => ids.size === 0) && Object.keys(draft).length > 0) {
    throw new Error('검증 가능한 상용 명리 근거가 없어 Gemini 생성 문장을 사용할 수 없습니다.');
  }

  const reviewer = new DraftReviewer(catalog, {
    mode,
    universe: buildEntityUniverse(basis, base),
    anchors: buildReportFactAnchors(basis, base),
    serviceId: base.serviceId,
    band: base.serviceId === 'love-reunion' ? resolveGuardAgeBand(basis, base) : null,
    intent:
      base.serviceId === 'love-reunion'
        ? toReunionIntentContext(reunionContext, basis.input.questions)
        : null
  });
  const reviewed = walkGeminiDraft(draft, basis, base, reviewer, catalog);

  const rejectionsByReason = reviewer.rejections.reduce<Record<string, number>>((result, rejection) => {
    result[rejection.code] = (result[rejection.code] || 0) + 1;
    return result;
  }, {});

  return {
    draft: reviewed,
    mode,
    accepted: reviewer.accepted,
    rejected: reviewer.rejections.length,
    rejectionsByReason,
    rejections: reviewer.rejections,
    acceptedPaths: reviewer.acceptedFieldPaths
  };
}

/**
 * 한 필드라도 거부되면 throw 하는 엄격 검사.
 *
 * 프로덕션 경로는 `reviewGeminiDraft` 를 쓴다. 이 함수는 계약 테스트와
 * "이 draft 는 완전한 echo 인가" 를 단정해야 하는 호출자를 위해 남겨 둔다.
 */
export function assertGeminiEvidenceReferences(
  draft: GeminiDraft,
  basis: DeterministicSajuBasis,
  base: SajuReportData,
  mode: ProseGuardMode = 'strict-echo'
) {
  const review = reviewGeminiDraft(draft, basis, base, mode);
  const [first] = review.rejections;
  if (first) {
    throw new Error(first.message);
  }
}

function stripGeneratedEvidence(value: string | undefined) {
  return value === undefined ? undefined : stripReportEvidenceReferences(value);
}

/**
 * Evidence IDs are transport-time validation metadata. They must never reach
 * customer-facing report copy, where an ID could look like a source-backed
 * endorsement of prose authored by a text model.
 */
export function stripGeminiEvidenceMetadata(draft: GeminiDraft): GeminiDraft {
  return {
    ...draft,
    heroNote: stripGeneratedEvidence(draft.heroNote),
    summary: draft.summary
      ? {
          ...draft.summary,
          title: stripGeneratedEvidence(draft.summary.title),
          analysis: draft.summary.analysis?.map((value) => stripReportEvidenceReferences(value)),
          advice: draft.summary.advice?.map((value) => stripReportEvidenceReferences(value))
        }
      : undefined,
    keyTakeaways: draft.keyTakeaways?.map((card) => ({
      ...card,
      body: stripGeneratedEvidence(card.body),
      badge: stripGeneratedEvidence(card.badge)
    })),
    questionAnswers: draft.questionAnswers?.map((answer) => ({
      ...answer,
      title: stripGeneratedEvidence(answer.title),
      analysis: stripGeneratedEvidence(answer.analysis),
      advice: answer.advice?.map((value) => stripReportEvidenceReferences(value))
    })),
    sections: draft.sections?.map((section) => ({
      ...section,
      paragraphs: section.paragraphs?.map((value) => stripReportEvidenceReferences(value)),
      bullets: section.bullets?.map((value) => stripReportEvidenceReferences(value)),
      callout: section.callout
        ? {
            ...section.callout,
            title: stripGeneratedEvidence(section.callout.title),
            body: stripGeneratedEvidence(section.callout.body)
          }
        : undefined,
      cards: section.cards?.map((card) => ({
        ...card,
        body: stripGeneratedEvidence(card.body),
        badge: stripGeneratedEvidence(card.badge)
      })),
      details: section.details?.map((detail) => ({
        ...detail,
        content: stripGeneratedEvidence(detail.content)
      }))
    })),
    currentDayun: draft.currentDayun
      ? {
          ...draft.currentDayun,
          summary: stripGeneratedEvidence(draft.currentDayun.summary),
          focus: stripGeneratedEvidence(draft.currentDayun.focus),
          caution: stripGeneratedEvidence(draft.currentDayun.caution)
        }
      : undefined,
    nextDayun: draft.nextDayun
      ? {
          ...draft.nextDayun,
          summary: stripGeneratedEvidence(draft.nextDayun.summary),
          focus: stripGeneratedEvidence(draft.nextDayun.focus),
          caution: stripGeneratedEvidence(draft.nextDayun.caution)
        }
      : undefined,
    actionPlan: draft.actionPlan
      ? {
          ...draft.actionPlan,
          title: stripGeneratedEvidence(draft.actionPlan.title),
          priorities: draft.actionPlan.priorities?.map((value) => stripReportEvidenceReferences(value)),
          dos: draft.actionPlan.dos?.map((value) => stripReportEvidenceReferences(value)),
          avoids: draft.actionPlan.avoids?.map((value) => stripReportEvidenceReferences(value)),
          luckyDays: draft.actionPlan.luckyDays?.map((day) => ({
            ...day,
            reason: stripReportEvidenceReferences(day.reason)
          })),
          unluckyDays: draft.actionPlan.unluckyDays?.map((day) => ({
            ...day,
            reason: stripReportEvidenceReferences(day.reason)
          }))
        }
      : undefined
  };
}

function serializeEvidenceCatalog(basis: DeterministicSajuBasis) {
  const catalog = collectEvidenceCatalog(basis);
  return ALL_EVIDENCE_SCOPES.reduce<Record<EvidenceScope, string[]>>((result, scope) => {
    result[scope] = [...catalog.byScope[scope]].sort();
    return result;
  }, {
    interpretation: [],
    temporal: [],
    compatibility: []
  });
}

/** 컷 카피의 `claimRefs` 검증용. 스코프 구분 없이 실재 ID 집합만 본다. */
function collectEvidenceIds(basis: DeterministicSajuBasis): ReadonlySet<string> {
  return new Set(collectEvidenceCatalog(basis).scopesById.keys());
}

const CLAIM_LEDGER_MAX_ENTRIES = 400;
const CLAIM_LEDGER_STATEMENT_KEYS = ['statement', 'label', 'title', 'summary', 'text', 'description'];

/**
 * 근거 ID **원장**. ID 목록만 넘기던 것에 '그 ID 가 무슨 주장인지' 를 붙인다 (명세 §4-3).
 *
 * `serializeEvidenceCatalog` 는 유효한 ID 문자열만 넘긴다. 모델은 ID 는 아는데 그 ID 가
 * 무슨 내용인지 모르므로 구조적으로 '근거를 보고 문장을 쓰기' 가 불가능하고 'ID 를 붙이기'
 * 만 가능했다. 산문 잠금을 푸는 순간 이게 가장 큰 병목이 된다.
 *
 * 명세는 `scope` · `certainty` 까지 담은 정식 원장을 요구하지만, 그러려면 basis 의
 * 근거 객체 모양을 종류별로 알아야 한다. 여기서는 **모양을 모르는 채로 만드는 방법**을
 * 쓴다 — `id`/`ruleId` 를 가진 객체를 만나면 같은 객체의 서술 필드를 그대로 가져온다.
 * scope 는 `evidenceIdCatalog` 가 이미 따로 넘기므로 중복해서 싣지 않는다.
 */
function serializeClaimLedger(basis: DeterministicSajuBasis): Array<{ id: string; statement: string }> {
  const ledger = new Map<string, string>();

  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object' || ledger.size >= CLAIM_LEDGER_MAX_ENTRIES) return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const record = value as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id : typeof record.ruleId === 'string' ? record.ruleId : null;
    if (id && !ledger.has(id)) {
      const statementKey = CLAIM_LEDGER_STATEMENT_KEYS.find((key) => typeof record[key] === 'string' && (record[key] as string).trim());
      if (statementKey) ledger.set(id, (record[statementKey] as string).trim());
    }
    Object.values(record).forEach(visit);
  };

  visit(basis.commercialV2);
  return [...ledger].map(([id, statement]) => ({ id, statement }));
}

export class ReportRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ReportRequestError';
    this.status = status;
  }
}

export function toFormData(body: ReportRequestBody): Partial<IntakeFormData> {
  const pastLifeContext = body.payload?.pastLifeContext;

  return normalizeIntakeFormData({
    name: body.payload?.user?.name || '',
    gender: body.payload?.user?.gender,
    calendar: body.payload?.birth?.calendar,
    isLeapMonth: Boolean(body.payload?.birth?.isLeapMonth),
    birthDate: body.payload?.birth?.date || '',
    birthTime: body.payload?.birth?.time || '',
    isUnknownTime: Boolean(body.payload?.birth?.isUnknownTime),
    birthTimePrecision: body.payload?.birth?.precision,
    dayBoundaryPolicy: body.payload?.birth?.dayBoundaryPolicy,
    birthLocation: body.payload?.birth?.location || undefined,
    location: body.payload?.birth?.locationText || body.payload?.birth?.location?.label || '',
    partner: body.payload?.partner || undefined,
    relationshipStatus: body.payload?.relationship?.status || '',
    relationshipDuration: body.payload?.relationship?.duration || '',
    loveReaction: normalizeLoveReaction(body.payload?.relationship?.microChoice) ?? undefined,
    loveFocus: normalizeLoveFocus(body.payload?.relationship?.focus) ?? undefined,
    pastLifeTopic: pastLifeContext?.topic || '',
    repeatedScene: pastLifeContext?.repeatedScene || '',
    frequentEmotion: pastLifeContext?.frequentEmotion || '',
    hiddenDesire: pastLifeContext?.hiddenDesire || '',
    chosenSymbol: pastLifeContext?.chosenSymbol || '',
    readingTone: pastLifeContext?.readingTone || '',
    reunionContext: body.payload?.reunionContext || undefined,
    q1: body.payload?.questions?.[0] || '',
    q2: body.payload?.questions?.[1] || ''
  });
}

function assertTextLength(value: string | undefined, label: string, maxLength: number) {
  if ((value?.trim().length || 0) > maxLength) {
    throw new ReportRequestError(422, `${label}은(는) ${maxLength}자 이내로 입력해 주세요.`);
  }
}

function assertSupportedBirthYear(value: string | undefined, label: string) {
  const year = Number(value?.slice(0, 4));
  if (!Number.isInteger(year) || year < 1900 || year > 2099) {
    throw new ReportRequestError(
      422,
      `${label} 생년월일은 상용 검증 범위인 1900-2099년 안에서 입력해 주세요.`
    );
  }
}

function hasInvariantDay(calculation: NonNullable<ReturnType<typeof validateIntakeBirthInputs>['self']['calculation']>) {
  return new Set(
    calculation.scenarios.map(({ bazi }) => `${bazi.d_gz.tg}:${bazi.d_gz.dz}`)
  ).size === 1;
}

/** Server-side release gate. Client validation is convenience, never authority. */
export function assertCommercialReportRequest(
  serviceId: ServiceId,
  formData: Partial<IntakeFormData>,
  options: { allowUnstableDay?: boolean; reunionContext?: unknown } = {}
) {
  const requirePartner = serviceId === 'match-couple' || serviceId === 'match-destiny' || serviceId === 'love-reunion';
  const validation = validateIntakeBirthInputs(formData, { requirePartner });

  if (serviceId === 'love-reunion') {
    const reunionValidation = validateReunionContext(
      options.reunionContext ?? formData.reunionContext
    );

    if (!reunionValidation.valid) {
      throw new ReportRequestError(
        422,
        reunionValidation.errors.map((error) => error.message).join(' ')
      );
    }
  }

  if (!validation.valid) {
    throw new ReportRequestError(
      422,
      validation.errors.map((error) => error.message).join(' ')
    );
  }

  assertTextLength(formData.name, '이름', 50);
  assertTextLength(formData.q1, '첫 번째 질문', 500);
  assertTextLength(formData.q2, '두 번째 질문', 500);
  assertTextLength(formData.birthLocation?.label, '출생지', 120);
  assertSupportedBirthYear(formData.birthDate, '본인');

  if (!formData.q1?.trim() || !formData.q2?.trim()) {
    throw new ReportRequestError(422, '유료 리포트는 개인화 질문 두 가지를 모두 입력해야 합니다.');
  }

  if (
    !validation.self.calculation ||
    (!options.allowUnstableDay && !hasInvariantDay(validation.self.calculation))
  ) {
    throw new ReportRequestError(
      422,
      '출생시간 시나리오에 따라 일주가 달라 단일 유료 리포트를 만들 수 없습니다. 출생시간 또는 자시 경계 정책을 확인해 주세요.'
    );
  }

  if (formData.partner) {
    assertTextLength(formData.partner.name, '상대방 이름', 50);
    assertTextLength(formData.partner.birthLocation?.label, '상대방 출생지', 120);
    assertSupportedBirthYear(formData.partner.birthDate, '상대방');
  }

  if (validation.partner?.calculation && !hasInvariantDay(validation.partner.calculation)) {
    throw new ReportRequestError(
      422,
      '상대방 출생시간 시나리오에 따라 일주가 달라 정밀 궁합을 만들 수 없습니다. 상대방 출생시간을 확인해 주세요.'
    );
  }
}

export type PreparedCommercialReportRequest = {
  serviceId: ServiceId;
  inputFormData: Partial<IntakeFormData>;
  formData: Partial<IntakeFormData>;
  verification: Awaited<ReturnType<typeof normalizeFormDataWithKasi>>['verification'];
  deterministicBasis: DeterministicSajuBasis;
};

/**
 * Canonical server-side preparation shared by release preflight and report generation.
 * The caller may allow an unstable day only so the existing release audit can return
 * its canonical `blocked` decision; paid report generation remains strict by default.
 */
export async function prepareCommercialReportRequest(
  body: ReportRequestBody,
  options: { allowUnstableDay?: boolean } = {}
): Promise<PreparedCommercialReportRequest> {
  const serviceId = body.serviceId;

  if (!serviceId) {
    throw new ReportRequestError(400, 'serviceId는 필수입니다.');
  }

  const inputFormData = toFormData(body);
  assertCommercialReportRequest(serviceId, inputFormData, {
    ...options,
    reunionContext: body.payload?.reunionContext
  });
  const { formData, verification } = await normalizeFormDataWithKasi(inputFormData);

  if (inputFormData.calendar === 'lunar' && verification.status !== 'verified') {
    throw new ReportRequestError(
      503,
      '한국 음력 생일은 KASI 교차 검증이 완료되어야 유료 리포트를 생성할 수 있습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  return {
    serviceId,
    inputFormData,
    formData,
    verification,
    deterministicBasis: buildDeterministicSajuBasis(serviceId, formData, verification)
  };
}

/**
 * 배열 병합은 **base 길이를 유지하고 인덱스 단위로 채운다** (명세 §4-1 d).
 *
 * `matched.paragraphs?.filter(Boolean) || section.paragraphs` 는 모델이 5개 문단 중
 * 1개만 돌려줘도 배열을 통째 교체해 **섹션이 조용히 4개 잘린 채 고객에게 나갔다.**
 * 검증 계층은 이미 인덱스 단위로 고쳤지만, 병합 계층에도 같은 계약을 둔다 —
 * 리뷰를 거치지 않는 호출자가 하나만 생겨도 같은 사고가 되돌아온다.
 */
function mergeStringList<T extends string[] | undefined>(
  draft: ReadonlyArray<string | undefined> | undefined,
  base: T
): T {
  if (!draft?.length || !base?.length) return base;
  return base.map((value, index) => draft[index]?.trim() || value) as T;
}

function mergeCards(baseCards: ReportCard[], draftCards?: Partial<ReportCard>[]) {
  if (!draftCards?.length) {
    return baseCards;
  }

  return baseCards.map((card) => {
    const generated = draftCards.find((candidate) => candidate.title === card.title);
    return generated
      ? { ...card, body: generated.body || card.body, badge: generated.badge || card.badge }
      : card;
  });
}

function mergeDetails(baseDetails: ReportDetail[] | undefined, draftDetails?: Partial<ReportDetail>[]) {
  if (!baseDetails || !draftDetails?.length) {
    return baseDetails;
  }

  return baseDetails.map((detail) => {
    const generated = draftDetails.find((candidate) => candidate.summary === detail.summary);
    return generated?.content ? { ...detail, content: generated.content } : detail;
  });
}

function mergeSections(baseSections: ReportSection[], draftSections?: GeminiDraft['sections']) {
  if (!draftSections?.length) {
    return baseSections;
  }

  return baseSections.map((section) => {
    if (section.id.endsWith('-v2')) {
      return section;
    }
    const matched = draftSections.find((candidate) => candidate.id === section.id);

    if (!matched) {
      return section;
    }

    return {
      ...section,
      paragraphs: mergeStringList(matched.paragraphs, section.paragraphs),
      bullets: mergeStringList(matched.bullets, section.bullets),
      callout: matched.callout?.body
        ? {
            title: matched.callout.title || section.callout?.title,
            body: matched.callout.body
          }
        : section.callout,
      cards: section.cards ? mergeCards(section.cards, matched.cards) : section.cards,
      details: mergeDetails(section.details, matched.details)
    };
  });
}

function mergeQuestionAnswers(baseAnswers: QuestionAnswerBlock[], draftAnswers?: Partial<QuestionAnswerBlock>[]) {
  if (!draftAnswers?.length) {
    return baseAnswers;
  }

  return baseAnswers.map((answer) => {
    const draft = draftAnswers.find((candidate) => candidate.question === answer.question);

    if (!draft) {
      return answer;
    }

    return {
      ...answer,
      question: answer.question,
      title: draft.title || answer.title,
      analysis: draft.analysis || answer.analysis,
      advice: mergeStringList(draft.advice, answer.advice)
    };
  });
}

function mergeActionPlan(base: ActionPlan, draft?: Partial<ActionPlan>): ActionPlan {
  if (!draft) {
    return base;
  }

  return {
    ...base,
    title: draft.title || base.title,
    priorities: mergeStringList(draft.priorities, base.priorities),
    dos: mergeStringList(draft.dos, base.dos),
    avoids: mergeStringList(draft.avoids, base.avoids),
    luckyDays: base.luckyDays.map((item) => ({
      ...item,
      reason: draft.luckyDays?.find((candidate) => candidate.day === item.day)?.reason || item.reason
    })),
    unluckyDays: base.unluckyDays.map((item) => ({
      ...item,
      reason: draft.unluckyDays?.find((candidate) => candidate.day === item.day)?.reason || item.reason
    }))
  };
}

function mergeFortuneWindow(base: SajuReportData['currentDayun'], draft?: Partial<SajuReportData['currentDayun']>) {
  if (!draft) {
    return base;
  }

  return {
    ...base,
    summary: draft.summary || base.summary,
    focus: draft.focus || base.focus,
    caution: draft.caution || base.caution
  };
}

function mergeGeminiDraft(base: SajuReportData, draft?: GeminiDraft | null): SajuReportData {
  if (!draft) {
    return base;
  }

  return {
    ...base,
    heroNote: draft.heroNote || base.heroNote,
    legalNotice: base.legalNotice,
    // `...draft.summary` 를 그대로 펼치면 모델이 생략한 키가 `undefined` 로 base 를 덮는다.
    // per-field fallback 에서는 생략이 정상 경로이므로 키마다 명시적으로 되돌린다.
    summary: {
      ...base.summary,
      title: draft.summary?.title || base.summary.title,
      analysis: mergeStringList(draft.summary?.analysis, base.summary.analysis),
      advice: mergeStringList(draft.summary?.advice, base.summary.advice)
    },
    keyTakeaways: mergeCards(base.keyTakeaways, draft.keyTakeaways),
    questionAnswers: mergeQuestionAnswers(base.questionAnswers, draft.questionAnswers),
    sections: mergeSections(base.sections, draft.sections),
    currentDayun: mergeFortuneWindow(base.currentDayun, draft.currentDayun),
    nextDayun: mergeFortuneWindow(base.nextDayun, draft.nextDayun),
    actionPlan: mergeActionPlan(base.actionPlan, draft.actionPlan)
  };
}

/**
 * love-reunion 한정 온도 (명세 §4-2).
 *
 * `temperature: 0` 인 채로 문체 지침 40여 개를 주는 건 자기모순이다 — 온도 0 은 같은
 * 입력에 같은 문장을 돌려주라는 뜻이고, 문체 지침은 문장을 새로 쓰라는 뜻이다.
 *
 * 0.75 로 잡은 근거:
 * - 사실 위험은 온도가 아니라 3단 검증이 막는다. 온도는 **문체만** 흔든다.
 *   엔티티 화이트리스트·금지 표현·삭제 불가 문구·영구 잠금 구간은 온도와 무관하다.
 * - 더 올리면(0.9+) 인용 형식(`[근거:ID]`)과 배열 길이 같은 **형식** 준수율이 떨어진다.
 *   형식 위반의 대가는 문장 하나가 아니라 필드 하나가 결정론으로 되돌아가는 것이다.
 * - 다른 상품은 `strict-echo` 다. 거기서 온도를 올리면 base 와 한 글자만 달라도
 *   `base-mismatch` 로 100% 거부되므로 **0 을 유지해야 한다.**
 */
const LOVE_REUNION_TEMPERATURE = LOVE_REUNION_PROSE_TEMPERATURE;
const STRICT_ECHO_TEMPERATURE = STRICT_ECHO_PROSE_TEMPERATURE;

/**
 * 관계 상태 + 밴드별 금지어를 모델에게 알린다.
 *
 * 코드가 거부하는 것과 모델이 아는 것을 일치시키는 파트다. 거부만 하고 알리지 않으면
 * 모델은 같은 실수를 반복하고 거부율만 오른다 — 그러면 전 필드 거부로 fallback 이 되고,
 * 해제한 의미가 사라진다.
 */
export function buildReunionGuardDirectives(
  band: ReunionAgeBand | null,
  intent: ReunionIntentContext | null
): string {
  const lines = ['=== READER STATE AND BANNED EXPRESSIONS (enforced by the server) ==='];

  if (intent?.contactStatus) {
    lines.push(`- contactStatus (from the reader's own intake): ${intent.contactStatus}`);
  } else {
    lines.push('- contactStatus: not supplied. Treat contact timing as unverified and do not design contact.');
  }

  if (isContactWithheld(intent)) {
    lines.push(
      '- CONTACT IS WITHHELD for this reader. Blocked, refused, unverified, or a harm signal was reported.',
      '  In this state the only permitted advice is waiting, recording what already happened, and the reader\'s own daily life.',
      '  Do not say contact is possible, open, fine, or worth trying — not as a suggestion and not as a verdict.',
      '  Any sentence that reads as permission to reach out is discarded and replaced by the deterministic sentence.'
    );
  }

  if (intent?.harmSignalDetected) {
    lines.push(
      '- A HARM SIGNAL (violence, threat, control, confinement, fear) appears in the reader\'s own words.',
      '  Reunion design is off entirely. Do not write about reconciliation, understanding, forgiving, enduring, or talking it through.',
      '  Write only about physical distance, the reader\'s safety, and telling someone the reader trusts.'
    );
  }

  lines.push(
    '',
    'Banned expressions for this reader (the band-conditional set is included; a field containing one is discarded):',
    serializeReunionBannedPhrases(band || undefined)
  );

  return lines.join('\n');
}

export interface GeminiRequestPayloadOptions {
  /**
   * 유료 요청의 재회 맥락.
   *
   * 프롬프트의 `'When contactStatus is blocked or unknown … never suggest contact'` 조항은
   * 지금까지 **집행 surface 가 아예 없었다** — `contactStatus` 가 `src/lib/saju/` 와
   * `src/lib/server/` 에 0건이었다. 모델은 차단 여부·거절 여부를 알 수 없는 상태에서
   * 그 조항을 지키라는 요구만 받았다. 여기로 실제 상태를 넘기고,
   * 동시에 `reunionIntentGuard` 가 코드로 거부한다. 둘 중 하나만으로는 안 된다.
   */
  reunionContext?: ReunionContext | null;
}

export function buildGeminiRequestPayload(
  baseReport: SajuReportData,
  deterministicBasis: DeterministicSajuBasis,
  options: GeminiRequestPayloadOptions = {}
) {
  const relationshipContext = buildRelationshipPersonalizationContext({
    relationshipStatus: deterministicBasis.input.relationshipStatus || '',
    relationshipDuration: deterministicBasis.input.relationshipDuration || ''
  });
  const questionContexts = deterministicBasis.input.questions.map(buildQuestionContext);
  const partialSchema = {
    type: 'OBJECT',
    properties: {
      heroNote: { type: 'STRING' },
      summary: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          analysis: { type: 'ARRAY', items: { type: 'STRING' } },
          advice: { type: 'ARRAY', items: { type: 'STRING' } }
        }
      },
      keyTakeaways: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            body: { type: 'STRING' },
            tone: { type: 'STRING' },
            badge: { type: 'STRING' }
          }
        }
      },
      questionAnswers: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            question: { type: 'STRING' },
            title: { type: 'STRING' },
            analysis: { type: 'STRING' },
            advice: { type: 'ARRAY', items: { type: 'STRING' } }
          }
        }
      },
      sections: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' },
            title: { type: 'STRING' },
            subtitle: { type: 'STRING' },
            paragraphs: { type: 'ARRAY', items: { type: 'STRING' } },
            bullets: { type: 'ARRAY', items: { type: 'STRING' } },
            details: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  summary: { type: 'STRING' },
                  content: { type: 'STRING' },
                  open: { type: 'BOOLEAN' }
                }
              }
            },
            cards: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  body: { type: 'STRING' },
                  tone: { type: 'STRING' },
                  badge: { type: 'STRING' }
                }
              }
            },
            callout: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                body: { type: 'STRING' }
              }
            }
          }
        }
      },
      currentDayun: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          focus: { type: 'STRING' },
          caution: { type: 'STRING' }
        }
      },
      nextDayun: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          focus: { type: 'STRING' },
          caution: { type: 'STRING' }
        }
      },
      actionPlan: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          priorities: { type: 'ARRAY', items: { type: 'STRING' } },
          dos: { type: 'ARRAY', items: { type: 'STRING' } },
          avoids: { type: 'ARRAY', items: { type: 'STRING' } },
          luckyDays: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                day: { type: 'NUMBER' },
                reason: { type: 'STRING' }
              }
            }
          },
          unluckyDays: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                day: { type: 'NUMBER' },
                reason: { type: 'STRING' }
              }
            }
          }
        }
      }
    }
  };

  const isLoveReunion = baseReport.serviceId === 'love-reunion';
  /*
   * 산문 권한은 **상품 정체성과 따로** 잡는다.
   *
   * `isLoveReunion` 은 "이 상품이 재회운인가"(안전 규격·목소리·관계 상태 파트를 받는가)이고,
   * `isAuthored` 는 "새 문장을 써도 되는가"(echo 잠금 대신 산문 계약과 전용 문체를 받는가)다.
   * 둘을 한 변수로 묶어 두면 롤백할 때 **코드 가드와 프롬프트 두 곳을 반드시 같이**
   * 고쳐야 하고, 한쪽만 고치면 모델이 새 문장을 쓰고 전량 거부되어 전 요청이
   * fallback 으로 떨어진다 — 해제 전보다 나쁜 상태다.
   *
   * 그래서 같은 상수(`promptRelease.AUTHORED_PROSE_SERVICE_IDS`)를 가드와 프롬프트가
   * 함께 읽는다. 롤백은 그 배열 하나를 비우면 끝이고, 두 계층이 갈라질 수 없다.
   */
  const isAuthored = proseGuardModeForServiceId(baseReport.serviceId) === 'authored';
  const reunionPayload = isLoveReunion ? baseReport.reunion ?? null : null;
  const reunionCopySchema = reunionPayload ? buildReunionCopySchema(reunionPayload) : null;
  const guardBand = isLoveReunion ? resolveGuardAgeBand(deterministicBasis, baseReport) : null;
  const intentContext = isLoveReunion
    ? toReunionIntentContext(options.reunionContext, deterministicBasis.input.questions)
    : null;
  const responseSchema = reunionCopySchema
    ? {
        ...partialSchema,
        properties: { ...partialSchema.properties, reunionCopy: reunionCopySchema }
      }
    : partialSchema;

  /*
   * 프롬프트 2분할 (명세 §4-2).
   *
   * systemInstruction = 사실 제약. 어기면 필드가 버려지는 규칙만 여기 둔다.
   * contents = 데이터 파트 + 문체 파트. 문체 지침은 어겨도 아무 일도 일어나지 않는다.
   *
   * 이전에는 둘이 한 문자열(`requiredOutput`)로 붙어 있었고 그 문자열의 마지막 줄이
   * `FINAL RELEASE-SAFE OVERRIDE` 였다 — 앞의 문체 지침 40여 개를 마지막 한 줄이
   * 전부 무효화하는 구조였고, 모델이 할 수 있는 일은 결정론 문장 복사뿐이었다.
   */
  return {
    systemInstruction: {
      parts: [
        { text: PREMIUM_SAJU_SYSTEM_PROMPT },
        { text: PREMIUM_SAJU_FACT_CONSTRAINTS },
        ...(isLoveReunion
          ? [
              /* 안전 규격이 산문 권한보다 먼저 온다. 순서가 곧 우선순위다. */
              { text: LOVE_REUNION_OUTPUT_SAFETY_OVERRIDE },
              { text: LOVE_REUNION_AUTHORED_PROSE_CONTRACT },
              { text: LOVE_REUNION_VOICE_SPEC }
            ]
          : [{ text: PREMIUM_SAJU_STRICT_ECHO_RULE }])
      ]
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: JSON.stringify({
              context: buildPremiumSajuPromptContext({
                customerInput: deterministicBasis.input,
                deterministicBasis,
                relationshipContext,
                questionContexts,
                debug: false
              }),
              evidenceIdCatalog: serializeEvidenceCatalog(deterministicBasis),
              claimLedger: serializeClaimLedger(deterministicBasis),
              baseReport,
              deterministicBasis
            })
          },
          {
            /*
             * 문체 파트는 **상품별로 갈린다.**
             *
             * 이전에는 `isLoveReunion` 분기 없이 감각 정책(`팩폭` · `NO HEDGING` ·
             * `viral`)과 스타일 지침 55줄이 재회운에도 그대로 나갔다. 그 안에는
             * `'how the other person reads the customer'`(= 상대 속마음. 이 상품은
             * `applyLoveReunionSafetyContract` 가 '상대가 느끼는 나' 카드를 삭제한다)와
             * `'give concrete meeting routes and places'`(= 마주치는 장소 지시)가 있어
             * 같은 요청의 안전 오버라이드와 정면으로 모순됐다.
             */
            text: isAuthored
              ? [
                  '=== STYLE AND COMPOSITION (does not override FACT DISCIPLINE or the LOVE-REUNION SAFETY OVERRIDE) ===',
                  ...LOVE_REUNION_STYLE_DIRECTIVES
                ].join('\n')
              : [
                  '=== STYLE AND COMPOSITION (does not override FACT DISCIPLINE) ===',
                  PREMIUM_SAJU_HUMAN_SENSORY_POLICY,
                  ...PREMIUM_SAJU_STYLE_DIRECTIVES
                ].join('\n')
          },
          ...(isLoveReunion
            ? [
                {
                  /*
                   * 관계 상태와 밴드별 금지어. 둘 다 지금까지 프롬프트에 **없었다** —
                   * 모델은 차단 여부를 모른 채 '차단이면 접촉을 권하지 말라' 는 요구를
                   * 받았고, 밴드별 금지어(teen 5개 · thirties 5개 등)는 직렬화조차
                   * 되지 않았다. 코드 거부만으로는 모델이 왜 거부됐는지 모르고,
                   * 프롬프트만으로는 보장이 안 된다. 둘 다 있어야 한다.
                   */
                  text: buildReunionGuardDirectives(guardBand, intentContext)
                }
              ]
            : []),
          ...(reunionPayload ? [{ text: buildReunionCopyDirectives(reunionPayload, guardBand) }] : [])
        ]
      }
    ],
    generationConfig: {
      temperature: isLoveReunion ? LOVE_REUNION_TEMPERATURE : STRICT_ECHO_TEMPERATURE,
      topP: 0.9,
      responseMimeType: 'application/json',
      responseSchema
    }
  };
}

/**
 * 구조화 관측 로그. **거부 0건과 채택 0건에도 반드시 한 줄 남긴다.**
 *
 * 이전에는 `if (review.rejections.length > 0)` 안에서만 자유 문자열 warn 이 나갔다.
 * 그래서 (a) authored 모드가 정상 작동 중임을 알리는 신호가 전무했고,
 * (b) 거부율의 **분모**(`accepted`)가 어떤 로그에도 남지 않았고,
 * (c) 거부 12건과 140건의 로그 줄이 형태상 구분되지 않았고,
 * (d) 전 필드 거부로 fallback 하는 경로를 가리키는 로그가 아예 없었다.
 *
 * Cloud Logging 에서 `jsonPayload.accepted` / `jsonPayload.rejected` 로 로그 기반 지표를
 * 만들 수 있어야 비율 알람이 성립한다. 자유 문자열로는 분모를 얻을 수 없다.
 *
 * **고객 문장과 개인정보는 넣지 않는다.** 경로·사유 코드·개수만 싣는다.
 */
function logGeminiDraftReview(args: {
  event: 'gemini_draft_review' | 'gemini_draft_all_rejected' | 'gemini_merged_rejected';
  serviceId: SajuReportData['serviceId'];
  serialNumber: string;
  review: GeminiDraftReview | null;
  reunionCopy: ReunionCopyReview | null;
  dropped?: readonly string[];
  note?: string;
}) {
  const { review, reunionCopy } = args;
  const rejectionSample = (review?.rejections || []).slice(0, 12).map((item) => `${item.path}=${item.code}`);
  const truncated = Math.max((review?.rejected || 0) - rejectionSample.length, 0);

  const payload = {
    event: args.event,
    serviceId: args.serviceId,
    // 상관 키. 주문 식별자는 이 계층에 없으므로 리포트 일련번호를 쓴다(비민감 값).
    reportSerial: args.serialNumber,
    mode: review?.mode ?? null,
    accepted: review?.accepted ?? 0,
    rejected: review?.rejected ?? 0,
    rejectionsByReason: review?.rejectionsByReason ?? {},
    droppedInSanitize: args.dropped?.length ?? 0,
    droppedPaths: (args.dropped || []).slice(0, 12),
    cuts: reunionCopy
      ? {
          accepted: reunionCopy.accepted,
          rejected: reunionCopy.rejected,
          rejectionsByReason: reunionCopy.rejectionsByReason
        }
      : null,
    rejectionSample,
    rejectionSampleTruncated: truncated,
    ...(args.note ? { note: args.note } : {})
  };

  // 전 필드 거부와 병합 후 거부는 진단이 필요한 상태이므로 warn, 정상 경로는 info.
  const write = args.event === 'gemini_draft_review' ? console.info : console.warn;
  write(JSON.stringify(payload));
}

async function requestGeminiDraft(
  baseReport: SajuReportData,
  deterministicBasis: ReturnType<typeof buildDeterministicSajuBasis>,
  options: { reunionContext?: ReunionContext | null } = {}
) {
  const env = getEnv();
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getGeminiRequestTimeoutMs(env));
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      signal: controller.signal,
      body: JSON.stringify(buildGeminiRequestPayload(baseReport, deterministicBasis))
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('Gemini response timed out. Returning deterministic fallback report.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const parsed = (await response.json()) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      thoughtsTokenCount?: number;
      cachedContentTokenCount?: number;
      totalTokenCount?: number;
    };
  };

  if (!response.ok) {
    throw new Error(parsed?.error?.message || 'Gemini 응답 생성에 실패했습니다.');
  }

  const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return null;
  }

  const sanitized = sanitizeGeminiDraftWithAudit(JSON.parse(text), baseReport);
  const draft = sanitized.draft;
  const review = reviewGeminiDraft(draft, deterministicBasis, baseReport, {
    reunionContext: options.reunionContext ?? null
  });

  /*
   * 컷 카피는 리포트 본문 필드 경로를 타지 않으므로 검증도 따로 돈다.
   * 병합은 `generateGeminiSajuReport` 가 lock **이후에** 한다.
   */
  const isLoveReunion = baseReport.serviceId === 'love-reunion';
  const reunionCopy = baseReport.reunion && draft.reunionCopy?.length
    ? reviewReunionCopy(baseReport.reunion, draft.reunionCopy, {
        universe: buildEntityUniverse(deterministicBasis, baseReport),
        serviceId: baseReport.serviceId,
        knownEvidenceIds: collectEvidenceIds(deterministicBasis),
        band: isLoveReunion ? resolveGuardAgeBand(deterministicBasis, baseReport) : null,
        intent: isLoveReunion
          ? toReunionIntentContext(options.reunionContext, deterministicBasis.input.questions)
          : null
      })
    : null;

  logGeminiDraftReview({
    event: 'gemini_draft_review',
    serviceId: baseReport.serviceId,
    serialNumber: baseReport.serialNumber,
    review,
    reunionCopy,
    dropped: sanitized.dropped
  });

  const usage = parsed.usageMetadata;
  return {
    draft: stripGeminiEvidenceMetadata(review.draft),
    review,
    reunionCopy,
    dropped: sanitized.dropped,
    usage: usage ? {
      promptTokenCount: usage.promptTokenCount || 0,
      candidatesTokenCount: usage.candidatesTokenCount || 0,
      thoughtsTokenCount: usage.thoughtsTokenCount || 0,
      cachedContentTokenCount: usage.cachedContentTokenCount || 0,
      totalTokenCount: usage.totalTokenCount || 0
    } : undefined
  };
}

/**
 * draft 의 필드 계열. 경로 접두사와 1:1 로 대응한다.
 *
 * 병합 후 검사가 실패했을 때 되돌릴 최소 단위다. 필드 하나만 되돌리려면 어느 필드가
 * 위반을 만들었는지 알아야 하는데, 병합 후 검사는 리포트 전체 문자열을 보기 때문에
 * 그 해상도가 없다. 계열 단위가 현실적인 최소 단위다.
 */
const DRAFT_FAMILIES = [
  'actionPlan',
  'summary',
  'sections',
  'questionAnswers',
  'keyTakeaways',
  'currentDayun',
  'nextDayun',
  'heroNote'
] as const;
type DraftFamily = (typeof DRAFT_FAMILIES)[number];

function familyOfPath(path: string): DraftFamily | null {
  const head = path.split('.')[0];
  return (DRAFT_FAMILIES as readonly string[]).includes(head) ? (head as DraftFamily) : null;
}

/** 위반 문구가 지목하는 계열. 사다리를 순서대로 내려가는 것보다 먼저 시도한다. */
function familiesImplicatedBy(violations: readonly string[]): DraftFamily[] {
  const implicated = new Set<DraftFamily>();
  violations.forEach((violation) => {
    if (/실행 계획|actionPlan/u.test(violation)) implicated.add('actionPlan');
    if (/요약|summary/u.test(violation)) implicated.add('summary');
    if (/섹션|section/u.test(violation)) implicated.add('sections');
    if (/질문|questionAnswers/u.test(violation)) implicated.add('questionAnswers');
    if (/핵심|keyTakeaways/u.test(violation)) implicated.add('keyTakeaways');
    if (/대운|dayun/u.test(violation)) {
      implicated.add('currentDayun');
      implicated.add('nextDayun');
    }
  });
  return [...implicated];
}

function omitDraftFamilies(draft: GeminiDraft, families: ReadonlySet<DraftFamily>): GeminiDraft {
  const next: GeminiDraft = { ...draft };
  families.forEach((family) => {
    delete (next as Record<string, unknown>)[family];
  });
  return next;
}

interface PostMergeGateInput {
  base: SajuReportData;
  draft: GeminiDraft;
  review: GeminiDraftReview;
  reunionCopy: ReunionCopyReview | null;
  band: ReunionAgeBand | null;
  intent: ReunionIntentContext | null;
}

interface PostMergeGateResult {
  report: SajuReportData;
  accepted: number;
  cutsAccepted: number;
  revertedFamilies: DraftFamily[];
  violations: string[];
}

/**
 * 병합 → lock → 컷 병합 → 검사 4종. 실패하면 계열을 되돌려 다시 시도한다.
 *
 * 검사 4종:
 *   1. `findCustomerReportTextViolations` — 고객 문장 품질
 *   2. `findReportConsistencyViolations` — 병합 결과 정합성 (명세 §4-1 c)
 *   3. `findLoveReunionSafetyViolations` — 재회 하드 가드 (리포트 전체 문자열)
 *   4. `findNewReunionProseSafetyFindings` — **신규 2차 방어**. 3번은 draft 선검사와
 *      같은 표를 쓰기 때문에 순증 방어가 0 이었다. 4번은 의도 가드와 밴드별 금지어를
 *      병합된 고객 문장에 필드 단위로 한 번 더 건다.
 *
 * 되돌려서 통과하지 못하면 `null` → 호출자가 결정론으로 착지한다.
 */
function runPostMergeGate(input: PostMergeGateInput): PostMergeGateResult | null {
  const { base, draft, review, reunionCopy } = input;
  const reverted = new Set<DraftFamily>();
  const seenViolations: string[] = [];

  for (let attempt = 0; attempt <= DRAFT_FAMILIES.length; attempt += 1) {
    const candidateDraft = omitDraftFamilies(draft, reverted);
    let report: SajuReportData;

    try {
      const merged = mergeGeminiDraft(base, candidateDraft);
      const guarded = lockCommercialReportFacts(base, merged);
      /*
       * 컷 카피 병합은 lock **이후**다. lock 이 `reunion` 을 base 값으로 통째 복원하므로
       * 그 전에 병합하면 채택한 컷 대사가 전부 사라진다.
       */
      const withCuts = reunionCopy && reunionCopy.accepted > 0
        ? { ...guarded, reunion: reunionCopy.payload }
        : guarded;
      report = finalizeCustomerReport(withCuts);
    } catch (mergeError) {
      // 병합 자체가 던지는 것은 계열 되돌리기로 회복되지 않는다. 즉시 결정론.
      console.error('Gemini merged report rejected:', mergeError);
      return null;
    }

    const violations = [
      ...findCustomerReportTextViolations(report),
      ...findReportConsistencyViolations(report),
      ...findLoveReunionSafetyViolations(report),
      ...findNewReunionProseSafetyFindings(base, report, {
        band: input.band,
        intent: input.intent
      }).map((finding) => `${finding.path}: ${finding.labels.join('/')}`)
    ];

    if (violations.length === 0) {
      const revertedList = [...reverted];
      return {
        report,
        accepted: review.acceptedPaths.filter((path) => {
          const family = familyOfPath(path);
          return !family || !reverted.has(family);
        }).length,
        cutsAccepted: reunionCopy?.accepted || 0,
        revertedFamilies: revertedList,
        violations: [...new Set(seenViolations)]
      };
    }

    seenViolations.push(...violations);

    const next =
      familiesImplicatedBy(violations).find((family) => !reverted.has(family)) ??
      DRAFT_FAMILIES.find((family) => !reverted.has(family));
    if (!next) return null;
    reverted.add(next);
  }

  return null;
}

/** 관측 카운터. 성공 경로와 결정론 착지 경로가 **같은 모양**을 내보내야 비교가 성립한다. */
function buildAiFieldsMeta(
  review: GeminiDraftReview,
  reunionCopy: ReunionCopyReview | null,
  extra: { accepted: number; dropped?: readonly string[]; revertedFamilies?: readonly string[] }
): NonNullable<NonNullable<SajuReportData['engineMeta']>['aiFields']> {
  const revertedCount = review.accepted - extra.accepted;
  return {
    mode: review.mode,
    accepted: extra.accepted,
    rejected: review.rejected + Math.max(revertedCount, 0),
    rejectionsByReason: {
      ...review.rejectionsByReason,
      ...(revertedCount > 0 ? { 'post-merge-revert': revertedCount } : {}),
      ...(extra.dropped?.length ? { 'length-discard': extra.dropped.length } : {})
    },
    ...(extra.revertedFamilies?.length ? { revertedFamilies: [...extra.revertedFamilies] } : {}),
    ...(reunionCopy
      ? {
          cuts: {
            accepted: reunionCopy.accepted,
            rejected: reunionCopy.rejected,
            rejectionsByReason: reunionCopy.rejectionsByReason
          }
        }
      : {})
  };
}

export async function generateGeminiSajuReport(body: ReportRequestBody): Promise<ReportResponsePayload> {
  const {
    serviceId,
    formData,
    deterministicBasis
  } = await prepareCommercialReportRequest(body);
  if (deterministicBasis.commercialV2.releaseAudit.decision === 'blocked') {
    throw new ReportRequestError(
      422,
      `상용 리포트 생성이 중단되었습니다. ${deterministicBasis.commercialV2.releaseAudit.blockers.join(' ')}`
    );
  }
  const builtReport = buildSajuReport(serviceId, formData, deterministicBasis);
  const fallbackReport =
    serviceId === 'past-life-goblin'
      ? { ...builtReport, pastLifeProfile: buildPastLifeProfile(builtReport, formData) }
      : builtReport;

  /*
   * 결정론 착지.
   *
   * `aiFields` 를 **여기에도 싣는다.** 이전에는 주입이 성공 경로의 try 블록 안에만
   * 있어서, 가장 진단이 필요한 케이스(전 필드 거부)에서 관측 메타가 전부 사라졌다.
   * 고객은 리포트를 받는데 왜 전량 거부됐는지 서버에 아무 기록이 없었다.
   *
   * `provider` 는 계약이라 손대지 않는다 — `cloudrun-api` 의
   * `reportService.generatePaid()` 가 `deterministic-fallback` 을 503 으로 처리하는
   * 동작은 그대로다(세 번째 값 `deterministic-verified` 도입은 별도 계약 변경).
   */
  const deterministicResponse = (
    failedReview: GeminiDraftReview | null = null,
    failedCuts: ReunionCopyReview | null = null
  ): ReportResponsePayload => ({
    provider: 'deterministic-fallback',
    reportMode: PREMIUM_SAJU_REPORT_MODE,
    promptVersion: PREMIUM_SAJU_PROMPT_VERSION,
    report:
      failedReview && fallbackReport.engineMeta
        ? {
            ...fallbackReport,
            engineMeta: {
              ...fallbackReport.engineMeta,
              aiFields: buildAiFieldsMeta(failedReview, failedCuts, { accepted: 0 })
            }
          }
        : fallbackReport,
    debug: undefined
  });

  const reunionContext = formData.reunionContext ?? body.payload?.reunionContext ?? null;
  const guardBand = serviceId === 'love-reunion' ? resolveGuardAgeBand(deterministicBasis, fallbackReport) : null;
  const intentContext = serviceId === 'love-reunion'
    ? toReunionIntentContext(reunionContext, deterministicBasis.input.questions)
    : null;

  let draft: GeminiDraft | null = null;
  let usage: GeminiUsage | undefined;
  let review: GeminiDraftReview | null = null;
  let reunionCopy: ReunionCopyReview | null = null;
  let dropped: readonly string[] = [];

  try {
    const result = await requestGeminiDraft(fallbackReport, deterministicBasis, { reunionContext });
    if (result) {
      draft = result.draft;
      usage = result.usage;
      review = result.review;
      reunionCopy = result.reunionCopy;
      dropped = result.dropped;
    }
  } catch (geminiError) {
    console.error('Gemini report draft failed:', geminiError);
  }

  /*
   * 채택된 필드가 하나도 없으면 병합해도 결정론 리포트와 같다. provider 를 속이지 않는다.
   *
   * 여기서 **반드시 로그를 남긴다.** 이전에는 이 조기 반환이 완전히 무음이었고
   * `deterministicResponse()` 에 `aiFields` 도 없었다. 그 결과 (a) API 키 없음
   * (b) 호출 실패 (c) 병합 후 검사 실패 (d) 전 필드 거부 네 가지가 ledger 에
   * 똑같은 `ReportRequestError:503` 문자열로 남아 구분이 불가능했다.
   */
  if (!draft || !review || review.accepted + (reunionCopy?.accepted || 0) === 0) {
    if (review) {
      logGeminiDraftReview({
        event: 'gemini_draft_all_rejected',
        serviceId,
        serialNumber: fallbackReport.serialNumber,
        review,
        reunionCopy,
        dropped,
        note: 'every field rejected; shipping the deterministic report'
      });
    }
    return deterministicResponse(review, reunionCopy);
  }

  /*
   * 병합 후 검사는 **회복 가능해야 한다** (검증자 지적 major 18).
   *
   * 이전에는 세 검사(+신규 2차 방어)를 하나의 try 안에서 돌리고 한 건이라도 걸리면
   * `deterministicResponse()` 를 돌려줬다 — 채택된 157개 필드가 **전부** 버려지고
   * ledger 가 failed 로 남고 `reportJson` 캐시도 안 남았다. per-field fallback 으로
   * 없앴다고 보고한 all-or-nothing 이 한 계층 위에 그대로 남아 있었던 것이다.
   *
   * 구체적 방아쇠: `findReportConsistencyViolations`(`reportConsistency.ts:51-55`)는
   * `actionPlan.priorities` 에 같은 문장이 두 번 있으면 위반을 낸다. authored 모드는
   * 그 배열을 모델에게 열어 준다. 즉 **중복 한 줄이 리포트 전체를 버렸다.**
   *
   * 그래서 위반이 지목하는 필드 계열만 base 로 되돌리고 다시 검사한다.
   * 사다리를 다 내려가도 통과하지 못하면 그때 결정론으로 착지한다.
   */
  const gate = runPostMergeGate({
    base: fallbackReport,
    draft,
    review,
    reunionCopy,
    band: guardBand,
    intent: intentContext
  });

  if (!gate) {
    logGeminiDraftReview({
      event: 'gemini_merged_rejected',
      serviceId,
      serialNumber: fallbackReport.serialNumber,
      review,
      reunionCopy,
      dropped,
      note: 'post-merge gate could not be satisfied by reverting field families'
    });
    return deterministicResponse(review, reunionCopy);
  }

  if (gate.revertedFamilies.length > 0) {
    logGeminiDraftReview({
      event: 'gemini_merged_rejected',
      serviceId,
      serialNumber: fallbackReport.serialNumber,
      review,
      reunionCopy,
      dropped,
      note: `reverted to base: ${gate.revertedFamilies.join(', ')}; violations: ${gate.violations.join(' | ')}`
    });
  }

  // 되돌린 뒤 채택이 0 이 되었으면 결정론 리포트와 같다. provider 를 속이지 않는다.
  if (gate.accepted + (gate.cutsAccepted || 0) === 0) {
    return deterministicResponse(review, reunionCopy);
  }

  /*
   * 관측 메타는 lock **이후에** 붙인다.
   * `reportFactGuard.ts:230` 이 `{...base.engineMeta}` 로 통째 복원하므로 lock 이전에
   * 붙이면 그대로 사라진다. `aiUsage` 가 이미 같은 위치를 쓰고 있고, 이 순서를 지키면
   * 가드 화이트리스트를 손댈 필요가 없다.
   */
  const reportWithMeta = gate.report.engineMeta
    ? {
        ...gate.report,
        engineMeta: {
          ...gate.report.engineMeta,
          ...(usage
            ? {
                aiUsage: {
                  provider: 'gemini' as const,
                  model: getEnv().GEMINI_MODEL || 'gemini-2.5-flash',
                  ...usage
                }
              }
            : {}),
          aiFields: buildAiFieldsMeta(review, reunionCopy, {
            accepted: gate.accepted,
            dropped,
            revertedFamilies: gate.revertedFamilies
          })
        }
      }
    : gate.report;

  return {
    provider: 'gemini',
    reportMode: PREMIUM_SAJU_REPORT_MODE,
    promptVersion: PREMIUM_SAJU_PROMPT_VERSION,
    report: reportWithMeta,
    usage,
    debug: undefined
  };
}
