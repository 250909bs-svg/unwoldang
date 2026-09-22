/**
 * 잠금 해제 전후 필드 매트릭스.
 *
 * **모사 테스트다.** 로컬에 `GEMINI_API_KEY` 가 없어 `requestGeminiDraft` 가 즉시 `null` 을
 * 돌려주므로 제미나이는 호출되지 않는다. 여기서는 "모델이 전 필드를 새 문장으로 채워
 * 돌려줬다" 는 응답을 픽스처로 만들어, **어느 필드가 모델 문장을 채택하고 어느 필드가
 * base 로 되돌아가는지**를 값 단위로 고정한다.
 *
 * 같은 픽스처를 종합사주(`strict-echo`)에도 먹여 상품 분기가 살아 있는지 확인한다.
 */

import { describe, expect, it } from 'vitest';
import { buildDeterministicSajuBasis, type DeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport } from '../saju/reportBuilder';
import type { SajuReportData } from '../saju/report';
import {
  reviewGeminiDraft,
  sanitizeGeminiDraft,
  sanitizeGeminiDraftWithAudit
} from './geminiReportService';

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

const generalFormData = {
  name: '검증자',
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  q1: '올해 일의 방향은 무엇인가요?',
  q2: ''
};

/** 시기 근거만 인용해야 하는 섹션(`TEMPORAL_SECTION_IDS` 와 같은 집합). */
const TEMPORAL_SECTIONS = new Set(['fortune', 'year', 'ten', 'detail12', 'detailRel', 'detailSal', 'month']);

/**
 * 결정론 문장과 **다르고**, 실재하지 않는 값을 하나도 담지 않은 새 문장 풀.
 *
 * 숫자·간지·십성·연도를 일부러 전혀 쓰지 않는다. 엔티티 화이트리스트가 막는 것은
 * '없는 값' 이고, 여기서 확인하려는 것은 '값을 안 쓴 평범한 새 문장은 통과한다' 는 쪽이다.
 */
const NEW_SENTENCES = [
  '여기까지 확인된 것만 먼저 정리해 드릴게요.',
  '지금 상태에서 바꿀 수 있는 건 하나예요.',
  '오늘은 이 한 가지만 보고 덮으셔도 돼요.',
  '다음 대화를 여는 조건부터 세어 볼게요.',
  '확인은 제가 아니라 직접 하시게 될 거예요.',
  '이 부분은 아직 확인되지 않은 자리로 남겨 둘게요.'
];

let sentenceCursor = 0;
function nextSentence() {
  const sentence = NEW_SENTENCES[sentenceCursor % NEW_SENTENCES.length];
  sentenceCursor += 1;
  return sentence;
}

function buildFixture(serviceId: 'love-reunion' | 'general-signature') {
  sentenceCursor = 0;
  const formData = serviceId === 'love-reunion' ? reunionFormData : generalFormData;
  const basis = buildDeterministicSajuBasis(serviceId, formData);
  const report = buildSajuReport(serviceId, formData, basis);

  const interpretationId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
  const temporalId =
    basis.commercialV2.temporal?.findings[0]?.id ||
    basis.commercialV2.temporal?.relations[0]?.id ||
    basis.commercialV2.temporal?.tenGodActivations[0]?.id;
  expect(interpretationId).toBeTruthy();
  expect(temporalId).toBeTruthy();

  return {
    basis,
    report,
    natal: (text: string) => `${text} [근거:${interpretationId}]`,
    temporal: (text: string) => `${text} [근거:${temporalId}]`
  };
}

