export const LOVE_REACTION_IDS = ['A', 'B', 'C', 'D'] as const;

export type LoveReactionId = (typeof LOVE_REACTION_IDS)[number];

export interface LoveReadingChapterCopy {
  readonly factBomb: string;
  readonly interpretation: string;
  readonly realLifeScene: string;
  readonly counterpoint: string;
  readonly checkSignal: string;
  readonly action: string;
}

export interface LoveReactionProfile {
  readonly id: LoveReactionId;
  readonly label: string;
  readonly response: string;
  readonly profileTitle: string;
  readonly intakeHint: string;
  readonly chapterCopy: LoveReadingChapterCopy;
}

/**
 * Canonical reaction choices shared by the love-reading landing, intake, and
 * report. Keep the A-D ids stable because persisted drafts already use them.
 */
export const LOVE_REACTION_PROFILES: readonly LoveReactionProfile[] = [
  {
    id: 'A',
    label: '“괜찮아ㅎㅎ”라고 바로 답한다',
    response: '괜찮은 척부터 하는 타입이네. 서운함보다 관계가 깨질까 봐 먼저 분위기를 지키는 편.',
    profileTitle: '분위기를 먼저 지키는 완충형',
    intakeHint: '서운해도 괜찮다고 답하며 분위기를 먼저 지키는 편',
    chapterCopy: {
      factBomb: '서운함을 바로 덮으면 관계는 조용해 보여도 네 기준이 사라질 수 있어.',
      interpretation: 'A 선택은 관계의 분위기를 지키려는 반응을 보여 줘. 괜찮다고 말하기 전에 실제 감정을 확인하면 참다가 한꺼번에 터지는 패턴을 줄일 수 있어.',
      realLifeScene: '답장이 늦거나 약속이 바뀌었을 때 바로 괜찮다고 답한 뒤, 혼자 대화 장면을 다시 떠올릴 수 있어.',
      counterpoint: '한 번 부드럽게 넘겼다고 늘 참는 사람인 것은 아니야. 필요한 순간에 기준을 말하고 조율할 수 있다면 배려가 강점이 돼.',
      checkSignal: '괜찮다고 답한 뒤에도 같은 서운함이 반복되는지, 원하는 기준을 실제로 말했는지 확인해.',
      action: '이번 주에는 자동으로 괜찮다고 답하기 전에 “나는 이 부분이 조금 서운했어”라는 한 문장을 먼저 연습해.'
    }
  },
  {
    id: 'B',
    label: '왜 늦었는지 확인한다',
    response: '확신이 없으면 바로 답을 찾으려 하고. 애매함을 오래 견디기보다 관계의 이름부터 확인하는 편.',
    profileTitle: '확실한 답을 찾는 확인형',
    intakeHint: '애매함이 생기면 이유와 관계의 방향을 바로 확인하는 편',
    chapterCopy: {
      factBomb: '답을 서두르면 필요한 질문도 대화보다 심문처럼 들릴 수 있어.',
      interpretation: 'B 선택은 애매함을 오래 두지 않으려는 반응을 보여 줘. 확인 자체보다 질문의 타이밍과 표현을 조절하는 것이 관계의 사실을 더 정확히 보는 데 도움이 돼.',
      realLifeScene: '연락 간격이 달라지면 상황을 묻는 질문이 짧은 시간에 이어지고, 답을 받기 전까지 다른 가능성을 떠올릴 수 있어.',
      counterpoint: '분명한 질문은 건강한 관계에 필요해. 상대를 몰아붙이지 않고 내가 필요한 기준을 설명한다면 확인하려는 태도가 장점이 돼.',
      checkSignal: '질문이 확인된 사실을 묻는지, 이미 정한 결론에 동의를 요구하는지 나눠 봐.',
      action: '“왜 그랬어?” 대신 “연락이 달라져서 궁금해. 지금 상황을 알려줄래?”처럼 관찰과 요청을 한 번씩만 말해.'
    }
  },
  {
    id: 'C',
    label: '나도 일부러 늦게 답한다',
    response: '상대보다 덜 좋아하는 사람처럼 보이려 하지. 마음보다 주도권을 먼저 지키려는 순간이 있어.',
    profileTitle: '주도권을 지키는 미러형',
    intakeHint: '상대의 거리만큼 나도 물러나며 마음의 균형을 맞추는 편',
    chapterCopy: {
      factBomb: '밀어내기로 균형을 맞추면 네가 원하는 관계 방식은 끝내 전달되지 않아.',
      interpretation: 'C 선택은 상처받기 전에 주도권을 지키려는 반응을 보여 줘. 상대의 행동을 그대로 되돌려 주기보다 내 기준을 직접 말해야 시험과 오해의 반복을 줄일 수 있어.',
      realLifeScene: '답장이 늦어진 것을 확인한 뒤 일부러 휴대폰을 내려놓고, 원래 보내려던 말보다 짧게 답할 수 있어.',
      counterpoint: '바로 반응하지 않고 감정을 가라앉히는 시간은 필요해. 다만 진정한 뒤에는 침묵 대신 원하는 방식을 설명해야 해.',
      checkSignal: '답장을 늦춘 이유가 내 생활을 지키기 위해서인지, 상대의 반응을 시험하기 위해서인지 확인해.',
      action: '시험하고 싶은 마음이 들면 답장 시간을 계산하지 말고, 필요한 연락 방식과 불편했던 장면을 한 문장씩 말해.'
    }
  },
  {
    id: 'D',
    label: '별 의미 없는 척하지만 계속 신경 쓴다',
    response: '겉으론 조용한데 혼자 관계를 백 번 돌려보네. 말하지 않은 가능성까지 대신 해석하는 편.',
    profileTitle: '가능성을 오래 돌려보는 해석형',
    intakeHint: '겉으로는 넘기지만 혼자 여러 가능성을 오래 생각하는 편',
    chapterCopy: {
      factBomb: '말하지 않은 가능성을 오래 돌릴수록 확인된 사실보다 네 해석이 커질 수 있어.',
      interpretation: 'D 선택은 바로 드러내기보다 상황을 충분히 해석하려는 반응을 보여 줘. 생각을 멈추라는 뜻이 아니라, 관찰한 사실과 내가 붙인 의미를 분리해야 불필요한 추측을 줄일 수 있어.',
      realLifeScene: '평소와 다른 말투 하나를 본 뒤 이전 대화를 다시 읽으며 여러 이유를 혼자 비교할 수 있어.',
      counterpoint: '천천히 생각하는 태도는 성급한 결론을 막아 줘. 일정 시간이 지난 뒤 직접 확인할 수 있다면 신중함이 강점이 돼.',
      checkSignal: '지금 떠올린 내용 가운데 직접 확인된 사실이 몇 개인지, 물어보면 알 수 있는 내용이 무엇인지 나눠 봐.',
      action: '10분 동안 사실과 해석을 두 칸으로 적은 뒤, 필요한 질문 하나만 짧게 꺼내.'
    }
  }
];

const LOVE_REACTION_PROFILE_BY_ID = new Map(
  LOVE_REACTION_PROFILES.map((profile) => [profile.id, profile] as const)
);

export function getLoveReactionProfile(value: unknown): LoveReactionProfile | null {
  return typeof value === 'string'
    ? LOVE_REACTION_PROFILE_BY_ID.get(value as LoveReactionId) ?? null
    : null;
}
