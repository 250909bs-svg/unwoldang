import {
  type LoveReadingFocus,
  type LoveReadingRelationshipDuration,
  type LoveReadingRelationshipStatus
} from './intakeContract';
import {
  getLoveReactionProfile,
  type LoveReactionId,
  type LoveReadingChapterCopy
} from './reactionProfiles';

export const LOVE_READING_PERSONALIZATION_CHAPTER_IDS = [
  'love-self',
  'repeated-attraction',
  'attracted-partner',
  'lasting-partner',
  'attraction-comparison',
  'next-partner',
  'meeting-scenes',
  'twelve-month-timing',
  'communication-pattern',
  'relationship-status',
  'relationship-flags',
  'action-plan',
  'final-fact'
] as const;

export type LoveReadingPersonalizationChapterId =
  (typeof LOVE_READING_PERSONALIZATION_CHAPTER_IDS)[number];

export interface LoveReadingMonthLuckInput {
  readonly year: number;
  readonly month: number;
  readonly score: number;
}

export interface LoveReadingChartPersonalizationInput {
  readonly dayMaster?: string | null;
  readonly dayMasterElement?: string | null;
  readonly strengthLabel?: string | null;
  readonly pillars?: {
    readonly year?: string | null;
    readonly month?: string | null;
    readonly day?: string | null;
    readonly hour?: string | null;
  } | null;
  readonly helpfulElements?: readonly string[];
  readonly cautiousElements?: readonly string[];
  readonly dominantTenGods?: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  readonly tenGods?: ReadonlyArray<{ readonly label: string; readonly value: number }>;
  readonly monthLuck?: readonly LoveReadingMonthLuckInput[];
  readonly birthTimeKnown?: boolean;
  readonly calculationPrecision?: string | null;
}

export interface LoveReadingReportPersonalizationContext {
  readonly relationshipStatus: LoveReadingRelationshipStatus;
  readonly relationshipDuration?: LoveReadingRelationshipDuration | '' | null;
  readonly loveReaction: LoveReactionId;
  readonly loveFocus: LoveReadingFocus;
  readonly chart?: LoveReadingChartPersonalizationInput | null;
}

export interface LoveReadingThirtyDayMission {
  readonly week: 1 | 2 | 3 | 4;
  readonly title: string;
  readonly task: string;
}

export interface LoveReadingPersonalizedActionPlan {
  readonly stop: readonly string[];
  readonly start: readonly string[];
  readonly check: readonly string[];
  readonly thirtyDays: readonly LoveReadingThirtyDayMission[];
}

export type LoveReadingCalculationBasisKind =
  | 'intake-answer'
  | 'calculated-chart'
  | 'calculated-timing';

/**
 * Presentation-only trace of the inputs used to choose personalized copy.
 * This is deliberately not an EvidenceTag and must never be attached to
 * generated prose as immutable deterministic evidence. Exact EvidenceTags
 * remain owned by the saju adapter and keep their original source path/value.
 */
export interface LoveReadingCalculationBasis {
  readonly kind: LoveReadingCalculationBasisKind;
  readonly field: string;
  readonly label: string;
  readonly value: string;
  readonly scope: string;
}

export type LoveReadingCalculationBasisByChapter = Readonly<
  Record<LoveReadingPersonalizationChapterId, readonly LoveReadingCalculationBasis[]>
>;

export interface LoveReadingReportPersonalization {
  readonly redFlags: readonly string[];
  readonly greenFlags: readonly string[];
  readonly actionPlan: LoveReadingPersonalizedActionPlan;
  readonly chapterCopyOverrides: Readonly<
    Partial<Record<LoveReadingPersonalizationChapterId, LoveReadingChapterCopy>>
  >;
  readonly calculationBasisByChapter: LoveReadingCalculationBasisByChapter;
}

interface StatusProfile {
  readonly label: string;
  readonly red: string;
  readonly green: string;
  readonly weekTask: string;
  readonly copy: LoveReadingChapterCopy;
}

