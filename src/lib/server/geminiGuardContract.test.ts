/**
 * 가드 계약 — 회귀가 났을 때 **조용히 나빠지는** 지점들.
 *
 * 여기 있는 것은 새 기능이 아니라 그물이다. 각 블록의 주석이 "이 그물이 없으면
 * 무엇이 조용히 깨지는가" 를 적어 둔다.
 */

import { describe, expect, it } from 'vitest';
import { getReunionBannedPhrases } from '../reunion/bannedPhrases';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildSajuReport, findLoveReunionSafetyViolations } from '../saju/reportBuilder';
import { finalizeCustomerReport } from '../saju/reportPresentation';
import {
  hasMalformedReportEvidenceReference,
  lockCommercialReportFacts
} from '../saju/v2/reportFactGuard';
import {
  AUTHORED_PROSE_SERVICE_IDS,
  proseGuardModeForServiceId
} from '../saju/promptRelease';
import {
  customerProseFields,
  findNewTextViolations,
  proseGuardModeFor,
  resolveGuardAgeBand
} from './geminiProseGuard';
import {
  buildGeminiRequestPayload,
  reviewGeminiDraft,
  sanitizeGeminiDraft
} from './geminiReportService';

const baseForm = {
  gender: 'female' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthTime: '10:24',
  isUnknownTime: false,
  q1: '올해 일의 방향은 무엇인가요?',
  q2: '무엇을 먼저 정리하면 좋을까요?'
};

const reunionPartner = {
  name: '상대 검증자',
  gender: 'male' as const,
  calendar: 'solar' as const,
  isLeapMonth: false,
  birthDate: '1991-05-14',
  birthTime: '08:30',
  isUnknownTime: false
};

function buildFixture(
  serviceId: 'love-reunion' | 'general-signature' | 'life-flow' | 'past-life-goblin',
  birthDate = '1992-09-09'
) {
  const formData = {
    ...baseForm,
    name: '검증자',
    birthDate,
    ...(serviceId === 'love-reunion'
      ? { relationshipStatus: 'breakup-reunion' as const, partner: reunionPartner }
      : {})
  };
  const basis = buildDeterministicSajuBasis(serviceId, formData);
  const report = finalizeCustomerReport(buildSajuReport(serviceId, formData, basis));
  const ruleId = basis.commercialV2.interpretation?.foundations.monthCommand.ruleId;
  expect(ruleId).toBeTruthy();
  return { basis, report, cite: (text: string) => `${text} [근거:${ruleId}]` };
}

describe('현행 유지 상품 — 완전한 echo 는 전부 채택된다', () => {
  /**
   * 이 파일에서 **가장 중요한 그물**이다.
   *
   * `general-signature`/`life-flow`/`past-life-goblin` 은 코드가 `strict-echo` 이므로
   * 프롬프트의 echo 잠금이 그대로 살아 있어야 한다. 이 상품들에서 확인해야 할 회귀는
   * "새 문장이 거부되는가"(그건 다른 파일이 본다)가 아니라 **"정상 echo 가 여전히
   * 전부 채택되는가"** 다. 검증 절차를 바꾸는 중에 이쪽이 깨지면 전 요청이
   * `base-mismatch` 로 결정론 fallback 이 되는데, 로그만 보면 "거부가 늘었다" 로만
   * 보이고 트래픽 증가와 구분되지 않는다.
   */
  (['general-signature', 'life-flow', 'past-life-goblin'] as const).forEach((serviceId) => {
    it(serviceId, () => {
      const { basis, report, cite } = buildFixture(serviceId);
      const section = report.sections.find(
        (candidate) => !candidate.id.endsWith('-v2') && (candidate.paragraphs?.length || 0) > 1
      );
      expect(section).toBeTruthy();

      const draft = sanitizeGeminiDraft(
        {
          heroNote: cite(report.heroNote),
          summary: {
            title: cite(report.summary.title),
            analysis: report.summary.analysis.map((value) => cite(value)),
            advice: report.summary.advice.map((value) => cite(value))
          },
          keyTakeaways: report.keyTakeaways.map((card) => ({
            title: card.title,
            body: cite(card.body)
          })),
          sections: [{ id: section!.id, paragraphs: section!.paragraphs!.map((value) => cite(value)) }]
        },
        report
      );

      const review = reviewGeminiDraft(draft, basis, report);

      expect(review.mode).toBe('strict-echo');
      expect(review.rejections).toEqual([]);
      expect(review.accepted).toBeGreaterThan(5);
    });
  });
});

