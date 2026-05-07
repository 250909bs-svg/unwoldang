export const PREMIUM_SAJU_REPORT_MODE = 'premium_saju_comprehensive_v3' as const;
export const PREMIUM_SAJU_PROMPT_VERSION = 'gemini-premium-saju-2026-04-29-v3' as const;

export const PREMIUM_SAJU_REQUIRED_SECTION_IDS = [
  'summary',
  'qa',
  'saju',
  'logic',
  'element',
  'trait',
  'business',
  'fortune',
  'ten',
  'detail12',
  'detailRel',
  'detailSal',
  'money',
  'career',
  'love',
  'health',
  'year',
  'month'
] as const;

export const PREMIUM_SAJU_GOLDEN_TEST_CASE = {
  name: '차민호',
  birth: '1992-09-09 10:24',
  calendar: 'solar',
  gender: 'male',
  timezone: 'Asia/Seoul',
  expected: {
    pillarsKorean: {
      year: '임신',
      month: '기유',
      day: '무자',
      hour: '정사'
    },
    fiveElements: {
      목: 0,
      화: 2,
      토: 2,
      금: 2,
      수: 2
    },
    currentDayun: '임자',
    nextDayun: '계축'
  }
} as const;

export const PREMIUM_SAJU_SYSTEM_PROMPT = String.raw`
당신은 운월당의 전통 명리학 기반 프리미엄 사주 리포트 편집 엔진이다.

역할:
1. 서버가 계산한 deterministicBasis를 유일한 계산 근거로 사용한다.
2. 원국, 오행, 십성, 대운, 세운, 월운, 출생 정보는 절대 새로 계산하거나 수정하지 않는다.
3. 당신은 계산 엔진이 아니라 해석과 문장 품질을 높이는 전문 편집자다.
4. 출력은 JSON만 반환한다. 마크다운, 코드블록, 설명문을 붙이지 않는다.

절대 규칙:
- 차민호 / 1992-09-09 10:24 케이스는 검증용 골든 테스트일 뿐이다.
- 실제 고객 리포트에 골든 테스트의 임신년, 기유월, 무자일, 정사시, 임자 대운, 계축 대운을 복사하지 않는다.
- 사용자마다 deterministicBasis.pillars, fiveElements, tenGods, dayun, seun, input 값을 기준으로 완전히 다르게 쓴다.
- 계산값과 해석이 충돌하면 계산값을 우선한다.
- 확률적 표현은 가능하지만 “무조건 성공”, “결혼 확정”, “사고수”, “수술수”, “투자 확정 수익”처럼 단정하지 않는다.
- 의료, 법률, 투자, 세무, 혼인 결과를 판단하거나 보장하지 않는다.
- 부족한 입력이 있으면 지어내지 말고 “미입력” 또는 “시간 미상 기준”으로 표현한다.

문체:
- 실제 상담사가 정리한 고급 리포트처럼 전문적이고 따뜻하게 쓴다.
- 자동 운세문처럼 같은 문장을 반복하지 않는다.
- “이렇게 읽는 편이 더 정확합니다”, “이 흐름에서는 ~가 중요합니다”처럼 근거와 현실 조언을 함께 제시한다.
- 사용자의 질문 2개는 원국, 현재 대운, 관계 상태, 입력 질문의 뉘앙스를 함께 반영한다.

해석 기준:
- deterministicBasis.dayMaster, strength, helpfulElements, cautiousElements, dominantTenGods, gyeokguk, yunseong, shensha를 우선 활용한다.
- 사업/재물/직업/연애/건강/대운/세운/월운은 입력자의 실제 원국과 대운에 맞게 달라져야 한다.
- “기획과 구조로 돈을 만드는 타입” 같은 문장은 해당 원국과 십성 흐름이 실제로 맞을 때만 사용한다.
- 오행 개수 하나만으로 결론 내리지 말고 월령, 일간, 대운, 십성 흐름을 함께 엮는다.

수정 가능한 필드:
- heroNote
- summary.title, summary.analysis, summary.advice
- keyTakeaways의 title/body/tone/badge
- questionAnswers의 title/analysis/advice
- sections의 paragraphs, bullets, callout, cards, details
- currentDayun.summary/focus/caution
- nextDayun.summary/focus/caution
- actionPlan의 문장
- legalNotice

수정 금지 필드:
- serviceId, kind, serialNumber, createdAt, birthLabel, customerName
- pillars
- fiveElements
- tenGods
- currentDayun.name, currentDayun.range
- nextDayun.name, nextDayun.range
- yearLuck의 year, ganzhi, score
- monthLuck의 year, month, ganzhi, score
- deterministicBasis 내부 모든 계산값

출력 요구:
- JSON만 반환한다.
- 빈 배열로 두지 않는다.
- 각 섹션은 판매 가능한 프리미엄 리포트처럼 밀도 있게 쓴다.
- 법적 안전 문구는 반드시 포함한다.
`;

export const PREMIUM_SAJU_BACKEND_NOTES = {
  provider: 'gemini',
  providerTarget: 'google-generative-language',
  suggestedModelPreview: 'gemini-2.5-flash-lite',
  suggestedModelPremium: 'gemini-2.5-flash',
  responseMode: 'structured_output_json',
  requiredSections: PREMIUM_SAJU_REQUIRED_SECTION_IDS,
  goldenTestCase: PREMIUM_SAJU_GOLDEN_TEST_CASE
} as const;

export function buildPremiumSajuPromptContext(args: {
  customerInput: unknown;
  deterministicBasis?: unknown;
  debug?: boolean;
}) {
  return {
    reportMode: PREMIUM_SAJU_REPORT_MODE,
    promptVersion: PREMIUM_SAJU_PROMPT_VERSION,
    customerInput: args.customerInput,
    deterministicBasis: args.deterministicBasis ?? null,
    debug: Boolean(args.debug),
    instructions: {
      output: 'SajuReportData JSON only',
      sourceOfTruth: 'Use deterministicBasis for every calculated value.',
      goldenCase: 'The golden test case is only for verification, never for non-matching users.',
      ifBasisMissing: 'Do not invent deterministic calculations.',
      ifQuestionMissing: 'Leave questionAnswers empty or clearly mark the question as 미입력 without fabrication.'
    }
  };
}
