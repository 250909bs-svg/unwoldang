import { getReportCallName } from '../lib/customerName';

export const serviceIds = [
  'general-signature',
  'life-flow',
  'concern-reading',
  'love-reading',
  'love-reunion',
  'match-couple',
  'match-destiny',
  'marriage-blueprint',
  'marriage-timing',
  'career-reading',
  'money-reading'
] as const;

export type ServiceId = (typeof serviceIds)[number];

export type ServiceCategoryId = 'all' | 'general' | 'love' | 'compatibility' | 'marriage' | 'career' | 'wealth';

export type ServiceTheme =
  | 'general'
  | 'newyear'
  | 'love'
  | 'compatibility'
  | 'wealth'
  | 'career'
  | 'reunion'
  | 'study'
  | 'pastlife'
  | 'dream'
  | 'psychology'
  | 'naming'
  | 'amulet'
  | 'daily';

export interface IntakeFormData {
  name: string;
  gender: 'male' | 'female';
  calendar: 'solar' | 'lunar';
  isLeapMonth: boolean;
  birthDate: string;
  birthTime: string;
  isUnknownTime: boolean;
  relationshipStatus: '' | 'dating' | 'single' | 'married';
  relationshipDuration: '' | 'under1' | 'under3' | 'under5' | 'under10';
  location: string;
  q1: string;
  q2: string;
}

export interface CategoryDefinition {
  id: ServiceCategoryId;
  label: string;
  description: string;
  lead: string;
}

export interface ServiceDefinition {
  id: ServiceId;
  category: Exclude<ServiceCategoryId, 'all'>;
  label: string;
  advisor: string;
  subtitle: string;
  teaser: string;
  description: string;
  price: string;
  accent: string;
  theme: ServiceTheme;
  heroTag: string;
  badge: string;
  spotlight: string;
  bullets: string[];
  process: string[];
  output: string[];
}

export interface EditorialCard {
  title: string;
  summary: string;
  badge: string;
}

export interface ReviewCard {
  name: string;
  summary: string;
}

export interface SajuSection {
  key: string;
  title: string;
  summary: string;
  content: string;
}

export interface SajuReport {
  title: string;
  lead: string;
  archiveLabel: string;
  meta: {
    customerName: string;
    productType: ServiceId;
    createdAt: string;
    birthLabel: string;
    q1: string;
    q2: string;
  };
  insight: {
    currentMood: string;
    rightTiming: string;
    caution: string;
  };
  sections: SajuSection[];
}

type SectionSeed = Omit<SajuSection, 'content'>;

export const serviceCategories: CategoryDefinition[] = [
  {
    id: 'all',
    label: '전체',
    description: '운월당의 전체 리포트를 한눈에 살펴보세요.',
    lead: '오늘 가장 잘 맞는 흐름을 카테고리별로 골라볼 수 있습니다.'
  },
  {
    id: 'general',
    label: '종합사주',
    description: '타고난 기질과 인생 흐름을 크게 읽는 리포트',
    lead: '사주 전체 결을 보고 싶을 때 가장 먼저 보는 대표 카테고리입니다.'
  },
  {
    id: 'love',
    label: '연애운',
    description: '썸, 재회, 감정선, 들어오는 인연을 다루는 리포트',
    lead: '감정의 방향과 관계의 속도를 구체적으로 정리해드립니다.'
  },
  {
    id: 'compatibility',
    label: '궁합',
    description: '두 사람의 리듬과 갈등 포인트를 읽는 리포트',
    lead: '좋다, 안 좋다를 넘어서 관계가 어떻게 흘러가는지 보여줍니다.'
  },
  {
    id: 'marriage',
    label: '결혼운',
    description: '혼인 적기와 배우자 흐름을 보는 실전 리포트',
    lead: '결혼 가능성과 안정감, 현실 체크 포인트를 함께 확인합니다.'
  },
  {
    id: 'career',
    label: '직업운',
    description: '직업, 이직, 창업, 브랜딩, 포트폴리오를 보는 실전 리포트',
    lead: '어떤 일을 해야 오래 버티고 돈으로 연결되는지 구체적으로 확인합니다.'
  },
  {
    id: 'wealth',
    label: '금전운',
    description: '돈이 들어오는 방식과 새는 패턴을 보는 재물 리포트',
    lead: '수입, 소비, 투자, 사업 구조를 현실적으로 정리합니다.'
  }
];

