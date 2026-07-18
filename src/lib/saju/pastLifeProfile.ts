import type { IntakeFormData } from '../../api/mockData';
import type { FiveElement, PastLifePortrait, PastLifeProfile, SajuReportData } from './report';

type PastLifeInput = Pick<
  Partial<IntakeFormData>,
  | 'name'
  | 'gender'
  | 'birthDate'
  | 'pastLifeTopic'
  | 'repeatedScene'
  | 'frequentEmotion'
  | 'hiddenDesire'
  | 'chosenSymbol'
  | 'readingTone'
>;

type ArchetypeSeed = {
  sealName: string;
  archetype: string;
  eraMood: string;
  place: string;
  vocation: string;
  keepsake: string;
  selfAppearance: string[];
  attire: string;
  gaze: string;
  openingLine: string;
};

const ARCHETYPES: Record<FiveElement, ArchetypeSeed> = {
  목: {
    sealName: '길을 숨긴 문지기',
    archetype: '금지된 길과 사람의 이름을 기억하던 문지기',
    eraMood: '왕조가 바뀌기 직전, 오래된 길과 새 길이 맞닿던 시절',
    place: '산성 아래 역참과 약초 시장 사이의 좁은 기록소',
    vocation: '통행패와 서신을 확인하고 길 잃은 사람을 다음 고을로 잇던 안내관',
    keepsake: '닳은 나무 열쇠',
    selfAppearance: ['길게 뻗은 눈매', '곧은 눈썹과 마른 얼굴선', '조용하지만 빠른 걸음'],
    attire: '먹빛 도포 위에 짙은 청록 띠를 매고, 허리에는 나무 열쇠를 달았습니다.',
    gaze: '사람의 얼굴보다 그가 향하는 길을 먼저 읽는 눈빛',
    openingLine: '남들이 길을 묻기 전에, 너는 이미 그 사람이 어디서 헤맸는지 알고 있었지.'
  },
  화: {
    sealName: '불을 감춘 기록관',
    archetype: '사라질 이름과 약속을 밤새 베껴 쓰던 기록관',
    eraMood: '도성의 불빛과 전란의 연기가 같은 하늘에 머물던 시절',
    place: '성문 안쪽 관청 뒤편, 등불이 새벽까지 꺼지지 않던 문서고',
    vocation: '계약과 탄원, 실종자의 이름을 정리하던 야간 기록관',
    keepsake: '그을린 청동 등잔',
    selfAppearance: ['빛을 오래 품은 눈동자', '선명한 입술과 빠른 표정', '가늘지만 단단한 손가락'],
    attire: '검붉은 안감을 댄 먹빛 한복과 소매를 묶는 황동 고리를 착용했습니다.',
    gaze: '한 번 본 거짓말의 온도를 잊지 않는 뜨거운 눈빛',
    openingLine: '불은 문서를 태웠지만, 네가 외운 이름까지 지우지는 못했어.'
  },
  토: {
    sealName: '무너진 터를 지킨 사람',
    archetype: '떠난 사람들의 집과 약속을 끝까지 지키던 터지기',
    eraMood: '큰 물난리 뒤 마을이 다시 세워지던 느린 복구의 시절',
    place: '강둑과 장터 사이, 사람들이 맡긴 물건을 보관하던 돌창고',
    vocation: '곡식과 품삯을 나누고 분쟁의 경계를 정하던 창고지기',
    keepsake: '금이 간 황동 인장',
    selfAppearance: ['반듯한 이마와 단정한 얼굴선', '넓고 안정된 어깨', '느리지만 흔들리지 않는 손'],
    attire: '흙빛 저고리 위에 검은 덧옷을 걸치고, 품 안에는 황동 인장을 넣었습니다.',
    gaze: '누가 끝까지 남을 사람인지 오래 지켜보는 묵직한 눈빛',
    openingLine: '모두가 떠난 뒤에도 너는 문을 잠그지 않았지. 돌아올 사람의 몫을 남겨두려고.'
  },
  금: {
    sealName: '이름을 새긴 재판관',
    archetype: '말보다 증거를 믿고 억울한 이름을 바로잡던 판관',
    eraMood: '상업이 번성해 계약과 배신이 함께 늘어나던 도성의 시절',
    place: '시장 끝 종루 아래, 붉은 봉인이 쌓인 작은 심문청',
    vocation: '빚과 계약의 진위를 가리고 판결문을 새기던 실무 판관',
    keepsake: '붉은 실이 감긴 은제 칼집',
    selfAppearance: ['차갑게 정돈된 눈매', '날렵한 턱선과 곧은 콧날', '흐트러짐 없는 자세'],
    attire: '검은 관복에 빛바랜 은장식을 달고, 손목에는 붉은 실 한 가닥을 감았습니다.',
    gaze: '호의보다 말의 앞뒤를 먼저 맞춰보는 맑고 서늘한 눈빛',
    openingLine: '너는 거짓을 잘라낼 수 있었지만, 사랑하는 사람의 변명만은 끝내 자르지 못했어.'
  },
  수: {
    sealName: '밤길을 건넌 전령',
    archetype: '아무도 건너지 못한 밤물길로 소식을 옮기던 전령',
    eraMood: '달빛과 봉화만으로 먼 고을의 안부를 이어야 했던 시절',
    place: '강과 바다가 만나는 포구, 검은 돛배가 쉬어가던 객주',
    vocation: '밀서와 유품, 돌아오지 못한 사람의 마지막 말을 전하던 수로 전령',
    keepsake: '푸른 불빛이 비치는 작은 방울',
    selfAppearance: ['깊고 젖은 듯한 눈동자', '부드럽게 흐르는 머리선', '소리 없이 방향을 바꾸는 몸짓'],
    attire: '밤색 장삼 위에 먹청색 망토를 두르고, 목 아래 작은 방울을 숨겼습니다.',
    gaze: '말하지 않은 사정까지 물결처럼 받아들이는 깊은 눈빛',
    openingLine: '너는 늘 마지막 말을 전했지만, 정작 네 마지막 마음은 누구에게도 맡기지 못했지.'
  }
};

