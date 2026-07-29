import type { ReunionContext, SafetyGateDecision } from './types';

export interface ReunionDraftSafetyRisk {
  code: string;
  label: string;
  critical: boolean;
  action: string;
}

type SafetyRule = {
  key: keyof ReunionContext['safety'];
  code: string;
  critical: boolean;
  action: string;
};

const SAFETY_RULES: SafetyRule[] = [
  {
    key: 'violence',
    code: 'VIOLENCE',
    critical: true,
    action: '상대와 단둘이 만나지 말고 신뢰할 수 있는 사람과 지역 전문기관에 안전 계획을 상의하세요.'
  },
  {
    key: 'threats',
    code: 'THREATS',
    critical: true,
    action: '위협 메시지와 통화 기록을 보존하고, 긴급하면 112 또는 지역 긴급기관에 도움을 요청하세요.'
  },
  {
    key: 'stalkingOrReport',
    code: 'STALKING_OR_REPORT',
    critical: true,
    action: '추가 접촉을 멈추고 신고·접근 제한 등 공식 절차를 우선하세요.'
  },
  {
    key: 'coerciveControl',
    code: 'COERCIVE_CONTROL',
    critical: true,
    action: '통제나 감시가 있었다면 재회 시도보다 독립적인 안전·법률 상담을 먼저 받으세요.'
  },
  {
    key: 'selfHarmPressure',
    code: 'SELF_HARM_PRESSURE',
    critical: true,
    action: '자해를 조건으로 관계를 요구받았다면 혼자 책임지지 말고 112·119 또는 정신건강 위기 지원에 연결하세요.'
  },
  {
    key: 'explicitNoContact',
    code: 'EXPLICIT_NO_CONTACT',
    critical: false,
    action: '상대가 철회하기 전까지 연락하지 마세요.'
  },
  {
    key: 'blockCircumventionAttempt',
    code: 'BLOCK_CIRCUMVENTION',
    critical: false,
    action: '새 번호·지인·다른 계정으로 차단을 우회하지 마세요.'
  },
  {
    key: 'disruptingNewRelationship',
    code: 'NEW_RELATIONSHIP_BOUNDARY',
    critical: false,
    action: '상대의 현재 관계를 방해하는 접촉은 중단하세요.'
  },
  {
    key: 'financialExploitation',
    code: 'FINANCIAL_EXPLOITATION',
    critical: false,
    action: '송금·투자·채무 요구에 응하지 말고 금융 기록을 정리해 전문기관에 상담하세요.'
  }
];

const unique = <T,>(values: T[]) => [...new Set(values)];

export function detectReunionDraftSafetyRisks(draft: string): ReunionDraftSafetyRisk[] {
  const text = draft.trim();
  if (!text) return [];

  const rules: Array<ReunionDraftSafetyRisk & { pattern: RegExp }> = [
    {
      code: 'DRAFT_SELF_HARM_PRESSURE',
      label: '자해·파국 압박',
      critical: true,
      action: '자해나 극단적 선택을 조건으로 답장을 요구하지 말고, 위기라면 112·119 또는 정신건강 위기 지원에 연결하세요.',
      pattern: /(?:답장|만나|돌아오).{0,18}(?:죽|자해|목숨)|(?:내가|나는|나)\s*(?:죽|자해)|살\s*수\s*없/iu
    },
    {
      code: 'DRAFT_THREAT',
      label: '위협·보복 암시',
      critical: true,
      action: '위협이나 보복을 암시하는 메시지를 보내지 말고 접촉을 중단하세요.',
      pattern: /죽여|해칠|가만\s*안\s*(?:둬|둘)|두고\s*봐|후회하게|찾아가서/iu
    },
    {
      code: 'DRAFT_BLOCK_CIRCUMVENTION',
      label: '차단·경계 우회',
      critical: false,
      action: '새 번호·다른 계정·지인을 통한 연락이나 거주지 방문을 하지 마세요.',
      pattern: /다른\s*(?:번호|계정)|(?:친구|지인).{0,12}(?:통해|부탁)|집.{0,8}(?:찾아|갈게)/iu
    }
  ];

  return rules
    .filter((rule) => rule.pattern.test(text))
    .map(({ pattern: _pattern, ...risk }) => risk);
}

