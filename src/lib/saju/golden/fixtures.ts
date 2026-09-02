import type {
  GoldenFactProvenance,
  GoldenFixture,
  GoldenFixtureCategory,
  GoldenFixtureInput,
  GoldenLocationInput
} from './schema';

const KASI_LUNAR_API = 'https://www.data.go.kr/data/15012679/openapi.do';
const KASI_LIVE_RECORD = 'docs/KASI_LOCAL_LIVE_VERIFICATION.md';
const HKO_SOLAR_TERMS = 'https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm';
const DATE_DB_1992 = 'https://datedb.net/tool/saju-worksheet/19920909/';
const MANSAENYANG_1992 = 'https://www.mansaenyang.com/saju/1992-09-09';
const INDEPENDENT_HOUR_TABLE_1992 =
  'https://calendar.8s8s.net/ganzhichaxun.php?d=9&m=9&y=1992';

const SEOUL: GoldenLocationInput = {
  label: '서울특별시',
  latitude: 37.5665,
  longitude: 126.978,
  utcOffsetMinutes: 540
};

const kasiLive = (notes: string): GoldenFactProvenance => ({
  sourceType: 'KASI',
  sourceName: '한국천문연구원 음양력 정보 API 로컬 실연동 검증',
  sourceReference: `${KASI_LUNAR_API} | ${KASI_LIVE_RECORD}`,
  checkedAt: '2026-08-25',
  checkedBy: '운월당 RC KASI smoke test',
  notes,
  confidence: 'high'
});

const independent1992 = (notes: string): GoldenFactProvenance => ({
  sourceType: 'independent-standard-table',
  sourceName: '독립 만세력/간지표 교차 확인',
  sourceReference: `${DATE_DB_1992} | ${MANSAENYANG_1992} | ${INDEPENDENT_HOUR_TABLE_1992}`,
  checkedAt: '2026-09-02',
  checkedBy: 'Codex independent-source review',
  notes,
  confidence: 'medium'
});

function input(
  overrides: Partial<GoldenFixtureInput> & Pick<GoldenFixtureInput, 'birthDate'>
): GoldenFixtureInput {
  return {
    calendarType: 'solar',
    birthTime: '12:00',
    birthTimePrecision: 'exact',
    gender: 'female',
    leapMonth: false,
    timezone: 'Asia/Seoul',
    location: { ...SEOUL },
    trueSolarTimePolicy: 'disabled',
    lateZiPolicy: 'civil-midnight',
    ...overrides
  };
}

function pendingFixture(
  id: string,
  category: GoldenFixtureCategory,
  description: string,
  fixtureInput: GoldenFixtureInput,
  extra: Partial<GoldenFixture> = {}
): GoldenFixture {
  return {
    id,
    category,
    description,
    input: fixtureInput,
    expected: {},
    provenance: {},
    verificationStatus: 'pending',
    ...extra
  };
}

const representativeFixture: GoldenFixture = {
  id: 'solar-general-001',
  category: 'solar-general',
  description: '대표 남성 양력 명식: 1992-09-09 10:24 KST',
  input: input({
    birthDate: '1992-09-09',
    birthTime: '10:24',
    gender: 'male'
  }),
  expected: {
    normalizedSolarDate: '1992-09-09',
    leapMonth: false,
    yearPillar: '임신',
    monthPillar: '기유',
    dayPillar: '무자',
    hourPillar: '정사',
    dayMaster: '무'
  },
  provenance: {
    normalizedSolarDate: kasiLive('양력 1992-09-09와 음력 평달 1992-08-13의 대응을 실 API로 확인했다.'),
    leapMonth: kasiLive('KASI 응답의 평달 표기를 확인했다.'),
    yearPillar: kasiLive('KASI lunSecha 응답에서 임신(壬申)을 확인했다.'),
    monthPillar: kasiLive('KASI lunWolgeon 응답에서 기유(己酉)를 확인했다.'),
    dayPillar: kasiLive('KASI lunIljin 응답에서 무자(戊子)를 확인했다.'),
    hourPillar: independent1992('10:24가 사시이며 무자일의 사시는 정사임을 두 독립 표에서 교차 확인했다.'),
    dayMaster: independent1992('독립 자료의 무자 일주에서 천간 戊를 일간으로 확인했다.')
  },
  verificationStatus: 'verified'
};

