import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildDeterministicSajuBasis } from './deterministicBasis';
import { buildSajuReport, extractQuestionOptions } from './reportBuilder';
import type { DeterministicSajuBasis } from './types';

const baseFixture: IntakeFormData = {
  name: '김민호',
  gender: 'male',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1995-07-15',
  birthTime: '13:25',
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
  q1: '직장과 사업 중 어느 쪽이 더 맞나요?',
  q2: '앞으로 돈을 남기려면 무엇을 주의해야 하나요?'
};

function makeInput(overrides: Partial<IntakeFormData> = {}): IntakeFormData {
  return { ...baseFixture, ...overrides };
}

function buildWithBasis(input: IntakeFormData) {
  const basis = buildDeterministicSajuBasis('general-signature', input);
  return { basis, report: buildSajuReport('general-signature', input, basis) };
}

function questionAnswerText(report: ReturnType<typeof buildSajuReport>) {
  return report.questionAnswers
    .map((answer) => [answer.analysis, ...answer.advice].join('\n'))
    .join('\n');
}

function assertCanonicalDayun(report: ReturnType<typeof buildSajuReport>, basis: DeterministicSajuBasis) {
  const canonical = basis.commercialV2.luckContext.currentDayun?.ganzhi;
  const answerText = questionAnswerText(report);

  if (!canonical) {
    expect(basis.commercialV2.luckContext.phase).toBe('pre-dayun');
    expect(report.currentDayun.name).toBe('대운 진입 전');
    expect(answerText).toContain('대운 진입 전');
    const firstDayun = basis.dayun[0]?.ganzhi;
    if (firstDayun) expect(answerText).not.toContain(`${firstDayun} 대운`);
    return;
  }

  expect(report.currentDayun.summary).toContain(`(${canonical}) 대운`);
  expect(answerText).toContain(`${canonical} 대운`);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('general-signature canonical current dayun contract', () => {
  it('uses the summer-hot canonical 경진 dayun in both screen data and question answers', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T00:00:00.000Z'));
    const { basis, report } = buildWithBasis(makeInput());

    expect(basis.commercialV2.luckContext.currentDayun?.ganzhi).toBe('경진');
    expect(report.currentDayun.name).toBe('庚辰');
    expect(questionAnswerText(report)).not.toContain('기묘 대운');
    assertCanonicalDayun(report, basis);
  });

  it('keeps lunar-leap in pre-dayun and never promotes the first 병진 row to current', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-27T00:00:00.000Z'));
    const { basis, report } = buildWithBasis(makeInput({
      gender: 'female',
      calendar: 'lunar',
      birthDate: '2023-02-01',
      birthTime: '10:24',
      isLeapMonth: true,
      birthLocation: {
        ...baseFixture.birthLocation!,
        applySolarTimeCorrection: false
      },
      applySolarTimeCorrection: false
    }));

    expect(basis.dayun[0]?.ganzhi).toBe('병진');
    assertCanonicalDayun(report, basis);
  });

  it.each(['male', 'female'] as const)('uses the same canonical source for %s direction', (gender) => {
    const { basis, report } = buildWithBasis(makeInput({ gender }));
    assertCanonicalDayun(report, basis);
  });

  it('keeps question answers aligned immediately before and at an exact startsAt boundary', () => {
    const input = makeInput({ birthDate: '1992-09-09', birthTime: '09:36' });
    const seed = buildDeterministicSajuBasis('general-signature', input);
    const boundary = seed.dayun[1]?.startsAt;
    expect(boundary).toBeTruthy();
    const boundaryMs = Date.parse(boundary!);

    vi.useFakeTimers();
    for (const instant of [boundaryMs - 1, boundaryMs]) {
      vi.setSystemTime(new Date(instant));
      const { basis, report } = buildWithBasis(input);
      assertCanonicalDayun(report, basis);
    }
  });
});

describe('general-signature comparison question classifier', () => {
  it('preserves an open-ended money question without inventing comparison options', () => {
    const question = '앞으로 돈을 남기려면 무엇을 주의해야 하나요?';
    expect(extractQuestionOptions(question)).toEqual([]);

    const { report } = buildWithBasis(makeInput({ q1: question, q2: '' }));
    expect(report.questionAnswers[0]?.question).toBe(question);
    expect(questionAnswerText(report)).not.toContain('앞으로·돈을·남기려면·무엇을');
    expect(questionAnswerText(report)).not.toContain('판단 순서으로');
  });

  it('recognizes explicit Korean comparison wording', () => {
    expect(extractQuestionOptions('직장과 사업 중 어느 쪽이 더 맞나요?')).toEqual(['직장', '사업']);
    expect(extractQuestionOptions('서울과 부산 중 어디가 더 맞나요?')).toEqual(['서울', '부산']);

    const { report } = buildWithBasis(makeInput());
    expect(questionAnswerText(report)).not.toContain('고려하면로 보이므로');
    expect(questionAnswerText(report)).not.toContain('"직장과 사업 중 어느 쪽이 더 맞나요?"은');
  });

  it('recognizes slash and VS comparison formats', () => {
    expect(extractQuestionOptions('직장/사업 중 어느 쪽이 더 맞나요?')).toEqual(['직장', '사업']);
    expect(extractQuestionOptions('직장 VS 사업 중 어느 쪽이 더 맞나요?')).toEqual(['직장', '사업']);
  });

  it('keeps deterministic fact evidence in question answers', () => {
    const { basis, report } = buildWithBasis(makeInput());
    const text = questionAnswerText(report);

    expect(text).toContain(`${basis.pillars.day} 일주`);
    expect(text).toContain(`${basis.pillars.month} 월령`);
    assertCanonicalDayun(report, basis);
  });

  it('rejects duplicate paid questions after punctuation and whitespace normalization', () => {
    expect(() => buildWithBasis(makeInput({
      q1: '앞으로 돈을 남기려면 무엇을 주의해야 하나요?',
      q2: '앞으로 돈을 남기려면 무엇을 주의해야 하나요 !'
    }))).toThrow(/중복된 사용자 질문/);
  });
});
