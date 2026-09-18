/**
 * 재회운 컷 카피 — 컷 단위 검증과 per-cut fallback (명세 §4-4, §4-5).
 *
 * 여기서 모사하는 것은 **모델 응답**이다. 로컬에는 `GEMINI_API_KEY` 가 없어
 * `requestGeminiDraft` 가 즉시 `null` 을 돌려주므로(제미나이가 아예 호출되지 않는다),
 * 컷 카피 경로는 이 픽스처로만 검증된다. 실제 모델 응답으로는 아직 돌지 않았다.
 */

import { describe, expect, it } from 'vitest';
import { buildReunionReportPayload } from '../reunion/chapters';
import { REUNION_TERM_GLOSSARY } from '../reunion/glossary';
import { REUNION_CONTEXT_VERSION, type ReunionContext } from '../reunion/types';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport } from '../saju/reportBuilder';
import { buildEntityUniverse, findUnknownEntities } from './geminiProseGuard';
import { sanitizeGeminiDraft } from './geminiReportService';
import {
  buildReunionCopySchema,
  isLockedReunionCut,
  reviewReunionCopy,
  writableReunionCuts,
  type ReunionCopyDraftCut
} from './geminiReunionCopy';

const reunionFormData = {
  name: '재회 검증자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  relationshipStatus: 'breakup-reunion' as const,
  partner: {
    name: '상대 검증자',
    gender: 'male' as const,
    calendar: 'solar' as const,
    isLeapMonth: false,
    birthDate: '1991-05-14',
    birthTime: '08:30',
    isUnknownTime: false
  },
  q1: '다시 연락해도 될까요?',
  q2: '답이 없으면 언제 멈춰야 하나요?'
};

const reunionContext: ReunionContext = {
  schemaVersion: REUNION_CONTEXT_VERSION,
  breakupDuration: 'threeTo6m',
  contactStatus: 'occasional',
  lastContactAt: '2026-08-20',
  breakupReason: '대화 방식이 달라 여러 번 부딪혔어요.',
  desiredOutcome: 'clarity',
  notes: '돌려받을 물건이 하나 있어요.',
  consentToUsePartnerData: true
};

const CLAIM_ID = 'MRE-V2-MONTH-COMMAND-001';

function buildFixture() {
  const basis = buildDeterministicSajuBasis('love-reunion', reunionFormData);
  const report = buildSajuReport('love-reunion', reunionFormData, basis);
  const payload = buildReunionReportPayload({ report, context: reunionContext });
  const allCuts = payload.chapters.flatMap((chapter) => chapter.cuts);
  const universe = buildEntityUniverse(basis, { ...report, reunion: payload });

  return {
    basis,
    report,
    payload,
    allCuts,
    cut: (id: string) => {
      const found = allCuts.find((candidate) => candidate.id === id);
      expect(found, `컷 ${id} 를 찾지 못했습니다.`).toBeTruthy();
      return found!;
    },
    context: {
      universe,
      serviceId: 'love-reunion' as const,
      knownEvidenceIds: new Set([CLAIM_ID])
    }
  };
}

function review(fixture: ReturnType<typeof buildFixture>, drafts: ReunionCopyDraftCut[]) {
  return reviewReunionCopy(fixture.payload, drafts, fixture.context);
}

function cutById(payload: ReturnType<typeof buildFixture>['payload'], id: string) {
  return payload.chapters.flatMap((chapter) => chapter.cuts).find((cut) => cut.id === id)!;
}

/** 이 명식에 실재하지 않는 연도를 실행 시점에 찾는다(상수로 박으면 사주에 따라 깨진다). */
function findAbsentYear(fixture: ReturnType<typeof buildFixture>) {
  for (let year = 2099; year >= 2040; year -= 1) {
    if (findUnknownEntities(`${year}년`, fixture.context.universe).length > 0) return year;
  }
  throw new Error('테스트용 미존재 연도를 찾지 못했습니다.');
}

