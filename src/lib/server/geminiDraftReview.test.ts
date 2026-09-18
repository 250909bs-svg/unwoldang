import { describe, expect, it } from 'vitest';
import { REUNION_UNDELETABLE_COPY } from '../reunion/safetyCopy';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport } from '../saju/reportBuilder';
import { buildEntityUniverse, findUnknownEntities } from './geminiProseGuard';
import { reviewGeminiDraft, sanitizeGeminiDraft } from './geminiReportService';

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

function buildFixture(serviceId: 'love-reunion' | 'general-signature', formData: typeof reunionFormData | typeof generalFormData) {
  const basis = buildDeterministicSajuBasis(serviceId, formData);
  const report = buildSajuReport(serviceId, formData, basis);
  const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
  expect(ruleId).toBeTruthy();
  return { basis, report, cite: (text: string) => `${text} [근거:${ruleId}]` };
}

/**
 * 이 명식에 **실재하지 않는 연도**를 실행 시점에 찾아낸다.
 *
 * 대운·세운 표가 어디까지 뻗어 있는지는 생년월일에 따라 달라지므로 상수로 박으면
 * 테스트가 사주에 따라 깨진다. 집합을 직접 물어보고 고른다.
 */
function findAbsentYear(basis: ReturnType<typeof buildDeterministicSajuBasis>, report: ReturnType<typeof buildSajuReport>) {
  const universe = buildEntityUniverse(basis, report);
  for (let year = 2099; year >= 2040; year -= 1) {
    if (findUnknownEntities(`${year}년`, universe).length > 0) return year;
  }
  throw new Error('테스트용으로 쓸 수 있는 미존재 연도를 찾지 못했습니다.');
}