const CONNECTIONS = [
  {
    role: '서로의 침묵을 가장 오래 알아보던 필사관',
    appearance: ['달빛에 옅게 빛나는 눈동자', '단정히 묶은 긴 머리', '붉은 실을 감은 손목'],
    attire: '빛바랜 회청색 옷 위로 가는 붉은 실을 두르고 있었습니다.',
    gaze: '말하지 않아도 기다려줄 것처럼 고요한 눈빛',
    meeting: '비에 젖은 장부 한 권을 함께 말리던 밤, 두 사람의 손이 같은 이름 위에서 처음 멈췄습니다.'
  },
  {
    role: '위험한 길마다 한 발 먼저 등불을 들던 호위 상인',
    appearance: ['햇볕에 그을린 뺨', '웃을 때만 풀리는 날카로운 눈매', '상처가 남은 오른손'],
    attire: '검은 여행복 위에 낡은 가죽끈과 황동 부적통을 매었습니다.',
    gaze: '떠날 준비를 하면서도 한 사람만은 끝까지 확인하는 눈빛',
    meeting: '새벽 성문이 닫히기 직전, 비에 젖은 편지를 그 사람이 품 안에 감춰주며 인연이 시작됐습니다.'
  },
  {
    role: '당신이 지킨 기록 속에서 가족의 이름을 찾던 약재상',
    appearance: ['차분한 둥근 눈매', '바람에 흐트러진 앞머리', '약초 향이 밴 가느다란 손'],
    attire: '짙은 남색 두루마기에 작은 약낭과 은빛 비녀를 지녔습니다.',
    gaze: '상대의 상처를 알아도 함부로 묻지 않는 따뜻한 눈빛',
    meeting: '시장 끝 약방에서 오래 지워진 이름 하나를 읽어준 순간, 그 사람은 울지 않고 당신의 소매를 잡았습니다.'
  },
  {
    role: '당신이 지키던 기록을 세상 밖으로 전하던 젊은 전령',
    appearance: ['선이 분명한 얼굴', '짧고 짙은 눈썹', '빠르고 곧은 걸음'],
    attire: '먹색 전령복에 청동 방울과 붉은 봉인끈을 달았습니다.',
    gaze: '어떤 결말이라도 함께 감당하겠다는 단단한 눈빛',
    meeting: '붉은 봉인이 뜯긴 편지를 두고 서로를 의심한 첫 만남이, 오히려 가장 오래된 신뢰의 시작이 됐습니다.'
  }
] as const;

