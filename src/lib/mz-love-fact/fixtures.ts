import type {
  ChapterLayout,
  EvidenceTag,
  FactBombResult,
  LoveReportChapter,
  MzLoveChapterId,
  MzLoveReport,
  MzLoveSceneKey,
  RelationshipFixture,
  RelationshipStatus,
} from './types';

interface FixtureConfig {
  key: 'single' | 'situationship' | 'dating' | 'ambiguous' | 'breakup' | 'unknown-birth-time';
  label: string;
  status: RelationshipStatus;
  statusFact: string;
  primaryQuestion: string;
  birthTimeKnown: boolean;
}

const FIXTURE_CONFIGS: readonly FixtureConfig[] = [
  { key: 'single', label: '솔로 — 새로운 인연 관심', status: 'single', statusFact: '새로운 사람의 조건보다 내가 반복해서 고르는 신호부터 정리해.', primaryQuestion: '새로운 인연을 만날 때 무엇을 확인해야 하나요?', birthTimeKnown: true },
  { key: 'situationship', label: '썸 — 관계가 애매함', status: 'situationship', statusFact: '신중한 사람과 책임을 미루는 사람은 약속을 구체화하는 방식에서 달라.', primaryQuestion: '지금 썸이 관계로 이어질지 어떻게 확인하나요?', birthTimeKnown: true },
  { key: 'dating', label: '연애 중 — 장기 가능성', status: 'dating', statusFact: '오래 가는지는 감정의 크기보다 갈등 뒤에 다시 대화하는 방식에서 보여.', primaryQuestion: '지금 관계의 장기 가능성을 알고 싶어요.', birthTimeKnown: true },
  { key: 'ambiguous', label: '애매한 관계 — 기다릴 가치 판단', status: 'ambiguous', statusFact: '기다릴 가치가 있는 관계는 기다려 달라는 말 뒤에 구체적인 행동이 따라와.', primaryQuestion: '이 애매한 관계를 계속 기다려도 될까요?', birthTimeKnown: true },
  { key: 'breakup', label: '이별·재회 — 재회 또는 정리', status: 'breakup-reunion', statusFact: '다시 연락하는지보다 헤어진 원인을 바꿀 행동이 생겼는지 먼저 봐.', primaryQuestion: '재회보다 정리가 나은 관계인지 알고 싶어요.', birthTimeKnown: true },
  { key: 'unknown-birth-time', label: '출생시간 모름 — 제한 범위 안내', status: 'single', statusFact: '시주를 모르는 만큼 시기 해석은 넓게 보고, 확인 가능한 관계 행동에 더 무게를 둘게.', primaryQuestion: '태어난 시간을 몰라도 연애 패턴을 볼 수 있나요?', birthTimeKnown: false },
];

const EVIDENCE: readonly EvidenceTag[] = [
  { id: 'fixture:natal:day-master', label: '일간', value: '갑목', description: '갑목', source: 'natal-chart', sourcePath: 'fixtures.sajuSummary.dayMaster', immutable: true, confidence: 0.74 },
  { id: 'fixture:natal:day-pillar', label: '일주', value: '갑자', description: '갑자', source: 'natal-chart', sourcePath: 'fixtures.sajuSummary.pillars.day', immutable: true, confidence: 0.74 },
  { id: 'fixture:ten-god:relationship', label: '십성 분포', value: '정관·편인', description: '정관과 편인의 상대적 분포', source: 'ten-god', sourcePath: 'fixtures.sajuSummary.dominantTenGods', immutable: true, confidence: 0.7 },
];

