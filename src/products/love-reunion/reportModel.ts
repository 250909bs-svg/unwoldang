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
  'explicit-no-contact': '명시적 연락 거절·중단 요청 있음',
  'safety-risk': '폭력·협박·스토킹 등 안전 위험 있음',
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
  if (hasText(value)) {
    return value;
  }

  return hasText(fallback?.question) ? fallback.question : fallbackLabel;
}

type ReunionQuestionIntent =
  | 'contact'
  | 'letting-go'
  | 'timing'
  | 'possibility'
  | 'pattern'
  | 'general';

type SafetyRisk = 'self-harm' | 'violence' | 'both' | null;
type ContactBoundaryMode = 'none' | 'explicit-no-contact' | 'safety-risk';

const EXPLICIT_REJECTION_PATTERN =
  /(?:연락|접촉)(?:을|은|도)?\s*(?:하지\s*말|하지마|말아|그만|중단|거절)|(?:그만|다시(?:는)?).{0,8}(?:연락|접촉)|(?:명시적|분명(?:히|하게))\s*(?:거절|중단)|(?:거절|중단)\s*(?:의사|요청)/u;
const SELF_HARM_PATTERN =
  /자살|자해|극단적\s*선택|죽고\s*싶|죽어\s*버리|살기\s*싫|사라지고\s*싶|목숨을\s*끊/u;
const VIOLENCE_PATTERN =
  /데이트\s*폭력|가정\s*폭력|폭행|협박|감금|흉기|스토킹|미행|위치\s*추적|집\s*앞|직장\s*앞|죽이겠|해치겠/u;

function normalizedText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function withoutAdviceMarker(value: string): string {
  return value.replace(/^(?:\[\d{1,2}\]|\d{1,2}[.)]|[-•])\s*/u, '').trim();
}

function normalizeAdvice(value: string): string {
  return withoutAdviceMarker(normalizedText(value));
}

function formatQuestionAdvice(advice: string[]): string {
  return advice.map((item, index) => `${index + 1}. ${normalizeAdvice(item)}`).join('\n\n');
}

function questionKey(value: string): string {
  return normalizedText(value).toLocaleLowerCase('ko-KR');
}

function getDeclaredContactBoundary(context: LoveReunionContext | undefined): ContactBoundaryMode {
  const declared = (context as (LoveReunionContext & { contactBoundary?: unknown }) | undefined)
    ?.contactBoundary;

  if (declared === 'safety-risk' || declared === 'explicit-no-contact') {
    return declared;
  }

  if (context?.currentContact === 'blocked') {
    return 'explicit-no-contact';
  }

  const boundaryText = [
    context?.lastContactNote,
    context?.breakupReasonDetail,
    context?.reunionReason
  ]
    .filter(hasText)
    .join(' ');

  return EXPLICIT_REJECTION_PATTERN.test(boundaryText) ? 'explicit-no-contact' : 'none';
}

function detectSafetyRisk(...values: Array<string | undefined>): SafetyRisk {
  const combined = values.filter(hasText).join(' ');
  const selfHarm = SELF_HARM_PATTERN.test(combined);
  const violence = VIOLENCE_PATTERN.test(combined);

  if (selfHarm && violence) return 'both';
  if (selfHarm) return 'self-harm';
  if (violence) return 'violence';
  return null;
}

function mergeSafetyRisk(first: SafetyRisk, second: SafetyRisk): SafetyRisk {
  if (first === 'both' || second === 'both') return 'both';

  const hasSelfHarm = first === 'self-harm' || second === 'self-harm';
  const hasViolence = first === 'violence' || second === 'violence';

  if (hasSelfHarm && hasViolence) return 'both';
  if (hasSelfHarm) return 'self-harm';
  if (hasViolence) return 'violence';
  return null;
}

function detectQuestionIntent(question: string): ReunionQuestionIntent {
  const normalized = questionKey(question);

  if (/놓아|포기|정리|그만|끝내|기다리지/u.test(normalized)) return 'letting-go';
  if (/언제|시기|몇\s*월|타이밍/u.test(normalized)) return 'timing';
  if (/연락|메시지|문자|전화|답장|안부/u.test(normalized)) return 'contact';
  if (/재회|다시\s*만|가능|이어질|돌아올/u.test(normalized)) return 'possibility';
  if (/왜|이유|반복|갈등|다툼|패턴/u.test(normalized)) return 'pattern';
  return 'general';
}