export const serviceCatalog: ServiceDefinition[] = [
  {
    id: 'general-signature',
    category: 'general',
    label: '운월선생 정통 종합사주',
    advisor: '운월선생',
    subtitle: '기질, 관계, 일, 재물의 흐름까지 한 번에 정리하는 운월당 대표 리포트',
    teaser: '타고난 결을 읽고 지금 가장 크게 움직이는 운의 방향을 정리합니다.',
    description:
      '처음 보는 분도 읽기 편하게, 하지만 얕지 않게 구성한 운월당의 시그니처 종합사주입니다. 인생 전반의 흐름을 카드형 요약과 챕터형 분석으로 나누어 보여주며, 질문 두 가지를 함께 반영해 개인화된 문장으로 정리합니다.',
    price: '79,000원',
    accent: '#ae7445',
    theme: 'general',
    heroTag: 'SIGNATURE',
    badge: '대표 리포트',
    spotlight: '운월당을 처음 방문했다면 가장 먼저 선택하는 종합 리포트',
    bullets: ['기질과 강점 분석', '관계운과 재물운 흐름', '올해 집중 포인트', '질문 맞춤 해설'],
    process: ['기본 사주 흐름 정리', '강점과 반복 패턴 분석', '질문 2개 반영', '카드형 요약과 본문 리포트 제공'],
    output: ['프리미엄 분석 리포트', '핵심 요약 카드', '실전 조언 3가지', '다음 흐름 체크 포인트']
  },
  {
    id: 'life-flow',
    category: 'general',
    label: '운월선생 신년운세',
    advisor: '운월선생',
    subtitle: '2026년 전체 흐름, 월별 운세, 재물·연애·직업·건강까지 한 번에 보는 신년운세 리포트',
    teaser: '올해 무엇을 버리고 무엇을 잡아야 돈과 사람이 붙는지 월별로 보여줍니다.',
    description:
      '올해 전체 기운을 먼저 잡고, 사주 원국의 반복 패턴과 2026년 월별 운세를 함께 읽는 신년운세 리포트입니다. 재물운, 연애운, 직업운, 인간관계운, 건강운, 개운법까지 실제 행동으로 연결해 한 해의 선택 기준을 세워드립니다.',
    price: '59,000원',
    accent: '#c78f62',
    theme: 'newyear',
    heroTag: 'LIFE FLOW',
    badge: '흐름 집중',
    spotlight: '2026년 월별 운세와 돈·연애·직업·관계·건강 포인트를 한 번에 보는 신년운세',
    bullets: ['2026 전체 기운 오프닝', '1월~12월 월별 운세', '재물·연애·직업 디테일', '개운법과 실행 체크리스트'],
    process: ['원국 핵심 패턴 분석', '대운·세운 관계 확인', '월별 돈·연애·관계·건강 정리', '올해 행동 가이드 제안'],
    output: ['2026 신년운세 리포트', '월별 운세 캘린더', '재물·연애·직업 파트', '개운법과 피해야 할 행동']
  },
  {
    id: 'concern-reading',
    category: 'general',
    label: '운월당 고민풀이',
    advisor: '운월선생',
    subtitle: '사주 구조, 십성, 신살, 대운과 세운을 바탕으로 지금의 고민을 현실 언어로 풀어주는 2,900원 입문 리포트',
    teaser: '왜 마음이 지치고 관계와 돈, 일의 선택이 꼬이는지 사주 구조로 짚어주는 고민풀이입니다.',
    description:
      '종합사주 전체를 길게 펼치기 전, 지금 가장 크게 걸려 있는 고민을 빠르게 정리하는 리포트입니다. 생년월일시를 천간지지로 변환해 원국과 십성, 귀인, 매력살, 합충형해파, 대운과 세운을 확인하고 연애, 재물, 직업, 인간관계 고민을 행동 조언까지 연결합니다.',
    price: '2,900원',
    accent: '#7b8fb8',
    theme: 'newyear',
    heroTag: 'CONCERN',
    badge: '고민풀이',
    spotlight: '사주 근거와 심리 체감, 행동 가이드를 한 번에 보는 2,900원 고민풀이',
    bullets: ['사주 기본 구조 분석', '십성·신살·합충형해파 확인', '감정 상태와 인간관계 패턴', '고민별 행동 처방전'],
    process: ['천간지지 원국 확인', '십성 분포와 신강/신약 점검', '대운·세운·월운 흐름 분석', '연애·재물·직업 고민별 정리'],
    output: ['고민풀이 리포트', '감정 상태 분석', '올해 피해야 할 것 TOP3', '사주 처방전']
  },
  {
    id: 'love-reading',
    category: 'love',
    label: '홍연아씨 연애운 리딩',
    advisor: '홍연아씨',
    subtitle: '감정선, 연락 온도, 들어오는 인연, 썸의 방향까지 섬세하게 읽는 연애 리포트',
    teaser: '지금 마음이 어느 방향으로 흐르는지, 누구와 맞닿는지 또렷하게 보여줍니다.',
    description:
      '썸, 시작 단계의 관계, 애매한 감정선이 답답할 때 선택하기 좋은 연애운 리포트입니다. 감정의 속도와 표현 방식, 상대와의 간격, 다가오는 인연의 분위기를 한 장씩 넘기듯 확인할 수 있도록 구성했습니다.',
    price: '49,000원',
    accent: '#cb7f84',
    theme: 'love',
    heroTag: 'LOVE',
    badge: '연애 인기',
    spotlight: '썸의 기류와 들어오는 인연을 부드럽게 정리하는 인기 리포트',
    bullets: ['감정선 분석', '연락 온도 진단', '들어오는 인연 포착', '실전 관계 조언'],
    process: ['현재 감정 흐름 확인', '연애 패턴 분석', '인연 시기 정리', '연락·고백·거리감 조언 작성'],
    output: ['연애운 요약 카드', '연락 스타일 분석', '인연 루트와 시기', '주의해야 할 관계 패턴']
  },
  {
    id: 'love-reunion',
    category: 'love',
    label: '홍연아씨 재회 가능성',
    advisor: '홍연아씨',
    subtitle: '남아 있는 감정과 다시 이어질 가능성을 현실적으로 읽는 재회 리포트',
    teaser: '미련인지 가능성인지 구분하고, 다시 이어질 수 있는 흐름을 정리합니다.',
    description:
      '재회에 대한 기대와 불안이 동시에 있을 때 필요한 리포트입니다. 감정만 따라가지 않도록 현재 거리감과 상대의 반응 가능성을 나눠 읽고, 다시 연결될 때와 멈춰야 할 때를 구체적으로 설명합니다.',
    price: '55,000원',
    accent: '#d08f77',
    theme: 'reunion',
    heroTag: 'REUNION',
    badge: '재회 집중',
    spotlight: '다시 이어질지, 정리할지를 현실적으로 보고 싶을 때 선택하는 리포트',
    bullets: ['남은 감정 분석', '연락 가능성 확인', '재접촉 적기 체크', '멈춰야 할 신호'],
    process: ['관계 거리감 분석', '감정 잔존도 확인', '재접촉 시기 체크', '연락 문장과 거리 조절 조언'],
    output: ['재회 분석 리포트', '감정 거리 카드', '재접촉 타이밍', '주의해야 할 연락 패턴']
  },
  {
    id: 'match-couple',
    category: 'compatibility',
    label: '월연도령 사주궁합',
    advisor: '월연도령',
    subtitle: '두 사람의 감정 리듬과 생활 궁합을 입체적으로 읽는 대표 궁합 리포트',
    teaser: '서로 끌리는 이유와 부딪히는 이유를 같은 화면에서 함께 보여줍니다.',
    description:
      '궁합을 단순한 점수로 끝내지 않고, 관계의 속도와 표현 방식, 생활 리듬까지 함께 분석합니다. 연인, 썸, 부부 모두 참고할 수 있는 구조로 만들었고, 좋은 점과 주의점이 균형 있게 보이도록 정리했습니다.',
    price: '69,000원',
    accent: '#7f87bc',
    theme: 'compatibility',
    heroTag: 'MATCH',
    badge: '궁합 대표',
    spotlight: '감정과 생활 리듬을 함께 보는 운월당 대표 궁합 리포트',
    bullets: ['끌림 포인트 분석', '갈등 포인트 정리', '생활 리듬 비교', '관계 운영 팁'],
    process: ['두 사람 흐름 비교', '감정 속도 분석', '일상 궁합 정리', '관계 조언 도출'],
    output: ['궁합 요약 카드', '연결 강도 분석', '갈등 체크 포인트', '관계 유지 가이드']
  },
  {
    id: 'match-destiny',
    category: 'compatibility',
    label: '월연도령 운명 궁합',
    advisor: '월연도령',
    subtitle: '이 인연이 오래 이어질 사람인지, 강하게 스쳐 갈 사람인지 보는 운명형 궁합',
    teaser: '관계의 무게감과 오래 갈 가능성을 중심으로 궁합을 읽습니다.',
    description:
      '좋다, 나쁘다보다 이 관계가 어떤 역할로 들어왔는지 알고 싶을 때 적합한 리포트입니다. 감정선의 깊이, 현실적인 안정감, 미래를 함께 그릴 수 있는 힘을 차분하게 설명합니다.',
    price: '63,000원',
    accent: '#8c85c9',
    theme: 'compatibility',
    heroTag: 'DESTINY',
    badge: '운명 해석',
    spotlight: '오래 갈 인연인지 진지하게 살펴보고 싶을 때 잘 맞는 궁합 리포트',
    bullets: ['인연의 무게감 분석', '장기 관계 안정감', '미래 확장성 체크', '관계 방향 조언'],
    process: ['관계 핵심 구조 파악', '장기 안정감 분석', '현실 변수 점검', '미래 방향 정리'],
    output: ['운명 궁합 리포트', '장기 흐름 카드', '관계 균형 메모', '실전 조언 문장']
  },
  {
    id: 'marriage-blueprint',
    category: 'marriage',
    label: '청연부인 결혼운 설계도',
    advisor: '청연부인',
    subtitle: '배우자 흐름과 결혼 안정감, 결혼 후 생활 결을 함께 읽는 실전 결혼운 리포트',
    teaser: '결혼의 가능성과 결혼 후 안정감을 함께 보는 운월당 결혼운 대표 상품입니다.',
    description:
      '결혼 생각이 분명해졌거나 현실적인 판단이 필요한 시점에 잘 맞는 리포트입니다. 배우자상, 결혼 적기, 안정적인 관계를 위한 체크 포인트를 함께 보여주며, 감정과 현실을 균형 있게 정리해줍니다.',
    price: '72,000원',
    accent: '#b8846d',
    theme: 'wealth',
    heroTag: 'MARRIAGE',
    badge: '결혼운 대표',
    spotlight: '배우자 흐름과 안정감을 함께 보는 결혼운 메인 리포트',
    bullets: ['배우자 흐름 분석', '결혼 안정감 체크', '현실 변수 정리', '관계 유지 포인트'],
    process: ['결혼운 핵심 흐름 점검', '배우자상 분석', '안정감 요소 추출', '실전 조언 작성'],
    output: ['결혼운 리포트', '배우자상 카드', '현실 체크리스트', '혼인 준비 포인트']
  },
  {
    id: 'marriage-timing',
    category: 'marriage',
    label: '청연부인 혼인 시기 리포트',
    advisor: '청연부인',
    subtitle: '결혼을 서두를 때와 기다릴 때를 구분해주는 타이밍 중심 결혼운 리포트',
    teaser: '언제 움직여야 가장 안정적인지, 시기 중심으로 결혼운을 정리합니다.',
    description:
      '결혼 이야기가 오가는 중이거나, 현실적으로 시기를 따져봐야 할 때 적합한 리포트입니다. 관계의 안정성, 주변 환경, 개인 운의 흐름을 함께 봐서 무리 없이 움직일 수 있는 타이밍을 정리합니다.',
    price: '58,000원',
    accent: '#c99c72',
    theme: 'newyear',
    heroTag: 'TIMING',
    badge: '혼인 적기',
    spotlight: '결혼을 언제 움직이면 좋은지 타이밍 중심으로 보는 리포트',
    bullets: ['혼인 적기 분석', '결정이 필요한 구간', '관계 안정도 점검', '현실 조율 가이드'],
    process: ['시기별 운 흐름 분리', '움직이기 좋은 구간 추출', '주의 시기 표시', '결정 포인트 요약'],
    output: ['혼인 시기 카드', '타이밍 분석 리포트', '실전 조율 가이드', '현실 체크 메모']
  },
  {
    id: 'career-reading',
    category: 'career',
    label: '운월선생 직업운 설계도',
    advisor: '운월선생',
    subtitle: '직업 적성, 이직·창업 타이밍, 포트폴리오와 브랜딩 방향까지 보는 실전 직업운 리포트',
    teaser: '어떤 일을 해야 덜 지치고 오래 돈으로 연결되는지 보여드립니다.',
    description:
      '직업 이름 하나를 찍는 리포트가 아니라, 사주 구조와 대운을 바탕으로 어떤 역할, 업종, 일 방식에서 성과가 붙는지 분석합니다. 이직, 창업, 프리랜서, 브랜딩, 가격표와 포트폴리오까지 현실적인 실행 순서로 정리합니다.',
    price: '59,000원',
    accent: '#8f7655',
    theme: 'career',
    heroTag: 'CAREER',
    badge: '직업운 대표',
    spotlight: '진로, 이직, 창업, 브랜딩을 한 번에 보는 프리미엄 직업운',
    bullets: ['직업 DNA 분석', '맞는 업종 TOP', '이직·창업 타이밍', '90일 커리어 실행안'],
    process: ['원국 직업성 확인', '십성·월령 기반 역할 분석', '대운·월운 타이밍 점검', '포트폴리오·가격 전략 제안'],
    output: ['직업운 리포트', '업종 추천표', '이직·창업 체크리스트', '90일 실행 로드맵']
  },
  {
    id: 'money-reading',
    category: 'wealth',
    label: '운월선생 금전운 설계도',
    advisor: '운월선생',
    subtitle: '돈 들어오는 방식, 새는 지점, 투자·사업 성향과 정산 구조를 보는 프리미엄 금전운 리포트',
    teaser: '돈이 어디서 들어오고 어디서 새는지, 올해 무엇을 지켜야 남는지 보여드립니다.',
    description:
      '금전운을 막연한 대박운으로 보지 않고 수입원, 소비 습관, 가격 책정, 정산, 투자 위험, 반복 수익 구조로 나눠 분석합니다. 대운과 월운을 함께 보며 돈을 열 시기와 지킬 시기를 구분합니다.',
    price: '59,000원',
    accent: '#b48a38',
    theme: 'wealth',
    heroTag: 'MONEY',
    badge: '금전운 대표',
    spotlight: '수입, 소비, 투자, 사업 구조를 현실적으로 보는 프리미엄 금전운',
    bullets: ['재물 구조 분석', '돈 새는 패턴', '투자·사업 성향', '월별 금전 전략'],
    process: ['재성·식상 흐름 확인', '대운의 돈 압력 분석', '소비·투자 위험 분류', '정산과 반복 수익 구조 제안'],
    output: ['금전운 리포트', '수입원·지출 패턴 카드', '투자 주의표', '30일 돈 관리 처방']
  }
];

