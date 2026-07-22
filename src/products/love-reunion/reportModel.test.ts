import { describe, expect, it } from 'vitest';
import type { SajuReportData } from '../../lib/saju/report';
import type { LoveReunionFormData } from './contract';
import {
  LOVE_REUNION_SECTION_IDS,
  buildLoveReunionReport,
  createLoveReunionShareData
} from './reportModel';

function createBaseReport(): SajuReportData {
  return {
    serviceId: 'love-reunion',
    kind: 'reunion',
    title: '기존 리포트',
    subtitle: '기존 부제',
    badge: '기존 배지',
    serialNumber: 'UW-RPT-REUNION-001',
    createdAt: '2026-07-22T00:00:00.000Z',
    birthLabel: '1992.09.09',
    questionPreview: '재접촉 전에 무엇을 봐야 하나요?',
    customerName: '김운월',
    zodiac: '원숭이띠',
    dayMaster: '병화',
    dayMasterElement: '화',
    strengthLabel: '균형 상태',
    helpfulElements: ['목'],
    cautiousElements: ['수'],
    gyeokguk: '정격',
    heroNote: '내 행동과 경계를 살펴보는 리포트입니다.',
    keyTakeaways: [],
    currentDayun: {
      name: '현재 대운',
      range: '2024-2033',
      summary: '표현 속도를 점검하는 참고 흐름',
      focus: '경계 존중',
      caution: '충동 접촉'
    },
    nextDayun: {
      name: '다음 대운',
      range: '2034-2043',
      summary: '회복 루틴을 점검하는 참고 흐름',
      focus: '일상 회복',
      caution: '과거 반복'
    },
    legalNotice: ['이 리포트는 타인의 내면이나 관계 결과를 단정하지 않습니다.'],
    pillars: { year: '임신', month: '기유', day: '병인', hour: null },
    fiveElements: [
      { label: '목', value: 20, color: '#000000' },
      { label: '화', value: 20, color: '#111111' },
      { label: '토', value: 20, color: '#222222' },
      { label: '금', value: 20, color: '#333333' },
      { label: '수', value: 20, color: '#444444' }
    ],
    tenGods: [],
    visibleTenGods: [],
    tenGodBasisNote: '엔진 근거',
    metaGrid: [],
    summary: { title: '기존 요약', analysis: [], advice: [] },
    questionAnswers: [],
    sections: [],
    yearLuck: [],
    monthLuck: [
      {
        year: 2026,
        month: 8,
        ganzhi: '병신',
        score: 72,
        summary: '본인의 표현 속도를 점검하는 달',
        focus: '문장 다듬기',
        warning: '충동 접촉 주의'
      }
    ],
    actionPlan: {
      title: '기존 계획',
      priorities: [],
      dos: [],
      avoids: [],
      luckyDays: [],
      unluckyDays: []
    },
    qualityAudit: {
      score: 100,
      status: 'pass',
      items: [],
      warnings: [],
      repeatedSentences: [],
      bannedTerms: [],
      typoSignals: []
    },
    engineMeta: {
      engineVersion: 'fixture-engine',
      validationStatus: 'valid',
      calendarVersion: 'fixture-calendar',
      interpretationVersion: 'fixture-interpretation',
      interactionVersion: 'fixture-interaction',
      calculationPrecision: 'unknown',
      scenarioCount: 12,
      dayBoundaryPolicy: 'civil-midnight',
      trueSolarTime: { requested: false, applied: false, correctionMinutes: null },
      evidenceCount: 1,
      confidence: 0.8,
      releaseDecision: 'eligible',
      releaseAuditVersion: 'fixture-audit',
      reproducibilityFingerprint: 'fixture-fingerprint',
      evidenceCoverage: { score: 100, passed: 1, total: 1 },
      externalCalendarStatus: 'verified-date-only',
      releaseBlockers: [],
      reviewFlags: [],
      uncertainty: ['상대 정보 미입력'],
      helpfulElementSource: 'expert-consensus'
    }
  };
}

function createFormData(): Partial<LoveReunionFormData> {
  return {
    q1: '  첫 연락 전에 무엇을 확인해야 하나요?  ',
    q2: '이 관계를 놓아야 하는 신호는 무엇인가요?',
    reunionContext: {
      version: 1,
      relationshipState: 'separated-no-contact',
      relationshipLength: '1-to-3-years',
      breakupElapsed: '1-to-3-months',
      lastContactTiming: 'under-1-month',
      lastContactNote: '안부 메시지-후 대화 중단',
      currentContact: 'none',
      contactBoundary: 'none',
      breakupReason: 'communication',
      breakupReasonDetail: 'communication',
      reunionReason: 'blocked',
      partnerBirthKnown: false,
      partnerDataPermissionConfirmed: false
    }
  } as Partial<LoveReunionFormData>;
}