const CHAPTER_DEFINITIONS: ReadonlyArray<{
  id: MzLoveChapterId;
  title: string;
  sceneKey: MzLoveSceneKey | null;
  layout: ChapterLayout;
  fact: string;
}> = [
  { id: 'love-self', title: '너, 연애할 때 딴사람 돼', sceneKey: 'love-self-mirror', layout: 'mirror', fact: '좋아질수록 판단보다 가능성을 오래 확인하는 편일 수 있어.' },
  { id: 'repeated-attraction', title: '왜 늘 이런 사람에게 꽂힐까', sceneKey: 'attraction-danger', layout: 'cinematic', fact: '확신을 늦게 주는 사람에게 호기심을 오래 쓰는 패턴이 있는지 봐.' },
  { id: 'attracted-partner', title: '네가 끌리는 사람', sceneKey: 'future-partner-fan', layout: 'conversation', fact: '자기 세계가 뚜렷한 분위기에 빠르게 반응할 수 있어.' },
  { id: 'lasting-partner', title: '오래 갈 사람은 따로 있어', sceneKey: 'stable-partner-signal', layout: 'cinematic', fact: '오래 갈 가능성은 관계를 명확히 하고 약속을 지키는 행동에서 확인해.' },
  { id: 'attraction-comparison', title: '끌리는 사람 vs 오래 갈 사람', sceneKey: 'attraction-vs-longevity', layout: 'comparison', fact: '강렬한 첫인상과 오래 쌓이는 안정감을 같은 기준으로 보지 마.' },
  { id: 'next-partner', title: '다음 인연에서 볼 분위기', sceneKey: 'whisper-fact', layout: 'conversation', fact: '다음 사람을 맞히기보다 책임 있게 다가오는 사람을 알아볼 기준을 세워.' },
  { id: 'meeting-scenes', title: '어디서 어떻게 시작될까', sceneKey: 'first-meeting-scene', layout: 'cinematic', fact: '대화가 한 번으로 끝나지 않는 생활 반경에서 접점을 늘려 봐.' },
  { id: 'twelve-month-timing', title: '지금부터 12개월 연애 흐름', sceneKey: 'room-corridor', layout: 'timeline', fact: '시기 신호는 사건 예언이 아니라 만남과 선택의 속도를 조절하는 참고값이야.' },
  { id: 'communication-pattern', title: '연락에서 네가 놓치는 포인트', sceneKey: 'waiting-for-message', layout: 'conversation', fact: '답장 속도보다 대화를 다시 이어가는 일관성을 확인해.' },
  { id: 'relationship-status', title: '지금 관계에 맞는 팩폭', sceneKey: 'room-consultation', layout: 'conversation', fact: '' },
  { id: 'relationship-flags', title: '레드 플래그와 그린 플래그', sceneKey: 'hero-fan-closed', layout: 'flags', fact: '말보다 약속, 경계, 갈등 뒤의 회복 행동을 같이 봐.' },
  { id: 'action-plan', title: '이번엔 이렇게 해야 안 망해', sceneKey: null, layout: 'checklist', fact: '불안을 더 해석하기보다 확인할 행동 세 가지를 정해.' },
  { id: 'final-fact', title: '마지막 팩폭', sceneKey: 'final-fact-bomb', layout: 'cinematic', fact: '네가 좋아하는지만 보지 말고, 그 사람이 관계를 실제로 만들고 있는지 봐.' },
];

const FIXTURE_INTERPRETATIONS: Partial<Record<MzLoveChapterId, string>> = {
  'love-self': '평소 판단 방식과 호감이 생긴 뒤의 반응을 나눠 보면 감정이 커질 때 달라지는 지점이 보입니다.',
  'repeated-attraction': '처음 끌린 이유와 관계가 유지된 이유를 따로 적으면 반복되는 선택의 기준을 확인할 수 있습니다.',
  'attracted-partner': '첫인상의 매력은 경향으로만 보고, 실제 관계 태도는 약속과 대화에서 다시 확인합니다.',
  'lasting-partner': '장기 가능성은 감정의 강도가 아니라 책임과 회복 행동이 쌓이는지로 점검합니다.',
  'attraction-comparison': '설렘과 안정감은 서로 다른 축이므로 같은 점수로 합치지 않고 행동 신호를 비교합니다.',
  'next-partner': '정확한 외모나 직업은 확정하지 않고 알아볼 수 있는 관계 행동만 제시합니다.',
  'meeting-scenes': '만남은 특정 장소를 예언하지 않고 대화가 이어질 가능성이 있는 생활 장면을 넓게 살핍니다.',
  'twelve-month-timing': '시기 점수는 사건의 확정값이 아니라 관계 행동의 속도를 조절하는 참고값입니다.',
  'communication-pattern': '연락 장면에서는 추측과 확인된 사실을 분리해 의사소통 습관을 점검합니다.',
  'relationship-status': '현재 관계 상태에 필요한 질문만 남기고 다른 상태의 결론은 섞지 않습니다.',
  'relationship-flags': '위험 신호와 좋은 신호를 함께 보며 불안만 키우지 않는 판단 기준을 만듭니다.',
  'action-plan': '해석을 실제 행동으로 옮길 수 있도록 중단·시작·확인 항목을 분리합니다.',
  'final-fact': '마지막 판단은 운세 문장이 아니라 서로 관계를 만들고 있는 실제 행동으로 돌아옵니다.',
};

