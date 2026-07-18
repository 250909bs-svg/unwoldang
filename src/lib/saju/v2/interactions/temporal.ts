import { DZ, HIDDEN_STEMS, TEN_GOD_MEANINGS, TG, type TenGodLabel } from '../../constants';
import { tenGod, tenGodFromBranch } from '../../baziCalcs';
import { createBaziParticipants, createGzParticipants, detectRelations } from './relations';
import type {
  RelationEvidence,
  RelationLayer,
  TemporalAnalysisInput,
  TemporalAnalysisResult,
  TemporalFinding,
  TemporalLayerSnapshot,
  TemporalPillarInput,
  TenGodActivation
} from './types';

const PILLAR_DOMAINS = {
  year: '가계·초년·외부 관계',
  month: '사회 역할·직업 환경·부모 기반',
  day: '자기 중심·배우자궁·일상 관계',
  hour: '후반 생애·자녀·미래 계획',
  luck: '운의 시간 배경'
} as const;

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function temporalLayerLabel(layer: Exclude<RelationLayer, 'natal' | 'personA' | 'personB'>) {
  if (layer === 'dayun') return '대운';
  if (layer === 'seun') return '세운';
  return '월운';
}

function activationThemes(label: TenGodLabel) {
  return TEN_GOD_MEANINGS[label]
    .split(',')
    .map((theme) => theme.trim())
    .filter(Boolean);
}

function makeLayerSnapshot(
  layer: 'dayun' | 'seun' | 'wolyun',
  input: TemporalPillarInput
): TemporalLayerSnapshot {
  return {
    layer,
    label: input.label || TG[input.gz.tg] + DZ[input.gz.dz],
    gz: { ...input.gz },
    referenceYear: input.referenceYear
  };
}

function buildActivations(
  natalDayStem: number,
  layer: 'dayun' | 'seun' | 'wolyun',
  input: TemporalPillarInput,
  relations: RelationEvidence[]
): TenGodActivation[] {
  const stemLabel = TG[input.gz.tg];
  const branchLabel = DZ[input.gz.dz];
  const relationIds = relations
    .filter((relation) => relation.participants.some((participant) => participant.layer === layer))
    .map((relation) => relation.id);
  const directStemGod = tenGod(natalDayStem, input.gz.tg);
  const directBranchGod = tenGodFromBranch(natalDayStem, input.gz.dz);
  const activations: TenGodActivation[] = [
    {
      id: 'activation:' + layer + ':stem:' + stemLabel,
      layer,
      source: 'stem',
      sourceLabel: stemLabel,
      tenGod: directStemGod,
      themes: activationThemes(directStemGod),
      salience: 'primary',
      confidence: 0.97,
      evidenceIds: relationIds,
      uncertainty: []
    },
    {
      id: 'activation:' + layer + ':branch:' + branchLabel,
      layer,
      source: 'branch',
      sourceLabel: branchLabel,
      tenGod: directBranchGod,
      themes: activationThemes(directBranchGod),
      salience: 'primary',
      confidence: 0.88,
      evidenceIds: relationIds,
      uncertainty: ['지지 십성은 대표 오행 기준이며 실제 작동은 지장간 구성과 투출 여부를 함께 확인해야 합니다.']
    }
  ];

  const hiddenStemIndexes = [...new Set(HIDDEN_STEMS[branchLabel] || [])];
  for (const hiddenStemIndex of hiddenStemIndexes) {
    const hiddenLabel = TG[hiddenStemIndex];
    const hiddenGod = tenGod(natalDayStem, hiddenStemIndex);
    activations.push({
      id: 'activation:' + layer + ':hidden:' + hiddenLabel,
      layer,
      source: 'hidden-stem',
      sourceLabel: hiddenLabel,
      tenGod: hiddenGod,
      themes: activationThemes(hiddenGod),
      salience: 'supporting',
      confidence: 0.7,
      evidenceIds: relationIds,
      uncertainty: ['지장간 십성은 투간·통근·합충에 따라 발현 강도가 달라지므로 보조 활성으로 분류합니다.']
    });
  }
  return activations;
}

function relationTendency(relation: RelationEvidence): TemporalFinding['tendency'] {
  if (relation.polarity === 'integrative') return 'integration';
  if (relation.polarity === 'friction') return 'tension';
  if (relation.polarity === 'latent-friction') return 'latent-tension';
  return 'conditional';
}

