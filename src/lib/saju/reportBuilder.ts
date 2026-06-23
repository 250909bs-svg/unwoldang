import { findServiceById, type IntakeFormData, type ServiceId } from '../../api/mockData';
import { getReportCallName } from '../customerName';
import { buildDeterministicSajuBasis, type DeterministicSajuBasis } from './deterministicBasis';
import { calcBazi, tenGod } from './baziCalcs';
import { BRANCH_ELEM, DZ, ELEMENT, TG, type EarthlyBranch, type HeavenlyStem } from './constants';
import type {
  ActionPlan,
  FortuneWindow,
  MonthLuckItem,
  QuestionAnswerBlock,
  ReportSection,
  ReportKind,
  SajuReportData,
  YearLuckItem
} from './report';

type FiveElement = SajuReportData['dayMasterElement'];

const KIND_META: Record<ReportKind, { title: string; subtitle: string; badge: string }> = {
  comprehensive: {
    title: '종합사주 프리미엄 리포트',
    subtitle: '성향, 흐름, 관계, 재물, 직업, 건강, 질문 2개까지 한 번에 정리한 종합 결과',
    badge: '운월당 정밀 감정서'
  },
  yearly: {
    title: '신년운세 프리미엄 리포트',
    subtitle: '다가오는 1년의 핵심 흐름과 기회, 주의 구간을 입체적으로 정리한 연간 리포트',
    badge: '연간 흐름 감정서'
  },
  love: {
    title: '연애운 프리미엄 리포트',
    subtitle: '현재 감정 흐름과 인연의 결, 연애·결혼 포인트까지 함께 읽는 관계 리포트',
    badge: '인연 감정서'
  },
  reunion: {
    title: '재회운 프리미엄 리포트',
    subtitle: '다시 이어질 가능성과 거리 조절 포인트를 차분하게 정리한 재회 리포트',
    badge: '재회 감정서'
  },
  marriage: {
    title: '결혼운 프리미엄 리포트',
    subtitle: '배우자상, 결혼의 현실 조건, 시기와 리듬을 함께 읽는 결혼 리포트',
    badge: '결혼 감정서'
  },
  compatibility: {
    title: '궁합 프리미엄 리포트',
    subtitle: '둘의 기질, 생활 리듬, 관계 운영 방식을 함께 보는 궁합 리포트',
    badge: '궁합 감정서'
  },
  career: {
    title: '직업운 프리미엄 리포트',
    subtitle: '직업 적성, 이직·창업 타이밍, 브랜딩과 수익 구조를 함께 보는 직업 리포트',
    badge: '직업 감정서'
  },
  wealth: {
    title: '금전운 프리미엄 리포트',
    subtitle: '돈이 들어오는 방식, 새는 패턴, 투자·사업 성향을 현실적으로 정리한 재물 리포트',
    badge: '금전 감정서'
  }
};

const KIND_BY_SERVICE: Partial<Record<ServiceId, ReportKind>> = {
  'general-signature': 'comprehensive',
  'life-flow': 'yearly',
  'concern-reading': 'comprehensive',
  'love-reading': 'love',
  'love-reunion': 'reunion',
  'marriage-blueprint': 'marriage',
  'marriage-timing': 'marriage',
  'match-couple': 'compatibility',
  'match-destiny': 'compatibility',
  'career-reading': 'career',
  'money-reading': 'wealth'
};

const ELEMENT_COLORS: Record<FiveElement, string> = {
  목: '#6abf69',
  화: '#ef6b6b',
  토: '#c8a66a',
  금: '#94a3b8',
  수: '#63a4ff'
};

const HIDDEN_STEMS_KO: Record<string, string[]> = {
  자: ['계'],
  축: ['기', '계', '신'],
  인: ['갑', '병', '무'],
  묘: ['을'],
  진: ['무', '을', '계'],
  사: ['병', '무', '경'],
  오: ['정', '기'],
  미: ['기', '정', '을'],
  신: ['경', '임', '무'],
  유: ['신'],
  술: ['무', '신', '정'],
  해: ['임', '갑']
};

const STEM_HANJA: Record<string, string> = {
  갑: '甲',
  을: '乙',
  병: '丙',
  정: '丁',
  무: '戊',
  기: '己',
  경: '庚',
  신: '辛',
  임: '壬',
  계: '癸'
};

const PILLAR_LABELS = {
  year: '년주',
  month: '월주',
  day: '일주',
  hour: '시주'
} as const;

const BRANCH_HANJA: Record<EarthlyBranch, string> = {
  자: '子',
  축: '丑',
  인: '寅',
  묘: '卯',
  진: '辰',
  사: '巳',
  오: '午',
  미: '未',
  신: '申',
  유: '酉',
  술: '戌',
  해: '亥'
};

type PillarKey = keyof typeof PILLAR_LABELS;

type PillarPiece = {
  key: PillarKey;
  label: (typeof PILLAR_LABELS)[PillarKey];
  pillar: string;
  stem: HeavenlyStem;
  branch: EarthlyBranch;
};

const BRANCH_PAIR_RELATIONS: Array<{
  name: string;
  pairs: Array<[EarthlyBranch, EarthlyBranch]>;
  tone: string;
}> = [
  {
    name: '육합',
    pairs: [['자', '축'], ['인', '해'], ['묘', '술'], ['진', '유'], ['사', '신'], ['오', '미']],
    tone: '서로 다른 환경을 하나의 목적지로 묶는 접착력입니다. 관계에서는 협업, 일에서는 제휴와 연결 구조로 읽습니다.'
  },
  {
    name: '충',
    pairs: [['자', '오'], ['축', '미'], ['인', '신'], ['묘', '유'], ['진', '술'], ['사', '해']],
    tone: '정지보다 이동과 조정이 필요한 신호입니다. 무조건 나쁘다기보다 바뀌어야 할 기준이 드러나는 구간입니다.'
  },
  {
    name: '형',
    pairs: [['인', '사'], ['사', '신'], ['신', '인'], ['축', '술'], ['술', '미'], ['미', '축'], ['자', '묘']],
    tone: '같은 문제를 반복해서 점검하게 만드는 압박입니다. 감정으로 밀어붙이기보다 규칙과 절차를 세워야 안정됩니다.'
  },
  {
    name: '파',
    pairs: [['자', '유'], ['축', '진'], ['인', '해'], ['묘', '오'], ['사', '신'], ['미', '술']],
    tone: '이미 맞춘 약속이나 구조가 느슨해지는 지점입니다. 계약, 일정, 역할을 문서로 다시 확인하는 편이 좋습니다.'
  },
  {
    name: '해',
    pairs: [['자', '미'], ['축', '오'], ['인', '사'], ['묘', '진'], ['신', '해'], ['유', '술']],
    tone: '겉으로는 괜찮아 보여도 속으로 쌓이는 불편함을 뜻합니다. 침묵보다 작은 대화로 빨리 풀어내야 합니다.'
  },
  {
    name: '원진',
    pairs: [['자', '미'], ['축', '오'], ['인', '유'], ['묘', '신'], ['진', '해'], ['사', '술']],
    tone: '기대와 정서의 결이 어긋나기 쉬운 조합입니다. 관계에서는 추측보다 확인, 일에서는 역할 정의가 중요합니다.'
  }
];

const TRIAD_RELATIONS: Array<{
  name: string;
  branches: [EarthlyBranch, EarthlyBranch, EarthlyBranch];
  element: FiveElement;
}> = [
  { name: '신자진 수국', branches: ['신', '자', '진'], element: '수' },
  { name: '해묘미 목국', branches: ['해', '묘', '미'], element: '목' },
  { name: '인오술 화국', branches: ['인', '오', '술'], element: '화' },
  { name: '사유축 금국', branches: ['사', '유', '축'], element: '금' }
];

const STEM_COMBOS: Array<[HeavenlyStem, HeavenlyStem, FiveElement]> = [
  ['갑', '기', '토'],
  ['을', '경', '금'],
  ['병', '신', '수'],
  ['정', '임', '목'],
  ['무', '계', '화']
];

const STEM_CLASHES: Array<[HeavenlyStem, HeavenlyStem]> = [
  ['갑', '경'],
  ['을', '신'],
  ['병', '임'],
  ['정', '계']
];

function getPillarPieces(basis: DeterministicSajuBasis): PillarPiece[] {
  const pieces: PillarPiece[] = [];

  for (const key of Object.keys(PILLAR_LABELS) as PillarKey[]) {
    const pillar = basis.pillars[key];
    if (!pillar) continue;
    const [stem, branch] = [...pillar] as [HeavenlyStem, EarthlyBranch];
    if (!stem || !branch) continue;
    pieces.push({
      key,
      label: PILLAR_LABELS[key],
      pillar,
      stem,
      branch
    });
  }

  return pieces;
}

function isSamePair<T extends string>(left: T, right: T, pair: [T, T]) {
  return (left === pair[0] && right === pair[1]) || (left === pair[1] && right === pair[0]);
}

function formatPiece(piece: PillarPiece) {
  return `${piece.label} ${piece.pillar}`;
}

function formatBranchPiece(piece: PillarPiece) {
  return `${piece.label.replace('주', '지')} ${BRANCH_HANJA[piece.branch] || piece.branch}`;
}

function formatElementGuidance(elements: FiveElement[], basis: DeterministicSajuBasis) {
  const unique = Array.from(new Set(elements));
  const active = unique.filter((element) => (basis.fiveElements.find((item) => item.label === element)?.value || 0) > 0);
  const missing = unique.filter((element) => (basis.fiveElements.find((item) => item.label === element)?.value || 0) === 0);

  if (active.length > 0 && missing.length > 0) {
    return `${active.join('·')} 쪽이 켜지면 연락, 돈, 이동이 한꺼번에 몰릴 수 있습니다. ${missing.join('·')} 쪽은 넘쳐서가 아니라 비어 있을 때 다음 단계 제안과 관계 방향이 흐려집니다.`;
  }

  if (missing.length > 0) {
    return `${missing.join('·')} 쪽은 넘침보다 공백이 문제입니다. 관계 방향, 다음 단계 제안, 성장 동선이 늦어지지 않게 의식적으로 챙겨야 합니다.`;
  }

  return `${active.join(', ')} 기운이 강하게 들어올 때는 말, 지출, 일정이 한꺼번에 빨라질 수 있습니다. 결론을 미루라는 뜻이 아니라 돈·사람·마감 중 어디가 먼저 흔들리는지 따로 떼어 보라는 신호입니다.`;
}

function hasBatchim(value: string) {
  const chars = Array.from(value);
  const char = chars[chars.length - 1];
  if (!char) return false;
  const code = char.charCodeAt(0) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

function withAndParticle(value: string) {
  return `${value}${hasBatchim(value) ? '과' : '와'}`;
}

function buildBranchRelationDetails(basis: DeterministicSajuBasis) {
  const pieces = getPillarPieces(basis);
  const details: string[] = [];

  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const left = pieces[i];
      const right = pieces[j];
      for (const relation of BRANCH_PAIR_RELATIONS) {
        if (relation.pairs.some((pair) => isSamePair(left.branch, right.branch, pair))) {
          details.push(
            `${withAndParticle(formatBranchPiece(left))} ${formatBranchPiece(right)} 사이에 ${relation.name} 관계가 보입니다. ${relation.tone}`
          );
        }
      }
    }
  }

  for (const triad of TRIAD_RELATIONS) {
    const matched = triad.branches
      .map((branch) => pieces.find((piece) => piece.branch === branch))
      .filter((item): item is PillarPiece => Boolean(item));

    if (matched.length === 3) {
      details.push(
        `${matched.map(formatBranchPiece).join(', ')}가 ${triad.name} 삼합을 이룹니다. ${triad.element} 기운이 한 방향으로 모이기 때문에 이 영역은 인생의 큰 동력으로 읽습니다.`
      );
    } else if (matched.length === 2) {
      details.push(
        `${matched.map(formatBranchPiece).join(', ')}가 ${triad.name}의 반합 흐름을 만듭니다. 아직 완전히 굳어진 흐름은 아니지만, 조건이 맞을 때 ${triad.element} 기운이 빠르게 살아납니다.`
      );
    }
  }

  return details;
}

function buildStemRelationDetails(basis: DeterministicSajuBasis) {
  const pieces = getPillarPieces(basis);
  const details: string[] = [];

  for (let i = 0; i < pieces.length; i += 1) {
    for (let j = i + 1; j < pieces.length; j += 1) {
      const left = pieces[i];
      const right = pieces[j];
      const combo = STEM_COMBOS.find(([a, b]) => isSamePair(left.stem, right.stem, [a, b]));
      const clash = STEM_CLASHES.find((pair) => isSamePair(left.stem, right.stem, pair));

      if (combo) {
        details.push(
          `${withAndParticle(formatPiece(left))} ${formatPiece(right)}의 천간이 합을 이룹니다. ${combo[2]} 기운으로 연결되며, 생각과 역할을 하나의 결과물로 묶는 힘으로 읽습니다.`
        );
      }

      if (clash) {
        details.push(
          `${withAndParticle(formatPiece(left))} ${formatPiece(right)}의 천간이 충으로 맞닿습니다. 방향이 빠르게 바뀔 수 있으니 말, 계약, 결정의 순서를 분명히 두는 편이 안전합니다.`
        );
      }
    }
  }

  return details;
}

function buildHiddenComboDetails(basis: DeterministicSajuBasis) {
  const pieces = getPillarPieces(basis);
  const details: string[] = [];

  for (const visible of pieces) {
    for (const hiddenHost of pieces) {
      if (visible.key === hiddenHost.key) continue;
      const hiddenStems = HIDDEN_STEMS_KO[hiddenHost.branch] || [];
      const combo = hiddenStems
        .map((hiddenStem) =>
          STEM_COMBOS.find(([a, b]) => isSamePair(visible.stem, hiddenStem as HeavenlyStem, [a, b]))
        )
        .find(Boolean);

      if (combo) {
        details.push(
          `${visible.label}의 ${visible.stem} 천간이 ${hiddenHost.label} ${hiddenHost.branch} 지장간과 암합 흐름을 만듭니다. 겉으로 드러나기보다 내부 동기, 숨은 관계, 오래 쌓인 욕구로 작동하기 쉽습니다.`
        );
      }
    }
  }

  return Array.from(new Set(details));
}

function buildRelationDetails(basis: DeterministicSajuBasis) {
  const branchDetails = buildBranchRelationDetails(basis);
  const stemDetails = buildStemRelationDetails(basis);
  const hiddenDetails = buildHiddenComboDetails(basis);

  return [
    {
      summary: '원국에서 먼저 확인되는 지지 관계',
      content:
        branchDetails.length > 0
          ? branchDetails.slice(0, 5).join('\n\n')
          : '네 기둥의 지지는 큰 충돌보다 월령과 일주의 중심축을 따라 움직이는 편입니다. 이 경우 사건성보다 수면, 연락 온도, 돈 약속, 책임 범위를 먼저 보아야 합니다.',
      open: true
    },
    {
      summary: '천간 합충과 겉으로 드러나는 판단 방식',
      content:
        stemDetails.length > 0
          ? stemDetails.slice(0, 4).join('\n\n')
          : '천간에서는 강한 합충보다 일간의 기준을 어떻게 세우느냐가 더 크게 작동합니다. 말과 문서, 결정 순서를 분명히 둘수록 장점이 살아납니다.'
    },
    {
      summary: '암합과 숨은 동기 체크',
      content:
        hiddenDetails.length > 0
          ? hiddenDetails.slice(0, 4).join('\n\n')
          : '암합은 크게 도드라지지 않습니다. 숨은 욕구보다 현재 드러난 원국과 대운의 방향을 중심으로 판단하는 편이 더 안전합니다.'
    }
  ];
}

function getRelationshipContextSentence(relationshipLabel: string) {
  return `현재 관계 맥락은 "${relationshipLabel}"입니다.`;
}

function getKind(serviceId: ServiceId): ReportKind {
  return KIND_BY_SERVICE[serviceId] || 'comprehensive';
}

function parseBirthDate(value?: string) {
  const fallback = { year: 1990, month: 1, day: 1 };
  if (!value) return fallback;

  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  if (!year || !month || !day) {
    return fallback;
  }

  return { year, month, day };
}

function getCalendarLabel(formData: Partial<IntakeFormData>) {
  if (formData.calendar === 'lunar') {
    return formData.isLeapMonth ? '음력(윤달)' : '음력';
  }

  return '양력';
}

