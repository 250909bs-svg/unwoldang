import type { EarthlyBranch } from '../saju/constants';
import { BRANCH_ELEM } from '../saju/constants';
import type { FiveElement, SajuReportData } from '../saju/report';

export type PartnerAppearanceImageFamily = 'soft' | 'sleek' | 'strong' | 'deep';

export type PartnerAppearanceArchetypeId =
  | 'tofu'
  | 'cat'
  | 'dog'
  | 'dinosaur'
  | 'deer'
  | 'fox'
  | 'deep-contour';

export type PartnerAppearanceArchetype = {
  id: PartnerAppearanceArchetypeId;
  label: string;
};

export type PartnerAppearanceEvidence = {
  source: 'spouse-palace' | 'day-master' | 'helpful-element' | 'dominant-ten-god';
  label: string;
  value: string;
};

export type PartnerAppearanceProfile = {
  version: 'partner-appearance-v1';
  signatureKey: string;
  spousePalace: {
    pillar: string;
    branch: EarthlyBranch;
    element: FiveElement;
  };
  imageFamily: PartnerAppearanceImageFamily;
  primaryArchetype: PartnerAppearanceArchetype;
  secondaryArchetype: PartnerAppearanceArchetype;
  headline: string;
  height: string;
  build: string;
  faceShape: string;
  eyes: string;
  brows: string;
  nose: string;
  lips: string;
  complexion: string;
  hair: string;
  style: string;
  evidence: PartnerAppearanceEvidence[];
  traits: string[];
  disclosure: string;
};

type BranchAppearanceSeed = Omit<
  PartnerAppearanceProfile,
  | 'version'
  | 'signatureKey'
  | 'spousePalace'
  | 'headline'
  | 'evidence'
  | 'traits'
  | 'disclosure'
>;

const ARCHETYPES: Record<PartnerAppearanceArchetypeId, PartnerAppearanceArchetype> = {
  tofu: { id: 'tofu', label: '두부상' },
  cat: { id: 'cat', label: '고양이상' },
  dog: { id: 'dog', label: '강아지상' },
  dinosaur: { id: 'dinosaur', label: '공룡상' },
  deer: { id: 'deer', label: '사슴상' },
  fox: { id: 'fox', label: '여우상' },
  'deep-contour': { id: 'deep-contour', label: '깊은 눈매·입체 윤곽형' }
};

/**
 * The twelve spouse-palace branches deliberately cover all four image
 * families three times. This gives the portrait layer visual range without
 * relying on a volatile seed or on customer-identifying text.
 */
