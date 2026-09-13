import { readFile, writeFile } from 'node:fs/promises';

const auditPath = new URL('../artifacts/solar-term-audit/solar-term-engine-audit.json', import.meta.url);
const candidatePath = new URL(
  '../artifacts/solar-term-audit/astronomy-engine-eval/node_modules/astronomy-engine/esm/astronomy.js',
  import.meta.url,
);
const outputPath = new URL('../artifacts/solar-term-audit/astronomy-engine-evaluation.json', import.meta.url);

const { SearchSunLongitude } = await import(candidatePath.href);
const audit = JSON.parse(await readFile(auditPath, 'utf8'));

const startMonthDay = new Map([
  [285, [1, 1]], [300, [1, 10]], [315, [1, 25]], [330, [2, 10]], [345, [2, 25]],
  [0, [3, 10]], [15, [3, 25]], [30, [4, 10]], [45, [4, 25]], [60, [5, 10]],
  [75, [5, 25]], [90, [6, 10]], [105, [6, 25]], [120, [7, 10]], [135, [7, 25]],
  [150, [8, 10]], [165, [8, 25]], [180, [9, 10]], [195, [9, 25]], [210, [10, 10]],
  [225, [10, 25]], [240, [11, 10]], [255, [11, 25]], [270, [12, 10]],
]);

const seconds = (left, right) => (new Date(left).getTime() - new Date(right).getTime()) / 1000;
const summarize = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  const absolute = values.map(Math.abs);
  return {
    count: values.length,
    minimumSeconds: Math.min(...values),
    maximumSeconds: Math.max(...values),
    maximumAbsoluteSeconds: Math.max(...absolute),
    meanSeconds: values.reduce((total, value) => total + value, 0) / values.length,
    meanAbsoluteSeconds: absolute.reduce((total, value) => total + value, 0) / absolute.length,
    medianSeconds: sorted[Math.floor(sorted.length / 2)],
  };
};

const records = audit.records.map((record) => {
  const [month, day] = startMonthDay.get(record.angle);
  const start = new Date(Date.UTC(record.year, month - 1, day));
  const result = SearchSunLongitude(record.angle, start, 30);
  if (!result) throw new Error(`No candidate result for ${record.year} / ${record.angle}`);
  const candidateUtc = result.date.toISOString();
  return {
    year: record.year,
    angle: record.angle,
    name: record.name,
    candidateUtc,
    jplSkyfieldUtc: record.jplSkyfieldUtc,
    officialNaojUtc: record.officialNaojUtc,
    candidateMinusJplSeconds: seconds(candidateUtc, record.jplSkyfieldUtc),
    candidateMinusNaojSeconds: record.officialNaojUtc
      ? seconds(candidateUtc, record.officialNaojUtc)
      : null,
  };
});

const candidateVsJpl = records.map((record) => record.candidateMinusJplSeconds);
const candidateVsNaoj = records
  .map((record) => record.candidateMinusNaojSeconds)
  .filter((value) => value !== null);

const output = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  package: {
    name: 'astronomy-engine',
    version: '2.1.19',
    license: 'MIT',
    source: 'https://github.com/cosinekitty/astronomy',
    method: 'SearchSunLongitude',
  },
  engineImportUsed: false,
  currentEngineUsedAsExpected: false,
  statistics: {
    candidateVsJpl: summarize(candidateVsJpl),
    candidateVsNaoj: summarize(candidateVsNaoj),
  },
  records,
};

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output.statistics, null, 2));