export const featuredServices = serviceCatalog.slice(0, 4);

export const magazineCards: EditorialCard[] = [
  {
    badge: 'INSIGHT',
    title: '요즘 운월당에서 가장 많이 묻는 연애운 질문',
    summary: '호감은 있는데 관계가 왜 더뎌지는지, 내가 먼저 다가가야 하는지에 대한 질문을 가장 많이 다룹니다.'
  },
  {
    badge: 'GUIDE',
    title: '궁합은 점수보다 생활 리듬을 같이 보는 것이 중요해요',
    summary: '겉으로 잘 맞아 보여도 생활 속 속도 차이가 크면 피로가 쌓이기 쉬워 운월당은 일상 리듬을 함께 분석합니다.'
  },
  {
    badge: 'TIMING',
    title: '결혼운은 감정보다 시기와 안정감이 더 중요할 수 있어요',
    summary: '결혼은 좋은 감정뿐 아니라 안정적인 흐름이 중요해서 적기와 현실 변수를 같이 보는 것이 도움이 됩니다.'
  }
];

export const reviewCards: ReviewCard[] = [
  {
    name: '정통 종합사주 후기',
    summary: '문장이 길기만 한 해석이 아니라 카드뉴스처럼 빨리 읽히고, 뒤쪽 챕터는 깊어서 만족도가 높았어요.'
  },
  {
    name: '연애운 후기',
    summary: '상대 마음을 단정하지 않고 제 감정 패턴까지 같이 설명해줘서 훨씬 현실적으로 느껴졌어요.'
  },
  {
    name: '결혼운 후기',
    summary: '막연히 결혼이 늦는다고 겁주지 않고, 지금 준비할 것과 기다릴 구간을 나눠줘서 좋았어요.'
  }
];