function relationFinding(relation: RelationEvidence, index: number): TemporalFinding {
  const natalDomains = [
    ...new Set(
      relation.participants
        .filter((participant) => participant.layer === 'natal')
        .map((participant) => PILLAR_DOMAINS[participant.position])
    )
  ];
  const temporalLayers = [
    ...new Set(
      relation.participants
        .filter((participant) => participant.layer !== 'natal')
        .map((participant) =>
          temporalLayerLabel(participant.layer as 'dayun' | 'seun' | 'wolyun')
        )
    )
  ];
  const domainText =
    natalDomains.length > 0
      ? natalDomains.join('·') + ' 영역이 '
      : '대운·세운 사이의 시간 조건이 ';
  const layerText = temporalLayers.length > 0 ? temporalLayers.join('·') : '운';
  const uncertainty = [...relation.uncertainty];

  if (relation.polarity === 'friction' || relation.polarity === 'latent-friction') {
    uncertainty.push('충·형·파·해는 사건 확정이 아니라 해당 영역의 조정 압력과 민감도 증가를 뜻합니다.');
  }

  return {
    id: 'temporal-finding:relation:' + index,
    topic: relation.name + (relation.subtype ? ' · ' + relation.subtype : ''),
    tendency: relationTendency(relation),
    statement:
      layerText +
      '에서 ' +
      relation.name +
      ' 근거가 형성되어 ' +
      domainText +
      '활성화됩니다. 길흉을 단정하지 않고 결합·변화·마찰의 성격을 후속 해석 근거로 사용합니다.',
    evidenceIds: [relation.id],
    confidence: relation.confidence,
    uncertainty
  };
}

function activationFindings(activations: TenGodActivation[]): TemporalFinding[] {
  const layers: Array<'dayun' | 'seun' | 'wolyun'> = ['dayun', 'seun', 'wolyun'];
  const findings: TemporalFinding[] = [];
  for (const layer of layers) {
    const layerActivations = activations.filter(
      (activation) => activation.layer === layer && activation.salience === 'primary'
    );
    if (layerActivations.length === 0) continue;
    const gods = [...new Set(layerActivations.map((activation) => activation.tenGod))];
    const themes = [...new Set(layerActivations.flatMap((activation) => activation.themes))];
    findings.push({
      id: 'temporal-finding:activation:' + layer,
      topic: temporalLayerLabel(layer) + ' 십성 활성',
      tendency: 'activation',
      statement:
        temporalLayerLabel(layer) +
        '의 표면 십성은 ' +
        gods.join('·') +
        '이며 ' +
        themes.slice(0, 5).join('·') +
        ' 주제가 부각될 조건을 만듭니다.',
      evidenceIds: layerActivations.map((activation) => activation.id),
      confidence: Math.min(...layerActivations.map((activation) => activation.confidence)),
      uncertainty: ['십성 활성은 주제의 등장 가능성을 뜻하며 구체적 사건이나 결과의 좋고 나쁨을 확정하지 않습니다.']
    });
  }
  return findings;
}

export function analyzeTemporalInteractions(input: TemporalAnalysisInput): TemporalAnalysisResult {
  const participants = createBaziParticipants(input.natal, 'natal');
  const layers: TemporalLayerSnapshot[] = [
    {
      layer: 'natal',
      label:
        TG[input.natal.y_gz.tg] +
        DZ[input.natal.y_gz.dz] +
        ' ' +
        TG[input.natal.m_gz.tg] +
        DZ[input.natal.m_gz.dz] +
        ' ' +
        TG[input.natal.d_gz.tg] +
        DZ[input.natal.d_gz.dz]
    }
  ];
  const temporalInputs: Array<['dayun' | 'seun' | 'wolyun', TemporalPillarInput | undefined]> = [
    ['dayun', input.dayun],
    ['seun', input.seun],
    ['wolyun', input.wolyun]
  ];

  for (const [layer, temporalInput] of temporalInputs) {
    if (!temporalInput) continue;
    participants.push(...createGzParticipants(temporalInput.gz, layer, 'luck', layer + ':luck'));
    layers.push(makeLayerSnapshot(layer, temporalInput));
  }

  const relations = detectRelations(participants, { scope: 'cross-layer-only' });
  const tenGodActivations = temporalInputs.flatMap(([layer, temporalInput]) =>
    temporalInput
      ? buildActivations(input.natal.d_gz.tg, layer, temporalInput, relations)
      : []
  );
  const findings = [
    ...relations.map(relationFinding),
    ...activationFindings(tenGodActivations)
  ];
  const uncertainty: string[] = [];

  if (!input.natal.h_gz) {
    uncertainty.push('출생시각 미상으로 시주가 참여하는 원국-운 상호작용은 판정에서 제외했습니다.');
  }
  if (!input.dayun) {
    uncertainty.push('대운 입력이 없어 원국-대운 및 대운-세운 중첩 관계를 판정하지 않았습니다.');
  }
  if (!input.seun) {
    uncertainty.push('세운 입력이 없어 해당 연도의 활성 조건을 판정하지 않았습니다.');
  }
  if (relations.some((relation) => relation.transformedElement)) {
    uncertainty.push('합·삼합·방합의 화기 성립은 존재 관계와 분리했으며 월령·투간·통근 검증이 추가로 필요합니다.');
  }

  const completeness =
    1 -
    (input.natal.h_gz ? 0 : 0.1) -
    (input.dayun ? 0 : 0.12) -
    (input.seun ? 0 : 0.1);
  const evidenceAdjustment = Math.min(relations.length, 8) * 0.005;

  return {
    engineVersion: '2.0.0',
    layers,
    relations,
    tenGodActivations,
    findings,
    confidence: clamp(completeness + evidenceAdjustment, 0.55, 0.97),
    uncertainty
  };
}
