import type { IntakeFormData } from '../../api/mockData';
import {
  buildReunionViewModel,
  createEmptyReunionContext,
  type ReunionContactStatus,
  type ReunionContext,
  type ReunionViewModel
} from '../../lib/reunion';
import type { SajuReportData } from '../../lib/saju/report';

export type ReunionContactGuide = {
  status: 'open' | 'conditional' | 'withheld';
  title: string;
  timing: string;
  conditions: string[];
  prohibitedActions: string[];
};

export type ReunionActionGuide = {
  contact: ReunionContactGuide;
  today: string[];
  sevenDays: string[];
  thirtyDays: string[];
  sustainConditions: string[];
};

export type ReunionReportPresentation = {
  context: ReunionContext;
  viewModel: ReunionViewModel;
  actionGuide: ReunionActionGuide;
  subjectLabel: string;
  partnerLabel: string;
  sajuFacts: Array<{ label: string; value: string }>;
  timingReference: { label: string; note: string };
};

const baseProhibitedActions = [
  '답이 없는데 같은 내용으로 반복 연락하기',
  '친구나 가족을 통해 반응을 확인하기',
  '온라인 상태나 SNS 반응을 동의처럼 해석하기',
  '운세 결과를 근거로 답변이나 만남을 요구하기'
];

function buildContactGuide(status: ReunionContactStatus): ReunionContactGuide {
  if (status === 'blocked') {
    return {
      status: 'withheld',
      title: '지금은 연락을 시도하지 않는 편이 안전해요',
      timing: '상대가 직접 차단을 해제하고 연락 의사를 명확히 표현한 뒤에만 다시 판단하세요.',
      conditions: [
        '상대가 먼저 또는 명시적으로 연락을 허용했을 것',
        '안전 문제나 법적·실무적 경계가 없을 것',
        '거절을 즉시 존중할 준비가 되어 있을 것'
      ],
      prohibitedActions: ['다른 번호나 계정으로 우회 연락하기', ...baseProhibitedActions]
    };
  }

  if (status === 'active') {
    return {
      status: 'open',
      title: '연락 횟수보다 대화의 합의를 확인하세요',
      timing: '다음 차분한 대화에서 두 사람이 관계를 다시 논의할 의사가 있는지 먼저 물어보세요.',
      conditions: [
        '질문과 답변이 한쪽으로만 흐르지 않을 것',
        '이별 원인을 대화할 수 있을 것',
        '다시 만날 경우 바꿀 행동을 서로 말할 수 있을 것'
      ],
      prohibitedActions: baseProhibitedActions
    };
  }

  if (status === 'occasional') {
    return {
      status: 'conditional',
      title: '안부 연락과 재회 의사를 구분하세요',
      timing: '상대가 질문을 되돌려 주거나 다음 대화를 스스로 이어갈 때 관계 이야기를 꺼낼지 판단하세요.',
      conditions: [
        '상대가 짧은 예의 이상의 후속 대화를 보일 것',
        '대화 중 불편함이나 거절 표현이 없을 것',
        '답변을 재촉하지 않는 한 번의 제안으로 끝낼 수 있을 것'
      ],
      prohibitedActions: baseProhibitedActions
    };
  }

  if (status === 'no-contact') {
    return {
      status: 'conditional',
      title: '날짜보다 연락 허용 조건이 먼저예요',
      timing: '거절이나 차단이 없고 감정이 가라앉은 뒤, 답변을 강요하지 않는 짧은 연락 한 번만 고려하세요.',
      conditions: [
        '상대가 연락하지 말라고 말한 적이 없을 것',
        '외로움을 즉시 해소하려는 충동 연락이 아닐 것',
        '답이 없으면 더 보내지 않을 수 있을 것'
      ],
      prohibitedActions: baseProhibitedActions
    };
  }

  return {
    status: 'withheld',
    title: '연락 상태를 확인하기 전에는 행동을 보류하세요',
    timing: '상대의 경계와 현재 연락 가능 여부를 안전하게 확인한 뒤 판단하세요.',
    conditions: [
      '차단 또는 연락 거절 여부를 알고 있을 것',
      '상대의 동의를 추측이 아닌 표현으로 확인할 것',
      '거절 시 접촉을 중단할 것'
    ],
    prohibitedActions: baseProhibitedActions
  };
}

