import { DZ, HIDDEN_STEMS, TG, type EarthlyBranch, type FiveElement, type HeavenlyStem } from '../../constants';
import type {
  Confidence,
  Evidence,
  EvidenceKind,
  HiddenQiRole,
  PillarPosition,
  RuleMetadata,
  SeasonName
} from './types';
import { INTERPRETATION_ENGINE_VERSION } from './types';

export const RULES = {
  monthCommand: {
    ruleId: 'MRE-V2-MONTH-COMMAND-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '자평명리의 월령 우선 관점을 구조화했다. 득령은 월지 주왕 오행과 일간 오행이 같은 경우로 한정한다.'
  },
  roots: {
    ruleId: 'MRE-V2-ROOT-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '통근을 지장간의 동일 천간·동일 오행, 정기·중기·여기, 자리 가중치로 설명 가능하게 정량화한 v2 휴리스틱이다.'
  },
  exposure: {
    ruleId: 'MRE-V2-EXPOSURE-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '지장간과 겉 천간의 정확한 일치를 투간으로 기록한다. 합화나 청탁 여부는 별도 판정 대상으로 남긴다.'
  },
  hiddenSeasonality: {
    ruleId: 'MRE-V2-HIDDEN-SEASON-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '지장간의 정기·중기·여기 비중과 월령 친화도를 결합한 설명용 상대 기여도다. 학파 공통 절대 수치가 아니다.'
  },
  elementPower: {
    ruleId: 'MRE-V2-ELEMENT-POWER-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '겉 천간과 계절 보정 지장간을 함께 보는 비교 지표다. 오행 개수의 단순 합이나 고전의 단일 정량법으로 간주하지 않는다.'
  },
  climate: {
    ruleId: 'MRE-V2-CLIMATE-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '한난조습을 온도·습윤 두 축으로 정규화한 제품 규칙이다. 실제 기상 관측값이나 건강 진단이 아니다.'
  },
  eokbu: {
    ruleId: 'MRE-V2-YONGSIN-EOKBU-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '일간의 지지·설기·극제 균형을 우선하는 억부 관점을 독립 계산한다. 다른 용신법을 대체하지 않는다.'
  },
  johu: {
    ruleId: 'MRE-V2-YONGSIN-JOHU-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '명식의 한난조습 완화를 우선하는 조후 관점이다. 일간별 세부 조후론과 원국 전체 성립 조건의 전문가 검토가 필요하다.'
  },
  tonggwan: {
    ruleId: 'MRE-V2-YONGSIN-TONGGWAN-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '서로 극하는 두 오행이 모두 유력할 때 생의 흐름을 잇는 오행을 후보로 보는 통관 관점이다.'
  },
  byeongyak: {
    ruleId: 'MRE-V2-YONGSIN-BYEONGYAK-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '명식의 과다·편중을 병으로, 그 구조적 완화 요소를 약 후보로 보는 규칙이다. 질병이나 의학적 판단을 뜻하지 않는다.'
  },
  special: {
    ruleId: 'MRE-V2-YONGSIN-SPECIAL-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '극단적 강약과 통근을 이용해 종격·전왕 가능성을 후보로만 표시한다. 격 성립 확정은 합화·파격·운의 순역 검토가 필요하다.'
  },
  consensus: {
    ruleId: 'MRE-V2-YONGSIN-CONSENSUS-001',
    version: INTERPRETATION_ENGINE_VERSION,
    sourceNote: '독립 용신법의 찬반 근거를 합산하되 충돌을 지우지 않는 합성 규칙이다. 최고 점수는 확정 용신이 아니라 우선 검토 후보를 뜻한다.'
  }
} satisfies Record<string, RuleMetadata>;

export const PILLAR_ORDER: PillarPosition[] = ['year', 'month', 'day', 'hour'];

export const PILLAR_PATH: Record<PillarPosition, string> = {
  year: 'bazi.y_gz',
  month: 'bazi.m_gz',
  day: 'bazi.d_gz',
  hour: 'bazi.h_gz'
};

export const POSITION_WEIGHT: Record<PillarPosition, number> = {
  year: 0.85,
  month: 1.4,
  day: 1.1,
  hour: 0.85
};