describe('롤백은 상수 하나다 — 코드와 프롬프트가 갈라질 수 없다', () => {
  /**
   * 1차 해제의 롤백 절차는 **두 곳을 반드시 같이** 고치는 것이었다:
   * 가드의 `proseGuardModeFor` 와 프롬프트의 상품 분기. 한쪽만 고치면 모델이 새 문장을
   * 쓰고 전량 거부되어 전 요청이 결정론 fallback 으로 떨어진다 — **해제 전보다 나쁜
   * 상태**이고, 로그만 보면 "거부가 늘었다" 로만 보인다. 급하게 롤백하는 상황에서
   * 두 곳을 기억해야 하는 절차는 지켜지지 않는다.
   *
   * 그래서 두 계층이 같은 상수를 읽게 했다. 이 테스트가 그 사실을 잠근다.
   */
  it('가드 모드와 프롬프트 분기가 같은 상수를 읽는다', () => {
    (['love-reunion', 'general-signature', 'life-flow', 'past-life-goblin'] as const).forEach(
      (serviceId) => {
        const { basis, report } = buildFixture(serviceId);
        const payload = buildGeminiRequestPayload(report, basis);
        const system = payload.systemInstruction.parts.map((part) => part.text).join('\n');
        const authored = proseGuardModeForServiceId(serviceId) === 'authored';

        // 코드 가드
        expect(proseGuardModeFor(serviceId), serviceId).toBe(authored ? 'authored' : 'strict-echo');
        // 프롬프트: 산문 계약과 echo 잠금은 **절대 함께 나가지 않는다.**
        expect(system.includes('You author original Korean prose'), serviceId).toBe(authored);
        expect(system.includes('this product is in echo mode'), serviceId).toBe(!authored);
        // 온도
        expect(payload.generationConfig.temperature, serviceId).toBe(authored ? 0.75 : 0);
      }
    );
  });

  it('현재 열린 상품은 재회운뿐이다', () => {
    expect([...AUTHORED_PROSE_SERVICE_IDS]).toEqual(['love-reunion']);
  });
});

describe('밴드별 금지어가 실제로 걸린다', () => {
  /**
   * 이전에는 `findReunionBannedPhrases(text)` 를 **밴드 인자 없이** 불러서
   * 공통 49개만 검사했다. 밴드 조건 금지어는 정확히 이 작업이 비집행으로 둔
   * '근거 없는 희망' 범주다. 프롬프트 직렬화에서도 빠져 있었다.
   */
  it('thirties 독자에게 "더 좋은 사람" 은 거부된다', () => {
    const thirties = buildFixture('love-reunion', '1990-03-15');
    const band = resolveGuardAgeBand(thirties.basis, thirties.report);
    expect(band).toBe('thirties');
    expect(getReunionBannedPhrases(band)).toContain('더 좋은 사람');

    const sentence = '더 좋은 사람을 만나게 되실 거예요.';
    const base = '오늘은 조용히 지내 보세요.';

    expect(findNewTextViolations(sentence, base, 'love-reunion', { band }))
      .toContain(`band:${band}`);
    // 밴드를 넘기지 않으면 공통 49개만 검사되어 통과한다 — 그게 원래 버그였다.
    expect(findNewTextViolations(sentence, base, 'love-reunion', {})).toEqual([]);
  });

  it('teen 독자에게 "아직 어리니까" 는 거부된다', () => {
    const teen = buildFixture('love-reunion', '2010-05-20');
    const band = resolveGuardAgeBand(teen.basis, teen.report);
    expect(band).toBe('teen');

    expect(findNewTextViolations('아직 어리니까 괜찮아요.', '오늘은 조용히 지내 보세요.', 'love-reunion', { band }))
      .toContain(`band:${band}`);
  });

  it('밴드는 정규화 생일과 기준 시각으로 정한다', () => {
    /* 뷰에서 `new Date()` 를 부르면 같은 입력이 날짜마다 다른 리포트를 낳는다. */
    const { basis, report } = buildFixture('love-reunion', '1992-09-09');
    expect(resolveGuardAgeBand(basis, report)).toBe(resolveGuardAgeBand(basis, report));
    expect(resolveGuardAgeBand(null, report)).toBe('neutral');
  });
});

