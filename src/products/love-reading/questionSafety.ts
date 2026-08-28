export interface LoveReadingQuestionSafetyCopy {
  readonly title: string;
  readonly message: string;
  readonly actions: readonly string[];
}
export type LoveReadingQuestionSafetyClassification = 'crisis' | 'relationship-decision' | 'unknown';


/** High-confidence self-harm phrases that should never be interpreted as love advice. */
export const LOVE_READING_CRISIS_PATTERN =
  /살기싫|죽고싶|자살|자해|죽어버|차라리죽는게|죽을것같|목숨(?:을)?끊|(?:나|나자신|내몸|내자신|제몸|제자신|저|저자신|자신|자기자신|몸|본인|스스로)(?:을|를)?해치고싶|왜살(?:아|지)?|살이유|사는이유|살아야할이유|(?:그냥|영원히|세상에서)사라지고싶|극단(?:적인?)?(?:선택|생각)/;

const LOVE_READING_LIFE_CONTEXT_PATTERN =
  /(?:인생|삶|목숨|생명|세상|모든것|모든걸|전부)(?:을|를|은|는|도|만)?[^.!?]{0,12}(?:끝내고싶|포기하고싶|그만두고싶)|(?:끝내고싶|포기하고싶|그만두고싶)[^.!?]{0,12}(?:인생|삶|목숨|생명|세상|모든것|모든걸|전부)/;

const LOVE_READING_RELATIONSHIP_DECISION_PATTERN =
  /(?:관계|연애|썸|만남|사이|결혼|약속|연락)(?:을|를|은|는|도|만)?[^.!?]{0,12}(?:끝내고싶|포기하고싶|그만두고싶)|(?:끝내고싶|포기하고싶|그만두고싶)[^.!?]{0,12}(?:관계|연애|썸|만남|사이|결혼|약속|연락)|(?:상대|연인)(?:을|를)?[^.!?]{0,12}(?:극단적으로)?밀어내/;

const LOVE_READING_TOTAL_ABANDONMENT_PATTERN =
  /(?:그냥|이제|정말|너무)?다(?:포기하고싶|끝내고싶|그만두고싶)/;

/**
 * Fixed safety copy: it intentionally contains no name, chart interpretation,
 * relationship advice, or generated text.
 */
export const LOVE_READING_CRISIS_SAFETY_COPY: LoveReadingQuestionSafetyCopy = {
  title: '지금은 연애 해석보다 안전이 먼저예요.',
  message: '이 질문은 혼자 견디지 않아도 되는 위기 신호예요. 운세로 이유나 미래를 단정하지 않고, 지금 바로 사람과 연결하는 일을 먼저 안내할게요.',
  actions: [
    '혼자 있지 말고 가까운 사람에게 “나 지금 혼자 있으면 위험해. 함께 있어줘”라고 바로 알려 주세요.',
    '술, 약, 칼, 끈, 높은 곳, 차 키처럼 자신을 다치게 할 수 있는 물건이나 장소에서 즉시 떨어져 주세요.',
    '한국에서는 자살예방 상담전화 109로 연락해 주세요. 지금 당장 위험하면 119 또는 112로 바로 전화해 주세요.',
    '해외에 있다면 현지 응급번호로 연락하거나 가까운 응급실로 바로 가 주세요.',
    '다음 10분 동안은 혼자 결론 내리지 말고, 위 연락 중 하나가 실제로 연결될 때까지 가까운 사람과 함께 있어 주세요.'
  ]
};

export function classifyLoveReadingQuestionSafety(
  question: unknown
): LoveReadingQuestionSafetyClassification {
  if (typeof question !== 'string') return 'unknown';

  const normalized = question.normalize('NFKC').toLowerCase().replace(/\s/g, '');

  if (
    LOVE_READING_CRISIS_PATTERN.test(normalized)
    || LOVE_READING_LIFE_CONTEXT_PATTERN.test(normalized)
  ) {
    return 'crisis';
  }

  if (LOVE_READING_RELATIONSHIP_DECISION_PATTERN.test(normalized)) {
    return 'relationship-decision';
  }

  return LOVE_READING_TOTAL_ABANDONMENT_PATTERN.test(normalized)
    ? 'crisis'
    : 'unknown';
}

export function getLoveReadingQuestionSafety(
  question: unknown
): LoveReadingQuestionSafetyCopy | null {
  return classifyLoveReadingQuestionSafety(question) === 'crisis'
    ? LOVE_READING_CRISIS_SAFETY_COPY
    : null;
}