const solarSeeds: Array<[string, string, 'male' | 'female']> = [
  ['1960-01-01', '00:30', 'male'], ['1964-02-29', '06:15', 'female'],
  ['1968-07-20', '21:40', 'male'], ['1970-12-31', '23:20', 'female'],
  ['1972-02-29', '14:05', 'male'], ['1975-05-18', '03:12', 'female'],
  ['1977-11-07', '17:45', 'male'], ['1980-02-29', '09:00', 'female'],
  ['1981-08-15', '11:11', 'male'], ['1983-10-03', '19:20', 'female'],
  ['1984-04-04', '04:44', 'male'], ['1985-12-25', '22:10', 'female'],
  ['1987-06-10', '13:35', 'male'], ['1988-02-29', '18:25', 'female'],
  ['1989-09-30', '07:50', 'male'], ['1990-01-01', '12:30', 'female'],
  ['1991-03-21', '05:05', 'male'], ['1993-11-19', '16:40', 'female'],
  ['1994-07-07', '20:20', 'male'], ['1995-05-05', '08:08', 'female'],
  ['1996-02-29', '15:55', 'male'], ['1997-08-08', '01:25', 'female'],
  ['1998-12-12', '10:10', 'male'], ['1999-09-09', '09:09', 'female'],
  ['2000-02-29', '23:40', 'male'], ['2001-01-15', '02:15', 'female'],
  ['2002-06-21', '12:05', 'male'], ['2003-10-10', '18:30', 'female'],
  ['2004-02-29', '07:07', 'male'], ['2005-05-31', '14:45', 'female'],
  ['2006-09-17', '21:15', 'male'], ['2007-12-01', '00:05', 'female'],
  ['2008-02-29', '11:59', 'male'], ['2010-04-14', '06:35', 'female'],
  ['2012-02-29', '17:10', 'male'], ['2015-08-23', '03:33', 'female'],
  ['2016-02-29', '20:50', 'male'], ['2020-02-29', '10:30', 'female'],
  ['2024-02-29', '22:22', 'male']
];

const solarGeneralFixtures: GoldenFixture[] = [
  representativeFixture,
  ...solarSeeds.map(([birthDate, birthTime, gender], index) =>
    pendingFixture(
      `solar-general-${String(index + 2).padStart(3, '0')}`,
      'solar-general',
      `일반 양력 분산 표본 ${index + 2}`,
      input({ birthDate, birthTime, gender })
    )
  )
];

const lunarRegularSeeds: Array<[string, string, 'male' | 'female']> = [
  ['1992-08-13', '10:24', 'male'], ['1965-01-01', '09:10', 'female'],
  ['1970-03-15', '15:30', 'male'], ['1975-05-05', '05:40', 'female'],
  ['1980-07-07', '20:10', 'male'], ['1984-12-12', '11:20', 'female'],
  ['1988-01-15', '02:45', 'male'], ['1990-04-08', '18:05', 'female'],
  ['1994-06-06', '07:30', 'male'], ['1996-09-09', '13:15', 'female'],
  ['1999-11-11', '22:05', 'male'], ['2001-02-14', '04:30', 'female'],
  ['2004-08-15', '16:00', 'male'], ['2007-10-03', '08:50', 'female'],
  ['2010-01-10', '19:45', 'male'], ['2013-03-03', '12:12', 'female'],
  ['2016-05-15', '06:06', 'male'], ['2019-07-07', '21:21', 'female'],
  ['2022-09-09', '14:14', 'male'], ['2024-11-01', '00:40', 'female']
];

const lunarRegularFixtures = lunarRegularSeeds.map(([birthDate, birthTime, gender], index) => {
  const base = pendingFixture(
    `lunar-regular-${String(index + 1).padStart(3, '0')}`,
    'lunar-regular',
    `음력 평달 변환 표본 ${index + 1}`,
    input({ calendarType: 'lunar', birthDate, birthTime, gender })
  );

  if (index !== 0) return base;
  return {
    ...base,
    expected: { normalizedSolarDate: '1992-09-09', leapMonth: false },
    provenance: {
      normalizedSolarDate: kasiLive('음력 평달 1992-08-13을 양력 1992-09-09로 변환한 실 API smoke 결과다.'),
      leapMonth: kasiLive('동일 응답에서 평달을 확인했다.')
    },
    verificationStatus: 'partial' as const,
    reviewNotes: ['네 기둥과 대운 expected는 승인된 독립 만세력 검수 전이므로 비워 두었다.']
  };
});

const lunarLeapSeeds: Array<[string, string, 'male' | 'female']> = [
  ['2023-02-01', '09:36', 'female'], ['2020-04-01', '13:20', 'male'],
  ['2017-05-10', '18:05', 'female'], ['2014-09-05', '03:15', 'male'],
  ['2012-03-12', '22:40', 'female'], ['2009-05-08', '06:30', 'male'],
  ['2006-07-15', '15:45', 'female'], ['2004-02-14', '11:10', 'male'],
  ['2001-04-09', '20:25', 'female'], ['1998-05-03', '01:50', 'male']
];