describe('love-reunion report model', () => {
  it('builds all eleven sections in the contracted order and preserves engine facts', () => {
    const base = createBaseReport();
    const report = buildLoveReunionReport(base, createFormData());

    expect(report.sections.map((section) => section.id)).toEqual(LOVE_REUNION_SECTION_IDS);
    expect(report.serviceId).toBe(base.serviceId);
    expect(report.pillars).toBe(base.pillars);
    expect(report.fiveElements).toBe(base.fiveElements);
    expect(report.tenGods).toBe(base.tenGods);
    expect(report.visibleTenGods).toBe(base.visibleTenGods);
    expect(report.engineMeta).toBe(base.engineMeta);
  });

  it('preserves both customer questions exactly', () => {
    const formData = createFormData();
    const report = buildLoveReunionReport(createBaseReport(), formData);

    expect(report.questionAnswers).toHaveLength(2);
    expect(report.questionAnswers.map((answer) => answer.question)).toEqual([
      formData.q1,
      formData.q2
    ]);
  });

  it('labels saju flow, user input, and real behavior signals in every section', () => {
    const report = buildLoveReunionReport(createBaseReport(), createFormData());

    report.sections.forEach((section) => {
      const serialized = JSON.stringify(section);
      expect(serialized).toContain('[사주 흐름]');
      expect(serialized).toContain('[사용자 입력]');
      expect(serialized).toContain('[현실 행동 신호]');
    });
  });

  it('preserves free-text relationship details without enum or hyphen rewriting', () => {
    const report = buildLoveReunionReport(createBaseReport(), createFormData());
    const serialized = JSON.stringify(report);

    expect(serialized).toContain('안부 메시지-후 대화 중단');
    expect(serialized).toContain('추가 설명: communication');
    expect(serialized).toContain('다시 연결을 고민하는 이유: blocked');
  });

  it('provides a four-week thirty-day plan', () => {
    const report = buildLoveReunionReport(createBaseReport(), createFormData());
    const planSection = report.sections.find((section) => section.id === 'thirty-day-plan');

    expect(report.actionPlan.title).toContain('30일');
    expect(report.actionPlan.priorities).toHaveLength(4);
    expect(report.actionPlan.priorities).toEqual([
      expect.stringContaining('1주차'),
      expect.stringContaining('2주차'),
      expect.stringContaining('3주차'),
      expect.stringContaining('4주차')
    ]);
    expect(planSection?.bullets).toEqual(report.actionPlan.priorities);
  });

  it('continues without partner birth data and uses observable behavior for emotional tempo', () => {
    const report = buildLoveReunionReport(createBaseReport(), createFormData());
    const tempo = report.sections.find((section) => section.id === 'emotional-tempo');
    const serialized = JSON.stringify(tempo);

    expect(serialized).toContain('상대 생년 정보가 없거나 이용 권한이 확인되지 않아');
    expect(serialized).toContain('답장 간격');
    expect(serialized).toContain('약속 이행');
  });

  it('preserves and normalizes valid, question-specific server answers', () => {
    const formData = createFormData();
    const q1 = formData.q1 as string;
    const q2 = formData.q2 as string;
    const base = createBaseReport();
    base.questionAnswers = [
      {
        question: q1.trim(),
        title: '  서버 답변 · 첫 연락 조건  ',
        analysis: '  첫 질문만을 위해 생성된 서버 분석입니다. 마지막 대화의 경계와 응답 가능성을 함께 확인합니다.  ',
        advice: ['  1. 첫 질문 전용 행동 1  ', '', '2) 첫 질문 전용 행동 2']
      },
      {
        question: q2,
        title: '서버 답변 · 놓아야 할 신호',
        analysis: '두 번째 질문만을 위해 생성된 서버 분석입니다. 기다림이 일상을 무너뜨리는지 확인합니다.',
        advice: ['두 번째 질문 전용 행동 1', '두 번째 질문 전용 행동 2']
      }
    ];

    const report = buildLoveReunionReport(base, formData);

    expect(report.questionAnswers[0]).toEqual({
      question: q1,
      title: '서버 답변 · 첫 연락 조건',
      analysis: '첫 질문만을 위해 생성된 서버 분석입니다. 마지막 대화의 경계와 응답 가능성을 함께 확인합니다.',
      advice: ['첫 질문 전용 행동 1', '첫 질문 전용 행동 2']
    });
    expect(report.questionAnswers[1]).toEqual({
      question: q2,
      title: '서버 답변 · 놓아야 할 신호',
      analysis: '두 번째 질문만을 위해 생성된 서버 분석입니다. 기다림이 일상을 무너뜨리는지 확인합니다.',
      advice: ['두 번째 질문 전용 행동 1', '두 번째 질문 전용 행동 2']
    });
    const personalQuestions = report.sections.find((section) => section.id === 'personal-questions');
    expect(personalQuestions?.details?.[0].content).toContain('1. 첫 질문 전용 행동 1\n\n2. 첫 질문 전용 행동 2');
    expect(personalQuestions?.details?.[0].content).not.toContain('1. 1.');
  });

  it('replaces a duplicated server answer with a distinct question-intent fallback', () => {
    const formData = createFormData();
    const q1 = formData.q1 as string;
    const q2 = formData.q2 as string;
    const base = createBaseReport();
    base.questionAnswers = [
      {
        question: q1,
        title: '첫 서버 답변',
        analysis: '두 질문에 잘못 복제된 동일 분석',
        advice: ['두 질문에 잘못 복제된 동일 행동']
      },
      {
        question: q2,
        title: '둘째 서버 답변',
        analysis: '두 질문에 잘못 복제된 동일 분석',
        advice: ['두 질문에 잘못 복제된 동일 행동']
      }
    ];

    const report = buildLoveReunionReport(base, formData);

    expect(report.questionAnswers[0].analysis).toBe('두 질문에 잘못 복제된 동일 분석');
    expect(report.questionAnswers[1].analysis).not.toBe(report.questionAnswers[0].analysis);
    expect(report.questionAnswers[1].advice).not.toEqual(report.questionAnswers[0].advice);
    expect(report.questionAnswers[1].title).toContain('기다림을 멈출 현실 신호');
  });

  it('uses only recovery and boundary actions for blocked or explicit no-contact states', () => {
    const base = createBaseReport();
    const baseForm = createFormData();
    const q1 = baseForm.q1 as string;
    const q2 = baseForm.q2 as string;
    base.questionAnswers = [
      { question: q1, title: '서버 답변 1', analysis: 'SERVER_UNSAFE_CONTACT 지금 연락하세요.', advice: ['오늘 메시지를 보내세요.'] },
      { question: q2, title: '서버 답변 2', analysis: 'SERVER_UNSAFE_CONTACT 차단을 확인하세요.', advice: ['다른 계정을 확인하세요.'] }
    ];

    const boundaryCases = [
      { currentContact: 'blocked' as const, contactBoundary: 'none' as const },
      { currentContact: 'friendly' as const, contactBoundary: 'explicit-no-contact' as const }
    ];

    boundaryCases.forEach((boundary) => {
      const formData = {
        ...baseForm,
        reunionContext: { ...baseForm.reunionContext!, ...boundary }
      };
      const report = buildLoveReunionReport(base, formData);
      const checklist = report.sections.find((section) => section.id === 'recontact-checklist');
      const serialized = JSON.stringify({ questionAnswers: report.questionAnswers, actionPlan: report.actionPlan, checklist });

      expect(report.actionPlan.title).toContain('회복·안전');
      expect(checklist?.title).toBe('경계 준수와 회복 체크리스트');
      expect(serialized).not.toContain('SERVER_UNSAFE_CONTACT');
      expect(serialized).not.toContain('짧은 문장을 준비');
      expect(serialized).not.toContain('보내기 전 하루');
      expect(serialized).toContain('다른 번호·계정');
    });
  });

  it('adds Korean crisis guidance and remains idempotent when the builder is reapplied', () => {
    const baseForm = createFormData();
    const formData = {
      ...baseForm,
      q1: '재회가 안 되면 죽고 싶고 자해할 것 같아요.',
      q2: '상대가 집 앞에서 기다리는 스토킹을 하는데 어떻게 해야 하나요?'
    };

    const first = buildLoveReunionReport(createBaseReport(), formData);
    const second = buildLoveReunionReport(first, formData);
    const selfHarmAnswer = first.questionAnswers[0];
    const violenceAnswer = first.questionAnswers[1];

    expect(`${selfHarmAnswer.analysis}\n${selfHarmAnswer.advice.join('\n')}`).toContain('109');
    expect(`${selfHarmAnswer.analysis}\n${selfHarmAnswer.advice.join('\n')}`).toContain('119');
    expect(`${violenceAnswer.analysis}\n${violenceAnswer.advice.join('\n')}`).toContain('112');
    expect(`${violenceAnswer.analysis}\n${violenceAnswer.advice.join('\n')}`).toContain('1366');
    expect(first.actionPlan.title).toContain('회복·안전');
    expect(second.questionAnswers).toEqual(first.questionAnswers);
    expect((second.questionAnswers[0].analysis.match(/\[긴급 안전 안내\]/gu) || [])).toHaveLength(1);
  });

  it('guarantees violence guidance when the declared boundary is safety-risk', () => {
    const baseForm = createFormData();
    const formData = {
      ...baseForm,
      reunionContext: { ...baseForm.reunionContext!, contactBoundary: 'safety-risk' as const }
    };
    const report = buildLoveReunionReport(createBaseReport(), formData);
    const serialized = JSON.stringify(report.questionAnswers);

    expect(serialized).toContain('112');
    expect(serialized).toContain('119');
    expect(serialized).toContain('1366');
  });

  it('preserves generated two-person comparison evidence and states the limit when absent', () => {
    const base = createBaseReport();
    base.sections = [
      {
        id: 'compatibility-evidence-v2',
        title: '두 사람 정밀 궁합 근거',
        paragraphs: ['두 원국의 일간 상호작용 원문', '배우자궁 비교 원문'],
        cards: [{ title: '감정 교류', body: '감정 교류 비교 카드 원문', tone: 'good' }],
        details: [{ summary: '상호작용 상세', content: '합·충 관계 상세 원문', open: true }],
        callout: { title: '해석 한계', body: '상대 출생시각 미상에 따른 한계 원문' }
      }
    ];
    const baseForm = createFormData();
    const formData = {
      ...baseForm,
      partner: {
        name: '상대방',
        gender: 'female' as const,
        calendar: 'solar' as const,
        isLeapMonth: false,
        birthDate: '1993-03-21',
        birthTime: '14:10',
        isUnknownTime: false,
        birthTimePrecision: 'exact' as const,
        dayBoundaryPolicy: 'midnight' as const
      },
      reunionContext: {
        ...baseForm.reunionContext!,
        partnerBirthKnown: true,
        partnerDataPermissionConfirmed: true
      }
    };

    const report = buildLoveReunionReport(base, formData);
    const tempo = report.sections.find((section) => section.id === 'emotional-tempo');
    const serialized = JSON.stringify(tempo);

    expect(serialized).toContain('두 원국의 일간 상호작용 원문');
    expect(serialized).toContain('감정 교류 비교 카드 원문');
    expect(serialized).toContain('합·충 관계 상세 원문');
    expect(serialized).toContain('상대 출생시각 미상에 따른 한계 원문');

    const withoutEvidence = buildLoveReunionReport(createBaseReport(), formData);
    const limitedTempo = withoutEvidence.sections.find((section) => section.id === 'emotional-tempo');
    expect(JSON.stringify(limitedTempo)).toContain('두 원국 비교 근거가 생성되지 않아');
  });

  it('keeps month guidance while replacing the numeric score with a phase label', () => {
    const report = buildLoveReunionReport(createBaseReport(), createFormData());
    const timing = report.sections.find((section) => section.id === 'timing-guide');
    const serialized = JSON.stringify(timing);

    expect(serialized).toContain('본인의 표현 속도를 점검하는 달');
    expect(serialized).toContain('문장 다듬기');
    expect(serialized).toContain('충동 접촉 주의');
    expect(serialized).toContain('조정 국면');
    expect(serialized).not.toContain('72점');
    expect(serialized).not.toContain('월운 지수');
  });

  it('does not add deterministic reunion or contact claims', () => {
    const report = buildLoveReunionReport(createBaseReport(), createFormData());
    const serialized = JSON.stringify(report);
    const forbiddenPatterns = [
      /확실히/u,
      /반드시\s*재회/u,
      /상대(?:방)?은[^.\n]{0,80}마음/u,
      /정확한\s*연락일/u,
      /재회\s*성공(?:률)?/u,
      /연락이\s*(?:옵니다|온다|올\s*것)/u
    ];

    forbiddenPatterns.forEach((pattern) => expect(serialized).not.toMatch(pattern));
  });
});

describe('love-reunion share data', () => {
  it('shares only the public product detail without personal or report data', () => {
    const shareData = createLoveReunionShareData('https://www.unwoldang.com/');
    const serialized = JSON.stringify(shareData);

    expect(shareData).toEqual({
      title: '홍연아씨 재회 가능성',
      text: '운월당 홍연아씨 재회 가능성 상품 소개',
      url: 'https://www.unwoldang.com/detail/love-reunion'
    });
    expect(serialized).not.toContain('김운월');
    expect(serialized).not.toContain('1992');
    expect(serialized).not.toContain('질문');
    expect(serialized).not.toContain('order');
    expect(shareData.url).not.toContain('/report/');
  });
});
