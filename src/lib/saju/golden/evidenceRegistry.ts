import hkoEvidence from './evidence/hko-calendar.json';
import ianaEvidence from './evidence/iana-timezone.json';
import solarTermEvidence from './evidence/solar-terms-2024.json';
import timeDayunEvidence from './evidence/time-dayun-6tail-1.7.7.json';
import type {
  GoldenExpectedFacts,
  GoldenFactField,
  GoldenFactProvenance,
  GoldenFieldVerificationStatus,
  GoldenFixture,
  GoldenFixtureCategory
} from './schema';
import { deriveGoldenFixtureStatus, hasIndependentProvenance } from './schema';
import {
  auditBranches,
  auditStems,
  independentHourBranchByClockHour,
  independentHourStemTable,
  koreanGanzhi
} from './independentTimeDayunTables';

const FIELD_TARGETS: Record<GoldenFixtureCategory, GoldenFactField[]> = {
  'solar-general': ['normalizedSolarDate', 'normalizedLunarDate', 'leapMonth', 'yearPillar', 'monthPillar', 'dayPillar', 'hourPillar', 'dayMaster', 'dayunDirection', 'dayunStartsAt', 'firstDayun'],
  'lunar-regular': ['normalizedSolarDate', 'normalizedLunarDate', 'leapMonth', 'yearPillar', 'monthPillar', 'dayPillar', 'hourPillar', 'dayMaster', 'dayunDirection', 'dayunStartsAt', 'firstDayun'],
  'lunar-leap': ['normalizedSolarDate', 'normalizedLunarDate', 'leapMonth', 'yearPillar', 'monthPillar', 'dayPillar', 'hourPillar', 'dayMaster', 'dayunDirection', 'dayunStartsAt', 'firstDayun'],
  'solar-term-boundary': ['solarTermBoundaryInstant', 'boundaryRelativeMinutes', 'yearPillar', 'monthPillar'],
  'day-boundary': ['dayPillar', 'hourPillar'],
  'time-uncertainty': ['yearPillar', 'monthPillar', 'dayPillar', 'hourPillar'],
  'timezone-solar-time': ['utcOffsetMinutes', 'normalizedInstant', 'yearPillar', 'monthPillar', 'dayPillar', 'hourPillar'],
  'dayun-boundary': ['yearPillar', 'monthPillar', 'dayPillar', 'hourPillar', 'dayunDirection', 'dayunStartsAt', 'firstDayun']
};

function provenance(
  sourceId: string,
  sourceName: string,
  sourceReference: string,
  notes: string
): GoldenFactProvenance {
  return {
    sourceId,
    sourceTier: 'A',
    sourceType: 'independent-standard-table',
    sourceName,
    sourceReference,
    checkedAt: '2026-09-02',
    checkedBy: 'Codex independent evidence collector',
    notes,
    confidence: 'high'
  };
}

function providerProvenance(notes: string): GoldenFactProvenance {
  return {
    sourceId: '6tail-lunar-javascript-1.7.7',
    sourceTier: 'B',
    sourceType: 'approved-independent-manse',
    sourceName: '6tail lunar-javascript',
    sourceReference: 'https://github.com/6tail/lunar-javascript/tree/1.7.7 | npm integrity snapshot',
    checkedAt: '2026-09-02',
    checkedBy: 'Codex independent provider audit',
    notes,
    confidence: 'high'
  };
}

function hourTableProvenance(notes: string): GoldenFactProvenance {
  return {
    sourceId: 'five-rat-hour-table',
    sourceTier: 'C',
    sourceType: 'independent-standard-table',
    sourceName: '五鼠遁 10×12 hour-stem table',
    sourceReference: 'https://zh.wikisource.org/wiki/易學象數論/六壬透易 | 6tail 1.7.7 cross-check',
    checkedAt: '2026-09-02',
    checkedBy: 'Codex independent table audit',
    notes,
    confidence: 'high'
  };
}

function independentHourPillar(dayPillar: string, birthTime: string) {
  const dayStemIndex = auditStems.indexOf(dayPillar.slice(0, 1) as (typeof auditStems)[number]);
  const hour = Number(birthTime.slice(0, 2));
  const hourBranch = independentHourBranchByClockHour[hour];
  const hourBranchIndex = auditBranches.indexOf(hourBranch);
  if (dayStemIndex < 0 || hourBranchIndex < 0) throw new Error('독립 시주 표 입력을 해석할 수 없습니다.');
  return `${independentHourStemTable[dayStemIndex][hourBranchIndex]}${hourBranch}`;
}