function getGenderLabel(formData: Partial<IntakeFormData>) {
  return formData.gender === 'male' ? '남성' : '여성';
}

function getTimeLabel(formData: Partial<IntakeFormData>) {
  if (formData.isUnknownTime) {
    return '시간 모름';
  }

  return formData.birthTime || '시간 미입력';
}

function getRelationshipLabel(formData: Partial<IntakeFormData>) {
  const status =
    formData.relationshipStatus === 'dating'
      ? '연애 중'
      : formData.relationshipStatus === 'married'
        ? '기혼'
        : formData.relationshipStatus === 'single'
          ? '솔로'
          : '관계 상태 미입력';

  const duration =
    formData.relationshipDuration === 'under1'
      ? '1년 미만'
      : formData.relationshipDuration === 'under3'
        ? '3년 미만'
        : formData.relationshipDuration === 'under5'
          ? '5년 미만'
          : formData.relationshipDuration === 'under10'
            ? '10년 미만'
            : '';

  return duration ? `${status} / ${duration}` : status;
}

function createSerialNumber() {
  const seed = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `UW-${Date.now()}-${seed}`;
}

function buildMetaGrid(
  birthLabel: string,
  questionPreview: string,
  relationshipLabel: string,
  serialNumber: string,
  createdAt: string
) {
  return [
    { label: '기본정보', value: birthLabel },
    { label: '관계 맥락', value: relationshipLabel },
    { label: '리포트 번호', value: serialNumber },
    { label: '생성일', value: new Date(createdAt).toLocaleDateString('ko-KR') },
    { label: '질문 요약', value: questionPreview || '미입력' }
  ];
}

function computeCurrentAge(formData: Partial<IntakeFormData>) {
  const { year } = parseBirthDate(formData.birthDate);
  return new Date().getFullYear() - year + 1;
}

function parseAgeRange(ageLabel: string) {
  const match = ageLabel.match(/(\d+)\D+(\d+)/);
  if (!match) {
    return { start: 0, end: 0 };
  }

  return {
    start: Number(match[1]),
    end: Number(match[2])
  };
}

function scoreByElements(stemElement: FiveElement, branchElement: FiveElement, helpful: FiveElement[], cautious: FiveElement[]) {
  let score = 64;
  if (helpful.includes(stemElement)) score += 12;
  if (helpful.includes(branchElement)) score += 10;
  if (cautious.includes(stemElement)) score -= 9;
  if (cautious.includes(branchElement)) score -= 8;
  return Math.max(45, Math.min(92, score));
}

const TEN_GOD_ROLE: Record<string, string> = {
  비견: '자기 기준',
  겁재: '경쟁과 분리',
  식신: '결과물 생산',
  상관: '표현과 돌파',
  편재: '시장 감각과 큰돈',
  정재: '정산과 고정 수입',
  편관: '압박과 승부',
  정관: '기준과 책임',
  편인: '학습·문서·보완',
  정인: '보호와 승인'
};

function getTenGodByStem(dayStem: string, targetStem: string) {
  const dayIndex = TG.indexOf(dayStem as HeavenlyStem);
  const targetIndex = TG.indexOf(targetStem as HeavenlyStem);

  if (dayIndex < 0 || targetIndex < 0) {
    return '';
  }

  return tenGod(dayIndex, targetIndex);
}

function getSubjectParticle(value: string) {
  const lastChar = value.charCodeAt(value.length - 1);

  if (lastChar < 0xac00 || lastChar > 0xd7a3) {
    return '이';
  }

  return (lastChar - 0xac00) % 28 === 0 ? '가' : '이';
}

function describeDayunTenGodFlow(row: DeterministicSajuBasis['dayun'][number], basis: DeterministicSajuBasis) {
  const [stem, branch] = [...row.ganzhi] as [HeavenlyStem, EarthlyBranch];
  const stemGod = getTenGodByStem(basis.dayMaster.stem, stem);
  const hiddenStems = HIDDEN_STEMS_KO[branch] || [];
  const stemGodLabel = stemGod || '십성';
  const stemText = `${STEM_HANJA[stem] || stem} ${stemGodLabel}${getSubjectParticle(stemGodLabel)} ${TEN_GOD_ROLE[stemGod] || '대운의 겉주제'}을 만듭니다`;
  const hiddenText = hiddenStems
    .map((hiddenStem) => {
      const hiddenGod = getTenGodByStem(basis.dayMaster.stem, hiddenStem);
      const hiddenGodLabel = hiddenGod || '십성';
      return `${STEM_HANJA[hiddenStem] || hiddenStem} ${hiddenGodLabel}(${TEN_GOD_ROLE[hiddenGod] || '숨은 작용'})${getSubjectParticle(hiddenGodLabel)}`;
    })
    .join(', ');

  if (!hiddenText) {
    return stemText;
  }

  return `${stemText}. ${BRANCH_HANJA[branch] || branch}${BRANCH_ELEM[branch]} 지장간에는 ${hiddenText} 함께 깔립니다`;
}

function buildDayunPracticalTheme(
  row: DeterministicSajuBasis['dayun'][number],
  basis: DeterministicSajuBasis,
  isCurrent: boolean,
  emphasis: string,
  caution: string
) {
  const [stem, branch] = [...row.ganzhi] as [HeavenlyStem, EarthlyBranch];
  const stemElement = ELEMENT[stem] as FiveElement;
  const branchElement = BRANCH_ELEM[branch] as FiveElement;
  const stemGod = getTenGodByStem(basis.dayMaster.stem, stem);
  const hiddenGods = (HIDDEN_STEMS_KO[branch] || []).map((hiddenStem) => getTenGodByStem(basis.dayMaster.stem, hiddenStem));
  const hasMoneyGod = [stemGod, ...hiddenGods].some((god) => god === '편재' || god === '정재');
  const isWaterMoneyCycle = basis.dayMaster.element === '토' && (stemElement === '수' || branchElement === '수' || hasMoneyGod);

  if (isWaterMoneyCycle) {
    return {
      summary:
        '수(水) 재성의 압력이 커져 돈 흐름, 고객, 인간관계, 야간 활동, 이동성, 감정 소모가 한꺼번에 늘어나는 시기입니다. 사회적 자리 잡기보다 돈이 어디서 들어오고 어디로 새는지, 누구 때문에 생활 리듬이 흔들리는지가 핵심입니다.',
      focus: `${isCurrent ? '현재 진행 중인' : '다음 단계의'} 돈 흐름, 고객 응대, 인간관계 거리, 이동 일정, 야간 생활을 먼저 관리해야 합니다. 들어오는 사람과 제안은 늘 수 있지만 가격표, 정산일, 연락 가능 시간, 수면 기준이 없으면 남는 돈보다 피로가 커집니다.`,
      caution:
        '감정소비, 야간 활동, 충동 결제, 흐린 정산, 답장에 끌려다니는 관계가 이번 대운의 손실 포인트입니다. 돈과 사람을 같이 보되, 밤에 결정한 약속과 결제는 다음 날 다시 확인해야 합니다.'
    };
  }

  return {
    summary: `${emphasis}이 더 중요해지는 시기입니다. 이 구간은 우연한 사건보다 선택의 순서, 사람을 쓰는 방식, 돈이 남는 구조가 결과 차이를 크게 만듭니다.`,
    focus: `${isCurrent ? '현재 진행 중인 일의 기준과 가격, 관계의 역할 배치' : '다음 단계의 생활 기반과 수익 모델'}를 눈에 보이는 운영 규칙으로 다듬는 편이 정확합니다. ${basis.helpfulElements.join(', ')} 흐름은 추상적인 운보다 반복 가능한 생활 기준에서 체감됩니다.`,
    caution: `${caution}가 이번 대운 해석의 핵심 주의점입니다. 특히 감정이 앞선 약속, 검증 없는 확장, 문서 없는 금전 관계는 한 번 더 멈춰서 확인해야 합니다.`
  };
}

function formatGanzhiHanja(stem: HeavenlyStem, branch: EarthlyBranch) {
  return `${STEM_HANJA[stem] || stem}${BRANCH_HANJA[branch] || branch}`;
}

function getYearLuckHeadline(item: DeterministicSajuBasis['seun'][number], score: number) {
  if (item.ganzhi === '병오') {
    return '丙午년, 화 기운이 강하게 드러나는 해';
  }

  if (item.ganzhi === '정미') {
    return '丁未년, 정리와 현실화가 중요한 해';
  }

  if (item.ganzhi === '무신') {
    return '戊申년, 결과를 숫자와 구조로 검증하는 해';
  }

  return score >= 80
    ? '확장과 성과가 비교적 선명하게 드러나는 해'
    : score >= 68
      ? '기회를 잘 고르면 결과가 붙는 해'
      : score >= 56
        ? '정비와 기준 재설정이 중요한 해'
        : '속도보다 관리가 더 중요한 해';
}

function getYearLuckSummary(
  item: DeterministicSajuBasis['seun'][number],
  stem: HeavenlyStem,
  branch: EarthlyBranch,
  stemElement: FiveElement,
  branchElement: FiveElement,
  helpful: FiveElement[]
) {
  const ganzhiHanja = formatGanzhiHanja(stem, branch);

  if (item.ganzhi === '병오') {
    return `${item.year}년은 ${ganzhiHanja}년, 천간과 지지 모두 화 기운이 강하게 드러나는 해입니다. 공개, 표현, 실행의 온도가 올라가지만 준비 없이 조급하게 열면 체력과 돈이 먼저 소모됩니다.`;
  }

  if (item.ganzhi === '정미') {
    return `${item.year}년은 ${ganzhiHanja}년입니다. 화 기운은 남아 있지만 未토가 들어오므로 ${item.year - 1}년처럼 계속 확장만 보는 해가 아니라, 벌린 일을 정리하고 고정하며 현실 부담을 관리하는 해로 읽습니다.`;
  }

  if (item.ganzhi === '무신') {
    return `${item.year}년은 ${ganzhiHanja}년입니다. 기회를 더 늘리는 말보다 결과물, 시스템, 정산, 성과 검증이 강해지는 해입니다. 숫자로 남는지, 반복 가능한 구조인지 확인해야 합니다.`;
  }

  return `${item.year}년은 ${ganzhiHanja}년, ${stemElement}·${branchElement} 흐름이 들어오면서 ${
    helpful.includes(stemElement) || helpful.includes(branchElement)
      ? '새로운 기회를 현실 성과로 연결하기 좋은 해'
      : '기존 구조를 점검하고 손실을 줄이는 감각이 중요한 해'
  }로 읽습니다.`;
}

function getYearLuckFocus(item: DeterministicSajuBasis['seun'][number], helpful: FiveElement[]) {
  if (item.ganzhi === '병오') {
    return '준비한 결과물을 밖으로 꺼내고 반응을 확인하세요. 다만 공개 전에 가격, 일정, 제공 범위를 먼저 적어두어야 화 기운이 과속으로 새지 않습니다.';
  }

  if (item.ganzhi === '정미') {
    return '새 판을 계속 벌리기보다 이미 시작한 일을 고정하는 쪽이 중요합니다. 계약, 고정비, 책임 범위, 생활 체력을 정리해야 남은 화 기운이 현실 성과로 굳습니다.';
  }

  if (item.ganzhi === '무신') {
    return '감으로 좋다는 말보다 숫자와 구조로 검증해야 합니다. 매출, 정산, 반복 고객, 포트폴리오, 업무 시스템이 실제로 남는지 확인하는 해입니다.';
  }

  return `${helpful.join(', ')} 기운을 살리려면 말로 넘긴 약속을 실제 일정, 가격, 제공 범위로 내려놓아야 합니다. 새 일을 늘리기 전에 이미 잡은 일에서 돈과 신뢰가 남는지 보세요.`;
}

function mapCurrentAndNextDayun(
  basis: DeterministicSajuBasis,
  formData: Partial<IntakeFormData>,
  helpful: FiveElement[],
  cautious: FiveElement[]
): { currentDayun: FortuneWindow; nextDayun: FortuneWindow } {
  const currentAge = computeCurrentAge(formData);
  const rows = basis.dayun;
  const currentIndex = Math.max(
    0,
    rows.findIndex((row) => {
      const range = parseAgeRange(row.age);
      return currentAge >= range.start && currentAge <= range.end;
    })
  );

  const currentRow = rows[currentIndex] || rows[0];
  const nextRow = rows[currentIndex + 1] || rows[Math.min(currentIndex, rows.length - 1)];

  const makeWindow = (row: DeterministicSajuBasis['dayun'][number], isCurrent: boolean): FortuneWindow => {
    const [stem, branch] = [...row.ganzhi] as [string, string];
    const stemElement = ELEMENT[stem as keyof typeof ELEMENT] as FiveElement;
    const branchElement = BRANCH_ELEM[branch as keyof typeof BRANCH_ELEM] as FiveElement;
    const emphasis = helpful.includes(stemElement) || helpful.includes(branchElement) ? '기회를 구조로 바꾸는 힘' : '리듬을 다듬는 힘';
    const caution = cautious.includes(stemElement) || cautious.includes(branchElement) ? '속도 조절과 기준 유지' : '무리한 확장 자제';
    const tenGodReading = describeDayunTenGodFlow(row, basis);
    const practicalTheme = buildDayunPracticalTheme(row, basis, isCurrent, emphasis, caution);

    return {
      name: row.ganzhi,
      range: row.age,
      summary: `${row.ganzhi} 대운은 ${tenGodReading}. ${practicalTheme.summary}`,
      focus: practicalTheme.focus,
      caution: practicalTheme.caution
    };
  };

  return {
    currentDayun: makeWindow(currentRow, true),
    nextDayun: makeWindow(nextRow, false)
  };
}

function buildYearLuck(
  basis: DeterministicSajuBasis,
  helpful: FiveElement[],
  cautious: FiveElement[]
): YearLuckItem[] {
  const cautionGuidance = formatElementGuidance(cautious, basis);

  return basis.seun.slice(0, 5).map((item) => {
    const [stem, branch] = [...item.ganzhi] as [HeavenlyStem, EarthlyBranch];
    const stemElement = ELEMENT[stem as keyof typeof ELEMENT] as FiveElement;
    const branchElement = BRANCH_ELEM[branch as keyof typeof BRANCH_ELEM] as FiveElement;
    const score = scoreByElements(stemElement, branchElement, helpful, cautious);

    return {
      year: item.year,
      ganzhi: item.ganzhi,
      score,
      headline: getYearLuckHeadline(item, score),
      summary: getYearLuckSummary(item, stem, branch, stemElement, branchElement, helpful),
      focus: getYearLuckFocus(item, helpful),
      warning: `${cautionGuidance} 계약, 결제, 이직, 관계 정리는 바로 끝내지 말고 비용·사람·마감·체력 조건을 따로 적어 비교하세요.`
    };
  });
}

function buildMonthLuck(
  formData: Partial<IntakeFormData>,
  basis: DeterministicSajuBasis,
  helpful: FiveElement[],
  cautious: FiveElement[],
  mode: 'rolling' | 'calendar-year' = 'rolling'
): MonthLuckItem[] {
  const now = new Date();
  const gender = formData.gender === 'male' ? 'male' : 'female';
  const cautionGuidance = formatElementGuidance(cautious, basis);

  return Array.from({ length: 12 }, (_, index) => {
    const date =
      mode === 'calendar-year'
        ? new Date(now.getFullYear(), index, 15, 12, 0, 0)
        : new Date(now.getFullYear(), now.getMonth() + index, 15, 12, 0, 0);
    const sample = calcBazi(
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      12,
      0,
      'solar',
      'normal',
      gender,
      false
    );
    const stem = TG[sample.m_gz.tg] as keyof typeof ELEMENT;
    const branch = DZ[sample.m_gz.dz] as keyof typeof BRANCH_ELEM;
    const stemElement = ELEMENT[stem] as FiveElement;
    const branchElement = BRANCH_ELEM[branch] as FiveElement;
    const score = scoreByElements(stemElement, branchElement, helpful, cautious);

    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      ganzhi: `${TG[sample.m_gz.tg]}${DZ[sample.m_gz.dz]}`,
      score,
      summary: `${date.getMonth() + 1}월은 ${stemElement}·${branchElement} 흐름이 강조되는 달입니다. 일과 관계 모두 ${score >= 70 ? '선택을 분명하게 가져갈수록' : '리듬을 정돈할수록'} 안정감이 높아집니다.`,
      focus: `이번 달은 생활 리듬, 제공 범위, 우선순위 정리가 핵심입니다. 고객, 연인, 가족과의 약속도 말로만 두지 말고 일정과 역할을 남기면 흔들림이 줄어듭니다.`,
      warning: `${cautionGuidance} 무리해서 끌고 가는 달보다 덜어내서 선명해지는 달로 운영하세요.`
    };
  });
}

