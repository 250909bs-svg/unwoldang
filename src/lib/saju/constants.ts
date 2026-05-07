export const TG = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'] as const;
export const DZ = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'] as const;
export const ZODIAC_ANIMALS = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'] as const;
export const ELEM_ORDER = ['목', '화', '토', '금', '수'] as const;

export type HeavenlyStem = (typeof TG)[number];
export type EarthlyBranch = (typeof DZ)[number];
export type FiveElement = (typeof ELEM_ORDER)[number];

export const ELEMENT: Record<HeavenlyStem, FiveElement> = {
  갑: '목',
  을: '목',
  병: '화',
  정: '화',
  무: '토',
  기: '토',
  경: '금',
  신: '금',
  임: '수',
  계: '수'
};

export const BRANCH_ELEM: Record<EarthlyBranch, FiveElement> = {
  자: '수',
  축: '토',
  인: '목',
  묘: '목',
  진: '토',
  사: '화',
  오: '화',
  미: '토',
  신: '금',
  유: '금',
  술: '토',
  해: '수'
};

export const YANG_TG_IDX = new Set([0, 2, 4, 6, 8]);
export const YANG_DZ_IDX = new Set([0, 2, 4, 6, 8, 10]);

export const ELEM_NEXT: Record<FiveElement, FiveElement> = {
  목: '화',
  화: '토',
  토: '금',
  금: '수',
  수: '목'
};

export const ELEM_CTRL: Record<FiveElement, FiveElement> = {
  목: '토',
  화: '금',
  토: '수',
  금: '목',
  수: '화'
};

export const ELEM_PREV: Record<FiveElement, FiveElement> = {
  화: '목',
  토: '화',
  금: '토',
  수: '금',
  목: '수'
};

export const CTRL_BY: Record<FiveElement, FiveElement> = {
  목: '금',
  화: '수',
  토: '목',
  금: '화',
  수: '토'
};

export const MONTH_STRONG: Record<EarthlyBranch, FiveElement> = {
  인: '목',
  묘: '목',
  사: '화',
  오: '화',
  신: '금',
  유: '금',
  해: '수',
  자: '수',
  진: '토',
  술: '토',
  축: '토',
  미: '토'
};

export const TIANYI: Record<HeavenlyStem, Set<EarthlyBranch>> = {
  갑: new Set(['축', '미']),
  을: new Set(['자', '신']),
  병: new Set(['해', '유']),
  정: new Set(['해', '유']),
  무: new Set(['축', '미']),
  기: new Set(['자', '신']),
  경: new Set(['축', '미']),
  신: new Set(['인', '오']),
  임: new Set(['묘', '사']),
  계: new Set(['묘', '사'])
};

export const HIDDEN_STEMS: Record<EarthlyBranch, number[]> = {
  자: [9],
  축: [9, 7, 5],
  인: [4, 2, 0],
  묘: [1],
  진: [1, 9, 4],
  사: [4, 6, 2],
  오: [5, 3],
  미: [3, 1, 5],
  신: [4, 8, 6],
  유: [7],
  술: [7, 3, 4],
  해: [0, 8]
};

export const ELEM_COLORS: Record<FiveElement, string> = {
  목: '#6aa84f',
  화: '#e06666',
  토: '#c9a86a',
  금: '#6d9eeb',
  수: '#76a5af'
};

export const TEN_GOD_LABELS = [
  '비견',
  '겁재',
  '식신',
  '상관',
  '편재',
  '정재',
  '편관',
  '정관',
  '편인',
  '정인'
] as const;

export type TenGodLabel = (typeof TEN_GOD_LABELS)[number];

export const TEN_GOD_MEANINGS: Record<TenGodLabel, string> = {
  비견: '자기 확신, 독립심, 추진력',
  겁재: '승부욕, 경쟁심, 동료와의 긴장',
  식신: '생산성, 생활력, 꾸준한 결과',
  상관: '표현력, 아이디어, 강한 자기표현',
  편재: '빠른 돈 흐름, 사업 감각, 외부 기회',
  정재: '안정적인 재정, 현실 감각, 관리 능력',
  편관: '압박 속 돌파력, 카리스마, 승부처 대응',
  정관: '질서, 책임감, 신뢰, 직업적 안정',
  편인: '직감, 연구, 남다른 관점, 몰입력',
  정인: '학습력, 문서운, 보호운, 회복력'
};

