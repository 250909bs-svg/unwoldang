/**
 * 운월당 재회운 웹툰 랜딩 — 패널 아트 슬롯 (아트 교체 지점은 이 파일 하나뿐).
 *
 * 지금 연결된 그림은 원본 5장에서 파생한 임시 컷이다.
 * 나중에 완성 포스터 아트가 들어오면 아래 두 곳만 고치면 교체가 끝난다.
 *   1) reunionPanelImages 에 새 키 한 줄 추가 (파일은 public/assets/reunion/panels/ 에 -640 / -960 두 벌)
 *   2) reunionPanelArt 의 해당 패널에서 image / role / alt 세 줄 교체
 *
 * role 의 뜻:
 *   'scene'  = 배경 그림만 넣고 글자는 HTML 로 얹는다. alt 는 장면 묘사.
 *   'poster' = 그림 안에 이미 문구가 박혀 있다. alt 에 그 문구를 그대로 적어
 *              스크린리더와 검색엔진이 읽을 수 있게 한다.
 *
 * 주의: src/features/reunion/assets.ts 는 계약 테스트가 키 목록을 정확 비교하므로
 * 절대 건드리지 않는다. 패널용 에셋은 이 파일에서만 관리한다.
 */

export type ReunionPanelKey =
  | 'hero'
  | 'man'
  | 'woman'
  | 'thread'
  | 'moon'
  | 'dawn'
  | 'hands'
  | 'gate'
  | 'phones'
  | 'letter'
  | 'knot'
  | 'reflect'
  | 'reflectClose'
  | 'moveOn'
  | 'moveOnClose';

export type ReunionPanelAsset = {
  src: string;
  srcSet: string;
  sizes: string;
};

const panelAsset = (fileName: string): ReunionPanelAsset => ({
  src: `/assets/reunion/panels/${fileName}-960.webp`,
  srcSet: `/assets/reunion/panels/${fileName}-640.webp 640w, /assets/reunion/panels/${fileName}-960.webp 960w`,
  sizes: '(max-width: 680px) 100vw, 960px'
});

export const reunionPanelImages: Readonly<Record<ReunionPanelKey, ReunionPanelAsset>> = Object.freeze({
  hero: panelAsset('p-hero'),
  man: panelAsset('p-man'),
  woman: panelAsset('p-woman'),
  thread: panelAsset('p-thread'),
  moon: panelAsset('p-moon'),
  dawn: panelAsset('p-dawn'),
  hands: panelAsset('p-hands'),
  phones: panelAsset('p-phones'),
  letter: panelAsset('p-letter'),
  knot: panelAsset('p-knot'),
  reflect: panelAsset('p-reflect'),
  reflectClose: panelAsset('p-reflect-cl'),
  moveOn: panelAsset('p-moveon'),
  /* gate · moveOnClose 는 아트 교체용 예비 슬롯이다. 지금 reunionPanelArt 20슬롯 어디에서도
     쓰지 않으므로 브라우저가 받지는 않지만, public/ 의 네 파일(합계 134.7KB)은 배포에 그대로 실린다.
     계속 쓸 계획이 없다면 여기 두 줄과 p-gate-640/960.webp, p-moveon-cl-640/960.webp 를 함께 지울 것. */
  gate: panelAsset('p-gate'),
  moveOnClose: panelAsset('p-moveon-cl')
});

export function getReunionPanelImage(key: ReunionPanelKey): ReunionPanelAsset {
  return reunionPanelImages[key];
}

export type ReunionPanelId =
  | '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10'
  | '11' | '12' | '13' | '14' | '15' | '16' | '17' | '18' | '19' | '20';

export type ReunionPanelArtRole = 'poster' | 'scene';

export type ReunionPanelArt = {
  /** null 이면 그림 없이 타이포그래피와 인라인 SVG 로만 세우는 패널이다. */
  image: ReunionPanelKey | null;
  role: ReunionPanelArtRole;
  /** 장식 컷이면 '' 로 두고 decorative 를 켠다. poster 면 그림 속 문구를 그대로 적는다. */
  alt: string;
  decorative?: boolean;
  /** 첫 화면 한 장만 eager. 나머지는 lazy. */
  eager?: boolean;
  /** 발주자가 이 주석을 보고 교체용 이미지를 생성할 수 있어야 한다. */
  brief: string;
};