type QuestionCategory = 'crisis' | 'relationship' | 'money' | 'career' | 'timing' | 'caution' | 'health' | 'general';

function isExistentialCrisisQuestion(question: string) {
  const normalized = question.replace(/\s/g, '');
  return /왜살|살이유|사는이유|살아야할이유/.test(normalized);
}

function getQuestionCategory(question: string): QuestionCategory {
  const normalized = question.replace(/\s/g, '');
  if (/살기싫|죽고싶|자살|극단|사라지고싶|끝내고싶|죽어버|못살겠|포기하고싶|목숨|해치고싶|왜살|살이유|사는이유|살아야할이유/.test(normalized)) {
    return 'crisis';
  }
  if (/연애|결혼|재회|상대|인연|배우자|궁합|썸|애정/.test(normalized)) return 'relationship';
  if (/돈|재물|수익|매출|사업|투자|가격|결제|고가|상품|월급|부업|벌이|빚|대출/.test(normalized)) return 'money';
  if (/뭐먹고살|먹고살|벌어먹|돈벌|일|직업|커리어|이직|퇴사|취업|직무|업종|창업|브랜드|콘텐츠|회사|진로|적성|뭘해야|뭐해야/.test(normalized)) return 'career';
  if (/언제|시기|올해|내년|2026|2027|타이밍|기회/.test(normalized)) return 'timing';
  if (/조심|주의|위험|피해야|선택|고민|불안/.test(normalized)) return 'caution';
  if (/건강|잠|수면|체력|피로|몸|컨디션/.test(normalized)) return 'health';
  return 'general';
}

function hasHangulFinalConsonant(text: string) {
  const hangul = text.replace(/[^\uAC00-\uD7A3]/g, '');
  const last = hangul[hangul.length - 1];

  if (!last) {
    return false;
  }

  return (last.charCodeAt(0) - 0xac00) % 28 !== 0;
}

function getFriendlyAddressName(name: string) {
  const cleaned = name.trim().replace(/\s+/g, '');
  const blockedWords = ['테스트', '운월당', '고객', '사용자', '나', '저'];

  if (!cleaned) {
    return '당신';
  }

  const koreanOnly = cleaned.replace(/[^\uAC00-\uD7A3]/g, '');

  if (blockedWords.includes(koreanOnly || cleaned)) {
    return '당신';
  }

  if (koreanOnly.length >= 3) {
    return koreanOnly.slice(1);
  }

  return koreanOnly || cleaned;
}

function getVocativeName(name: string) {
  const friendlyName = getFriendlyAddressName(name);

  if (friendlyName === '당신') {
    return friendlyName;
  }

  return `${friendlyName}${hasHangulFinalConsonant(friendlyName) ? '아' : '야'}`;
}

function withKoreanObjectParticle(text: string) {
  return `${text}${hasHangulFinalConsonant(text) ? '을' : '를'}`;
}

function withKoreanTopicParticle(text: string) {
  return `${text}${hasHangulFinalConsonant(text) ? '은' : '는'}`;
}

function withKoreanSubjectParticle(text: string) {
  return `${text}${hasHangulFinalConsonant(text) ? '이' : '가'}`;
}

function getCasualAddressParts(name: string) {
  const friendlyName = getFriendlyAddressName(name);

  if (friendlyName === '당신') {
    return {
      titleLead: '지금은',
      opening: '지금 정말 많이 버거웠지.',
      subject: '너는',
      object: '너를',
      aloneLine: '지금 혼자 있으면'
    };
  }

  const vocativeName = getVocativeName(name);

  return {
    titleLead: `${vocativeName}, 지금은`,
    opening: `${vocativeName}, 요즘 정말 많이 버거웠지.`,
    subject: withKoreanTopicParticle(friendlyName),
    object: withKoreanObjectParticle(friendlyName),
    aloneLine: `${withKoreanSubjectParticle(friendlyName)} 지금 혼자 있으면`
  };
}

function getDominantTenGodText(basis: DeterministicSajuBasis) {
  return basis.tenGods
    .slice(0, 2)
    .map((item) => item.label)
    .join('·') || '주요 십성';
}

function getCareerFitByTenGods(basis: DeterministicSajuBasis) {
  const labels = basis.tenGods.slice(0, 4).map((item) => item.label);
  const fits = new Set<string>();

  if (labels.some((label) => label.includes('식') || label.includes('상'))) {
    fits.add('콘텐츠 기획, 리포트 제작, 강의·교육, 말과 글로 결과물을 만드는 일');
  }

  if (labels.some((label) => label.includes('재'))) {
    fits.add('상품 설계, 영업 전략, 고객관리, 중개·거래형 서비스');
  }

  if (labels.some((label) => label.includes('관'))) {
    fits.add('운영관리, PM, 행정·프로세스 관리, 신뢰와 책임이 중요한 직무');
  }

  if (labels.some((label) => label.includes('인'))) {
    fits.add('상담, 코칭, 연구, 문서화, 지식 기반 서비스');
  }

  if (labels.some((label) => label.includes('비') || label.includes('겁'))) {
    fits.add('1인 브랜드, 독립 프로젝트, 자기 기준으로 판을 짜는 프리랜서형 업무');
  }

  if (!fits.size) {
    fits.add('상담·분석·기획·운영처럼 기준을 세우고 문제를 정리해주는 일');
  }

  return Array.from(fits).slice(0, 4);
}

function buildCareerIndustryGuide(
  dayMaster: string,
  currentDayunName: string,
  helpfulText: string,
  cautionGuidance: string,
  basis: DeterministicSajuBasis
) {
  const dominantTenGodText = getDominantTenGodText(basis);
  const careerFits = getCareerFitByTenGods(basis);

  return [
    `결론부터 말하면, 이 명식은 “아무 일이나 오래 버티는 구조”보다 기준을 세우고 사람의 문제를 정리해 돈으로 바꾸는 쪽이 맞습니다. ${dayMaster} 일간은 판을 보고 구조를 잡는 힘이 있고, ${dominantTenGodText} 흐름은 그 기준을 말·문서·서비스로 꺼낼 때 수익성이 살아납니다.`,
    `추천 업종과 역할은 ${careerFits.join(', ')}입니다. 직업명 하나보다 “상담·분석·기획·문서화·운영”이 들어가는 일을 우선 보세요.`,
    `${currentDayunName} 대운에서는 들어오는 제안이 늘어도 기준이 없으면 피로가 먼저 쌓입니다. 단건 노동보다 진단, 결과물, 피드백, 재구매가 이어지는 패키지 수익 구조가 유리합니다.`,
    `피해야 할 방식은 무한 수정, 감정노동이 많은 저가 상담, 말로만 정한 동업, 급한 영업직, 수익 모델 없는 콘텐츠 운영입니다. 잘 맞는 방식은 가격표가 있고, 제공 범위가 분명하고, 결과물이 파일이나 문서로 남는 일입니다.`,
    `90일 실행은 선명해야 합니다. 1~2주 대표 서비스 1개 정의, 3~4주 샘플 결과물과 소개문 완성, 5~8주 파일럿 고객 3명 검증, 9~12주 반복 판매 구조로 고정하세요.`,
    `${helpfulText} 기운은 기록과 반복에서 강해집니다. ${cautionGuidance} 즉흥 확장보다 한 분야 선명화와 결과물 표준화가 커리어를 빠르게 끌어올립니다.`
  ];
}

const PREMIUM_QUESTION_MIN_ANALYSIS_CHARS = 300;
const PREMIUM_QUESTION_ADVICE_COUNT = 10;

function getCurrentDayunName(
  basis: DeterministicSajuBasis,
  formData?: Partial<IntakeFormData>,
  explicitDayunName?: string
) {
  if (explicitDayunName) {
    return explicitDayunName;
  }

  const currentDayun = formData
    ? basis.dayun.find((row) => {
        const currentAge = computeCurrentAge(formData);
        const range = parseAgeRange(row.age);
        return currentAge >= range.start && currentAge <= range.end;
      })
    : undefined;

  return currentDayun?.ganzhi || basis.dayun[0]?.ganzhi || '현재 대운';
}

function getQuestionTextLength(text: string) {
  return text.replace(/\s/g, '').length;
}

function getPremiumCustomerLabel(basis: DeterministicSajuBasis) {
  const friendlyName = getFriendlyAddressName(basis.input.name || '');
  return friendlyName === '당신' ? '이 고객' : `${friendlyName}님`;
}

function summarizeFiveElementsForQuestion(basis: DeterministicSajuBasis) {
  return basis.fiveElements.map((item) => `${item.label}${item.value}`).join('·');
}

function getTopTenGodsForQuestion(basis: DeterministicSajuBasis) {
  return basis.tenGods
    .slice(0, 3)
    .map((item) => `${item.label} ${item.value}`)
    .join(', ') || '주요 십성';
}

function getQuestionIntent(question: string, category: QuestionCategory) {
  const normalized = question.replace(/\s/g, '');

  if (/이사|거주|동네|지역|역세권|강남|독산|집|방|오피스텔|아파트/.test(normalized)) {
    return '이동·거주 선택';
  }

  if (/어디.*연애|연애.*어디|만날|소개|장소|인연/.test(normalized)) {
    return '연애 만남 경로';
  }

  if (category === 'career') return '직업·커리어 선택';
  if (category === 'money') return '돈·사업 구조';
  if (category === 'relationship') return '관계·연애 판단';
  if (category === 'timing') return '시기·타이밍 판단';
  if (category === 'health') return '생활 리듬 판단';
  if (category === 'caution') return '주의점·선택 기준';

  return '종합 고민 판단';
}

function extractQuestionOptions(question: string) {
  const beforeMiddle = question.split(/중|중에|중에서|vs|VS|또는|아니면/)[0] || question;
  const cleaned = beforeMiddle
    .replace(/[?？!！.,]/g, ' ')
    .replace(/\b(Q|q)\b/g, ' ')
    .replace(/나|저|내가|제가|이사|거주|동네|지역|어디|가는게|가면|할수있어|할 수 있어|좋을까|좋아|중/g, ' ');

  const options = cleaned
    .split(/\s+|,|\/|·|랑|하고|과|와|및/)
    .map((item) => item.trim())
    .filter((item) => item.length >= 2 && !/질문|고민|선택/.test(item));

  return Array.from(new Set(options)).slice(0, 4);
}

function buildQuestionDirectAnswer(question: string, category: QuestionCategory, basis: DeterministicSajuBasis) {
  const normalized = question.replace(/\s/g, '');
  const options = extractQuestionOptions(question);
  const careerFits = getCareerFitByTenGods(basis);

  if (/이사|거주|동네|지역|역세권|집|방/.test(normalized) && options.length >= 2) {
    return `결론부터 말하면 ${options.join('·')} 중에서는 “돈과 체력 유지가 되는 쪽”을 1순위로 두고, 그다음 사람·기회가 열리는지를 봐야 합니다. ${options[0]}은 노출과 기회, ${options[1]}은 고정비와 생활 안정이라는 식으로 비교하면 답이 선명해집니다.`;
  }

  if (/어디.*연애|연애.*어디|만날|소개|인연/.test(normalized)) {
    return '결론부터 말하면 낯선 헌팅식 만남보다 지인 소개, 반복 방문하는 취미 공간, 일과 연결된 모임, 생활권 안에서 얼굴이 익는 장소가 더 잘 맞습니다.';
  }

  if (category === 'career') {
    return `결론부터 말하면 완전한 조직 소모형보다 ${careerFits.join(', ')}처럼 자기 기준을 결과물로 바꾸는 일이 더 맞습니다.`;
  }

  if (category === 'money') {
    return '결론부터 말하면 한 번 크게 버는 판보다 가격표, 재구매, 소개, 정산 기준이 남는 반복 수익 구조가 더 안정적으로 맞습니다.';
  }

  if (category === 'relationship') {
    return '결론부터 말하면 감정의 크기보다 연락 리듬, 약속 이행, 갈등 후 회복 속도가 맞는 사람을 봐야 오래 갑니다.';
  }

  if (category === 'timing') {
    return '결론부터 말하면 바로 크게 움직이기보다 7일 검증, 30일 실행, 90일 고정 순서로 가는 선택이 손실을 줄입니다.';
  }

  return '결론부터 말하면 답을 하나로 찍기보다 돈, 사람, 시간, 체력 조건이 동시에 버티는 선택을 현실적인 답으로 봐야 합니다.';
}

function buildPremiumQuestionTitle(answer: QuestionAnswerBlock, category: QuestionCategory) {
  const prefix = answer.title.match(/^\d+\./)?.[0] || '';
  const normalized = answer.question.replace(/\s/g, '');
  const options = extractQuestionOptions(answer.question);

  if (category === 'crisis' || category === 'career' || category === 'money' || category === 'timing' || category === 'health') {
    return answer.title;
  }

  if (/이사|거주|동네|지역|역세권|집|방/.test(normalized) && options.length >= 2) {
    return `${prefix} ${options.join('·')}는 돈·이동·기회로 비교해야 합니다`.trim();
  }

  if (/어디.*연애|연애.*어디|만날|소개|인연/.test(normalized)) {
    return `${prefix} 반복해서 얼굴이 익는 생활권 만남이 맞습니다`.trim();
  }

  if (answer.title.includes('종합 질문 직답')) {
    return `${prefix} 돈·사람·시간·체력이 같이 버티는 답을 봐야 합니다`.trim();
  }

  return answer.title;
}

function buildPremiumQuestionAnalysis(
  answer: QuestionAnswerBlock,
  basis: DeterministicSajuBasis,
  category: QuestionCategory,
  currentDayunName: string,
  helpfulText: string,
  cautionGuidance: string
) {
  const customerLabel = getPremiumCustomerLabel(basis);
  const intent = getQuestionIntent(answer.question, category);
  const directAnswer = buildQuestionDirectAnswer(answer.question, category, basis);
  const fiveElementText = summarizeFiveElementsForQuestion(basis);
  const tenGodText = getTopTenGodsForQuestion(basis);
  const options = extractQuestionOptions(answer.question);
  const optionLine = options.length >= 2
    ? `이번 질문의 핵심 선택지는 ${options.join('·')}로 보이므로, 각 선택지를 “돈이 남는가, 이동이 버틸 만한가, 만나는 사람이 달라지는가, 밤에 지치지 않는가, 다음 기회가 생기는가”로 나눠 검증해야 합니다.`
    : '이 질문은 막연한 운세가 아니라 실제 행동으로 확인해야 답이 선명해지는 유형입니다.';

  return `${directAnswer} ${customerLabel}의 원국은 ${basis.pillars.year}년주, ${basis.pillars.month}월주, ${basis.pillars.day}일주, ${basis.pillars.hour || '시주 미상'}로 잡히며, ${basis.dayMaster.stem} 일간의 판단 방식과 ${currentDayunName} 대운이 함께 작동합니다. 오행은 ${fiveElementText}, 십성 상위 흐름은 ${tenGodText}입니다. 그래서 "${answer.question}"은 ${intent}으로 읽어야 하고, 감정만으로 고르면 처음에는 시원해도 뒤에서 비용, 피로, 관계 부담이 따라올 수 있습니다. ${optionLine} ${helpfulText} 기운은 판단을 현실에 붙이는 힘으로 쓰고, ${cautionGuidance} 이 답은 확정 예언이 아니라 사주 구조로 좁힌 우선순위이므로, 실제 현장 확인과 7일 기록을 같이 두면 고객 입장에서 훨씬 덜 흔들립니다.`;
}

function buildCrisisSafetyAnalysis(answer: QuestionAnswerBlock, basis: DeterministicSajuBasis, currentDayunName: string) {
  const address = getCasualAddressParts(basis.input.name || '');
  const dominantTenGodText = getDominantTenGodText(basis);

  return `${answer.analysis}\n\n${address.opening} "${answer.question}" 같은 말이 나올 때는 사주로 길게 따지는 것보다 안전을 먼저 잡아야 해. ${basis.dayMaster.stem} 일간과 ${basis.pillars.month} 월령은 힘든 마음을 바로 꺼내기보다 안쪽에 오래 쌓아 둘 수 있고, ${currentDayunName} 대운과 ${dominantTenGodText} 흐름이 겹치면 책임, 돈, 사람 문제가 한 번에 몰린 것처럼 느껴질 수 있어. 그래도 오늘 할 일은 인생 전체를 판단하는 게 아니야. 사람 있는 곳으로 이동하고, 위험한 물건에서 떨어지고, 109·119·112처럼 바로 연결되는 도움을 붙이는 거야.`;
}