export const DAY_MASTER_KEYWORDS: Record<HeavenlyStem, string[]> = {
  갑: ['곧음', '리더십', '성장', '의리', '개척'],
  을: ['유연함', '섬세함', '적응력', '배려', '감성'],
  병: ['열정', '표현력', '낙관성', '주목성', '활력'],
  정: ['집중력', '감수성', '내면의 불꽃', '섬세함', '헌신'],
  무: ['중심감', '신뢰', '버팀목', '안정', '원칙'],
  기: ['실용성', '보살핌', '관리력', '현실감', '조율'],
  경: ['결단력', '정의감', '개혁성', '직선적 태도', '실행력'],
  신: ['정교함', '미감', '완성도', '세련됨', '정리력'],
  임: ['유연성', '지혜', '확장성', '통찰', '네트워크'],
  계: ['예민함', '관찰력', '공감', '지성', '기획력']
};

export const DAY_MASTER_DESCRIPTIONS: Record<HeavenlyStem, string> = {
  갑: '큰 나무처럼 방향을 세우고 사람을 이끄는 힘이 강합니다.',
  을: '덩굴과 꽃처럼 부드럽게 연결하고 분위기를 살리는 재능이 있습니다.',
  병: '태양처럼 존재감이 분명하고 밝은 추진력으로 판을 움직입니다.',
  정: '촛불처럼 작지만 깊은 집중력으로 오래 빛나는 타입입니다.',
  무: '산처럼 든든하고 쉽게 흔들리지 않는 책임감을 지녔습니다.',
  기: '비옥한 흙처럼 사람과 일을 키워내는 생활력이 강합니다.',
  경: '쇠처럼 단단하고 결정을 내릴 때 빠르고 분명합니다.',
  신: '보석처럼 정교하고 감각적인 완성도를 추구합니다.',
  임: '큰 바다처럼 시야가 넓고 변화에 유연합니다.',
  계: '이슬비처럼 섬세하게 스며들며 사람의 마음을 읽는 힘이 있습니다.'
};

export const DAY_BRANCH_KEYWORDS: Record<EarthlyBranch, string[]> = {
  자: ['기민함', '순발력', '시작', '정보감각', '생존력'],
  축: ['인내', '축적', '버팀', '신중함', '현실감'],
  인: ['도전', '개척', '직진', '자존감', '리더십'],
  묘: ['배려', '미감', '소통', '감수성', '친화력'],
  진: ['확장', '권한', '전환', '책임감', '스케일'],
  사: ['지성', '판단', '기획', '정리', '전략'],
  오: ['열정', '표현', '속도', '매력', '주목'],
  미: ['조화', '중재', '배려', '정성', '생활감'],
  신: ['재능', '기술', '응용', '재치', '감각'],
  유: ['정교함', '기준', '디테일', '완성도', '미적감각'],
  술: ['의리', '책임', '충성', '마무리', '원칙'],
  해: ['상상력', '포용', '시작 전 준비', '직감', '확장']
};

export const DAY_BRANCH_DESCRIPTIONS: Record<EarthlyBranch, string> = {
  자: '자수의 기운은 빠르게 읽고 먼저 움직이는 감각을 만듭니다.',
  축: '축토의 기운은 오래 버티고 차곡차곡 쌓는 힘으로 나타납니다.',
  인: '인목의 기운은 새로운 판을 열고 전진하려는 에너지로 이어집니다.',
  묘: '묘목의 기운은 부드러운 설득력과 관계 감각을 키웁니다.',
  진: '진토의 기운은 변곡점에서 책임을 떠안고 판을 키우는 힘입니다.',
  사: '사화의 기운은 분석력, 판단력, 전략적 사고로 드러납니다.',
  오: '오화의 기운은 존재감과 표현력, 감정의 직진성으로 나타납니다.',
  미: '미토의 기운은 세심한 배려와 정리된 생활감으로 이어집니다.',
  신: '신금의 기운은 손재주와 기술 응용, 빠른 눈치로 드러납니다.',
  유: '유금의 기운은 기준을 세우고 결과를 매끄럽게 다듬는 힘입니다.',
  술: '술토의 기운은 끝까지 책임지는 태도와 의리로 이어집니다.',
  해: '해수의 기운은 상상력, 포용력, 넓은 시야로 나타납니다.'
};
