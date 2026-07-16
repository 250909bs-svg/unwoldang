import { describe, expect, it } from 'vitest';
import type { Bazi, GZ } from '../../types';
import { analyzeCompatibility, type RelationshipPurpose } from './index';

function fixtureBazi(day: GZ, hour: GZ | null, variant = 0): Bazi {
  return {
    y_gz: variant === 0 ? { tg: 2, dz: 2 } : { tg: 7, dz: 11 },
    m_gz: variant === 0 ? { tg: 4, dz: 4 } : { tg: 8, dz: 9 },
    d_gz: day,
    h_gz: hour,
    solar: variant === 0 ? [1990, 1, 1] : [1992, 9, 9],
    lunar_in: null,
    start_age: 7,
    forward: variant === 0,
    calculationBasis: {
      ipchun: '1990.02.04 10:00',
      isAfterIpchun: false
    }
  };
}

function relationHistogram(result: ReturnType<typeof analyzeCompatibility>) {
  return result.crossRelations.reduce<Record<string, number>>((histogram, relation) => {
    histogram[relation.relation] = (histogram[relation.relation] || 0) + 1;
    return histogram;
  }, {});
}

describe('v2 symmetric compatibility engine', () => {
  const personA = fixtureBazi({ tg: 0, dz: 0 }, { tg: 6, dz: 6 }, 0);
  const personB = fixtureBazi({ tg: 5, dz: 1 }, { tg: 1, dz: 7 }, 1);

  it('detects day-master control and spouse-palace six-combination with evidence', () => {
    const result = analyzeCompatibility({ personA, personB, purpose: 'marriage' });
    expect(result.dayMaster.kind).toBe('control');
    expect(result.dayMaster.direction).toBe('A-to-B');
    expect(
      result.crossRelations.some(
        (relation) =>
          relation.relation === 'six-combination' &&
          relation.participants.every((participant) => participant.position === 'day')
      )
    ).toBe(true);
    expect(result.spousePalace.relationIds.length).toBeGreaterThan(0);
    expect(result.spousePalace.conclusion.evidenceIds.length).toBeGreaterThan(0);
    expect(result.spousePalace.conclusion.confidence).toBeGreaterThan(0);
    expect(result.spousePalace.conclusion.uncertainty.length).toBeGreaterThan(0);
  });

  it('keeps qualitative compatibility invariant when the two people are swapped', () => {
    const forward = analyzeCompatibility({ personA, personB, purpose: 'marriage' });
    const reverse = analyzeCompatibility({
      personA: personB,
      personB: personA,
      purpose: 'marriage'
    });
    expect(reverse.overview.tendency).toBe(forward.overview.tendency);
    expect(reverse.confidence).toBe(forward.confidence);
    expect(relationHistogram(reverse)).toEqual(relationHistogram(forward));
    expect(
      reverse.dimensions.map((dimension) => ({
        id: dimension.id,
        tendency: dimension.tendency,
        confidence: dimension.confidence
      }))
    ).toEqual(
      forward.dimensions.map((dimension) => ({
        id: dimension.id,
        tendency: dimension.tendency,
        confidence: dimension.confidence
      }))
    );
    expect(reverse.elementExchange.mutuallyHelpfulElements).toEqual(
      forward.elementExchange.mutuallyHelpfulElements
    );
  });

  it('evaluates element supply independently in both directions', () => {
    const result = analyzeCompatibility({ personA, personB, purpose: 'dating' });
    const aReceipt = result.elementExchange.personAReceives;
    const bReceipt = result.elementExchange.personBReceives;
    expect(aReceipt.recipient).toBe('personA');
    expect(bReceipt.recipient).toBe('personB');
    expect(aReceipt.evidenceId).not.toBe(bReceipt.evidenceId);
    expect(
      aReceipt.suppliedHelpfulElements.length + aReceipt.missingHelpfulElements.length
    ).toBe(aReceipt.helpfulElements.length);
    expect(
      bReceipt.suppliedHelpfulElements.length + bReceipt.missingHelpfulElements.length
    ).toBe(bReceipt.helpfulElements.length);
    expect(result.elementExchange.conclusion.evidenceIds).toHaveLength(2);
  });

  it('uses separate dimensions for dating, marriage, business, and family', () => {
    const purposes: RelationshipPurpose[] = ['dating', 'marriage', 'business', 'family'];
    const dimensionIds = purposes.map((purpose) =>
      analyzeCompatibility({ personA, personB, purpose }).dimensions.map((dimension) => dimension.id)
    );
    expect(dimensionIds.every((ids) => ids.length === 4)).toBe(true);
    expect(new Set(dimensionIds.flat()).size).toBe(16);
  });

  it('returns evidence, confidence, and uncertainty for every conclusion and dimension', () => {
    const result = analyzeCompatibility({ personA, personB, purpose: 'business' });
    expect(result.engineVersion).toBe('2.0.0');
    expect(result.dayMaster.conclusion.evidenceIds.length).toBeGreaterThan(0);
    expect(result.dayMaster.conclusion.confidence).toBeGreaterThan(0);
    expect(result.dayMaster.conclusion.uncertainty.length).toBeGreaterThan(0);
    expect(
      result.dimensions.every(
        (dimension) =>
          dimension.evidenceIds.length > 0 &&
          dimension.confidence > 0 &&
          dimension.uncertainty.length > 0
      )
    ).toBe(true);
    expect(result.overview.evidenceIds.length).toBeGreaterThan(0);
    expect(result.overview.uncertainty.length).toBeGreaterThan(0);
    expect(JSON.stringify(result)).not.toContain('"score"');
  });

  it('lowers confidence and states the limitation when either hour is unknown', () => {
    const known = analyzeCompatibility({ personA, personB, purpose: 'family' });
    const personBUnknown = { ...personB, h_gz: null };
    const unknown = analyzeCompatibility({
      personA,
      personB: personBUnknown,
      purpose: 'family'
    });
    expect(unknown.confidence).toBeLessThan(known.confidence);
    expect(unknown.uncertainty.join(' ')).toContain('출생시각');
  });
});