const DEFAULTS = {
  topic: '자기이해',
  repeatedScene: '결국 내가 뒷수습을 맡고, 한참 참은 뒤에야 관계와 일을 끊는 장면',
  emotion: '설명해도 달라지지 않을 것 같은 피로',
  desire: '내 가치를 인정받으면서도 더는 남의 책임까지 떠안지 않는 삶',
  symbol: '붉은 실',
  tone: '균형 있게'
};

const TOPIC_LENSES: Record<string, { scene: string; action: string }> = {
  연애: {
    scene: '좋아할수록 원하는 연락과 약속을 말하지 못하고 상대의 사정부터 이해해주는 장면',
    action: '보고 싶은 날짜와 필요한 연락 간격을 한 문장으로 먼저 말하기'
  },
  '재회 후유증': {
    scene: '끝난 관계의 마지막 대화를 되짚으며 내가 더 잘했어야 했다고 책임을 돌리는 장면',
    action: '다시 연락하기 전, 달라진 행동과 반복될 위험을 각각 세 가지씩 적기'
  },
  직업: {
    scene: '남들이 피한 일을 해결한 뒤에도 내 성과와 역할을 제대로 남기지 못하는 장면',
    action: '이번 주 결과물 하나에 담당 범위와 내 이름을 분명히 남기기'
  },
  돈: {
    scene: '돈 이야기를 미루다가 일은 늘고 대가는 흐려져 혼자 손해를 감당하는 장면',
    action: '시작 전에 가격·정산일·수정 범위를 문자로 확정하기'
  },
  가족: {
    scene: '가까운 사람의 기분과 문제를 내 책임처럼 받아들여 정작 내 일정을 미루는 장면',
    action: '도울 수 있는 범위와 할 수 없는 범위를 한 번에 함께 말하기'
  },
  인간관계: {
    scene: '불편함을 오래 참다가 설명 없이 거리를 두고 관계를 한 번에 닫는 장면',
    action: '마음이 닫히기 전에 불편한 지점을 짧은 사실 문장으로 알리기'
  },
  자기이해: {
    scene: '유능한 사람으로 버티느라 피로와 욕구를 가장 마지막에 확인하는 장면',
    action: '부탁에 답하기 전 내 시간·돈·체력을 먼저 확인하기'
  }
};

const clean = (value: string | undefined, fallback: string, max = 180) => {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return (normalized || fallback).slice(0, max);
};