const BRANCH_APPEARANCE: Record<EarthlyBranch, BranchAppearanceSeed> = {
  자: {
    imageFamily: 'sleek',
    primaryArchetype: ARCHETYPES.cat,
    secondaryArchetype: ARCHETYPES.deer,
    height: '평균권에서 선이 길어 보이는 키감',
    build: '가볍고 민첩해 보이는 균형형 체형',
    faceShape: '턱 끝이 매끈한 좁은 타원형 얼굴',
    eyes: '가로선이 길고 안쪽에 깊이가 느껴지는 눈매',
    brows: '결이 가지런하고 길게 정돈된 눈썹',
    nose: '폭이 슬림하고 선이 곧은 코',
    lips: '윤곽이 또렷하고 차분하게 다물리는 입술',
    complexion: '차분하고 맑은 인상을 주는 피부 분위기',
    hair: '윤기가 돌며 선이 매끈한 헤어',
    style: '군더더기 없는 실루엣과 작은 포인트가 어울리는 도시적 스타일'
  },
  축: {
    imageFamily: 'strong',
    primaryArchetype: ARCHETYPES.dog,
    secondaryArchetype: ARCHETYPES.tofu,
    height: '평균권에서 중심이 안정적으로 보이는 키감',
    build: '어깨와 몸통에 안정감이 있는 단단한 체형',
    faceShape: '볼과 턱선이 편안하게 이어지는 둥근 사각형 얼굴',
    eyes: '시선이 흔들리지 않고 편안한 둥근 눈매',
    brows: '두께가 일정하고 반듯한 눈썹',
    nose: '콧대는 단정하고 코끝은 부드럽게 둥근 코',
    lips: '폭이 안정적이고 웃을 때 인상이 풀리는 입술',
    complexion: '건강하고 차분한 인상을 주는 중성 피부 분위기',
    hair: '숱과 무게감이 느껴지는 단정한 헤어',
    style: '소재가 탄탄하고 오래 보아도 편안한 클래식 스타일'
  },
  인: {
    imageFamily: 'strong',
    primaryArchetype: ARCHETYPES.dinosaur,
    secondaryArchetype: ARCHETYPES.deer,
    height: '평균보다 길고 시원하게 뻗어 보이는 키감',
    build: '상체선이 반듯하고 움직임이 큰 탄탄한 체형',
    faceShape: '세로선이 길고 광대와 턱에 힘이 있는 긴 각진형 얼굴',
    eyes: '눈썹뼈 아래에서 시선이 곧게 뻗는 선명한 눈매',
    brows: '결이 굵고 앞머리에 힘이 실린 눈썹',
    nose: '콧대가 곧고 옆선이 또렷한 코',
    lips: '선이 분명하고 표정 변화가 빠른 균형형 입술',
    complexion: '생기와 선명도가 함께 느껴지는 피부 분위기',
    hair: '뿌리 볼륨과 결이 살아 있는 자연스러운 헤어',
    style: '직선적인 재킷과 활동적인 실루엣이 어울리는 힘 있는 스타일'
  },
  묘: {
    imageFamily: 'soft',
    primaryArchetype: ARCHETYPES.deer,
    secondaryArchetype: ARCHETYPES.dog,
    height: '평균권에서 목과 팔다리가 길어 보이는 키감',
    build: '선이 가늘고 유연하게 이어지는 슬림 균형형 체형',
    faceShape: '볼선이 매끄럽고 턱이 부드러운 타원형 얼굴',
    eyes: '동공이 맑고 표정이 잘 비치는 부드러운 눈매',
    brows: '결이 섬세하고 완만하게 흐르는 눈썹',
    nose: '크게 도드라지지 않고 선이 자연스러운 코',
    lips: '입꼬리가 부드럽고 미소가 편안한 입술',
    complexion: '깨끗하고 투명한 인상을 주는 피부 분위기',
    hair: '가볍게 흐르고 잔결이 자연스러운 헤어',
    style: '밝은 여백과 부드러운 소재가 어울리는 자연스러운 스타일'
  },
  진: {
    imageFamily: 'deep',
    primaryArchetype: ARCHETYPES['deep-contour'],
    secondaryArchetype: ARCHETYPES.dinosaur,
    height: '평균 이상으로 존재감이 크게 느껴지는 키감',
    build: '골격과 어깨선이 분명한 균형형 체형',
    faceShape: '세로선과 가로 골격이 함께 살아 있는 입체형 얼굴',
    eyes: '눈썹뼈 아래로 깊이가 생기는 또렷한 눈매',
    brows: '농도가 짙고 얼굴 중심을 잡아 주는 눈썹',
    nose: '콧대와 코끝의 높낮이가 선명한 입체형 코',
    lips: '윤곽이 뚜렷하고 무게감이 균형 잡힌 입술',
    complexion: '명암 대비가 또렷해 골격이 살아 보이는 피부 분위기',
    hair: '볼륨과 굵은 결이 얼굴 윤곽을 받쳐 주는 헤어',
    style: '짙은 색과 구조적인 실루엣이 어울리는 존재감 있는 스타일'
  },
  사: {
    imageFamily: 'sleek',
    primaryArchetype: ARCHETYPES.cat,
    secondaryArchetype: ARCHETYPES.fox,
    height: '평균권에서 비율이 날렵하게 보이는 키감',
    build: '허리선과 팔다리선이 정돈된 슬림 탄탄형 체형',
    faceShape: '광대 아래에서 턱으로 빠르게 좁아지는 V형 얼굴',
    eyes: '눈꼬리가 가볍게 올라가고 초점이 선명한 눈매',
    brows: '끝선이 날렵하고 각도가 정돈된 눈썹',
    nose: '콧대가 매끈하고 코끝이 또렷한 코',
    lips: '폭은 섬세하고 입꼬리에 긴장감이 있는 입술',
    complexion: '따뜻한 생기와 매끈함이 함께 느껴지는 피부 분위기',
    hair: '얼굴선을 따라 정교하게 정돈된 윤기 있는 헤어',
    style: '절제된 실루엣에 한 가지 강한 포인트를 둔 세련된 스타일'
  },
  오: {
    imageFamily: 'deep',
    primaryArchetype: ARCHETYPES['deep-contour'],
    secondaryArchetype: ARCHETYPES.deer,
    height: '평균보다 길고 시선이 위로 열리는 키감',
    build: '상체가 곧고 생동감이 느껴지는 슬림 탄탄형 체형',
    faceShape: '이마와 눈매가 열리고 턱선이 정리된 긴 하트형 얼굴',
    eyes: '빛을 받으면 표정이 크게 살아나는 깊고 선명한 눈매',
    brows: '얼굴의 중심을 또렷하게 잡는 선명한 눈썹',
    nose: '옆선이 분명하고 콧대가 시원한 코',
    lips: '표정과 함께 생기가 살아나는 선명한 입술',
    complexion: '따뜻하고 생기 있는 인상을 주는 피부 분위기',
    hair: '움직임과 볼륨이 자연스럽게 살아나는 헤어',
    style: '짙은 바탕에 선명한 포인트가 어울리는 감각적인 스타일'
  },
  미: {
    imageFamily: 'soft',
    primaryArchetype: ARCHETYPES.tofu,
    secondaryArchetype: ARCHETYPES.dog,
    height: '평균권에서 부담 없이 편안하게 느껴지는 키감',
    build: '선이 부드럽고 생활 안정감이 느껴지는 균형형 체형',
    faceShape: '볼에 은은한 볼륨이 있고 턱선이 둥근 타원형 얼굴',
    eyes: '눈매의 각이 낮고 웃을 때 부드럽게 접히는 눈',
    brows: '농도가 과하지 않고 완만하게 이어지는 눈썹',
    nose: '콧대가 자연스럽고 코끝이 편안한 코',
    lips: '도톰함과 부드러운 입꼬리가 함께 보이는 입술',
    complexion: '포근하고 따뜻한 인상을 주는 피부 분위기',
    hair: '결이 부드럽고 자연스러운 볼륨이 있는 헤어',
    style: '편안한 소재와 온화한 색조가 어울리는 단정한 스타일'
  },
  신: {
    imageFamily: 'deep',
    primaryArchetype: ARCHETYPES.dinosaur,
    secondaryArchetype: ARCHETYPES.cat,
    height: '평균권에서 자세와 비율이 또렷해 보이는 키감',
    build: '관절선과 어깨선이 선명한 민첩한 탄탄형 체형',
    faceShape: '광대와 턱의 각도가 정교한 다이아형 얼굴',
    eyes: '안쪽 깊이와 바깥쪽 날렵함이 함께 있는 눈매',
    brows: '직선에 가깝고 농도가 선명한 눈썹',
    nose: '콧대가 높고 정면과 옆면의 윤곽이 분명한 코',
    lips: '선이 정교하고 중심이 단단한 입술',
    complexion: '차분한 명암과 또렷한 윤곽이 느껴지는 피부 분위기',
    hair: '결과 실루엣이 선명하게 정돈된 헤어',
    style: '기능적인 디테일과 구조적인 선이 어울리는 현대적 스타일'
  },
  유: {
    imageFamily: 'sleek',
    primaryArchetype: ARCHETYPES.fox,
    secondaryArchetype: ARCHETYPES.cat,
    height: '평균권에서 전체 비율이 정갈해 보이는 키감',
    build: '군더더기 없이 선이 매끈한 슬림 균형형 체형',
    faceShape: '좌우선이 정돈되고 턱이 섬세한 타원 V형 얼굴',
    eyes: '가늘고 초점이 또렷하며 끝선이 정교한 눈매',
    brows: '결과 꼬리선이 깔끔하게 다듬어진 눈썹',
    nose: '콧대가 곧고 코끝이 작게 정리된 코',
    lips: '두께와 윤곽이 정교하게 균형 잡힌 입술',
    complexion: '결이 매끈하고 깨끗한 인상을 주는 피부 분위기',
    hair: '윤곽이 흐트러지지 않는 매끈한 헤어',
    style: '절제된 색과 완성도 높은 디테일이 어울리는 미니멀 스타일'
  },
  술: {
    imageFamily: 'strong',
    primaryArchetype: ARCHETYPES.dog,
    secondaryArchetype: ARCHETYPES.dinosaur,
    height: '평균권에서 자세가 든든하게 느껴지는 키감',
    build: '어깨와 중심축이 단단한 안정형 체형',
    faceShape: '턱과 볼의 경계가 분명한 반듯한 사각형 얼굴',
    eyes: '시선이 곧고 신뢰감이 느껴지는 안정적인 눈매',
    brows: '두께와 방향이 분명한 직선형 눈썹',
    nose: '콧대와 코끝에 무게감이 있는 반듯한 코',
    lips: '폭이 안정적이고 말할 때 표정이 단단한 입술',
    complexion: '차분하고 건강한 인상을 주는 중성 피부 분위기',
    hair: '숱이 안정적이고 흐트러짐이 적은 단정한 헤어',
    style: '튼튼한 소재와 반듯한 선이 어울리는 신뢰형 스타일'
  },
  해: {
    imageFamily: 'soft',
    primaryArchetype: ARCHETYPES.dog,
    secondaryArchetype: ARCHETYPES.deer,
    height: '평균권에서 선이 유연하고 여유롭게 보이는 키감',
    build: '힘을 빼도 흐름이 자연스러운 부드러운 균형형 체형',
    faceShape: '이마와 볼선이 부드럽게 이어지는 둥근 타원형 얼굴',
    eyes: '크기보다 깊이와 촉촉한 표정이 먼저 느껴지는 눈매',
    brows: '결이 자연스럽고 표정을 부드럽게 감싸는 눈썹',
    nose: '콧대가 과하지 않고 옆선이 유연한 코',
    lips: '힘을 빼면 미소가 자연스럽게 번지는 부드러운 입술',
    complexion: '수분감 있고 차분한 인상을 주는 피부 분위기',
    hair: '잔잔한 웨이브와 흐르는 결이 어울리는 헤어',
    style: '깊은 색조와 유연한 소재가 어울리는 편안한 스타일'
  }
};

