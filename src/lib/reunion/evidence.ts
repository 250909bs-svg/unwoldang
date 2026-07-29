import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import type {
  EvidenceDirection,
  EvidenceSource,
  ReunionEvidenceNode,
  ReunionIntakeData
} from './types';

export type ReunionEngineBasis = ReturnType<typeof buildDeterministicSajuBasis>;

function node(
  id: string,
  source: EvidenceSource,
  direction: EvidenceDirection,
  label: string,
  detail: string,
  confidence = 0.8,
  verified = true
): ReunionEvidenceNode {
  return { id, source, direction, label, detail, confidence, verified };
}

export function compatibilityValue(tendency?: string) {
  if (tendency === 'supportive') return 68;
  if (tendency === 'conditional') return 54;
  if (tendency === 'tension') return 36;
  return 48;
}

export function buildReunionEvidence(
  input: ReunionIntakeData,
  basis: ReunionEngineBasis
): ReunionEvidenceNode[] {
  const facts = input.reunion.facts;
  const compatibility = basis.commercialV2.compatibility;
  const evidence: ReunionEvidenceNode[] = [
    node(
      'saju:self-structure',
      'SAJU',
      'NEUTRAL',
      '본인 명리 구조',
      basis.dayMaster.stem + ' ' + basis.dayMaster.element + ' 일간, ' +
        basis.strength.label + ' 구조를 분 단위 만세력 정책으로 계산했습니다.',
      basis.commercialV2.confidence ?? 0.62
    ),
    node(
      'relationship:reported-facts',
      'RELATIONSHIP_FACT',
      'NEUTRAL',
      '관계 사실',
      '이별 시점·마지막 연락·차단·반복 원인은 사용자가 입력한 사실이며 상대의 내면을 뜻하지 않습니다.',
      0.92
    ),
    node(
      'system:observable-limit',
      'SYSTEM_LIMIT',
      'OPPOSES',
      '관찰 한계',
      '상대의 속마음, 미래 행동, 실제 재회 성사는 사주나 입력 정보만으로 확인할 수 없습니다.',
      1
    ),
    node(
      'system:ziwei-unverified',
      'SYSTEM_LIMIT',
      'OPPOSES',
      '자미두수 미사용',
      '검증된 자미두수 계산기가 없어 이번 지표와 시기에 반영하지 않았습니다.',
      1,
      false
    )
  ];

  if (compatibility) {
    evidence.push(
      node(
        'saju:compatibility-overview',
        'SAJU',
        compatibility.overview.tendency === 'supportive'
          ? 'SUPPORTS'
          : compatibility.overview.tendency === 'tension'
            ? 'OPPOSES'
            : 'NEUTRAL',
        '두 사람 정적 궁합',
        compatibility.overview.statement,
        compatibility.overview.confidence
      )
    );
    compatibility.dimensions.forEach((dimension) => {
      evidence.push(
        node(
          'saju:' + dimension.id,
          'SAJU',
          dimension.tendency === 'supportive'
            ? 'SUPPORTS'
            : dimension.tendency === 'tension'
              ? 'OPPOSES'
              : 'NEUTRAL',
          dimension.label,
          dimension.statement,
          dimension.confidence
        )
      );
    });
  } else {
    evidence.push(
      node(
        'saju:partner-missing',
        'SYSTEM_LIMIT',
        'OPPOSES',
        '상대 출생정보 부족',
        '상대 출생정보가 없어 두 사람 정적 궁합과 동시 흐름을 제외했습니다.',
        1,
        false
      )
    );
  }

  const moodDirection: EvidenceDirection =
    facts.lastContactMood === 'warm'
      ? 'SUPPORTS'
      : facts.lastContactMood === 'cold' || facts.lastContactMood === 'conflict'
        ? 'OPPOSES'
        : 'NEUTRAL';
  evidence.push(
    node(
      'behavior:last-contact',
      'BEHAVIOR',
      moodDirection,
      '마지막 연락 온도',
      '마지막 연락 분위기: ' + facts.lastContactMood +
        ', 현재 연락 빈도: ' + facts.contactFrequency + '.',
      facts.lastContactMood === 'unknown' ? 0.35 : 0.9
    )
  );

  evidence.push(
    node(
      'relationship:recurrence',
      'RELATIONSHIP_FACT',
      facts.repeatedCause || facts.pastReunionCount > 0 ? 'OPPOSES' : 'SUPPORTS',
      '반복 이별 기록',
      '과거 재회 ' + facts.pastReunionCount + '회, 같은 원인 반복 ' +
        (facts.repeatedCause ? '있음' : '없음') + '으로 입력되었습니다.',
      0.9
    )
  );

  const obstacleCount = [
    facts.familyObstacle,
    facts.workObstacle,
    facts.moneyObstacle,
    facts.trustObstacle,
    facts.valuesObstacle,
    facts.marriageObstacle,
    facts.childrenObstacle
  ].filter(Boolean).length;
  evidence.push(
    node(
      'relationship:obstacles',
      'RELATIONSHIP_FACT',
      obstacleCount > 1 ? 'OPPOSES' : obstacleCount === 0 ? 'SUPPORTS' : 'NEUTRAL',
      '현실 장벽',
      '사용자가 확인한 주요 현실 장벽은 ' + obstacleCount + '개입니다.',
      0.88
    )
  );

  const readiness = input.reunion.readiness;
  const readyCount = [
    readiness.accountabilityTaken,
    readiness.breakupCauseChanged,
    readiness.canAcceptNoReply,
    readiness.canRespectBoundary
  ].filter(Boolean).length;
  evidence.push(
    node(
      'behavior:readiness',
      'BEHAVIOR',
      readyCount >= 3 ? 'SUPPORTS' : readyCount <= 1 ? 'OPPOSES' : 'NEUTRAL',
      '연락 준비도',
      '책임 인정, 원인 변화, 무응답 수용, 경계 존중 여부를 각각 분리해 반영했습니다.',
      0.95
    )
  );

  evidence.push(
    node(
      'safety:gate',
      'SAFETY',
      'NEUTRAL',
      '안전 게이트',
      '연락 거부·차단·폭력·위협·통제·스토킹 입력은 모든 명리 신호보다 먼저 적용됩니다.',
      1
    )
  );

  return evidence;
}