const STATUS_PROFILES: Record<LoveReadingRelationshipStatus, StatusProfile> = {
  single: {
    label: '솔로',
    red: '외로운 날의 강한 호감을 관계 적합성으로 바로 해석하기',
    green: '호감과 별개로 약속·경계·대화의 일관성을 확인하는 행동',
    weekTask: '새 만남에서 원하는 관계 기준을 한 문장으로 정하고 실제 행동과 비교하기',
    copy: {
      factBomb: '지금은 누가 나타날지보다 어떤 관계를 선택할지 기준을 세울 때야.',
      interpretation: '외로운 순간의 선택과 오래 원하는 관계의 기준을 나눠 보는 것이 중요해.',
      realLifeScene: '강하게 다가오는 사람이 생기면 약속과 경계를 확인하기 전에 특별한 의미를 붙일 수 있어.',
      counterpoint: '호감이 빨라도 상대가 약속을 구체화하고 네 속도를 존중한다면 천천히 알아갈 수 있어.',
      checkSignal: '설렌 정도와 약속·연락·경계 존중이 이어진 정도를 따로 기록해.',
      action: '새 접점을 하나 열고 세 번의 만남 동안 말보다 반복되는 행동을 확인해.'
    }
  },
  situationship: {
    label: '썸·관계 확인 중',
    red: '연락은 이어지지만 다음 약속과 관계 방향은 계속 흐려지는 상태',
    green: '다음 약속과 원하는 관계의 방향을 서로 구체적인 말로 확인하는 행동',
    weekTask: '원하는 관계 방향과 다음 약속을 직접 묻고 답을 행동으로 확인하기',
    copy: {
      factBomb: '썸은 연락량보다 다음 약속과 관계 방향이 함께 선명해질 때 앞으로 가.',
      interpretation: '애매함을 오래 해석하기보다 두 사람이 원하는 속도와 관계를 말로 확인해야 해.',
      realLifeScene: '연락은 자주 하지만 주말 약속이나 관계 방향을 물으면 대화가 흐려질 수 있어.',
      counterpoint: '표현이 조심스러워도 만남을 이어 가고 중요한 질문에 답한다면 천천히 깊어지는 관계일 수 있어.',
      checkSignal: '연락량과 별개로 다음 약속, 경계, 원하는 관계를 같은 뜻으로 말할 수 있는지 봐.',
      action: '이번 주 안에 “나는 우리를 더 알아가고 싶은데 너는 어때?”라고 짧게 확인해.'
    }
  },
  dating: {
    label: '연애 중',
    red: '갈등 뒤 대화를 닫고 회복 행동 없이 같은 장면을 반복하는 상태',
    green: '갈등 뒤에도 대화를 다시 열고 같은 문제가 줄어들도록 함께 조정하는 행동',
    weekTask: '반복 갈등 하나의 원인·필요한 변화·확인 날짜를 함께 정하기',
    copy: {
      factBomb: '사귀는 이름보다 갈등 뒤에도 관계를 다시 여는 행동이 오래 갈 기준이야.',
      interpretation: '애정 표현의 크기보다 약속, 경계, 갈등 뒤 회복 방식의 반복을 살펴봐야 해.',
      realLifeScene: '다툰 뒤 한쪽만 먼저 수습하거나 같은 약속이 계속 지켜지지 않는 장면이 쌓일 수 있어.',
      counterpoint: '갈등이 있어도 서로 인정하고 대안을 만들며 같은 문제가 줄어든다면 회복 가능한 관계일 수 있어.',
      checkSignal: '사과의 말 뒤에 행동이 달라지는지, 불편한 대화를 두 사람이 다시 여는지 봐.',
      action: '반복된 갈등 하나의 원인, 필요한 변화, 확인할 날짜를 함께 정해.'
    }
  },
  ambiguous: {
    label: '애매한 관계',
    red: '기다려 달라는 말은 있지만 기다림의 기간과 다음 행동은 합의되지 않은 상태',
    green: '기다릴 기간과 그 안에 확인할 행동을 분명하게 합의하는 태도',
    weekTask: '기다릴 기간과 그 안에 확인할 행동을 분명하게 합의하기',
    copy: {
      factBomb: '기다릴 가치는 말이 아니라 기다림의 끝과 다음 행동이 있는지로 확인해.',
      interpretation: '가능성을 대신 해석하기보다 기다릴 기간과 그 안에 볼 행동을 정해야 해.',
      realLifeScene: '기다려 달라는 말 뒤에 날짜나 약속이 없어도 관계가 달라질 이유를 혼자 만들 수 있어.',
      counterpoint: '시간이 필요해도 이유와 기간을 설명하고 약속을 지킨다면 조율 중인 관계일 수 있어.',
      checkSignal: '기다림의 기간, 다음 대화 날짜, 서로 지킬 경계가 구체적인지 확인해.',
      action: '기다릴 수 있는 기간과 필요한 행동을 한 문장으로 말하고 정한 날에 실제 변화를 봐.'
    }
  },
  'breakup-reunion': {
    label: '이별·재회 고민',
    red: '그리움 때문에 헤어진 원인이 달라졌는지 확인하지 않고 다시 시작하기',
    green: '연락 여부보다 헤어진 원인을 바꿀 구체적인 행동을 먼저 확인하는 태도',
    weekTask: '헤어진 원인과 달라져야 할 행동, 다시 멈출 기준을 각각 적기',
    copy: {
      factBomb: '다시 연락하는지보다 헤어진 원인을 바꿀 행동이 생겼는지 먼저 봐.',
      interpretation: '그리움과 재시작의 조건을 나눠야 같은 문제를 반복할 가능성을 줄일 수 있어.',
      realLifeScene: '외로운 날의 연락 하나가 이전 갈등이 해결됐다는 신호처럼 크게 느껴질 수 있어.',
      counterpoint: '두 사람이 원인을 구체적으로 인정하고 다른 행동을 합의한다면 대화를 다시 검토할 수 있어.',
      checkSignal: '연락의 온도보다 이전 문제를 바꿀 구체적인 말과 행동이 있는지 봐.',
      action: '헤어진 원인, 필요한 변화, 다시 멈출 기준을 각각 적어.'
    }
  },
  married: {
    label: '기혼',
    red: '생활·돈·가사·가족 경계를 말하지 않은 채 한 사람만 계속 감당하는 상태',
    green: '생활 책임과 감정 노동을 나누고 정기적으로 합의를 다시 확인하는 행동',
    weekTask: '돈·가사·가족·휴식 가운데 한 영역의 역할을 다시 합의하기',
    copy: {
      factBomb: '오래 함께했다는 사실보다 생활 책임과 감정 노동이 지금도 나뉘는지 봐.',
      interpretation: '애정의 크기를 추측하기보다 돈, 가사, 가족, 휴식의 합의가 실제로 작동하는지 확인해야 해.',
      realLifeScene: '한 사람이 일정과 집안일, 가족 연락을 계속 기억하면서 당연한 역할처럼 넘길 수 있어.',
      counterpoint: '역할이 달라도 서로의 부담을 알고 정기적으로 조정한다면 안정적인 협력이 될 수 있어.',
      checkSignal: '보이지 않는 일까지 누가 맡고, 힘들 때 어떻게 다시 나누는지 봐.',
      action: '생활 책임 네 가지와 각자의 휴식 시간을 적어 한 번 다시 합의해.'
    }
  }
};

