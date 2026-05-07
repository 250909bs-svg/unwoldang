import { findServiceById, type IntakeFormData, type ServiceId } from '../../api/mockData';
import { buildDeterministicSajuBasis, type DeterministicSajuBasis } from './deterministicBasis';
import { calcBazi } from './baziCalcs';
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
  }
};

const KIND_BY_SERVICE: Partial<Record<ServiceId, ReportKind>> = {
  'general-signature': 'comprehensive',
  'life-flow': 'yearly',
  'love-reading': 'love',
  'love-reunion': 'reunion',
  'marriage-blueprint': 'marriage',
  'marriage-timing': 'marriage',
  'match-couple': 'compatibility',
  'match-destiny': 'compatibility'
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

const PILLAR_LABELS = {
  year: '년주',
  month: '월주',
  day: '일주',
  hour: '시주'
} as const;

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
            `${withAndParticle(formatPiece(left))} ${formatPiece(right)} 사이에 ${relation.name} 관계가 보입니다. ${relation.tone}`
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
        `${matched.map(formatPiece).join(', ')}가 ${triad.name} 삼합을 이룹니다. ${triad.element} 기운이 한 방향으로 모이기 때문에 이 영역은 인생의 큰 동력으로 읽습니다.`
      );
    } else if (matched.length === 2) {
      details.push(
        `${matched.map(formatPiece).join(', ')}가 ${triad.name}의 반합 흐름을 만듭니다. 아직 완전히 굳어진 흐름은 아니지만, 조건이 맞을 때 ${triad.element} 기운이 빠르게 살아납니다.`
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
          : '네 기둥의 지지는 큰 충돌보다 월령과 일주의 중심축을 따라 움직이는 편입니다. 이 경우 사건성보다 생활 리듬, 관계 기준, 일의 우선순위를 정돈하는 쪽이 더 중요합니다.',
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

    return {
      name: row.ganzhi,
      range: row.age,
      summary: `${row.ganzhi} 대운은 ${row.tenGod} 흐름을 통해 ${emphasis}이 더 중요해지는 시기입니다. 이 구간은 우연한 사건보다 선택의 순서, 사람을 쓰는 방식, 돈이 남는 구조가 결과 차이를 크게 만듭니다.`,
      focus: `${basis.helpfulElements.join(', ')} 기운을 살리는 방식으로 ${isCurrent ? '현재 진행 중인 일의 기준과 가격, 관계의 역할 배치' : '다음 단계의 생활 기반과 수익 모델'}를 정교하게 다듬는 편이 정확합니다.`,
      caution: `${caution}가 이번 대운 해석의 핵심 주의점입니다. 특히 감정이 앞선 약속, 검증 없는 확장, 문서 없는 금전 관계는 한 번 더 멈춰서 확인해야 합니다.`
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
  return basis.seun.slice(0, 5).map((item) => {
    const [stem, branch] = [...item.ganzhi] as [string, string];
    const stemElement = ELEMENT[stem as keyof typeof ELEMENT] as FiveElement;
    const branchElement = BRANCH_ELEM[branch as keyof typeof BRANCH_ELEM] as FiveElement;
    const score = scoreByElements(stemElement, branchElement, helpful, cautious);

    return {
      year: item.year,
      ganzhi: item.ganzhi,
      score,
      headline:
        score >= 80
          ? '확장과 성과가 비교적 선명하게 드러나는 해'
          : score >= 68
            ? '기회를 잘 고르면 결과가 붙는 해'
            : score >= 56
              ? '정비와 기준 재설정이 중요한 해'
              : '속도보다 관리가 더 중요한 해',
      summary: `${item.year}년은 ${stemElement}·${branchElement} 흐름이 들어오면서 ${helpful.includes(stemElement) || helpful.includes(branchElement) ? '새로운 기회를 현실 성과로 연결하기 좋은 해' : '기존 구조를 점검하고 손실을 줄이는 감각이 중요한 해'}로 읽습니다.`,
      focus: `${helpful.join(', ')} 기운을 살리는 방향으로 문서화, 일정 관리, 관계 조정, 자원 배분을 정교하게 가져가세요. 특히 이 해에는 “무엇을 더 할까”보다 “무엇을 남길까”가 더 중요합니다.`,
      warning: `${cautious.join(', ')} 기운이 과해질 때는 성급한 선택이나 감정 섞인 판단이 결과를 흔들 수 있습니다. 큰 결정은 하루 안에 끝내지 말고 조건표를 만들어 비교하는 편이 안전합니다.`
    };
  });
}

function buildMonthLuck(
  formData: Partial<IntakeFormData>,
  helpful: FiveElement[],
  cautious: FiveElement[]
): MonthLuckItem[] {
  const now = new Date();
  const gender = formData.gender === 'male' ? 'male' : 'female';

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index, 15, 12, 0, 0);
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
      focus: `${helpful.join(', ')} 기운과 맞는 생활 루틴, 문서화, 우선순위 정리에 집중하는 편이 좋습니다. 고객, 연인, 가족과의 약속도 말로만 두지 말고 기준을 남기면 흔들림이 줄어듭니다.`,
      warning: `${cautious.join(', ')} 쪽으로 기운이 치우치면 체력 저하나 감정 과열이 함께 올 수 있어 일정 밀도를 조절해야 합니다. 무리해서 끌고 가는 달보다 덜어내서 선명해지는 달로 운영하세요.`
    };
  });
}