const generalSections: SectionSeed[] = [
  { key: 'temperament', title: '타고난 기질', summary: '기본 성향과 강점이 어떤 방식으로 드러나는지 정리합니다.' },
  { key: 'life-flow', title: '현재 흐름', summary: '지금 가장 크게 움직이는 운의 방향을 읽어드립니다.' },
  { key: 'relationship', title: '관계와 감정선', summary: '사람 사이에서 반복되는 패턴과 감정의 결을 설명합니다.' },
  { key: 'money', title: '일과 재물 흐름', summary: '현실적인 선택과 성과가 어디에서 만들어지는지 살펴봅니다.' },
  { key: 'advice', title: '운월당 조언', summary: '지금 바로 적용할 수 있는 핵심 조언을 정리합니다.' }
];

const loveSections: SectionSeed[] = [
  { key: 'emotion', title: '현재 연애 기류', summary: '감정의 방향과 관계의 속도를 먼저 정리합니다.' },
  { key: 'pattern', title: '감정 패턴', summary: '연애에서 반복되는 마음의 습관을 읽어드립니다.' },
  { key: 'timing', title: '들어오는 인연', summary: '새로운 관계나 다시 이어질 흐름이 어디에서 오는지 확인합니다.' },
  { key: 'distance', title: '관계 거리감', summary: '다가갈 때와 기다릴 때를 구분해드립니다.' },
  { key: 'advice', title: '실전 조언', summary: '연락, 태도, 감정 표현에서 도움이 되는 포인트를 제안합니다.' }
];