/** 모델이 전 필드를 새 문장으로 채워 돌려준 응답을 만든다. */
function buildAuthoredDraft(fixture: ReturnType<typeof buildFixture>) {
  const { report, natal, temporal } = fixture;

  return {
    /*
     * heroNote 는 재회운에서 영구 잠금이라 **모델 응답에 넣지 않는다.**
     * 고쳐 쓰면 그 필드만 base 로 되돌아가고, echo 하면 다른 상품(strict-echo)에서는
     * 채택으로 세어져 "새 문장은 한 필드도 채택되지 않는다" 는 이 파일의 대칭 검증이
     * 흐려진다. 잠금 자체는 geminiDraftReview.test.ts 가 따로 잠근다.
     */
    summary: {
      title: natal(nextSentence()),
      analysis: report.summary.analysis.map(() => natal(nextSentence())),
      advice: report.summary.advice.map(() => natal(nextSentence()))
    },
    keyTakeaways: report.keyTakeaways.map((card) => ({
      title: card.title,
      body: natal(nextSentence())
    })),
    questionAnswers: report.questionAnswers.map((answer) => ({
      question: answer.question,
      title: natal(nextSentence()),
      analysis: natal(nextSentence()),
      advice: answer.advice.map(() => natal(nextSentence()))
    })),
    sections: report.sections
      .filter((section) => !section.id.endsWith('-v2'))
      .map((section) => {
        const cite = TEMPORAL_SECTIONS.has(section.id) ? temporal : natal;
        return {
          id: section.id,
          paragraphs: (section.paragraphs || []).map(() => cite(nextSentence())),
          bullets: (section.bullets || []).map(() => cite(nextSentence())),
          callout: section.callout ? { body: cite(nextSentence()) } : undefined,
          cards: (section.cards || []).map((card) => ({ title: card.title, body: cite(nextSentence()) })),
          details: (section.details || []).map((detail) => ({
            summary: detail.summary,
            content: cite(nextSentence())
          }))
        };
      }),
    currentDayun: { summary: temporal(nextSentence()), focus: temporal(nextSentence()) },
    nextDayun: { summary: temporal(nextSentence()), focus: temporal(nextSentence()) },
    actionPlan: {
      title: natal(nextSentence()),
      priorities: report.actionPlan.priorities.map(() => natal(nextSentence())),
      dos: report.actionPlan.dos.map(() => natal(nextSentence())),
      avoids: report.actionPlan.avoids.map(() => natal(nextSentence())),
      luckyDays: report.actionPlan.luckyDays.map((day) => ({ day: day.day, reason: temporal(nextSentence()) })),
      unluckyDays: report.actionPlan.unluckyDays.map((day) => ({ day: day.day, reason: temporal(nextSentence()) }))
    }
  };
}

function runReview(serviceId: 'love-reunion' | 'general-signature') {
  const fixture = buildFixture(serviceId);
  const draft = sanitizeGeminiDraft(buildAuthoredDraft(fixture), fixture.report);
  return { fixture, review: reviewGeminiDraft(draft, fixture.basis, fixture.report) };
}

/** 검증을 거친 draft 에서 base 와 달라진 최상위 필드 이름을 모은다. */
function changedTopLevelFields(draft: ReturnType<typeof reviewGeminiDraft>['draft'], base: SajuReportData) {
  const changed: string[] = [];
  if (draft.heroNote && draft.heroNote !== base.heroNote) changed.push('heroNote');
  if (draft.summary?.title && draft.summary.title !== base.summary.title) changed.push('summary.title');
  if (draft.summary?.analysis?.some((value, index) => value !== base.summary.analysis[index])) {
    changed.push('summary.analysis');
  }
  if (draft.summary?.advice?.some((value, index) => value !== base.summary.advice[index])) {
    changed.push('summary.advice');
  }
  if (draft.keyTakeaways?.some((card) => card.body)) changed.push('keyTakeaways.body');
  if (draft.questionAnswers?.some((answer) => answer.analysis)) changed.push('questionAnswers.analysis');
  if (draft.questionAnswers?.some((answer) => answer.advice?.length)) changed.push('questionAnswers.advice');
  if (draft.sections?.some((section) => section.paragraphs?.length)) changed.push('sections.paragraphs');
  if (draft.sections?.some((section) => section.bullets?.length)) changed.push('sections.bullets');
  if (draft.sections?.some((section) => section.cards?.length)) changed.push('sections.cards.body');
  if (draft.sections?.some((section) => section.details?.length)) changed.push('sections.details.content');
  if (draft.currentDayun?.summary) changed.push('currentDayun.summary');
  if (draft.nextDayun?.summary) changed.push('nextDayun.summary');
  if (draft.actionPlan?.title) changed.push('actionPlan.title');
  if (draft.actionPlan?.priorities?.length) changed.push('actionPlan.priorities');
  if (draft.actionPlan?.luckyDays?.length) changed.push('actionPlan.luckyDays.reason');
  return changed;
}