function minutesFromOfficialBoundary(fixture: GoldenFixture, officialLocalInstant: string) {
  if (!fixture.input.birthTime) return undefined;
  const inputInstant = new Date(`${fixture.input.birthDate}T${fixture.input.birthTime}:00+09:00`);
  return Math.round((inputInstant.getTime() - new Date(officialLocalInstant).getTime()) / 60_000);
}

export function applyIndependentEvidence(fixtures: GoldenFixture[]): GoldenFixture[] {
  const hkoByFixture = new Map(hkoEvidence.entries.map((entry) => [entry.fixtureId, entry]));
  const ianaByFixture = new Map(ianaEvidence.entries.map((entry) => [entry.fixtureId, entry]));
  const termByName = new Map(solarTermEvidence.entries.map((entry) => [entry.term, entry]));
  const lateZiByKey = new Map(timeDayunEvidence.lateZi.map((entry) => [
    `${entry.date}|${entry.time}|${entry.policy}`,
    entry
  ]));
  const dayunByFixture = new Map(timeDayunEvidence.dayun.map((entry) => [entry.fixtureId, entry]));

  return fixtures.map((fixture) => {
    const targetFields = [...FIELD_TARGETS[fixture.category]];
    const expected: GoldenExpectedFacts = { ...fixture.expected };
    const provenanceByField = { ...fixture.provenance };
    const fieldVerification: Partial<Record<GoldenFactField, GoldenFieldVerificationStatus>> = {};
    for (const field of targetFields) fieldVerification[field] = 'pending';

    for (const field of Object.keys(expected) as GoldenFactField[]) {
      const source = provenanceByField[field];
      if (source?.sourceType === 'KASI') {
        provenanceByField[field] = { ...source, sourceId: 'kasi-lunar-api-v1.1', sourceTier: 'A' };
        fieldVerification[field] = 'verified';
      }
    }

    if (expected.dayMaster && fieldVerification.dayPillar === 'verified') {
      provenanceByField.dayMaster = {
        sourceId: 'sexagenary-day-stem-definition',
        sourceTier: 'C',
        sourceType: 'independent-standard-table',
        sourceName: '60갑자 일주 천간 정의',
        sourceReference: 'dayMaster = verified dayPillar heavenly stem',
        checkedAt: '2026-09-02',
        checkedBy: 'Codex deterministic mapping review',
        notes: '검증된 일주의 첫 글자를 일간으로 사용한다.',
        confidence: 'high'
      };
      fieldVerification.dayMaster = 'verified';
    }

    const hko = hkoByFixture.get(fixture.id);
    if (hko?.status === 'verified-source-record' && 'solarDate' in hko && 'lunarDate' in hko) {
      expected.normalizedSolarDate = hko.solarDate;
      expected.normalizedLunarDate = hko.lunarDate;
      expected.leapMonth = hko.leapMonth;
      for (const field of ['normalizedSolarDate', 'normalizedLunarDate', 'leapMonth'] as const) {
        provenanceByField[field] = provenance(
          'hko-gregorian-lunar-calendar',
          'Hong Kong Observatory Gregorian-Lunar Calendar',
          `${hko.sourceId || 'hko-calendar'} sha256:${hko.sourceSha256}`,
          '공식 연간 변환표의 날짜와 윤달 표기를 확인했다.'
        );
        fieldVerification[field] = 'verified';
      }
    } else if (hko?.status === 'source-data-not-found') {
      provenanceByField.normalizedSolarDate = provenance(
        'hko-gregorian-lunar-calendar',
        'Hong Kong Observatory Gregorian-Lunar Calendar',
        `${hko.sourceId || 'hko-calendar'} sha256:${hko.sourceSha256}`,
        ('notes' in hko && typeof hko.notes === 'string')
          ? hko.notes
          : '공식 연간 변환표에서 요청한 윤달 날짜를 찾지 못했다.'
      );
      fieldVerification.normalizedSolarDate = 'conflicting';
    }

    const iana = ianaByFixture.get(fixture.id);
    if (iana) {
      expected.utcOffsetMinutes = iana.observedUtcOffsetMinutes;
      expected.normalizedInstant = new Date(iana.normalizedInstant).toISOString();
      for (const field of ['utcOffsetMinutes', 'normalizedInstant'] as const) {
        provenanceByField[field] = provenance(
          'iana-tzdb-2026b',
          'IANA Time Zone Database via Node.js Intl',
          `${ianaEvidence.sourceUrl} | tzdb ${ianaEvidence.tzdbVersion} / ICU ${ianaEvidence.icuVersion}`,
          '현지시각 round-trip과 출생 당시 UTC offset을 확인했다. 진태양시는 제외한다.'
        );
        fieldVerification[field] = 'verified';
      }
    }

    if (fixture.category === 'day-boundary' && fixture.input.birthTime) {
      const evidence = lateZiByKey.get(
        `${fixture.input.birthDate}|${fixture.input.birthTime}|${fixture.input.lateZiPolicy}`
      );
      if (evidence) {
        expected.dayPillar = koreanGanzhi(evidence.dayPillar);
        expected.hourPillar = independentHourPillar(expected.dayPillar, fixture.input.birthTime);
        provenanceByField.dayPillar = providerProvenance(
          `${fixture.input.lateZiPolicy}의 ${fixture.input.birthTime} 일주를 provider sect 정책으로 확인했다.`
        );
        provenanceByField.hourPillar = hourTableProvenance(
          '검증된 정책별 일간과 독립 시지·五鼠遁 표를 결합했다. provider의 23시 시간 천간 차이는 policy difference로 별도 보존한다.'
        );
        fieldVerification.dayPillar = 'verified';
        fieldVerification.hourPillar = 'verified';
      }
    }

    if (fixture.category === 'dayun-boundary' && fixture.input.birthTime) {
      const evidence = dayunByFixture.get(fixture.id);
      if (evidence) {
        const local = evidence.localCivilPillars;
        expected.yearPillar = koreanGanzhi(local.year);
        expected.monthPillar = koreanGanzhi(local.month);
        expected.dayPillar = koreanGanzhi(local.day);
        expected.hourPillar = independentHourPillar(expected.dayPillar, fixture.input.birthTime);
        expected.dayunDirection = evidence.direction as 'forward' | 'reverse';
        expected.firstDayun = koreanGanzhi(evidence.firstDayun);
        for (const field of ['yearPillar', 'monthPillar', 'dayPillar', 'dayunDirection', 'firstDayun'] as const) {
          provenanceByField[field] = providerProvenance(
            '동일 현지 명식과 KST 물리시각을 CST로 정규화한 대운 sect 2 결과를 분리 확인했다.'
          );
          fieldVerification[field] = 'verified';
        }
        provenanceByField.hourPillar = hourTableProvenance(
          '현지 민간시 일간과 독립 시지·五鼠遁 표를 결합했다.'
        );
        fieldVerification.hourPillar = 'verified';
        // startsAt remains pending: current continuous tropical-year conversion
        // and the provider's calendar-component conversion are distinct policies.
      }
    }

    if (fixture.category === 'solar-term-boundary' && fixture.boundaryReference) {
      const term = termByName.get(fixture.boundaryReference.label);
      if (term) {
        const relativeMinutes = minutesFromOfficialBoundary(fixture, term.localInstant);
        expected.solarTermBoundaryInstant = new Date(term.localInstant).toISOString();
        if (relativeMinutes !== undefined) expected.boundaryRelativeMinutes = relativeMinutes;
        const termSource = provenance(
          'naoj-reki-yoko-2024',
          'National Astronomical Observatory of Japan 2024 solar terms',
          solarTermEvidence.sourceUrl,
          `${term.term} ${term.localInstant} (JST/KST UTC+09:00) 원자료를 사용했다.`
        );
        provenanceByField.solarTermBoundaryInstant = termSource;
        provenanceByField.boundaryRelativeMinutes = termSource;
        fieldVerification.solarTermBoundaryInstant = 'verified';
        fieldVerification.boundaryRelativeMinutes = Math.abs(relativeMinutes ?? 0) === 1 ? 'verified' : 'conflicting';
      }
    }

    for (const field of targetFields) {
      if (fieldVerification[field] === 'verified' && !hasIndependentProvenance(provenanceByField[field])) {
        fieldVerification[field] = 'pending';
      }
    }

    return {
      ...fixture,
      expected,
      provenance: provenanceByField,
      targetFields,
      fieldVerification,
      verificationStatus: deriveGoldenFixtureStatus(targetFields, fieldVerification)
    };
  });
}