const compatibilitySections: SectionSeed[] = [
  { key: 'link', title: '연결 강도', summary: '두 사람이 왜 끌리는지 관계의 중심축을 설명합니다.' },
  { key: 'speed', title: '감정 속도', summary: '표현 방식과 관계의 템포 차이를 정리합니다.' },
  { key: 'daily', title: '생활 궁합', summary: '일상 리듬과 현실 궁합을 함께 분석합니다.' },
  { key: 'conflict', title: '갈등 포인트', summary: '부딪히기 쉬운 지점을 미리 짚어드립니다.' },
  { key: 'advice', title: '관계 유지 팁', summary: '좋은 흐름을 오래 가져가기 위한 실전 팁을 정리합니다.' }
];

const marriageSections: SectionSeed[] = [
  { key: 'possibility', title: '결혼 가능성', summary: '현재 결혼운의 문이 어느 정도 열려 있는지 살펴봅니다.' },
  { key: 'partner', title: '배우자 흐름', summary: '잘 맞는 배우자상과 안정감을 만드는 관계 특징을 설명합니다.' },
  { key: 'timing', title: '혼인 적기', summary: '움직이기 좋은 시점과 기다려야 할 구간을 구분합니다.' },
  { key: 'reality', title: '현실 체크', summary: '감정 외에 반드시 확인해야 할 현실 변수를 정리합니다.' },
  { key: 'advice', title: '준비 포인트', summary: '결혼운을 현실로 연결하기 위한 준비 포인트를 제안합니다.' }
];

