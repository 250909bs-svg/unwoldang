import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../../../api/mockData';
import { buildDeterministicSajuBasis } from '../../deterministicBasis';
import { buildSajuReport } from '../../reportBuilder';
import { digestSajuFactsValue, parseSajuFactsV1 } from '.';

const AS_OF = '2026-07-22T03:00:00.000Z';

function intake(overrides: Partial<IntakeFormData> = {}): Partial<IntakeFormData> {
  return {
    name: 'PII-NAME-MUST-NOT-LEAK',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '09:36',
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    dayBoundaryPolicy: 'midnight',
    location: 'PII-LOCATION-MUST-NOT-LEAK',
    q1: 'PII-QUESTION-ONE-MUST-NOT-LEAK',
    q2: 'PII-QUESTION-TWO-MUST-NOT-LEAK',
    ...overrides
  };
}

function build(overrides: Partial<IntakeFormData> = {}) {
  return buildDeterministicSajuBasis(
    'general-signature',
    intake(overrides),
    undefined,
    { asOf: AS_OF }
  );
}

type UnknownRecord = Record<string, unknown>;

function resignMalformedFacts(
  mutate: (facts: UnknownRecord) => void,
  source: ReturnType<typeof build>['facts'] = build().facts
) {
  const facts = JSON.parse(JSON.stringify(source)) as ReturnType<typeof build>['facts'];
  mutate(facts as unknown as UnknownRecord);
  const { digests: originalDigests, ...body } = facts;
  facts.digests = {
    algorithm: originalDigests.algorithm,
    input: digestSajuFactsValue({
      schemaVersion: facts.schemaVersion,
      engineVersions: facts.engineVersions,
      asOf: facts.asOf,
      input: facts.input
    }),
    facts: digestSajuFactsValue(body)
  };
  return facts;
}