function getPremiumQuestionAdvice(
  answer: QuestionAnswerBlock,
  basis: DeterministicSajuBasis,
  category: QuestionCategory,
  currentDayunName: string,
  helpfulText: string,
  cautionGuidance: string
) {
  if (category === 'crisis') {
    const address = getCasualAddressParts(basis.input.name || '');

    return [
      `${address.aloneLine} 지금 바로 가까운 사람 한 명에게 “나 혼자 있으면 위험해. 같이 있어줘”라고 보내.`,
      '위험한 물건, 높은 곳, 차 키, 술, 약에서 몸을 먼저 떼고 불이 켜진 사람 있는 공간으로 가.',
      '한국이면 자살예방 상담전화 109, 당장 위험하면 119나 112로 바로 연락해.',
      '오늘은 인생 결론을 내리는 날이 아니라 다음 10분을 안전하게 넘기는 날로 잡아.',
      '물 한 컵, 따뜻한 음식, 휴대폰 충전, 문 열어두기처럼 몸을 붙잡는 행동부터 해.',
      '혼자 누워서 생각을 더 밀고 가지 말고, 통화가 어렵다면 “지금 말 못 해도 옆에 있어줘”라고 문자로 남겨.',
      '밤에는 생각이 더 커질 수 있으니 침대 안에서 결론을 만들지 말고 거실, 편의점, 응급실처럼 사람이 있는 곳으로 이동해.',
      '돈, 일, 관계 문제는 내일 종이에 다시 나눠도 늦지 않아. 지금은 문제 해결보다 위험 차단이 먼저야.',
      `${helpfulText} 기운은 거창한 결심이 아니라 불 켜기, 씻기, 사람에게 연락하기처럼 몸을 살리는 작은 순서로 써.`,
      '이 감정이 반복되면 병원, 상담센터, 지역 정신건강복지센터를 예약해. 약해져서가 아니라 혼자 들기엔 너무 무거운 짐이라 도움을 붙이는 거야.'
    ].map((item, index) => `${index + 1}. ${item}`);
  }

  const question = answer.question;
  const intent = getQuestionIntent(question, category);
  const directAnswer = buildQuestionDirectAnswer(question, category, basis);
  const options = extractQuestionOptions(question);
  const optionText = options.length >= 2 ? `${options.join('·')} 각각` : '선택지 각각';
  const customerLabel = getPremiumCustomerLabel(basis);
  const careerFits = getCareerFitByTenGods(basis).join(', ');
  const isDatingPlace = /어디.*연애|연애.*어디|만날|소개|인연/.test(question.replace(/\s/g, ''));
  const isMoving = /이사|거주|동네|지역|역세권|집|방/.test(question.replace(/\s/g, ''));

  const placeGuide = isDatingPlace
    ? '장소는 지인 소개, 반복 수업, 운동·스터디, 동네 카페, 업무권 모임처럼 같은 사람을 여러 번 볼 수 있는 곳으로 잡으세요.'
    : isMoving
      ? `${optionText}을 평일 출근 시간, 평일 밤, 주말 낮에 직접 걸어 보면서 소음, 이동, 생활 편의, 귀가 피로를 확인하세요.`
      : '현장은 말로 듣는 곳이 아니라 실제 돈, 사람, 일정이 움직이는 장소에서 확인하세요.';

  return [
    `${directAnswer}`,
    `${customerLabel}의 명리 근거는 ${basis.dayMaster.stem} 일간, ${basis.pillars.month} 월령, ${currentDayunName} 대운입니다. 이 조합은 감정적 확신보다 실제 유지 조건을 먼저 봐야 답이 안정됩니다.`,
    `언제 움직일지: 오늘 바로 결론내리지 말고 7일 동안 ${intent}과 관련된 돈, 시간, 체력, 사람 반응을 하루 한 줄씩 기록하세요.`,
    `어디서 확인할지: ${placeGuide}`,
    `어떻게 판단할지: 메모앱에 ${optionText}의 장점 3개, 단점 3개, 숨은 비용 3개를 적고 “한 달 뒤에도 버틸 수 있는가”로 비교하세요.`,
    `누구와 상의할지: 감정적으로 편드는 사람보다 실제 계약, 이동, 돈, 관계를 냉정하게 봐줄 사람 1명에게만 먼저 보여 주세요.`,
    `돈과 일 기준: 직업·수익 질문이라면 추천 업종은 ${careerFits}이며, 수익 구조는 단건 노동보다 가격표, 제공 범위, 결과물, 재구매가 남는 방식으로 설계하는 편이 좋습니다.`,
    `관계 기준: 상대나 주변 사람의 말보다 약속 시간, 답장 간격, 돈 쓰는 태도, 피곤할 때의 말투처럼 반복 행동을 보세요. 이 부분이 맞아야 오래 갑니다.`,
    `피해야 할 방식: ${cautionGuidance} 특히 밤에 감정이 올라온 상태에서 계약, 이사, 고백, 퇴사, 큰 결제를 한 번에 결정하지 마세요.`,
    `최종 결론 규칙: ${helpfulText} 기운이 살아나는 선택은 몸이 덜 지치고, 기록이 남고, 다음 약속이 선명합니다. 7일 기록에서 돈·사람·체력 중 2개 이상이 편한 쪽을 우선 답으로 잡으세요.`
  ].map((item, index) => `${index + 1}. ${item.replace(/^\d+[\).]\s*/, '')}`);
}

export function strengthenQuestionAnswerQuality(
  answer: QuestionAnswerBlock,
  basis: DeterministicSajuBasis,
  options: {
    formData?: Partial<IntakeFormData>;
    helpful?: FiveElement[];
    cautious?: FiveElement[];
    currentDayunName?: string;
    questionIndex?: number;
  } = {}
): QuestionAnswerBlock {
  const category = getQuestionCategory(answer.question);
  const helpful = options.helpful?.length ? options.helpful : basis.helpfulElements;
  const cautious = options.cautious?.length ? options.cautious : basis.cautiousElements;
  const helpfulText = helpful.join(', ') || '보완 오행';
  const cautionGuidance = formatElementGuidance(cautious, basis);
  const currentDayunName = getCurrentDayunName(basis, options.formData, options.currentDayunName);
  const premiumAnalysis = buildPremiumQuestionAnalysis(
    answer,
    basis,
    category,
    currentDayunName,
    helpfulText,
    cautionGuidance
  );
  const analysis = category === 'crisis'
    ? getQuestionTextLength(answer.analysis) >= PREMIUM_QUESTION_MIN_ANALYSIS_CHARS
      ? answer.analysis
      : buildCrisisSafetyAnalysis(answer, basis, currentDayunName)
    : getQuestionTextLength(answer.analysis) >= PREMIUM_QUESTION_MIN_ANALYSIS_CHARS
      ? answer.analysis
      : `${answer.analysis}\n\n${premiumAnalysis}`;
  const existingAdvice = answer.advice
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, PREMIUM_QUESTION_ADVICE_COUNT);
  const advice = existingAdvice.length >= PREMIUM_QUESTION_ADVICE_COUNT
    ? existingAdvice.map((item, index) => `${index + 1}. ${item.replace(/^\d+[\).]\s*/, '')}`)
    : getPremiumQuestionAdvice(answer, basis, category, currentDayunName, helpfulText, cautionGuidance);

  return {
    ...answer,
    question: answer.question,
    title: buildPremiumQuestionTitle(answer, category),
    analysis,
    advice
  };
}

function buildQuestionResponse(
  question: string,
  category: QuestionCategory,
  basis: DeterministicSajuBasis,
  relationshipLabel: string,
  currentDayunName: string,
  helpful: FiveElement[],
  cautious: FiveElement[],
  questionIndex = 0
) {
  const dayMaster = basis.dayMaster.stem;
  const helpfulText = helpful.join(', ') || '보완 오행';
  const cautionGuidance = formatElementGuidance(cautious, basis);
  const context = getRelationshipContextSentence(relationshipLabel);

  if (category === 'crisis') {
    const address = getCasualAddressParts(basis.input.name || '');
    const dominantTenGodText = getDominantTenGodText(basis);
    const isExistential = isExistentialCrisisQuestion(question) || questionIndex > 0;

    return {
      label: isExistential
        ? `${address.titleLead} 인생 답을 혼자 결론내리면 안 돼`
        : `${address.titleLead} 혼자 버티는 날이 아니야`,
      analysis: isExistential
        ? `${address.opening} “나 왜 살지”라는 말은 가벼운 질문이 아니라 몸과 마음이 한계까지 밀렸다는 신호야. ${dayMaster} 일간은 힘든 티를 바로 내기보다 속으로 오래 붙잡고, ${basis.pillars.month} 월령은 밤이 깊을수록 생각을 혼자 키우는 쪽이야. 여기에 ${currentDayunName} 대운과 ${dominantTenGodText} 흐름이 겹치면 돈, 사람, 책임, 잠 부족이 한꺼번에 몰려서 “내 편이 없다”는 느낌이 확 커질 수 있어. ${address.subject} 지금 인생 결론을 낼 상태가 아니야. 이 명식에서 지금 가장 먼저 살릴 건 큰 의미가 아니라 몸의 온도와 사람의 연결이야. 오늘은 답을 찾는 날이 아니라 사람 옆에 붙어 있어야 하는 날이야.`
        : `${address.opening} 이 말은 그냥 운세 문장으로 넘길 말이 아니야. ${dayMaster} 일간은 힘든 티를 바로 내기보다 속으로 오래 붙잡는 쪽이고, ${basis.pillars.month} 월령은 생각이 밤에 더 깊어지는 구조를 만들어. 여기에 ${currentDayunName} 대운과 ${dominantTenGodText} 흐름이 겹치면 돈, 사람, 책임, 잠 부족이 한꺼번에 밀려오면서 “아무도 모르게 사라지고 싶다”는 식으로 마음이 닫힐 수 있어. 이건 의지가 약해서가 아니야. 지금 비어 있는 건 버틸 힘이 아니라 ${address.object} 붙잡아 줄 사람, 잠, 따뜻한 음식, 위험한 물건과의 거리야. 그러니까 오늘 결론은 하나야. 안전이 먼저야. 오늘은 혼자 있으면 안 돼.`,
      advice: [
        `${address.aloneLine} 문을 잠그고 버티지 말고, 가까운 사람 한 명에게 “나 지금 혼자 있으면 위험해. 같이 있어줘”라고 바로 보내.`,
        '술, 약, 칼, 끈, 높은 곳, 차 키처럼 자신을 다치게 할 수 있는 물건과 장소에서 지금 바로 떨어져.',
        '한국이면 자살예방 상담전화 109로 전화해. 지금 당장 위험하면 119나 112로 바로 전화해. 해외라면 현지 응급번호나 가까운 응급실로 가.',
        `${helpfulText} 기운은 지금 “큰 결심”이 아니라 아주 작은 생활 회복으로 써야 해. 물 한 컵 마시기, 불 켜기, 침대 밖으로 나오기, 사람에게 연락하기. 오늘 목표는 인생 결론이 아니라 다음 10분을 안전하게 넘기는 거야.`
      ]
    };
  }

  if (category === 'career') {
    const careerGuide = buildCareerIndustryGuide(dayMaster, currentDayunName, helpfulText, cautionGuidance, basis);

    return {
      label: '직업·커리어 질문 직답',
      analysis: `질문 "${question}"은 직업 이름 하나를 맞히는 데서 끝나지 않고, 지금 가진 능력을 어떤 업종과 역할에서 돈이 남는 일로 바꿀지에 대한 질문입니다. ${dayMaster} 일간은 판단의 기준선이 분명할 때 흔들림이 줄고, ${currentDayunName} 대운에서는 전문성을 상품명, 가격표, 제공 범위로 바꿀수록 커리어 성장이 빨라집니다.`,
      advice: careerGuide
    };
  }

  if (category === 'relationship') {
    const relationshipProfile = getElementLoveSignature(basis.dayMaster.element as FiveElement);

    return {
      label: '관계 질문 직답',
      analysis: `질문 "${question}"은 관계의 결과를 단정하기보다, ${dayMaster} 일간이 사랑을 운영하는 방식과 ${currentDayunName} 대운의 현실 압력을 함께 봐야 합니다. ${context} 이 흐름에서는 감정의 크기보다 생활 기준, 연락 리듬, 책임 분배가 맞는지가 더 결정적입니다. 인연상은 ${relationshipProfile.archetype} 쪽으로 읽히며, ${relationshipProfile.image}`,
      advice: [
        `만남 경로는 ${relationshipProfile.meetingRoute} 이 흐름에서 잘 열립니다.`,
        `상대의 직업은 하나로 단정하지 말고 ${relationshipProfile.jobField} 같은 생활 환경과 책임 방식을 참고하세요.`,
        `잘 맞는 포인트는 ${relationshipProfile.fitPoint}`,
        '상대의 마음을 추측하기보다 반복되는 행동, 약속을 지키는 방식, 갈등 후 회복 속도를 먼저 보세요.',
        `${helpfulText} 기운이 살아날 때는 대화가 부드러워지고 관계의 기준을 다시 맞추기 쉽습니다. 중요한 이야기는 그 흐름에 맞춰 차분히 꺼내는 편이 좋습니다.`,
        `${cautionGuidance} 서운함이 올라오는 날에는 바로 결론으로 바꾸지 말고, 감정 표현은 짧게 요구사항은 구체적으로 남기는 방식이 안전합니다.`
      ]
    };
  }

  if (category === 'money') {
    return {
      label: '재물·사업 질문 직답',
      analysis: `질문 "${question}"은 단순히 돈이 들어오느냐보다 돈이 남는 구조가 있는지를 봐야 합니다. ${dayMaster} 일간은 기준이 분명할수록 가격, 패키지, 고객 경험을 정돈하는 힘이 살아나고, ${currentDayunName} 대운에서는 기회를 매출 구조로 바꾸는 설계가 중요합니다.`,
      advice: [
        '새로운 수익원을 늘리기 전에 가격표, 제공 범위, 환불 기준, 고객 안내 문구를 먼저 고정하세요.',
        `${helpfulText} 기운은 기록과 비교, 반복 매출 구조를 통해 안정됩니다. 감으로 팔기보다 상품명을 분명히 나누면 설득력이 올라갑니다.`,
        `${cautionGuidance} 가까운 사람과의 돈 거래, 말로만 정한 동업, 즉흥 지출은 특히 조심하는 편이 좋습니다.`
      ]
    };
  }

  if (category === 'timing') {
    return {
      label: '시기 질문 직답',
      analysis: `질문 "${question}"은 운의 좋고 나쁨보다 어느 순서로 움직일 때 손실이 적은지를 묻는 질문입니다. ${currentDayunName} 대운은 지금 선택한 구조가 몇 년 뒤의 결과로 이어지는 구간이므로, 속도보다 준비의 완성도가 더 중요합니다.`,
      advice: [
        '지금 바로 넓히는 선택보다, 먼저 정리하고 공개하고 검증하는 3단계로 움직이면 실패 비용이 줄어듭니다.',
        `${helpfulText} 기운이 들어오는 달에는 출시, 제안, 관계 회복처럼 밖으로 꺼내는 행동이 좋습니다.`,
        `${cautionGuidance} 계약, 큰 지출, 관계 단절처럼 되돌리기 어려운 선택은 한 박자 늦추는 편이 안전합니다.`
      ]
    };
  }

  if (category === 'caution') {
    return {
      label: '주의점 질문 직답',
      analysis: `질문 "${question}"은 현재 흐름에서 무엇을 피해야 하는지에 초점이 있습니다. ${dayMaster} 일간은 기준이 서면 흔들림이 적습니다. ${cautionGuidance}`,
      advice: [
        '지금 가장 조심할 것은 사람 자체보다 기준 없는 약속입니다. 역할, 돈, 일정이 흐릿한 관계는 반드시 문서나 메시지로 남기세요.',
        `${helpfulText} 흐름은 감정을 가라앉히고 선택지를 좁히는 데 도움을 줍니다. 기록을 남기는 순간 막연한 불안이 관리 가능한 일정으로 바뀝니다.`,
        '불안할수록 결론을 빨리 내고 싶어지지만, 이 사주는 한 박자 늦춘 판단이 오히려 더 큰 손실을 막습니다.'
      ]
    };
  }

  if (category === 'health') {
    return {
      label: '생활 리듬 질문 직답',
      analysis: `질문 "${question}"은 건강을 질환 예측으로 단정하기보다 생활 리듬의 균형으로 보는 편이 안전합니다. ${currentDayunName} 대운에서는 일과 감정이 동시에 몰릴 때 컨디션이 흔들릴 수 있어, 휴식도 일정처럼 관리해야 합니다.`,
      advice: [
        '수면, 식사, 이동 시간을 먼저 고정하면 감정 기복과 판단 피로가 함께 줄어듭니다.',
        `${helpfulText} 기운은 정리된 공간과 반복 루틴에서 살아납니다. 하루 시작과 마감 의식을 작게라도 만들어 두세요.`,
        `${cautionGuidance} 무리한 약속, 늦은 밤 결정, 과도한 카페인처럼 리듬을 깨는 선택을 줄이는 편이 좋습니다.`
      ]
    };
  }

  return {
    label: '종합 질문 직답',
    analysis: `질문 "${question}"은 ${dayMaster} 일간의 판단 방식과 ${currentDayunName} 대운 흐름을 함께 봐야 더 정확합니다. ${context} 지금은 감정보다 기준, 기준보다 실행 순서를 어떻게 잡는지가 결과를 가릅니다.`,
    advice: [
      '먼저 질문을 “선택지 A와 B 중 무엇이 더 현실적인가”로 나누면 답이 훨씬 선명해집니다.',
      `${helpfulText} 흐름과 맞는 환경을 만들면 판단이 안정되고, 반복되는 고민의 핵심이 더 빨리 드러납니다.`,
      `${cautionGuidance} 말과 지출을 줄이고, 중요한 결정은 기록으로 남긴 뒤 다시 확인하세요.`
    ]
  };
}

