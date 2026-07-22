import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../../api/mockData';
import { buildDeterministicSajuBasis } from '../deterministicBasis';
import { buildSajuReport } from '../reportBuilder';
import {
  buildNarrativeFactAllowlist,
  findNarrativeFactViolations
} from './reportFactGuard';

const STEMS = [...'갑을병정무기경신임계'];
const BRANCHES = [...'자축인묘진사오미신유술해'];
const SIXTY_GANZHI = Array.from({ length: 60 }, (_, index) =>
  `${STEMS[index % 10]}${BRANCHES[index % 12]}`
);

function fixture(): Partial<IntakeFormData> {
  return {
    name: '테스터',
    gender: 'female',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '09:36',
    isUnknownTime: false,
    birthTimePrecision: 'exact',
    dayBoundaryPolicy: 'midnight',
    location: '서울',
    q1: '올해 흐름',
    q2: '일의 방향'
  };
}

function context() {
  const formData = fixture();
  const basis = buildDeterministicSajuBasis(
    'general-signature',
    formData,
    undefined,
    { asOf: '2026-07-22T03:00:00.000Z' }
  );
  const report = buildSajuReport('general-signature', formData, basis);
  return { basis, allowlist: buildNarrativeFactAllowlist(report, basis) };
}

describe('AI narrative calculation fact guard', () => {
  it('accepts supplied facts and ordinary new prose', () => {
    const { basis, allowlist } = context();
    const narrative = {
      paragraphs: [
        `${basis.pillars.day} 일주와 ${basis.dayun[0].ganzhi} 대운을 함께 봅니다.`,
        `${basis.seun[0].year}년 흐름은 ${basis.dayMaster.stem} 일간의 선택을 설명합니다.`,
        '기사가 신사와 대화하는 것처럼 자연스러운 일반 서사는 새로 작성할 수 있습니다.'
      ]
    };
    expect(findNarrativeFactViolations(narrative, allowlist)).toEqual([]);
  });

  it('rejects invented pillar/dayun ganzhi, year, and day master', () => {
    const { allowlist } = context();
    const fakeGanzhi = SIXTY_GANZHI.find((value) => !allowlist.ganzhi.has(value));
    const fakeDayMaster = STEMS.find((value) => !allowlist.dayMasters.has(value));
    expect(fakeGanzhi).toBeTruthy();
    expect(fakeDayMaster).toBeTruthy();
    const violations = findNarrativeFactViolations({
      analysis: `${fakeGanzhi} 일주이며 ${fakeGanzhi} 대운입니다. 2199년에는 ${fakeDayMaster} 일간으로 바뀝니다.`
    }, allowlist);
    expect(new Set(violations.map(({ code }) => code))).toEqual(new Set([
      'unsupported-ganzhi',
      'unsupported-year',
      'unsupported-day-master'
    ]));
  });

  it('rejects invented element, helpful-element, strength, dayun-age, and calendar claims', () => {
    const { allowlist } = context();
    const [element, allowedValues] = [...allowlist.elementValues.entries()][0];
    const wrongValue = Array.from({ length: 201 }, (_, value) => value)
      .find((value) => !allowedValues.has(value));
    const wrongHelpful = [...'\uBAA9\uD654\uD1A0\uAE08\uC218']
      .find((value) => !allowlist.helpfulElements.has(value));
    const wrongStrength = ['\uC2E0\uAC15', '\uC2E0\uC57D', '\uC911\uD654']
      .find((value) => !allowlist.strengthLabels.has(value));
    const wrongAge = Array.from({ length: 151 }, (_, value) => value)
      .find((value) => !allowlist.dayunStartAges.has(value));
    const wrongPolicy = ['civil-midnight', 'late-zi-next-day']
      .find((value) => !allowlist.calendarPolicies.has(value));

    expect(element).toBeTruthy();
    expect(wrongValue).toBeDefined();
    expect(wrongHelpful).toBeTruthy();
    expect(wrongStrength).toBeTruthy();
    expect(wrongAge).toBeDefined();
    expect(wrongPolicy).toBeTruthy();

    const violations = findNarrativeFactViolations({
      analysis: [
        `${element} \uC624\uD589\uC740 ${wrongValue}\uC810\uC785\uB2C8\uB2E4.`,
        `\uC6A9\uC2E0\uC740 ${wrongHelpful}\uC785\uB2C8\uB2E4.`,
        `${wrongStrength} \uBA85\uC2DD\uC785\uB2C8\uB2E4.`,
        `\uB300\uC6B4 \uC2DC\uC791 \uB098\uC774\uB294 ${wrongAge}\uC138\uC785\uB2C8\uB2E4.`,
        `${wrongPolicy} \uACBD\uACC4 \uC815\uCC45\uC744 \uC0AC\uC6A9\uD569\uB2C8\uB2E4.`
      ]
    }, allowlist);

    expect(new Set(violations.map(({ code }) => code))).toEqual(new Set([
      'unsupported-element-value',
      'unsupported-helpful-element',
      'unsupported-strength-label',
      'unsupported-dayun-start-age',
      'unsupported-calendar-policy'
    ]));
  });

  it('ignores immutable user and structure labels while still checking generated prose', () => {
    const { allowlist } = context();
    const immutableText = '2199\uB144 \uB300\uC6B4\uC740 late-zi-next-day\uC778\uAC00\uC694?';
    const structureOnly = {
      questionAnswers: [{ question: immutableText }],
      keyTakeaways: [{ title: immutableText }],
      sections: [{
        id: immutableText,
        cards: [{ title: immutableText }],
        details: [{ summary: immutableText }]
      }]
    };

    expect(findNarrativeFactViolations(structureOnly, allowlist)).toEqual([]);
    expect(findNarrativeFactViolations({
      ...structureOnly,
      questionAnswers: [{ question: immutableText, analysis: immutableText }]
    }, allowlist).map(({ code }) => code)).toEqual(expect.arrayContaining([
      'unsupported-year',
      'unsupported-calendar-policy'
    ]));
  });
});