const DURATION_LABELS: Record<LoveReadingRelationshipDuration, string> = {
  under1: '1년 미만',
  under3: '1년 이상 3년 이하',
  under5: '3년 이상 5년 이하',
  under10: '5년 이상 10년 이하'
};

const FOCUS_PROFILES: Record<LoveReadingFocus, {
  readonly label: string;
  readonly red: string;
  readonly green: string;
  readonly weekTask: string;
  readonly chapterId: LoveReadingPersonalizationChapterId;
  readonly copy: LoveReadingChapterCopy;
}> = {
  'partner-type': {
    label: '끌리는 타입과 오래 갈 타입',
    red: '강한 첫인상과 오래 갈 관계 행동을 같은 기준으로 채점하기',
    green: '끌린 이유와 편안했던 이유를 나눠 약속·회복·경계를 비교하는 행동',
    weekTask: '끌림·약속·회복·경계 네 칸을 비교해 오래 볼 관계 기준 정하기',
    chapterId: 'attraction-comparison',
    copy: {
      factBomb: '끌리는 사람과 오래 갈 사람은 같은 기준으로 고르지 않아도 돼.',
      interpretation: '첫인상의 설렘과 관계를 지키는 행동을 두 축으로 나눠 보면 선택 기준이 선명해져.',
      realLifeScene: '한 사람에게는 긴장감이, 다른 사람에게는 약속을 걱정하지 않아도 되는 편안함이 느껴질 수 있어.',
      counterpoint: '강한 끌림과 안정적인 행동이 함께 보인다면 둘 중 하나만 선택할 필요는 없어.',
      checkSignal: '끌림, 약속, 갈등 뒤 회복, 경계 존중을 각각 따로 기록해.',
      action: '세 번의 만남 동안 설렌 정도와 편안했던 정도를 두 칸으로 비교해.'
    }
  },
  'next-love-timing': {
    label: '12개월 연애 흐름',
    red: '흐름이 좋다는 달을 특정 사건이나 상대 행동의 보장으로 받아들이기',
    green: '월별 흐름을 만남과 대화의 속도를 조절하는 참고값으로 사용하는 태도',
    weekTask: '월 1회 흐름을 확인하며 접점을 늘릴 때와 속도를 늦출 때 구분하기',
    chapterId: 'twelve-month-timing',
    copy: {
      factBomb: '12개월 흐름은 사건 예고표가 아니라 관계 행동의 속도를 조절하는 참고선이야.',
      interpretation: '월별 점수는 만남을 넓힐 때와 천천히 확인할 때를 나누며 특정 인연이나 사건을 보장하지 않아.',
      realLifeScene: '움직임이 좋은 달에는 접점을 늘리고 피로가 큰 달에는 답을 재촉하지 않을 수 있어.',
      counterpoint: '좋은 흐름이어도 실제 약속과 경계가 불분명하면 기다릴 이유가 자동으로 생기지 않아.',
      checkSignal: '이어진 대화, 지켜진 약속, 내 마음의 편안함을 매달 함께 봐.',
      action: '월 1회 연락·만남·회복 행동을 돌아보고 다음 달의 관계 속도를 정해.'
    }
  },
  'my-attraction': {
    label: '내 매력이 드러나는 장면',
    red: '상대의 한 번의 반응으로 내 매력과 관계 가치를 결론 내리기',
    green: '내 표현 방식과 실제로 존중받은 행동을 분리해 살펴보는 태도',
    weekTask: '내 표현이 자연스러운 장면과 존중받은 행동을 모아 다음 만남 기준 정하기',
    chapterId: 'love-self',
    copy: {
      factBomb: '네 매력은 한 사람의 반응이 아니라 네 표현과 관계 태도가 살아나는 장면에서 봐야 해.',
      interpretation: '매력은 상대의 속마음을 맞히는 값이 아니라 내가 편안하게 표현하고 경계를 지키는 상황을 찾는 기준이야.',
      realLifeScene: '관심 있는 주제로 말할 때 표정과 리액션이 자연스러워지고 대화가 편하게 이어질 수 있어.',
      counterpoint: '누군가의 반응이 작다고 네 매력이 부족한 것은 아니며 취향과 상황에 따라 반응은 달라질 수 있어.',
      checkSignal: '대화가 편했던 장면과 내 의견을 존중받은 장면을 함께 떠올려.',
      action: '내가 자연스럽게 말할 수 있는 반복 모임이나 활동 한 곳에 참여해.'
    }
  },
  'repeated-pattern': {
    label: '반복되는 연애 패턴',
    red: '익숙한 설렘을 잘 맞는 관계의 증거로 자동 해석하기',
    green: '비슷한 장면에서 이번에는 다른 질문과 경계를 적용하는 행동',
    weekTask: '익숙한 신호가 보인 장면에 새 질문 하나와 경계 하나 적용하기',
    chapterId: 'repeated-attraction',
    copy: {
      factBomb: '사람은 달라도 네가 오래 붙잡는 신호가 같다면 결말도 비슷해질 수 있어.',
      interpretation: '반복 패턴은 정해진 결말이 아니라 익숙한 신호에 같은 반응을 해 온 과정을 점검하는 장이야.',
      realLifeScene: '확신을 늦게 주는 사람이 가끔 강한 표현을 하면 이전의 불안을 잊는 장면이 반복될 수 있어.',
      counterpoint: '약속과 대화가 점점 구체적으로 이어진다면 이전과 같은 패턴으로 단정할 필요는 없어.',
      checkSignal: '이전 관계에서 강하게 끌린 신호와 힘들어진 신호가 겹치는지 봐.',
      action: '익숙한 신호가 보일 때 이번에는 질문 하나와 경계 하나를 다르게 적용해.'
    }
  }
};