const ELEMENT_FALLBACK_BRANCH: Record<FiveElement, EarthlyBranch> = {
  목: '묘',
  화: '오',
  토: '축',
  금: '유',
  수: '해'
};

const DAY_MASTER_ACCENT: Record<FiveElement, string> = {
  목: '전체적으로 길고 자연스러운 선, 꾸미지 않아도 맑아 보이는 인상이 강조됩니다.',
  화: '표정과 눈빛의 생동감, 가까이에서 더 선명해지는 존재감이 강조됩니다.',
  토: '볼수록 편안하고 생활력이 느껴지는 안정된 인상이 강조됩니다.',
  금: '윤곽과 이목구비가 정돈된 느낌, 깔끔한 완성도가 강조됩니다.',
  수: '눈빛의 깊이와 유연한 표정, 조용히 시선이 머무는 분위기가 강조됩니다.'
};

const HELPFUL_STYLE_ACCENT: Record<FiveElement, string> = {
  목: '자연스러운 소재와 길게 이어지는 실루엣',
  화: '생기를 살리는 선명한 포인트와 따뜻한 질감',
  토: '편안한 색조와 안정적으로 떨어지는 실루엣',
  금: '정교한 마감과 군더더기 없는 미니멀한 선',
  수: '깊은 색조와 유연하게 흐르는 소재'
};

