import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const providerRoot = new URL('../artifacts/time-dayun-audit/provider-6tail/', import.meta.url);
const providerPackageUrl = new URL('node_modules/lunar-javascript/package.json', providerRoot);
const providerLockUrl = new URL('package-lock.json', providerRoot);
const outputUrl = new URL('../src/lib/saju/golden/evidence/time-dayun-6tail-1.7.7.json', import.meta.url);
const { Solar } = require(fileURLToPath(new URL('node_modules/lunar-javascript', providerRoot)));

const providerPackage = JSON.parse(await readFile(providerPackageUrl, 'utf8'));
const providerLock = JSON.parse(await readFile(providerLockUrl, 'utf8'));
const integrity = providerLock.packages?.['node_modules/lunar-javascript']?.integrity;

if (providerPackage.version !== '1.7.7' || !integrity) {
  throw new Error('The independent provider must be lunar-javascript@1.7.7 with a lockfile integrity.');
}

const lateZiTimes = ['22:59', '23:00', '23:30', '23:59', '00:00', '00:30', '00:59', '01:00'];
const lateZiDates = ['1992-09-09', '2024-01-01'];

function solar(date, time) {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return Solar.fromYmdHms(year, month, day, hour, minute, 0);
}

const lateZi = lateZiDates.flatMap((date) => lateZiTimes.flatMap((time) => {
  const lunar = solar(date, time).getLunar();
  const eightChar = lunar.getEightChar();
  eightChar.setSect(2);
  const civilMidnightDay = eightChar.getDay();
  const hourPillar = eightChar.getTime();
  eightChar.setSect(1);
  return [
    { date, time, policy: 'civil-midnight', dayPillar: civilMidnightDay, hourPillar },
    { date, time, policy: 'late-zi-next-day', dayPillar: eightChar.getDay(), hourPillar }
  ];
}));

const dayunSeeds = [
  ['1990-01-01', '12:30'],
  ['1992-09-09', '10:24'],
  ['2000-02-29', '23:30'],
  ['2012-06-21', '06:45'],
  ['2024-02-04', '17:28']
];

function shiftWallClock(date, time, minutes) {
  const shifted = new Date(`${date}T${time}:00Z`);
  shifted.setUTCMinutes(shifted.getUTCMinutes() + minutes);
  return [
    shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(),
    shifted.getUTCHours(), shifted.getUTCMinutes()
  ];
}

function cstToIso(text) {
  const [date, time] = text.split(' ');
  return new Date(`${date}T${time}+08:00`).toISOString();
}

const dayun = dayunSeeds.flatMap(([birthDate, birthTime], pairIndex) => {
  // The provider publishes Chinese civil solar-term times. Preserve the same
  // physical instant by rendering KST input one hour earlier in CST.
  const cstInput = shiftWallClock(birthDate, birthTime, -60);
  const localEightChar = solar(birthDate, birthTime).getLunar().getEightChar();
  localEightChar.setSect(2);
  const localCivilPillars = {
    year: localEightChar.getYear(),
    month: localEightChar.getMonth(),
    day: localEightChar.getDay(),
    hour: localEightChar.getTime()
  };
  return [['male', 1], ['female', 0]].map(([gender, providerGender], genderIndex) => {
    const providerSolar = Solar.fromYmdHms(...cstInput, 0);
    const eightChar = providerSolar.getLunar().getEightChar();
    const yun = eightChar.getYun(providerGender, 2);
    const startSolar = yun.getStartSolar().toYmdHms();
    return {
      fixtureId: `dayun-boundary-${String(pairIndex * 2 + genderIndex + 1).padStart(3, '0')}`,
      birthDate,
      birthTime,
      gender,
      providerInputCst: `${String(cstInput[0]).padStart(4, '0')}-${String(cstInput[1]).padStart(2, '0')}-${String(cstInput[2]).padStart(2, '0')}T${String(cstInput[3]).padStart(2, '0')}:${String(cstInput[4]).padStart(2, '0')}:00+08:00`,
      localCivilPillars,
      direction: yun.isForward() ? 'forward' : 'reverse',
      startComponents: {
        years: yun.getStartYear(),
        months: yun.getStartMonth(),
        days: yun.getStartDay(),
        hours: yun.getStartHour()
      },
      startsAtProviderCivil: `${startSolar}+08:00`,
      startsAtInstant: cstToIso(startSolar),
      firstDayun: yun.getDaYun(2)[1].getGanZhi()
    };
  });
});

const snapshot = {
  schemaVersion: 1,
  collectedAt: '2026-09-02',
  sourceId: '6tail-lunar-javascript-1.7.7',
  sourceTier: 'B',
  sourceUrl: 'https://github.com/6tail/lunar-javascript',
  version: providerPackage.version,
  integrity,
  license: providerPackage.license,
  independentFromUnwoldang: true,
  policy: {
    sect1: '23:00-23:59 uses the next sexagenary day',
    sect2: '23:00-23:59 retains the civil-day pillar',
    hourPillar: 'provider time pillar uses its exact day-stem policy at late Zi',
    dayunDirection: 'yang-year male/yin-year female forward; the opposite reverse',
    dayunStartSect: 2,
    dayunStartConversion: '4320 minutes=1 year, 360=1 month, 12=1 day, remainder minute=2 hours',
    timezoneNormalization: 'KST physical instant rendered as CST before provider calculation'
  },
  limitations: [
    'This is one approved independent provider, not a second consensus source.',
    'Late-Zi and dayun conversion remain policy-sensitive.',
    'Provider results do not verify Unwoldang true-solar-time correction.'
  ],
  lateZi,
  dayun
};

await writeFile(outputUrl, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Wrote ${lateZi.length} late-Zi rows and ${dayun.length} dayun rows to ${fileURLToPath(outputUrl)}`);
