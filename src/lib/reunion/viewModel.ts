import type { SajuReportData } from '../saju/report';
import type { CompatibilityAnalysisResult, CompatibilityTendency } from '../saju/v2/compatibility';
import { parseCompatibilityBadge } from './compatibilityAxes';
import {
  REUNION_VIEW_MODEL_VERSION,
  type ReunionConfidence,
  type ReunionContext,
  type ReunionDeterministicEvidence,
  type ReunionEvidenceTendency,
  type ReunionQualitativeFinding,
  type ReunionUserContextItem,
  type ReunionViewModel
} from './types';

const BREAKUP_DURATION_LABELS: Record<ReunionContext['breakupDuration'], string> = {
  under1m: '1개월 미만',
  oneTo3m: '1~3개월',
  threeTo6m: '3~6개월',
  sixTo12m: '6~12개월',
  over1y: '1년 이상',
  unknown: '알 수 없음'
};

const CONTACT_STATUS_LABELS: Record<ReunionContext['contactStatus'], string> = {
  'no-contact': '연락 없음',
  occasional: '가끔 연락',
  active: '연락 지속 중',
  blocked: '연락·차단 경계 있음',
  unknown: '알 수 없음'
};

const DESIRED_OUTCOME_LABELS: Record<ReunionContext['desiredOutcome'], string> = {
  reconnect: '다시 연결하기',
  closure: '관계를 정리하기',
  clarity: '관계의 현재 상태를 확인하기',
  unsure: '아직 정하지 못함'
};

export interface ReunionEvidenceInput {
  sajuReport?: Pick<SajuReportData, 'sections' | 'engineMeta'> | null;
  compatibility?: Pick<CompatibilityAnalysisResult, 'dimensions' | 'overview' | 'uncertainty'> | null;
}

export interface BuildReunionViewModelInput extends ReunionEvidenceInput {
  context?: ReunionContext | null;
}

function toTendency(value: CompatibilityTendency): ReunionEvidenceTendency {
  return value === 'insufficient' ? 'unknown' : value;
}

/**
 * `reportBuilder.ts:3069-3073` 이 만드는 카드 배지는 `"${tendency} · ${confidenceLabel}"` 형태지만,
 * 고객에게 도달하기 전 `finalizeCustomerReport` → `customerTendency` 가 영문 식별자를 한국어로
 * 바꾸고 `· 근거 강함/보통/제한` 꼬리를 떼어 낸다. 실제로 오는 값은 `"조정이 필요한 흐름"` 한 덩어리다.
 *
 * 그래서 파서는 **한 벌만** 둔다 — `compatibilityAxes.parseCompatibilityBadge` 가 두 형태를 모두 받는다.
 * 여기에 영문 전용 파서를 따로 두면 실제 리포트에서 네 축이 전부 '근거부족'으로 착지하고,
 * 그 사실이 두 파서가 갈라져 있는 동안에는 테스트에도 잡히지 않는다.
 */
function parseCardBadge(badge: string | undefined): { tendency: ReunionEvidenceTendency; limited: boolean } {
  if (typeof badge !== 'string') return { tendency: 'neutral', limited: true };
  const { direction, confidenceLabel } = parseCompatibilityBadge(badge);
  const limited = !confidenceLabel || confidenceLabel.includes('유보') || confidenceLabel.includes('제한');

  if (direction === 'insufficient') return { tendency: 'unknown', limited: true };
  return { tendency: direction, limited };
}

/** `details[].content` 에는 `근거 ID: …` / `유보: …` 블록이 붙어 있다. 본문만 떼어낸다. */
function splitDetailContent(content: string): { statement: string; uncertainty: string[] } {
  const [body, ...blocks] = content.split('\n\n');
  const uncertainty = blocks
    .filter((block) => block.startsWith('유보:'))
    .map((block) => block.replace(/^유보:\s*/u, '').trim())
    .filter(Boolean);
  return { statement: (body || '').trim(), uncertainty };
}

function qualitativeConfidence(args: { hasEvidence: boolean; hasUncertainty: boolean; explicitlyInsufficient?: boolean }): ReunionConfidence {
  if (!args.hasEvidence || args.explicitlyInsufficient) return 'unknown';
  return args.hasUncertainty ? 'limited' : 'supported';
}

