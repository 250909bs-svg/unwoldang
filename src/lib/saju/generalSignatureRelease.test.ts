import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildSajuReport } from './reportBuilder';
import { findCustomerReportTextViolations } from './reportPresentation';

const exactFixture: IntakeFormData = {
  name: '김민호',
  gender: 'male',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '09:36',
  isUnknownTime: false,
  birthTimePrecision: 'exact',
  dayBoundaryPolicy: 'midnight',
  birthLocation: {
    label: '서울특별시',
    timezone: 'Asia/Seoul',
    utcOffsetMinutes: 540,
    latitude: 37.5665,
    longitude: 126.978,
    applySolarTimeCorrection: true
  },
  timezone: 'Asia/Seoul',
  utcOffsetMinutes: 540,
  latitude: 37.5665,
  longitude: 126.978,
  applySolarTimeCorrection: true,
  location: '서울특별시',
  relationshipStatus: 'single',
  relationshipDuration: '',
  q1: '지금 직업에서 가장 먼저 바꿀 것은 무엇인가요?',
  q2: '앞으로 돈을 남기려면 무엇을 주의해야 하나요?'
};

function build(overrides: Partial<IntakeFormData> = {}) {
  return buildSajuReport('general-signature', { ...exactFixture, ...overrides });
}

function customerVisibleText(report: ReturnType<typeof buildSajuReport>) {
  const { engineMeta: _engineMeta, qualityAudit: _qualityAudit, ...customerFields } = report;
  return JSON.stringify(customerFields);
}

describe('general-signature release fixtures', () => {
  it('CASE A: keeps exact identity and produces all four pillars without placeholders', () => {
    const report = build();
    const visibleText = customerVisibleText(report);

    expect(report.customerName).toBe(exactFixture.name);
    expect(report.birthLabel).toContain('1992');
    expect(report.birthLabel).toContain('09:36');
    expect(report.pillars.year).toBeTruthy();
    expect(report.pillars.month).toBeTruthy();
    expect(report.pillars.day).toBeTruthy();
    expect(report.pillars.hour).toBeTruthy();
    expect(report.engineMeta?.calculationPrecision).toBe('exact-minute');
    expect(visibleText).not.toMatch(/미정|미상|\bunknown\b/i);
    expect(findCustomerReportTextViolations(report)).toEqual([]);
  });

  it('CASE B: keeps a branch range uncertain without blocking stable calculations', () => {
    const report = build({
      birthTime: '사/巳 (09:30-11:29)',
      birthTimePrecision: 'branch-range',
      isUnknownTime: false
    });

    expect(report.engineMeta?.calculationPrecision).toBe('legacy-range');
    expect(report.pillars.year).toBeTruthy();
    expect(report.pillars.month).toBeTruthy();
    expect(report.pillars.day).toBeTruthy();
    expect(report.sections.length).toBeGreaterThan(10);
    expect(report.engineMeta?.scenarioCount).toBeGreaterThan(1);
  });

  it('CASE C: omits only the hour pillar when birth time is unknown', () => {
    const report = build({
      birthTime: '',
      birthTimePrecision: 'unknown',
      isUnknownTime: true
    });

    expect(report.engineMeta?.calculationPrecision).toBe('unknown');
    expect(report.pillars.year).toBeTruthy();
    expect(report.pillars.month).toBeTruthy();
    expect(report.pillars.day).toBeTruthy();
    expect(report.pillars.hour).toBeNull();
    expect(report.sections.length).toBeGreaterThan(10);
  });

  it('CASE D/E: creates reports for valid lunar flat and leap-month inputs', () => {
    const flat = build({ calendar: 'lunar', birthDate: '1992-08-13', isLeapMonth: false });
    const leap = build({ calendar: 'lunar', birthDate: '2023-02-01', isLeapMonth: true });

    expect(flat.pillars.year).toBeTruthy();
    expect(flat.pillars.day).toBeTruthy();
    expect(leap.pillars.year).toBeTruthy();
    expect(leap.pillars.day).toBeTruthy();
  });

  it('CASE F: applies the selected 23:30 day-boundary policy consistently', () => {
    const birthLocation = {
      ...exactFixture.birthLocation!,
      applySolarTimeCorrection: false
    };
    const midnight = build({
      birthDate: '2024-01-01',
      birthTime: '23:30',
      dayBoundaryPolicy: 'midnight',
      birthLocation,
      applySolarTimeCorrection: false
    });
    const lateZi = build({
      birthDate: '2024-01-01',
      birthTime: '23:30',
      dayBoundaryPolicy: 'late-zi',
      birthLocation,
      applySolarTimeCorrection: false
    });

    expect(midnight.engineMeta?.dayBoundaryPolicy).toBe('civil-midnight');
    expect(lateZi.engineMeta?.dayBoundaryPolicy).toBe('late-zi-next-day');
    expect(lateZi.pillars.day).not.toBe(midnight.pillars.day);
  });

  it('keeps all paid-report chapters meaningful and free of internal tokens', () => {
    const report = build();
    const sectionText = report.sections.map((section) => `${section.id} ${section.title}`).join(' ')
      .replace(/[\s·]/g, '');
    const visibleText = customerVisibleText(report);

    for (const keyword of ['성향', '직업', '사업', '재물', '연애', '결혼', '대운', '연운', '월운', '형충합', '12운성', '신살']) {
      expect(sectionText).toContain(keyword);
    }
    expect(report.summary.analysis.join(' ').trim()).not.toBe('');
    expect(report.questionAnswers).toHaveLength(2);
    expect(report.questionAnswers.every((answer) => answer.analysis.trim() && answer.advice.length > 0)).toBe(true);
    expect(report.actionPlan.priorities.length).toBeGreaterThanOrEqual(3);
    expect(report.sections.every((section) => {
      const bodyCount = (section.paragraphs?.filter(Boolean).length || 0)
        + (section.bullets?.filter(Boolean).length || 0)
        + (section.cards?.filter((card) => card.title && card.body).length || 0)
        + (section.details?.filter((detail) => detail.summary && detail.content).length || 0)
        + (section.callout?.body ? 1 : 0)
        + (section.table?.rows.filter((row) => row.some(Boolean)).length || 0);
      return bodyCount > 0;
    })).toBe(true);
    expect(visibleText).not.toMatch(/은\(는\)|이\(가\)|을\(를\)|과\(와\)|님가|미상로|편인와/);
    expect(visibleText).not.toMatch(/not-configured|supported|conditional|insufficient|balanced|MRE-V2|eokbu|tonggwan|undefined|null|\[object Object\]/i);
  });
});