describe('재회운 — 모델 문장을 채택하는 필드', () => {
  it('근거를 붙인 새 문장은 리포트 본문 전 계층에서 채택된다', () => {
    const { fixture, review } = runReview('love-reunion');

    expect(review.mode).toBe('authored');
    /* 실측 157필드 채택 / 0거부. 리포트 문안이 늘거나 줄 수 있으므로 하한으로 잠근다. */
    expect(review.rejections).toEqual([]);
    expect(review.accepted).toBeGreaterThan(120);
    /*
     * `heroNote` 는 이 목록에 **없다.** 재회운 heroNote 는 리포트 최상단의 유일한
     * 경계 선언이라 영구 잠금 구간이다(`isPermanentlyLockedProse`).
     * 모델이 고쳐 쓰면 그 필드만 base 로 되돌아간다.
     */
    expect(changedTopLevelFields(review.draft, fixture.report)).toEqual([
      'summary.title',
      'summary.analysis',
      'summary.advice',
      'keyTakeaways.body',
      'questionAnswers.analysis',
      'questionAnswers.advice',
      'sections.paragraphs',
      'sections.cards.body',
      'sections.details.content',
      'currentDayun.summary',
      'nextDayun.summary',
      'actionPlan.title',
      'actionPlan.priorities'
    ]);
  });

  /**
   * 목록에 없는 두 자리는 **모델이 거부당한 게 아니라 base 에 자리가 없다.**
   * 재회운 리포트의 비(非) `-v2` 섹션에는 bullets 가 하나도 없고
   * `actionPlan.luckyDays` / `unluckyDays` 는 빈 배열이다. 자리가 생기면 열린다.
   */
  it('채택 목록에서 빠진 자리는 base 에 그 자리가 없기 때문이다', () => {
    const fixture = buildFixture('love-reunion');
    const customerSections = fixture.report.sections.filter((section) => !section.id.endsWith('-v2'));

    expect(customerSections.every((section) => (section.bullets?.length || 0) === 0)).toBe(true);
    expect(fixture.report.actionPlan.luckyDays).toEqual([]);
    expect(fixture.report.actionPlan.unluckyDays).toEqual([]);
  });

  it('계산 근거 섹션(-v2)은 sanitize 단계에서 아예 draft 에 실리지 않는다', () => {
    const fixture = buildFixture('love-reunion');
    const engineSections = fixture.report.sections.filter((section) => section.id.endsWith('-v2'));
    const draft = sanitizeGeminiDraft({
      sections: engineSections.map((section) => ({
        id: section.id,
        paragraphs: (section.paragraphs || []).map(() => fixture.natal('계산 근거를 다시 써 봤어요.'))
      }))
    }, fixture.report);

    expect(engineSections.length).toBeGreaterThan(0);
    expect(draft.sections).toBeUndefined();
  });

  it('병합 결과에서도 계산값과 삭제 불가 고지는 base 그대로다', () => {
    const { fixture, review } = runReview('love-reunion');
    expect(review.draft.summary?.title).not.toBe(fixture.report.summary.title);
    // 검증을 통과한 draft 에는 계산값 필드가 아예 없다 — 있을 수 없는 구조다.
    const draftKeys = Object.keys(review.draft);
    ['pillars', 'fiveElements', 'tenGods', 'legalNotice', 'monthLuck', 'yearLuck', 'serialNumber']
      .forEach((key) => expect(draftKeys).not.toContain(key));
  });
});

describe('종합사주 — 같은 응답이 전부 거부된다', () => {
  it('strict-echo 상품에서는 새 문장이 한 필드도 채택되지 않는다', () => {
    const { review } = runReview('general-signature');

    expect(review.mode).toBe('strict-echo');
    expect(review.accepted).toBe(0);
    expect(review.rejected).toBeGreaterThan(40);
    expect(Object.keys(review.rejectionsByReason)).toEqual(['base-mismatch']);
  });
});

describe('scope 위반은 모드와 무관하다', () => {
  it('시기 섹션에 자연 근거를 인용하면 재회운에서도 거부된다', () => {
    const fixture = buildFixture('love-reunion');
    const temporalSection = fixture.report.sections.find(
      (section) => TEMPORAL_SECTIONS.has(section.id) && (section.paragraphs?.length || 0) > 0
    );
    expect(temporalSection).toBeTruthy();

    const draft = sanitizeGeminiDraft({
      sections: [{
        id: temporalSection!.id,
        paragraphs: [fixture.natal('이 구간은 이렇게 읽는 편이 정확해요.')]
      }]
    }, fixture.report);

    const review = reviewGeminiDraft(draft, fixture.basis, fixture.report);
    expect(review.rejectionsByReason).toEqual({ 'out-of-scope-evidence': 1 });
  });
});