export function buildReunionActionGuide(context: ReunionContext): ReunionActionGuide {
  const contact = buildContactGuide(context.contactStatus);
  const shouldWithhold = contact.status === 'withheld';

  return {
    contact,
    today: shouldWithhold
      ? ['연락 수단을 추가로 만들지 않기', '내가 알고 있는 사실과 추측을 두 칸으로 나눠 적기']
      : ['보내고 싶은 말을 메모장에 먼저 적고 바로 전송하지 않기', '관계를 다시 원한다면 바뀌어야 할 내 행동 한 가지 적기'],
    sevenDays: [
      '상대의 실제 행동 신호를 날짜와 함께 기록하기',
      '수면·식사·일처럼 이 관계 밖의 일상을 한 가지 회복하기',
      shouldWithhold ? '연락 우회 충동이 생기면 믿을 만한 사람에게 먼저 말하기' : '연락한다면 짧게 한 번, 답변을 재촉하지 않기'
    ],
    thirtyDays: [
      '서로 이별 원인을 말하고 들을 대화가 가능한지 판단하기',
      '일관된 응답과 만남 의사가 실제로 이어졌는지 확인하기',
      '신호가 없거나 경계가 반복되면 정리를 위한 지원과 일상 계획 세우기'
    ],
    sustainConditions: [
      '이별 원인을 한 문장으로 합의하고 같은 문제가 생길 때의 대응을 정하기',
      '연락 빈도·갈등 중단 방식·개인 시간을 서로 구체적으로 합의하기',
      '사과보다 달라진 행동이 최소 몇 주간 이어지는지 확인하기',
      '통제·모욕·위협이 반복되면 재회보다 안전한 거리두기를 우선하기'
    ]
  };
}

function topTimingReference(report: SajuReportData) {
  const candidates = [...report.monthLuck].sort((left, right) => right.score - left.score);
  const top = candidates[0];

  if (!top) {
    return {
      label: report.currentDayun.range || '별도 시기 근거 없음',
      note: '전달된 계산 결과에 월별 구간이 없어 연락 시기를 특정하지 않습니다.'
    };
  }

  return {
    label: `${top.year}년 ${top.month}월 · ${top.ganzhi}`,
    note: '명리 흐름을 검토할 참고 구간일 뿐, 연락 동의나 재회를 보장하는 날짜가 아닙니다.'
  };
}

export function buildReunionReportPresentation(
  report: SajuReportData,
  formData: Partial<IntakeFormData>,
  context?: ReunionContext | null
): ReunionReportPresentation {
  const safeContext = context || createEmptyReunionContext();
  const viewModel = buildReunionViewModel({ sajuReport: report, context: safeContext });
  const fiveElementSummary = report.fiveElements
    .map((item) => `${item.label} ${item.value}`)
    .join(' · ');

  return {
    context: safeContext,
    viewModel,
    actionGuide: buildReunionActionGuide(safeContext),
    subjectLabel: (formData.name || '').trim() || report.customerName || '나',
    partnerLabel: formData.partner?.name.trim() || '상대방',
    sajuFacts: [
      { label: '본인 일간', value: `${report.dayMaster} · ${report.dayMasterElement}` },
      { label: '원국 오행', value: fiveElementSummary || '표시할 계산값 없음' },
      { label: '도움 오행', value: report.helpfulElements.join(' · ') || '판단 보류' },
      { label: '현재 대운', value: `${report.currentDayun.name} · ${report.currentDayun.range}` }
    ],
    timingReference: topTimingReference(report)
  };
}
