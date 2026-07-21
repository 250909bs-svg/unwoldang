export const GENERAL_SIGNATURE_ID = 'general-signature' as const;
export const GENERAL_SIGNATURE_DISPLAY_NAME = '운월선생 정통 종합사주' as const;
export const GENERAL_SIGNATURE_DETAIL_PATH = '/detail/general-saju' as const;
export const GENERAL_SIGNATURE_FORM_PATH = `/form/${GENERAL_SIGNATURE_ID}` as const;
export const GENERAL_SIGNATURE_REPORT_PATH = `/report/${GENERAL_SIGNATURE_ID}` as const;

export const GENERAL_SIGNATURE_PRODUCT = {
  id: GENERAL_SIGNATURE_ID,
  displayName: GENERAL_SIGNATURE_DISPLAY_NAME,
  paths: {
    detail: GENERAL_SIGNATURE_DETAIL_PATH,
    form: GENERAL_SIGNATURE_FORM_PATH,
    report: GENERAL_SIGNATURE_REPORT_PATH
  },
  detail: {
    eyebrow: '운월당 대표 리포트 · 정통 종합사주 감정',
    hero: {
      titleLines: ['종합사주 풀이:', '타고난 성향부터 지금의 대운까지'],
      description: '원국·월령·오행·십성에서 시작해 직업, 재물, 연애와 현재 대운을 하나의 흐름으로 연결합니다. 명리 근거와 현실 행동을 함께 확인하는 개인 맞춤 종합사주 리포트입니다.',
      trustItems: ['만세력 코드 계산', '명리 근거 표시', '결과 저장·다시보기']
    },
    definition: {
      title: '인생을 한 줄로 단정하지 않고, 여러 근거를 함께 읽는 분석',
      body: '사주팔자는 태어난 네 기둥을 계산하는 출발점입니다. 운월당은 한 글자나 신살 하나로 결과를 정하지 않습니다. 월령과 일간의 관계, 오행과 십신의 분포, 합충형파, 현재 대운과 세운이 같은 방향을 가리키는지 교차 확인한 뒤 고객의 일과 관계에서 이해할 수 있는 문장으로 풀어냅니다.'
    },
    areasIntro: {
      label: '한 번에 확인하는 아홉 영역',
      title: '성향부터 대운까지 따로 놀지 않게 연결합니다',
      body: '좋은 운과 나쁜 운을 세는 대신, 어떤 조건에서 강점이 살아나고 무엇을 먼저 조정해야 하는지 확인합니다.'
    },
    methodIntro: {
      title: '사주 계산과 설명 문장을 분리해 검증합니다',
      body: '자동 생성 문장이 명식을 바꾸지 못하도록 계산, 판정, 표현과 검증의 단계를 나눕니다. 결과에는 확인 가능한 근거를 붙이고 단정할 수 없는 내용은 조건과 가능성으로 표시합니다.'
    },
    safetyNote: '질병·수명·사고를 예언하거나 타인의 마음을 사실처럼 만들지 않습니다. 명리 해석은 선택을 돕는 참고 자료이며 의료·법률·재정 판단을 대신하지 않습니다.',
    preview: {
      title: '내 결과에서 열리는 종합사주 목차',
      disclaimer: '실제 문장과 우선순위는 입력한 명식, 현재 상황과 질문에 따라 달라집니다.',
      principleTitle: '결론 → 근거 → 다른 가능성 → 행동 순서로 읽힙니다',
      principleBody: '어려운 명리 용어만 길게 늘어놓지 않습니다. 먼저 핵심을 말하고 왜 그렇게 읽었는지, 반대로 나타날 가능성은 무엇인지, 현실에서 무엇을 확인하면 되는지 순서대로 설명합니다.'
    },
    offer: {
      body: '성향·직업·재물·연애·대운과 질문 두 가지를 하나의 개인 리포트로 정리합니다.'
    },
    readingAreas: [
      {
        id: 'temperament',
        title: '타고난 기질과 강점',
        copy: '일간과 월령을 함께 읽어 자연스럽게 잘하는 방식, 쉽게 지치는 조건, 회복에 필요한 기준을 구분합니다.',
        icon: 'sparkles'
      },
      {
        id: 'elements',
        title: '오행의 분포와 균형',
        copy: '목·화·토·금·수의 상대 분포와 계절 보정을 계산해 강한 기운, 부족한 기운, 보완 순서를 확인합니다.',
        icon: 'orbit'
      },
      {
        id: 'ten-gods',
        title: '십신과 역할 패턴',
        copy: '비겁·식상·재성·관성·인성이 일, 돈, 책임, 표현, 관계에서 어떤 역할로 드러나는지 근거와 함께 읽습니다.',
        icon: 'book'
      },
      {
        id: 'relationships',
        title: '관계와 경계',
        copy: '사람을 대하는 기본 온도, 책임을 떠안는 장면, 편한 관계와 소모되는 관계의 차이를 정리합니다.',
        icon: 'relations'
      },
      {
        id: 'career',
        title: '직업과 일의 구조',
        copy: '직업 이름 하나를 찍기보다 성과가 붙는 역할, 조직과 독립 중 맞는 환경, 이직·확장 전 확인할 조건을 제시합니다.',
        icon: 'career'
      },
      {
        id: 'wealth',
        title: '재물과 선택 습관',
        copy: '돈이 들어오는 방식과 새는 패턴, 가격·정산·소비에서 반복되는 장면을 재성과 식상의 흐름에 연결합니다.',
        icon: 'money'
      },
      {
        id: 'love-marriage',
        title: '연애·결혼의 현실 조건',
        copy: '끌리는 사람과 오래 갈 사람의 차이, 관계를 안정시키는 생활 기준, 결혼 전 확인할 조건을 살핍니다.',
        icon: 'love'
      },
      {
        id: 'timing',
        title: '대운·세운의 현재 흐름',
        copy: '평생을 고정된 운명으로 보지 않고 현재 대운과 세운이 원국의 어느 부분을 크게 움직이는지 확인합니다.',
        icon: 'timing'
      },
      {
        id: 'questions-actions',
        title: '질문 2개와 행동 가이드',
        copy: '실제 고민 두 가지를 계산 근거에 연결하고 오늘, 30일, 90일 순서로 확인할 행동과 멈출 행동을 정리합니다.',
        icon: 'questions'
      }
    ],
    reportFlow: [
      {
        number: '01',
        title: '명식 계산',
        copy: '양력·음력, 윤달, 출생지, 출생 시각과 23시 경계 정책을 고정해 연주·월주·일주·시주를 계산합니다.'
      },
      {
        number: '02',
        title: '근거 교차 확인',
        copy: '월령, 오행, 십신, 합충형파와 현재 대운·세운에서 같은 방향을 가리키는 신호를 먼저 고정합니다.'
      },
      {
        number: '03',
        title: '생활 서사로 해석',
        copy: '잠긴 계산 사실을 바꾸지 않은 채 기질·관계·직업·재물·연애·결혼의 실제 선택 언어로 번역합니다.'
      },
      {
        number: '04',
        title: '질문과 행동 연결',
        copy: '질문 2개에 각각 근거를 연결하고 지금 할 일, 30일 점검, 90일 방향을 리포트와 재열람 화면에 남깁니다.'
      }
    ],
    reportChapters: [
      '기질과 강점: 일간·월령의 핵심',
      '오행 분포와 균형',
      '십신과 반복 역할',
      '관계와 경계의 기준',
      '직업과 일하는 방식',
      '재물 흐름과 선택 습관',
      '연애·결혼의 현실 조건',
      '현재 대운과 세운',
      '질문 2개의 맞춤 해답',
      '오늘·30일·90일 행동 가이드'
    ]
  },
  intake: {
    questionSuggestions: {
      q1: [
        '지금 제 기질과 강점 중 가장 먼저 써야 할 것은 무엇인가요?',
        '직업과 재물 흐름을 함께 볼 때 지금 우선할 선택은 무엇인가요?',
        '관계에서 반복되는 제 역할과 먼저 세워야 할 경계는 무엇인가요?',
        '현재 대운과 세운에서 가장 크게 열리는 기회는 어느 쪽인가요?'
      ],
      q2: [
        '연애와 결혼에서 제가 꼭 확인해야 할 현실 조건은 무엇인가요?',
        '앞으로 30일과 90일에 각각 실행할 행동을 알려주세요.',
        '오행과 십신의 불균형을 생활에서 어떻게 보완하면 좋을까요?',
        '지금 멈춰야 할 선택과 계속 밀어도 되는 선택을 구분해 주세요.'
      ]
    },
    relationshipCopy: {
      title: '현재 관계 맥락을 알려주세요',
      body: '관계 상태는 연애운만이 아니라 책임, 경계, 생활 리듬을 해석하는 맥락으로 사용합니다.',
      durationCaption: '연애 중·기혼만 현재 관계 기간이 필수입니다. 솔로·썸·애매한 관계·이별·재회는 기억나는 경우에만 골라도 됩니다.'
    },
    questions: {
      q1: {
        title: '첫 번째 질문을 적어주세요',
        body: '기질·관계·직업·재물 중 지금 가장 먼저 결론이 필요한 질문을 적으면 계산 근거와 함께 답합니다.',
        placeholder: '예: 직업과 재물 흐름을 함께 볼 때 지금 우선할 선택은 무엇인가요?',
        helper: '상황과 선택지를 함께 적을수록 질문 해설과 행동 순서가 선명해집니다.'
      },
      q2: {
        title: '두 번째 질문으로 시기와 행동을 연결해 주세요',
        body: '첫 질문과 다른 영역이나 시기 질문을 더하면 대운·세운과 30일·90일 행동 가이드를 폭넓게 구성합니다.',
        placeholder: '예: 앞으로 30일과 90일에 각각 실행할 행동을 알려주세요.',
        helper: '첫 질문과 다른 방향—관계·일·돈·연애·시기—을 고르면 리포트의 폭이 넓어집니다.'
      }
    },
    policies: [
      {
        id: 'calendar',
        title: '양력·음력',
        body: '출생 기록에 적힌 달력 기준을 선택합니다. 음력은 1900~2099년 범위에서 입력한 날짜를 양력으로 변환한 뒤 명식을 계산합니다.'
      },
      {
        id: 'leap-month',
        title: '윤달',
        body: '출생 기록이 윤달이라고 확인된 경우에만 켭니다. 선택한 해와 달에 실제 윤달이 없으면 계산 전 검증에서 진행을 막습니다.'
      },
      {
        id: 'unknown-time',
        title: '시간 미상',
        body: '시주를 임의로 채우지 않습니다. 12지지와 자시 양쪽을 포함한 13개 시나리오를 비교하고 달라지는 결론은 불확실성으로 표시합니다.'
      },
      {
        id: 'day-boundary',
        title: '23시 경계',
        body: '기본값은 달력상 자정 기준입니다. 출생 기록이나 적용 학파가 분명할 때만 진태양시 보정 후 23:00~23:59를 다음 날로 보는 야자시 기준을 선택합니다.'
      }
    ],
    defaultDayBoundaryPolicy: 'midnight'
  },
  checkout: {
    eyebrow: '계산 기준을 잠그는 마지막 확인',
    title: '종합사주 전체 리포트',
    benefit: '계산 근거와 생활 해설, 질문 2개, 행동 가이드를 한 번에 열어요',
    contractTitle: '결제 전에 확인할 리포트 구성',
    stages: [
      '명식·오행·십신 계산값 고정',
      '관계·직업·재물·연애·결혼 해설',
      '대운·세운과 질문 2개 연결',
      '오늘·30일·90일 행동 가이드'
    ],
    securityNote: '상품 ID와 결제 금액, 리포트 접근 권한은 서버가 다시 확인하며 브라우저 값만으로 승인하지 않습니다.'
  },
  loading: {
    phases: [
      { label: '명식 계산', layer: 'calculation' },
      { label: '오행·십신', layer: 'calculation' },
      { label: '질문 해설', layer: 'narrative' },
      { label: '행동 가이드', layer: 'narrative' }
    ],
    aiMessages: [
      '입력 정책을 고정하고 명식 계산값을 확인하고 있습니다.',
      '오행·십신과 대운·세운 근거를 교차 검증하고 있습니다.',
      '잠긴 계산 사실을 바꾸지 않고 질문 2개의 해설을 구성하고 있습니다.',
      '기질부터 행동 가이드까지 종합사주 흐름을 연결하고 있습니다.'
    ],
    deterministicMessages: [
      '입력 정책을 고정하고 명식 계산값을 확인하고 있습니다.',
      '오행·십신과 대운·세운 근거를 교차 검증하고 있습니다.',
      '검증된 내부 명리 문장으로 질문 2개를 연결하고 있습니다.',
      '기질부터 행동 가이드까지 종합사주 흐름을 연결하고 있습니다.'
    ]
  },
  report: {
    pageCopy: {
      coverTitle: '종합사주 리포트',
      summaryCaption: '사주 전체 구조와 지금 가장 중요한 선택 기준을 먼저 정리했습니다.',
      qaTitle: '질문 2개 맞춤 해답',
      qaCaption: '입력한 질문을 원국, 오행·십신, 대운·세운의 계산 근거와 연결해 읽었습니다.',
      glanceTitle: '계산된 사주 원국 핵심 지표',
      glanceCaption: 'AI 해설에 앞서 원국, 오행, 십신과 계산 정책을 먼저 확인합니다.',
      tocTitle: '기질부터 행동 가이드까지 전체 흐름'
    },
    tracks: [
      { id: 'temperament', label: '기질', description: '일간·월령에서 읽는 강점과 회복 조건', anchor: 'trait' },
      { id: 'elements', label: '오행', description: '계절 보정을 포함한 상대 분포와 보완 순서', anchor: 'element' },
      { id: 'ten-gods', label: '십신', description: '표출 십신과 지장간 분포가 만드는 역할 패턴', anchor: 'ten' },
      { id: 'relationships', label: '관계', description: '책임, 경계, 반복되는 관계 장면', anchor: 'detailRel' },
      { id: 'career', label: '직업', description: '성과가 붙는 역할과 일하는 환경', anchor: 'career' },
      { id: 'wealth', label: '재물', description: '수입·소비·정산에서 반복되는 선택', anchor: 'money' },
      { id: 'love-marriage', label: '연애·결혼', description: '끌림과 장기 관계의 현실 조건', anchor: 'love' },
      { id: 'timing', label: '대운·세운', description: '현재 10년과 해마다 달라지는 우선순위', anchor: 'fortune' },
      { id: 'questions', label: '질문 2개', description: '두 질문에 각각 연결한 근거와 답', anchor: 'qa' },
      { id: 'actions', label: '행동 가이드', description: '오늘·30일·90일의 실행과 중단 기준', anchor: 'plan' }
    ]
  }
} as const;

export type GeneralSignatureReportTrack = (typeof GENERAL_SIGNATURE_PRODUCT.report.tracks)[number];