const REACTION_RED: Record<LoveReactionId, string> = {
  A: '서운함을 숨기느라 원하는 기준을 말하지 않고 괜찮다고만 답하기',
  B: '확인되지 않은 상황에 답을 재촉하며 이미 정한 결론을 확인받으려 하기',
  C: '상대를 시험하려고 일부러 연락을 늦추거나 같은 방식으로 밀어내기',
  D: '직접 확인할 내용까지 혼자 여러 가능성으로 오래 해석하기'
};

const REACTION_GREEN: Record<LoveReactionId, string> = {
  A: '분위기를 배려하면서도 서운함과 필요한 기준을 짧게 말하는 태도',
  B: '관찰한 사실과 궁금한 점을 나눠 한 번에 하나씩 묻는 태도',
  C: '감정을 가라앉힌 뒤 시험 대신 원하는 방식을 말하는 태도',
  D: '사실과 해석을 분리한 뒤 확인할 질문 하나를 직접 꺼내는 태도'
};

const ATTRACTION_BY_ELEMENT: Readonly<Record<string, string>> = {
  목: '자기 방향과 성장 계획이 분명한 분위기',
  화: '표현이 선명하고 관계의 온도를 빠르게 높이는 분위기',
  토: '생활 리듬이 안정적이고 신뢰를 천천히 쌓는 분위기',
  금: '기준과 말이 분명하고 약속을 깔끔하게 다루는 분위기',
  수: '대화의 결이 깊고 쉽게 단정되지 않는 분위기'
};