function normalizeBaseQuestionAnswer(
  question: string,
  candidate: QuestionAnswerBlock | undefined
): QuestionAnswerBlock | null {
  if (
    !candidate ||
    !hasText(candidate.title) ||
    !hasText(candidate.analysis) ||
    !Array.isArray(candidate.advice)
  ) {
    return null;
  }

  const advice = candidate.advice.filter(hasText).map(normalizeAdvice).filter(hasText);
  if (advice.length === 0) {
    return null;
  }

  return {
    question,
    title: normalizedText(candidate.title),
    analysis: candidate.analysis.trim(),
    advice
  };
}

function findBaseQuestionAnswer(
  baseAnswers: QuestionAnswerBlock[],
  question: string,
  index: number
): QuestionAnswerBlock | undefined {
  const exactMatch = baseAnswers.find(
    (candidate) => hasText(candidate?.question) && questionKey(candidate.question) === questionKey(question)
  );

  if (exactMatch) {
    return exactMatch;
  }

  const positional = baseAnswers[index];
  return positional && hasText(positional.question) && questionKey(positional.question) === questionKey(question)
    ? positional
    : undefined;
}

function fallbackQuestionCopy(intent: ReunionQuestionIntent) {
  switch (intent) {
    case 'contact':
      return {
        title: '연락 전 확인할 세 가지 조건',
        focus: '연락 여부는 그리움의 크기가 아니라 거절·차단 여부, 무응답을 감당할 준비, 이별 원인의 실제 변화로 판단해야 합니다.',
        advice: [
          '마지막 대화에서 상대가 요청한 경계를 한 문장으로 적으세요.',
          '안부 하나만 묻고 답장 기한이나 관계 결론을 요구하지 마세요.',
          '보낸 뒤 추가 메시지를 보내지 않을 최소 7일 기준을 먼저 정하세요.',
          '답이 없거나 거절하면 다른 계정·지인·방문을 통한 접촉도 멈추세요.'
        ]
      };
    case 'letting-go':
      return {
        title: '기다림을 멈출 현실 신호',
        focus: '놓을지 여부는 마음을 추측해서가 아니라 경계 표현, 연락의 상호성, 일상 기능이 얼마나 회복되는지로 판단할 수 있습니다.',
        advice: [
          '거절·차단·반복된 무응답은 기다림을 연장할 근거가 아니라 멈춤 신호로 기록하세요.',
          'SNS 확인과 연락 충동 횟수를 일주일 동안 기록해 일상 손실을 확인하세요.',
          '상대의 변화가 아니라 내가 회복해야 할 수면·식사·업무 한 가지를 정하세요.',
          '혼자 정리하기 어렵다면 믿을 수 있는 사람이나 상담기관에 현재 상태를 공유하세요.'
        ]
      };
    case 'timing':
      return {
        title: '날짜보다 먼저 볼 접촉 조건',
        focus: '월운은 본인의 감정 여유를 점검하는 참고일 뿐 연락 날짜를 정하지 않습니다. 실제 시점은 상대의 경계와 대화 가능성이 우선입니다.',
        advice: [
          '차단·거절·중단 요청이 있다면 어떤 시기에도 먼저 접촉하지 마세요.',
          '보내지 않아도 괜찮은 상태가 될 때까지 초안을 최소 하루 보류하세요.',
          '응답이 오면 속도와 질문 수를 상대보다 빠르게 늘리지 마세요.',
          '월운 점수 대신 약속 이행과 상호적인 질문이 이어지는지를 보세요.'
        ]
      };
    case 'possibility':
      return {
        title: '재회 가능성보다 확인할 변화',
        focus: '재회는 사주 한 줄로 확정할 수 없습니다. 이전 이별 원인이 말이 아니라 반복 가능한 행동으로 달라졌는지가 핵심 조건입니다.',
        advice: [
          '이별 원인에 대해 내가 바꿀 행동과 상대가 동의해야 할 조건을 나누어 적으세요.',
          '그리움이나 사과보다 갈등 상황에서 지킬 새 규칙이 있는지 확인하세요.',
          '한 번의 다정한 답장보다 여러 번의 약속 이행과 경계 존중을 보세요.',
          '상대가 재회를 원하지 않으면 설득 대신 회복 계획으로 전환하세요.'
        ]
      };
    case 'pattern':
      return {
        title: '같은 이별을 반복하지 않을 기준',
        focus: '패턴은 누가 더 나빴는지를 가르는 대신 갈등 직전의 감정, 행동, 결과를 순서대로 복기할 때 구체적으로 보입니다.',
        advice: [
          '마지막 갈등의 시작·내 반응·상대 반응·결과를 각각 한 문장으로 적으세요.',
          '불안할 때 반복한 확답 요구, 침묵, 비난, 회피 중 해당 행동을 찾으세요.',
          '다음 갈등에서 사용할 중단 문장과 대화 재개 시간을 미리 정하세요.',
          '상대도 같은 문제를 인정하고 행동 변화에 동의하는지 직접 확인하세요.'
        ]
      };
    default:
      return {
        title: '질문을 판단할 현실 기준',
        focus: '이 질문은 상대의 속마음을 대신 결론내리기보다 지금 확인 가능한 말, 반복 행동, 경계를 기준으로 답해야 합니다.',
        advice: [
          '확인된 사실과 내가 해석한 의미를 두 칸으로 나누어 적으세요.',
          '상대의 의사를 직접 확인하지 못했다면 가능성과 확정을 구분하세요.',
          '내가 통제할 수 있는 행동 한 가지와 멈출 조건 한 가지를 정하세요.',
          '관계 결론과 별개로 오늘 회복할 일상 루틴을 실행하세요.'
        ]
      };
  }
}

