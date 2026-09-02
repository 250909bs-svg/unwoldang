import { describe, expect, it } from 'vitest';
import hkoEvidence from './evidence/hko-calendar.json';
import ianaEvidence from './evidence/iana-timezone.json';
import solarTermEvidence from './evidence/solar-terms-2024.json';
import { generalSignatureGoldenFixtures } from './fixtures';
import { goldenSourceManifest, independentProviderCandidates } from './sourceManifest';

describe('general signature independent evidence snapshots', () => {
  it('stores minimal HKO evidence for every valid lunar fixture', () => {
    expect(hkoEvidence.entries).toHaveLength(70);
    expect(hkoEvidence.entries.filter((entry) => entry.status === 'verified-source-record')).toHaveLength(70);
    expect(hkoEvidence.entries.filter((entry) => entry.status === 'source-data-not-found')).toHaveLength(0);
    expect(JSON.stringify(hkoEvidence)).not.toMatch(/serviceKey|api[_-]?key|credential|token/i);
  });

  it('verifies 16 civil timezone/DST records without claiming true-solar-time verification', () => {
    expect(ianaEvidence.tzdbVersion).toBe('2026b');
    expect(ianaEvidence.entries).toHaveLength(16);
    expect(ianaEvidence.entries.every((entry) => entry.localRoundTripMatch && entry.offsetMatch)).toBe(true);
    expect(ianaEvidence.limitations.join(' ')).toMatch(/does not verify apparent solar-time/i);
  });

  it('aligns the Hanro boundary fixture to the official NAOJ minute', () => {
    expect(solarTermEvidence.entries).toHaveLength(10);
    expect(solarTermEvidence.entries.find((entry) => entry.term === '한로')?.localInstant).toBe('2024-10-08T04:00:00+09:00');
    expect(
      generalSignatureGoldenFixtures
        .filter((fixture) => fixture.comparisonGroup === '2024-한로')
        .map((fixture) => fixture.verificationStatus)
    ).toEqual(['partial', 'partial']);
  });

  it('keeps approved independent manse providers at zero until policies and versions are reproducible', () => {
    expect(independentProviderCandidates.filter((provider) => provider.decision === 'approved')).toHaveLength(0);
    expect(independentProviderCandidates.some((provider) => provider.decision === 'rejected')).toBe(true);
    expect(goldenSourceManifest.filter((source) => source.tier === 'A').length).toBeGreaterThanOrEqual(5);
  });
});
