export const PAST_LIFE_PRODUCT_ID = 'past-life-goblin' as const;

export type PastLifeVolumeId = 'seal' | 'relationship' | 'karma' | 'present' | 'release';

export type PastLifeReportTopic = {
  number: number;
  title: string;
};

export type PastLifeVolumeContract = {
  id: PastLifeVolumeId;
  sectionId: `pastlife-${PastLifeVolumeId}`;
  volume: string;
  title: '봉인록' | '인연록' | '업록' | '현생록' | '해원록';
  line: string;
  topics: readonly PastLifeReportTopic[];
  symbol: string;
  crop: string;
  image: string;
  imageAlt: string;
};

export const PAST_LIFE_PRODUCT = {
  id: PAST_LIFE_PRODUCT_ID,
  brand: 'MZ 도깨비 전생사주',
  name: '도깨비 전생장부: 봉인록',
  price: '49,000원',
  poster: '/media/dokkaebi-poster.webp',
  guideAvatar: '/media/dokkaebi-guide-avatar.webp',
  intakeImage: '/media/dokkaebi-guide-intake.webp',
  film: '/media/dokkaebi-hero-optimized.mp4',
  immersionFilm: '/media/dokkaebi-immersion.mp4',
  immersionFilms: [
    '/media/dokkaebi-story-01.mp4',
    '/media/dokkaebi-story-04.mp4',
    '/media/dokkaebi-immersion.mp4',
    '/media/dokkaebi-story-02.mp4'
  ],
  primaryAction: '내 전생 장부 열기',
  sampleAction: '샘플 장부 미리보기'
} as const;

export const PAST_LIFE_NARRATIVE_POLICY = {
  mode: 'symbolic-saju-narrative',
  notice:
    '사주에 나타난 반복 기질을 상징 서사로 번역한 자기이해형 콘텐츠이며, 과거 생애나 초자연적 사실을 증명하지 않습니다.',
  evidence: ['일간', '월령', '십성', '합충형파', '현재 대운', '고객이 직접 적은 반복 장면'] as const,
  excludedCertainties: ['실제 과거 생애', '실존 인물 지목', '역사적 신원 확정', '저주·형벌 단정'] as const
} as const;

export const PAST_LIFE_REPORT_VOLUMES = [
  {
    id: 'seal',
    sectionId: 'pastlife-seal',
    volume: '제1권',
    title: '봉인록',
    line: '이름이 지워진 자리에도 반복 기질은 남는다.',
    topics: [
      { number: 1, title: '당신의 상징 봉인명' },
      { number: 2, title: '장부가 그리는 상징 인물' },
      { number: 3, title: '상징 서사의 시대와 장소' },
      { number: 4, title: '상징 인물의 역할과 일' },
      { number: 5, title: '상징 인물이 보여주는 재능' }
    ],
    symbol: '희미한 청염',
    crop: '50% 35%',
    image: '/media/dokkaebi-guide-chapter-01.webp',
    imageAlt: '달빛 아래 같은 도깨비 장부지기가 청염으로 고객의 첫 상징 장부를 여는 장면'
  },
  {
    id: 'relationship',
    sectionId: 'pastlife-relationship',
    volume: '제2권',
    title: '인연록',
    line: '사람은 달라져도 익숙한 관계 패턴은 남는다.',
    topics: [
      { number: 6, title: '장부가 그리는 가장 깊은 인연' },
      { number: 7, title: '현생에서 익숙하게 느끼는 인연의 유형' },
      { number: 8, title: '배신으로 느끼기 쉬운 관계 패턴' },
      { number: 9, title: '원수처럼 꼬이기 쉬운 관계 패턴' }
    ],
    symbol: '이어지는 적연',
    crop: '50% 58%',
    image: '/media/dokkaebi-guide-chapter-02.webp',
    imageAlt: '비 내리는 달밤에 도깨비 장부지기가 붉은 인연의 실을 따라가는 상징 장면'
  },
  {
    id: 'karma',
    sectionId: 'pastlife-karma',
    volume: '제3권',
    title: '업록',
    line: '벌이 아니라 반복이 업의 상징을 만든다.',
    topics: [
      { number: 10, title: '상징 서사에 남은 책임과 상처' },
      { number: 11, title: '대가를 놓치는 선택의 흔적' },
      { number: 12, title: '끝내 지키지 못한 약속의 패턴' },
      { number: 13, title: '상징 서사의 마지막 갈림길' },
      { number: 14, title: '마지막 장면에 남은 후회' },
      { number: 15, title: '끝내 전하지 못한 말' }
    ],
    symbol: '엉킨 적연',
    crop: '50% 66%',
    image: '/media/dokkaebi-guide-chapter-03.webp',
    imageAlt: '도깨비 장부지기가 흑장부 위에서 엉킨 붉은 실과 오래된 봉인을 풀어보는 상징 장면'
  },
  {
    id: 'present',
    sectionId: 'pastlife-present',
    volume: '제4권',
    title: '현생록',
    line: '상징 서사는 현생의 습관과 선택을 비춘다.',
    topics: [
      { number: 16, title: '현생까지 이어진 반복 선택' },
      { number: 17, title: '연애에서 반복되는 선택' },
      { number: 18, title: '돈과 직업에서 반복되는 선택' },
      { number: 19, title: '가족과 인간관계에 남은 패턴' },
      { number: 20, title: '사주에서 확인한 복과 재능' }
    ],
    symbol: '손목을 비추는 청염',
    crop: '50% 52%',
    image: '/media/dokkaebi-guide-chapter-04.webp',
    imageAlt: '도깨비 장부지기가 거울 속 익명의 현생 인물과 반복되는 손짓을 마주한 상징 장면'
  },
  {
    id: 'release',
    sectionId: 'pastlife-release',
    volume: '제5권',
    title: '해원록',
    line: '풀어야 할 것은 운명이 아니라 오래된 선택이다.',
    topics: [
      { number: 21, title: '현생에서 피해야 할 관계 패턴' },
      { number: 22, title: '현생에서 알아봐야 할 귀인' },
      { number: 23, title: '이번 생에서 끝내야 할 숙제' },
      { number: 24, title: '반복 선택을 푸는 방법' },
      { number: 25, title: '30일 봉인 해제 퀘스트' },
      { number: 26, title: '상징 인물이 현생의 나에게 보내는 편지' }
    ],
    symbol: '느슨해진 인연의 실',
    crop: '50% 52%',
    image: '/media/dokkaebi-guide-chapter-05.webp',
    imageAlt: '새벽빛 문 앞에서 같은 도깨비 장부지기가 고객 손의 붉은 실을 풀어 돌려주는 상징 장면'
  }
] as const satisfies readonly PastLifeVolumeContract[];

export const PAST_LIFE_REPORT_TOPIC_COUNT = PAST_LIFE_REPORT_VOLUMES.reduce(
  (total, volume) => total + volume.topics.length,
  0
);

export function getPastLifeReportTopic(number: number) {
  for (const volume of PAST_LIFE_REPORT_VOLUMES) {
    for (const topic of volume.topics) {
      if (topic.number === number) {
        return topic;
      }
    }
  }

  return undefined;
}

export function formatPastLifeReportTopic(number: number) {
  const topic = getPastLifeReportTopic(number);

  if (!topic) {
    throw new Error(`Unknown past-life report topic: ${number}`);
  }

  return `${String(topic.number).padStart(2, '0')}. ${topic.title}`;
}
