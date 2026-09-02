import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  expectedGoldenCategoryCounts,
  generalSignatureGoldenFixtures,
  GOLDEN_MATRIX_TOTAL
} from './fixtures';
import {
  evaluateGoldenMatrix,
  runCurrentDeterministicFacts,
  validateGoldenFixtureDefinitions
} from './harness';
import { goldenFixtureCategories, type GoldenFixture } from './schema';
import { createPendingExpertReview } from './expertReview';

describe('general signature independent golden FACT matrix', () => {
  it('contains exactly 140 fixtures with the approved category distribution', () => {
    expect(generalSignatureGoldenFixtures).toHaveLength(140);
    expect(GOLDEN_MATRIX_TOTAL).toBe(140);

    for (const category of goldenFixtureCategories) {
      expect(
        generalSignatureGoldenFixtures.filter((fixture) => fixture.category === category),
        category
      ).toHaveLength(expectedGoldenCategoryCounts[category]);
    }
  });

  it('keeps ids unique and never marks an unsourced expected FACT as verified', () => {
    expect(validateGoldenFixtureDefinitions(generalSignatureGoldenFixtures)).toEqual([]);
    expect(new Set(generalSignatureGoldenFixtures.map((fixture) => fixture.id)).size).toBe(140);
  });

  it('does not import or execute the current engine while defining expected fixtures', () => {
    const expectedDefinitionSources = [
      './fixtures.ts',
      './evidenceRegistry.ts',
      './independentTables.ts'
    ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8')).join('\n');
    expect(expectedDefinitionSources).not.toMatch(
      /deterministicBasis|buildDeterministic|calcBazi|getTwelveYunseong|\btenGod\b|buildBirthCalculation/
    );
  });

  it('derives fixture coverage from field provenance and never counts pending as PASS', () => {
    const report = evaluateGoldenMatrix(generalSignatureGoldenFixtures);

    expect(report.summary).toMatchObject({
      total: 140,
      verified: 0,
      partial: 106,
      pending: 34,
      conflicting: 0,
      verifiedFactFields: 286,
      conflictingFactFields: 0,
      releaseGate: 'NO-GO',
      provenanceWarnings: 0
    });
    expect(report.summary.fixtureMatches).not.toBe(report.summary.total);
    expect(report.fixtures.filter((fixture) => fixture.result === 'pending')).toHaveLength(34);
    expect(report.fixtures.filter((fixture) => fixture.result === 'source-conflict')).toHaveLength(0);
    expect(report.summary.fixtureMismatches).toBeGreaterThan(0);
    expect(report.summary.sourceChecks.independentManse).toBe(0);
    expect(report.summary.sourceTierCounts.E).toBe(0);
    expect(
      report.fixtures
        .filter((fixture) => fixture.category === 'solar-term-boundary')
        .flatMap((fixture) => fixture.fields)
        .filter((field) => field.result === 'mismatch')
        .every((field) => field.classification === 'INSUFFICIENT_EVIDENCE')
    ).toBe(true);
    expect(
      report.fixtures
        .flatMap((fixture) => fixture.fields)
        .filter((field) => field.result === 'mismatch')
        .every((field) => Boolean(field.expectedSource?.sourceTier && field.classification))
    ).toBe(true);
  });

  it('matches the independently sourced 1992-09-09 10:24 representative FACT', () => {
    const fixture = generalSignatureGoldenFixtures.find((item) => item.id === 'solar-general-001');
    expect(fixture).toBeDefined();
    expect(fixture?.expected.leapMonth).toBe(false);

    const actual = runCurrentDeterministicFacts(fixture!);
    expect(actual).toMatchObject({
      normalizedSolarDate: '1992-09-09',
      yearPillar: '임신',
      monthPillar: '기유',
      dayPillar: '무자',
      hourPillar: '정사',
      dayMaster: '무'
    });
  });

  it('reports exact differing fields without changing the engine or expected value', () => {
    const source = generalSignatureGoldenFixtures[0];
    const intentionallyDifferent: GoldenFixture = {
      ...source,
      id: 'mismatch-contract-check',
      expected: { yearPillar: '갑자' },
      provenance: { yearPillar: source.provenance.yearPillar },
      verificationStatus: 'verified'
    };
    const report = evaluateGoldenMatrix([intentionallyDifferent], () => ({ yearPillar: '임신' }));

    expect(report.summary).toMatchObject({ fixtureMismatches: 1, factMismatches: 1 });
    expect(report.fixtures[0]).toMatchObject({ result: 'mismatch' });
    expect(report.fixtures[0].fields[0]).toMatchObject({
      field: 'yearPillar',
      expected: '갑자',
      actual: '임신',
      result: 'mismatch',
      expectedSource: { sourceType: 'KASI', confidence: 'high' }
    });
    expect(report.fixtures[0].boundaryPolicy).toEqual({
      lateZiPolicy: 'civil-midnight',
      trueSolarTimePolicy: 'disabled',
      timezone: 'Asia/Seoul'
    });
  });

  it('warns and excludes expected values without independent provenance', () => {
    const source = generalSignatureGoldenFixtures[0];
    const unsourced: GoldenFixture = {
      ...source,
      id: 'unsourced-contract-check',
      expected: { yearPillar: '임신' },
      provenance: {},
      verificationStatus: 'partial'
    };
    const report = evaluateGoldenMatrix([unsourced], () => ({ yearPillar: '임신' }));

    expect(report.summary.fixtureMatches).toBe(0);
    expect(report.summary.provenanceWarnings).toBe(1);
    expect(report.fixtures[0].result).toBe('no-source-backed-expected');
  });

  it('never calls the engine provider for pending fixtures', () => {
    const pending = generalSignatureGoldenFixtures.find((fixture) => fixture.verificationStatus === 'pending')!;
    const report = evaluateGoldenMatrix([pending], () => {
      throw new Error('pending fixture must not execute');
    });

    expect(report.fixtures[0].result).toBe('pending');
    expect(report.summary.comparedFixtures).toBe(0);
  });

  it('prepares an empty two-expert review record without inventing an expert answer', () => {
    expect(createPendingExpertReview('solar-general-001')).toEqual({
      fixtureId: 'solar-general-001',
      expertA: null,
      expertB: null,
      strengthAssessment: null,
      usefulElement: null,
      favorableElements: [],
      cautiousElements: [],
      reasoning: '',
      agreementStatus: 'pending',
      disagreementNotes: '',
      interpretationPolicyVersion: 'pending-expert-policy'
    });
  });
});
