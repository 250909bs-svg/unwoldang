import type { MonthLuckItem } from '../saju/report';
import type {
  ReunionChoice,
  ReunionContactWindow,
  ReunionIntakeData,
  ReunionMessageReview,
  ReunionPlanPhase,
  ReunionReplyBranch,
  SafetyGateDecision,
  SafetyGateStatus
} from './types';
import { detectReunionDraftSafetyRisks } from './safetyGate';

const clamp = (value: number) => Math.min(100, Math.max(0, Math.round(value)));
const unique = <T,>(values: T[]) => [...new Set(values)];

function monthRange(item: MonthLuckItem) {
  if (item.validFrom && item.validTo) {
    const formatter = new Intl.DateTimeFormat('ko-KR', {
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Seoul'
    });
    return formatter.format(new Date(item.validFrom)) + ' ~ ' +
      formatter.format(new Date(item.validTo));
  }
  return item.year + '년 ' + item.month + '월';
}

export function buildReunionChoices(status: SafetyGateStatus): ReunionChoice[] {
  const recoveryChoice: ReunionChoice = {
    id: 'NO_CONTACT',
    label: status === 'ANALYSIS_BLOCKED' ? '접촉을 멈추고 안전 지원 받기' : '연락하지 않고 회복하기',
    recommendation:
      status === 'ANALYSIS_BLOCKED' || status === 'CONTACT_PROHIBITED' ? 'REQUIRED' : 'SECONDARY',
    upside: '상대의 경계와 내 회복을 동시에 보호합니다.',
    downside: '미해결 감정은 별도의 정리 과정과 지지 체계가 필요합니다.',
    requirements: ['차단 우회 금지', '지인 통한 탐문 금지', '지지 인물 한 명 확보'],
    stopConditions: ['안전 위험 발생 시 즉시 전문기관 연결']
  };

  if (status === 'ANALYSIS_BLOCKED' || status === 'CONTACT_PROHIBITED') {
    return [recoveryChoice];
  }

  if (status === 'PREPARATION_REQUIRED') {
    return [
      {
        id: 'WAIT',
        label: '비접촉으로 준비하기',
        recommendation: 'PRIMARY',
        upside: '감정이 아니라 바뀐 행동을 만들 시간을 확보합니다.',
        downside: '기한 없는 기다림은 불안을 키우므로 회복 점검일이 필요합니다.',
        requirements: ['14일 회복 점검', '이별 원인 변화 기록', 'SNS 확인 빈도 제한'],
        stopConditions: ['일상 기능 저하', '집착적 확인', '상대 경계 침해 충동']
      },
      recoveryChoice
    ];
  }

  return [
    {
      id: 'CONTACT_NOW',
      label: '지금 한 번 연락하기',
      recommendation: 'PRIMARY',
      upside: '한 번의 저압 제안으로 현재 온도를 실제 행동에서 확인할 수 있습니다.',
      downside: '무응답을 견디지 못하거나 원인이 그대로면 압박으로 느껴질 수 있습니다.',
      requirements: ['연락 목적 한 가지', '한 번만 전송', '무응답 시 멈춤', '차단·거부 없음'],
      stopConditions: ['명시적 거절', '차단', '위협·모욕', '두 번째 무응답']
    },
    {
      id: 'WAIT',
      label: '준비하며 기다리기',
      recommendation: 'SECONDARY',
      upside: '감정이 아니라 바뀐 행동을 만들 시간을 확보합니다.',
      downside: '기한 없는 기다림은 불안을 키우므로 점검일이 필요합니다.',
      requirements: ['14일 점검일', '이별 원인 변화 기록', 'SNS 확인 빈도 제한'],
      stopConditions: ['일상 기능 저하', '집착적 확인', '상대 경계 침해 충동']
    },
    recoveryChoice
  ];
}

