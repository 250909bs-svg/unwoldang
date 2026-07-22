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
});