function buildFallbackQuestionAnswer(
  question: string,
  index: number,
  context: LoveReunionContext | undefined,
  boundaryMode: ContactBoundaryMode
): QuestionAnswerBlock {
  const contactState = getContextValue(context, 'currentContact', '현재 연락 상태 미입력');
  const breakupElapsed = getContextValue(context, 'breakupElapsed', '이별 후 경과 미입력');
  const breakupReason = getContextValue(context, 'breakupReason', '이별 이유 미입력');
  const intentCopy = fallbackQuestionCopy(detectQuestionIntent(question));

  if (boundaryMode !== 'none') {
    return {
      question,
      title: `${index + 1}번 질문 · 지금은 경계를 지키는 것이 답입니다`,
      analysis:
        `“${normalizedText(question)}”에 앞서 현재 입력에는 접촉을 멈춰야 하는 경계 신호가 있습니다. ` +
        `현재 연락 상태는 “${contactState}”, 이별 후 경과는 “${breakupElapsed}”입니다. ` +
        '차단 해제나 마음 변화를 확인하려는 시도도 상대에게는 접촉이 될 수 있으므로, 지금은 직접·우회 접촉을 준비하지 않고 본인의 안전과 일상을 회복하는 쪽으로 답합니다.',
      advice: [
        '다른 번호·계정, 지인 전달, 집이나 직장 방문을 포함한 접촉을 멈추세요.',
        '보낼 문장을 준비하는 대신 연락처와 SNS를 보이지 않게 정리하세요.',
        '충동이 커질 때 연락할 지지자 한 명과 상담기관을 미리 정하세요.',
        '수면·식사·업무가 무너지거나 위험이 느껴지면 혼자 견디지 말고 즉시 도움을 요청하세요.',
        index === 0
          ? '첫 번째 질문의 결론을 얻기 위한 행동보다 오늘 지킬 경계 한 가지를 실행하세요.'
          : '두 번째 질문은 관계 결론 대신 이번 주 회복 변화를 기록하며 다시 점검하세요.'
      ]
    };
  }

  return {
    question,
    title: `${index + 1}번 질문 · ${intentCopy.title}`,
    analysis:
      `“${normalizedText(question)}”에 대한 답은 ${intentCopy.focus} ` +
      `현재 연락은 “${contactState}”, 이별 후 경과는 “${breakupElapsed}”, 입력한 이별 이유는 “${breakupReason}”입니다. ` +
      '이 세 가지 현실 조건을 사주 흐름보다 먼저 두고 다음 행동을 결정하세요.',
    advice: [
      ...intentCopy.advice,
      index === 0
        ? '첫 번째 질문은 오늘 확인할 사실 한 가지와 멈출 조건 한 가지로 정리하세요.'
        : '두 번째 질문은 첫 답과 겹치지 않는 별도의 행동 기준으로 일주일 뒤 점검하세요.'
    ]
  };
}