const TEN_GOD_ACCENT: Record<string, string> = {
  정관: '단정함과 균형감이 먼저 보이는 분위기',
  정재: '꾸밈보다 생활의 정돈감이 먼저 보이는 분위기',
  편관: '눈썹·콧대·턱선처럼 얼굴 중심선이 강하게 보이는 분위기',
  편재: '표정이 크고 움직임에서 자신감이 느껴지는 분위기',
  식신: '웃는 눈과 편안한 입매가 오래 남는 분위기',
  정인: '부드러운 이마선과 차분한 표정이 신뢰를 주는 분위기',
  상관: '눈매와 입매의 개성이 빠르게 눈에 들어오는 분위기',
  편인: '깊은 눈빛과 섬세한 표정 변화가 묘하게 남는 분위기',
  비견: '자세가 반듯하고 담백한 자신감이 느껴지는 분위기',
  겁재: '움직임이 빠르고 에너지가 또렷하게 드러나는 분위기'
};

const BRANCHES = Object.keys(BRANCH_APPEARANCE) as EarthlyBranch[];

function resolveSpousePalace(report: SajuReportData) {
  const pillar = report.pillars?.day?.trim() || report.dayMaster || '';
  const branch = [...pillar]
    .reverse()
    .find((character): character is EarthlyBranch => BRANCHES.includes(character as EarthlyBranch))
    || ELEMENT_FALLBACK_BRANCH[report.dayMasterElement];

  return {
    pillar,
    branch,
    element: BRANCH_ELEM[branch] as FiveElement
  };
}

function getDominantTenGods(report: SajuReportData) {
  return (report.tenGods || [])
    .map((item, index) => ({
      label: item.label,
      value: Number.isFinite(item.value) ? item.value : 0,
      index
    }))
    .sort((left, right) => right.value - left.value || left.index - right.index)
    .slice(0, 3);
}