describe('컷 카피 채택', () => {
  it('모델이 직접 쓴 말풍선 두 개를 채택한다', () => {
    const fixture = buildFixture();
    const base = fixture.cut('c00-2');
    expect(base.bubbles).toHaveLength(2);

    const result = review(fixture, [{
      cutId: 'c00-2',
      bubbles: [
        { position: 'top-left', tone: 'warm', text: '이상한 거\n아니에요.' },
        { position: 'bottom-right', tone: 'calm', text: '여기선\n아무도 안 봐요.' }
      ],
      claimRefs: [CLAIM_ID]
    }]);

    expect(result.rejections).toEqual([]);
    expect(result.accepted).toBe(1);

    const merged = cutById(result.payload, 'c00-2');
    expect(merged.bubbles[0].text).toBe('이상한 거\n아니에요.');
    expect(merged.bubbles[0].position).toBe('top-left');
    /* 연출 결정(`kind`)은 스키마에 없다. base 값이 유지되어야 한다. */
    expect(merged.bubbles[0].kind).toBe(base.bubbles[0].kind);
    /* 판정·레이아웃·마스킹은 결정론이 독점한다. */
    expect(merged.layout).toBe(base.layout);
    expect(merged.mask).toBe(base.mask);
    expect(merged.sceneKey).toBe(base.sceneKey);
  });

  it('말풍선 하나만 돌려주면 남은 인덱스는 base 말풍선을 유지한다', () => {
    const fixture = buildFixture();
    const base = fixture.cut('c00-2');

    const result = review(fixture, [{
      cutId: 'c00-2',
      bubbles: [{ position: 'top-left', tone: 'warm', text: '늦은 밤이죠.' }],
      claimRefs: [CLAIM_ID]
    }]);

    const merged = cutById(result.payload, 'c00-2');
    expect(result.accepted).toBe(1);
    expect(merged.bubbles).toHaveLength(base.bubbles.length);
    expect(merged.bubbles[1].text).toBe(base.bubbles[1].text);
  });

  it('나레이션과 캡션도 자리별로 채택한다', () => {
    const fixture = buildFixture();
    const narrationCut = fixture.allCuts.find((cut) => cut.narration && !isLockedReunionCut(cut))!;
    const captionCut = fixture.allCuts.find((cut) => cut.caption && !isLockedReunionCut(cut))!;

    const result = review(fixture, [
      { cutId: narrationCut.id, narration: '늦은 밤에\n또 찾아보셨죠.', claimRefs: [CLAIM_ID] },
      { cutId: captionCut.id, caption: '여기까지가 확인된 것이에요.', claimRefs: [CLAIM_ID] }
    ]);

    expect(result.rejections).toEqual([]);
    expect(result.accepted).toBe(2);
    expect(cutById(result.payload, narrationCut.id).narration).toBe('늦은 밤에\n또 찾아보셨죠.');
    expect(cutById(result.payload, captionCut.id).caption).toBe('여기까지가 확인된 것이에요.');
  });

  it('근거 배지는 모델이 용어만 고르고 번역은 사전 값을 쓴다', () => {
    const fixture = buildFixture();
    const result = review(fixture, [{
      cutId: 'c00-2',
      bubbles: [{ position: 'top-left', tone: 'calm', text: '이상한 거\n아니에요.' }],
      evidenceBadge: '[상관] 모델이 멋대로 쓴 번역',
      claimRefs: [CLAIM_ID]
    }]);

    const merged = cutById(result.payload, 'c00-2');
    expect(result.accepted).toBe(1);
    expect(merged.evidenceBadges).toEqual([{
      term: '상관',
      translation: REUNION_TERM_GLOSSARY['상관'],
      claimRefs: [CLAIM_ID]
    }]);
  });
});