export function buildReunionContactWindows(
  input: ReunionIntakeData,
  selfMonths: MonthLuckItem[],
  partnerMonths: MonthLuckItem[] | null,
  safety: SafetyGateDecision
): ReunionContactWindow[] {
  if (
    safety.status !== 'CONTACT_ELIGIBLE' ||
    !safety.timingAllowed ||
    detectReunionDraftSafetyRisks(input.reunion.messageDraft).length > 0
  ) return [];

  return selfMonths
    .map((month) => {
      const partner = partnerMonths?.find(
        (item) => item.year === month.year && item.month === month.month
      );
      return {
        month,
        partner,
        score: partner
          ? clamp(month.score * 0.55 + partner.score * 0.45)
          : clamp(month.score * 0.72)
      };
    })
    .filter((item) => item.score >= 52)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map((item, index) => {
      const rank = (index + 1) as 1 | 2 | 3;
      const purpose =
        input.reunion.desiredOutcome === 'apology' && index > 0
          ? 'APOLOGY'
          : 'LIGHT_CHECK_IN';
      const firstLine =
        purpose === 'APOLOGY'
          ? '갑작스러운 연락이면 미안해. 지난 일에서 내가 책임질 부분을 돌아봤어.'
          : (input.partner?.name?.trim() || '안녕') +
            ', 갑작스러운 연락이면 미안해. 부담 없는 안부만 전하고 싶었어.';
      return {
        id: 'contact-window-' + rank,
        rank,
        range: monthRange(item.month),
        sourceMonth:
          item.month.year + '.' + String(item.month.month).padStart(2, '0') +
          ' ' + item.month.ganzhi,
        score: item.score,
        purpose,
        channel: '상대가 마지막으로 편안하게 사용했던 1개 채널',
        lengthGuide: '3문장 이내 · 질문은 1개 이하',
        firstLine,
        waitAfterSending: '최소 7일 · 추가 재촉 금지',
        evidenceIds: unique([
          'saju:self-structure',
          ...(item.partner ? ['saju:compatibility-overview'] : []),
          'behavior:readiness'
        ]),
        cautions: [
          '절기 월운을 비교한 넓은 검토 창이며 특정 날짜의 결과를 보장하지 않습니다.',
          '상대가 거절하거나 차단했다면 이 창은 즉시 무효입니다.'
        ]
      };
    });
}

export function buildReunionMessageReview(
  input: ReunionIntakeData,
  allowed: boolean
): ReunionMessageReview {
  const draft = input.reunion.messageDraft.trim();
  const riskRules = [
    { pattern: /답장\s*해|왜\s*(씹|무시)|당장/iu, label: '답장 압박' },
    { pattern: /죽|살\s*수\s*없|끝내/iu, label: '자해·파국 암시' },
    { pattern: /마지막\s*기회|후회할|두고\s*봐/iu, label: '위협 또는 최후통첩' },
    { pattern: /다른\s*(번호|계정)|친구.*통해|집.*찾/iu, label: '경계 우회' },
    { pattern: /너도\s*아직|분명.*사랑|운명/iu, label: '상대 마음 단정' }
  ];
  const riskFlags = unique([
    ...detectReunionDraftSafetyRisks(draft).map((risk) => risk.label),
    ...riskRules
      .filter((rule) => rule.pattern.test(draft))
      .map((rule) => rule.label)
  ]);
  const blockingDraftRisks = detectReunionDraftSafetyRisks(draft);

  if (!allowed || blockingDraftRisks.length > 0) {
    return {
      originalProvided: Boolean(draft),
      riskFlags,
      recommendedChannel: '제공하지 않음',
      lengthGuide: '안전 게이트에 따라 연락 문장을 만들지 않습니다.',
      firstLine: '',
      revisedMessage: '',
      doNotSend: ['차단 우회 연락', '반복 연락', '상대를 압박하는 사과']
    };
  }

  const firstLine =
    input.reunion.desiredOutcome === 'apology'
      ? '갑작스러운 연락이면 미안해. 지난 일에서 내가 책임질 부분을 돌아봤어.'
      : '갑작스러운 연락이면 미안해. 부담 없는 안부만 전하고 싶었어.';
  return {
    originalProvided: Boolean(draft),
    riskFlags,
    recommendedChannel: '마지막 대화에서 서로 사용했던 1개 채널',
    lengthGuide: '90자 안팎 · 3문장 · 질문 1개 이하',
    firstLine,
    revisedMessage: firstLine + ' 답하지 않아도 괜찮아. 네 경계를 존중할게.',
    doNotSend: ['답장을 요구하는 문장', '상대 마음을 단정하는 문장', '경계를 우회하는 문장']
  };
}