function applyQuestionSafety(
  answer: QuestionAnswerBlock,
  risk: SafetyRisk,
  boundaryMode: ContactBoundaryMode
): QuestionAnswerBlock {
  const advice = [...answer.advice];
  const combined = `${answer.analysis}\n${advice.join('\n')}`;
  let analysis = answer.analysis;

  if (risk && !combined.includes('[긴급 안전 안내]')) {
    analysis +=
      '\n\n[긴급 안전 안내] 지금은 재회나 사주 해석보다 사람 있는 안전한 장소로 이동하고 즉시 도움을 연결하는 것이 우선입니다.';
  }

  if ((risk === 'self-harm' || risk === 'both') && !combined.includes('109')) {
    advice.push('한국에서는 자살예방 상담전화 109로 바로 연락하세요. 당장 위험하면 119 또는 112에 신고하고 가까운 응급실로 가세요.');
  }

  if ((risk === 'violence' || risk === 'both') && (!combined.includes('112') || !combined.includes('1366'))) {
    advice.push('폭력·협박·스토킹 위험이 있으면 112에 신고하고, 다쳤거나 응급 상황이면 119에 연락하세요. 여성 피해자는 여성긴급전화 1366에서도 24시간 지원받을 수 있습니다.');
  }

  if (boundaryMode !== 'none' && !combined.includes('직접·우회 접촉')) {
    advice.push('현재 경계 신호가 해소될지 확인하려 하지 말고 직접·우회 접촉과 접촉 준비를 모두 멈추세요.');
  }

  return { ...answer, analysis, advice };
}

function buildQuestionAnswers(
  baseAnswers: QuestionAnswerBlock[],
  questions: string[],
  context: LoveReunionContext | undefined,
  boundaryMode: ContactBoundaryMode,
  contextRisk: SafetyRisk
): QuestionAnswerBlock[] {
  const usedAnalysis = new Set<string>();
  const usedAdvice = new Set<string>();

  return questions.map((question, index) => {
    const candidate = normalizeBaseQuestionAnswer(
      question,
      findBaseQuestionAnswer(baseAnswers, question, index)
    );
    const candidateAnalysisKey = candidate ? questionKey(candidate.analysis) : '';
    const candidateAdviceKey = candidate ? questionKey(candidate.advice.join('\n')) : '';
    const isDistinct = Boolean(
      boundaryMode === 'none' &&
      candidate &&
      !usedAnalysis.has(candidateAnalysisKey) &&
      !usedAdvice.has(candidateAdviceKey)
    );
    const selected = isDistinct && candidate
      ? candidate
      : buildFallbackQuestionAnswer(question, index, context, boundaryMode);

    usedAnalysis.add(questionKey(selected.analysis));
    usedAdvice.add(questionKey(selected.advice.join('\n')));

    return applyQuestionSafety(selected, mergeSafetyRisk(contextRisk, detectSafetyRisk(question)), boundaryMode);
  });
}

function timingPhaseLabel(score: number): string {
  if (score >= 75) return '표현 국면';
  if (score >= 60) return '조정 국면';
  if (score >= 45) return '관찰 국면';
  return '회복 국면';
}