const lunarLeapFixtures = lunarLeapSeeds.map(([birthDate, birthTime, gender], index) => {
  const base = pendingFixture(
    `lunar-leap-${String(index + 1).padStart(3, '0')}`,
    'lunar-leap',
    `음력 윤달 변환 표본 ${index + 1}`,
    input({ calendarType: 'lunar', leapMonth: true, birthDate, birthTime, gender })
  );

  if (index !== 0) return base;
  return {
    ...base,
    expected: { normalizedSolarDate: '2023-03-22', leapMonth: true },
    provenance: {
      normalizedSolarDate: kasiLive('윤2월 1일을 양력 2023-03-22로 변환한 실 API smoke 결과다.'),
      leapMonth: kasiLive('동일 응답에서 윤달을 확인했다.')
    },
    verificationStatus: 'partial' as const,
    reviewNotes: ['윤달 변환 외의 명식 expected는 독립 검수 전이므로 비워 두었다.']
  };
});

const solarTermPairs: Array<{
  name: string;
  instant: string;
  before: [string, string];
  after: [string, string];
}> = [
  { name: '입춘', instant: '2024-02-04T17:27:00+09:00', before: ['2024-02-04', '17:26'], after: ['2024-02-04', '17:28'] },
  { name: '경칩', instant: '2024-03-05T11:23:00+09:00', before: ['2024-03-05', '11:22'], after: ['2024-03-05', '11:24'] },
  { name: '청명', instant: '2024-04-04T16:02:00+09:00', before: ['2024-04-04', '16:01'], after: ['2024-04-04', '16:03'] },
  { name: '입하', instant: '2024-05-05T09:10:00+09:00', before: ['2024-05-05', '09:09'], after: ['2024-05-05', '09:11'] },
  { name: '망종', instant: '2024-06-05T13:10:00+09:00', before: ['2024-06-05', '13:09'], after: ['2024-06-05', '13:11'] },
  { name: '소서', instant: '2024-07-06T23:20:00+09:00', before: ['2024-07-06', '23:19'], after: ['2024-07-06', '23:21'] },
  { name: '입추', instant: '2024-08-07T09:09:00+09:00', before: ['2024-08-07', '09:08'], after: ['2024-08-07', '09:10'] },
  { name: '백로', instant: '2024-09-07T12:11:00+09:00', before: ['2024-09-07', '12:10'], after: ['2024-09-07', '12:12'] },
  { name: '한로', instant: '2024-10-08T03:00:00+09:00', before: ['2024-10-08', '02:59'], after: ['2024-10-08', '03:01'] },
  { name: '입동', instant: '2024-11-07T07:20:00+09:00', before: ['2024-11-07', '07:19'], after: ['2024-11-07', '07:21'] }
];

const solarTermBoundaryFixtures = solarTermPairs.flatMap((term, index) =>
  (['before', 'after'] as const).map((side, sideIndex) => {
    const [birthDate, birthTime] = term[side];
    const relativeMinutes = side === 'before' ? -1 : 1;
    return pendingFixture(
      `solar-term-${String(index * 2 + sideIndex + 1).padStart(3, '0')}`,
      'solar-term-boundary',
      `${term.name} 절입 ${side === 'before' ? '직전' : '직후'} 1분`,
      input({ birthDate, birthTime, gender: index % 2 === 0 ? 'male' : 'female' }),
      {
        comparisonGroup: `2024-${term.name}`,
        boundaryReference: {
          kind: 'solar-term',
          label: term.name,
          referenceInstant: term.instant,
          relativeMinutes,
          sourceReference: HKO_SOLAR_TERMS,
          status: 'pending-independent-confirmation'
        },
        reviewNotes: [
          'HKO 공개 시각(HKT)을 KST로 변환한 설계값이며, fixture verified 전 원자료 분 단위 재확인이 필요하다.',
          'KASI 특일 API는 절기 날짜만 교차 확인하며 분 단위 expected를 대신하지 않는다.'
        ]
      }
    );
  })
);