export function buildReunionReplyTree(): ReunionReplyBranch[] {
  return [
    {
      id: 'no-reply',
      signal: '7일 동안 답이 없음',
      interpretation: '대화를 열 의사가 확인되지 않음',
      response: '추가 메시지를 보내지 않습니다.',
      wait: '종료',
      stop: true
    },
    {
      id: 'closed',
      signal: '“잘 지내”처럼 짧고 닫힌 답',
      interpretation: '예의 있는 종료 신호일 수 있음',
      response: '감사만 전하고 마칩니다.',
      wait: '종료',
      stop: true
    },
    {
      id: 'neutral-question',
      signal: '안부를 되묻는 답',
      interpretation: '가벼운 대화는 허용됨',
      response: '안부만 짧게 답하고 관계 이야기는 꺼내지 않습니다.',
      wait: '24시간',
      stop: false
    },
    {
      id: 'warm',
      signal: '과거 이야기를 먼저 꺼냄',
      interpretation: '대화 온도가 올라온 행동 단서',
      response: '해석하지 말고 그때 느낀 점을 한 번 묻습니다.',
      wait: '12~24시간',
      stop: false
    },
    {
      id: 'accepts-apology',
      signal: '사과를 받아들임',
      interpretation: '용서는 재회 동의와 다름',
      response: '감사만 전하고 즉시 재회를 요구하지 않습니다.',
      wait: '48시간',
      stop: false
    },
    {
      id: 'meeting',
      signal: '상대가 먼저 만남을 제안',
      interpretation: '대화 의사가 행동으로 확인됨',
      response: '낮 시간·공공장소·60분 이내로 제안합니다.',
      wait: '일정 합의',
      stop: false
    },
    {
      id: 'angry',
      signal: '화·비난·위협이 담긴 답',
      interpretation: '대화 지속이 해로울 수 있음',
      response: '논쟁하지 않고 연락을 종료합니다.',
      wait: '종료',
      stop: true
    },
    {
      id: 'no-contact',
      signal: '연락하지 말라고 명시함',
      interpretation: '명확한 경계',
      response: '확인 후 영구적으로 중단합니다.',
      wait: '종료',
      stop: true
    }
  ];
}