function buildTimingDetails(base: SajuReportData, context: LoveReunionContext | undefined) {
  const lastContact = getContextValue(context, 'lastContactTiming', '마지막 연락 시점 미입력');

  return base.monthLuck.slice(0, 6).map((item) => ({
    summary: `[사주 흐름] ${item.year}년 ${item.month}월 ${item.ganzhi} · ${timingPhaseLabel(item.score)} · ${item.summary}`,
    content:
      `국면: ${timingPhaseLabel(item.score)}\n기본 해석: ${item.summary}\n점검 초점: ${item.focus}\n주의할 장면: ${item.warning}` +
      `${item.validFrom || item.validTo ? `\n적용 구간: ${item.validFrom || '미상'} ~ ${item.validTo || '미상'}` : ''}` +
      '\n\n이 정보는 본인의 감정 여유와 표현 속도를 돌아보는 참고값이며, 타인의 행동이나 관계 결과를 예고하지 않습니다.\n\n' +
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
    context.partnerDataPermissionConfirmed &&
    formData.partner?.birthDate &&
    formData.partner.birthDate.trim().length > 0
  );
  const partnerComparisonSection = hasPartnerBirth
    ? base.sections.find((section) => section.id === 'compatibility-evidence-v2') ||
      base.sections.find(
        (section) =>
          section.id === LOVE_REUNION_SECTION_IDS[2] &&
          ((section.cards?.length || 0) > 0 || (section.details?.length || 0) > 0)
      )
    : undefined;
  const partnerComparisonParagraphs =
    partnerComparisonSection?.id === LOVE_REUNION_SECTION_IDS[2]
      ? (partnerComparisonSection.paragraphs || []).filter(
          (paragraph) => !/^\[(?:사주 흐름|사용자 입력|현실 행동 신호)\]/u.test(paragraph)
        )
      : partnerComparisonSection?.paragraphs || [];
  const hasPartnerComparisonEvidence = Boolean(
    partnerComparisonSection &&
    (partnerComparisonParagraphs.length > 0 ||
      (partnerComparisonSection.cards?.length || 0) > 0 ||
      (partnerComparisonSection.details?.length || 0) > 0)
  );
  const partnerInputNote = !hasPartnerBirth
    ? '상대 생년 정보가 없거나 이용 권한이 확인되지 않아 사주 비교를 하지 않으며, 확인된 연락·약속·경계 행동만 봅니다.'
    : hasPartnerComparisonEvidence
      ? '상대 출생 정보와 이용 권한을 확인했으며, 생성된 두 원국 비교 근거를 아래에 그대로 보존했습니다.'
      : '상대 출생 정보와 이용 권한은 확인했지만 두 원국 비교 근거가 생성되지 않아, 상대의 감정 속도를 사주로 추정하지 않습니다.';
  const baseQuestionAnswers = Array.isArray(base.questionAnswers) ? base.questionAnswers : [];
  const firstQuestion = getQuestion(formData.q1, baseQuestionAnswers[0], '첫 번째 개인 질문');
  const secondQuestion = getQuestion(formData.q2, baseQuestionAnswers[1], '두 번째 개인 질문');
  const declaredBoundary = getDeclaredContactBoundary(context);
  const detectedContextRisk = detectSafetyRisk(
    context?.lastContactNote,
    context?.breakupReasonDetail,
    context?.reunionReason
  );
  const contextRisk =
    detectedContextRisk || (declaredBoundary === 'safety-risk' ? 'violence' : null);
  const questionRisk = detectSafetyRisk(firstQuestion, secondQuestion);
  const boundaryMode: ContactBoundaryMode =
    contextRisk || questionRisk ? 'safety-risk' : declaredBoundary;
  const questionAnswers = buildQuestionAnswers(
    baseQuestionAnswers,
    [firstQuestion, secondQuestion],
    context,
    boundaryMode,
    contextRisk
  );
  const timingDetails = buildTimingDetails(base, context);
  const recoveryOnly = boundaryMode !== 'none';
  const thirtyDayPriorities = recoveryOnly
    ? boundaryMode === 'safety-risk'
      ? [
          '1주차: 위험이 느껴지면 사람 있는 안전한 장소로 이동하고 112·119·1366 등 즉시 도움받을 연결망을 확보합니다.',
          '2주차: 직접·우회 시도를 모두 중단하고, 혼자 감당하지 않도록 신뢰할 사람과 전문 상담기관에 상황을 공유합니다.',
          '3주차: 수면·식사·업무 루틴을 한 가지씩 회복하고 불안과 충동이 커지는 장면을 기록합니다.',
          '4주차: 30일간 지킨 경계와 회복 변화를 점검하고 다음 달의 안전·상담·생활 계획을 세웁니다.'
        ]
      : [
          '1주차: 차단·거절·중단 요청을 최종 경계로 받아들이고 다른 번호·계정·지인·방문을 통한 시도를 멈춥니다.',
          '2주차: 연락처와 SNS 노출을 줄이고 충동이 올라오는 시간·장소·감정을 기록합니다.',
          '3주차: 수면·식사·업무 루틴을 회복하고 믿을 수 있는 사람이나 상담자에게 현재 상태를 공유합니다.',
          '4주차: 30일간 지킨 경계와 일상 변화를 점검하고 관계 결과와 무관한 다음 달 목표를 세웁니다.'
        ]
    : [
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
      paragraphs: [
        ...sourceParagraphs(
          `본인의 ${base.strengthLabel} 상태는 감정을 표현하는 속도와 회복 시간을 점검하는 참고이며, 타인의 내면을 설명하지 않습니다.`,
          partnerInputNote,
          '답장 간격, 약속 이행, 대화 중단 요청을 존중하는지를 보고 더 느린 쪽의 속도에 맞춥니다.'
        ),
        ...(hasPartnerComparisonEvidence ? partnerComparisonParagraphs : [])
      ],
      ...(hasPartnerComparisonEvidence && partnerComparisonSection?.cards?.length
        ? { cards: partnerComparisonSection.cards }
        : {}),
      ...(hasPartnerComparisonEvidence && partnerComparisonSection?.details?.length
        ? { details: partnerComparisonSection.details }
        : {}),
      ...(hasPartnerComparisonEvidence && partnerComparisonSection?.callout
        ? { callout: partnerComparisonSection.callout }
        : {})
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
      subtitle: recoveryOnly
        ? '현재 경계에서는 연락 가능성을 검토하지 않고 중단·안전 기준을 따릅니다.'
        : '접촉의 목적, 동의, 중단 기준을 먼저 세웁니다.',
      paragraphs: sourceParagraphs(
        '사주에서 보는 좋은 흐름도 접촉 권한을 만들지 않으며, 본인의 조절 가능성을 점검하는 참고로만 사용합니다.',
        `현재 연락 상태 ${currentContact}와 마지막 접촉 내용 ${lastContactNote}를 우선 기준으로 삼습니다.`,
        recoveryOnly
          ? '차단·거절·중단 요청 또는 안전 위험이 확인된 현재는 직접 연락, 다른 계정·번호, 지인 전달, 방문, 감시를 모두 멈춥니다.'
          : '짧은 안부를 한 번 보낼 수 있는 조건은 거절·차단·중단 요청이 없고 본인이 무응답을 견딜 수 있을 때입니다. 연속 메시지, 우회 연락, 감시, 주변인을 통한 압박은 금지 조건입니다.'
      )
    },
    {
      id: LOVE_REUNION_SECTION_IDS[5],
      title: '참고할 시기',
      subtitle: '월운은 내 행동과 감정 여유를 점검하는 구간으로만 사용합니다.',
      paragraphs: sourceParagraphs(
        '월운의 변화는 본인의 표현 속도와 피로를 점검하는 참고이며 타인의 접촉을 예언하지 않습니다.',
        `${lastContactTiming}에 있었던 실제 접촉과 ${breakupElapsed}의 경과 기간을 함께 봅니다.`,
        recoveryOnly
          ? '현재 확인된 경계는 모든 월운보다 우선합니다. 국면이 달라져도 연락하거나 경계 해제를 확인하는 근거로 사용하지 않습니다.'
          : '접촉 여부는 월운 국면이 아니라 직접 표현된 경계, 응답의 질, 본인의 충동 조절 가능성으로 결정합니다.'
      ),
      ...(timingDetails.length > 0 ? { details: timingDetails } : {})
    },
    {
      id: LOVE_REUNION_SECTION_IDS[6],
      title: recoveryOnly ? '경계 준수와 회복 체크리스트' : '재접촉 체크리스트와 문장 원칙',
      subtitle: recoveryOnly
        ? '상대의 경계를 확인하려 하지 않고 직접·우회 시도를 멈춥니다.'
        : '보내기 전에 목적과 경계를 확인하고 한 문장만 남깁니다.',
      paragraphs: sourceParagraphs(
        recoveryOnly
          ? '사주 흐름은 차단·거절·안전 경계를 바꾸지 않으며, 본인의 회복 리듬을 점검하는 참고로만 사용합니다.'
          : '사주 흐름은 문장의 시점을 정하는 대신 본인이 차분하게 표현할 수 있는지 점검하는 참고입니다.',
        `재접촉 이유는 “${reunionReason}”이며, 최근 연락 내용은 “${lastContactNote}”입니다.`,
        recoveryOnly
          ? '체크: 다른 번호·계정 사용 안 함 · 지인 전달 부탁 안 함 · 집이나 직장 방문 안 함 · 차단 해제 여부를 반복 확인하지 않음.'
          : '체크: 거절 신호 없음 · 무응답을 견딜 수 있음 · 답을 재촉하지 않음. 문장은 안부 하나와 응답 선택권만 남기고 사과, 원망, 관계 요구를 한번에 섞지 않습니다.'
      ),
      bullets: recoveryOnly
        ? ['다른 번호·계정 사용하지 않기', '지인에게 전달 부탁하지 않기', '집·직장에 찾아가지 않기', '불안할 때 지지자나 상담기관에 도움 요청하기']
        : ['보내기 전 하루 두기', '질문은 하나만 남기기', '답장 기한을 요구하지 않기', '무응답이면 추가 접촉을 멈추기']
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
        content: `${answer.analysis}\n\n${formatQuestionAdvice(answer.advice)}`,
        open: true
      }))
    },
    {
      id: LOVE_REUNION_SECTION_IDS[10],
      title: '30일 행동 계획',
      subtitle: recoveryOnly
        ? '연결 가능성을 검토하지 않고 내 안전·경계·일상을 회복하는 4주 계획입니다.'
        : '접촉 결과와 무관하게 내 경계와 일상을 회복하는 4주 계획입니다.',
      paragraphs: sourceParagraphs(
        '사주 흐름은 30일 동안 내 표현 속도와 피로를 점검하는 참고로만 사용합니다.',
        `현재 관계 ${relationshipState}, 이별 후 경과 ${breakupElapsed}, 현재 연락 ${currentContact}를 기준으로 행동 강도를 조절합니다.`,
        recoveryOnly
          ? '매주 경계 준수, 수면·식사·업무 루틴, 지지 관계와의 연결을 기록하며 회복 계획만 조정합니다.'
          : '매주 충동 연락 횟수, 수면·식사 루틴, 경계 준수, 지지 관계와의 연결을 기록해 다음 행동을 조정합니다.'
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
        recoveryOnly
          ? '현재 확인된 경계를 우선해 연결 가능성은 검토하지 않고 안전과 일상 회복에 집중합니다.'
          : '연결을 검토할 때는 직접 확인된 응답, 경계 존중, 이별 원인에 대한 행동 변화를 함께 봅니다.'
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
      title: recoveryOnly ? '재회운 30일 회복·안전 계획' : '재회운 30일 행동 계획',
      priorities: thirtyDayPriorities,
      dos: recoveryOnly
        ? [
            '상대가 표현한 경계를 그대로 지키기',
            '수면·식사·업무와 지지 관계 회복하기',
            '위험하거나 감당하기 어려우면 즉시 전문 도움 요청하기'
          ]
        : ['직접 확인된 말과 행동만 기록하기', '연락 전 목적과 멈출 조건을 적기', '관계 결과와 별개로 내 일상 회복을 계속하기'],
      avoids: recoveryOnly
        ? ['다른 번호·계정으로 시도하기', '지인 전달이나 집·직장 방문', 'SNS 확인·감시와 차단 해제 반복 확인']
        : ['연속 메시지와 답장 재촉', '차단 후 우회 연락', 'SNS·지인을 통한 감시나 압박'],
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