/** 인용 형식만 다르게 준 응답들. 형식 위반은 필드 하나가 결정론으로 되돌아가는 대가다. */
describe('형식 위반 — 여전히 거부되는 것들', () => {
  const cases: Array<[string, (fixture: ReturnType<typeof buildFixture>) => string, string]> = [
    ['근거 인용이 없다', () => '근거 없이 새로 쓴 문장이에요.', 'missing-citation'],
    ['인용만 있고 본문이 없다', (fixture) => fixture.natal('').trim(), 'citation-only'],
    ['근거 ID 자리가 비었다', () => '새 문장이에요. [근거:]', 'missing-citation'],
    ['괄호를 닫지 않았다', () => '새 문장이에요. [근거:MRE-V2-MONTH-COMMAND-001', 'malformed-citation'],
    ['존재하지 않는 근거다', () => '새 문장이에요. [근거:MRE-V2-NOT-A-RULE]', 'unknown-evidence-id']
  ];

  cases.forEach(([label, makeValue, code]) => {
    it(label, () => {
      const fixture = buildFixture('love-reunion');
      const draft = sanitizeGeminiDraft({ heroNote: makeValue(fixture) }, fixture.report);
      const review = reviewGeminiDraft(draft, fixture.basis, fixture.report);

      expect(review.accepted).toBe(0);
      expect(review.rejectionsByReason).toEqual({ [code]: 1 });
    });
  });
});

describe('길이 상한 — 자르지 않고 폐기한다', () => {
  it('상한을 넘긴 필드는 sanitize 단계에서 사라져 base 가 남는다', () => {
    const fixture = buildFixture('love-reunion');
    const tooLong = `${'가'.repeat(4001)}`;
    const draft = sanitizeGeminiDraft({ heroNote: fixture.natal(tooLong) }, fixture.report);

    expect(draft.heroNote).toBeUndefined();
    // 폐기는 sanitize 에서 일어나 검증 계층에 도달하지 않는다.
    const review = reviewGeminiDraft(draft, fixture.basis, fixture.report);
    expect(review.rejected).toBe(0);
    expect(review.accepted).toBe(0);

    /*
     * 그래도 **관측은 된다.** 이전에는 길이 초과 폐기가 거부 카운터에도 로그에도
     * 잡히지 않아 `accepted + rejected` 가 '모델이 시도한 필드 수' 가 아니라
     * '살아서 검증까지 간 필드 수' 가 됐다. 분모가 왜곡되면 거부율 알람이 성립하지 않는다.
     */
    const audited = sanitizeGeminiDraftWithAudit(
      { heroNote: fixture.natal(tooLong) },
      fixture.report
    );
    expect(audited.draft.heroNote).toBeUndefined();
    expect(audited.dropped).toHaveLength(1);
    expect(audited.dropped[0]).toMatch(/^cap=\d+ len=\d+$/u);
  });
});

/** 배열 인덱스 정렬. 한 항목이 폐기됐을 때 뒤 문장이 당겨지면 조용히 다른 자리에 들어간다. */
describe('배열 인덱스 보존', () => {
  it('중간 항목이 길이 초과로 폐기돼도 뒤 문장이 당겨지지 않는다', () => {
    const fixture = buildFixture('love-reunion');
    expect(fixture.report.summary.analysis.length).toBeGreaterThanOrEqual(3);

    const second = fixture.natal('두 번째 자리에 들어갈 문장이에요.');
    const draft = sanitizeGeminiDraft({
      summary: {
        analysis: [fixture.natal('가'.repeat(5001)), second, fixture.natal('세 번째 자리예요.')]
      }
    }, fixture.report);

    expect(draft.summary?.analysis?.[0]).toBe('');
    expect(draft.summary?.analysis?.[1]).toBe(second);

    const review = reviewGeminiDraft(draft, fixture.basis, fixture.report);
    expect(review.draft.summary?.analysis?.[0]).toBe(fixture.report.summary.analysis[0]);
    expect(review.draft.summary?.analysis?.[1]).toBe(second);
  });
});

/** 상품별 온도·지침 분기가 실제 basis 에서도 유지되는지. */
describe('상품 분기', () => {
  it('두 상품의 basis 는 같은 검증 카탈로그 구조를 쓴다', () => {
    const reunion = buildFixture('love-reunion');
    const general = buildFixture('general-signature');
    const scopes = (basis: DeterministicSajuBasis) => ({
      interpretation: Boolean(basis.commercialV2.interpretation),
      temporal: Boolean(basis.commercialV2.temporal)
    });

    expect(scopes(reunion.basis)).toEqual({ interpretation: true, temporal: true });
    expect(scopes(general.basis)).toEqual({ interpretation: true, temporal: true });
  });
});