function fixtureEvidence(id: string): readonly EvidenceTag[] {
  const chapterId = id.split(':').at(-1) as MzLoveChapterId;
  const index = CHAPTER_DEFINITIONS.findIndex((chapter) => chapter.id === chapterId);
  if (index < 0) return EVIDENCE.slice(0, 2);
  return [EVIDENCE[index % EVIDENCE.length], EVIDENCE[(index + 1) % EVIDENCE.length]];
}

function makeFact(id: string, factBomb: string, evidence = fixtureEvidence(id)): FactBombResult {
  const chapterId = id.split(':').at(-1) as MzLoveChapterId;
  return {
    id,
    factBomb,
    interpretation: FIXTURE_INTERPRETATIONS[chapterId] ?? '명리 근거는 관계 성향을 점검하는 기준이며, 한 장면만으로 사람이나 미래를 단정하지 않습니다.',
    evidence,
    realLifeScene: '연락 한 번이 늦어지면 이유를 묻기 전에 말투와 접속 시간을 여러 번 확인하는 장면으로 나타날 수 있어요.',
    counterpoint: '반대로 상대가 약속을 구체화하고 변경 뒤 대안을 꾸준히 제시한다면 단순히 표현 속도가 느린 관계일 수 있습니다.',
    checkSignal: '3주 동안 약속을 구체화하는지, 변경 뒤 대안을 제시하는지, 경계를 존중하는지 확인하세요.',
    action: '원하는 관계의 기준을 한 문장으로 말하고 상대의 실제 행동을 기록하세요.',
    characterLine: { speaker: 'mz-shaman', text: factBomb, tone: 'direct' },
  };
}