const careerSections: SectionSeed[] = [
  { key: 'dna', title: '직업 DNA', summary: '사주 원국에서 반복되는 일 처리 방식과 평가받는 역할을 봅니다.' },
  { key: 'industry', title: '맞는 업종', summary: '업종명보다 오래 버티고 단가가 붙는 일의 구조를 분류합니다.' },
  { key: 'timing', title: '이직·창업 시기', summary: '움직이기 좋은 달과 정리해야 할 달을 나눕니다.' },
  { key: 'portfolio', title: '포트폴리오 전략', summary: '능력을 보이는 결과물, 가격표, 브랜딩 방향을 잡습니다.' },
  { key: 'advice', title: '90일 실행안', summary: '직업운을 실제 행동으로 바꾸는 순서를 제안합니다.' }
];

const wealthSections: SectionSeed[] = [
  { key: 'structure', title: '재물 구조', summary: '한 방형인지 누적형인지, 돈이 붙는 방식을 봅니다.' },
  { key: 'leak', title: '돈 새는 패턴', summary: '감정 소비, 관계 지출, 투자 실수의 반복 장면을 짚습니다.' },
  { key: 'income', title: '수입원 설계', summary: '월급, 사업, 부업, 반복 결제 중 맞는 구조를 분류합니다.' },
  { key: 'investment', title: '투자·사업 주의점', summary: '하면 좋은 방식과 피해야 할 위험 방식을 나눕니다.' },
  { key: 'advice', title: '30일 돈 처방', summary: '정산, 가격, 지출 기록을 실제 루틴으로 바꿉니다.' }
];