describe('saju-facts-v1', () => {
  it('round-trips through JSON and rejects unknown schema versions', () => {
    const facts = build().facts;
    expect(parseSajuFactsV1(JSON.parse(JSON.stringify(facts)))).toEqual(facts);
    expect(() => parseSajuFactsV1({ ...facts, schemaVersion: 'saju-facts-v999' }))
      .toThrow(/지원하지 않는 사주 facts 버전/);
  });

  it('rejects malformed nested structures even when their digests are recomputed', () => {
    const mutations: Array<[string, (facts: UnknownRecord) => void]> = [
      ['input time', (facts) => {
        const input = facts.input as UnknownRecord;
        const time = input.time as UnknownRecord;
        time.precision = 'invented';
      }],
      ['natal invariant pillars', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const invariantPillars = natal.invariantPillars as UnknownRecord;
        invariantPillars.year = 'yes';
      }],
      ['natal scenario trace', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const scenario = (natal.scenarios as UnknownRecord[])[0];
        const trace = scenario.trace as UnknownRecord;
        delete trace.dayBoundary;
      }],
      ['dayun current', (facts) => {
        const dayun = facts.dayun as UnknownRecord;
        const current = dayun.current as UnknownRecord;
        current.currentIndex = '0';
      }],
      ['dayun rows', (facts) => {
        const dayun = facts.dayun as UnknownRecord;
        const representative = dayun.representative as UnknownRecord[];
        representative[0].luckStrength = 'strong';
      }],
      ['current flow clock', (facts) => {
        const currentFlow = facts.currentFlow as UnknownRecord;
        const referenceClock = currentFlow.referenceClock as UnknownRecord;
        referenceClock.minute = 60;
      }],
      ['release audit', (facts) => {
        const release = facts.release as UnknownRecord;
        const audit = release.audit as UnknownRecord;
        const externalCalendar = audit.externalCalendar as UnknownRecord;
        externalCalendar.provider = 'OTHER';
      }]
    ];

    for (const [label, mutate] of mutations) {
      expect(
        () => parseSajuFactsV1(resignMalformedFacts(mutate)),
        label
      ).toThrow(/saju-facts-v1 검증 실패/);
    }
  });

  it('rejects semantic state contradictions even when their digests are recomputed', () => {
    const mutations: Array<[string, (facts: UnknownRecord) => void]> = [
      ['stable natal without a selected chart', (facts) => {
        const natal = facts.natal as UnknownRecord;
        natal.selected = null;
      }],
      ['ambiguous natal with a primary selection', (facts) => {
        const natal = facts.natal as UnknownRecord;
        natal.status = 'ambiguous';
        natal.selected = null;
      }],
      ['degraded natal with exact primary facts', (facts) => {
        const natal = facts.natal as UnknownRecord;
        natal.status = 'degraded';
      }],
      ['incorrect invariant pillar flag', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const invariantPillars = natal.invariantPillars as UnknownRecord;
        invariantPillars.day = !invariantPillars.day;
      }],
      ['dayun status inconsistent with exact stable natal', (facts) => {
        const dayun = facts.dayun as UnknownRecord;
        dayun.status = 'scenario-dependent';
      }],
      ['stable dayun without a representative', (facts) => {
        const dayun = facts.dayun as UnknownRecord;
        dayun.representativeKind = 'none';
        dayun.representative = null;
        dayun.current = null;
      }],
      ['dayun representative without current state', (facts) => {
        const dayun = facts.dayun as UnknownRecord;
        dayun.current = null;
      }],
      ['dayun scenarios missing a natal scenario', (facts) => {
        const dayun = facts.dayun as UnknownRecord;
        (dayun.scenarios as UnknownRecord[]).pop();
      }]
    ];

    for (const [label, mutate] of mutations) {
      expect(
        () => parseSajuFactsV1(resignMalformedFacts(mutate)),
        label
      ).toThrow(/saju-facts-v1 검증 실패/);
    }
  });

  it('binds every selected mode to its canonical scenario bazi after resigning', () => {
    const selectedFixtures: Array<[
      string,
      ReturnType<typeof build>['facts'],
      string
    ]> = [
      ['primary', build().facts, 'primary'],
      [
        'range-midpoint',
        build({
          birthTime: '09:30-10:29',
          birthTimePrecision: 'branch-range'
        }).facts,
        'range-midpoint'
      ],
      [
        'stable-without-hour',
        build({
          birthTime: '',
          isUnknownTime: true,
          birthTimePrecision: 'unknown'
        }).facts,
        'stable-without-hour'
      ]
    ];

    for (const [label, source, expectedSelection] of selectedFixtures) {
      expect(source.natal.selection, label).toBe(expectedSelection);
      const facts = resignMalformedFacts((value) => {
        const natal = value.natal as UnknownRecord;
        const selected = natal.selected as UnknownRecord;
        const day = selected.d_gz as UnknownRecord;
        day.tg = ((day.tg as number) + 1) % 10;
      }, source);
      expect(() => parseSajuFactsV1(facts), label).toThrow(/saju-facts-v1 검증 실패/);
    }

    const unstableSource = build({
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown',
      dayBoundaryPolicy: 'late-zi'
    }).facts;
    expect(unstableSource.natal.selection).toBe('unstable-day');
    const unstableFacts = resignMalformedFacts((value) => {
      const natal = value.natal as UnknownRecord;
      const firstScenario = (natal.scenarios as UnknownRecord[])[0];
      natal.selected = firstScenario.bazi;
    }, unstableSource);
    expect(() => parseSajuFactsV1(unstableFacts)).toThrow(/saju-facts-v1 검증 실패/);
  });

  it('binds scenario traces to the canonical input after resigning', () => {
    const mutations: Array<[string, (facts: UnknownRecord) => void]> = [
      ['input date', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const trace = ((natal.scenarios as UnknownRecord[])[0].trace) as UnknownRecord;
        const inputDate = trace.inputDate as UnknownRecord;
        inputDate.day = (inputDate.day as number) - 1;
      }],
      ['timezone id', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const trace = ((natal.scenarios as UnknownRecord[])[0].trace) as UnknownRecord;
        const timezone = trace.timezone as UnknownRecord;
        timezone.id = 'Etc/UTC';
      }],
      ['timezone offset', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const trace = ((natal.scenarios as UnknownRecord[])[0].trace) as UnknownRecord;
        const timezone = trace.timezone as UnknownRecord;
        timezone.utcOffsetMinutes = 539.5;
      }],
      ['day-boundary policy', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const trace = ((natal.scenarios as UnknownRecord[])[0].trace) as UnknownRecord;
        const dayBoundary = trace.dayBoundary as UnknownRecord;
        dayBoundary.policy = 'late-zi-next-day';
      }],
      ['true-solar request', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const trace = ((natal.scenarios as UnknownRecord[])[0].trace) as UnknownRecord;
        const solarTimeCorrection = trace.solarTimeCorrection as UnknownRecord;
        solarTimeCorrection.requested = !solarTimeCorrection.requested;
      }],
      ['scenario source precision', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const scenario = (natal.scenarios as UnknownRecord[])[0].scenario as UnknownRecord;
        scenario.sourcePrecision = 'legacy-range';
      }]
    ];

    for (const [label, mutate] of mutations) {
      expect(
        () => parseSajuFactsV1(resignMalformedFacts(mutate)),
        label
      ).toThrow(/saju-facts-v1 검증 실패/);
    }
  });

  it('rejects non-canonical exact, legacy-range, and unknown scenarios after resigning', () => {
    const exactMutations: Array<[string, (facts: UnknownRecord) => void]> = [
      ['exact branch index', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const scenario = (natal.scenarios as UnknownRecord[])[0].scenario as UnknownRecord;
        scenario.branchIndex = ((scenario.branchIndex as number) + 1) % 12;
      }],
      ['exact source day offset', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const scenario = (natal.scenarios as UnknownRecord[])[0].scenario as UnknownRecord;
        scenario.sourceDayOffset = 1;
      }],
      ['exact clock and matching trace clock', (facts) => {
        const natal = facts.natal as UnknownRecord;
        const scenarioFacts = (natal.scenarios as UnknownRecord[])[0];
        const scenario = scenarioFacts.scenario as UnknownRecord;
        const trace = scenarioFacts.trace as UnknownRecord;
        const inputCivilDateTime = trace.inputCivilDateTime as UnknownRecord;
        const solarTimeCorrection = trace.solarTimeCorrection as UnknownRecord;
        const correctionInput = solarTimeCorrection.inputCivilDateTime as UnknownRecord;
        scenario.hour = 10;
        scenario.minute = 37;
        inputCivilDateTime.hour = 10;
        inputCivilDateTime.minute = 37;
        correctionInput.hour = 10;
        correctionInput.minute = 37;
      }]
    ];

    for (const [label, mutate] of exactMutations) {
      expect(
        () => parseSajuFactsV1(resignMalformedFacts(mutate)),
        label
      ).toThrow(/saju-facts-v1 검증 실패/);
    }

    const legacySource = build({
      birthTime: '09:30-11:29',
      birthTimePrecision: 'branch-range'
    }).facts;
    expect(legacySource.natal.scenarios.map(({ scenario }) => scenario.id)).toEqual([
      'legacy-range-midpoint',
      'legacy-range-start',
      'legacy-range-end'
    ]);
    const legacyIdFacts = resignMalformedFacts((facts) => {
      const natal = facts.natal as UnknownRecord;
      const scenarioFacts = (natal.scenarios as UnknownRecord[])[1];
      const scenario = scenarioFacts.scenario as UnknownRecord;
      const trace = scenarioFacts.trace as UnknownRecord;
      const dayun = facts.dayun as UnknownRecord;
      const dayunScenario = (dayun.scenarios as UnknownRecord[])[1];
      scenario.id = 'legacy-range-start-mutated';
      trace.scenarioId = 'legacy-range-start-mutated';
      dayunScenario.scenarioId = 'legacy-range-start-mutated';
    }, legacySource);
    expect(() => parseSajuFactsV1(legacyIdFacts), 'legacy endpoint id')
      .toThrow(/saju-facts-v1 검증 실패/);

    const legacyClockFacts = resignMalformedFacts((facts) => {
      const natal = facts.natal as UnknownRecord;
      const scenarioFacts = (natal.scenarios as UnknownRecord[])[1];
      const scenario = scenarioFacts.scenario as UnknownRecord;
      const trace = scenarioFacts.trace as UnknownRecord;
      const inputCivilDateTime = trace.inputCivilDateTime as UnknownRecord;
      const solarTimeCorrection = trace.solarTimeCorrection as UnknownRecord;
      const correctionInput = solarTimeCorrection.inputCivilDateTime as UnknownRecord;
      scenario.hour = 8;
      scenario.branchIndex = 4;
      inputCivilDateTime.hour = 8;
      correctionInput.hour = 8;
    }, legacySource);
    expect(() => parseSajuFactsV1(legacyClockFacts), 'legacy endpoint clock')
      .toThrow(/saju-facts-v1 검증 실패/);

    const unknownSource = build({
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown'
    }).facts;
    const unknownFacts = resignMalformedFacts((facts) => {
      const natal = facts.natal as UnknownRecord;
      const scenarioFacts = (natal.scenarios as UnknownRecord[])[1];
      const scenario = scenarioFacts.scenario as UnknownRecord;
      const trace = scenarioFacts.trace as UnknownRecord;
      const inputCivilDateTime = trace.inputCivilDateTime as UnknownRecord;
      const solarTimeCorrection = trace.solarTimeCorrection as UnknownRecord;
      const correctionInput = solarTimeCorrection.inputCivilDateTime as UnknownRecord;
      const dayun = facts.dayun as UnknownRecord;
      const dayunScenario = (dayun.scenarios as UnknownRecord[])[1];
      scenario.id = 'unknown-branch-2-3';
      scenario.branchIndex = 2;
      scenario.hour = 3;
      trace.scenarioId = 'unknown-branch-2-3';
      inputCivilDateTime.hour = 3;
      correctionInput.hour = 3;
      dayunScenario.scenarioId = 'unknown-branch-2-3';
    }, unknownSource);
    expect(() => parseSajuFactsV1(unknownFacts), 'unknown canonical scenario')
      .toThrow(/saju-facts-v1 검증 실패/);
  });

  it('accepts finite fractional timezone offsets throughout the calculation trace', () => {
    const facts = resignMalformedFacts((value) => {
      const input = value.input as UnknownRecord;
      const timezone = input.timezone as UnknownRecord;
      timezone.utcOffsetMinutes = 330.5;

      const natal = value.natal as UnknownRecord;
      for (const scenario of natal.scenarios as UnknownRecord[]) {
        const trace = scenario.trace as UnknownRecord;
        const traceTimezone = trace.timezone as UnknownRecord;
        traceTimezone.utcOffsetMinutes = 330.5;
      }
    });

    const parsed = parseSajuFactsV1(JSON.parse(JSON.stringify(facts)));
    expect(parsed.input.timezone.utcOffsetMinutes).toBe(330.5);
    expect(parsed.natal.scenarios.every(
      ({ trace }) => trace.timezone.utcOffsetMinutes === 330.5
    )).toBe(true);
  });

  it.each([-840.1, 840.1])(
    'rejects an out-of-contract timezone offset %s after resigning',
    (utcOffsetMinutes) => {
      const facts = resignMalformedFacts((value) => {
        const input = value.input as UnknownRecord;
        const timezone = input.timezone as UnknownRecord;
        timezone.utcOffsetMinutes = utcOffsetMinutes;
      });
      expect(() => parseSajuFactsV1(facts)).toThrow(/saju-facts-v1 검증 실패/);
    }
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects a non-finite timezone offset %s before digest verification',
    (utcOffsetMinutes) => {
      const facts = JSON.parse(JSON.stringify(build().facts)) as UnknownRecord;
      const input = facts.input as UnknownRecord;
      const timezone = input.timezone as UnknownRecord;
      timezone.utcOffsetMinutes = utcOffsetMinutes;

      expect(() => parseSajuFactsV1(facts)).toThrow(/saju-facts-v1 검증 실패/);
    }
  );

  it('is deterministic for the same canonical input and fixed asOf', () => {
    const first = build();
    const second = build();
    expect(second.facts).toEqual(first.facts);
    expect(first.facts.currentFlow.asOf).toBe(AS_OF);
    expect(buildSajuReport('general-signature', intake(), first).createdAt).toBe(AS_OF);
  });

  it('changes the input digest when a calculation policy changes', () => {
    const midnight = build({ dayBoundaryPolicy: 'midnight' }).facts;
    const lateZi = build({ dayBoundaryPolicy: 'late-zi' }).facts;
    expect(lateZi.digests.input).not.toBe(midnight.digests.input);
    expect(lateZi.input.policies.dayBoundary).toBe('late-zi-next-day');
  });

  it('excludes names, free-text locations, and questions', () => {
    const serialized = JSON.stringify(build().facts);
    expect(serialized).not.toContain('PII-NAME-MUST-NOT-LEAK');
    expect(serialized).not.toContain('PII-LOCATION-MUST-NOT-LEAK');
    expect(serialized).not.toContain('PII-QUESTION-ONE-MUST-NOT-LEAK');
    expect(serialized).not.toContain('PII-QUESTION-TWO-MUST-NOT-LEAK');
  });

  it('retains all unknown-time traces without inventing a representative dayun', () => {
    const facts = build({
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown'
    }).facts;
    expect(parseSajuFactsV1(JSON.parse(JSON.stringify(facts)))).toEqual(facts);
    expect(facts.natal.status).toBe('degraded');
    expect(facts.natal.scenarios).toHaveLength(13);
    expect(facts.natal.scenarios.every(({ trace }) => Boolean(trace.dayBoundary))).toBe(true);
    expect(facts.dayun.status).toBe('scenario-dependent');
    expect(facts.dayun.representative).toBeNull();
    expect(facts.dayun.current).toBeNull();
    expect(facts.dayun.scenarios).toHaveLength(13);
  });

  it('marks a late-zi unknown-time chart as ambiguous', () => {
    const facts = build({
      birthTime: '',
      isUnknownTime: true,
      birthTimePrecision: 'unknown',
      dayBoundaryPolicy: 'late-zi'
    }).facts;
    expect(parseSajuFactsV1(JSON.parse(JSON.stringify(facts)))).toEqual(facts);
    expect(facts.natal.status).toBe('ambiguous');
    expect(facts.natal.selected).toBeNull();
    expect(facts.dayun.status).toBe('unavailable');
  });

  it.each([
    [
      'legacy time range',
      {
        birthTime: '09:30-11:29',
        birthTimePrecision: 'branch-range'
      }
    ],
    [
      'lunar leap month',
      {
        calendar: 'lunar',
        birthDate: '2023-02-01',
        birthTime: '12:00',
        isLeapMonth: true
      }
    ],
    [
      'late-zi exact boundary',
      {
        birthDate: '2024-06-21',
        birthTime: '23:30',
        dayBoundaryPolicy: 'late-zi'
      }
    ]
  ] satisfies Array<[string, Partial<IntakeFormData>]>)('accepts valid %s facts', (_label, overrides) => {
    const facts = build(overrides).facts;
    expect(parseSajuFactsV1(JSON.parse(JSON.stringify(facts)))).toEqual(facts);
  });
});