const CAUTION_BY_ELEMENT: Readonly<Record<string, string>> = {
  목: '약속과 경계를 확인하기 전에 관계의 속도를 올리는 장면',
  화: '초반 표현의 열기를 장기 합의로 바로 받아들이는 장면',
  토: '익숙함을 지키느라 불편한 문제를 계속 미루는 장면',
  금: '정답을 빨리 정하려다 두 사람의 속도를 함께 묻지 않는 장면',
  수: '가능성을 오래 해석하느라 확인 질문을 늦추는 장면'
};

const ACTION_BY_ELEMENT: Readonly<Record<string, string>> = {
  목: '서로의 다음 계획을 함께 구체화하는 행동',
  화: '감정과 감사를 표현하되 같은 반응을 강요하지 않는 행동',
  토: '시간·연락·생활 약속을 작은 것부터 꾸준히 지키는 행동',
  금: '관계의 기준과 경계를 분명하고 존중 있게 합의하는 행동',
  수: '감정을 재촉하지 않고 질문과 경청으로 맥락을 확인하는 행동'
};

function first(values?: readonly string[]): string | null {
  return values?.find((value) => value.trim())?.trim() ?? null;
}

function topTenGod(chart?: LoveReadingChartPersonalizationInput | null) {
  const values = chart?.dominantTenGods ?? chart?.tenGods ?? [];
  return [...values]
    .filter((item) => item.label.trim() && Number.isFinite(item.value))
    .sort((left, right) => right.value - left.value)[0] ?? null;
}