const HIDDEN_QI_WEIGHTS: Record<EarthlyBranch, Array<{ role: HiddenQiRole; weight: number }>> = {
  자: [{ role: 'main', weight: 1 }],
  축: [
    { role: 'residual', weight: 0.3 },
    { role: 'middle', weight: 0.2 },
    { role: 'main', weight: 0.5 }
  ],
  인: [
    { role: 'residual', weight: 0.15 },
    { role: 'middle', weight: 0.25 },
    { role: 'main', weight: 0.6 }
  ],
  묘: [{ role: 'main', weight: 1 }],
  진: [
    { role: 'residual', weight: 0.2 },
    { role: 'middle', weight: 0.15 },
    { role: 'main', weight: 0.65 }
  ],
  사: [
    { role: 'residual', weight: 0.15 },
    { role: 'middle', weight: 0.25 },
    { role: 'main', weight: 0.6 }
  ],
  오: [
    { role: 'middle', weight: 0.3 },
    { role: 'main', weight: 0.7 }
  ],
  미: [
    { role: 'residual', weight: 0.25 },
    { role: 'middle', weight: 0.15 },
    { role: 'main', weight: 0.6 }
  ],
  신: [
    { role: 'residual', weight: 0.15 },
    { role: 'middle', weight: 0.25 },
    { role: 'main', weight: 0.6 }
  ],
  유: [{ role: 'main', weight: 1 }],
  술: [
    { role: 'residual', weight: 0.2 },
    { role: 'middle', weight: 0.15 },
    { role: 'main', weight: 0.65 }
  ],
  해: [
    { role: 'middle', weight: 0.3 },
    { role: 'main', weight: 0.7 }
  ]
};

export const HIDDEN_QI = Object.fromEntries(DZ.map((branch) => {
  const weights = HIDDEN_QI_WEIGHTS[branch];
  const stems = HIDDEN_STEMS[branch];
  if (weights.length !== stems.length) {
    throw new Error(`지장간 가중치 정의가 기존 상수와 일치하지 않습니다: ${branch}`);
  }
  return [branch, stems.map((stemIndex, index) => ({ stem: TG[stemIndex], ...weights[index] }))];
})) as Record<EarthlyBranch, Array<{ stem: HeavenlyStem; role: HiddenQiRole; weight: number }>>;

export const BRANCH_SEASON: Record<EarthlyBranch, SeasonName> = {
  인: 'spring',
  묘: 'spring',
  진: 'transition',
  사: 'summer',
  오: 'summer',
  미: 'transition',
  신: 'autumn',
  유: 'autumn',
  술: 'transition',
  해: 'winter',
  자: 'winter',
  축: 'transition'
};

export const BRANCH_CLIMATE: Record<EarthlyBranch, { heat: number; moisture: number }> = {
  자: { heat: -1, moisture: 0.85 },
  축: { heat: -0.75, moisture: 0.4 },
  인: { heat: -0.2, moisture: 0.25 },
  묘: { heat: 0.05, moisture: 0.35 },
  진: { heat: 0.2, moisture: 0.55 },
  사: { heat: 0.8, moisture: -0.2 },
  오: { heat: 1, moisture: -0.55 },
  미: { heat: 0.65, moisture: -0.3 },
  신: { heat: 0.15, moisture: -0.4 },
  유: { heat: -0.1, moisture: -0.7 },
  술: { heat: -0.15, moisture: -0.75 },
  해: { heat: -0.85, moisture: 0.9 }
};

export const STEM_CLIMATE: Record<HeavenlyStem, { heat: number; moisture: number }> = {
  갑: { heat: 0.05, moisture: 0.15 },
  을: { heat: 0, moisture: 0.25 },
  병: { heat: 0.9, moisture: -0.35 },
  정: { heat: 0.7, moisture: -0.25 },
  무: { heat: 0.15, moisture: -0.25 },
  기: { heat: 0.05, moisture: 0.15 },
  경: { heat: -0.1, moisture: -0.35 },
  신: { heat: -0.2, moisture: -0.45 },
  임: { heat: -0.75, moisture: 0.8 },
  계: { heat: -0.65, moisture: 0.9 }
};

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function round(value: number, digits = 3): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function makeConfidence(score: number, reasons: string[], limitations: string[] = []): Confidence {
  const normalized = round(clamp(score));
  return {
    score: normalized,
    level: normalized >= 0.75 ? 'high' : normalized >= 0.5 ? 'medium' : 'low',
    reasons,
    limitations
  };
}

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9가-힣-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function makeEvidence(
  rule: RuleMetadata,
  suffix: string,
  kind: EvidenceKind,
  statement: string,
  weight: number,
  paths: string[]
): Evidence {
  return {
    ...rule,
    id: `${rule.ruleId}:${safeId(suffix)}`,
    kind,
    statement,
    weight: round(clamp(weight)),
    paths
  };
}

export function emptyElementRecord(): Record<FiveElement, number> {
  return { 목: 0, 화: 0, 토: 0, 금: 0, 수: 0 };
}
