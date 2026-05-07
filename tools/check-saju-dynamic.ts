import { buildSajuReport } from '../src/lib/saju/reportBuilder';
import type { IntakeFormData, ServiceId } from '../src/api/mockData';

type CheckCase = {
  label: string;
  serviceId: ServiceId;
  formData: Partial<IntakeFormData>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function compactReport(caseItem: CheckCase) {
  const report = buildSajuReport(caseItem.serviceId, caseItem.formData);

  return {
    label: caseItem.label,
    pillars: report.pillars,
    currentDayun: report.currentDayun,
    nextDayun: report.nextDayun,
    fiveElements: Object.fromEntries(report.fiveElements.map((item) => [item.label, item.value])),
    summaryTitle: report.summary.title
  };
}

const cases: CheckCase[] = [
  {
    label: 'golden-cha-minho',
    serviceId: 'general-signature',
    formData: {
      name: '차민호',
      gender: 'male',
      calendar: 'solar',
      birthDate: '1992-09-09',
      birthTime: '10:24',
      q1: '지금 가장 조심해야 할 선택은 무엇인가요?',
      q2: '2026년에 커리어를 어떻게 확장하는 게 좋을까요?'
    }
  },
  {
    label: 'dynamic-female-2000',
    serviceId: 'general-signature',
    formData: {
      name: '김하늘',
      gender: 'female',
      calendar: 'solar',
      birthDate: '2000-01-01',
      birthTime: '08:30',
      q1: '올해 연애운은 어떤 흐름인가요?',
      q2: '직업 방향을 바꿔도 괜찮을까요?'
    }
  },
  {
    label: 'dynamic-male-1988',
    serviceId: 'general-signature',
    formData: {
      name: '이도윤',
      gender: 'male',
      calendar: 'solar',
      birthDate: '1988-05-05',
      birthTime: '23:30',
      q1: '돈이 모이는 방식이 궁금합니다.',
      q2: '결혼운은 언제부터 안정될까요?'
    }
  }
];

const results = cases.map(compactReport);
const golden = results[0];

assert(golden.pillars.year === '임신', 'Golden year pillar should be 임신');
assert(golden.pillars.month === '기유', 'Golden month pillar should be 기유');
assert(golden.pillars.day === '무자', 'Golden day pillar should be 무자');
assert(golden.pillars.hour === '정사', 'Golden hour pillar should be 정사');
assert(golden.currentDayun.name === '임자', 'Golden current dayun should be 임자');
assert(golden.nextDayun.name === '계축', 'Golden next dayun should be 계축');

const signatures = new Set(
  results.map((result) =>
    [
      result.pillars.year,
      result.pillars.month,
      result.pillars.day,
      result.pillars.hour,
      result.currentDayun.name,
      result.nextDayun.name,
      JSON.stringify(result.fiveElements)
    ].join('|')
  )
);

assert(signatures.size === results.length, 'Saju reports must differ for different birth inputs');

console.log(JSON.stringify(results, null, 2));