function statusCopy(context: LoveReadingReportPersonalizationContext): LoveReadingChapterCopy {
  const profile = STATUS_PROFILES[context.relationshipStatus];
  const duration = context.relationshipDuration
    ? ' · ' + DURATION_LABELS[context.relationshipDuration]
    : '';
  return {
    ...profile.copy,
    interpretation: profile.label + duration + ' 응답에서는 ' + profile.copy.interpretation
  };
}

function chartOverrides(chart?: LoveReadingChartPersonalizationInput | null) {
  const element = chart?.dayMasterElement?.trim();
  const dominant = topTenGod(chart);
  const helpful = first(chart?.helpfulElements);
  if (!element && !dominant && !helpful) return {};
  const label = [
    element ? element + ' 일간' : null,
    dominant ? dominant.label + ' 분포' : null
  ].filter((value): value is string => Boolean(value)).join('과 ')
    || '원국의 일간·십성 분포';
  const attraction = element
    ? ATTRACTION_BY_ELEMENT[element] ?? '자기 기준이 분명한 분위기'
    : '자기 기준이 분명한 분위기';
  const stableAction = helpful
    ? ACTION_BY_ELEMENT[helpful] ?? '말과 행동의 일관성을 확인하는 행동'
    : '말과 행동의 일관성을 확인하는 행동';
  return {
    'attracted-partner': {
      factBomb: label + '을 출발점으로 보면 ' + attraction + '에 반응하는지 점검해 볼 수 있어.',
      interpretation: '명리 신호는 취향을 확정하는 답이 아니라 첫인상에서 크게 보는 분위기를 돌아보는 기준이야.',
      realLifeScene: attraction + '을 만났을 때 아직 확인하지 않은 부분까지 매력으로 채워 볼 수 있어.',
      counterpoint: '첫인상이 강해도 실제 관계 태도는 약속, 회복, 경계 존중을 따로 확인해야 해.',
      checkSignal: '끌린 이유와 실제로 지켜진 약속을 두 칸으로 나눠 봐.',
      action: '첫인상에 결론 내리기 전에 세 번의 만남에서 태도가 같은지 확인해.'
    },
    'lasting-partner': {
      factBomb: (helpful ? '도움 기운 ' + helpful : '원국의 균형 신호') + '를 행동으로 옮기면 ' + stableAction + '이 오래 갈 기준이 돼.',
      interpretation: '도움 기운은 특정 사람을 예고하지 않고 안정적인 관계에서 확인할 행동 기준으로 번역했어.',
      realLifeScene: '약속이 바뀔 때 설명으로 끝내지 않고 대안을 함께 정하는 장면에서 안정감을 확인할 수 있어.',
      counterpoint: '표현이 다정해도 중요한 질문과 책임을 계속 피한다면 장기 신호로 보기 어려워.',
      checkSignal: '세 주 동안 약속, 갈등 뒤 회복, 경계 존중이 반복되는지 봐.',
      action: stableAction + '을 관찰 기준 한 가지로 정해.'
    }
  } satisfies Partial<Record<LoveReadingPersonalizationChapterId, LoveReadingChapterCopy>>;
}