describe('per-field fallback — 재회운(authored)', () => {
  it('모델이 직접 쓴 새 문장을 채택한다', () => {
    const { basis, report, cite } = buildFixture('love-reunion', reunionFormData);
    const draft = sanitizeGeminiDraft({
      summary: { title: cite('지금 확인된 것과 확인되지 않은 것을 나눠서 보겠습니다.') }
    }, report);

    const review = reviewGeminiDraft(draft, basis, report);

    expect(review.mode).toBe('authored');
    expect(review.rejections).toEqual([]);
    expect(review.accepted).toBe(1);
    expect(review.draft.summary?.title).toBe(cite('지금 확인된 것과 확인되지 않은 것을 나눠서 보겠습니다.'));
  });

  /**
   * 재회운 heroNote 는 **영구 잠금**이다.
   *
   * 리포트 최상단의 유일한 경계 선언이고(`applyLoveReunionSafetyContract` 가 고정),
   * 화면(`Report.tsx` 의 `{report.heroNote}`)까지 그대로 렌더된다.
   * 이전에는 산문 가드도 lock 복원 목록도 이 문장을 몰라서 모델 값이 그대로 나갔다.
   */
  it('heroNote 는 재회운에서 모델이 바꿀 수 없다', () => {
    const { basis, report, cite } = buildFixture('love-reunion', reunionFormData);
    const rewritten = sanitizeGeminiDraft({ heroNote: cite('제가 다시 정리해 드릴게요.') }, report);
    const echoed = sanitizeGeminiDraft({ heroNote: cite(report.heroNote) }, report);

    // heroNote 자체가 삭제 불가 문구이므로 고쳐 쓰면 그 문구를 지운 것으로 잡힌다.
    expect(reviewGeminiDraft(rewritten, basis, report).rejectionsByReason)
      .toEqual({ 'undeletable-copy-removed': 1 });
    expect(reviewGeminiDraft(echoed, basis, report).rejections).toEqual([]);
  });

  it('결정론 문구를 그대로 echo 해도 채택한다 (프롬프트 해제 전 회귀 방지)', () => {
    const { basis, report, cite } = buildFixture('love-reunion', reunionFormData);
    const loveSection = report.sections.find((section) => section.id === 'love');
    expect((loveSection?.paragraphs?.length || 0)).toBeGreaterThanOrEqual(2);

    const draft = sanitizeGeminiDraft({
      heroNote: cite(report.heroNote),
      summary: {
        title: cite(report.summary.title),
        analysis: report.summary.analysis.map((value) => cite(value)),
        advice: report.summary.advice.map((value) => cite(value))
      },
      sections: [{ id: 'love', paragraphs: loveSection!.paragraphs!.map((value) => cite(value)) }]
    }, report);

    const review = reviewGeminiDraft(draft, basis, report);

    expect(review.rejections).toEqual([]);
    expect(review.rejected).toBe(0);
    expect(review.accepted).toBeGreaterThan(5);
  });

  it('실재하지 않는 연도를 주장한 필드만 거부하고 나머지는 채택한다', () => {
    const { basis, report, cite } = buildFixture('love-reunion', reunionFormData);
    const absentYear = findAbsentYear(basis, report);
    const accepted = cite('지금은 확인할 수 있는 것만 정리해 드릴게요.');
    const invented = cite(`${absentYear}년에는 상황이 완전히 달라집니다.`);

    const draft = sanitizeGeminiDraft({
      summary: { title: accepted, analysis: [invented, cite('조건부터 하나씩 세어 보겠습니다.')] }
    }, report);

    const review = reviewGeminiDraft(draft, basis, report);

    expect(review.accepted).toBe(2);
    expect(review.rejected).toBe(1);
    expect(review.rejectionsByReason).toEqual({ 'unknown-entity': 1 });
    expect(review.rejections[0].path).toBe('summary.analysis.0');

    // 거부된 인덱스만 base 로 되돌아가고 채택된 인덱스는 살아 있다.
    expect(review.draft.summary?.title).toBe(accepted);
    expect(review.draft.summary?.analysis?.[0]).toBe(report.summary.analysis[0]);
    expect(review.draft.summary?.analysis?.[1]).toBe(cite('조건부터 하나씩 세어 보겠습니다.'));
  });

  it('금지 표현(상대 속마음 단정)이 있는 필드만 거부한다', () => {
    const { basis, report, cite } = buildFixture('love-reunion', reunionFormData);
    const draft = sanitizeGeminiDraft({
      summary: {
        title: cite('그 사람은 아직 미련이 남아 있어요.'),
        advice: [cite('오늘 확인할 것 한 가지만 정리해 드릴게요.')]
      }
    }, report);

    const review = reviewGeminiDraft(draft, basis, report);

    expect(review.accepted).toBe(1);
    expect(review.rejectionsByReason).toEqual({ 'banned-phrase': 1 });
    expect(review.rejections[0].path).toBe('summary.title');
    expect(review.draft.summary?.title).toBeUndefined();
  });

  it('감시 유도와 훈계형 표현도 draft 단계에서 거부한다', () => {
    const { basis, report, cite } = buildFixture('love-reunion', reunionFormData);
    const draft = sanitizeGeminiDraft({
      summary: {
        title: cite('이제 그만 집착하지 마세요.'),
        advice: [cite('SNS 스토리를 확인해서 반응을 살펴보세요.')]
      }
    }, report);

    const review = reviewGeminiDraft(draft, basis, report);

    expect(review.accepted).toBe(0);
    expect(review.rejectionsByReason['banned-phrase']).toBe(2);
  });

  it('근거 인용이 없거나 범위를 벗어난 필드는 모드와 무관하게 거부한다', () => {
    const { basis, report } = buildFixture('love-reunion', reunionFormData);
    const draft = sanitizeGeminiDraft({
      heroNote: '근거 없이 새로 쓴 문장입니다.',
      summary: { title: `${report.summary.title} [근거:not-a-real-rule]` }
    }, report);

    const review = reviewGeminiDraft(draft, basis, report);

    expect(review.accepted).toBe(0);
    expect(review.rejectionsByReason).toEqual({
      'missing-citation': 1,
      'unknown-evidence-id': 1
    });
  });

  it('base 에 대응 값이 없는 필드는 되돌릴 곳이 없으므로 거부한다', () => {
    const { basis, report, cite } = buildFixture('love-reunion', reunionFormData);
    const overflowIndex = report.summary.analysis.length;
    const draft = sanitizeGeminiDraft({
      summary: {
        analysis: [
          ...report.summary.analysis.map((value) => cite(value)),
          cite('base 에 없는 인덱스에 새로 끼워 넣은 문장입니다.')
        ]
      }
    }, report);

    const review = reviewGeminiDraft(draft, basis, report);

    expect(review.rejectionsByReason).toEqual({ 'no-base-anchor': 1 });
    expect(review.rejections[0].path).toBe(`summary.analysis.${overflowIndex}`);
    expect(review.draft.summary?.analysis).toHaveLength(report.summary.analysis.length);
  });
});