type QuestionCategory = 'relationship' | 'money' | 'career' | 'timing' | 'caution' | 'health' | 'general';

function getQuestionCategory(question: string): QuestionCategory {
  const normalized = question.replace(/\s/g, '');
  if (/연애|결혼|재회|상대|인연|배우자|궁합|썸|애정/.test(normalized)) return 'relationship';
  if (/돈|재물|수익|매출|사업|투자|가격|결제|고가|상품/.test(normalized)) return 'money';
  if (/일|직업|커리어|이직|창업|브랜드|콘텐츠|회사|진로/.test(normalized)) return 'career';
  if (/언제|시기|올해|내년|2026|2027|타이밍|기회/.test(normalized)) return 'timing';
  if (/조심|주의|위험|피해야|선택|고민|불안/.test(normalized)) return 'caution';
  if (/건강|잠|수면|체력|피로|몸|컨디션/.test(normalized)) return 'health';
  return 'general';
}

function buildQuestionResponse(
  question: string,
  category: QuestionCategory,
  basis: DeterministicSajuBasis,
  relationshipLabel: string,
  currentDayunName: string,
  helpful: FiveElement[],
  cautious: FiveElement[]
) {
  const dayMaster = basis.dayMaster.stem;
  const helpfulText = helpful.join(', ');
  const cautiousText = cautious.join(', ');
  const context = getRelationshipContextSentence(relationshipLabel);

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
        `${cautiousText} 기운이 강한 날에는 서운함을 바로 결론으로 바꾸지 마세요. 감정 표현은 짧게, 요구사항은 구체적으로 남기는 방식이 안전합니다.`
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
        `${cautiousText} 기운이 강할 때는 가까운 사람과의 돈 거래, 말로만 정한 동업, 즉흥 지출을 특히 조심하는 편이 좋습니다.`
      ]
    };
  }

  if (category === 'career') {
    return {
      label: '직업·커리어 질문 직답',
      analysis: `질문 "${question}"은 지금 가진 능력을 어떻게 보이는 성과로 바꿀지에 대한 질문으로 읽힙니다. ${dayMaster} 일간은 기준을 세우고 구조를 잡을 때 강점이 드러나며, ${currentDayunName} 대운에서는 전문성을 문서, 포트폴리오, 상품으로 전환하는 흐름이 중요합니다.`,
      advice: [
        '가장 먼저 “내가 잘하는 일”이 아니라 “고객이 돈을 내고 맡기고 싶은 결과”로 문장을 바꿔 보세요.',
        `${helpfulText} 기운을 살리려면 하루 단위 실행보다 주간 단위 산출물을 정하는 방식이 더 잘 맞습니다.`,
        `커리어 전환은 ${cautiousText} 기운이 강한 날 충동적으로 결정하지 말고, 수입 공백과 역할 변화를 숫자로 확인한 뒤 움직이는 편이 좋습니다.`
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
        `${cautiousText} 기운이 강한 달에는 계약, 큰 지출, 관계 단절처럼 되돌리기 어려운 선택을 늦추는 편이 안전합니다.`
      ]
    };
  }

  if (category === 'caution') {
    return {
      label: '주의점 질문 직답',
      analysis: `질문 "${question}"은 현재 흐름에서 무엇을 피해야 하는지에 초점이 있습니다. ${dayMaster} 일간은 기준이 서면 흔들림이 적지만, ${cautiousText} 기운이 과해질 때 판단을 빨리 끝내려는 압력이 생길 수 있습니다.`,
      advice: [
        '지금 가장 조심할 것은 사람 자체보다 기준 없는 약속입니다. 역할, 돈, 일정이 흐릿한 관계는 반드시 문서나 메시지로 남기세요.',
        `${helpfulText} 기운을 살리면 감정이 정리되고, 선택지가 선명하게 좁혀집니다. 기록을 남기는 순간 운의 흐름도 관리 가능해집니다.`,
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
        `${cautiousText} 기운이 강한 날에는 무리한 약속, 늦은 밤 결정, 과도한 카페인처럼 리듬을 깨는 선택을 줄이는 편이 좋습니다.`
      ]
    };
  }

  return {
    label: '종합 질문 직답',
    analysis: `질문 "${question}"은 ${dayMaster} 일간의 판단 방식과 ${currentDayunName} 대운 흐름을 함께 봐야 더 정확합니다. ${context} 지금은 감정보다 기준, 기준보다 실행 순서를 어떻게 잡는지가 결과를 가릅니다.`,
    advice: [
      '먼저 질문을 “선택지 A와 B 중 무엇이 더 현실적인가”로 나누면 답이 훨씬 선명해집니다.',
      `${helpfulText} 기운을 살리는 환경을 만들면 판단이 안정되고, 반복되는 고민의 핵심이 드러납니다.`,
      `${cautiousText} 기운이 과한 날에는 말과 지출을 줄이고, 중요한 결정은 기록으로 남긴 뒤 다시 확인하세요.`
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
        cautious
      );

      return {
        question,
        title: `${index + 1}. ${response.label}`,
        analysis: response.analysis,
        advice: response.advice
      };
    });
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
    }
  > = {
    목: {
      archetype: '성장형 파트너',
      image: '말투가 부드럽고 배움, 성장, 자기계발의 결이 있는 사람입니다. 외적으로는 화려함보다 맑고 편안한 분위기, 자연스러운 미소, 깔끔한 생활감이 먼저 보일 가능성이 큽니다.',
      jobField: '교육, 기획, 콘텐츠, 상담, 브랜딩, 디자인, 출판, 커뮤니티 운영처럼 사람의 성장을 돕거나 생각을 구조화하는 분야와 인연이 잘 닿습니다.',
      meetingRoute: '강의, 스터디, 세미나, 책/콘텐츠 기반 모임, 지인 소개, 일과 배움이 겹치는 자리에서 인연이 열리기 쉽습니다.',
      fitPoint: '서로를 고치려 하기보다 성장시키는 대화가 잘 맞습니다. 작은 목표를 함께 세우고 응원하는 관계가 오래 갑니다.',
      tensionPoint: '상대가 느리거나 애매하게 말하면 혼자 결론을 내리기 쉬우니, 기대치를 말로 확인하는 과정이 필요합니다.',
      marriagePoint: '결혼은 함께 배우고 생활을 개선하는 프로젝트처럼 운영할 때 안정됩니다. 집, 돈, 커리어 계획을 같이 업데이트하는 사람이 잘 맞습니다.'
    },
    화: {
      archetype: '표현형 파트너',
      image: '표정과 리액션이 살아 있고, 분위기를 밝히는 힘이 있는 사람입니다. 스타일은 감각적이고, 사람 앞에서 자기 매력을 자연스럽게 보여주는 타입일 가능성이 큽니다.',
      jobField: '마케팅, 미디어, 예술, 공연, 뷰티, 서비스, 홍보, SNS, 강의처럼 표현력과 사람의 반응을 읽는 분야와 연결되기 쉽습니다.',
      meetingRoute: '모임, 행사, 공연, 소개팅, SNS, 취미 클래스, 친구가 함께 있는 열린 자리에서 인연의 불씨가 붙기 쉽습니다.',
      fitPoint: '감정을 숨기지 않고 따뜻하게 표현해주는 사람이 잘 맞습니다. 함께 웃는 시간이 많을수록 관계가 빨리 가까워집니다.',
      tensionPoint: '감정의 온도가 빠르게 올라가면 확인보다 확신이 앞설 수 있습니다. 서두른 약속, 과한 기대, 즉흥적인 결정을 조심해야 합니다.',
      marriagePoint: '결혼은 애정 표현과 현실 계획이 균형을 이룰 때 좋습니다. 사랑은 뜨겁게, 생활은 차분하게 나눌 수 있는 사람이 안정적입니다.'
    },
    토: {
      archetype: '안정형 파트너',
      image: '큰 말보다 꾸준한 행동으로 신뢰를 쌓는 사람입니다. 분위기는 차분하고 안정적이며, 처음에는 느려 보여도 시간이 갈수록 책임감이 드러나는 타입입니다.',
      jobField: '행정, 공공기관, 회계, 재무관리, 부동산, 건축, 식품, 운영관리, 조직 내 실무 책임자처럼 현실 기반이 단단한 분야와 인연이 닿기 쉽습니다.',
      meetingRoute: '지인 소개, 가족/동료 연결, 동네 생활권, 직장 근처, 반복적으로 마주치는 안정적인 공간에서 관계가 천천히 열릴 가능성이 큽니다.',
      fitPoint: '생활 기준, 돈 관리, 약속 이행이 맞으면 관계가 깊게 안정됩니다. 말보다 반복 행동을 보는 방식이 잘 맞습니다.',
      tensionPoint: '관계가 답답하게 느껴질 때 바로 밀어붙이면 상대가 닫힐 수 있습니다. 속도보다 신뢰 축적이 먼저입니다.',
      marriagePoint: '결혼은 감정보다 생활 기반이 먼저 맞아야 합니다. 주거, 저축, 가족과의 거리, 역할 분담을 구체적으로 맞추면 오래 갑니다.'
    },
    금: {
      archetype: '기준형 파트너',
      image: '단정하고 깔끔하며 자기 기준이 분명한 사람입니다. 말투는 담백하고, 감정 표현은 과하지 않지만 약속과 선을 지키는 모습에서 신뢰가 생기는 타입입니다.',
      jobField: '금융, 법무, 데이터, 기술, 엔지니어링, 전문 서비스, 품질관리, 컨설팅처럼 정확성, 기준, 전문성이 필요한 분야와 인연이 강합니다.',
      meetingRoute: '일, 프로젝트, 계약, 협업, 전문 모임, 소개를 통한 공식적인 만남에서 관계가 시작될 가능성이 큽니다.',
      fitPoint: '서로의 기준과 영역을 존중할 때 잘 맞습니다. 감정 과잉보다 약속, 책임, 실력으로 신뢰를 쌓는 관계가 안정적입니다.',
      tensionPoint: '표현이 적다고 마음이 없는 것으로 단정하면 오해가 커질 수 있습니다. 말투보다 행동의 일관성을 봐야 합니다.',
      marriagePoint: '결혼은 서로의 역할과 책임이 명확할수록 좋습니다. 돈, 시간, 가족 문제를 문서처럼 분명하게 정리하는 사람이 잘 맞습니다.'
    },
    수: {
      archetype: '지성형 파트너',
      image: '조용히 관찰하고 깊게 생각하는 사람입니다. 처음에는 거리를 두는 듯 보여도 대화가 깊어질수록 매력이 살아나는 타입이며, 지적이고 차분한 분위기가 강합니다.',
      jobField: 'IT, 연구, 데이터, 유통, 해외/무역, 물류, 상담, 글쓰기, 정보 서비스처럼 정보와 흐름을 다루는 분야와 인연이 닿기 쉽습니다.',
      meetingRoute: '온라인, 이동 중 연결, 스터디, 커뮤니티, 글/콘텐츠를 통한 접점, 늦은 시간의 대화처럼 말과 정보가 먼저 이어지는 장면에서 열리기 쉽습니다.',
      fitPoint: '깊은 대화, 사적인 고민 공유, 서로의 고독을 존중하는 방식이 잘 맞습니다. 가벼운 표현보다 진심 어린 대화가 관계를 움직입니다.',
      tensionPoint: '생각이 많아질수록 관계를 혼자 해석하기 쉽습니다. 불안할 때는 추측보다 짧고 명확한 확인이 필요합니다.',
      marriagePoint: '결혼은 정서적 안전감과 대화의 깊이가 핵심입니다. 각자의 시간을 존중하면서도 중요한 결정을 함께 공유하는 사람이 안정적입니다.'
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
  const marriageWindow = basis.seun
    .slice(0, 5)
    .map((item) => item.year)
    .join('~');

  return {
    archetype: partnerSignature.archetype,
    image: partnerSignature.image,
    jobField: partnerSignature.jobField,
    meetingRoute: meetingSignature.meetingRoute,
    fitPoint: partnerSignature.fitPoint,
    tensionPoint: cautionSignature.tensionPoint,
    marriagePoint: partnerSignature.marriagePoint,
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
          body: `${helpful.join(', ')} 기운을 살리는 선택이 현재 흐름을 가장 안정적으로 이끕니다. 이 기운은 생활 루틴, 일의 방식, 사람을 만나는 기준에 먼저 반영할수록 체감이 빠릅니다.`,
          tone: 'good',
          badge: 'HELPFUL'
        },
        {
          title: '특히 조심할 기운',
          body: `${cautious.join(', ')} 기운이 과해질 때는 감정 과열, 판단 미스, 무리한 속도전이 함께 붙기 쉽습니다. 급한 결론보다 기준표를 만들고 한 번 더 비교하는 방식이 안전합니다.`,
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
        `${cautious[0]} 기운이 과해질 때는 일정, 피로, 소비 흐름이 함께 흔들릴 수 있습니다. 이때는 운을 더 쓰려 하기보다 에너지가 새는 구멍을 막는 쪽이 먼저입니다.`
      ],
      details: [
        {
          summary: '오행 강약 보기',
          content: fiveElements.map((item) => `${item.label}: ${item.value}점`).join('\n\n'),
          open: true
        },
        {
          summary: '이번 리포트에서 주목해야 할 균형 포인트',
          content: `${helpful.join(', ')} 기운을 살리고 ${cautious.join(', ')} 기운이 과열되지 않도록 조절하는 것이 핵심입니다. 같은 일정이라도 공간, 시간, 사람의 배치를 바꾸면 체감 운이 크게 달라집니다.\n\n실제로는 거창한 개운법보다 수면 시간 고정, 지출 기록, 관계의 선 긋기, 업무 범위 명확화 같은 작은 기준이 더 강하게 작동합니다.`
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
          body: `내면에서는 ${basis.helpfulElements.join(', ')} 기운을 통해 방향을 잡고 싶어 하지만, ${basis.cautiousElements.join(', ')} 기운이 과해지면 “빨리 결론 내고 끝내고 싶다”는 조급함이 섞일 수 있습니다.`
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
        '한 번 설계한 구조를 반복 가능한 서비스나 리포트형 상품으로 만드는 흐름이 잘 맞습니다. 특히 설명, 진단, 분석, 상담, 교육처럼 무형의 가치를 문서와 경험으로 포장하는 일에 강합니다.',
        `${currentDayun.name} 대운에서는 사업의 크기보다 질서가 중요합니다. 가격표, 제공 범위, 결과물 예시, 상담 흐름, 후기 수집 구조가 잡혀야 매출이 단단하게 남습니다.`
      ],
      cards: [
        {
          title: '잘 맞는 구조',
          body: '1인 브랜드, 기획형 서비스, 상담형 상품, 디지털 리포트, 문서화된 고객 경험 구조가 특히 잘 맞습니다. “나를 파는 것”보다 “검증 가능한 결과 경험”을 파는 구조가 유리합니다.',
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
        `${cautious.join(', ')} 기운이 과해지는 시기에는 필요 이상으로 빨리 결정하거나, 관계 때문에 거절하지 못해 비용을 떠안는 패턴이 생길 수 있습니다.`
      ],
      cards: [
        {
          title: '돈이 붙는 방식',
          body: `${helpful.join(', ')} 기운을 살릴수록 기록, 비교, 반복 구조를 통해 재물 흐름이 안정됩니다. 정산표, 가격표, 패키지 단위가 명확할수록 운이 현실 매출로 바뀝니다.`,
          tone: 'good'
        },
        {
          title: '돈이 새는 방식',
          body: `${cautious.join(', ')} 기운이 강할 때는 감정성 지출, 일정 과밀, 즉흥적 판단이 재무 구조를 흔들 수 있습니다. 특히 가까운 관계에서 생기는 비용은 “나중에 정리하자”가 가장 위험합니다.`,
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
      title: '결정사급 연애와 결혼 인연 분석',
      subtitle: '만나게 될 사람의 분위기, 직업군, 만남 경로, 결혼 현실성을 함께 읽는 핵심 영역',
      callout: {
        title: `${loveProfile.archetype} 인연 프로파일`,
        body: `이 리포트는 외모나 직업을 단정하지 않고, 원국의 일간·오행·십성·현재 ${loveProfile.currentDayunName} 대운을 겹쳐 “어떤 분위기의 사람과 오래 맞는가”를 결정사 프로파일처럼 정리합니다.`
      },
      paragraphs: [
        `${getRelationshipContextSentence(relationshipLabel)} 이 정보는 연애/결혼 해석에서 감정의 속도, 현실 조율 방식, 관계의 책임 분배를 읽는 기본 맥락으로 반영됩니다.`,
        loveProfile.stageGuide,
        `관계운은 ${basis.dominantTenGods.slice(0, 3).join(', ')} 성향과 ${helpful.join(', ')} 보완 흐름을 함께 봐야 정확합니다. 좋아하는 마음이 있어도 생활 리듬, 돈의 감각, 약속을 지키는 방식이 맞아야 오래 갑니다.`,
        `앞으로 ${loveProfile.marriageWindow}년 흐름에서는 “누가 나를 설레게 하는가”보다 “누가 내 삶을 함께 운영할 수 있는가”가 더 중요한 질문입니다.`
      ],
      bullets: [
        `인연상: ${loveProfile.image}`,
        `직업/환경: ${loveProfile.jobField}`,
        `만남 경로: ${loveProfile.meetingRoute}`,
        `잘 맞는 지점: ${loveProfile.fitPoint}`
      ],
      table: {
        headers: ['항목', '결정사급 해석'],
        rows: [
          ['미래 인연상', loveProfile.image],
          ['가능성 높은 직업군', loveProfile.jobField],
          ['만남이 열리는 장소', loveProfile.meetingRoute],
          ['궁합이 맞는 이유', loveProfile.fitPoint],
          ['부딪히는 패턴', loveProfile.tensionPoint],
          ['결혼 현실성', loveProfile.marriagePoint]
        ]
      },
      cards: [
        {
          title: '만나게 될 사람의 분위기',
          body: loveProfile.image,
          tone: 'good',
          badge: 'PARTNER'
        },
        {
          title: '직업과 생활 환경',
          body: loveProfile.jobField,
          badge: 'CAREER'
        },
        {
          title: '어디서 만나기 쉬운가',
          body: loveProfile.meetingRoute,
          badge: 'ROUTE'
        },
        {
          title: '왜 잘 맞는가',
          body: loveProfile.fitPoint,
          tone: 'good'
        },
        {
          title: '결혼 전 확인할 조건',
          body: loveProfile.marriagePoint
        },
        {
          title: '피해야 할 관계 신호',
          body: loveProfile.tensionPoint,
          tone: 'warn'
        }
      ],
      details: [
        {
          summary: '미래 배우자 프로파일',
          content: `${loveProfile.archetype} 흐름이 강합니다. ${loveProfile.image}\n\n이 사람은 첫인상만으로 강하게 밀고 들어오기보다, 반복되는 태도와 생활의 결에서 신뢰가 드러나는 타입으로 보는 편이 정확합니다. 상대가 어떤 말을 하느냐보다 시간 약속, 돈의 쓰임, 갈등 후 회복 방식이 일정한지를 확인하세요.`,
          open: true
        },
        {
          summary: '직업군과 사회적 배경',
          content: `${loveProfile.jobField}\n\n직업을 하나로 단정하는 방식은 위험합니다. 대신 이 사주에서는 상대가 어떤 환경에서 안정감을 느끼고, 어떤 방식으로 책임을 지는지가 더 중요합니다. 전문성, 생활 기준, 약속 이행이 분명한 사람일수록 관계가 오래 갑니다.`
        },
        {
          summary: '만남 경로와 접점',
          content: `${loveProfile.meetingRoute}\n\n완전히 우연한 만남보다 목적이 있는 자리, 반복적으로 마주치는 공간, 지인이나 일의 신뢰가 깔린 연결에서 관계가 열릴 가능성이 큽니다. 소개를 받더라도 “조건이 좋은 사람”보다 내 생활 리듬 안으로 자연스럽게 들어오는 사람을 우선 보세요.`
        },
        {
          summary: '잘 맞는 점과 궁합 포인트',
          content: `${loveProfile.fitPoint}\n\n궁합은 감정이 뜨거운지보다 갈등 후 다시 맞춰지는 속도에서 드러납니다. 이 흐름에서는 연락 빈도보다 약속의 일관성, 표현의 크기보다 책임의 선명함, 설렘보다 생활의 안정감을 보는 편이 더 정확합니다.`
        },
        {
          summary: '결혼 전 반드시 확인할 조건',
          content: `${loveProfile.marriagePoint}\n\n결혼으로 이어지려면 세 가지를 확인해야 합니다. 첫째, 돈을 쓰고 모으는 기준이 크게 충돌하지 않는가. 둘째, 가족과 일의 경계를 서로 존중할 수 있는가. 셋째, 갈등이 생겼을 때 침묵이나 회피가 아니라 조율로 돌아올 수 있는가입니다.`
        },
        {
          summary: '피해야 할 상대 패턴',
          content: `${loveProfile.avoidList.join('\n\n')}\n\n이 네 가지가 반복되면 초반 설렘이 강해도 장기 관계에서는 피로가 커질 수 있습니다. 특히 ${cautious.join(', ')} 기운이 강해지는 시기에는 외로움이나 불안 때문에 맞지 않는 관계를 오래 붙잡지 않도록 주의해야 합니다.`
        },
        {
          summary: '30일 인연 행동 미션',
          content: `${loveProfile.checklist.join('\n\n')}\n\n지금 당장 해야 할 일은 더 많은 사람을 무작정 만나는 것이 아니라, 내 기준표를 만드는 것입니다. “나는 어떤 사람에게 편안한가, 어떤 사람에게 불안해지는가, 어떤 생활 기준은 절대 양보하기 어려운가”를 적어두면 만남의 질이 달라집니다.`
        }
      ]
    },
    {
      id: 'health',
      title: '건강운과 생활 리듬',
      subtitle: '피로와 컨디션, 감정 체력의 흐름',
      paragraphs: [
        '건강운은 특정 질환을 예언하는 방식이 아니라, 생활 리듬과 감정 체력이 어디서 흔들리는지를 보는 방식으로 읽습니다.',
        `이 명식에서는 ${cautious.join(', ')} 기운이 과해질 때 피로 누적, 집중력 저하, 감정 과열이 함께 오기 쉬우므로 쉬는 시간을 “남는 시간”이 아니라 “운을 지키는 시간”으로 잡아야 합니다.`
      ],
      cards: [
        {
          title: '체력 관리 포인트',
          body: `${cautious.join(', ')} 기운이 강해질 때는 피로와 과몰입이 함께 오기 쉬워 휴식 루틴이 더 중요합니다. 밤에 큰 결정을 내리는 습관은 줄이는 편이 좋습니다.`,
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
  return {
    title: `${serviceLabel} 핵심 요약`,
    analysis: [
      `${customerName}님의 기본 흐름은 ${basis.helpfulElements.join(', ')} 기운을 중심으로 기준을 세울 때 가장 안정적으로 살아납니다. 이 기운은 생각만으로 쓰기보다 생활 루틴, 일의 구조, 관계 기준에 내려앉을 때 체감이 커집니다.`,
      `${basis.dayMaster.stem} 일간 성향은 구조와 기준이 분명해질수록 장점이 선명해지고, ${basis.cautiousElements[0]} 기운이 과해질 때는 판단이 급해질 수 있습니다. 그래서 빠른 결론보다 검증 가능한 순서가 중요합니다.`,
      `현재 대운은 ${currentDayun.name} 흐름으로 읽히며, 지금은 넓히는 것보다 방향과 가격, 역할, 책임을 정교하게 설계하는 편이 더 정확합니다.`,
      `이번 결과는 ${serviceLabel} 기준으로 원국, 대운, 관계 맥락, 질문 2개를 한 번에 정리한 프리미엄 상담형 버전입니다.`
    ],
    advice: [
      `${basis.helpfulElements[0]} 기운과 맞는 생활 루틴을 먼저 안정시키세요.`,
      '큰 결정보다 기준을 문서화하고 반복 가능한 구조를 쌓는 방식이 더 잘 맞습니다.',
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
  const customerName = formData.name?.trim() || '고객';
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
  const monthLuck = buildMonthLuck(formData, basis.helpfulElements as FiveElement[], basis.cautiousElements as FiveElement[]);
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
        ? `${customerName}님의 사주는 ${basis.helpfulElements.join(', ')} 기운을 중심으로 기준을 세우고, 그 기준을 반복 가능한 결과로 연결할 때 장점이 가장 선명해집니다.`
        : `${customerName}님의 현재 흐름은 ${basis.helpfulElements.join(', ')} 기운을 살릴수록 결과가 부드럽게 이어지는 구조로 읽힙니다.`,
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
        body: `${basis.cautiousElements.join(', ')} 기운이 과해질 때는 과로와 리듬 붕괴를 조심해야 합니다.`,
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