function fnv1a(source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSignatureKey(
  spousePalace: PartnerAppearanceProfile['spousePalace'],
  dayMasterElement: FiveElement,
  helpfulElements: readonly FiveElement[],
  dominantTenGods: ReturnType<typeof getDominantTenGods>
) {
  const source = [
    'partner-appearance-v1',
    spousePalace.pillar,
    spousePalace.branch,
    spousePalace.element,
    dayMasterElement,
    helpfulElements.join(','),
    dominantTenGods.map((item) => `${item.label}:${item.value}`).join(',')
  ].join('|');

  return `pa1-${fnv1a(source).toString(36).padStart(7, '0')}`;
}

export const PARTNER_APPEARANCE_DISCLOSURE =
  '이 인연상은 일지 배우자궁·일간 오행·도움 오행·십성 분포를 바탕으로 만든 명리 기반 창작 이미지 가이드입니다. 실제 미래 인물의 신체나 얼굴을 확정하거나 특정 실존 인물을 예측하지 않습니다.';

/**
 * Builds a stable symbolic appearance profile. Fixed facial and body traits
 * only read the natal relationship signals represented in this module and
 * remain independent from volatile report metadata and customer copy.
 */
export function buildPartnerAppearanceProfile(report: SajuReportData): PartnerAppearanceProfile {
  const spousePalace = resolveSpousePalace(report);
  const seed = BRANCH_APPEARANCE[spousePalace.branch];
  const helpfulElements = (report.helpfulElements || []).slice(0, 2);
  const dominantTenGods = getDominantTenGods(report);
  const primaryHelpfulElement = helpfulElements[0] || report.dayMasterElement;
  const dominantTenGod = dominantTenGods[0]?.label;
  const dayMasterAccent = DAY_MASTER_ACCENT[report.dayMasterElement];
  const helpfulStyleAccent = HELPFUL_STYLE_ACCENT[primaryHelpfulElement];
  const tenGodAccent = dominantTenGod
    ? TEN_GOD_ACCENT[dominantTenGod] || '표정과 태도의 균형이 자연스럽게 드러나는 분위기'
    : '표정과 태도의 균형이 자연스럽게 드러나는 분위기';
  const style = `${seed.style}. 도움 기운 ${primaryHelpfulElement}의 결을 살려 ${helpfulStyleAccent} 방향으로 맞추면 인연상의 분위기가 가장 자연스럽게 살아납니다.`;
  const headline = `${seed.height}과 ${seed.faceShape}이 먼저 보이고, ${seed.primaryArchetype.label}을 중심으로 ${seed.secondaryArchetype.label}이 은은하게 겹치는 인연상입니다. ${dayMasterAccent}`;
  const helpfulEvidence = helpfulElements.length > 0 ? helpfulElements.join('·') : '균형형';
  const tenGodEvidence = dominantTenGods.length > 0
    ? dominantTenGods.map((item) => item.label).join(' · ')
    : '분포형';

  return {
    version: 'partner-appearance-v1',
    signatureKey: createSignatureKey(
      spousePalace,
      report.dayMasterElement,
      helpfulElements,
      dominantTenGods
    ),
    spousePalace,
    imageFamily: seed.imageFamily,
    primaryArchetype: seed.primaryArchetype,
    secondaryArchetype: seed.secondaryArchetype,
    headline,
    height: seed.height,
    build: seed.build,
    faceShape: seed.faceShape,
    eyes: seed.eyes,
    brows: seed.brows,
    nose: seed.nose,
    lips: seed.lips,
    complexion: seed.complexion,
    hair: seed.hair,
    style,
    evidence: [
      {
        source: 'spouse-palace',
        label: '일지 배우자궁',
        value: `${spousePalace.pillar || spousePalace.branch} · ${spousePalace.branch}(${spousePalace.element})`
      },
      {
        source: 'day-master',
        label: '일간 오행',
        value: `${report.dayMaster || report.dayMasterElement} · ${report.dayMasterElement}`
      },
      {
        source: 'helpful-element',
        label: '도움 오행',
        value: helpfulEvidence
      },
      {
        source: 'dominant-ten-god',
        label: '상위 십성',
        value: tenGodEvidence
      }
    ],
    traits: [
      seed.height,
      seed.build,
      seed.faceShape,
      seed.eyes,
      seed.brows,
      seed.nose,
      seed.lips,
      seed.complexion,
      seed.hair,
      `주 인상은 ${seed.primaryArchetype.label}, 보조 인상은 ${seed.secondaryArchetype.label}`,
      dayMasterAccent,
      tenGodAccent
    ],
    disclosure: PARTNER_APPEARANCE_DISCLOSURE
  };
}