function buildFixture(config: FixtureConfig): RelationshipFixture {
  const chapters: LoveReportChapter[] = CHAPTER_DEFINITIONS.map((chapter, index) => {
    const factBomb = chapter.id === 'relationship-status' ? config.statusFact : chapter.fact;
    const result = makeFact(`${config.key}:${chapter.id}`, factBomb);
    return {
      id: chapter.id,
      order: index + 1,
      title: chapter.title,
      result,
      derivedFacts: [{ id: `${config.key}:derived:${chapter.id}`, kind: chapter.id === 'twelve-month-timing' ? 'timing' : chapter.id === 'communication-pattern' ? 'communication' : chapter.id === 'lasting-partner' ? 'stability' : 'attraction', statement: factBomb, evidence: EVIDENCE, confidence: 0.72 }],
      sceneKey: chapter.sceneKey,
      layout: chapter.layout,
      locked: false,
    };
  });
  const attractedPartner = {
    headline: '빠르게 끌릴 수 있는 분위기',
    traits: ['자기 세계가 뚜렷함', '첫 대화의 밀도가 높음', '예측하기 어려운 면이 있음'],
    earlySignals: ['대화가 빠르게 깊어짐', '강한 호기심을 자극함'],
    cautionSignals: ['말의 강도와 관계 책임을 같은 것으로 보지 않기'],
    evidence: EVIDENCE,
  };
  const lastingPartner = {
    headline: '오래 갈 가능성을 확인할 행동',
    traits: ['약속을 구체화함', '불편한 대화를 피하지 않음', '생활 리듬을 조율함'],
    earlySignals: ['변경 시 대안을 제시함', '관계의 속도를 함께 정함'],
    cautionSignals: ['평온함을 지루함으로 오해하는지 확인'],
    evidence: EVIDENCE,
  };
  const actionPlan = {
    stop: ['답장 속도 하나로 결론 내리기', '상대를 시험하려고 일부러 늦게 답하기', '합의 없는 기다림을 계속하기'],
    start: ['원하는 관계를 짧게 말하기', '말과 행동을 분리해 기록하기', '불편한 질문을 차분히 묻기'],
    check: ['약속을 구체화하는가', '변경 시 대안을 제시하는가', '경계를 존중하는가'],
    thirtyDays: [
      { week: 1 as const, title: '내 패턴 기록', task: '흔들린 장면과 실제 사실을 나눠 적기' },
      { week: 2 as const, title: '말과 행동 분리', task: '약속·연락·만남의 일관성 확인하기' },
      { week: 3 as const, title: '필요한 질문', task: '원하는 관계와 속도를 직접 묻기' },
      { week: 4 as const, title: '관계 판단', task: '계속할 기준과 멈출 기준을 적용하기' },
    ],
  };
  const report: MzLoveReport = {
    meta: { id: `fixture-${config.key}`, version: 'mz-love-fact-v1', createdAt: '2026-07-17T00:00:00.000Z', sourceReportSerial: `FIXTURE-${config.key.toUpperCase()}` },
    user: { displayName: '달님', relationshipStatus: config.status, interestedIn: 'any', birthTimeKnown: config.birthTimeKnown, primaryQuestion: config.primaryQuestion, microChoice: 'D' },
    sajuSummary: {
      sourceReportSerial: `FIXTURE-${config.key.toUpperCase()}`,
      dayMaster: '갑목',
      dayMasterElement: '목',
      strengthLabel: '중화에 가까움',
      pillars: { year: '경오', month: '을유', day: '갑자', hour: config.birthTimeKnown ? '정묘' : null },
      helpfulElements: ['수', '목'],
      cautiousElements: ['금'],
      dominantTenGods: [{ label: '정관', value: 28 }, { label: '편인', value: 22 }, { label: '식신', value: 18 }],
      birthTimeKnown: config.birthTimeKnown,
      calculationPrecision: config.birthTimeKnown ? 'exact-minute' : 'unknown',
      evidence: EVIDENCE,
      uncertainty: config.birthTimeKnown ? [] : ['출생시간 미입력으로 시주와 일부 시기 해석은 제한됩니다.'],
    },
    openingFact: makeFact(`${config.key}:opening`, '설렘의 크기보다 관계를 실제로 만드는 행동부터 볼게.'),
    loveSelf: chapters[0].result,
    repeatedPattern: chapters[1].result,
    attractedPartner,
    lastingPartner,
    attractionComparison: { attracted: attractedPartner, lasting: lastingPartner, decisiveCheck: '3주 동안 약속·연락·만남의 일관성을 비교하세요.' },
    nextPartner: lastingPartner,
    meetingScenes: ['반복해서 방문하는 생활 반경', '업무·학습·취미처럼 대화가 이어지는 자리', '신뢰할 수 있는 지인을 통한 소개'],
    twelveMonthTiming: [1, 2, 3, 4].map((quarter) => ({ id: `${config.key}:quarter:${quarter}`, periodLabel: `${quarter * 3 - 2}~${quarter * 3}개월`, temperature: 48 + quarter * 7, flow: '대화와 만남의 선택지를 조절하는 참고 구간입니다.', caution: '특정 사건이나 상대 행동을 확정하지 않습니다.', action: '접점을 한 번 늘리고 실제 반응을 기록하세요.', evidence: EVIDENCE, conditional: true as const })),
    communicationPattern: chapters[8].result,
    relationshipStatusBranch: chapters[9].result,
    redFlags: ['관계 정의를 계속 미루면서 책임도 피함', '약속 변경 뒤 대안을 제시하지 않음', '경계를 말했을 때 비난하거나 무시함'],
    greenFlags: ['말과 행동의 방향이 비슷함', '불편한 대화 뒤에도 회복을 시도함', '서로의 시간과 경계를 존중함'],
    actionPlan,
    finalFact: chapters[12].result,
    chapters,
    shareCards: ['설렘보다 행동을 본다', '평온함을 지루함으로 오해하지 않는다'],
    recommendations: ['30일 행동 플랜 저장', '말과 행동을 주 1회 비교'],
    disclaimers: [
      '이 결과는 관계 패턴을 성찰하도록 돕는 참고 콘텐츠입니다.',
      '미래 사건이나 상대의 속마음을 확정하지 않으며 실제 대화와 행동을 함께 확인하세요.',
      ...(config.birthTimeKnown ? [] : ['출생시간 미입력으로 시주와 일부 시기 해석은 제한됩니다.']),
    ],
  };
  return { key: config.key, label: config.label, report };
}

export const MZ_LOVE_RELATIONSHIP_FIXTURES: readonly RelationshipFixture[] = FIXTURE_CONFIGS.map(buildFixture);

export const MZ_LOVE_FIXTURES_BY_KEY = Object.fromEntries(
  MZ_LOVE_RELATIONSHIP_FIXTURES.map((fixture) => [fixture.key, fixture]),
) as Record<FixtureConfig['key'], RelationshipFixture>;

export function getMzLoveFixture(key: FixtureConfig['key']): RelationshipFixture {
  return MZ_LOVE_FIXTURES_BY_KEY[key];
}
