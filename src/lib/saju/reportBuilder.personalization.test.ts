import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildDeterministicSajuBasis } from './deterministicBasis';
import { buildSajuReport } from './reportBuilder';

const fixture: IntakeFormData = {
  name: '차민호', gender: 'male', calendar: 'solar', isLeapMonth: false,
  birthDate: '1992-09-09', birthTime: '10:24', isUnknownTime: false,
  birthTimePrecision: 'exact', dayBoundaryPolicy: 'midnight', location: '서울',
  relationshipStatus: 'dating', relationshipDuration: 'under3',
  q1: '사업을 시작해도 될까요?',
  q2: '사업 매출이 늘어도 돈이 남지 않는데 어떤 지출을 줄여야 하나요?'
};

const normalizeDurationLabels = (value: string) => value
  .replace(/솔로 기간\s*/g, '')
  .replace(/1년 미만|1년 이상 3년 이하|3년 이상 5년 이하|5년 이상 10년 이하/g, '')
  .replace(/under1|under3|under5|under10/g, '');

function personalizedText(input: IntakeFormData) {
  const report = buildSajuReport('general-signature', input);
  const love = report.sections.find((section) => section.id === 'love');
  return normalizeDurationLabels(JSON.stringify({ love, questionAnswers: report.questionAnswers }));
}

describe('general-signature report personalization regressions', () => {
  it('keeps the verified male 1992-09-09 10:24 FACT values', () => {
    const report = buildSajuReport('general-signature', fixture);
    expect(report.birthLabel).toContain('남성');
    expect(report.birthLabel).toContain('10:24');
    expect(report.pillars).toEqual({ year: '임신', month: '기유', day: '무자', hour: '정사' });
  });

  it.each(['single', 'situationship', 'dating'] as const)(
    'changes at least two meaning units across duration variants for %s',
    (relationshipStatus) => {
      const outputs = (['under1', 'under3', 'under5', 'under10'] as const).map((relationshipDuration) =>
        personalizedText({ ...fixture, relationshipStatus, relationshipDuration })
      );
      expect(new Set(outputs).size).toBe(4);
    }
  );

  it('answers an operating profitability question as an existing-business problem', () => {
    const report = buildSajuReport('general-signature', fixture);
    const startup = report.questionAnswers[0];
    const operating = report.questionAnswers[1];
    expect(startup.question).toBe(fixture.q1);
    expect(startup.analysis).toContain('사업을 시작하기 전');
    expect(operating.question).toBe(fixture.q2);
    expect(operating.analysis).toContain('이미 운영 중인 사업');
    expect(operating.analysis).toContain('고정비·변동비');
    expect(operating.advice.join(' ')).toContain('공헌이익');
    expect(operating.advice.join(' ')).not.toContain('사업은 크게 여는 것보다');
  });

  it.each([
    ['회사에서 승진을 기다릴지 이직할지 고민입니다.', '현재 조직에서 성장할지 외부 기회를 선택할지'],
    ['지금 만나는 사람과 결혼까지 가도 될까요?', '재정·주거·일·가족 경계'],
    ['썸을 오래 타고 있는데 상대가 관계를 정의하지 않아요.', '오래 이어진 썸을 실제 관계로 정의할'],
    ['헤어진 사람에게 제가 먼저 연락해도 될까요?', '이별 원인이 바뀌었는지']
  ])('preserves the original question and cites canonical FACT: %s', (question, situationMarker) => {
    const input = { ...fixture, q1: question };
    const basis = buildDeterministicSajuBasis('general-signature', input);
    const report = buildSajuReport('general-signature', input, basis);
    const answer = report.questionAnswers[0];
    const answerText = [answer.analysis, ...answer.advice].join(' ');
    expect(answer.question).toBe(question);
    expect(answerText).toContain(basis.commercialV2.luckContext.currentDayun?.ganzhi || '대운 진입 전');
    expect(answer.analysis).toContain(situationMarker);
  });

  it('fails closed when general-signature gender is unselected', () => {
    expect(() => buildSajuReport('general-signature', { ...fixture, gender: '' })).toThrow(/성별/);
  });
});