describe('컷 카피 거부', () => {
  it('근거 인용이 없거나 존재하지 않으면 컷을 거부한다', () => {
    const fixture = buildFixture();
    const result = review(fixture, [
      { cutId: 'c00-2', bubbles: [{ text: '괜찮아요.' }] },
      { cutId: 'c01-5', bubbles: [{ text: '괜찮아요.' }], claimRefs: ['없는-근거-아이디'] }
    ]);

    expect(result.accepted).toBe(0);
    expect(result.rejectionsByReason).toEqual({
      'missing-citation': 1,
      'unknown-evidence-id': 1
    });
  });

  it('말풍선 규격(26자·4줄·줄당 11자)을 넘기면 자르지 않고 거부한다', () => {
    const fixture = buildFixture();
    const base = fixture.cut('c00-2');
    const result = review(fixture, [{
      cutId: 'c00-2',
      bubbles: [{ text: '지금 이 순간에 느끼는 마음을 전부 문장으로 옮겨 적어 보면 훨씬 나아질 거예요.' }],
      claimRefs: [CLAIM_ID]
    }]);

    expect(result.rejectionsByReason).toEqual({ 'copy-spec-violation': 1 });
    expect(cutById(result.payload, 'c00-2').bubbles[0].text).toBe(base.bubbles[0].text);
  });

  it('줄바꿈 없이 한 줄 한도를 넘긴 말풍선도 거부한다', () => {
    const fixture = buildFixture();
    const result = review(fixture, [{
      cutId: 'c00-2',
      bubbles: [{ text: '여기서는 아무도 보지 않아요' }],
      claimRefs: [CLAIM_ID]
    }]);

    expect(result.rejectionsByReason).toEqual({ 'copy-spec-violation': 1 });
  });

  it('컷 대사에 명리 용어를 섞으면 거부한다 (2층 분리 강제)', () => {
    const fixture = buildFixture();
    const result = review(fixture, [{
      cutId: 'c00-2',
      bubbles: [{ text: '상관이\n강한 자리예요.' }],
      claimRefs: [CLAIM_ID]
    }]);

    expect(result.rejectionsByReason).toEqual({ 'copy-spec-violation': 1 });
    expect(result.rejections[0].message).toContain('명리 용어');
  });

  it('base 컷보다 많은 말풍선을 만들 수 없다', () => {
    const fixture = buildFixture();
    const single = fixture.cut('c01-5');
    expect(single.bubbles).toHaveLength(1);

    const result = review(fixture, [{
      cutId: 'c01-5',
      bubbles: [{ text: '첫 줄이에요.' }, { text: '둘째 줄이에요.' }],
      claimRefs: [CLAIM_ID]
    }]);

    expect(result.rejectionsByReason).toEqual({ 'copy-spec-violation': 1 });
  });

  it('말풍선이 없는 컷에 말풍선을 끼워 넣을 수 없다', () => {
    const fixture = buildFixture();
    const noBubbleCut = fixture.allCuts.find(
      (cut) => cut.bubbles.length === 0 && !isLockedReunionCut(cut) && (cut.caption || cut.narration)
    )!;

    const result = review(fixture, [{
      cutId: noBubbleCut.id,
      bubbles: [{ text: '새 말풍선이에요.' }],
      claimRefs: [CLAIM_ID]
    }]);

    expect(result.rejectionsByReason).toEqual({ 'no-base-anchor': 1 });
  });

  it('base 에 없는 컷 id 는 항목째로 버린다', () => {
    const fixture = buildFixture();
    const result = review(fixture, [
      { cutId: 'c99-9', bubbles: [{ text: '없는 컷이에요.' }], claimRefs: [CLAIM_ID] },
      { bubbles: [{ text: 'id 가 없어요.' }], claimRefs: [CLAIM_ID] }
    ]);

    expect(result.accepted).toBe(0);
    expect(result.rejectionsByReason).toEqual({ 'unknown-cut-id': 2 });
  });

  it('영구 잠금 컷(삭제 불가 문구·beat)에는 한 글자도 쓸 수 없다', () => {
    const fixture = buildFixture();
    const undeletableCut = fixture.allCuts.find((cut) => cut.undeletableCopyId)!;
    const beatCut = fixture.allCuts.find((cut) => cut.layout === 'beat')!;

    const result = review(fixture, [
      { cutId: undeletableCut.id, caption: '조건 개수를 세어 볼게요.', claimRefs: [CLAIM_ID] },
      { cutId: beatCut.id, narration: '침묵을 설명해 드릴게요.', claimRefs: [CLAIM_ID] }
    ]);

    expect(result.accepted).toBe(0);
    expect(result.rejectionsByReason).toEqual({ 'locked-cut': 2 });
    expect(result.payload).toBe(fixture.payload);
  });

  it('같은 컷을 두 번 돌려주면 두 번째를 거부한다', () => {
    const fixture = buildFixture();
    const result = review(fixture, [
      { cutId: 'c00-2', bubbles: [{ text: '첫 응답이에요.' }], claimRefs: [CLAIM_ID] },
      { cutId: 'c00-2', bubbles: [{ text: '둘째 응답이에요.' }], claimRefs: [CLAIM_ID] }
    ]);

    expect(result.accepted).toBe(1);
    expect(result.rejectionsByReason).toEqual({ 'locked-cut': 1 });
    expect(cutById(result.payload, 'c00-2').bubbles[0].text).toBe('첫 응답이에요.');
  });

  it('금지 표현(상대 속마음 단정·감시 유도)이 있으면 거부한다', () => {
    const fixture = buildFixture();
    const captionCut = fixture.allCuts.find((cut) => cut.caption && !isLockedReunionCut(cut))!;

    const mind = review(fixture, [{
      cutId: captionCut.id,
      caption: '그 사람은 아직 미련이 남아 있어요.',
      claimRefs: [CLAIM_ID]
    }]);
    const watch = review(fixture, [{
      cutId: captionCut.id,
      caption: 'SNS 스토리를 확인해 보세요.',
      claimRefs: [CLAIM_ID]
    }]);

    expect(mind.rejectionsByReason).toEqual({ 'banned-phrase': 1 });
    expect(watch.rejectionsByReason).toEqual({ 'banned-phrase': 1 });
  });

  it('결정론 계산에 없는 값(없는 연도)을 주장하면 거부한다', () => {
    const fixture = buildFixture();
    const captionCut = fixture.allCuts.find((cut) => cut.caption && !isLockedReunionCut(cut))!;
    const result = review(fixture, [{
      cutId: captionCut.id,
      caption: `${findAbsentYear(fixture)}년에 흐름이 바뀌어요.`,
      claimRefs: [CLAIM_ID]
    }]);

    expect(result.rejectionsByReason).toEqual({ 'unknown-entity': 1 });
  });

  it('캡션 60자 상한을 넘기면 거부한다', () => {
    const fixture = buildFixture();
    const captionCut = fixture.allCuts.find((cut) => cut.caption && !isLockedReunionCut(cut))!;
    const result = review(fixture, [{
      cutId: captionCut.id,
      caption: '여기까지 확인된 것을 하나씩 세어 보면서 다음에 무엇을 확인해야 하는지 차례대로 정리해 드릴게요. 오늘은 여기까지만 보셔도 충분해요.',
      claimRefs: [CLAIM_ID]
    }]);

    expect(result.rejectionsByReason).toEqual({ 'copy-spec-violation': 1 });
  });

  it('사전에 없는 용어로 근거 배지를 만들 수 없다', () => {
    const fixture = buildFixture();
    const result = review(fixture, [{
      cutId: 'c00-2',
      bubbles: [{ text: '이상한 거\n아니에요.' }],
      evidenceBadge: '[도화살] 끌리는 힘',
      claimRefs: [CLAIM_ID]
    }]);

    expect(result.rejectionsByReason).toEqual({ 'unknown-glossary-term': 1 });
  });
});