function buildQuestionAnswers(
  formData: Partial<IntakeFormData>,
  basis: DeterministicSajuBasis,
  helpful: FiveElement[],
  cautious: FiveElement[]
): QuestionAnswerBlock[] {
  const relationshipLabel = getRelationshipLabel(formData);
  const currentDayunName = basis.dayun.find((row) => {
    const currentAge = computeCurrentAge(formData);
    const range = parseAgeRange(row.age);
    return currentAge >= range.start && currentAge <= range.end;
  })?.ganzhi;

  return [formData.q1, formData.q2]
    .filter((item): item is string => Boolean(item?.trim()))
    .map((question, index) => {
      const response = buildQuestionResponse(
        question,
        getQuestionCategory(question),
        basis,
        relationshipLabel,
        currentDayunName || basis.dayun[0]?.ganzhi || '현재 대운',
        helpful,
        cautious,
        index
      );

      return {
        question,
        title: `${index + 1}. ${response.label}`,
        analysis: response.analysis,
        advice: response.advice
      };
    })
    .map((answer, index) => strengthenQuestionAnswerQuality(answer, basis, {
      formData,
      helpful,
      cautious,
      currentDayunName: currentDayunName || basis.dayun[0]?.ganzhi || '현재 대운',
      questionIndex: index
    }));
}

function buildActionPlan(
  yearLuck: YearLuckItem[],
  helpful: FiveElement[],
  cautious: FiveElement[]
): ActionPlan {
  const bestYear = [...yearLuck].sort((a, b) => b.score - a.score)[0];

  return {
    title: '종합사주 실행 계획',
    priorities: [
      `${helpful.join(', ')} 기운과 맞는 루틴을 먼저 고정하기`,
      '기회가 보여도 확장보다 구조를 먼저 설계하기',
      `${bestYear.year}년 흐름을 살릴 수 있도록 핵심 상품과 관계 기준을 미리 정리하기`
    ],
    dos: [
      '결정이 필요한 일은 메모와 문서로 기준을 남기기',
      '관계와 일의 우선순위를 하루 단위가 아니라 주간 단위로 점검하기',
      '체력과 집중력이 떨어지는 구간을 미리 비워 두기',
      '반복 가능한 구조를 만들 수 있는 일에 먼저 에너지를 쓰기'
    ],
    avoids: [
      '감정이 크게 흔들리는 날 즉시 결론 내리기',
      '근거 없는 낙관만 믿고 범위를 넓히기',
      '모든 요청을 직접 다 받으면서 리듬을 무너뜨리기',
      `${cautious.join(', ')} 기운이 강한 시기에 과한 약속이나 지출을 늘리기`
    ],
    luckyDays: [
      { day: 5, reason: `${helpful[0]} 기운이 가볍게 열리면서 시작을 잡기 좋은 날입니다.` },
      { day: 14, reason: '관계와 대화의 기준을 정리하기에 적절한 날입니다.' },
      { day: 23, reason: '일정과 선택을 함께 정리하면서 결론을 내리기 좋은 날입니다.' }
    ],
    unluckyDays: [
      { day: 8, reason: `${cautious[0]} 기운이 치우치면 피로와 조급함이 함께 올라올 수 있습니다.` },
      { day: 17, reason: '말의 속도보다 의도를 먼저 점검해야 하는 날입니다.' },
      { day: 27, reason: '무리한 지출이나 무리한 일정이 후폭풍으로 돌아오기 쉬운 날입니다.' }
    ]
  };
}

function buildPillarTable(basis: DeterministicSajuBasis) {
  const hidden = (pillar: string | null) => {
    if (!pillar) return '-';
    const branch = [...pillar][1];
    return HIDDEN_STEMS_KO[branch]?.join(', ') || '-';
  };

  return {
    headers: ['구분', '년주', '월주', '일주', '시주'],
    rows: [
      ['천간/지지', basis.pillars.year, basis.pillars.month, basis.pillars.day, basis.pillars.hour || '미상'],
      ['지장간', hidden(basis.pillars.year), hidden(basis.pillars.month), hidden(basis.pillars.day), hidden(basis.pillars.hour)],
      ['해석 포인트', '배경과 집안 흐름', '환경과 성장 구간', '내면 중심축', basis.pillars.hour ? '생활 리듬과 습관' : '시간 미입력']
    ]
  };
}

function getElementLoveSignature(element: FiveElement) {
  const signatures: Record<
    FiveElement,
    {
      archetype: string;
      image: string;
      jobField: string;
      meetingRoute: string;
      fitPoint: string;
      tensionPoint: string;
      marriagePoint: string;
      drawnTo: string;
      longTermType: string;
      failingPattern: string;
      perceivedStyle: string;
      contactStyle: string;
      hiddenNeed: string;
      breakupTrigger: string;
      loveStamina: string;
      spouseFace: string;
      marriedLife: string;
      dontMiss: string;
      avoidPeople: string;
    }
  > = {
    목: {
      archetype: '성장형 파트너',
      image: '말투가 부드럽고 배움, 성장, 자기계발의 결이 있는 사람입니다. 외적으로는 화려함보다 맑고 편안한 분위기, 자연스러운 미소, 깔끔한 생활감이 먼저 보일 가능성이 큽니다.',
      jobField: '교육, 기획, 콘텐츠, 상담, 브랜딩, 디자인, 출판, 커뮤니티 운영처럼 사람의 성장을 돕거나 생각을 구조화하는 분야와 인연이 잘 닿습니다.',
      meetingRoute: '강의, 스터디, 세미나, 책/콘텐츠 기반 모임, 지인 소개, 일과 배움이 겹치는 자리에서 인연이 열리기 쉽습니다.',
      fitPoint: '서로를 고치려 하기보다 성장시키는 대화가 잘 맞습니다. 작은 목표를 함께 세우고 응원하는 관계가 오래 갑니다.',
      tensionPoint: '상대가 느리거나 애매하게 말하면 혼자 결론을 내리기 쉬우니, 기대치를 말로 확인하는 과정이 필요합니다.',
      marriagePoint: '결혼은 함께 배우고 생활을 개선하는 프로젝트처럼 운영할 때 안정됩니다. 집, 돈, 커리어 계획을 같이 업데이트하는 사람이 잘 맞습니다.',
      drawnTo: '말이 통하고 배울 점이 있는 사람에게 마음이 먼저 열립니다. 외모보다 대화의 결, 자기관리, 성장하려는 태도에 끌리기 쉽습니다.',
      longTermType: '오래 가는 사람은 속도가 빠른 사람이 아니라, 약속한 것을 작게라도 꾸준히 바꾸는 사람입니다. 함께 계획을 세우고 업데이트하는 관계가 가장 안정적입니다.',
      failingPattern: '처음엔 이해하려고 많이 참다가, 상대가 계속 애매하면 어느 순간 마음속에서 관계를 정리해버리는 패턴이 생기기 쉽습니다.',
      perceivedStyle: '상대는 처음에 당신을 신중하고 쉽게 열리지 않는 사람으로 느낄 수 있습니다. 가까워지면 조언을 아끼지 않고 관계를 더 나은 방향으로 끌고 가려는 사람으로 보입니다.',
      contactStyle: '연락은 빈도보다 대화의 질이 중요합니다. 의미 없는 연락이 길어지면 지치고, 서로의 하루를 이해하는 대화가 쌓이면 마음이 안정됩니다.',
      hiddenNeed: '사랑 안에서 가장 원하는 것은 “나를 성장하게 해주는 안정감”입니다. 무조건적인 칭찬보다 내 방향을 존중해주는 태도에 깊이 안심합니다.',
      breakupTrigger: '반복되는 무성의함, 배움 없는 태도, 약속을 말로만 하는 모습이 누적되면 감정이 급격히 식을 수 있습니다.',
      loveStamina: '감정 체력은 긴 편이지만, 관계가 제자리걸음이라고 느끼면 혼자 많은 생각을 하다가 지칩니다. 중간 점검 대화가 꼭 필요합니다.',
      spouseFace: '얼굴 인상은 선이 부드럽고 깨끗한 분위기, 자연스러운 미소, 단정한 헤어와 옷차림이 먼저 떠오릅니다. 화려한 압도감보다 편안하고 지적인 느낌이 강합니다.',
      marriedLife: '결혼 후에는 함께 배우고 생활을 개선하는 부부상에 가깝습니다. 집, 돈, 커리어 계획을 주기적으로 맞추면 친구 같은 안정감이 커집니다.',
      dontMiss: '말보다 실천이 느리더라도 꾸준히 배우고 고치려는 사람은 놓치지 않는 편이 좋습니다.',
      avoidPeople: '성장 의지는 말뿐이고 매번 같은 문제를 반복하는 사람, 당신의 계획을 가볍게 보는 사람은 피해야 합니다.'
    },
    화: {
      archetype: '표현형 파트너',
      image: '표정과 리액션이 살아 있고, 분위기를 밝히는 힘이 있는 사람입니다. 스타일은 감각적이고, 사람 앞에서 자기 매력을 자연스럽게 보여주는 타입일 가능성이 큽니다.',
      jobField: '마케팅, 미디어, 예술, 공연, 뷰티, 서비스, 홍보, SNS, 강의처럼 표현력과 사람의 반응을 읽는 분야와 연결되기 쉽습니다.',
      meetingRoute: '모임, 행사, 공연, 소개팅, SNS, 취미 클래스, 친구가 함께 있는 열린 자리에서 인연의 불씨가 붙기 쉽습니다.',
      fitPoint: '감정을 숨기지 않고 따뜻하게 표현해주는 사람이 잘 맞습니다. 함께 웃는 시간이 많을수록 관계가 빨리 가까워집니다.',
      tensionPoint: '감정의 온도가 빠르게 올라가면 확인보다 확신이 앞설 수 있습니다. 서두른 약속, 과한 기대, 즉흥적인 결정을 조심해야 합니다.',
      marriagePoint: '결혼은 애정 표현과 현실 계획이 균형을 이룰 때 좋습니다. 사랑은 뜨겁게, 생활은 차분하게 나눌 수 있는 사람이 안정적입니다.',
      drawnTo: '표현이 분명하고 나를 특별하게 대한다는 느낌을 주는 사람에게 끌립니다. 분위기, 센스, 말투, 눈빛처럼 감정이 살아 있는 신호에 약합니다.',
      longTermType: '오래 가는 사람은 설렘을 주면서도 생활 약속을 놓치지 않는 사람입니다. 이벤트보다 평소의 다정함이 일정한 사람이 더 잘 맞습니다.',
      failingPattern: '초반에 마음이 뜨거워질수록 상대의 현실 조건을 늦게 확인할 수 있습니다. 기대가 커진 뒤 실망하면 감정의 낙폭도 커집니다.',
      perceivedStyle: '상대는 당신을 매력은 있지만 기준이 높은 사람으로 느낄 수 있습니다. 가까워지면 애정 표현을 원하면서도 자존심 때문에 먼저 말하지 않는 면이 보입니다.',
      contactStyle: '연락은 온도 확인의 의미가 큽니다. 답장 속도보다 말의 따뜻함, 바쁜 중에도 나를 기억하는 짧은 신호가 중요합니다.',
      hiddenNeed: '가장 원하는 것은 “나를 선택했다는 확실한 표현”입니다. 마음을 알면서도 표현을 아끼는 사람에게는 불안이 커질 수 있습니다.',
      breakupTrigger: '말과 행동의 온도 차이, 반복되는 무관심, 중요한 순간에 나를 우선순위 밖으로 두는 태도가 쌓이면 관계가 꺼질 수 있습니다.',
      loveStamina: '연애 에너지는 강하게 붙지만, 감정 기복이 큰 관계에서는 빨리 소진됩니다. 설렘과 휴식의 균형이 필요합니다.',
      spouseFace: '얼굴 인상은 눈빛이 선명하고 표정이 밝은 편, 스타일에 감각이 있는 사람이 떠오릅니다. 웃을 때 분위기가 확 살아나는 사람이 인연상에 가깝습니다.',
      marriedLife: '결혼 후에는 애정 표현과 현실 계획을 함께 챙기는 부부상이 좋습니다. 기념일과 일상 루틴을 모두 관리할 때 만족도가 높습니다.',
      dontMiss: '바쁜 중에도 마음을 표현하고, 작은 약속을 이벤트처럼 소중히 여기는 사람은 놓치지 않는 편이 좋습니다.',
      avoidPeople: '초반 감정만 크게 흔들고 책임 있는 행동은 늦는 사람, 말은 달콤하지만 생활 기준이 없는 사람은 피해야 합니다.'
    },
    토: {
      archetype: '안정형 파트너',
      image: '큰 말보다 꾸준한 행동으로 신뢰를 쌓는 사람입니다. 분위기는 차분하고 안정적이며, 처음에는 느려 보여도 시간이 갈수록 책임감이 드러나는 타입입니다.',
      jobField: '행정, 공공기관, 회계, 재무관리, 부동산, 건축, 식품, 운영관리, 조직 내 실무 책임자처럼 현실 기반이 단단한 분야와 인연이 닿기 쉽습니다.',
      meetingRoute: '지인 소개, 가족/동료 연결, 동네 생활권, 직장 근처, 반복적으로 마주치는 안정적인 공간에서 관계가 천천히 열릴 가능성이 큽니다.',
      fitPoint: '생활 기준, 돈 관리, 약속 이행이 맞으면 관계가 깊게 안정됩니다. 말보다 반복 행동을 보는 방식이 잘 맞습니다.',
      tensionPoint: '관계가 답답하게 느껴질 때 바로 밀어붙이면 상대가 닫힐 수 있습니다. 속도보다 신뢰 축적이 먼저입니다.',
      marriagePoint: '결혼은 감정보다 생활 기반이 먼저 맞아야 합니다. 주거, 저축, 가족과의 거리, 역할 분담을 구체적으로 맞추면 오래 갑니다.',
      drawnTo: '믿음직하고 생활이 단단한 사람에게 끌립니다. 말이 많지 않아도 책임감, 안정감, 경제관념이 보이면 마음이 깊어집니다.',
      longTermType: '오래 가는 사람은 연락을 화려하게 잘하는 사람이 아니라, 매일의 태도가 변하지 않는 사람입니다. 돈과 시간 약속을 가볍게 보지 않는 사람이 가장 잘 맞습니다.',
      failingPattern: '처음엔 참고 기다리지만, 상대가 책임을 미루거나 생활이 흐트러지면 정이 식기 쉽습니다. 실망을 오래 품다가 한 번에 선을 긋는 패턴을 조심해야 합니다.',
      perceivedStyle: '상대는 당신을 쉽게 흔들리지 않는 사람으로 느낍니다. 다만 감정을 바로 드러내지 않아 “마음이 없는 건가”라는 오해를 받을 수 있습니다.',
      contactStyle: '연락은 꾸준함이 핵심입니다. 긴 메시지보다 정해진 시간의 짧은 확인, 바쁜 날에도 끊기지 않는 루틴이 마음을 안정시킵니다.',
      hiddenNeed: '가장 원하는 것은 “내가 기대어도 무너지지 않는 관계”입니다. 무조건적인 설렘보다 같이 살아도 안전하겠다는 감각이 중요합니다.',
      breakupTrigger: '책임 회피, 돈 문제, 가족 문제의 경계 없음, 반복되는 약속 파기가 결정적인 이별 사유가 될 수 있습니다.',
      loveStamina: '연애를 가볍게 소비하기보다 오래 책임지는 타입입니다. 다만 관계가 계속 불안하면 회복 시간이 길어지니 초반 기준 확인이 중요합니다.',
      spouseFace: '얼굴 인상은 차분하고 단정한 분위기, 선이 안정적이고 눈매가 편안한 사람이 떠오릅니다. 첫눈에 강렬하기보다 볼수록 신뢰가 쌓이는 인상입니다.',
      marriedLife: '결혼 후에는 역할 분담형, 생활 안정형 부부상이 좋습니다. 집안일, 돈관리, 가족과의 거리까지 현실 기준을 맞출수록 오래 갑니다.',
      dontMiss: '느리지만 책임을 미루지 않고, 말보다 행동으로 생활을 맞춰오는 사람은 놓치지 않는 편이 좋습니다.',
      avoidPeople: '돈 개념이 불안정한 사람, 감정은 뜨겁지만 일상 책임을 피하는 사람, 가족과의 경계가 흐린 사람은 피해야 합니다.'
    },
    금: {
      archetype: '기준형 파트너',
      image: '단정하고 깔끔하며 자기 기준이 분명한 사람입니다. 말투는 담백하고, 감정 표현은 과하지 않지만 약속과 선을 지키는 모습에서 신뢰가 생기는 타입입니다.',
      jobField: '금융, 법무, 데이터, 기술, 엔지니어링, 전문 서비스, 품질관리, 컨설팅처럼 정확성, 기준, 전문성이 필요한 분야와 인연이 강합니다.',
      meetingRoute: '일, 프로젝트, 계약, 협업, 전문 모임, 소개를 통한 공식적인 만남에서 관계가 시작될 가능성이 큽니다.',
      fitPoint: '서로의 기준과 영역을 존중할 때 잘 맞습니다. 감정 과잉보다 약속, 책임, 실력으로 신뢰를 쌓는 관계가 안정적입니다.',
      tensionPoint: '표현이 적다고 마음이 없는 것으로 단정하면 오해가 커질 수 있습니다. 말투보다 행동의 일관성을 봐야 합니다.',
      marriagePoint: '결혼은 서로의 역할과 책임이 명확할수록 좋습니다. 돈, 시간, 가족 문제를 문서처럼 분명하게 정리하는 사람이 잘 맞습니다.',
      drawnTo: '능력 있고 자기 기준이 분명한 사람에게 끌립니다. 흐릿한 다정함보다 일 잘하는 태도, 깔끔한 매너, 선을 지키는 품격에 마음이 움직입니다.',
      longTermType: '오래 가는 사람은 감정 표현이 과한 사람이 아니라, 약속과 책임을 정확히 지키는 사람입니다. 서로의 영역을 존중하는 관계가 안정적입니다.',
      failingPattern: '상대를 오래 검증하다가 표현 타이밍을 놓칠 수 있습니다. 마음은 있는데 차갑게 보여 상대가 먼저 물러나는 흐름을 조심해야 합니다.',
      perceivedStyle: '상대는 당신을 단정하고 기준이 높은 사람으로 느낍니다. 가까워지기 전에는 벽이 있어 보이지만, 신뢰가 생기면 책임감이 강한 사람으로 보입니다.',
      contactStyle: '연락은 간결하고 목적이 분명한 편이 잘 맞습니다. 다만 너무 업무처럼 대하면 정서적 온도가 낮아질 수 있어 짧은 애정 표현을 의식적으로 섞는 편이 좋습니다.',
      hiddenNeed: '가장 원하는 것은 “존중받는 관계”입니다. 사생활, 일, 돈, 가족 문제에서 내 기준을 함부로 넘지 않는 사람에게 깊이 안심합니다.',
      breakupTrigger: '무례함, 약속 불이행, 경계 침범, 말과 행동의 불일치가 누적되면 감정 회복이 어렵습니다.',
      loveStamina: '관계 유지력은 강하지만, 신뢰가 깨지면 다시 여는 데 시간이 오래 걸립니다. 작은 불만을 너무 늦게 말하지 않는 것이 중요합니다.',
      spouseFace: '얼굴 인상은 선이 정돈되고 깔끔한 스타일, 단정한 옷차림과 차분한 눈빛이 먼저 떠오릅니다. 말보다 태도에서 신뢰가 느껴지는 사람입니다.',
      marriedLife: '결혼 후에는 역할과 책임이 명확한 파트너십이 좋습니다. 돈, 시간, 가족 문제를 감정싸움이 아니라 합의표처럼 정리할 때 안정됩니다.',
      dontMiss: '표현은 담백해도 약속을 정확히 지키고, 당신의 영역을 존중하는 사람은 놓치지 않는 편이 좋습니다.',
      avoidPeople: '말을 바꾸는 사람, 선을 넘는 사람, 감정으로 책임을 흐리는 사람, 기준 없이 즉흥적으로 움직이는 사람은 피해야 합니다.'
    },
    수: {
      archetype: '지성형 파트너',
      image: '조용히 관찰하고 깊게 생각하는 사람입니다. 처음에는 거리를 두는 듯 보여도 대화가 깊어질수록 매력이 살아나는 타입이며, 지적이고 차분한 분위기가 강합니다.',
      jobField: 'IT, 연구, 데이터, 유통, 해외/무역, 물류, 상담, 글쓰기, 정보 서비스처럼 정보와 흐름을 다루는 분야와 인연이 닿기 쉽습니다.',
      meetingRoute: '온라인, 이동 중 연결, 스터디, 커뮤니티, 글/콘텐츠를 통한 접점, 늦은 시간의 대화처럼 말과 정보가 먼저 이어지는 장면에서 열리기 쉽습니다.',
      fitPoint: '깊은 대화, 사적인 고민 공유, 서로의 고독을 존중하는 방식이 잘 맞습니다. 가벼운 표현보다 진심 어린 대화가 관계를 움직입니다.',
      tensionPoint: '생각이 많아질수록 관계를 혼자 해석하기 쉽습니다. 불안할 때는 추측보다 짧고 명확한 확인이 필요합니다.',
      marriagePoint: '결혼은 정서적 안전감과 대화의 깊이가 핵심입니다. 각자의 시간을 존중하면서도 중요한 결정을 함께 공유하는 사람이 안정적입니다.',
      drawnTo: '겉으로 요란하지 않아도 대화가 깊고 생각이 섬세한 사람에게 끌립니다. 쉽게 다가오는 사람보다 천천히 마음을 열게 만드는 사람에게 약합니다.',
      longTermType: '오래 가는 사람은 감정을 몰아붙이지 않고, 혼자만의 시간과 깊은 대화를 모두 존중해주는 사람입니다. 말의 결이 편안해야 관계가 안정됩니다.',
      failingPattern: '불안할 때 상대의 말과 행동을 오래 해석하다가 혼자 결론을 내릴 수 있습니다. 확인하지 않은 추측이 관계를 지치게 만들 수 있습니다.',
      perceivedStyle: '상대는 당신을 조용하지만 속이 깊은 사람으로 느낍니다. 다만 감정을 숨길 때는 거리를 두는 사람처럼 보여 상대가 다가올 타이밍을 놓칠 수 있습니다.',
      contactStyle: '연락은 깊은 대화가 중요합니다. 짧아도 진심이 담긴 메시지, 하루의 감정이나 생각을 나누는 연락이 관계를 안정시킵니다.',
      hiddenNeed: '가장 원하는 것은 “내 복잡한 마음을 안전하게 꺼낼 수 있는 사람”입니다. 판단보다 경청, 조언보다 이해가 먼저일 때 마음이 열립니다.',
      breakupTrigger: '정서적 방치, 애매한 태도, 긴 침묵, 중요한 이야기를 피하는 흐름이 반복되면 관계를 혼자 놓아버릴 수 있습니다.',
      loveStamina: '감정은 깊지만 소모도 깊습니다. 오래 가려면 혼자 회복하는 시간과 둘이 확인하는 시간이 균형을 이뤄야 합니다.',
      spouseFace: '얼굴 인상은 차분하고 눈빛이 깊은 편, 말수가 많지 않아도 묘하게 시선이 가는 분위기가 떠오릅니다. 조용한 매력과 지적인 인상이 강합니다.',
      marriedLife: '결혼 후에는 서로의 고독과 대화를 모두 존중하는 부부상이 좋습니다. 각자의 시간을 지켜주면서도 중요한 선택은 함께 공유해야 안정됩니다.',
      dontMiss: '말을 재촉하지 않고 당신의 생각을 끝까지 들어주는 사람, 조용하지만 정서적으로 꾸준한 사람은 놓치지 않는 편이 좋습니다.',
      avoidPeople: '애매한 침묵으로 불안을 키우는 사람, 중요한 대화를 계속 피하는 사람, 감정 공백을 외부 자극으로 메우는 사람은 피해야 합니다.'
    }
  };

  return signatures[element];
}

