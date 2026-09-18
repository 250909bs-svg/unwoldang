/**
 * 결정론 카피가 스스로 안전 검사를 위반하지 않는가.
 *
 * ## 왜 이 파일이 필요한가
 *
 * 의도 가드(`reunionIntentGuard`)와 재회 하드 가드는 **절대 검사**다 — base 차감을
 * 하지 않는다. 차감을 두면 base 가 어떤 라벨을 한 번 트립하는 순간 그 필드에서
 * 해당 규칙 전체가 조용히 꺼지기 때문이다(앞선 구현의 실제 구멍).
 *
 * 절대 검사의 대가는 "결정론 카피가 위반하면 정상 echo 도 거부된다" 는 것이다.
 * 그 위험을 프로덕션에서 배우면 안 된다 — 거부율이 조용히 올라가고 전 필드 거부로
 * fallback 이 되며, 고객은 이유를 알 수 없다. 그래서 여기서 **결정론 리포트 전체**에
 * 같은 검사를 돌려 0건임을 잠근다. 카피 버그는 500 이 아니라 빨간불로 드러나야 한다.
 *
 * 이 테스트가 깨지면 고쳐야 할 것은 검사표가 아니라 **그 카피**다.
 * (정말 오탐이라면 `MUST PASS` 케이스로 `reunionIntentGuard.test.ts` 에 먼저 넣어라.)
 */

import { describe, expect, it } from 'vitest';
import { resolveReunionAgeBand } from '../reunion/ageBand';
import { findReunionBannedPhrases } from '../reunion/bannedPhrases';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { findLoveReunionSafetyViolations, buildSajuReport } from '../saju/reportBuilder';
import { findCustomerReportTextViolations, finalizeCustomerReport } from '../saju/reportPresentation';
import {
  customerProseFields,
  findNewTextViolations,
  SUBTRACTABLE_BANNED_RULE_IDS
} from './geminiProseGuard';
import { findReunionIntentViolations } from './reunionIntentGuard';

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

/** 밴드 경계를 걸치는 생년으로 여러 벌 돌린다. 밴드별 금지어가 base 를 잡는지도 본다. */
const BIRTH_DATES = ['2009-04-02', '2003-11-20', '1998-06-15', '1992-09-09', '1980-01-30', '1970-07-07'];

function buildReport(birthDate: string) {
  const formData = { ...reunionFormData, birthDate };
  const basis = buildDeterministicSajuBasis('love-reunion', formData);
  const report = finalizeCustomerReport(buildSajuReport('love-reunion', formData, basis));
  const band = resolveReunionAgeBand({
    birthDate,
    referenceInstant: basis.commercialV2.generatedFor.instant
  }).ageBand;
  return { basis, report, band };
}

describe('결정론 재회 리포트는 의도 가드를 위반하지 않는다', () => {
  BIRTH_DATES.forEach((birthDate) => {
    it(`생년 ${birthDate}`, () => {
      const { report } = buildReport(birthDate);
      const fields = customerProseFields(report);

      // 리포트가 비어 있으면 이 테스트는 아무것도 증명하지 않는다.
      expect(fields.length).toBeGreaterThan(100);

      const offenders = fields
        .map(({ path, text }) => ({ path, hits: findReunionIntentViolations(text, null) }))
        .filter((item) => item.hits.length > 0)
        .map((item) => `${item.path}: ${item.hits.map((hit) => `${hit.category}<${hit.match}>`).join(', ')}`);

      expect(offenders).toEqual([]);
    });
  });
});

describe('결정론 재회 리포트는 밴드별 금지어도 위반하지 않는다', () => {
  /**
   * 밴드별 금지어(`bandCopy.ts` 의 teen 5개 · thirties 5개 등)는 지금까지 모델 문장
   * 검사와 프롬프트 직렬화 양쪽에서 통째로 빠져 있었다. 이제 실제로 걸리므로,
   * 결정론 카피가 그 목록을 트립하지 않는지 먼저 확인해야 한다.
   */
  BIRTH_DATES.forEach((birthDate) => {
    it(`생년 ${birthDate}`, () => {
      const { report, band } = buildReport(birthDate);
      const offenders = customerProseFields(report)
        .flatMap(({ path, text }) =>
          findReunionBannedPhrases(text, band)
            /*
             * 차감 대상 규칙은 결정론 카피가 정당하게 트립하는 것들이다
             * (`probability` = 오행 분포의 `%`, `age-mention` = 대운 구간의 `N세`,
             * `upsell` = `개운법`). 그래서 여기서도 제외한다.
             * **목록을 테스트에 손으로 복사하지 않고 검사 쪽 상수를 그대로 쓴다** —
             * 규칙을 차감 대상으로 옮기는 날 이 테스트가 조용히 함께 느슨해져야
             * 하는 것이 아니라, 같은 한 곳만 보면 되도록.
             */
            .filter((hit) => !SUBTRACTABLE_BANNED_RULE_IDS.has(hit.ruleId))
            .map((hit) => `${path}: ${hit.ruleId}<${hit.match}>`)
        );

      expect(offenders).toEqual([]);
    });
  });
});

describe('정상 echo 는 전 필드에서 채택된다 (회귀 기준선)', () => {
  /**
   * 지금 모델은 여전히 echo 만 한다. 그래서 **결정론 문구 전량 echo 가 0 거부로
   * 통과하는 것**이 실질 합격 기준이다. 절대 검사를 늘렸으니 그 기준을 다시 잠근다.
   */
  it('결정론 문구를 그대로 넘기면 위반 라벨이 없다', () => {
    const { report, band } = buildReport('1992-09-09');
    const offenders = customerProseFields(report)
      .map(({ path, text }) => ({
        path,
        labels: findNewTextViolations(text, text, 'love-reunion', { band, intent: null })
      }))
      .filter((item) => item.labels.length > 0);

    expect(offenders).toEqual([]);
  });
});

describe('기존 병합 후 검사도 결정론 리포트를 통과시킨다', () => {
  it('세 가드가 전부 0 건이다', () => {
    const { report } = buildReport('1992-09-09');
    expect(findCustomerReportTextViolations(report)).toEqual([]);
    expect(findLoveReunionSafetyViolations(report)).toEqual([]);
  });
});