function uniqueNonEmpty(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

/** Copies traceable deterministic output without converting confidence into a relationship probability. */
export function adaptReunionDeterministicEvidence(input: ReunionEvidenceInput): ReunionDeterministicEvidence[] {
  const evidence: ReunionDeterministicEvidence[] = [];
  const report = input.sajuReport;
  const reportUncertainty = report?.engineMeta?.uncertainty || [];
  const reportLimited = report?.engineMeta?.calculationPrecision !== 'exact-minute' || reportUncertainty.length > 0;

  report?.sections.forEach((section, sectionIndex) => {
    const source = section.id === 'compatibility-evidence-v2'
      ? 'compatibility'
      : section.id === 'temporal-evidence-v2' || section.id === 'expert-evidence-v2'
        ? 'saju'
        : null;
    if (!source) return;

    const sectionLimited = reportLimited || report?.engineMeta?.releaseDecision !== 'eligible';

    uniqueNonEmpty(section.paragraphs || []).forEach((statement, paragraphIndex) => {
      evidence.push({
        id: `report:${section.id}:${paragraphIndex}`,
        source,
        sourcePath: `sections.${sectionIndex}.paragraphs.${paragraphIndex}`,
        label: section.title,
        statement,
        tendency: 'neutral',
        confidence: qualitativeConfidence({
          hasEvidence: true,
          hasUncertainty: sectionLimited
        }),
        uncertainty: uniqueNonEmpty(reportUncertainty)
      });
    });

    /*
     * `cards` 는 궁합 4축(dimension)이다. 여기까지 읽지 않으면 CH02·CH05 가 쓸 근거가 없다.
     * 배지에서 tendency 와 근거 신뢰도를 분리해 담고, 영문 식별자는 화면으로 넘기지 않는다.
     */
    (section.cards || []).forEach((card, cardIndex) => {
      const statement = (card.body || '').trim();
      if (!statement) return;
      const { tendency, limited } = parseCardBadge(card.badge);
      evidence.push({
        id: `report:${section.id}:card:${cardIndex}`,
        source,
        sourcePath: `sections.${sectionIndex}.cards.${cardIndex}`,
        label: (card.title || section.title).trim(),
        statement,
        tendency,
        confidence: qualitativeConfidence({
          hasEvidence: true,
          hasUncertainty: sectionLimited || limited,
          explicitlyInsufficient: tendency === 'unknown'
        }),
        uncertainty: uniqueNonEmpty(reportUncertainty)
      });
    });

    /* `details` 는 fact 목록이다. 지금까지 통째로 버려지던 자료다. */
    (section.details || []).forEach((detail, detailIndex) => {
      const { statement, uncertainty } = splitDetailContent(detail.content || '');
      if (!statement) return;
      evidence.push({
        id: `report:${section.id}:detail:${detailIndex}`,
        source,
        sourcePath: `sections.${sectionIndex}.details.${detailIndex}`,
        label: (detail.summary || section.title).trim(),
        statement,
        tendency: 'neutral',
        confidence: qualitativeConfidence({
          hasEvidence: true,
          hasUncertainty: sectionLimited || uncertainty.length > 0
        }),
        uncertainty: uniqueNonEmpty([...reportUncertainty, ...uncertainty])
      });
    });
  });

  const compatibility = input.compatibility;
  compatibility?.dimensions.forEach((dimension, index) => {
    const statement = dimension.statement.trim();
    if (!statement) return;
    evidence.push({
      id: `compatibility:${dimension.id}`,
      source: 'compatibility',
      sourcePath: `dimensions.${index}.statement`,
      label: dimension.label,
      statement,
      tendency: toTendency(dimension.tendency),
      confidence: qualitativeConfidence({
        hasEvidence: dimension.evidenceIds.length > 0 && dimension.confidence > 0,
        hasUncertainty: dimension.uncertainty.length > 0,
        explicitlyInsufficient: dimension.tendency === 'insufficient'
      }),
      uncertainty: uniqueNonEmpty(dimension.uncertainty)
    });
  });

  if (compatibility?.overview.statement.trim()) {
    evidence.push({
      id: 'compatibility:overview',
      source: 'compatibility',
      sourcePath: 'overview.statement',
      label: '궁합 요약',
      statement: compatibility.overview.statement.trim(),
      tendency: toTendency(compatibility.overview.tendency),
      confidence: qualitativeConfidence({
        hasEvidence: compatibility.overview.evidenceIds.length > 0 && compatibility.overview.confidence > 0,
        hasUncertainty: compatibility.overview.uncertainty.length > 0,
        explicitlyInsufficient: compatibility.overview.tendency === 'insufficient'
      }),
      uncertainty: uniqueNonEmpty([...compatibility.uncertainty, ...compatibility.overview.uncertainty])
    });
  }

  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = `${item.source}:${item.statement}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildUserContext(context?: ReunionContext | null): ReunionUserContextItem[] {
  if (!context) return [];
  const items: ReunionUserContextItem[] = [
    { id: 'breakupDuration', label: '이별 후 기간', value: BREAKUP_DURATION_LABELS[context.breakupDuration], source: 'user-provided', verification: 'unverified' },
    { id: 'contactStatus', label: '현재 연락 상태', value: CONTACT_STATUS_LABELS[context.contactStatus], source: 'user-provided', verification: 'unverified' },
    { id: 'breakupReason', label: '이별 배경', value: context.breakupReason || '입력하지 않음', source: 'user-provided', verification: 'unverified' },
    { id: 'desiredOutcome', label: '원하는 결과', value: DESIRED_OUTCOME_LABELS[context.desiredOutcome], source: 'user-provided', verification: 'unverified' }
  ];
  if (context.lastContactAt) items.push({ id: 'lastContactAt', label: '마지막 연락일', value: context.lastContactAt, source: 'user-provided', verification: 'unverified' });
  if (context.notes) items.push({ id: 'notes', label: '추가 맥락', value: context.notes, source: 'user-provided', verification: 'unverified' });
  return items;
}

function overallConfidence(evidence: ReunionDeterministicEvidence[]): ReunionConfidence {
  if (evidence.length === 0 || evidence.every((item) => item.confidence === 'unknown')) return 'unknown';
  return evidence.some((item) => item.confidence !== 'supported') ? 'limited' : 'supported';
}

function buildFinding(id: ReunionQualitativeFinding['id'], label: string, candidates: ReunionDeterministicEvidence[]): ReunionQualitativeFinding {
  const selected = candidates.find((item) => item.confidence !== 'unknown') || candidates[0];
  return selected
    ? { id, label, statement: selected.statement, confidence: selected.confidence, evidenceIds: [selected.id] }
    : { id, label, statement: '현재 검증된 계산 근거로는 이 항목을 판단할 수 없어요.', confidence: 'unknown', evidenceIds: [] };
}

export function buildReunionViewModel(input: BuildReunionViewModelInput): ReunionViewModel {
  const deterministicEvidence = adaptReunionDeterministicEvidence(input);
  const userContext = buildUserContext(input.context);
  const status = overallConfidence(deterministicEvidence);
  const limitations = uniqueNonEmpty([
    ...deterministicEvidence.flatMap((item) => item.uncertainty),
    ...(input.context ? [] : ['이별·연락 맥락이 제공되지 않아 현실 상황을 함께 판단할 수 없어요.']),
    '상대의 속마음과 미래의 재회 여부는 명리 계산으로 확정할 수 없어요.',
    '사용자가 제공한 관계 맥락은 계산 근거와 분리된 미확인 정보예요.'
  ]);
  const isBlocked = input.context?.contactStatus === 'blocked';

  return {
    version: REUNION_VIEW_MODEL_VERSION,
    status,
    headline: status === 'unknown' ? '현재 근거로는 재회 여부를 판단할 수 없어요' : '계산된 관계 흐름과 현실 맥락을 나눠 확인하세요',
    summary: '이 결과는 재회 확률을 제시하지 않고, 검증된 사주·궁합 문장을 사용자 제공 정보와 분리해 보여줘요.',
    findings: [
      buildFinding('relationship-pattern', '관계 흐름', deterministicEvidence.filter((item) => item.source === 'compatibility')),
      buildFinding('timing-context', '시기 해석 범위', deterministicEvidence.filter((item) => item.source === 'saju'))
    ],
    deterministicEvidence,
    userContext,
    limitations,
    contactBoundary: {
      status: isBlocked ? 'withheld' : 'standard',
      message: isBlocked ? '차단이나 연락 거부 신호가 있으면 우회 연락을 제안하지 않고 상대의 경계를 우선해요.' : '연락 여부는 상대의 명시적 동의와 반복되는 현실 행동을 우선해 판단하세요.'
    }
  };
}
