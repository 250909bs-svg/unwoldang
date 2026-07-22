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

function coupleContext() {
  const formData: Partial<IntakeFormData> = {
    ...fixture(),
    partner: {
      name: '민준',
      gender: 'male',
      calendar: 'solar',
      isLeapMonth: false,
      birthDate: '1989-04-12',
      birthTime: '08:15',
      isUnknownTime: false,
      birthTimePrecision: 'exact',
      dayBoundaryPolicy: 'midnight'
    }
  };
  const basis = buildDeterministicSajuBasis(
    'match-couple',
    formData,
    undefined,
    { asOf: '2026-07-22T03:00:00.000Z' }
  );
  const report = buildSajuReport('match-couple', formData, basis);
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

  it('rejects partner-subject pillar claims when no partner facts were supplied', () => {
    const { basis, allowlist } = context();
    expect(findNarrativeFactViolations({
      analysis: `배우자의 일주는 ${basis.pillars.day}입니다.`
    }, allowlist).map(({ code }) => code)).toContain('unsupported-ganzhi');
    expect(findNarrativeFactViolations({
      analysis: [`당신의 일주는 ${basis.pillars.day}입니다.`, `일주는 ${basis.pillars.day}입니다.`]
    }, allowlist)).toEqual([]);
  });

  it('keeps ganzhi bound to the supplied pillar and luck roles', () => {
    const { basis, allowlist } = context();
    const currentDayun = basis.commercialV2.luckContext.currentDayun;
    const nextDayun = basis.commercialV2.luckContext.nextDayun;
    expect(currentDayun).toBeTruthy();
    expect(nextDayun).toBeTruthy();
    const wrongYearGanzhi = [basis.pillars.month, basis.pillars.day, basis.pillars.hour]
      .find((ganzhi): ganzhi is string => Boolean(ganzhi && !allowlist.ganzhiByRole['year-ganzhi'].has(ganzhi)));
    expect(wrongYearGanzhi).toBeTruthy();

    expect(findNarrativeFactViolations({
      analysis: [
        `${basis.pillars.year} 년주`,
        `일주는 ${basis.pillars.day}`,
        `${currentDayun!.ganzhi} 현재 대운`,
        `다음 대운은 ${nextDayun!.ganzhi}`,
        `${basis.dayun[0].ganzhi} 대운`,
        `${basis.commercialV2.luckContext.currentSeun.ganzhi} 세운`,
        `${basis.commercialV2.luckContext.currentWolyun.ganzhi} 월운`,
        `${basis.pillars.year}년`
      ]
    }, allowlist)).toEqual([]);

    const violations = findNarrativeFactViolations({
      analysis: [
        `${basis.dayun.at(-1)!.ganzhi} 일주`,
        `${basis.pillars.month} 현재 대운`,
        `${nextDayun!.ganzhi} 현재 대운`,
        `${currentDayun!.ganzhi} 다음 대운`,
        `${wrongYearGanzhi}년`
      ]
    }, allowlist);

    expect(violations.filter(({ code }) => code === 'unsupported-ganzhi')).toHaveLength(5);
  });

  it('accepts Hanja only for the matching supplied role', () => {
    const { basis, allowlist } = context();
    const toHanja = (ganzhi: string) =>
      `${'甲乙丙丁戊己庚辛壬癸'[STEMS.indexOf(ganzhi[0])]}` +
      `${'子丑寅卯辰巳午未申酉戌亥'[BRANCHES.indexOf(ganzhi[1])]}`;

    expect(findNarrativeFactViolations({
      analysis: `${toHanja(basis.pillars.day)} 일주`
    }, allowlist)).toEqual([]);
    expect(findNarrativeFactViolations({
      analysis: `${toHanja(basis.pillars.month)} 일주`
    }, allowlist).map(({ code }) => code)).toContain('unsupported-ganzhi');
  });

  it('keeps self and partner pillar facts bound to their subjects', () => {
    const { basis, allowlist } = coupleContext();
    const partner = basis.commercialV2.partner?.calendar.scenarioPillars[0];
    const selfSubjects = ['나', '저', '본인', '당신', '고객', '의뢰인'];
    const calculationSubjects = ['원국', '명식', '사주', '차트'];
    const partnerSubjects = [
      '연인', '배우자', '남친', '여친', '그 사람', '민준님', '민준 씨', '민준씨'
    ];
    expect(partner).toBeTruthy();
    expect(partner!.day).not.toBe(basis.pillars.day);

    expect(findNarrativeFactViolations({
      analysis: [
        ...selfSubjects.map((subject) => `${subject}의 일주는 ${basis.pillars.day}입니다.`),
        ...calculationSubjects.map(
          (subject) => `${subject}의 일주는 ${basis.pillars.day}입니다.`
        ),
        `당신의 년주는 ${basis.pillars.year}입니다.`,
        `월주는 ${basis.pillars.month}입니다.`,
        `시주는 ${basis.pillars.hour}입니다.`,
        ...partnerSubjects.map((subject) => `${subject}의 일주는 ${partner!.day}입니다.`),
        `상대방의 년주는 ${partner!.year}입니다.`,
        `상대 월주는 ${partner!.month}입니다.`,
        `파트너의 일주는 ${partner!.day}입니다.`,
        `남친 일주는 ${partner!.day}입니다.`,
        `민준 일주는 ${partner!.day}입니다.`,
        `민준씨 일주는 ${partner!.day}입니다.`,
        `상대의 ${partner!.hour} 시주를 봅니다.`
      ]
    }, allowlist)).toEqual([]);

    const wrongPartnerClaims = partnerSubjects.map(
      (subject) => `${subject}의 일주는 ${basis.pillars.day}입니다.`
    ).concat(
      `남친 일주는 ${basis.pillars.day}입니다.`,
      `민준 일주는 ${basis.pillars.day}입니다.`,
      `민준씨 일주는 ${basis.pillars.day}입니다.`
    );
    const wrongCalculationClaims = calculationSubjects.map(
      (subject) => `${subject}의 일주는 ${partner!.day}입니다.`
    );
    const violations = findNarrativeFactViolations({
      analysis: [
        ...wrongPartnerClaims,
        ...wrongCalculationClaims,
        `당신의 일주는 ${partner!.day}입니다.`,
        `일주는 ${partner!.day}입니다.`
      ]
    }, allowlist);

    expect(violations.filter(({ code }) => code === 'unsupported-ganzhi')).toHaveLength(
      wrongPartnerClaims.length + wrongCalculationClaims.length + 2
    );
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
    const percentageElement = [...allowlist.elementPercentages.entries()]
      .find(([, values]) => values.has(25))?.[0];
    const wrongValue = Array.from({ length: 201 }, (_, value) => value)
      .find((value) => !allowedValues.has(value));
    const wrongPercentage = Array.from({ length: 101 }, (_, value) => value)
      .find((value) => !allowlist.elementPercentages.get(percentageElement!)?.has(value));
    const wrongHelpful = [...'\uBAA9\uD654\uD1A0\uAE08\uC218']
      .find((value) => !allowlist.helpfulElements.has(value));
    const wrongStrength = ['\uC2E0\uAC15', '\uC2E0\uC57D', '\uC911\uD654']
      .find((value) => !allowlist.strengthLabels.has(value));
    const wrongAge = Array.from({ length: 151 }, (_, value) => value)
      .find((value) => !allowlist.dayunStartAges.has(value));
    const wrongPolicy = ['civil-midnight', 'late-zi-next-day']
      .find((value) => !allowlist.calendarPolicies.has(value));

    expect(element).toBeTruthy();
    expect(percentageElement).toBeTruthy();
    expect(wrongValue).toBeDefined();
    expect(wrongPercentage).toBeDefined();
    expect(wrongHelpful).toBeTruthy();
    expect(wrongStrength).toBeTruthy();
    expect(wrongAge).toBeDefined();
    expect(wrongPolicy).toBeTruthy();

    expect(findNarrativeFactViolations({
      analysis: `${percentageElement} \uC624\uD589\uC740 25%\uC785\uB2C8\uB2E4.`
    }, allowlist)).toEqual([]);

    const violations = findNarrativeFactViolations({
      analysis: [
        `${percentageElement} \uC624\uD589\uC740 ${wrongPercentage}%\uC785\uB2C8\uB2E4.`,
        `${element} \uC624\uD589\uC740 ${wrongValue}\uAC1C\uC785\uB2C8\uB2E4.`,
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

  it('accepts only the first dayun start age, not later ten-year row ages', () => {
    const { basis, allowlist } = context();
    const firstExact = basis.dayun[0].startAgeExact!;
    const laterExact = basis.dayun[1].startAgeExact!;
    expect(allowlist.dayunStartAges).toEqual(new Set([
      Number(firstExact.toFixed(6)),
      Math.round(firstExact),
      Math.floor(firstExact)
    ]));

    expect(findNarrativeFactViolations({
      analysis: `대운 시작 나이는 ${Math.floor(firstExact)}세입니다.`
    }, allowlist)).toEqual([]);
    expect(findNarrativeFactViolations({
      analysis: `대운 시작 나이는 ${laterExact}세입니다.`
    }, allowlist).map(({ code }) => code)).toContain('unsupported-dayun-start-age');
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