describe('per-cut fallback', () => {
  it('한 컷이 거부돼도 다른 컷은 살아남는다', () => {
    const fixture = buildFixture();
    const base = fixture.cut('c01-5');

    const result = review(fixture, [
      {
        cutId: 'c00-2',
        bubbles: [{ text: '이상한 거\n아니에요.' }, { text: '여기선\n아무도 안 봐요.' }],
        claimRefs: [CLAIM_ID]
      },
      { cutId: 'c01-5', bubbles: [{ text: '그 사람은 아직 미련이 남아 있어요.' }], claimRefs: [CLAIM_ID] }
    ]);

    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(1);
    expect(cutById(result.payload, 'c00-2').bubbles[0].text).toBe('이상한 거\n아니에요.');
    expect(cutById(result.payload, 'c01-5').bubbles[0].text).toBe(base.bubbles[0].text);
  });

  it('전 컷이 거부되면 payload 를 새로 만들지 않는다', () => {
    const fixture = buildFixture();
    const result = review(fixture, [{ cutId: 'c00-2', bubbles: [{ text: '근거가 없어요.' }] }]);

    expect(result.accepted).toBe(0);
    expect(result.payload).toBe(fixture.payload);
  });

  it('거부 사유 키를 ASCII 로만 쓴다 (관측 메타가 안전 가드를 트립시키면 안 된다)', () => {
    const fixture = buildFixture();
    const result = review(fixture, [
      { cutId: 'c99-9', claimRefs: [CLAIM_ID] },
      { cutId: 'c00-2', bubbles: [{ text: '이상한 거 아니에요.' }] }
    ]);

    expect(Object.keys(result.rejectionsByReason).length).toBeGreaterThan(0);
    Object.keys(result.rejectionsByReason).forEach((code) => expect(code).toMatch(/^[a-z-]+$/));
  });
});

