import type {
  QuestionAnswerBlock,
  ReportSection,
  SajuReportData
} from '../../lib/saju/report';
import type { LoveReunionContext, LoveReunionFormData } from './contract';

export const LOVE_REUNION_SECTION_IDS = [
  'current-relationship',
  'repeated-pattern',
  'emotional-tempo',
  'connection-signals',
  'contact-boundaries',
  'timing-guide',
  'recontact-checklist',
  'reunion-maintenance',
  'recovery-direction',
  'personal-questions',
  'thirty-day-plan'
] as const;

const PRODUCT_NAME = '홍연아씨 재회 가능성';

const choiceLabels: Readonly<Record<string, string>> = {
  'separated-no-contact': '이별 후 연락 없음',
  'separated-contacting': '이별 후 연락 중',
  ambiguous: '관계가 애매함',
  reconnecting: '다시 연결을 확인하는 중',
  closure: '정리도 고민 중',
  'under-3-months': '3개월 미만',
  '3-to-12-months': '3개월~1년',
  '1-to-3-years': '1~3년',
  '3-to-5-years': '3~5년',
  'over-5-years': '5년 이상',
  'under-1-week': '1주 이내',
  '1-to-4-weeks': '1주~1개월',
  '1-to-3-months': '1~3개월',
  '3-to-6-months': '3~6개월',
  'over-6-months': '6개월 이상',
  today: '오늘',
  'under-1-month': '1개월 이내',
  'over-3-months': '3개월 이상',
  never: '이별 후 연락 없음',
  unknown: '기억나지 않음',
  none: '연락 없음',
  blocked: '차단 상태',
  'practical-only': '용건만 연락',
  occasional: '가끔 안부',
  friendly: '편하게 연락',
  communication: '소통 부족·회피',
  trust: '신뢰 문제',
  distance: '장거리·환경 변화',
  timing: '시기·환경 문제',
  conflict: '반복되는 다툼',
  values: '가치관·미래 방향 차이',
  other: '기타'
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function describeChoice(value: unknown, fallback: string): string {
  if (!hasText(value)) {
    return fallback;
  }

  return choiceLabels[value] || value.replace(/-/g, ' ');
}

function getContextValue(
  context: LoveReunionContext | undefined,
  key: keyof LoveReunionContext,
  fallback: string
): string {
  return describeChoice(context?.[key], fallback);
}

function getContextText(
  context: LoveReunionContext | undefined,
  key: 'lastContactNote' | 'breakupReasonDetail' | 'reunionReason',
  fallback: string
): string {
  const value = context?.[key];

  return hasText(value) ? value.trim() : fallback;
}

function sourceParagraphs(sajuFlow: string, userInput: string, behaviorSignal: string): string[] {
  return [
    `[사주 흐름] ${sajuFlow}`,
    `[사용자 입력] ${userInput}`,
    `[현실 행동 신호] ${behaviorSignal}`
  ];
}

function getQuestion(
  value: string | undefined,
  fallback: QuestionAnswerBlock | undefined,
  fallbackLabel: string
): string {
  if (typeof value === 'string') {
    return value;
  }

  return fallback?.question || fallbackLabel;
}

function buildQuestionAnswer(
  question: string,
  index: number,
  context: LoveReunionContext | undefined
): QuestionAnswerBlock {
  const contactState = getContextValue(context, 'currentContact', '현재 연락 상태 미입력');

  return {
    question,
    title: `${index + 1}번 질문 · 결과보다 조건을 먼저 확인하세요`,
    analysis:
      `[사주 흐름] 사주는 본인이 감정과 거리를 조절하기 쉬운 흐름을 참고하는 자료입니다. ` +
      `[사용자 입력] 현재 연락 상태는 “${contactState}”로 정리되었습니다. ` +
      '[현실 행동 신호] 답장 여부 하나보다 경계 존중, 일관된 대화, 이별 원인에 대한 행동 변화가 같이 확인될 때만 다음 단계를 검토하세요.',
    advice: [
      '타인의 내면을 예측하지 말고 직접 확인된 말과 행동만 기록하세요.',
      '무응답·거절·차단은 추가 접촉을 멈추라는 신호로 받아들이세요.',
      '연락 전에 “이 문장이 답을 요구하거나 압박하지 않는가”를 한 번 더 확인하세요.'
    ]
  };
}

function buildTimingDetails(base: SajuReportData, context: LoveReunionContext | undefined) {
  const lastContact = getContextValue(context, 'lastContactTiming', '마지막 연락 시점 미입력');

  return base.monthLuck.slice(0, 6).map((item) => ({
    summary: `[사주 흐름] ${item.year}년 ${item.month}월 · 내 행동 점검용 참고 구간`,
    content:
      `월운 지수 ${item.score}점은 본인의 감정 여유와 표현 속도를 돌아보는 참고값이며, 타인의 행동이나 관계 결과를 예고하지 않습니다.\n\n` +
      `[사용자 입력] ${lastContact}라는 실제 이력과 함께 보되, 특정 날짜를 접촉 시점으로 지정하지 않습니다.\n\n` +
      '[현실 행동 신호] 안전한 접촉 여부는 경계 존중, 응답의 일관성, 대화 요청에 대한 명시적 동의로 판단하세요.',
    open: false
  }));
}

export function buildLoveReunionReport(
  base: SajuReportData,
  formData: Partial<LoveReunionFormData>
): SajuReportData {
  const context = formData.reunionContext;
  const relationshipState = getContextValue(context, 'relationshipState', '현재 관계 상태 미입력');
  const relationshipLength = getContextValue(context, 'relationshipLength', '교제 기간 미입력');
  const breakupElapsed = getContextValue(context, 'breakupElapsed', '이별 후 경과 미입력');
  const lastContactTiming = getContextValue(context, 'lastContactTiming', '마지막 연락 시점 미입력');
  const lastContactNote = getContextText(context, 'lastContactNote', '마지막 연락 내용 미입력');
  const currentContact = getContextValue(context, 'currentContact', '현재 연락 여부 미입력');
  const breakupReason = getContextValue(context, 'breakupReason', '이별 이유 미입력');
  const breakupReasonDetail = getContextText(context, 'breakupReasonDetail', '추가 설명 미입력');
  const reunionReason = getContextText(context, 'reunionReason', '재접촉을 고민하는 이유 미입력');
  const hasPartnerBirth = Boolean(
    context?.partnerBirthKnown &&
    formData.partner?.birthDate &&
    formData.partner.birthDate.trim().length > 0
  );
  const partnerInputNote = hasPartnerBirth
    ? '선택 입력된 상대 출생 정보는 두 사람의 표현 속도를 비교하는 보조 참고로만 사용합니다.'
    : '상대 생년 정보가 없어도 진행할 수 있으며, 확인된 연락·약속·경계 지키기 행동으로 감정 속도를 판단합니다.';
  const firstQuestion = getQuestion(formData.q1, base.questionAnswers[0], '첫 번째 개인 질문');
  const secondQuestion = getQuestion(formData.q2, base.questionAnswers[1], '두 번째 개인 질문');
  const questionAnswers = [
    buildQuestionAnswer(firstQuestion, 0, context),
    buildQuestionAnswer(secondQuestion, 1, context)
  ];
  const timingDetails = buildTimingDetails(base, context);
  const thirtyDayPriorities = [
    '1주차: 연락하고 싶은 충동과 실제 목적을 분리하고, 이별 원인을 사실 중심으로 적습니다.',
    '2주차: 사과·원망·관계 요구를 섞지 않은 짧은 문장을 준비하고, 보내기 전 하루를 둡니다.',
    '3주차: 응답이 있다면 속도를 맞추고, 무응답·거절·차단이면 추가 접촉을 멈춥니다.',
    '4주차: 다시 만날 경우의 유지 조건과 만나지 않을 경우의 회복 계획을 각각 한 장으로 정리합니다.'
  ];

  const sections: ReportSection[] = [
    {
      id: LOVE_REUNION_SECTION_IDS[0],
      title: '현재 관계 상태',
      subtitle: '입력한 관계 이력과 현실의 경계를 먼저 정리합니다.',
      paragraphs: sourceParagraphs(
        `${base.dayMaster} 일간과 ${base.strengthLabel} 흐름은 본인의 감정 표현과 거리 조절을 돌아보는 참고입니다.`,
        `현재 관계: ${relationshipState} · 교제 기간: ${relationshipLength} · 이별 후 경과: ${breakupElapsed} · 현재 연락: ${currentContact}`,
        '직접 표현한 거절, 차단, 접촉 중단 요청은 관계 해석보다 우선하는 경계입니다.'
      )
    },
    {
      id: LOVE_REUNION_SECTION_IDS[1],
      title: '나의 반복 패턴',
      subtitle: '이별을 만든 장면과 재접촉 충동을 나누어 봅니다.',
      paragraphs: sourceParagraphs(
        `${base.currentDayun.name} 흐름은 관계의 결론보다 본인이 반복하는 대응 방식을 점검하는 참고로 사용합니다.`,
        `이별 이유: ${breakupReason} · 추가 설명: ${breakupReasonDetail} · 다시 연결을 고민하는 이유: ${reunionReason}`,
        '불안할 때 연속 메시지, 확답 요구, 과거 논쟁을 반복하는지 기록하고 멈출 조건을 미리 정합니다.'
      )
    },
    {
      id: LOVE_REUNION_SECTION_IDS[2],
      title: '두 사람의 감정 속도',
      subtitle: '내면 추정 대신 확인된 표현과 행동의 속도를 비교합니다.',
      paragraphs: sourceParagraphs(
        `본인의 ${base.strengthLabel} 상태는 감정을 표현하는 속도와 회복 시간을 점검하는 참고이며, 타인의 내면을 설명하지 않습니다.`,
        partnerInputNote,
        '답장 간격, 약속 이행, 대화 중단 요청을 존중하는지를 보고 더 느린 쪽의 속도에 맞춥니다.'
      )
    },
    {
      id: LOVE_REUNION_SECTION_IDS[3],
      title: '연결에 유리·불리한 신호',
      subtitle: '말보다 반복되는 행동으로 연결 가능성을 검토합니다.',
      paragraphs: sourceParagraphs(
        '사주 흐름은 본인의 여유와 표현 방식을 돌아보는 참고이며, 관계 결과를 판정하지 않습니다.',
        `마지막 연락: ${lastContactTiming} · ${lastContactNote} · 현재 연락: ${currentContact}`,
        '유리한 신호는 질문에 대한 직접적 응답, 약속 이행, 이별 원인에 대한 행동 변화입니다. 무응답, 조롱, 협박, 차단은 멈춤 신호입니다.'
      )
    },
    {
      id: LOVE_REUNION_SECTION_IDS[4],
      title: '연락 가능 조건과 금지 조건',
      subtitle: '접촉의 목적, 동의, 중단 기준을 먼저 세웁니다.',
      paragraphs: sourceParagraphs(
        '사주에서 보는 좋은 흐름도 접촉 권한을 만들지 않으며, 본인의 조절 가능성을 점검하는 참고로만 사용합니다.',
        `현재 연락 상태 ${currentContact}와 마지막 접촉 내용 ${lastContactNote}를 우선 기준으로 삼습니다.`,
        '짧은 안부를 한 번 보낼 수 있는 조건은 거절·차단·중단 요청이 없고 본인이 무응답을 견딜 수 있을 때입니다. 연속 메시지, 우회 연락, 감시, 주변인을 통한 압박은 금지 조건입니다.'
      )
    },
    {
      id: LOVE_REUNION_SECTION_IDS[5],
      title: '참고할 시기',
      subtitle: '월운은 내 행동과 감정 여유를 점검하는 구간으로만 사용합니다.',
      paragraphs: sourceParagraphs(
        '월운의 변화는 본인의 표현 속도와 피로를 점검하는 참고이며 타인의 접촉을 예언하지 않습니다.',
        `${lastContactTiming}에 있었던 실제 접촉과 ${breakupElapsed}의 경과 기간을 함께 봅니다.`,
        '접촉 여부는 월운 점수가 아니라 직접 표현된 경계, 응답의 질, 본인의 충동 조절 가능성으로 결정합니다.'
      ),
      ...(timingDetails.length > 0 ? { details: timingDetails } : {})
    },
    {
      id: LOVE_REUNION_SECTION_IDS[6],
      title: '재접촉 체크리스트와 문장 원칙',
      subtitle: '보내기 전에 목적과 경계를 확인하고 한 문장만 남깁니다.',
      paragraphs: sourceParagraphs(
        '사주 흐름은 문장의 시점을 정하는 대신 본인이 차분하게 표현할 수 있는지 점검하는 참고입니다.',
        `재접촉 이유는 “${reunionReason}”이며, 최근 연락 내용은 “${lastContactNote}”입니다.`,
        '체크: 거절 신호 없음 · 무응답을 견딜 수 있음 · 답을 재촉하지 않음. 문장은 안부 하나와 응답 선택권만 남기고 사과, 원망, 관계 요구를 한번에 섞지 않습니다.'
      ),
      bullets: [
        '보내기 전 하루 두기',
        '질문은 하나만 남기기',
        '답장 기한을 요구하지 않기',
        '무응답이면 추가 접촉을 멈추기'
      ]
    },
    {
      id: LOVE_REUNION_SECTION_IDS[7],
      title: '재회 후 유지 조건',
      subtitle: '다시 만나는 것보다 같은 문제를 다르게 다룰 구조가 필요합니다.',
      paragraphs: sourceParagraphs(
        '사주 흐름은 관계 유지를 보장하지 않으며, 본인이 갈등을 다루는 방식을 돌아보는 참고입니다.',
        `이별 원인 ${breakupReason}과 세부 설명 ${breakupReasonDetail}에서 바뀌어야 할 행동을 하나씩 정합니다.`,
        '유지 조건은 이별 원인에 대한 공동 인정, 갈등 중 중단 규칙, 약속·시간·경계에 대한 일관된 행동, 재발 시 멈출 기준입니다.'
      )
    },
    {
      id: LOVE_REUNION_SECTION_IDS[8],
      title: '재회하지 않을 경우의 회복 방향',
      subtitle: '관계 결과와 무관하게 수면, 일상, 사회적 연결을 회복합니다.',
      paragraphs: sourceParagraphs(
        '사주 흐름은 회복의 속도를 판정하지 않고, 본인이 돌봄에 에너지를 배분하는 방식을 돌아보는 참고로 사용합니다.',
        `${breakupElapsed}의 경과 기간과 “${reunionReason}”이라는 이유를 나누어, 관계 회복이 아닌 내 일상 회복에 필요한 요구를 찾습니다.`,
        '수면·식사·일 루틴을 먼저 회복하고, SNS 확인과 충동 연락의 횟수를 줄이며, 믿을 수 있는 사람에게 현재 상태를 공유합니다.'
      )
    },
    {
      id: LOVE_REUNION_SECTION_IDS[9],
      title: '질문 2개',
      subtitle: '입력한 질문 원문을 그대로 보존하고 조건부로 답합니다.',
      paragraphs: sourceParagraphs(
        '질문에 대한 사주 해석은 본인의 선택과 감정 조절을 돕는 참고이며 타인의 행동을 결정하지 않습니다.',
        `1. ${firstQuestion}\n2. ${secondQuestion}`,
        '두 질문 모두 직접 확인된 응답, 경계 존중, 이별 원인에 대한 행동 변화가 있을 때만 다음 선택을 검토하도록 답합니다.'
      ),
      details: questionAnswers.map((answer) => ({
        summary: answer.question,
        content: `${answer.analysis}\n\n${answer.advice.join('\n')}`,
        open: true
      }))
    },
    {
      id: LOVE_REUNION_SECTION_IDS[10],
      title: '30일 행동 계획',
      subtitle: '접촉 결과와 무관하게 내 경계와 일상을 회복하는 4주 계획입니다.',
      paragraphs: sourceParagraphs(
        '사주 흐름은 30일 동안 내 표현 속도와 피로를 점검하는 참고로만 사용합니다.',
        `현재 관계 ${relationshipState}, 이별 후 경과 ${breakupElapsed}, 현재 연락 ${currentContact}를 기준으로 행동 강도를 조절합니다.`,
        '매주 충동 연락 횟수, 수면·식사 루틴, 경계 준수, 지지 관계와의 연결을 기록해 다음 행동을 조정합니다.'
      ),
      bullets: thirtyDayPriorities
    }
  ];

  return {
    ...base,
    title: '재회운 프리미엄 리포트',
    subtitle: '사주 흐름, 사용자 입력, 현실 행동 신호를 나눠 재접촉과 회복 조건을 정리한 리포트',
    badge: '재회 조건서',
    summary: {
      title: `${base.customerName}님의 재회운 핵심 정리`,
      analysis: sourceParagraphs(
        '사주는 본인의 감정 표현과 거리 조절 흐름을 살펴보는 참고이며 관계 결과를 단정하지 않습니다.',
        `${relationshipState}, ${breakupElapsed}, ${currentContact}을 기준으로 현재 상태를 정리했습니다.`,
        '연결을 검토할 때는 직접 확인된 응답, 경계 존중, 이별 원인에 대한 행동 변화를 함께 봅니다.'
      ),
      advice: [
        '마음을 예측하기보다 직접 확인된 말과 행동을 기록하세요.',
        '거절·차단·중단 요청은 추가 접촉을 멈추라는 경계로 받아들이세요.',
        '관계가 이어지지 않아도 일상과 지지 관계를 회복하는 계획을 함께 유지하세요.'
      ]
    },
    keyTakeaways: [
      {
        title: '관계 기준',
        body: `[사용자 입력] ${relationshipState} 상태와 ${breakupElapsed}의 경과 기간을 먼저 기준으로 삼습니다.`
      },
      {
        title: '흐름 해석',
        body: '[사주 흐름] 본인의 표현·회복 속도를 점검하는 참고이며 타인의 행동을 예고하지 않습니다.',
        tone: 'good'
      },
      {
        title: '연락 경계',
        body: '[현실 행동 신호] 무응답·거절·차단·중단 요청이 있으면 추가 접촉을 멈춥니다.',
        tone: 'warn'
      },
      {
        title: '회복 계획',
        body: '[현실 행동 신호] 수면·식사·일·지지 관계의 회복을 관계 결과와 별개로 진행합니다.'
      }
    ],
    questionAnswers,
    sections,
    actionPlan: {
      title: '재회운 30일 행동 계획',
      priorities: thirtyDayPriorities,
      dos: [
        '직접 확인된 말과 행동만 기록하기',
        '연락 전 목적과 멈출 조건을 적기',
        '관계 결과와 별개로 내 일상 회복을 계속하기'
      ],
      avoids: [
        '연속 메시지와 답장 재촉',
        '차단 후 우회 연락',
        'SNS·지인을 통한 감시나 압박'
      ],
      luckyDays: [],
      unluckyDays: []
    }
  };
}

export function createLoveReunionShareData(origin: string) {
  const normalizedOrigin = origin.replace(/\/+$/, '');

  return {
    title: PRODUCT_NAME,
    text: `운월당 ${PRODUCT_NAME} 상품 소개`,
    url: `${normalizedOrigin}/detail/love-reunion`
  };
}
