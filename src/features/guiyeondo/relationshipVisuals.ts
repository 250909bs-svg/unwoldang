import {
  cautionRelationImage,
  celestialCoupleImage,
  destinedLoveImage,
  growthRelationImage,
  lifeBenefactorImage,
  successBenefactorImage,
  wealthBenefactorImage
} from './media';
import type { GuiyeondoRelationshipType, GuiyeondoVectorId } from './types';

export interface GuiyeondoRelationshipVisual {
  label: string;
  hanja: string;
  shortLabel: string;
  hero: string;
  description: string;
  interpretation: string;
  observations: readonly [string, string, string];
  focusVectors: readonly GuiyeondoVectorId[];
  image: string;
  imageAlt: string;
  focalPoint: string;
  tone: string;
}

export const GUIYEONDO_RELATIONSHIP_VISUALS: Record<GuiyeondoRelationshipType, GuiyeondoRelationshipVisual> = {
  soulmate: {
    label: '천생연분', hanja: '天生緣分', shortLabel: '깊은 인연',
    hero: '끌림과 안정의 신호가 함께 나타나는 사람.',
    description: '끌림과 생활 안정, 오래 이어갈 힘이 함께 지지되는 관계를 살핍니다.',
    interpretation: '천생연분은 강한 호감 하나만으로 정하지 않습니다. 감정 교류가 자연스럽고, 갈등 뒤에도 관계를 다시 정돈하며, 생활의 속도까지 맞출 여지가 함께 나타날 때 이 범주를 우선 검토합니다.',
    observations: ['대화가 끝난 뒤 흥분보다 편안함이 오래 남는지', '갈등이 생겼을 때 회피보다 해결 규칙을 함께 만드는지', '돈·시간·가족 문제에서 한쪽만 반복해 희생하지 않는지'],
    focusVectors: ['attraction', 'romance', 'stability', 'long-term'],
    image: celestialCoupleImage, imageAlt: '은빛 별빛 아래 서로 마주 본 두 사람', focalPoint: '50% 42%', tone: 'silver'
  },
  'destined-love': {
    label: '운명연인', hanja: '運命戀人', shortLabel: '마음의 인연',
    hero: '감정의 문이 빠르게 열리는 사람.',
    description: '초기 끌림과 감정 교류가 선명하게 나타나는 관계를 살핍니다.',
    interpretation: '운명연인은 서로를 빠르게 의식하고 감정의 문이 열리기 쉬운 관계입니다. 다만 끌림의 강도와 오래 함께 살 수 있는 안정성은 다른 문제이므로, 실제 행동과 생활 리듬을 따로 확인해야 합니다.',
    observations: ['연락의 강도보다 약속을 실제로 지키는지', '호감 표현 이후에도 일관된 태도가 이어지는지', '관계의 속도를 늦춰도 존중과 관심이 유지되는지'],
    focusVectors: ['attraction', 'romance', 'stability'],
    image: destinedLoveImage, imageAlt: '달빛 아래 붉은 인연의 실을 건네는 운명연인', focalPoint: '50% 28%', tone: 'rose'
  },
  'life-benefactor': {
    label: '인생귀인', hanja: '人生貴人', shortLabel: '든든한 인연',
    hero: '정서적 안전과 편안함의 신호가 눈에 띄는 사람.',
    description: '정서적 안전과 회복을 돕는 관계 신호를 살핍니다.',
    interpretation: '인생귀인은 정답을 대신 내려주는 사람이 아니라, 흔들리는 순간에도 판단력을 되찾게 돕는 관계입니다. 편안함이 의존으로 바뀌지 않고 서로의 선택권을 지켜주는지가 중요합니다.',
    observations: ['힘든 일을 말했을 때 해결을 강요하지 않고 먼저 듣는지', '도움 뒤에 통제나 과도한 보답을 요구하지 않는지', '좋을 때뿐 아니라 불편한 상황에서도 태도가 안정적인지'],
    focusVectors: ['comfort', 'stability', 'long-term'],
    image: lifeBenefactorImage, imageAlt: '별의 길 앞에서 손을 내미는 인생의 안내자', focalPoint: '50% 25%', tone: 'gold'
  },
  'wealth-benefactor': {
    label: '재물귀인', hanja: '財物貴人', shortLabel: '현실의 인연',
    hero: '자원과 기회의 순환을 함께 살펴볼 사람.',
    description: '자원과 기회가 서로에게 어떻게 흐르는지 살핍니다.',
    interpretation: '재물귀인은 돈을 벌게 해준다는 보장이 아닙니다. 정보·기회·자원 배분에서 서로의 빈틈을 메우고, 거래 조건을 더 분명하게 만드는 관계인지 확인하는 분류입니다.',
    observations: ['좋은 제안보다 역할·비용·수익 배분을 구체적으로 말하는지', '함께한 뒤 수입뿐 아니라 시간과 위험도 함께 관리되는지', '금전 약속을 말이 아닌 문서와 일정으로 남기는지'],
    focusVectors: ['wealth-synergy', 'career-synergy', 'stability'],
    image: wealthBenefactorImage, imageAlt: '비취빛 문 너머 금빛 기회가 열리는 재물귀인', focalPoint: '50% 25%', tone: 'emerald'
  },
  'success-benefactor': {
    label: '성공귀인', hanja: '成功貴人', shortLabel: '도약의 인연',
    hero: '실행 방식과 의사결정의 보완 가능성이 보이는 사람.',
    description: '실행 방식과 의사결정이 서로를 밀어주는지 살핍니다.',
    interpretation: '성공귀인은 막연히 운을 올려주는 사람이 아니라, 목표를 실행 가능한 단계로 바꾸고 서로의 강점을 성과로 연결하기 쉬운 관계입니다. 성취 뒤 책임과 보상까지 공정한지 함께 봐야 합니다.',
    observations: ['피드백이 기분 평가보다 다음 행동을 선명하게 만드는지', '각자의 강점과 최종 결정권이 명확히 나뉘는지', '성과가 났을 때 공과 보상을 투명하게 나누는지'],
    focusVectors: ['career-synergy', 'wealth-synergy', 'long-term'],
    image: successBenefactorImage, imageAlt: '별의 계단과 성공의 방향을 보여주는 성공귀인', focalPoint: '50% 24%', tone: 'blue'
  },
  'growth-relation': {
    label: '성장인연', hanja: '成長因緣', shortLabel: '변화의 인연',
    hero: '서로의 변화 가능성을 더 살펴봐야 하는 사람.',
    description: '현재 엔진에서 직접 지원되는 실행·회복 근거를 중심으로 살핍니다.',
    interpretation: '성장인연은 불편함을 무조건 성장이라고 포장하지 않습니다. 서로의 선택 범위를 넓히고, 실패 후 다시 시도할 힘을 주며, 관계 밖의 삶까지 건강해지는지를 실제 행동으로 확인해야 합니다.',
    observations: ['함께한 뒤 새로운 시도와 배움이 실제로 늘어나는지', '실수를 지적할 때 존중과 대안이 함께 있는지', '관계 때문에 다른 중요한 관계나 생활 기반이 무너지지 않는지'],
    focusVectors: ['support', 'growth', 'comfort'],
    image: growthRelationImage, imageAlt: '햇빛과 녹음 속에서 손을 내미는 성장인연', focalPoint: '50% 28%', tone: 'jade'
  },
  'passion-relation': {
    label: '격정인연', hanja: '激情因緣', shortLabel: '뜨거운 인연',
    hero: '끌림이 크고 조정할 긴장도 함께 나타나는 사람.',
    description: '강한 끌림과 함께 관리해야 할 긴장도 같이 보여줍니다.',
    interpretation: '격정인연은 끌림이 빠르고 강하지만 생활 안정이나 갈등 회복은 별도로 확인해야 하는 관계입니다. 감정의 최고점에서 약속을 키우기보다, 평범한 날의 태도를 충분히 보는 편이 안전합니다.',
    observations: ['연락이 뜸해진 날에도 존중하는 방식으로 소통하는지', '질투·확인·통제 행동을 사랑으로 합리화하지 않는지', '큰 약속 전 최소 한 달의 일상 리듬을 함께 확인했는지'],
    focusVectors: ['attraction', 'romance', 'challenge', 'stability'],
    image: '/images/mz-love-fact/generated/attraction-spark.avif', imageAlt: '맞닿은 붉은 실 사이로 불꽃이 번지는 격정인연', focalPoint: '50% 35%', tone: 'crimson'
  },
  'caution-relation': {
    label: '악연주의', hanja: '關係注意', shortLabel: '경계의 인연',
    hero: '강하게 끌리더라도 거리와 경계가 필요한 사람.',
    description: '관계의 실패를 단정하지 않고 조정 압력이 큰 지점을 알려줍니다.',
    interpretation: '악연주의는 상대를 나쁜 사람으로 단정하는 판정이 아닙니다. 두 사람 사이에서 긴장과 소모가 반복될 가능성을 먼저 살피라는 경계 표시이며, 실제 안전과 존중은 현실의 행동을 기준으로 판단해야 합니다.',
    observations: ['거절했을 때 설득보다 경계를 존중하는지', '사과 뒤 같은 행동이 반복되는지 실제 기록으로 확인했는지', '두려움·고립·금전 압박이 있다면 관계 밖 도움을 요청할 수 있는지'],
    focusVectors: ['challenge', 'stability', 'comfort', 'attraction'],
    image: cautionRelationImage, imageAlt: '깨진 거울과 얽힌 붉은 실로 경계를 알리는 인연', focalPoint: '50% 27%', tone: 'burgundy'
  }
};