const dayBoundaryFixtures: GoldenFixture[] = [];
for (const [dateIndex, birthDate] of ['1992-09-09', '2024-01-01'].entries()) {
  for (const [policyIndex, policy] of (['civil-midnight', 'late-zi-next-day'] as const).entries()) {
    for (const [timeIndex, birthTime] of ['22:59', '23:00', '23:59', '00:00'].entries()) {
      const index = dateIndex * 8 + policyIndex * 4 + timeIndex + 1;
      dayBoundaryFixtures.push(pendingFixture(
        `day-boundary-${String(index).padStart(3, '0')}`,
        'day-boundary',
        `${birthDate} ${birthTime} / ${policy}`,
        input({
          birthDate,
          birthTime,
          gender: dateIndex === 0 ? 'male' : 'female',
          lateZiPolicy: policy
        }),
        {
          comparisonGroup: `${birthDate}-${policy}`,
          boundaryReference: {
            kind: policy === 'civil-midnight' ? 'civil-day' : 'late-zi',
            label: policy === 'civil-midnight' ? '00:00 민간시 경계' : '23:00 야자시 경계',
            status: 'pending-independent-confirmation'
          }
        }
      ));
    }
  }
}

const timeUncertaintyFixtures: GoldenFixture[] = [
  ['unknown-1992', input({ birthDate: '1992-09-09', birthTime: null, birthTimePrecision: 'unknown', gender: 'male' })],
  ['unknown-ipchun', input({ birthDate: '2024-02-04', birthTime: null, birthTimePrecision: 'unknown', gender: 'female' })],
  ['unknown-lunar', input({ calendarType: 'lunar', birthDate: '1992-08-13', birthTime: null, birthTimePrecision: 'unknown', gender: 'male' })],
  ['unknown-overseas', input({ birthDate: '1988-05-15', birthTime: null, birthTimePrecision: 'unknown', gender: 'female', timezone: 'UTC', location: { label: 'UTC', utcOffsetMinutes: 0 } })],
  ['range-si', input({ birthDate: '1992-09-09', birthTime: '사/巳 (09:30-11:29)', birthTimePrecision: 'branch-range', gender: 'male' })],
  ['range-ja', input({ birthDate: '1990-01-01', birthTime: '자/子 (23:30-01:29)', birthTimePrecision: 'branch-range', gender: 'female' })],
  ['range-o', input({ birthDate: '2000-02-29', birthTime: '오/午 (11:30-13:29)', birthTimePrecision: 'branch-range', gender: 'male' })],
  ['range-hae', input({ birthDate: '2012-12-21', birthTime: '해/亥 (21:30-23:29)', birthTimePrecision: 'branch-range', gender: 'female' })]
].map(([label, fixtureInput], index) => pendingFixture(
  `time-uncertainty-${String(index + 1).padStart(3, '0')}`,
  'time-uncertainty',
  `시간 불확실성 표본: ${label}`,
  fixtureInput as GoldenFixtureInput
));

const timezoneSeeds: Array<{
  label: string;
  date: string;
  time: string;
  timezone: string;
  offset: number;
  latitude?: number;
  longitude?: number;
  trueSolar?: boolean;
}> = [
  { label: 'UTC 기준', date: '1992-09-09', time: '01:24', timezone: 'UTC', offset: 0 },
  { label: '뉴욕 DST 직전', date: '2024-03-10', time: '01:59', timezone: 'America/New_York', offset: -300, latitude: 40.7128, longitude: -74.006 },
  { label: '뉴욕 DST 직후', date: '2024-03-10', time: '03:01', timezone: 'America/New_York', offset: -240, latitude: 40.7128, longitude: -74.006 },
  { label: '뉴욕 DST 중복 첫 시각', date: '2024-11-03', time: '01:30', timezone: 'America/New_York', offset: -240, latitude: 40.7128, longitude: -74.006 },
  { label: '뉴욕 DST 중복 둘째 시각', date: '2024-11-03', time: '01:30', timezone: 'America/New_York', offset: -300, latitude: 40.7128, longitude: -74.006 },
  { label: '런던 DST 직전', date: '2024-03-31', time: '00:59', timezone: 'Europe/London', offset: 0, latitude: 51.5074, longitude: -0.1278 },
  { label: '런던 DST 직후', date: '2024-03-31', time: '02:01', timezone: 'Europe/London', offset: 60, latitude: 51.5074, longitude: -0.1278 },
  { label: '도쿄', date: '1988-08-08', time: '08:08', timezone: 'Asia/Tokyo', offset: 540, latitude: 35.6762, longitude: 139.6503 },
  { label: '시드니 서머타임', date: '2000-01-15', time: '12:00', timezone: 'Australia/Sydney', offset: 660, latitude: -33.8688, longitude: 151.2093 },
  { label: '시드니 표준시', date: '2000-06-15', time: '12:00', timezone: 'Australia/Sydney', offset: 600, latitude: -33.8688, longitude: 151.2093 },
  { label: '로스앤젤레스 표준시', date: '2024-03-10', time: '01:59', timezone: 'America/Los_Angeles', offset: -480, latitude: 34.0522, longitude: -118.2437 },
  { label: '로스앤젤레스 서머타임', date: '2024-03-10', time: '03:01', timezone: 'America/Los_Angeles', offset: -420, latitude: 34.0522, longitude: -118.2437 },
  { label: '카트만두 45분 오프셋', date: '1995-05-05', time: '10:15', timezone: 'Asia/Kathmandu', offset: 345, latitude: 27.7172, longitude: 85.324 },
  { label: '호놀룰루', date: '1985-12-25', time: '22:30', timezone: 'Pacific/Honolulu', offset: -600, latitude: 21.3099, longitude: -157.8581 },
  { label: '서울 진태양시', date: '1992-09-09', time: '10:24', timezone: 'Asia/Seoul', offset: 540, latitude: 37.5665, longitude: 126.978, trueSolar: true },
  { label: '부산 진태양시', date: '1992-09-09', time: '10:24', timezone: 'Asia/Seoul', offset: 540, latitude: 35.1796, longitude: 129.0756, trueSolar: true }
];