describe('sanitize 단계', () => {
  it('컷 페이로드가 없는 리포트에서는 reunionCopy 를 통째로 버린다', () => {
    const fixture = buildFixture();
    const draft = sanitizeGeminiDraft({
      reunionCopy: [{ cutId: 'c00-2', bubbles: [{ text: '새 문장이에요.' }], claimRefs: [CLAIM_ID] }]
    }, fixture.report);

    expect(draft.reunionCopy).toBeUndefined();
  });

  it('base 컷 id 집합에 없는 항목만 골라 버린다', () => {
    const fixture = buildFixture();
    const baseWithCuts = { ...fixture.report, reunion: fixture.payload };
    const draft = sanitizeGeminiDraft({
      reunionCopy: [
        { cutId: 'c00-2', bubbles: [{ text: '새 문장이에요.' }], claimRefs: [CLAIM_ID] },
        { cutId: 'c99-9', bubbles: [{ text: '없는 컷이에요.' }], claimRefs: [CLAIM_ID] },
        { bubbles: [{ text: 'id 가 없어요.' }], claimRefs: [CLAIM_ID] }
      ]
    }, baseWithCuts);

    expect(draft.reunionCopy).toHaveLength(1);
    expect(draft.reunionCopy?.[0].cutId).toBe('c00-2');
    expect(draft.reunionCopy?.[0].claimRefs).toEqual([CLAIM_ID]);
  });
});

describe('스키마', () => {
  it('쓸 수 있는 컷이 하나도 없으면 스키마를 만들지 않는다', () => {
    const fixture = buildFixture();
    const emptyPayload = {
      ...fixture.payload,
      chapters: fixture.payload.chapters.map((chapter) => ({ ...chapter, cuts: [] }))
    };

    expect(buildReunionCopySchema(emptyPayload)).toBeNull();
    expect(writableReunionCuts(fixture.payload).length).toBeGreaterThan(10);
  });
});