export function createPastLifeSeed(...parts: Array<string | undefined | null>) {
  const source = parts.filter(Boolean).join('|') || 'unwoldang-past-life';
  let hash = 2166136261;

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function portrait(
  source: ArchetypeSeed,
  gender: 'male' | 'female',
  customerName: string
): PastLifePortrait {
  const appearance =
    gender === 'female'
      ? ['달빛 아래 또렷한 눈매', '단정히 올린 검은 머리', '고요하지만 긴장을 놓지 않은 표정']
      : ['달빛 아래 깊은 눈매', '정돈되지 않은 검은 머리', '말보다 먼저 상황을 읽는 차분한 표정'];

  return {
    image:
      gender === 'female'
        ? '/media/dokkaebi-guide-self-female.webp'
        : '/media/dokkaebi-guide-self-male.webp',
    imageAlt: `도깨비 장부지기가 ${customerName}님의 사주 기질을 전생 인물의 상징 초상으로 펼쳐 보여주는 장면`,
    eyebrow: '장부지기가 펼친 전생의 나 · 상징 초상',
    title: source.archetype,
    role: source.vocation,
    appearance,
    attire: '먹빛 한복을 단정히 여미고, 오래된 열쇠와 검은 장부를 가까이 지녔습니다.',
    gaze: '사람의 말 뒤에 남은 사정과 책임을 조용히 읽는 눈빛',
    caption: '같은 도깨비 장부지기가 원국의 기질과 선택한 상징을 한 사람의 초상으로 펼쳐 보여주는 창작 장면입니다.'
  };
}

function connectionPortrait(
  connection: (typeof CONNECTIONS)[number],
  presentation: 'male' | 'female'
): PastLifePortrait {
  const appearance =
    presentation === 'female'
      ? ['달빛에 옅게 빛나는 눈동자', '느슨하게 묶은 검은 머리', '붉은 실을 놓지 않은 가느다란 손']
      : ['선이 분명한 얼굴', '짧고 짙은 눈썹', '편지를 쥔 채 멈춰 선 단단한 손'];

  return {
    image:
      presentation === 'female'
        ? '/media/dokkaebi-guide-connection-female.webp'
        : '/media/dokkaebi-guide-connection-male.webp',
    imageAlt: '도깨비 장부지기가 전생 서사에서 가장 강하게 얽힌 인연의 상징 초상을 보여주는 장면',
    eyebrow: '장부지기가 펼친 가장 깊은 인연 · 상징 초상',
    title: connection.role,
    role: '연인·동료·가족 중 하나의 이름으로 한정하기보다, 서로의 미완을 비추는 핵심 인연으로 읽습니다.',
    appearance,
    attire: '회흑색 한복 위로 붉은 실이 이어지고, 손에는 끝내 전하지 못한 편지가 남아 있습니다.',
    gaze: '떠날 준비를 하면서도 마지막 약속을 확인하려는 고요한 눈빛',
    caption: '같은 도깨비 장부지기가 보여주는 상징 장면이며, 특정 실존 인물이나 현생의 누군가를 지목하지 않습니다.'
  };
}

export function buildPastLifeProfile(report: SajuReportData, input: PastLifeInput = {}): PastLifeProfile {
  const archetype = ARCHETYPES[report.dayMasterElement];
  const customerName = clean(input.name, report.customerName, 40);
  const callName = report.customerName;
  const topic = clean(input.pastLifeTopic, DEFAULTS.topic, 40);
  const repeatedScene = clean(input.repeatedScene, DEFAULTS.repeatedScene);
  const emotion = clean(input.frequentEmotion, DEFAULTS.emotion, 100);
  const desire = clean(input.hiddenDesire, DEFAULTS.desire, 120);
  const symbol = clean(input.chosenSymbol, DEFAULTS.symbol, 30);
  const tone = clean(input.readingTone, DEFAULTS.tone, 30);
  const topicLens = TOPIC_LENSES[topic] || TOPIC_LENSES.자기이해;
  const seed = createPastLifeSeed(
    report.birthLabel,
    input.birthDate,
    report.pillars.year,
    report.pillars.month,
    report.pillars.day,
    report.pillars.hour,
    customerName,
    symbol
  );
  const connection = CONNECTIONS[seed % CONNECTIONS.length];
  const connectionPresentation: 'male' | 'female' = (seed >>> 3) % 2 === 0 ? 'female' : 'male';
  const dominantTenGods = [...report.tenGods]
    .sort((left, right) => right.value - left.value)
    .slice(0, 3)
    .map((item) => item.label)
    .join('·');
  const helpful = report.helpfulElements.join('·') || '보완 기운';
  const firstMeeting = connection.meeting;
  const unfinishedPromise = `당신이 적어둔 숨은 바람: “${desire}” 두 사람은 이 바람을 함께 이루려 했지만, 서로가 맡을 책임의 범위와 돌아올 시점을 정하지 못했습니다.`;
  const finalSeparation = `${archetype.place}에 선택한 상징인 ${symbol}의 흔적만 남겨두고, 해야 할 말을 다음 날로 미룬 밤이 두 사람의 마지막 장면이 됩니다.`;
  const presentEcho = `당신이 직접 적은 반복 장면: “${repeatedScene}” 이 장면은 과거 사건이 되돌아온다는 뜻이 아닙니다. 감정의 이름 “${emotion}”을 오래 눌러두는 선택 방식이 아직 익숙하다는 신호입니다.`;

  return {
    version: 'past-life-profile-v2',
    seed,
    sealName: archetype.sealName,
    archetype: archetype.archetype,
    eraMood: archetype.eraMood,
    place: archetype.place,
    vocation: archetype.vocation,
    keepsake: symbol || archetype.keepsake,
    openingLine: `${callName}님, ${archetype.openingLine}`,
    customerFocus: topic,
    repeatedScene,
    frequentEmotion: emotion,
    hiddenDesire: desire,
    readingTone: tone,
    selfPortrait: portrait(archetype, input.gender === 'male' ? 'male' : 'female', customerName),
    connectionPortrait: connectionPortrait(connection, connectionPresentation),
    connectionRole: connection.role,
    firstMeeting,
    unfinishedPromise,
    finalSeparation,
    presentEcho,
    evidence: [
      `일간 ${report.dayMaster} · ${report.dayMasterElement} 기질`,
      `${report.gyeokguk} · 우세 십성 ${dominantTenGods || '분포형'}`,
      `현재 흐름 ${report.currentDayun.name}`,
      `보완 기운 ${helpful}`,
      `고객이 직접 적은 반복 장면과 감정`
    ],
    storyBeats: [
      {
        title: '검은 장부가 이름을 되찾다',
        scene: `${archetype.eraMood}. ${archetype.place}에서 ${archetype.vocation} 일을 맡은 사람이 있었습니다. 그 사람 곁에는 선택한 상징인 ${symbol}의 흔적이 늘 남아 있었습니다.`,
        goblinLine: `첫 장부터 겁먹을 건 없어. 여기 적힌 건 벌이 아니라, 네가 너무 오래 잘해온 방식이니까.`,
        presentEcho: `${topic}에서 특히 살펴볼 장면은 “${topicLens.scene}”입니다.`
      },
      {
        title: '붉은 실이 두 사람을 알아보다',
        scene: `${firstMeeting} 처음에는 사랑보다 신뢰가 먼저였고, 두 사람은 서로가 말하지 않은 피로를 가장 빨리 알아봤습니다.`,
        goblinLine: '익숙하다는 이유만으로 운명이라 부르진 마. 끝까지 남을 사람인지는 말이 아니라 행동으로 알아보는 거야.',
        presentEcho: `현생에서는 연락의 설렘보다 약속, 돈, 시간, 갈등 뒤 회복 행동을 확인해야 합니다.`
      },
      {
        title: '끝내 닫히지 않은 마지막 장',
        scene: `${unfinishedPromise} ${finalSeparation}`,
        goblinLine: '그날 못 한 말이 저주가 된 게 아니야. 미루는 습관이 네 안에 남았을 뿐이지.',
        presentEcho
      },
      {
        title: '과거가 기억이 아닌 습관으로 돌아오다',
        scene: `당신이 적은 감정의 이름: “${emotion}” 이 감정이 올라올수록 더 정확하고 더 유용한 사람이 되려 합니다. 그러다 자기 요구는 마지막 줄로 밀어둡니다.`,
        goblinLine: '사람을 읽는 눈은 이미 충분해. 이제 네가 어디까지 할지를 먼저 읽어.',
        presentEcho: `당신이 직접 적은 바람: “${desire}” 이번 생의 전환점은 희생 없이 이 바람을 이루는 기준을 세우는 데 있습니다.`
      },
      {
        title: '봉인을 푸는 것은 새로운 선택',
        scene: `${helpful} 기운을 생활에서 쓰며, 즉답을 늦추고 책임의 범위와 종료 시점을 글로 정하는 순간 장부의 붉은 실이 느슨해집니다.`,
        goblinLine: `${tone} 말해줄게. 네 운명을 바꾸는 건 거창한 의식이 아니라, 오늘 한 번 다르게 답하는 일이야.`,
        presentEcho: `30일 동안 반복 장면과 경계 문장을 기록하며 “${topicLens.action}”를 실제로 한 번 실행합니다.`
      }
    ],
    disclaimer:
      '이 전생 인물과 관계 초상은 사주 기질과 고객 입력을 바탕으로 만든 상징적 창작 서사입니다. 실제 과거 생애·외모·실존 인물을 재현하거나 증명하지 않습니다.'
  };
}