function getRelationshipStageGuide(formData: Partial<IntakeFormData>, relationshipLabel: string) {
  if (formData.relationshipStatus === 'dating') {
    return `${relationshipLabel} 흐름에서는 새 인연을 찾는 것보다 현재 관계가 결혼 생활로 확장될 수 있는지 보는 것이 중요합니다. 감정 확인보다 돈, 시간, 가족, 일의 우선순위를 실제로 맞춰보는 단계입니다.`;
  }

  if (formData.relationshipStatus === 'married') {
    return `${relationshipLabel} 흐름에서는 새로운 설렘보다 부부 사이의 역할 재조정, 대화 방식, 생활 피로 관리가 핵심입니다. 관계를 평가하기보다 다시 운영하는 관점이 필요합니다.`;
  }

  if (formData.relationshipStatus === 'single') {
    return `${relationshipLabel} 흐름에서는 무작정 소개를 늘리기보다 “어떤 사람을 만나야 오래 가는가”를 먼저 좁혀야 합니다. 만남의 양보다 선별 기준이 결과를 바꿉니다.`;
  }

  return `${relationshipLabel} 상태이므로, 이번 리포트는 원국과 대운 기준으로 인연상, 만남 경로, 결혼 현실성을 중심으로 읽었습니다. 실제 관계 정보가 더해지면 상대별 해석 밀도는 더 높아집니다.`;
}

function buildLoveProfile(
  basis: DeterministicSajuBasis,
  formData: Partial<IntakeFormData>,
  relationshipLabel: string,
  helpful: FiveElement[],
  cautious: FiveElement[],
  currentDayun: FortuneWindow
) {
  const dayElement = basis.dayMaster.element as FiveElement;
  const partnerSignature = getElementLoveSignature(dayElement);
  const meetingSignature = getElementLoveSignature((helpful[0] || dayElement) as FiveElement);
  const cautionSignature = getElementLoveSignature((cautious[0] || dayElement) as FiveElement);
  const dominantTenGods = basis.dominantTenGods.slice(0, 3).join(', ');
  const stageGuide = getRelationshipStageGuide(formData, relationshipLabel);
  const statusPrefix =
    formData.relationshipStatus === 'dating'
      ? '현재 관계에서는'
      : formData.relationshipStatus === 'married'
        ? '현재 부부 흐름에서는'
        : formData.relationshipStatus === 'single'
          ? '새 인연을 볼 때는'
          : '이번 관계운에서는';
  const marriageWindow = basis.seun
    .slice(0, 5)
    .map((item) => item.year)
    .join('~');

  return {
    archetype: partnerSignature.archetype,
    image: partnerSignature.image,
    spouseFace: partnerSignature.spouseFace,
    jobField: partnerSignature.jobField,
    meetingRoute: meetingSignature.meetingRoute,
    fitPoint: partnerSignature.fitPoint,
    tensionPoint: cautionSignature.tensionPoint,
    marriagePoint: partnerSignature.marriagePoint,
    drawnTo: partnerSignature.drawnTo,
    longTermType: partnerSignature.longTermType,
    failingPattern: `${statusPrefix} ${partnerSignature.failingPattern}`,
    perceivedStyle: partnerSignature.perceivedStyle,
    contactStyle: partnerSignature.contactStyle,
    hiddenNeed: partnerSignature.hiddenNeed,
    breakupTrigger: cautionSignature.breakupTrigger,
    loveStamina: partnerSignature.loveStamina,
    marriedLife: partnerSignature.marriedLife,
    dontMiss: partnerSignature.dontMiss,
    avoidPeople: cautionSignature.avoidPeople,
    stageGuide,
    dominantTenGods,
    marriageWindow,
    currentDayunName: currentDayun.name,
    checklist: [
      '첫 대화에서 말의 화려함보다 약속을 지키는 방식이 일정한지 보세요.',
      '돈을 쓰는 방식, 쉬는 방식, 가족과 거리를 두는 방식이 나와 맞는지 확인해야 합니다.',
      '갈등이 생겼을 때 바로 회피하는지, 조율하려는 태도가 있는지가 결혼 가능성을 가릅니다.',
      '상대가 내 속도를 존중하면서도 현실 문제를 같이 정리할 수 있는지 보세요.'
    ],
    avoidList: [
      '초반부터 감정을 크게 흔들지만 생활 기준은 흐릿한 사람',
      '돈, 시간, 약속을 말로만 정리하고 실제 행동이 반복되지 않는 사람',
      '가족, 전 연인, 일 문제의 경계가 분명하지 않은 사람',
      '내 불안을 자극해서 더 많이 맞추게 만드는 관계 구조'
    ]
  };
}

