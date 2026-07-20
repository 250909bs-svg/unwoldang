import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildSajuReport } from './reportBuilder';

function makeFormData(overrides: Partial<IntakeFormData> = {}): Partial<IntakeFormData> {
  return {
    name: '차민호',
    gender: 'male',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1992-09-09',
    birthTime: '10:24',
    isUnknownTime: false,
    relationshipStatus: 'single',
    relationshipDuration: 'under1',
    q1: '살기싫다',
    q2: '뭐먹고살지 ?',
    ...overrides
  };
}

describe('saju report question answers', () => {
  it('routes self-harm wording to a safety-first answer', () => {
    const report = buildSajuReport('general-signature', makeFormData());
    const answer = report.questionAnswers[0];

    expect(answer.title).toContain('민호야');
    expect(answer.title).toContain('혼자 버티는 날이 아니야');
    expect(answer.analysis).toContain('안전이 먼저야');
    expect(answer.analysis).toContain('월령');
    expect(answer.advice.join('\n')).toContain('109');
    expect(answer.advice.join('\n')).not.toContain('하세요');
    expect(answer.advice).toHaveLength(10);
  });

  it('treats existential crisis wording as a safety-first answer', () => {
    const report = buildSajuReport('general-signature', makeFormData({ q1: '나왜살지', q2: '' }));
    const answer = report.questionAnswers[0];

    expect(answer.title).toContain('민호야');
    expect(answer.title).toContain('인생 답을 혼자 결론내리면 안 돼');
    expect(answer.analysis).toContain('사람 옆에 붙어 있어야 하는 날');
    expect(answer.advice.join('\n')).toContain('109');
  });

  it('keeps crisis answers in one casual tone for a two-syllable name', () => {
    const report = buildSajuReport(
      'general-signature',
      makeFormData({ name: '진짜', q1: '죽고싶다', q2: '나왜살지' })
    );
    const combined = report.questionAnswers
      .map((answer) => `${answer.title}\n${answer.analysis}\n${answer.advice.join('\n')}`)
      .join('\n');

    expect(combined).toContain('진짜야');
    expect(combined).toContain('진짜가 지금 혼자 있으면');
    expect(combined).not.toContain('진짜님');
    expect(combined).not.toContain('혼자 버티면 안 됩니다');
    expect(report.questionAnswers[0].title).not.toEqual(report.questionAnswers[1].title);
  });

  it('answers 먹고살지 as a career and income-structure question', () => {
    const report = buildSajuReport('general-signature', makeFormData());
    const answer = report.questionAnswers[1];

    expect(answer.title).toContain('직업·커리어');
    expect(answer.analysis).toContain('결론부터');
    expect(answer.analysis).toContain('겉으로 드러난 십성');
    expect(answer.advice.join('\n')).toContain('추천 업종');
    expect(answer.advice.join('\n')).toContain('수익 구조');
    expect(answer.analysis.replace(/\s/g, '').length).toBeGreaterThanOrEqual(300);
    expect(answer.advice).toHaveLength(10);
    expect(answer.advice[0]).toMatch(/^1\./);
    expect(answer.advice[9]).toMatch(/^10\./);
  });

  it('keeps exact customer questions and expands choice/place answers in detail', () => {
    const q1 = '나 이사 강남 독산역 중에 어디로 가는게 좋을까 ?';
    const q2 = '나 연애 어디가면 할 수있어 ?';
    const report = buildSajuReport('concern-reading', makeFormData({ q1, q2 }));
    const [moveAnswer, loveAnswer] = report.questionAnswers;

    expect(moveAnswer.question).toBe(q1);
    expect(loveAnswer.question).toBe(q2);

    for (const answer of report.questionAnswers) {
      expect(answer.analysis.replace(/\s/g, '').length).toBeGreaterThanOrEqual(300);
      expect(answer.advice).toHaveLength(10);
      expect(answer.advice[0]).toMatch(/^1\./);
      expect(answer.advice[9]).toMatch(/^10\./);
    }

    expect(`${moveAnswer.analysis}\n${moveAnswer.advice.join('\n')}`).toContain('강남');
    expect(`${moveAnswer.analysis}\n${moveAnswer.advice.join('\n')}`).toContain('독산역');
    expect(loveAnswer.advice.join('\n')).toContain('지인 소개');
  });

  it('answers two love questions with different intent, relationship status, and selected focus', () => {
    const q1 = '지금 마음에 걸리는 사람과 관계가 더 깊어질 수 있을까요?';
    const q2 = '제가 놓치면 안 될 사람의 행동 신호는 무엇인가요?';
    const report = buildSajuReport('love-reading', makeFormData({
      relationshipStatus: 'situationship',
      relationshipDuration: '',
      loveFocus: 'my-attraction',
      q1,
      q2,
    }));
    const [currentRelation, partnerSignal] = report.questionAnswers;

    expect(currentRelation.question).toBe(q1);
    expect(partnerSignal.question).toBe(q2);
    expect(currentRelation.title).toContain('이 관계가 깊어질 현실 조건');
    expect(partnerSignal.title).toContain('오래 갈 사람의 행동 신호');
    expect(currentRelation.analysis).toContain('썸 타는 중 흐름에서는');
    expect(currentRelation.analysis).toContain('이성들이 보는 내 진짜 매력');
    expect(currentRelation.advice.join('\n')).toContain('다음 약속');
    expect(partnerSignal.advice.join('\n')).toContain('새 대안');
    expect(currentRelation.analysis).not.toBe(partnerSignal.analysis);
    expect(currentRelation.advice).toHaveLength(10);
    expect(partnerSignal.advice).toHaveLength(10);
    expect(new Set(currentRelation.advice.filter((item) => partnerSignal.advice.includes(item))).size).toBeLessThanOrEqual(2);
  });

  it('separates visible ten-god readings and hidden-stem scores', () => {
    const report = buildSajuReport('general-signature', makeFormData({ q1: '회사 계속 다녀도 될까?', q2: '' }));

    expect(report.visibleTenGods.map((item) => item.reading)).toEqual([
      '壬 편재 / 申 식신',
      '己 겁재 / 酉 상관',
      '戊 비견 / 子 정재',
      '丁 정인 / 巳 편인'
    ]);
    expect(report.tenGodBasisNote).toContain('지장간 포함 기준');
    expect(report.currentDayun.name).toBe('壬子');
    expect(report.nextDayun.name).toBe('癸丑');
    const headlines = report.yearLuck.slice(0, 5).map((item) => item.headline);
    const expectedGanzhi = ['丙午', '丁未', '戊申', '己酉', '庚戌'];
    expect(headlines).toHaveLength(expectedGanzhi.length);
    expectedGanzhi.forEach((ganzhi, index) => {
      expect(headlines[index]).toContain(`${ganzhi}년, `);
      expect(headlines[index]).toContain('드러나는');
    });
    expect(new Set(headlines).size).toBe(5);
    expect(headlines.join('\n')).not.toContain('공개와 검증이 동시에 열리는 해');
  });

  it('answers company and business questions with direct premium action plans', () => {
    const report = buildSajuReport(
      'concern-reading',
      makeFormData({
        q1: '회사 계속 다녀도 될까?',
        q2: '사업을 어떻게 시작할까?'
      })
    );

    const [companyAnswer, businessAnswer] = report.questionAnswers;
    expect(companyAnswer.analysis).toContain('바로 퇴사가 답은 아닙니다');
    expect(companyAnswer.advice.join('\n')).toContain('3개월 판단 기준');
    expect(companyAnswer.advice).toHaveLength(10);
    expect(businessAnswer.analysis).toContain('대표 상품 1개');
    expect(businessAnswer.advice.join('\n')).toContain('가격 구조');
    expect(businessAnswer.advice).toHaveLength(10);
  });

  it('attaches a report quality audit without banned UI residue', () => {
    const report = buildSajuReport('general-signature', makeFormData({ q1: '회사 계속 다녀도 될까?', q2: '사업을 어떻게 시작할까?' }));

    expect(report.qualityAudit.score).toBeGreaterThanOrEqual(80);
    expect(report.qualityAudit.repeatedSentences).toEqual([]);
    expect(report.qualityAudit.bannedTerms).toEqual([]);
    expect(report.qualityAudit.typoSignals).toEqual([]);
  });

  it('publishes auditable expert, calendar, and temporal evidence metadata', () => {
    const report = buildSajuReport(
      'general-signature',
      makeFormData({ q1: '회사 계속 다녀도 될까?', q2: '' })
    );
    const ids = report.sections.map((section) => section.id);

    expect(ids).toEqual(expect.arrayContaining([
      'calculation-audit-v2',
      'expert-evidence-v2',
      'temporal-evidence-v2'
    ]));
    expect(report.engineMeta?.engineVersion).toContain('myeongri-v2');
    expect(report.engineMeta?.evidenceCount).toBeGreaterThan(0);
    expect(report.engineMeta?.calculationPrecision).toBe('exact-minute');
  });

  it('includes purpose-specific two-person compatibility evidence', () => {
    const report = buildSajuReport(
      'match-couple',
      makeFormData({
        q1: '우리 관계가 오래 가려면 무엇을 맞춰야 하나요?',
        q2: '',
        partner: {
          name: '상대방',
          gender: 'female',
          calendar: 'solar',
          isLeapMonth: false,
          birthDate: '1993-03-21',
          birthTime: '14:10',
          isUnknownTime: false,
          birthTimePrecision: 'exact',
          dayBoundaryPolicy: 'midnight'
        }
      })
    );
    const compatibility = report.sections.find((section) => section.id === 'compatibility-evidence-v2');

    expect(compatibility).toBeDefined();
    expect(compatibility?.cards).toHaveLength(4);
    expect(compatibility?.subtitle).toContain('연애');
  });

  it.each([
    ['situationship', '현재 썸에서는'],
    ['ambiguous', '이 애매한 관계에서는'],
    ['breakup-reunion', '이별·재회 흐름에서는']
  ] as const)('keeps the %s love-reading branch out of the unknown fallback', (relationshipStatus, branchCopy) => {
    const report = buildSajuReport(
      'love-reading',
      makeFormData({
        relationshipStatus,
        relationshipDuration: '',
        q1: '내 연애 패턴과 다음 행동이 궁금해요.',
        q2: ''
      })
    );
    const serialized = JSON.stringify(report);

    expect(serialized).toContain(branchCopy);
    expect(serialized).not.toContain('관계 상태 미입력');
  });

  it('turns the teaser micro choice into deterministic report guidance', () => {
    const report = buildSajuReport(
      'love-reading',
      makeFormData({
        relationshipStatus: 'ambiguous',
        relationshipDuration: '',
        loveReaction: 'D',
        q1: '상대의 연락을 어디까지 기다려야 할까요?',
        q2: ''
      })
    );

    expect(JSON.stringify(report)).toContain('사실과 추측을 분리하고');
  });

  it('uses the selected love focus to prioritize the deterministic love reading', () => {
    const report = buildSajuReport(
      'love-reading',
      makeFormData({
        relationshipStatus: 'single',
        relationshipDuration: '',
        loveFocus: 'next-love-timing',
        q1: '다음 인연을 어디에서 만나게 될까요?',
        q2: ''
      })
    );

    const loveSection = report.sections.find((section) => section.id === 'love');
    expect(JSON.stringify(loveSection)).toContain('다음 연애를 하는 시기');
    expect(JSON.stringify(loveSection)).toContain('대운·세운·월운');
  });
});
