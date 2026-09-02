import { mkdir, readFile, writeFile } from 'node:fs/promises';

const cacheUrl = new URL('../artifacts/golden-source-cache/', import.meta.url);
const targetsUrl = new URL('golden-fixture-targets.json', cacheUrl);
const outputUrl = new URL('../src/lib/saju/golden/evidence/iana-timezone.json', import.meta.url);

const targets = JSON.parse(await readFile(targetsUrl, 'utf8'));
const timezoneTargets = targets.filter(({ category }) => category === 'timezone-solar-time');

function offsetLabel(minutes) {
  if (minutes === 0) return 'Z';
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(minutes);
  return `${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}

function normalizedInstant(input) {
  return new Date(`${input.birthDate}T${input.birthTime}:00${offsetLabel(input.location.utcOffsetMinutes)}`).toISOString();
}

function renderedLocal(instant, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(instant));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

function observedOffsetMinutes(instant, timezone) {
  const value = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    timeZoneName: 'longOffset'
  }).formatToParts(new Date(instant)).find((part) => part.type === 'timeZoneName')?.value;
  if (!value || value === 'GMT' || value === 'UTC') return 0;
  const match = /^GMT([+-])(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error(`Unsupported Intl offset label: ${value}`);
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return match[1] === '-' ? -minutes : minutes;
}

const entries = timezoneTargets.map(({ id, input }) => {
  const instant = normalizedInstant(input);
  const local = renderedLocal(instant, input.timezone);
  const expectedLocal = `${input.birthDate}T${input.birthTime}`;
  const observedOffset = observedOffsetMinutes(instant, input.timezone);
  return {
    fixtureId: id,
    timezone: input.timezone,
    localDateTime: expectedLocal,
    expectedUtcOffsetMinutes: input.location.utcOffsetMinutes,
    observedUtcOffsetMinutes: observedOffset,
    normalizedInstant: instant,
    renderedLocalDateTime: local,
    localRoundTripMatch: local === expectedLocal,
    offsetMatch: observedOffset === input.location.utcOffsetMinutes,
    trueSolarTimeExcluded: input.trueSolarTimePolicy === 'apparent-solar-time'
  };
});

await mkdir(new URL('.', outputUrl), { recursive: true });
await writeFile(outputUrl, `${JSON.stringify({
  schemaVersion: 1,
  sourceAuthority: 'IANA Time Zone Database via Node.js Intl',
  sourceUrl: 'https://www.iana.org/time-zones',
  tzdbVersion: process.versions.tz,
  icuVersion: process.versions.icu,
  accessedAt: '2026-09-02',
  fieldsSupported: ['utcOffsetMinutes', 'normalizedInstant'],
  limitations: [
    'This evidence verifies civil timezone and DST behavior only.',
    'It does not verify apparent solar-time or equation-of-time corrections.'
  ],
  entries
}, null, 2)}\n`, 'utf8');

const failures = entries.filter((entry) => !entry.localRoundTripMatch || !entry.offsetMatch);
console.log(`Wrote ${entries.length} IANA timezone evidence rows; failures=${failures.length}; tzdb=${process.versions.tz}`);
if (failures.length > 0) process.exitCode = 1;