function buildSections(
  serviceLabel: string,
  basis: DeterministicSajuBasis,
  formData: Partial<IntakeFormData>,
  fiveElements: SajuReportData['fiveElements'],
  tenGods: SajuReportData['tenGods'],
  currentDayun: FortuneWindow,
  nextDayun: FortuneWindow,
  yearLuck: YearLuckItem[],
  monthLuck: MonthLuckItem[]
): ReportSection[] {
  const helpful = basis.helpfulElements;
  const cautious = basis.cautiousElements;
  const cautionGuidance = formatElementGuidance(cautious as FiveElement[], basis);
  const relationshipLabel = getRelationshipLabel(formData);
  const loveProfile = buildLoveProfile(
    basis,
    formData,
    relationshipLabel,
    helpful as FiveElement[],
    cautious as FiveElement[],
    currentDayun
  );
  const relationDetails = buildRelationDetails(basis);
  const twelveStates = [
    { pillar: '년주', state: basis.yunseong.year },
    { pillar: '월주', state: basis.yunseong.month },
    { pillar: '일주', state: basis.yunseong.day },
    { pillar: '시주', state: basis.yunseong.hour || '미상' }
  ];

  return [
    {
      id: 'saju',
      title: '사주 원국과 기본 분석',
      subtitle: '입력된 생년월일시를 기준으로 현재 구조를 읽는 기본 축',
      paragraphs: [
        `${serviceLabel}의 출발점은 ${basis.pillars.day} 일주와 ${basis.pillars.month} 월령입니다. 일주는 내가 세상을 받아들이고 결정하는 중심축이고, 월령은 사회 환경과 현실 압력을 보여주는 자리라 두 축을 함께 읽어야 실제 상담에 가까워집니다.`,
        `출생 정보는 ${formData.birthDate || '미입력'} / ${getTimeLabel(formData)} / ${getCalendarLabel(formData)} 기준으로 반영했습니다. 시주가 명확할수록 생활 리듬, 감정 회복 방식, 관계 운영 습관까지 더 촘촘하게 해석할 수 있습니다.`,
        `이번 리포트는 원국을 먼저 고정한 뒤 오행, 십성, 12운성, 형충합, 대운과 세운을 단계적으로 겹쳐 읽었습니다. 그래서 단순 운세 문장보다 “왜 그렇게 읽는지”가 보이도록 구성했습니다.`
      ],
      table: buildPillarTable(basis),
      cards: [
        {
          title: '지금 가장 도움 되는 기운',
          body: `${helpful.join(', ')} 흐름은 생활 루틴, 일의 방식, 사람을 만나는 기준에 먼저 반영될 때 안정감이 커집니다. 막연한 행운보다 반복 가능한 습관으로 써야 체감이 빠릅니다.`,
          tone: 'good',
          badge: 'HELPFUL'
        },
        {
          title: '특히 조심할 기운',
          body: `${cautionGuidance} 급한 결론보다 기준표를 만들고 한 번 더 비교하는 방식이 안전합니다.`,
          tone: 'warn',
          badge: 'CAUTION'
        }
      ]
    },
    {
      id: 'logic',
      title: '해석 근거 블록',
      subtitle: '왜 이런 판단이 나왔는지 계산 축과 현실 해석을 함께 연결하는 구간',
      callout: {
        title: '이번 리포트의 해석 축',
        body: `${basis.pillars.month} 월령, ${basis.dayMaster.stem} 일간, ${currentDayun.name} 대운 흐름을 중심으로 읽는 것이 이번 결과에서 가장 중요합니다. 원국은 타고난 구조이고, 대운은 그 구조가 현실에서 어떤 과제로 켜지는지를 보여주는 시간표입니다.`
      },
      cards: [
        {
          title: '월령 기준',
          body: `${basis.pillars.month} 월주의 기운은 사회 환경, 성장 배경, 일의 기준을 설명하는 핵심 축입니다. 여기서 강하게 잡힌 기운은 직업 선택과 인간관계의 기본 태도에 오래 남습니다.`
        },
        {
          title: '일간 기준',
          body: `${basis.dayMaster.stem} 일간은 기준을 어디에 두는지, 어떤 방식으로 결정을 내리는지를 보여줍니다. 그래서 성향 해석은 띠보다 일간을 중심으로 읽는 편이 훨씬 정확합니다.`
        },
        {
          title: '대운 기준',
          body: `${currentDayun.name} 대운은 지금 10년의 주제를 설명합니다. 같은 원국이라도 대운에 따라 관계, 돈, 일에서 먼저 켜지는 버튼이 달라지므로 현재 대운을 반드시 함께 봐야 합니다.`,
          tone: 'good'
        }
      ]
    },
    {
      id: 'element',
      title: '오행 분포와 균형',
      subtitle: '가장 강한 기운과 보완해야 할 기운을 읽는 영역',
      paragraphs: [
        `${helpful[0]} 기운은 현재 삶의 추진력과 회복 탄력을 키우는 축으로 작동합니다. 루틴, 공간, 관계 정리를 이 방향과 맞추면 “내가 컨트롤하고 있다”는 감각이 살아납니다.`,
        `${cautionGuidance} 이때는 운을 더 쓰려 하기보다 에너지가 새는 구멍을 막는 쪽이 먼저입니다.`
      ],
      details: [
        {
          summary: '오행 강약 보기',
          content: fiveElements.map((item) => `${item.label}: ${item.value}점`).join('\n\n'),
          open: true
        },
        {
          summary: '이번 리포트에서 주목해야 할 균형 포인트',
          content: `${helpful.join(', ')} 흐름은 몸과 환경이 받아줄 때 살아납니다. ${cautionGuidance} 같은 일정이라도 공간, 시간, 사람의 배치를 바꾸면 체감 운이 크게 달라집니다.\n\n실제로는 거창한 개운법보다 수면 시간 고정, 지출 기록, 관계의 선 긋기, 업무 범위 명확화 같은 작은 기준이 더 강하게 작동합니다.`
        }
      ]
    },
    {
      id: 'trait',
      title: '총괄 성향 분석',
      subtitle: '겉으로 보이는 성향, 실제 내면, 강점과 보완점을 정리하는 영역',
      cards: [
        {
          title: '겉으로 보이는 성향',
          body: `${basis.dayMaster.stem} 일간은 기준이 서 있을수록 안정적으로 보입니다. 겉에서는 차분하고 정리된 사람처럼 보이지만, 실제로는 내 기준과 다른 흐름이 들어올 때 빠르게 피로를 느낄 수 있습니다.`,
          tone: 'good'
        },
        {
          title: '실제 내면',
          body: `내면에서는 ${basis.helpfulElements.join(', ')} 기운을 통해 방향을 잡고 싶어 합니다. 다만 ${cautionGuidance}`
        },
        {
          title: '강점',
          body: '기준을 세우고 구조를 설계한 뒤 실행으로 옮기는 능력이 강점입니다. 한 번 감을 잡으면 같은 결과를 반복해서 재현하는 능력이 좋아, 콘텐츠·상담·브랜드·교육형 상품과 잘 맞습니다.',
          tone: 'good'
        },
        {
          title: '보완점',
          body: '피로가 누적될수록 관계와 일의 경계를 급하게 나누려 하거나, 반대로 전부 떠안는 식으로 흔들릴 수 있습니다. “내가 해야 할 일”과 “상대가 책임질 일”을 미리 나눠야 합니다.',
          tone: 'warn'
        }
      ]
    },
    {
      id: 'business',
      title: '사업운 특화 분석',
      subtitle: '가장 잘 맞는 사업 구조와 피해야 할 구조를 현실적으로 정리하는 영역',
      paragraphs: [
        '이 사주는 아이디어를 넓게 벌리는 방식보다, 정보를 정리해 신뢰 자산으로 바꾸는 방식에 더 강하게 반응합니다. 즉흥적인 유행을 좇는 것보다 “고객이 왜 돈을 내야 하는지”를 차분히 설계할 때 강점이 살아납니다.',
        '한 번 설계한 구조를 반복 가능한 서비스나 리포트형 상품으로 만드는 흐름이 잘 맞습니다. 특히 설명, 진단, 분석, 상담, 교육처럼 무형의 가치를 화면과 고객 경험으로 포장하는 일에 강합니다.',
        `${currentDayun.name} 대운에서는 사업의 크기보다 질서가 중요합니다. 가격표, 제공 범위, 결과물 예시, 상담 흐름, 후기 수집 구조가 잡혀야 매출이 단단하게 남습니다.`
      ],
      cards: [
        {
          title: '잘 맞는 구조',
          body: '1인 브랜드, 기획형 서비스, 상담형 상품, 디지털 리포트, 고객이 다시 확인할 수 있는 경험 구조가 특히 잘 맞습니다. “나를 파는 것”보다 “검증 가능한 결과 경험”을 파는 구조가 유리합니다.',
          tone: 'good'
        },
        {
          title: '피해야 할 구조',
          body: '역할이 불명확한 동업, 감정이 앞서는 금전 관계, 기준 없는 확장은 후폭풍이 커지기 쉽습니다. 시작 전에 수익 배분, 작업 범위, 의사결정권을 명확히 해야 합니다.',
          tone: 'warn'
        },
        {
          title: '고가 상품과의 궁합',
          body: '프리미엄 상품은 “누구에게 무엇을 어떤 구조로 전달하는지”가 분명해야 팔립니다. 이 사주는 바로 그 구조를 설계하는 힘이 강점으로 작동합니다. 상품명, 목차, 전후 비교, 결과 예시를 선명하게 만들수록 설득력이 올라갑니다.'
        }
      ]
    },
    {
      id: 'money',
      title: '재물운과 소비 패턴',
      subtitle: '돈이 붙는 방식과 새는 방식을 함께 보는 영역',
      paragraphs: [
        `재물운은 ${helpful.join(', ')} 기운을 살릴 때 안정됩니다. 이 말은 운 좋게 돈이 들어온다는 뜻보다, 들어온 돈을 남기는 계산 구조가 분명해진다는 뜻에 가깝습니다.`,
        `${cautionGuidance} 필요 이상으로 빨리 결정하거나, 관계 때문에 거절하지 못해 비용을 떠안는 패턴을 조심해야 합니다.`
      ],
      cards: [
        {
          title: '돈이 붙는 방식',
          body: `${helpful.join(', ')} 기운을 살릴수록 기록, 비교, 반복 구조를 통해 재물 흐름이 안정됩니다. 정산표, 가격표, 패키지 단위가 명확할수록 운이 현실 매출로 바뀝니다.`,
          tone: 'good'
        },
        {
          title: '돈이 새는 방식',
          body: `${cautionGuidance} 특히 가까운 관계에서 생기는 비용은 “나중에 정리하자”가 가장 위험합니다.`,
          tone: 'warn'
        },
        {
          title: '실제 조언',
          body: '수익 자체보다 수익이 남는 구조를 먼저 점검해야 합니다. 반복 매출 구조, 고객 유지 전략, 환불/취소 기준, 운영 시간을 함께 잡아야 재물운이 오래갑니다.'
        }
      ]
    },
    {
      id: 'career',
      title: '직업운과 커리어 흐름',
      subtitle: '일의 방향성과 성과가 붙는 방식을 읽는 영역',
      paragraphs: [
        '지금은 무작정 넓히기보다 내가 가장 잘하는 강점을 더 선명하게 보여주는 포지셔닝이 중요합니다. “무엇이든 할 수 있다”보다 “이 문제는 내가 가장 잘 해결한다”가 훨씬 강합니다.',
        `${helpful.join(', ')} 기운이 살아나는 환경에서는 기획, 정리, 조정, 실행 연결 능력이 더 자연스럽게 드러납니다. 반대로 기준 없는 요청이 많아지면 실력보다 피로가 먼저 쌓입니다.`,
        `커리어 흐름은 ${basis.dominantTenGods.slice(0, 3).join(', ')} 성향과도 연결됩니다. 앞에 드러난 십성은 사회적으로 어떤 역할을 맡을 때 평가가 붙는지 보여주는 단서입니다.`
      ],
      cards: [
        {
          title: '잘 맞는 일 방식',
          body: '기준을 세우고 구조를 설계한 뒤 실행으로 이어가는 방식이 가장 잘 맞습니다. 회의보다 문서, 감보다 기준, 단발성보다 반복 가능한 운영 방식이 성과를 키웁니다.',
          tone: 'good'
        },
        {
          title: '직장형 / 사업형',
          body: '조직 안에서도 성과를 낼 수 있지만, 장기적으로는 전문성을 상품화하고 자산화하는 쪽이 더 잘 맞을 가능성이 큽니다. 단, 사업형으로 갈수록 감정이 아니라 규칙으로 운영해야 합니다.'
        },
        {
          title: '조심할 점',
          body: '피로한 상태에서의 이직 결정이나, 기준 없는 확장은 커리어 흐름을 흔들 수 있습니다.',
          tone: 'warn'
        }
      ]
    },
    {
      id: 'love',
      title: '초정밀 연애운과 결혼 인연 리포트',
      subtitle: '내가 끌리는 사람, 오래 가는 사람, 망하는 패턴, 배우자상과 만남 루트를 현실적으로 읽는 구간',
      callout: {
        title: `${loveProfile.archetype} · ${basis.dayMaster.stem} 일간의 관계 시그니처`,
        body: `연애운은 “좋은 사람을 만난다”로 끝내면 체감이 약합니다. 이번 파트는 ${basis.pillars.day} 일주, ${basis.pillars.month} 월령, ${loveProfile.currentDayunName} 대운, ${loveProfile.dominantTenGods} 성향을 함께 보며 내가 왜 특정 타입에게 끌리고, 어떤 사람과 오래 가는지까지 현실 언어로 풀어냅니다.`
      },
      paragraphs: [
        `${getRelationshipContextSentence(relationshipLabel)} 이 맥락은 단순한 상태 표시가 아니라 감정 속도, 연락 리듬, 결혼 현실성, 상대를 검증하는 방식에 직접 반영됩니다.`,
        loveProfile.stageGuide,
        `이 사주의 연애는 감정의 크기보다 “생활에서 신뢰가 반복되는가”가 중요합니다. 좋아하는 마음이 있어도 연락, 돈, 시간, 가족과의 거리, 갈등 후 회복 방식이 맞지 않으면 오래 끌고 가기 어렵습니다.`,
        `앞으로 ${loveProfile.marriageWindow}년 흐름에서는 설렘만 보는 연애보다, 함께 일상을 운영할 수 있는 사람을 고르는 눈이 훨씬 중요해집니다.`
      ],
      cards: [
        {
          title: '내가 끌리는 사람',
          body: loveProfile.drawnTo,
          tone: 'good',
          badge: 'ATTRACTION'
        },
        {
          title: '실제로 오래 가는 사람',
          body: loveProfile.longTermType,
          tone: 'good',
          badge: 'LONG-TERM'
        },
        {
          title: '상대가 느끼는 나',
          body: loveProfile.perceivedStyle,
          badge: 'MIRROR'
        },
        {
          title: '연애가 흔들리는 패턴',
          body: loveProfile.failingPattern,
          tone: 'warn',
          badge: 'PATTERN'
        },
        {
          title: '만나게 될 사람의 얼굴 분위기',
          body: loveProfile.spouseFace,
          badge: 'FACE MOOD'
        },
        {
          title: '인연이 닿기 쉬운 직업군',
          body: loveProfile.jobField,
          badge: 'CAREER'
        },
        {
          title: '만남이 열리는 루트',
          body: loveProfile.meetingRoute,
          badge: 'ROUTE'
        },
        {
          title: '연락 스타일',
          body: loveProfile.contactStyle,
          badge: 'CONTACT'
        },
        {
          title: '숨겨진 연애 욕구',
          body: loveProfile.hiddenNeed,
          badge: 'NEED'
        },
        {
          title: '결혼 후 모습',
          body: loveProfile.marriedLife,
          tone: 'good',
          badge: 'MARRIAGE'
        },
        {
          title: '놓치면 안 되는 사람',
          body: loveProfile.dontMiss,
          tone: 'good',
          badge: 'KEEP'
        },
        {
          title: '피해야 할 사람',
          body: loveProfile.avoidPeople,
          tone: 'warn'
        }
      ],
      details: [
        {
          summary: '내가 왜 이런 사람에게 끌리는지',
          content: `${loveProfile.drawnTo}\n\n여기서 중요한 건 끌림이 곧 안정이라는 뜻은 아니라는 점입니다. ${basis.dayMaster.stem} 일간의 관계 방식은 처음의 설렘보다 “내 기준이 존중받는가”에서 마음이 깊어집니다. 그래서 초반에 강하게 끌려도 상대의 생활 리듬과 책임 방식이 맞지 않으면 시간이 지날수록 피로가 커질 수 있습니다.`,
          open: true
        },
        {
          summary: '오래 가는 사람과 빨리 식는 사람의 차이',
          content: `${loveProfile.longTermType}\n\n반대로 ${loveProfile.avoidPeople} 초반에는 묘하게 신경 쓰이고 끌릴 수 있지만, 시간이 지날수록 관계의 에너지를 많이 쓰게 만듭니다. 이 사주에서는 “나를 얼마나 설레게 하는가”보다 “나를 불안하게 만들지 않는가”가 장기 궁합의 핵심입니다.`
        },
        {
          summary: '상대가 보는 나의 연애 스타일',
          content: `${loveProfile.perceivedStyle}\n\n그래서 이 사주는 마음이 있어도 표현이 늦거나, 상대를 더 지켜본 뒤 확신하려는 흐름이 생길 수 있습니다. 이 자체가 나쁜 것은 아니지만, 상대 입장에서는 “좋아하는 건지 아닌지 모르겠다”는 신호로 읽힐 수 있으니 중요한 순간에는 짧게라도 마음을 말해주는 편이 좋습니다.`
        },
        {
          summary: '미래 인연의 인상과 직업 환경',
          content: `${loveProfile.spouseFace}\n\n${loveProfile.jobField}\n\n직업이나 얼굴을 한 가지로 단정하면 리포트가 가벼워집니다. 대신 이 사주에서는 상대가 풍기는 분위기, 돈과 시간에 대한 태도, 사회적 책임감이 더 중요한 신호입니다. 인연상은 스펙 나열보다 생활 태도에서 더 선명하게 드러납니다.`
        },
        {
          summary: '만남 루트와 소개팅 전략',
          content: `${loveProfile.meetingRoute}\n\n완전히 우연한 만남보다 목적이 있는 자리, 반복적으로 마주치는 공간, 지인이나 일의 신뢰가 깔린 연결에서 관계가 열릴 가능성이 큽니다. 소개를 받는다면 “조건이 좋은 사람”보다 내 생활 리듬 안으로 자연스럽게 들어오는 사람을 우선 보세요. 첫 만남에서는 직업보다 시간 약속, 대화의 균형, 돈 쓰는 태도를 보는 편이 더 정확합니다.`
        },
        {
          summary: '결혼 현실성과 결혼 후 모습',
          content: `${loveProfile.marriagePoint}\n\n${loveProfile.marriedLife}\n\n결혼으로 이어지려면 세 가지를 확인해야 합니다. 첫째, 돈을 쓰고 모으는 기준이 크게 충돌하지 않는가. 둘째, 가족과 일의 경계를 서로 존중할 수 있는가. 셋째, 갈등이 생겼을 때 침묵이나 회피가 아니라 조율로 돌아올 수 있는가입니다.`
        },
        {
          summary: '헤어지는 결정적 이유와 연애 체력',
          content: `${loveProfile.breakupTrigger}\n\n${loveProfile.loveStamina}\n\n이별운을 자극적으로 볼 필요는 없습니다. 이 사주에서는 작은 실망이 반복될 때 마음속에서 이미 관계를 정리해버리는 흐름이 더 중요합니다. 그러니 서운함을 끝까지 참는 것보다, 작을 때 정확히 말하는 습관이 관계를 지키는 힘이 됩니다.`
        },
        {
          summary: '30일 연애 행동 미션',
          content: `${loveProfile.checklist.join('\n\n')}\n\n지금 당장 해야 할 일은 더 많은 사람을 무작정 만나는 것이 아니라, 내 기준표를 만드는 것입니다. “나는 어떤 사람에게 편안한가, 어떤 사람에게 불안해지는가, 어떤 생활 기준은 절대 양보하기 어려운가”를 적어두면 만남의 질이 달라집니다. 특히 ${helpful.join(', ')} 흐름과 맞는 장소와 루틴 안에서 만남을 만들 때 관계의 안정감이 높아집니다.`
        }
      ]
    },
    {
      id: 'health',
      title: '건강운과 생활 리듬',
      subtitle: '피로와 컨디션, 감정 체력의 흐름',
      paragraphs: [
        '건강운은 특정 질환을 예언하는 방식이 아니라, 생활 리듬과 감정 체력이 어디서 흔들리는지를 보는 방식으로 읽습니다.',
        `이 명식에서는 ${cautionGuidance} 쉬는 시간을 “남는 시간”이 아니라 “운을 지키는 시간”으로 잡아야 합니다.`
      ],
      cards: [
        {
          title: '체력 관리 포인트',
          body: `${cautionGuidance} 밤에는 판단이 급해지기 쉬우니 결제, 계약, 관계 정리 같은 선택은 다음 날 다시 확인하는 편이 좋습니다.`,
          tone: 'warn'
        },
        {
          title: '컨디션이 좋아지는 방식',
          body: `${helpful.join(', ')} 기운과 맞는 수면, 식사, 정리 루틴이 잡힐수록 전체 운세 체감도 함께 좋아집니다. 몸의 리듬이 잡히면 관계와 돈 판단도 같이 안정됩니다.`,
          tone: 'good'
        },
        {
          title: '생활 조언',
          body: '지치기 전에 쉬는 구조를 만드는 편이 장기적으로 더 정확합니다. 일정 비움도 실력의 일부로 봐야 합니다.'
        }
      ]
    },
    {
      id: 'fortune',
      title: '대운 분석',
      subtitle: '현재 10년의 흐름과 다음 10년을 연결해서 읽는 영역',
      paragraphs: [
        `${currentDayun.name} 대운은 현재 10년의 주제이고, ${nextDayun.name} 대운은 그 다음 10년의 방향을 설명합니다.`,
        '같은 사주라도 대운이 바뀌면 체감되는 기회, 부담, 선택의 우선순위가 달라집니다. 지금의 선택은 단기 결과만이 아니라 다음 대운에 가져갈 자산과 습관까지 함께 만듭니다.',
        currentDayun.summary,
        `현재 대운의 핵심은 ${currentDayun.focus} ${currentDayun.caution}`
      ],
      cards: [
        {
          title: `${currentDayun.name} 대운 · ${currentDayun.range}`,
          body: currentDayun.focus,
          tone: 'good'
        },
        {
          title: `${nextDayun.name} 대운 · ${nextDayun.range}`,
          body: nextDayun.focus
        },
        {
          title: '대운 전환 준비',
          body: '대운 전환기는 갑자기 운이 바뀌는 날이라기보다, 이전 10년의 습관이 다음 10년에 어떤 결과로 남는지 확인되는 시기입니다. 지금은 기준, 상품, 관계, 건강 루틴을 정리해 두는 것이 가장 큰 준비입니다.',
          tone: 'warn'
        }
      ]
    },
    {
      id: 'year',
      title: '연운 분석',
      subtitle: '다가오는 5년의 기회와 주의 포인트를 요약하는 영역',
      details: yearLuck.map((item, index) => ({
        summary: `${item.year}년 · ${item.headline}`,
        content: `${item.summary}\n\n집중 포인트: ${item.focus}\n\n주의 포인트: ${item.warning}`,
        open: index === 0
      }))
    },
    {
      id: 'ten',
      title: '십성 심층 분석',
      subtitle: '대인관계, 사회성, 역할 감각을 읽는 영역',
      details: tenGods.slice(0, 6).map((item, index) => ({
        summary: `${item.label} ${item.value}점`,
        content:
          index === 0
            ? `${item.label} 기운이 가장 앞에 와 있다는 뜻은 사회적인 얼굴과 성과 방식이 이 축을 통해 드러난다는 의미입니다. 이 기운은 사람들에게 “저 사람은 이런 역할을 해준다”는 인상을 남기는 핵심 단서입니다.`
            : `${item.label} 기운은 상황에 따라 장점과 부담이 함께 드러날 수 있는 성향 축입니다. 중요한 건 이 기운을 어떤 역할과 구조에 배치하느냐입니다. 점수가 높다고 무조건 좋거나 낮다고 부족한 것이 아니라, 현재 대운과 실제 환경에서 쓰임이 맞을 때 강점이 됩니다.`,
        open: index < 2
      }))
    },
    {
      id: 'detail12',
      title: '12운성 해석',
      subtitle: '각 기둥의 생장 흐름을 현실 언어로 읽는 영역',
      details: twelveStates.map((item, index) => ({
        summary: `${item.pillar} · ${item.state}`,
        content: `${item.pillar}에서 ${item.state} 운성이 드러난다는 것은 그 자리의 기운이 ${index === 0 ? '배경과 성장 경험' : index === 1 ? '사회 환경과 현재 리듬' : index === 2 ? '내면 중심축' : '생활 습관과 세부 운영'}에 어떤 결로 작동하는지를 보여주는 단서입니다.\n\n12운성은 사건을 단정하는 도구가 아니라 기운의 컨디션을 보는 도구입니다. 같은 기운이라도 어느 자리에 놓였는지에 따라 밖으로 드러나는 방식과 피로가 쌓이는 지점이 달라집니다.`,
        open: index === 0
      }))
    },
    {
      id: 'detailRel',
      title: '형 · 충 · 합 해석',
      subtitle: '관계 충돌보다 리듬과 역할 배치를 읽는 쪽이 더 정확한 구간',
      details: relationDetails
    },
    {
      id: 'detailSal',
      title: '신살 종합',
      subtitle: '보조 근거로만 활용하는 현실형 신살 메모',
      details: Object.entries(basis.shensha).length
        ? [
            {
              summary: '신살은 결론이 아니라 보조 렌즈입니다',
              content:
                '신살은 원국과 대운의 판단을 보완하는 장치입니다. 신살 하나로 성패, 결혼, 사고를 단정하지 않고, 실제 리포트에서는 “어떤 성향이 어느 상황에서 강하게 드러나는가”를 설명하는 보조 근거로만 사용합니다.',
              open: true
            },
            ...Object.entries(basis.shensha).map(([name, content]) => ({
              summary: name,
              content: `${content}\n\n현실 적용: 이 기운은 크게 과시하기보다 사람을 만나는 방식, 소개와 평판, 중요한 제안이 들어오는 통로를 관리할 때 더 좋게 쓰입니다.`,
              open: false
            }))
          ]
        : [
            {
              summary: '이번 명식에서는 신살보다 원국과 대운 해석 비중이 더 큽니다',
              content: '신살은 참고 요소로만 보고, 실제 판단은 원국 구조와 대운의 흐름을 중심으로 가져가는 편이 더 정확합니다. 이 경우에는 특수한 별을 찾기보다 오행 균형, 십성 배치, 현재 대운의 역할을 실제 생활에 적용하는 쪽이 더 밀도 있는 해석입니다.',
              open: true
            }
          ]
    },
    {
      id: 'month',
      title: '월운 활용 전략',
      subtitle: '가까운 12개월의 흐름을 월별로 점검하는 영역',
      details: monthLuck.map((item, index) => ({
        summary: `${item.year}.${String(item.month).padStart(2, '0')} · ${item.score}점`,
        content: `${item.summary}\n\n집중 포인트: ${item.focus}\n\n주의 포인트: ${item.warning}`,
        open: index === 0
      }))
    }
  ];
}