function buildActionPlan(
  context: LoveReadingReportPersonalizationContext
): LoveReadingPersonalizedActionPlan {
  const reaction = getLoveReactionProfile(context.loveReaction);
  const status = STATUS_PROFILES[context.relationshipStatus];
  const focus = FOCUS_PROFILES[context.loveFocus];
  const helpful = first(context.chart?.helpfulElements);
  const helpfulAction = helpful
    ? ACTION_BY_ELEMENT[helpful] ?? '말과 행동을 차분히 비교하는 행동'
    : '말과 행동을 차분히 비교하는 행동';
  return {
    stop: [REACTION_RED[context.loveReaction], status.red, chartRed(context.chart)],
    start: [REACTION_GREEN[context.loveReaction], status.green, helpfulAction],
    check: [
      '말과 실제 행동이 같은 방향으로 반복되는가',
      '불편한 질문 뒤에도 대화를 이어 가고 대안을 만드는가',
      focus.green
    ],
    thirtyDays: [
      {
        week: 1,
        title: reaction?.profileTitle ?? '내 반응 기록',
        task: reaction?.chapterCopy.checkSignal ?? '감정과 확인된 사실을 나눠 적기'
      },
      {
        week: 2,
        title: helpful ? '도움 기운 ' + helpful + ' 행동화' : '말과 행동 비교',
        task: helpfulAction + '을 실제 장면에서 확인하기'
      },
      { week: 3, title: status.label + ' 관계 대화', task: status.weekTask },
      { week: 4, title: focus.label + ' 선택', task: focus.weekTask }
    ]
  };
}

function chartRed(chart?: LoveReadingChartPersonalizationInput | null) {
  const cautious = first(chart?.cautiousElements);
  return cautious
    ? '주의 기운 ' + cautious + '이 관계에서 과해질 때 점검할 장면: '
      + (CAUTION_BY_ELEMENT[cautious] ?? '한 반응만으로 관계 전체를 판단하는 장면')
    : '확인된 행동보다 한 번의 말이나 분위기로 관계 전체를 판단하는 장면';
}

function chartGreen(chart?: LoveReadingChartPersonalizationInput | null) {
  const helpful = first(chart?.helpfulElements);
  return helpful
    ? '도움 기운 ' + helpful + '을 옮긴 행동: '
      + (ACTION_BY_ELEMENT[helpful] ?? '관계의 말과 행동을 비교하는 태도')
    : '말과 행동이 같은 방향으로 반복되는지 충분한 기간 확인하는 태도';
}

function makeBasis(
  kind: LoveReadingCalculationBasisKind,
  field: string,
  label: string,
  value: string,
  scope: string
): LoveReadingCalculationBasis {
  return { kind, field, label, value, scope };
}