const timezoneFixtures = timezoneSeeds.map((seed, index) => pendingFixture(
  `timezone-solar-${String(index + 1).padStart(3, '0')}`,
  'timezone-solar-time',
  `해외 시간대/DST/진태양시 표본: ${seed.label}`,
  input({
    birthDate: seed.date,
    birthTime: seed.time,
    gender: index % 2 === 0 ? 'male' : 'female',
    timezone: seed.timezone,
    location: {
      label: seed.label,
      latitude: seed.latitude,
      longitude: seed.longitude,
      utcOffsetMinutes: seed.offset
    },
    trueSolarTimePolicy: seed.trueSolar ? 'apparent-solar-time' : 'disabled'
  }),
  {
    comparisonGroup: seed.label.includes('DST') ? seed.label.replace(/ (직전|직후|중복 첫 시각|중복 둘째 시각)/, '') : undefined,
    reviewNotes: ['역사적 UTC offset과 DST 전환 instant를 IANA tzdb 또는 동급 독립 자료로 확인하기 전 pending이다.']
  }
));

const dayunPairSeeds: Array<[string, string]> = [
  ['1990-01-01', '12:30'],
  ['1992-09-09', '10:24'],
  ['2000-02-29', '23:30'],
  ['2012-06-21', '06:45'],
  ['2024-02-04', '17:28']
];

const dayunFixtures = dayunPairSeeds.flatMap(([birthDate, birthTime], pairIndex) =>
  (['male', 'female'] as const).map((gender, genderIndex) => pendingFixture(
    `dayun-boundary-${String(pairIndex * 2 + genderIndex + 1).padStart(3, '0')}`,
    'dayun-boundary',
    `동일 명식 남녀 대운 방향/startsAt 비교 ${pairIndex + 1} - ${gender}`,
    input({ birthDate, birthTime, gender }),
    {
      comparisonGroup: `dayun-pair-${pairIndex + 1}`,
      boundaryReference: {
        kind: 'dayun-start',
        label: '첫 대운 startsAt 직전/당일/직후 파생 검수 대상',
        status: 'pending-independent-confirmation'
      },
      reviewNotes: ['대운 방향과 시작 시각은 승인된 정책 자료 및 독립 계산 결과 확보 전 pending이다.']
    }
  ))
);

export const generalSignatureGoldenFixtures: GoldenFixture[] = [
  ...solarGeneralFixtures,
  ...lunarRegularFixtures,
  ...lunarLeapFixtures,
  ...solarTermBoundaryFixtures,
  ...dayBoundaryFixtures,
  ...timeUncertaintyFixtures,
  ...timezoneFixtures,
  ...dayunFixtures
];

export const expectedGoldenCategoryCounts: Record<GoldenFixtureCategory, number> = {
  'solar-general': 40,
  'lunar-regular': 20,
  'lunar-leap': 10,
  'solar-term-boundary': 20,
  'day-boundary': 16,
  'time-uncertainty': 8,
  'timezone-solar-time': 16,
  'dayun-boundary': 10
};

export const GOLDEN_MATRIX_TOTAL = 140;

if (generalSignatureGoldenFixtures.length !== GOLDEN_MATRIX_TOTAL) {
  throw new Error(
    `General signature golden matrix must contain ${GOLDEN_MATRIX_TOTAL} fixtures; received ${generalSignatureGoldenFixtures.length}.`
  );
}