export function buildReunionPlans(status: SafetyGateStatus): {
  plan30: ReunionPlanPhase[];
  plan90: ReunionPlanPhase[];
} {
  if (status === 'ANALYSIS_BLOCKED') {
    return {
      plan30: [
        {
          range: '지금',
          goal: '안전 확보와 지원 연결',
          actions: ['직접 접촉과 단둘이 만나는 계획 중단', '신뢰할 수 있는 사람 또는 지역 전문기관에 상황 공유'],
          evidenceToObserve: ['현재 장소와 통신 수단이 안전한지', '긴급 지원에 연결할 사람이 있는지'],
          stopRules: ['즉시 위험하면 분석을 계속하지 말고 112·119 또는 현재 지역 긴급기관에 연락']
        }
      ],
      plan90: []
    };
  }
  if (status === 'CONTACT_PROHIBITED') {
    return {
      plan30: [
        {
          range: '1~7일',
          goal: '비접촉 경계 보존',
          actions: ['차단·거절을 그대로 존중', '새 번호·다른 계정·지인을 통한 우회 수단 제거'],
          evidenceToObserve: ['우회 접촉 없이 하루를 보냈는지', '상대 동향 확인 행동이 줄었는지'],
          stopRules: ['접근·감시 충동이 커지면 지지 인물이나 전문 상담에 즉시 연결']
        },
        {
          range: '8~30일',
          goal: '내 일상 회복',
          actions: ['수면·식사·업무 루틴 복구', '감정 기록과 상담·지지 체계 유지'],
          evidenceToObserve: ['SNS 확인 빈도 감소', '관계와 무관한 일상 목표 회복'],
          stopRules: ['위협·폭력·자해 압박 신호가 있으면 혼자 대응하지 않고 긴급 지원 연결']
        }
      ],
      plan90: []
    };
  }
  if (status === 'PREPARATION_REQUIRED') {
    return {
      plan30: [
        {
          range: '1~14일',
          goal: '감정 안정과 책임 정리',
          actions: ['이별 원인에서 내가 바꿀 행동 한 가지 정의', '수면·식사·업무 루틴 회복'],
          evidenceToObserve: ['불안할 때 상대 확인 대신 사용할 대안 행동', '거절과 무응답을 받아들일 수 있는지'],
          stopRules: ['경계 침해 충동이 생기면 혼자 결정하지 않고 지지 인물과 점검']
        },
        {
          range: '15~30일',
          goal: '변화 행동 유지',
          actions: ['정의한 변화 행동을 매일 기록', '상담·지지 체계와 주 1회 점검'],
          evidenceToObserve: ['같은 갈등 상황에서 달라진 반응', 'SNS 확인 빈도와 집착 감소'],
          stopRules: ['일상 기능이 무너지거나 위험 신호가 생기면 회복·안전 지원 우선']
        }
      ],
      plan90: []
    };
  }
  const contactAllowed = status === 'CONTACT_ELIGIBLE';
  return {
    plan30: [
      {
        range: '1~7일',
        goal: '감정과 행동 분리',
        actions: ['연락 충동의 계기 기록', '이별 원인을 내 행동 한 가지로 번역'],
        evidenceToObserve: ['수면·식사·업무 회복', '무응답을 견딜 수 있는지'],
        stopRules: ['차단 우회 충동이면 계획 중단', '위협·폭력 신호는 전문 지원 연결']
      },
      {
        range: '8~14일',
        goal: '변화의 증거 만들기',
        actions: ['바뀐 행동을 7일 유지', '지지 인물에게 계획 공유'],
        evidenceToObserve: ['갈등 상황의 달라진 반응', 'SNS 확인 횟수 감소'],
        stopRules: ['불안이 일상을 무너뜨리면 회복 지원 우선']
      },
      {
        range: '15~30일',
        goal: contactAllowed ? '한 번의 저압 연락 판단' : '비접촉 회복 점검',
        actions: contactAllowed
          ? ['안전 게이트 재확인', '3문장 검토', '무응답 시 종료 약속']
          : ['비접촉 유지', '관계에서 배운 경계 기준 정리'],
        evidenceToObserve: ['상대의 직접적 경계', '변화가 30일 유지되는지'],
        stopRules: ['거절·차단·무응답이면 추가 접촉 금지']
      }
    ],
    plan90: [
      {
        range: '31~45일',
        goal: '관계 규칙 검증',
        actions: ['연락 빈도·갈등 중단 방식·개인 시간 합의'],
        evidenceToObserve: ['말과 행동의 일치', '약속 변경 뒤 복구'],
        stopRules: ['통제·감시·모욕이 재발하면 관계 논의 중단']
      },
      {
        range: '46~60일',
        goal: '현실 장벽 점검',
        actions: ['거리·일·가족·돈 중 가장 큰 한 가지 구체화'],
        evidenceToObserve: ['실행 가능한 일정', '일방만 희생하지 않는지'],
        stopRules: ['핵심 조건을 회피하면 재회 속도 늦추기']
      },
      {
        range: '61~90일',
        goal: '지속 여부 결정',
        actions: ['같은 원인이 줄었는지 점검', '유지·재조정·종료 합의'],
        evidenceToObserve: ['갈등 뒤 회복 시간', '경계 존중', '상호 책임'],
        stopRules: ['변화가 말에만 머물면 과거 관계 복원 중단']
      }
    ]
  };
}
