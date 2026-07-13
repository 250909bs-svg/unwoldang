export const PAST_LIFE_PRODUCT = {
  brand: 'MZ 도깨비 전생사주',
  name: '도깨비 전생장부: 봉인록',
  price: '49,000원',
  poster: '/media/dokkaebi-poster.webp',
  film: '/media/dokkaebi-hero.mp4',
  primaryAction: '내 전생 장부 열기',
  sampleAction: '샘플 장부 미리보기'
} as const;

export type PastLifeChapter = {
  id: 'seal' | 'relationship' | 'karma' | 'present' | 'release';
  volume: string;
  title: string;
  line: string;
  topics: string[];
  symbol: string;
  crop: string;
  image: string;
  imageAlt: string;
};

export const pastLifeChapters: PastLifeChapter[] = [
  {
    id: 'seal',
    volume: '제1권',
    title: '봉인록',
    line: '이름이 지워진 자리에도 운명은 남는다.',
    topics: ['전생 봉인명', '시대와 장소', '신분·직업·재능'],
    symbol: '희미한 청염',
    crop: '50% 35%',
    image: '/media/chapter-01-seal.webp',
    imageAlt: '검은 달 앞에서 청염으로 흑장부의 봉인을 여는 장부지기'
  },
  {
    id: 'relationship',
    volume: '제2권',
    title: '인연록',
    line: '사람은 떠나도 매듭은 남는다.',
    topics: ['가장 사랑했던 사람', '다시 만난 인연', '귀인과 가족'],
    symbol: '이어지는 적연',
    crop: '50% 58%',
    image: '/media/chapter-02-relationship.webp',
    imageAlt: '달빛 아래 붉은 인연의 실로 이어진 두 사람과 이를 지켜보는 장부지기'
  },
  {
    id: 'karma',
    volume: '제3권',
    title: '업록',
    line: '벌이 아니라 반복이 업을 드러낸다.',
    topics: ['남긴 상처와 책임', '갚지 못한 빚', '끝내 못한 말'],
    symbol: '엉킨 적연',
    crop: '50% 66%',
    image: '/media/chapter-03-karma.webp',
    imageAlt: '먹빛 기록과 붉은 실, 깨진 금인이 놓인 오래된 흑장부'
  },
  {
    id: 'present',
    volume: '제4권',
    title: '현생록',
    line: '과거는 기억보다 습관으로 돌아온다.',
    topics: ['연애의 반복', '돈·직업의 흔적', '복과 재능'],
    symbol: '손목을 비추는 청염',
    crop: '50% 52%',
    image: '/media/chapter-04-present.webp',
    imageAlt: '검은 유리에 비친 현생의 나와 전생의 내가 같은 손짓으로 마주한 장면'
  },
  {
    id: 'release',
    volume: '제5권',
    title: '해원록',
    line: '풀어야 할 것은 운명이 아니라 오래된 선택이다.',
    topics: ['피해야 할 악연', '이번 생의 숙제', '30일 봉인 해제'],
    symbol: '느슨해진 인연의 실',
    crop: '50% 52%',
    image: '/media/chapter-05-release.webp',
    imageAlt: '새벽빛이 열린 문 앞에서 붉은 실을 천천히 풀어주는 장부지기'
  }
];

export const pastLifeQuestions = [
  '전생에 나는 누구였나',
  '누구를 사랑했고 누구에게 상처를 남겼나',
  '무엇을 끝내지 못했나',
  '왜 현생에서 같은 장면이 반복되나',
  '이번 생에서는 어떻게 풀어야 하나'
] as const;

export const pastLifeValueItems = [
  '다섯 권 26개 개인 맞춤 주제',
  '전생 인물과 사건을 잇는 시네마틱 서사',
  '연애·돈·직업·가족의 현생 패턴 분석',
  '전생 봉인명과 한 문장 공유 카드',
  '이번 생 핵심 퀘스트 카드',
  '30일 봉인 해제 기록'
] as const;

export const pastLifeSamplePages = [
  {
    number: '01',
    title: '전생의 정체',
    label: '봉인명 · 불을 감춘 기록관',
    body: '당신은 남의 이름을 지켜주면서 자기 이름은 오래 숨긴 사람입니다.'
  },
  {
    number: '02',
    title: '전생의 업',
    label: '침묵으로 떠안은 책임',
    body: '틀린 것을 먼저 알아차리고도 관계가 깨질까 말하지 못한 선택이 현생의 뒷수습 습관으로 남았습니다.'
  },
  {
    number: '03',
    title: '이번 생의 숙제',
    label: '거절을 늦추지 않는 연습',
    body: '부탁을 받은 자리에서 바로 답하지 않고, 일정과 책임 범위를 확인한 뒤 선택하는 것이 첫 해원입니다.'
  }
] as const;

export const pastLifeFaq = [
  {
    question: '전생 내용은 어떻게 구성되나요?',
    answer: '생년월일시로 계산한 원국, 월령, 십성, 합충형파와 현재 대운을 먼저 고정한 뒤, 반복되는 기질을 다섯 권의 상징적인 전생 서사와 현생 행동으로 번역합니다.'
  },
  {
    question: '태어난 시간을 모르면 어떻게 하나요?',
    answer: '시간 모름을 선택할 수 있습니다. 시주가 빠진 만큼 단정 범위를 줄이고, 연·월·일주와 대운에서 확인되는 내용만 선별해 보여드립니다.'
  },
  {
    question: '결과는 어떤 형태로 받나요?',
    answer: '모바일과 PC에서 다시 볼 수 있는 개인 장부형 리포트로 제공됩니다. 원국 근거, 다섯 권 서사, 현생 연결, 30일 행동 기록을 한 화면에서 확인합니다.'
  },
  {
    question: '다른 사람과의 전생 인연도 볼 수 있나요?',
    answer: '이 상품은 우선 본인의 사주와 반복 관계 패턴을 중심으로 읽습니다. 특정 상대의 마음이나 과거를 사실처럼 단정하지 않습니다.'
  },
  {
    question: '내용이 무섭게 나오지는 않나요?',
    answer: '질병, 수명, 사고, 저주를 예언하지 않습니다. 불편한 패턴을 설명할 때에도 지금 바꿀 수 있는 행동을 반드시 함께 제시합니다.'
  },
  {
    question: '전생 내용이 역사적 사실로 증명되나요?',
    answer: '아닙니다. 사주에 나타난 성향과 반복 패턴을 상징적인 전생 서사로 풀어낸 자기이해형 콘텐츠이며, 역사적 사실이나 초자연적 사실을 증명하는 서비스가 아닙니다.'
  }
] as const;

export const pastLifeTopicOptions = ['연애', '재회 후유증', '직업', '돈', '가족', '인간관계', '자기이해'] as const;
export const pastLifeSymbolOptions = ['열쇠', '거울', '방울', '붉은 실', '동전', '등불'] as const;
export const pastLifeToneOptions = ['따뜻하게', '직설적으로', '균형 있게'] as const;