describe('삭제 불가 문구 · heroNote 는 lock 이 되돌린다', () => {
  /**
   * 산문 가드가 1차, `lockCommercialReportFacts` 가 2차다.
   * 가드를 우회하는 경로가 생겨도 이 줄이 남는다.
   */
  it('재회운 heroNote 는 병합 후 base 로 복원된다', () => {
    const { report } = buildFixture('love-reunion');
    const tampered = { ...report, heroNote: '제가 재회 가능성을 정리해 드릴게요.' };
    expect(lockCommercialReportFacts(report, tampered).heroNote).toBe(report.heroNote);
  });

  it('다른 상품의 heroNote 는 모델 값을 유지한다', () => {
    const { report } = buildFixture('general-signature');
    const rewritten = { ...report, heroNote: '모델이 쓴 새 문장입니다.' };
    expect(lockCommercialReportFacts(report, rewritten).heroNote).toBe('모델이 쓴 새 문장입니다.');
  });
});

describe('인용 형식 — 짝이 안 맞는 대괄호도 잡는다', () => {
  /**
   * 이전에는 남은 텍스트에 `'[근거:'` 가 있는지만 봤다. 그래서 짝이 안 맞는
   * 닫는 괄호가 검사를 통과해 **고객 문장에 그대로 남았다.**
   */
  it('정상 인용은 통과한다', () => {
    expect(hasMalformedReportEvidenceReference('문장입니다. [근거:RULE-1]')).toBe(false);
    expect(hasMalformedReportEvidenceReference('문장입니다. [근거:RULE-1,RULE-2]')).toBe(false);
  });

  it('여는 괄호만 남으면 거부한다', () => {
    expect(hasMalformedReportEvidenceReference('문장입니다. [근거:RULE-1')).toBe(true);
  });

  it('닫는 괄호만 남으면 거부한다', () => {
    expect(hasMalformedReportEvidenceReference('문장입니다 근거:RULE-1]')).toBe(true);
    expect(hasMalformedReportEvidenceReference('문장입니다. [근거:RULE-1]]')).toBe(true);
  });

  /**
   * 검사를 "남은 대괄호 전체" 로 넓혔으므로, **결정론 카피가 대괄호를 쓰지 않는지**
   * 확인해야 한다. 쓴다면 정상 echo 가 `malformed-citation` 으로 거부되어
   * 이전보다 나빠진다. 실측: 4개 상품 전 필드에서 0건.
   */
  (['love-reunion', 'general-signature', 'life-flow', 'past-life-goblin'] as const).forEach(
    (serviceId) => {
      it(`${serviceId} 결정론 카피에는 대괄호가 없다`, () => {
        const { report } = buildFixture(serviceId);
        const fields = customerProseFields(report);
        expect(fields.length).toBeGreaterThan(50);
        const offenders = fields
          .filter(({ text }) => text.includes('[') || text.includes(']'))
          .map(({ path }) => path);
        expect(offenders).toEqual([]);
      });
    }
  );
});

describe('관측 메타는 안전 가드를 스스로 트립시키지 않는다', () => {
  /**
   * `aiFields` 의 사유 코드를 ASCII 로 짓는 규약의 실제 근거를 여기서 잠근다.
   *
   * 프로덕션 순서에서 `findLoveReunionSafetyViolations` 는 lock·검사가 끝난 **뒤에**
   * 주입되는 `aiFields` 를 보지 않는다. 그래서 지금은 한국어 사유를 넣어도 트립하지
   * 않는다 — 이전 주석과 ADR 이 "가드가 검사하므로" 라고 적은 것은 실제 순서와
   * 어긋났다. ASCII 규약은 **주입 위치가 앞으로 옮겨질 경우를 대비한 계약**이고,
   * 그 계약이 유효한지를 여기서 실제로 확인한다.
   */
  it('aiFields 를 붙인 리포트도 하드 가드를 통과한다', () => {
    const { report } = buildFixture('love-reunion');
    const withMeta = report.engineMeta
      ? {
          ...report,
          engineMeta: {
            ...report.engineMeta,
            aiFields: {
              mode: 'authored' as const,
              accepted: 12,
              rejected: 3,
              rejectionsByReason: {
                'banned-phrase': 1,
                'unknown-entity': 1,
                'misattributed-claim': 1
              },
              revertedFamilies: ['actionPlan']
            }
          }
        }
      : report;

    expect(findLoveReunionSafetyViolations(withMeta)).toEqual([]);
  });
});