describe('배열 절단 방지 — 섹션이 조용히 잘리지 않는다', () => {
  it('모델이 문단 하나만 돌려줘도 base 길이를 유지한다', () => {
    const { basis, report, cite } = buildFixture('love-reunion', reunionFormData);
    const loveSection = report.sections.find((section) => section.id === 'love');
    const baseParagraphs = loveSection!.paragraphs!;
    expect(baseParagraphs.length).toBeGreaterThanOrEqual(2);

    const draft = sanitizeGeminiDraft({
      sections: [{ id: 'love', paragraphs: [cite('첫 문단만 새로 썼습니다.')] }]
    }, report);

    const review = reviewGeminiDraft(draft, basis, report);
    const reviewedParagraphs = review.draft.sections?.[0].paragraphs;

    expect(reviewedParagraphs).toHaveLength(baseParagraphs.length);
    expect(reviewedParagraphs?.[0]).toBe(cite('첫 문단만 새로 썼습니다.'));
    expect(reviewedParagraphs?.slice(1)).toEqual(baseParagraphs.slice(1));
  });
});

describe('영구 잠금 구간 — 삭제 불가 문구', () => {
  it('authored 모드에서도 삭제 불가 문구가 든 필드는 바이트 일치를 요구한다', () => {
    const { basis, report, cite } = buildFixture('love-reunion', reunionFormData);
    const lockedText = `${REUNION_UNDELETABLE_COPY['readiness-not-probability']} 아래에서 하나씩 보겠습니다.`;
    const lockedBase = {
      ...report,
      summary: { ...report.summary, title: lockedText }
    };

    const paraphrased = sanitizeGeminiDraft({
      summary: { title: cite('조건을 하나씩 세어 보겠습니다.') }
    }, lockedBase);
    const echoed = sanitizeGeminiDraft({ summary: { title: cite(lockedText) } }, lockedBase);

    /*
     * 삭제 불가 조각을 **지운** 경우이므로 `undeletable-copy-removed` 다.
     * 이 사유는 이전 순서에서 도달 불가능한 죽은 분기였다 — 삭제 불가 조각이 base 에
     * 있으면 `isPermanentlyLockedProse` 가 먼저 `base-mismatch` 로 반환했다.
     * 문구를 지운 것과 문구는 남겼지만 다른 곳을 바꾼 것은 관측상 구분되어야 한다.
     */
    expect(reviewGeminiDraft(paraphrased, basis, lockedBase).rejectionsByReason)
      .toEqual({ 'undeletable-copy-removed': 1 });
    expect(reviewGeminiDraft(echoed, basis, lockedBase).rejections).toEqual([]);
  });
});

describe('다른 상품은 현행 유지 — strict-echo', () => {
  it('종합사주는 새 문장을 여전히 거부한다', () => {
    const { basis, report, cite } = buildFixture('general-signature', generalFormData);
    const draft = sanitizeGeminiDraft({
      heroNote: cite('내년에 반드시 승진합니다.')
    }, report);

    const review = reviewGeminiDraft(draft, basis, report);

    expect(review.mode).toBe('strict-echo');
    expect(review.rejectionsByReason).toEqual({ 'base-mismatch': 1 });
    expect(review.accepted).toBe(0);
  });

  it('종합사주의 정확한 echo 는 그대로 채택한다', () => {
    const { basis, report, cite } = buildFixture('general-signature', generalFormData);
    const draft = sanitizeGeminiDraft({ heroNote: cite(report.heroNote) }, report);

    const review = reviewGeminiDraft(draft, basis, report);

    expect(review.rejections).toEqual([]);
    expect(review.accepted).toBe(1);
  });
});

describe('관측 카운터', () => {
  it('거부 사유 키를 ASCII 로만 쓴다', () => {
    /*
     * `rejectionsByReason` 은 `engineMeta` 에 실려 나가고, `findLoveReunionSafetyViolations`
     * 는 engineMeta 를 포함한 리포트 전체를 문자열로 검사한다. 사유 키에 한국어(예: '재회 확률')
     * 를 쓰면 관측 메타 자체가 안전 가드를 트립시킨다.
     */
    const { basis, report } = buildFixture('love-reunion', reunionFormData);
    const draft = sanitizeGeminiDraft({ heroNote: '근거 없는 문장입니다.' }, report);
    const review = reviewGeminiDraft(draft, basis, report);

    expect(Object.keys(review.rejectionsByReason).length).toBeGreaterThan(0);
    Object.keys(review.rejectionsByReason).forEach((code) => {
      expect(code).toMatch(/^[a-z-]+$/);
    });
  });
});