const sectionSeedByCategory: Record<Exclude<ServiceCategoryId, 'all'>, SectionSeed[]> = {
  general: generalSections,
  love: loveSections,
  compatibility: compatibilitySections,
  marriage: marriageSections,
  career: careerSections,
  wealth: wealthSections
};

const categoryLead: Record<Exclude<ServiceCategoryId, 'all'>, string> = {
  general: '운월당의 종합사주 리포트는 한 줄 운세가 아니라 삶의 큰 결을 읽고, 지금 무엇을 우선해야 하는지 정리하는 방식으로 구성됩니다.',
  love: '운월당의 연애운 리포트는 상대를 단정하기보다 지금 관계의 온도와 감정의 방향을 현실적으로 읽어내는 데 집중합니다.',
  compatibility: '운월당의 궁합 리포트는 좋은 점과 어려운 점을 함께 보여주며, 실제 관계를 운영할 수 있는 힌트까지 정리해드립니다.',
  marriage: '운월당의 결혼운 리포트는 감정과 현실을 함께 보며, 결혼의 가능성과 시기를 균형 있게 판단할 수 있도록 돕습니다.',
  career: '운월당의 직업운 리포트는 직업 이름을 찍는 대신, 어떤 역할과 구조에서 덜 지치고 더 오래 평가받는지 봅니다.',
  wealth: '운월당의 금전운 리포트는 대박 예언이 아니라 돈이 들어오는 방식과 새는 지점을 현실적으로 나눠 보여줍니다.'
};

const categoryInsight: Record<
  Exclude<ServiceCategoryId, 'all'>,
  { currentMood: string; rightTiming: string; caution: string }
> = {
  general: {
    currentMood: '지금은 막연한 고민을 줄이고 삶의 우선순위를 선명하게 세울수록 흐름이 빨라지는 시기입니다.',
    rightTiming: '한 번에 많이 바꾸기보다 지금 가장 무게감이 큰 한 가지를 먼저 정리할 때 성과가 잘 붙습니다.',
    caution: '주변 기대에 맞추느라 본래 강점을 흐리게 만들면 좋은 운도 체감이 늦어질 수 있습니다.'
  },
  love: {
    currentMood: '감정은 충분히 움직이고 있지만 표현의 속도와 확신이 아직 균형을 맞추는 중입니다.',
    rightTiming: '관계를 서두르기보다 상대와의 거리감을 읽고 한 번 더 부드럽게 다가갈 때 반응이 좋아집니다.',
    caution: '상대 마음만 해석하려 들면 정작 내 감정이 원하는 방향을 놓치기 쉽습니다.'
  },
  compatibility: {
    currentMood: '끌림은 분명하지만 두 사람의 속도 차이를 이해해야 관계가 더 편안해질 수 있는 흐름입니다.',
    rightTiming: '서로 맞는 점을 확인하는 것만큼 생활 리듬을 조율하려는 태도가 중요하게 작동합니다.',
    caution: '좋고 나쁨만 빠르게 결론 내리면 오래 갈 관계가 될 수 있는 가능성도 놓칠 수 있습니다.'
  },
  marriage: {
    currentMood: '결혼운은 감정만으로 움직이기보다 안정감과 현실성이 같이 올라올 때 가장 자연스럽게 풀립니다.',
    rightTiming: '서두르기보다 관계의 기반이 정리되는 시점에 맞춰 움직이면 훨씬 안정적인 선택이 됩니다.',
    caution: '불안 때문에 결정을 앞당기면 오히려 놓치지 않아도 될 변수에 흔들릴 수 있습니다.'
  },
  career: {
    currentMood: '직업운은 지금 가진 능력을 밖에서 알아볼 수 있는 결과물로 바꿀 때 살아납니다.',
    rightTiming: '이직이나 창업은 감정이 아니라 포트폴리오, 가격, 수입 공백이 정리될 때 움직이는 편이 안전합니다.',
    caution: '좋아 보이는 일이라도 역할과 보상이 흐리면 실력보다 피로가 먼저 쌓입니다.'
  },
  wealth: {
    currentMood: '금전운은 들어오는 돈보다 남는 돈의 구조를 잡을 때 체감이 커집니다.',
    rightTiming: '수입을 열 시기와 지출을 막을 시기를 나누면 돈의 압박이 훨씬 줄어듭니다.',
    caution: '감정이 올라온 밤의 결제, 지인 부탁, 이해하지 못한 투자가 가장 큰 손실 포인트입니다.'
  }
};