function buildYearlySummary(customerName: string, serviceLabel: string, basis: DeterministicSajuBasis, currentDayun: FortuneWindow) {
  const cautionGuidance = formatElementGuidance(basis.cautiousElements as FiveElement[], basis);

  return {
    title: `${serviceLabel} 핵심 요약`,
    analysis: [
      `${customerName}님의 기본 흐름은 ${basis.helpfulElements.join(', ')} 흐름이 생활 리듬과 일의 방식 안에 자리 잡을 때 안정감이 커집니다. 생각만 많을 때보다 몸이 따라오는 규칙을 만들 때 운이 더 잘 열립니다.`,
      `${basis.dayMaster.stem} 일간은 기준이 분명할수록 장점이 살아납니다. ${cautionGuidance}`,
      `현재 대운은 ${currentDayun.name} 흐름으로 읽히며, 지금은 판을 넓히기보다 가격, 역할, 책임, 마감선을 눈에 보이게 만드는 편이 더 정확합니다.`,
      `이번 결과는 ${serviceLabel} 기준으로 원국, 대운, 관계 맥락, 질문 2개를 한 번에 정리한 프리미엄 상담형 버전입니다.`
    ],
    advice: [
      `${basis.helpfulElements[0]} 기운과 맞는 생활 루틴을 먼저 안정시키세요.`,
      '중요한 선택은 가격, 역할, 일정, 책임 범위를 남긴 뒤 반복 가능한 구조로 옮기는 방식이 더 잘 맞습니다.',
      '질문과 연결된 관계나 일의 흐름은 감정만 보지 말고 일정, 돈, 책임, 체력 조건까지 함께 보세요.'
    ]
  };
}

export function buildSajuReport(serviceId: ServiceId, formData: Partial<IntakeFormData>, providedBasis?: DeterministicSajuBasis): SajuReportData {
  const service = findServiceById(serviceId);
  const kind = getKind(serviceId);
  const meta = KIND_META[kind];
  const basis = providedBasis || buildDeterministicSajuBasis(serviceId, formData);
  const createdAt = new Date().toISOString();
  const serialNumber = createSerialNumber();
  const customerName = getReportCallName(formData.name);
  const questionPreview = [formData.q1, formData.q2].filter((item): item is string => Boolean(item?.trim())).join(' / ');
  const birthLabel = `${formData.birthDate || '미입력'} / ${getTimeLabel(formData)} / ${getCalendarLabel(formData)} / ${getGenderLabel(formData)}`;
  const relationshipLabel = getRelationshipLabel(formData);

  const fiveElements = basis.fiveElements.map((item) => ({
    label: item.label as FiveElement,
    value: item.value,
    color: ELEMENT_COLORS[item.label as FiveElement]
  }));

  const tenGods = basis.tenGods.map((item) => ({
    label: item.label,
    value: item.value
  }));

  const { currentDayun, nextDayun } = mapCurrentAndNextDayun(
    basis,
    formData,
    basis.helpfulElements as FiveElement[],
    basis.cautiousElements as FiveElement[]
  );
  const reportLoveProfile = buildLoveProfile(
    basis,
    formData,
    relationshipLabel,
    basis.helpfulElements as FiveElement[],
    basis.cautiousElements as FiveElement[],
    currentDayun
  );
  const yearLuck = buildYearLuck(basis, basis.helpfulElements as FiveElement[], basis.cautiousElements as FiveElement[]);
  const monthLuck = buildMonthLuck(
    formData,
    basis,
    basis.helpfulElements as FiveElement[],
    basis.cautiousElements as FiveElement[],
    serviceId === 'life-flow' ? 'calendar-year' : 'rolling'
  );
  const cautionGuidance = formatElementGuidance(basis.cautiousElements as FiveElement[], basis);
  const actionPlan = buildActionPlan(
    yearLuck,
    basis.helpfulElements as FiveElement[],
    basis.cautiousElements as FiveElement[]
  );
  const sections = buildSections(service.label, basis, formData, fiveElements, tenGods, currentDayun, nextDayun, yearLuck, monthLuck);
  const summary = buildYearlySummary(customerName, service.label, basis, currentDayun);
  const questionAnswers = buildQuestionAnswers(
    formData,
    basis,
    basis.helpfulElements as FiveElement[],
    basis.cautiousElements as FiveElement[]
  );

  return {
    serviceId,
    kind,
    title: meta.title,
    subtitle: meta.subtitle,
    badge: meta.badge,
    serialNumber,
    createdAt,
    birthLabel,
    questionPreview,
    customerName,
    zodiac: basis.zodiac,
    dayMaster: basis.dayMaster.stem,
    dayMasterElement: basis.dayMaster.element as FiveElement,
    strengthLabel: basis.strength.label,
    helpfulElements: basis.helpfulElements as FiveElement[],
    cautiousElements: basis.cautiousElements as FiveElement[],
    gyeokguk: basis.gyeokguk,
    heroNote:
      kind === 'comprehensive'
        ? `${customerName}님의 사주는 생활 리듬, 일의 방식, 관계 기준이 한 방향으로 맞을 때 장점이 가장 선명해집니다. 기준을 세우는 데서 끝나지 않고 반복 가능한 결과로 옮길 때 만족도가 커집니다.`
        : `${customerName}님의 현재 흐름은 필요한 기운을 생활과 선택 기준 안에 반영할수록 결과가 부드럽게 이어지는 구조로 읽힙니다.`,
    keyTakeaways: [
      {
        title: '일',
        body: '무작정 넓히기보다 기준, 결과물, 제공 범위를 먼저 세우는 쪽이 더 정확합니다.',
        tone: 'good'
      },
      {
        title: '돈',
        body: '재물운은 수익 그 자체보다 수익이 남는 가격표와 반복 매출 구조에서 더 안정적으로 살아납니다.'
      },
      {
        title: '인연',
        body: `${getRelationshipContextSentence(relationshipLabel)} ${reportLoveProfile.archetype} 인연과 잘 맞으며, ${reportLoveProfile.meetingRoute}`
      },
      {
        title: '건강',
        body: `${cautionGuidance} 과로와 리듬 붕괴를 조심해야 합니다.`,
        tone: 'warn'
      },
      {
        title: '시기',
        body: `${currentDayun.name} 대운에서는 기회 자체보다 기회를 어떤 순서와 기준으로 현실화하느냐가 핵심입니다.`
      }
    ],
    currentDayun,
    nextDayun,
    legalNotice: [
      '본 리포트는 전통 명리학 해석을 바탕으로 한 참고 자료입니다.',
      '재무, 의료, 법률, 투자, 혼인, 세무 관련 판단은 별도 전문가 자문과 함께 진행하는 편이 안전합니다.',
      '특정 결과를 보장하지 않으며, 건강 파트는 생활관리 중심으로 해석합니다.'
    ],
    pillars: basis.pillars,
    fiveElements,
    tenGods,
    metaGrid: buildMetaGrid(birthLabel, questionPreview, relationshipLabel, serialNumber, createdAt),
    summary,
    questionAnswers,
    sections,
    yearLuck,
    monthLuck,
    actionPlan
  };
}
