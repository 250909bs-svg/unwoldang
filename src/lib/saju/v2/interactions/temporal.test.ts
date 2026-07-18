import { describe, expect, it } from 'vitest';
import { tenGod, tenGodFromBranch } from '../../baziCalcs';
import type { Bazi } from '../../types';
import { analyzeTemporalInteractions } from './index';

function fixtureBazi(hourKnown = true): Bazi {
  return {
    y_gz: { tg: 0, dz: 0 },
    m_gz: { tg: 2, dz: 2 },
    d_gz: { tg: 4, dz: 6 },
    h_gz: hourKnown ? { tg: 7, dz: 9 } : null,
    solar: [1990, 1, 1],
    lunar_in: null,
    start_age: 7,
    forward: true,
    calculationBasis: {
      ipchun: '1990.02.04 10:00',
      isAfterIpchun: false
    }
  };
}

describe('v2 temporal interaction engine', () => {
  it('links natal, dayun, and seun relations without a luck score', () => {
    const result = analyzeTemporalInteractions({
      natal: fixtureBazi(),
      dayun: { gz: { tg: 5, dz: 1 }, label: '기축 대운' },
      seun: { gz: { tg: 6, dz: 8 }, label: '경신 세운', referenceYear: 2026 }
    });

    expect(result.layers.map((layer) => layer.layer)).toEqual(['natal', 'dayun', 'seun']);
    expect(
      result.relations.some(
        (relation) =>
          relation.relation === 'stem-combination' &&
          relation.participants.some((participant) => participant.layer === 'dayun')
      )
    ).toBe(true);
    expect(
      result.relations.some(
        (relation) =>
          relation.relation === 'stem-clash' &&
          relation.participants.some((participant) => participant.layer === 'seun')
      )
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain('luckStrength');
    expect(JSON.stringify(result)).not.toContain('"score"');
  });

  it('reports direct and hidden-stem ten-god activations as evidence', () => {
    const dayunGz = { tg: 5, dz: 1 };
    const result = analyzeTemporalInteractions({
      natal: fixtureBazi(),
      dayun: { gz: dayunGz },
      seun: { gz: { tg: 6, dz: 8 } }
    });
    const dayunStem = result.tenGodActivations.find(
      (activation) => activation.layer === 'dayun' && activation.source === 'stem'
    );
    const dayunBranch = result.tenGodActivations.find(
      (activation) => activation.layer === 'dayun' && activation.source === 'branch'
    );
    expect(dayunStem?.tenGod).toBe(tenGod(fixtureBazi().d_gz.tg, dayunGz.tg));
    expect(dayunBranch?.tenGod).toBe(tenGodFromBranch(fixtureBazi().d_gz.tg, dayunGz.dz));
    expect(
      result.tenGodActivations.some((activation) => activation.source === 'hidden-stem')
    ).toBe(true);
    expect(result.findings.every((finding) => finding.evidenceIds.length > 0)).toBe(true);
  });

  it('reduces confidence and discloses uncertainty when the hour is unknown', () => {
    const known = analyzeTemporalInteractions({
      natal: fixtureBazi(true),
      dayun: { gz: { tg: 5, dz: 1 } },
      seun: { gz: { tg: 6, dz: 8 } }
    });
    const unknown = analyzeTemporalInteractions({
      natal: fixtureBazi(false),
      dayun: { gz: { tg: 5, dz: 1 } },
      seun: { gz: { tg: 6, dz: 8 } }
    });
    expect(unknown.confidence).toBeLessThan(known.confidence);
    expect(unknown.uncertainty.join(' ')).toContain('출생시각 미상');
  });

  it('discloses omitted time layers instead of inventing them', () => {
    const result = analyzeTemporalInteractions({ natal: fixtureBazi() });
    expect(result.layers).toHaveLength(1);
    expect(result.tenGodActivations).toHaveLength(0);
    expect(result.uncertainty.join(' ')).toContain('대운 입력');
    expect(result.uncertainty.join(' ')).toContain('세운 입력');
  });
});