const buildBirthLabel = (formData?: Partial<IntakeFormData>) => {
  const calendar = formData?.calendar === 'lunar' ? '음력' : '양력';
  const birthDate = formData?.birthDate || '1994-03-21';
  const birthTime = formData?.birthTime || '09:30';

  return `${calendar} ${birthDate} ${birthTime}`;
};

const buildSectionContent = (
  service: ServiceDefinition,
  section: SectionSeed,
  formData?: Partial<IntakeFormData>
) => {
  const customerName = getReportCallName(formData?.name);
  const location = formData?.location?.trim() || '출생 지역 미입력';
  const firstQuestion =
    formData?.q1?.trim() || '지금 제 흐름에서 무엇을 가장 먼저 정리해야 하는지 알고 싶어요.';
  const secondQuestion =
    formData?.q2?.trim() || '가까운 시기 안에 어떤 선택을 하면 좋을지 구체적으로 보고 싶어요.';
  const relationshipLabel =
    formData?.relationshipStatus === 'dating'
      ? '현재 연애 중'
      : formData?.relationshipStatus === 'married'
        ? '현재 기혼 상태'
        : formData?.relationshipStatus === 'single'
          ? '현재 솔로 상태'
          : '현재 관계 상태 미입력';
  const birthLabel = buildBirthLabel(formData);

  return [
    `${section.summary} ${categoryLead[service.category]} ${customerName}님의 ${service.label} 분석은 ${birthLabel} 기준으로 기본 결을 읽고, 질문에 맞춰 흐름을 압축 해제하듯 한 단계씩 펼쳐 보여주는 방식으로 구성됩니다.`,
    `${relationshipLabel}를 기준으로 감정선과 관계의 리듬도 함께 반영했습니다. 관계 상태에 따라 질문의 해석 포인트와 조언 문장도 달라지도록 정리했습니다.`,
    `첫 번째 질문인 "${firstQuestion}"을 기준으로 보면, 이번 ${section.title}에서는 ${service.teaser} 이 부분이 가장 중요하게 작동합니다. 운월당은 결과를 단정적으로 잘라 말하기보다 지금 상황에서 무엇을 우선하면 좋은지 문장으로 정리해드립니다.`,
    `두 번째 질문인 "${secondQuestion}"도 같은 흐름 안에 있습니다. ${service.description} 그래서 이번 구간에서는 감정과 현실을 나눠 읽고, 무엇을 유지해야 하고 무엇을 조정해야 하는지 구체적으로 설명하는 것이 핵심입니다.`,
    `참고 정보로 입력된 출생 지역은 ${location}입니다. 이 정보는 세부 톤을 보완하는 참고값으로 활용했고, 최종적으로는 ${customerName}님이 바로 적용할 수 있는 실전 문장과 체크 포인트 중심으로 정리했습니다.`
  ].join('\n\n');
};

export const findServiceById = (id?: string): ServiceDefinition =>
  serviceCatalog.find((service) => service.id === id) ?? serviceCatalog[0];

export const findCategoryById = (id?: string): CategoryDefinition =>
  serviceCategories.find((category) => category.id === id) ?? serviceCategories[0];

export const buildMockReport = (
  serviceId: ServiceId,
  formData?: Partial<IntakeFormData>
): SajuReport => {
  const service = findServiceById(serviceId);
  const customerName = getReportCallName(formData?.name);
  const sectionSeeds = sectionSeedByCategory[service.category];
  const createdAt = new Date().toISOString();
  const sections = sectionSeeds.map((section) => ({
    ...section,
    content: buildSectionContent(service, section, formData)
  }));

  return {
    title: `${service.label} 분석 리포트`,
    lead: `${service.advisor}의 해설 톤으로 정리한 ${service.subtitle}`,
    archiveLabel: `${service.id}.zip`,
    meta: {
      customerName,
      productType: service.id,
      createdAt,
      birthLabel: buildBirthLabel(formData),
      q1: formData?.q1?.trim() || '지금 제 흐름에서 무엇을 가장 먼저 정리해야 하는지 알고 싶어요.',
      q2: formData?.q2?.trim() || '가까운 시기 안에 어떤 선택을 하면 좋을지 구체적으로 보고 싶어요.'
    },
    insight: categoryInsight[service.category],
    sections
  };
};