export const reunionPanelArt: Readonly<Record<ReunionPanelId, ReunionPanelArt>> = Object.freeze({
  '01': {
    image: 'hero',
    role: 'scene',
    alt: '보름달 아래 붉은 실을 사이에 두고 등을 돌린 두 사람',
    eager: true,
    brief:
      '표지. 세로 4:5. 보름달과 야경 궁궐을 배경으로 두 사람이 서로 등을 돌리고 서 있고 그 사이를 붉은 실이 잇는다. 꽃잎이 흩날린다. 글자는 HTML 로 얹으므로 화면 위쪽 1/3 은 인물 없이 비워 둘 것. 교체 우선순위 1순위.'
  },
  '02': {
    image: 'reflectClose',
    role: 'scene',
    alt: '',
    decorative: true,
    brief:
      '침묵 컷 텍스처. 가로로 긴 21:9. 강하게 블러 처리해 깔 배경이라 형태만 남으면 된다. 어두운 실내, 창가의 옆얼굴 클로즈업.'
  },
  '03': {
    image: 'reflect',
    role: 'scene',
    alt: '밤 창가에서 휴대폰을 든 채 멈춰 있는 사람',
    brief:
      '말풍선 두 개가 올라갈 무대. 정사각 1:1. 밤 창가에서 휴대폰 화면을 내려다보며 멈춘 인물. 말풍선이 좌상단과 우하단에 얹히므로 그 두 자리는 비교적 단순하게 비워 둘 것.'
  },
  '04': {
    image: 'phones',
    role: 'scene',
    alt: '어두운 탁자 위 휴대폰 두 대를 잇는 붉은 실과 봉랍이 찍힌 편지',
    brief:
      '가로 16:10. 어두운 탁자 위에 휴대폰 두 대가 놓이고 붉은 실이 둘을 잇는다. 화면은 꺼져 있거나 알아볼 수 없어야 한다(가짜 대화 내용 금지).'
  },
  '05': {
    image: 'thread',
    role: 'scene',
    alt: '',
    decorative: true,
    brief:
      '침묵 컷. 가로 21:9. 두 손 사이를 잇던 붉은 실이 끊어지는 순간의 클로즈업. 불꽃이 튄다. 진홍 틴트가 얹힌다.'
  },
  '06': {
    image: 'man',
    role: 'scene',
    alt: '어둠 속에 서 있는 사람의 옆모습',
    brief:
      '상단 밴드. 3:2. 어둡게 그레이딩된 인물 단독 컷. 아래에 목록이 길게 붙으므로 얼굴이 밴드 위쪽에 걸리도록 구도를 잡을 것.'
  },
  '07': {
    image: 'moon',
    role: 'scene',
    alt: '',
    decorative: true,
    brief:
      '장 구분 명판 밴드. 가로로 아주 납작한 5:2. 보름달과 기와 처마. 인물 없음. 명판 글자가 위에 얹히므로 가운데는 단순해야 한다.'
  },
  '08': { image: null, role: 'scene', alt: '', brief: '그림 없음. 원칙 3카드 — 타이포그래피와 lucide 아이콘만.' },
  '09': { image: null, role: 'scene', alt: '', brief: '그림 없음. 추측 대 확인 비교표 — 타이포그래피와 인라인 SVG 만.' },
  '10': { image: null, role: 'scene', alt: '', brief: '그림 없음. 만들지 않는 문장 목록 — 취소선과 검열 베일 CSS 만.' },
  '11': {
    image: 'woman',
    role: 'scene',
    alt: '달을 등지고 돌아보는 사람',
    brief:
      '안전 고지 패널. 세로 4:5. 달을 등지고 조용히 돌아보는 인물. 몰아붙이지 않는 차분한 표정이어야 한다. 이 패널만 프레임이 초록 계열이므로 붉은 기가 과하지 않은 컷이 좋다.'
  },
  '12': {
    image: 'letter',
    role: 'scene',
    alt: '',
    decorative: true,
    brief: '장 구분 명판 밴드. 16:9. 봉랍이 찍힌 편지가 놓인 정물. 인물 없음.'
  },
  '13': { image: null, role: 'scene', alt: '', brief: '그림 없음. 입력값과 계산 근거를 나눈 두 칸 — 마스킹된 예시 화면.' },
  '14': {
    image: 'knot',
    role: 'scene',
    alt: '',
    decorative: true,
    brief:
      '명식 샘플의 배경. 정사각에 가까운 cover. 붉은 매듭 노리개와 술. 강하게 블러되고 어두워지므로 형태만 남으면 된다.'
  },
  '15': { image: null, role: 'scene', alt: '', brief: '그림 없음. 연락 상태 5분기 카드 — 타이포그래피와 칩만.' },
  '16': { image: null, role: 'scene', alt: '', brief: '그림 없음. 빈 게이지와 행동 타임라인 — 인라인 SVG 와 CSS 만.' },
  '17': {
    image: 'moon',
    role: 'scene',
    alt: '',
    decorative: true,
    brief:
      '시기 띠의 배경 텍스처. cover. 07 과 같은 달 그림을 블러와 저휘도로 완전히 다르게 처리해 쓴다. 교체할 때도 07 과 다른 처리를 유지할 것.'
  },
  '18': {
    image: 'hands',
    role: 'scene',
    alt: '새벽빛 속에서 마주 뻗은 두 손',
    brief:
      '새벽 전환 컷. 16:9. 여기서부터 화면이 한 단계 밝아진다. 저채도로 빼지 말고 따뜻한 새벽빛을 살릴 것. 두 손이 아직 닿지는 않은 상태.'
  },
  '19': {
    image: 'moveOn',
    role: 'scene',
    alt: '달문 너머 새벽으로 걸어가는 사람과 앞에 놓인 편지',
    brief:
      '페이지에서 유일하게 크롭 없이 통째로 보여주는 마침표 컷. 세로 4:5. 각자의 길로 걸어가는 장면. 18 컷 내내 잘라 쓰다가 마지막에 한 장을 다 보여주는 자리이므로 가장 완성도가 높아야 한다. 교체 우선순위 2순위.'
  },
  '20': {
    image: 'dawn',
    role: 'scene',
    alt: '',
    decorative: true,
    brief:
      '최종 CTA 의 배경. cover. 새벽, 열린 문, 일출. 어둡게 깔리고 글자가 위에 얹히므로 가운데는 단순해야 한다. 교체 우선순위 3순위.'
  }
});