export function evaluateReunionSafety(context: ReunionContext): SafetyGateDecision {
  if (!context.adultConfirmed || !context.dataUseConsent || !context.dataAuthorityConfirmed) {
    return {
      status: 'ANALYSIS_BLOCKED',
      severity: 'high',
      title: '분석을 시작할 수 없는 상태예요',
      summary: '성인 확인·민감정보 처리 동의·정보 사용 권한 확인이 모두 필요합니다.',
      reasonCodes: [
        ...(!context.adultConfirmed ? ['ADULT_NOT_CONFIRMED'] : []),
        ...(!context.dataUseConsent ? ['DATA_CONSENT_MISSING'] : []),
        ...(!context.dataAuthorityConfirmed ? ['DATA_AUTHORITY_MISSING'] : [])
      ],
      contactAdviceAllowed: false,
      timingAllowed: false,
      messageScriptAllowed: false,
      immediateActions: ['본인과 상대 정보의 사용 범위를 확인한 뒤 동의 항목을 다시 작성하세요.']
    };
  }

  const triggered = SAFETY_RULES.filter((rule) => context.safety[rule.key]);
  const draftRisks = detectReunionDraftSafetyRisks(context.messageDraft);
  const critical = triggered.filter((rule) => rule.critical);
  const criticalDraftRisks = draftRisks.filter((risk) => risk.critical);

  if (critical.length > 0 || criticalDraftRisks.length > 0) {
    return {
      status: 'ANALYSIS_BLOCKED',
      severity: 'critical',
      title: '재회 판단보다 안전이 먼저예요',
      summary: '운세·궁합과 무관하게 직접 연락과 만남 전략을 제공하지 않습니다.',
      reasonCodes: unique([
        ...critical.map((rule) => rule.code),
        ...criticalDraftRisks.map((risk) => risk.code)
      ]),
      contactAdviceAllowed: false,
      timingAllowed: false,
      messageScriptAllowed: false,
      immediateActions: unique([
        ...critical.map((rule) => rule.action),
        ...criticalDraftRisks.map((risk) => risk.action)
      ]),
      emergencyNotice: '지금 위험하거나 즉시 도움이 필요하면 대한민국 112·119 또는 현재 지역의 긴급기관에 연락하세요.'
    };
  }

  const isBlocked = context.facts.blockState === 'partner-blocked' || context.facts.blockState === 'mutual';
  const boundaryDraftRisks = draftRisks.filter((risk) => !risk.critical);
  if (triggered.length > 0 || boundaryDraftRisks.length > 0 || isBlocked) {
    return {
      status: 'CONTACT_PROHIBITED',
      severity: 'high',
      title: '지금은 연락하지 않는 것이 원칙이에요',
      summary: '상대의 경계와 현재 상황이 어떤 시기 해석보다 우선합니다.',
      reasonCodes: unique([
        ...triggered.map((rule) => rule.code),
        ...boundaryDraftRisks.map((risk) => risk.code),
        ...(isBlocked ? ['ACTIVE_BLOCK'] : [])
      ]),
      contactAdviceAllowed: false,
      timingAllowed: false,
      messageScriptAllowed: false,
      immediateActions: unique([
        ...triggered.map((rule) => rule.action),
        ...boundaryDraftRisks.map((risk) => risk.action),
        ...(isBlocked ? ['차단을 우회하지 말고 상대가 자발적으로 경계를 바꿀 때까지 접촉을 멈추세요.'] : [])
      ])
    };
  }

  const conflictRecencyUnknown =
    context.facts.lastContactMood === 'conflict' &&
    context.facts.daysSinceLastContact === null;
  const preparationReasons = [
    ...(context.facts.repeatedCause && !context.readiness.breakupCauseChanged ? ['REPEATED_CAUSE_UNCHANGED'] : []),
    ...(!context.readiness.canAcceptNoReply ? ['CANNOT_ACCEPT_NO_REPLY'] : []),
    ...(!context.readiness.accountabilityTaken ? ['ACCOUNTABILITY_NOT_READY'] : []),
    ...(!context.readiness.canRespectBoundary ? ['BOUNDARY_READINESS_LOW'] : []),
    ...(context.readiness.level !== 'ready' ? ['EMOTIONAL_READINESS_LOW'] : []),
    ...((context.facts.daysSinceLastContact ?? 999) < 7 && context.facts.lastContactMood === 'conflict'
      ? ['RECENT_CONFLICT']
      : []),
    ...(conflictRecencyUnknown ? ['CONFLICT_RECENCY_UNKNOWN'] : [])
  ];

  if (preparationReasons.length > 0) {
    return {
      status: 'PREPARATION_REQUIRED',
      severity: 'medium',
      title: '연락보다 준비가 먼저인 구간이에요',
      summary: '현재는 답장을 얻는 것보다 같은 이별 원인을 바꿀 증거를 만드는 편이 낫습니다.',
      reasonCodes: preparationReasons,
      contactAdviceAllowed: true,
      timingAllowed: false,
      messageScriptAllowed: false,
      immediateActions: [
        '이별 원인 중 내가 바꿀 수 있는 행동을 한 문장으로 정의하세요.',
        '답장이 없어도 추가 연락을 하지 않을 수 있는지 먼저 확인하세요.',
        '최소 14일 동안 변화 행동을 기록한 뒤 다시 판단하세요.'
      ]
    };
  }

  return {
    status: 'CONTACT_ELIGIBLE',
    severity: 'low',
    title: '조건부로 연락을 검토할 수 있어요',
    summary: '연락은 권리가 아니라 한 번의 제안입니다. 답이 없으면 멈추는 조건까지 포함해야 합니다.',
    reasonCodes: ['ELIGIBLE_WITH_BOUNDARIES'],
    contactAdviceAllowed: true,
    timingAllowed: true,
    messageScriptAllowed: true,
    immediateActions: [
      '목적을 재회 요구가 아닌 짧은 안부 또는 책임 있는 사과 중 하나로 제한하세요.',
      '한 번 보낸 뒤 최소 7일은 추가 메시지를 보내지 마세요.'
    ]
  };
}