function calculationBasis(
  context: LoveReadingReportPersonalizationContext
): LoveReadingCalculationBasisByChapter {
  const chart = context.chart;
  const dominant = topTenGod(chart);
  const reactionProfile = getLoveReactionProfile(context.loveReaction);
  const status = [
    makeBasis('intake-answer', 'relationshipStatus', '관계 상태', STATUS_PROFILES[context.relationshipStatus].label, '관계 상태별 문구 선택'),
    ...(context.relationshipDuration ? [
      makeBasis('intake-answer', 'relationshipDuration', '관계 기간', DURATION_LABELS[context.relationshipDuration], '연애 중·기혼 맥락 보완')
    ] : [])
  ];
  const reaction = [
    makeBasis(
      'intake-answer',
      'loveReaction',
      '연락 반응',
      reactionProfile?.profileTitle ?? '연락 반응 선택',
      '연락 패턴과 1주차 행동 선택'
    )
  ];
  const focus = [
    makeBasis('intake-answer', 'loveFocus', '관심 주제', FOCUS_PROFILES[context.loveFocus].label, '강조 장과 4주차 행동 선택')
  ];
  const natal = [
    ...(chart?.dayMaster?.trim() ? [
      makeBasis('calculated-chart', 'chart.dayMaster', '일간', chart.dayMaster.trim(), '끌림 점검의 출발점')
    ] : []),
    ...(chart?.dayMasterElement?.trim() ? [
      makeBasis('calculated-chart', 'chart.dayMasterElement', '일간 오행', chart.dayMasterElement.trim(), '끌림 분위기의 조건부 설명')
    ] : []),
    ...(chart?.pillars?.day?.trim() ? [
      makeBasis('calculated-chart', 'chart.pillars.day', '일주', chart.pillars.day.trim(), '원국 맥락 표시 전용')
    ] : [])
  ];
  const tenGod = dominant ? [
    makeBasis('calculated-chart', 'chart.dominantTenGods', '상위 십성', dominant.label + ':' + String(dominant.value), '상대 분포 점검')
  ] : [];
  const balance = [
    ...(chart?.strengthLabel?.trim() ? [
      makeBasis('calculated-chart', 'chart.strengthLabel', '신강약', chart.strengthLabel.trim(), '관계 속도 보조값')
    ] : []),
    ...(chart?.helpfulElements?.length ? [
      makeBasis('calculated-chart', 'chart.helpfulElements', '도움 기운', chart.helpfulElements.join('·'), '장기 행동과 2주차 실천')
    ] : []),
    ...(chart?.cautiousElements?.length ? [
      makeBasis('calculated-chart', 'chart.cautiousElements', '주의 기운', chart.cautiousElements.join('·'), '위험 장면 점검')
    ] : [])
  ];
  const timing = [
    ...(chart?.monthLuck?.length ? [
      makeBasis(
        'calculated-timing',
        'chart.monthLuck',
        '12개월 월운 점수',
        chart.monthLuck.slice(0, 12)
          .map((item) => String(item.year) + '-' + String(item.month) + ':' + String(item.score))
          .join('|'),
        '행동 속도 참고값이며 사건을 보장하지 않음'
      )
    ] : []),
    ...(typeof chart?.birthTimeKnown === 'boolean' ? [
      makeBasis('calculated-chart', 'chart.birthTimeKnown', '출생시간 확인', String(chart.birthTimeKnown), '세부 시기 범위 제한')
    ] : []),
    ...(chart?.calculationPrecision?.trim() ? [
      makeBasis('calculated-chart', 'chart.calculationPrecision', '계산 정밀도', chart.calculationPrecision.trim(), '시기 제한 표시')
    ] : [])
  ];
  const clone = (...groups: ReadonlyArray<readonly LoveReadingCalculationBasis[]>) =>
    groups.flatMap((group) => group).map((item) => ({ ...item }));
  return {
    'love-self': clone(reaction, natal, focus),
    'repeated-attraction': clone(reaction, focus, balance),
    'attracted-partner': clone(natal, tenGod, reaction),
    'lasting-partner': clone(balance, status),
    'attraction-comparison': clone(natal, tenGod, balance, focus),
    'next-partner': clone(natal, balance, status),
    'meeting-scenes': clone(focus, balance),
    'twelve-month-timing': clone(timing, focus),
    'communication-pattern': clone(reaction, tenGod),
    'relationship-status': clone(status),
    'relationship-flags': clone(status, reaction, balance),
    'action-plan': clone(status, reaction, focus, balance),
    'final-fact': clone(status, reaction, focus)
  };
}

export function buildLoveReadingReportPersonalization(
  context: LoveReadingReportPersonalizationContext
): LoveReadingReportPersonalization {
  const reaction = getLoveReactionProfile(context.loveReaction);
  const focus = FOCUS_PROFILES[context.loveFocus];
  return {
    redFlags: [
      STATUS_PROFILES[context.relationshipStatus].red,
      REACTION_RED[context.loveReaction],
      focus.red,
      chartRed(context.chart)
    ],
    greenFlags: [
      STATUS_PROFILES[context.relationshipStatus].green,
      REACTION_GREEN[context.loveReaction],
      focus.green,
      chartGreen(context.chart)
    ],
    actionPlan: buildActionPlan(context),
    chapterCopyOverrides: {
      ...chartOverrides(context.chart),
      'relationship-status': statusCopy(context),
      ...(reaction ? { 'communication-pattern': reaction.chapterCopy } : {}),
      [focus.chapterId]: focus.copy
    },
    calculationBasisByChapter: calculationBasis(context)
  };
}
