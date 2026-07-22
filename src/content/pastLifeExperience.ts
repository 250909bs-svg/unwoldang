import {
  PAST_LIFE_NARRATIVE_POLICY,
  PAST_LIFE_PRODUCT,
  PAST_LIFE_REPORT_VOLUMES,
  type PastLifeVolumeId
} from '../products/past-life-goblin/contract';

export { PAST_LIFE_NARRATIVE_POLICY, PAST_LIFE_PRODUCT, PAST_LIFE_REPORT_VOLUMES };

export type PastLifeChapter = {
  id: PastLifeVolumeId;
  volume: string;
  title: string;
  line: string;
  topics: readonly string[];
  symbol: string;
  crop: string;
  image: string;
  imageAlt: string;
};

export const pastLifeChapters = PAST_LIFE_REPORT_VOLUMES.map(
  (volume): PastLifeChapter => ({
    id: volume.id,
    volume: volume.volume,
    title: volume.title,
    line: volume.line,
    topics: volume.topics.map((topic) => topic.title),
    symbol: volume.symbol,
    crop: volume.crop,
    image: volume.image,
    imageAlt: volume.imageAlt
  })
);

export const pastLifeQuestions = [
  '나는 어떤 상징 인물로 그려지나',
  '어떤 관계 패턴에 가장 크게 흔들리나',
  '무엇을 끝내지 못한 선택으로 읽나',
  '왜 현생에서 같은 장면을 반복하나',
  '이번 생에서는 어떤 행동으로 풀 수 있나'
] as const;

export const pastLifeValueItems = [
  '다섯 권 26개 개인 맞춤 주제',
  '반복 기질을 인물과 장면으로 번역한 상징 서사',
  '연애·돈·직업·가족의 현생 패턴 분석',
  '상징 봉인명과 한 문장 공유 카드',
  '이번 생 핵심 퀘스트 카드',
  '30일 봉인 해제 기록'
] as const;

export const pastLifeSamplePages = [
  {
    number: '01',
    title: '상징 캐릭터',
    label: '상징 봉인명 · 불을 감춘 기록관',
    body: '상징 서사 속 인물은 남의 이름을 지켜주면서 자기 이름은 오래 숨긴 사람으로 그려집니다.'
  },
  {
    number: '02',
    title: '반복 선택의 상징',
    label: '침묵으로 떠안은 책임',
    body: '틀린 것을 먼저 알아차리고도 관계가 깨질까 말하지 못하는 선택이 현생의 뒷수습 습관으로 반복되는 패턴으로 읽힙니다.'
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
