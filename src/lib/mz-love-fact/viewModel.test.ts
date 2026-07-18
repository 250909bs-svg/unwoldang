import { describe, expect, it } from 'vitest';
import type { SajuReportData } from '../saju/report';
import { MZ_LOVE_FIXTURES_BY_KEY } from './fixtures';
import {
  adaptSajuReportToMzLoveSummary,
  buildMzLoveReportFromSaju,
  buildMzLoveViewModel,
  evidenceFromExactSource,
} from './viewModel';

function deterministicReport(): SajuReportData {
  return {
    serialNumber: 'SERIAL-001',
    dayMaster: '갑목',
    dayMasterElement: '목',
    strengthLabel: '중화',
    pillars: { year: '경오', month: '을유', day: '갑자', hour: '정묘' },
    helpfulElements: ['수'],
    cautiousElements: ['금'],
    tenGods: [{ label: '정관', value: 30 }, { label: '편인', value: 20 }],
    visibleTenGods: [{ pillar: '월주', stem: '을', stemHanja: '乙', stemTenGod: '겁재', branch: '유', branchHanja: '酉', branchMainStem: '신', branchTenGod: '정관', reading: '엔진이 계산한 원문 근거' }],
    sections: [
      {
        id: 'compatibility-evidence-v2',
        title: '관계 근거',
        paragraphs: [
          '절대 바꾸면 안 되는 결정론적 관계 근거',
          '오래 가는 관계는 약속과 책임을 함께 지키는 행동에서 확인할 수 있습니다.',
          '결혼과 안정의 가능성은 갈등 뒤 대화를 다시 여는 태도에서 살펴야 합니다.',
        ],
      },
      {
        id: 'temporal-evidence-v2',
        title: '시기 근거',
        paragraphs: [
          '절대 바꾸면 안 되는 결정론적 시기 근거',
          '앞으로 열두 달의 흐름은 만남과 대화가 늘어나는 달을 중심으로 살펴봅니다.',
          '월별 시기는 사건 확정이 아니라 관계 행동을 조절하는 기준으로 사용합니다.',
        ],
      },
    ],
    engineMeta: { calculationPrecision: 'exact-minute', uncertainty: [], confidence: 0.82 },
    customerName: '테스터',
    questionPreview: '연애 중인 관계가 오래 갈지 궁금해요.',
    createdAt: '2026-07-17T00:00:00.000Z',
    summary: { title: '연애 요약', analysis: ['관계 행동을 확인하는 결정론적 분석'], advice: ['약속과 대화의 일관성을 기록하세요.'] },
    keyTakeaways: [{ title: '핵심', body: '감정과 실제 행동을 나눠 확인하세요.' }],
    questionAnswers: [{ question: '오래 갈까요?', title: '관계 확인', analysis: '갈등 뒤의 회복 행동을 살펴보세요.', advice: ['관계의 속도를 직접 묻기'] }],
    actionPlan: { title: '실천', priorities: ['행동 확인'], dos: ['원하는 관계를 짧게 말하기'], avoids: ['답장 속도 하나로 결론 내리기'], luckyDays: [], unluckyDays: [] },
    monthLuck: [],
  } as unknown as SajuReportData;
}

describe('SajuReportData MZ love adapter', () => {
  it('preserves deterministic evidence prose byte-for-byte', () => {
    const summary = adaptSajuReportToMzLoveSummary(deterministicReport());
    expect(summary.evidence.some((item) => item.description === '엔진이 계산한 원문 근거')).toBe(true);
    expect(summary.evidence.some((item) => item.description === '절대 바꾸면 안 되는 결정론적 관계 근거')).toBe(true);
    expect(summary.evidence.every((item) => item.immutable)).toBe(true);
  });

  it('accepts existing SajuReportData directly and returns thirteen chapters', () => {
    const report = buildMzLoveReportFromSaju(deterministicReport());
    const model = buildMzLoveViewModel(report);
    expect(model.cover.title).toBe('테스터의 팩폭 연애운');
    expect(model.cover.relationshipLabel).toBe('연애 중');
    expect(model.chapters).toHaveLength(13);
    expect(model.chapters.every((chapter) => !/^CHAPTER\b/u.test(chapter.eyebrow))).toBe(true);
    expect(model.chapters.find((chapter) => chapter.id === 'lasting-partner')?.evidence.some((item) => item.source === 'relationship')).toBe(true);
    expect(model.chapters.find((chapter) => chapter.id === 'twelve-month-timing')?.evidence.some((item) => item.source === 'timing')).toBe(true);
    expect(model.redFlags).toEqual(report.redFlags);
    expect(model.greenFlags).toEqual(report.greenFlags);
  });

  it('binds displayed interpretation evidence only to the exact source field', () => {
    const model = buildMzLoveViewModel(deterministicReport());
    const evidencedChapters = model.chapters.filter((chapter) => chapter.evidence.length > 0);

    expect(evidencedChapters.length).toBeGreaterThan(0);
    evidencedChapters.forEach((chapter) => {
      expect(chapter.evidence.every((item) => item.value === chapter.interpretation)).toBe(true);
      expect(new Set(chapter.evidence.map((item) => item.sourcePath)).size).toBe(1);
    });
  });

  it('never backfills natal, timing, or relationship evidence for an untraced source', () => {
    const summary = adaptSajuReportToMzLoveSummary(deterministicReport());

    expect(evidenceFromExactSource(summary.evidence, 'summary.analysis.0')).toEqual([]);
    expect(evidenceFromExactSource(summary.evidence, undefined)).toEqual([]);
    expect(evidenceFromExactSource(summary.evidence, 'sections.1.paragraphs.1').map((item) => item.source)).toEqual(['timing']);
  });

  it('omits chapter evidence when customer copy has no deterministic source link', () => {
    const source = deterministicReport();
    source.sections = [];
    source.summary.analysis = [
      '관계에서는 말의 강도보다 약속을 실제로 지키는 행동을 먼저 확인해야 합니다.',
      '감정이 커질수록 상대 반응 하나보다 반복되는 만남의 흐름을 함께 살펴보세요.',
    ];
    source.keyTakeaways = [];
    source.questionAnswers = [];

    const model = buildMzLoveViewModel(source);

    expect(model.chapters.flatMap((chapter) => chapter.evidence)).toEqual([]);
    expect(model.cover.evidenceCount).toBe(0);
  });

  it('adds a visible limitation when birth time is unknown', () => {
    const summary = adaptSajuReportToMzLoveSummary(deterministicReport(), { birthTimeKnown: false });
    expect(summary.birthTimeKnown).toBe(false);
    expect(summary.uncertainty.join(' ')).toContain('출생시간 미입력');
  });

  it('keeps engine prose, questions, and headings out of every customer narrative field', () => {
    const source = deterministicReport();
    const userQuestion = '제가 적은 이 질문 문장은 결과 대사로 재사용되나요?';
    const qaQuestion = '상대가 내 마음을 알아주는지 묻는 사용자 질문 문장';
    const summaryTitle = '고객 대사로 쓰면 안 되는 요약 섹션 제목';
    const takeawayTitle = '고객 대사로 쓰면 안 되는 핵심 카드 제목';
    const qaTitle = '고객 대사로 쓰면 안 되는 질문답변 제목';
    const productSectionTitle = '고객 대사로 쓰면 안 되는 연애 섹션 제목';
    const technicalCopy = '근거 ID CALC-77은 계산 audit 결과에 따라 유보 후 활성화됩니다.';
    const safeSummary = '호감이 커질수록 상대의 말보다 약속을 지키는 흐름을 함께 살펴보세요.';
    const safeTakeaway = '설렘의 속도와 관계의 책임감은 서로 다른 기준으로 확인해야 합니다.';
    const safeProductBody = '관계를 오래 이어 가려면 불편한 대화 뒤에 다시 연결하는 행동을 보세요.';
    const safeQaAnalysis = '갈등이 생겼을 때 회피하지 않고 해결 순서를 합의하는지 관찰하세요.';
    const safeAction = '원하는 관계의 이름과 기다릴 수 있는 기간을 직접 말해 보세요.';

    source.questionPreview = userQuestion;
    source.summary = {
      title: summaryTitle,
      analysis: [technicalCopy, safeSummary],
      advice: ['연락 한 번보다 일주일 동안 이어지는 행동을 기록해 보세요.'],
    };
    source.keyTakeaways = [{ title: takeawayTitle, body: safeTakeaway }];
    source.questionAnswers = [{
      question: qaQuestion,
      title: qaTitle,
      analysis: safeQaAnalysis,
      advice: [safeAction],
    }];
    source.sections = [
      { id: 'compatibility-evidence-v2', title: '관계 계산 근거', paragraphs: [technicalCopy] },
      { id: 'calculation-audit-v2', title: 'Calculation audit', paragraphs: ['engineMeta validationStatus 계산 감사 로그입니다.'] },
      { id: 'love', title: productSectionTitle, paragraphs: [safeProductBody] },
    ];
    source.actionPlan = {
      ...source.actionPlan,
      title: '고객 대사로 쓰면 안 되는 실행 섹션 제목',
      dos: [safeAction],
      priorities: ['이번 주에는 약속과 변경 대안을 나누어 기록해 보세요.'],
      avoids: ['답장 속도만으로 상대의 관계 의지를 결론 내리지 마세요.'],
    };

    const model = buildMzLoveViewModel(source);
    const narrative = model.chapters.flatMap((chapter) => [
      chapter.factBomb,
      chapter.interpretation,
      chapter.realLifeScene,
      chapter.action,
    ]);
    const combined = narrative.join('\n');

    [
      technicalCopy,
      userQuestion,
      qaQuestion,
      summaryTitle,
      takeawayTitle,
      qaTitle,
      productSectionTitle,
      'engineMeta validationStatus 계산 감사 로그입니다.',
    ].forEach((forbidden) => expect(combined).not.toContain(forbidden));
    ['근거 ID', '유보', '활성화됩니다', 'calculation audit', 'engineMeta'].forEach((marker) => {
      expect(combined.toLocaleLowerCase()).not.toContain(marker.toLocaleLowerCase());
    });

    expect(combined).toContain(safeSummary);
    expect(combined).toContain(safeTakeaway);
    expect(combined).toContain(safeProductBody);
    expect(combined).toContain(safeQaAnalysis);
    expect(combined).toContain('이번 달에는 새 접점 두 곳을 열되');
    expect(adaptSajuReportToMzLoveSummary(source).evidence.some((item) => item.description === technicalCopy)).toBe(true);
    expect(model.chapters.flatMap((chapter) => chapter.evidence).some((item) => item.description === technicalCopy)).toBe(false);
  });

  it('requires two chapter-specific signals before reusing source prose', () => {
    const source = deterministicReport();
    const weakTimingCopy = '마음은 움직이지만 확신이 늦게 따라오는 흐름입니다.';
    const weakNextPartnerAction = '외로움 때문에 관계를 열기';
    source.summary.analysis = [weakTimingCopy];
    source.summary.advice = [weakNextPartnerAction];
    source.keyTakeaways = [];
    source.questionAnswers = [];
    source.sections = [];
    source.actionPlan = {
      ...source.actionPlan,
      priorities: [],
      dos: [],
      avoids: [weakNextPartnerAction],
    };

    const model = buildMzLoveViewModel(source);
    const timing = model.chapters.find((chapter) => chapter.id === 'twelve-month-timing');
    const nextPartner = model.chapters.find((chapter) => chapter.id === 'next-partner');

    expect(timing?.interpretation).toContain('연애 흐름');
    expect(timing?.interpretation).not.toBe(weakTimingCopy);
    expect(nextPartner?.action).toContain('관계 행동 세 가지');
    expect(nextPartner?.action).not.toBe(weakNextPartnerAction);
  });

  it('keeps every one of the thirteen customer chapters love-focused when all source areas contain engine and business prose', () => {
    const source = deterministicReport();
    const contaminated = [
      '억부 관점에서 연애 후보: 화(84%)로 판정합니다.',
      '규칙: MRE-V2-YONGSIN-001은 관계 근거 3건을 사용합니다.',
      '교차 합·충·형·파·해 관계 10건, 십성 활성 14건으로 연애를 봅니다.',
      '대표 결과물 하나를 공개하고 연애 고객 반응을 확인하세요.',
      '가격, 일정, 제공 범위를 정리하면 관계가 안정됩니다.',
      '계약, 고정비, 책임 범위를 확인하고 상대를 만나세요.',
      '매출과 정산, 반복 고객을 늘리면 사랑도 좋아집니다.',
      '합·삼합·방합의 화기 성립은 존재 관계와 분리했으며 월령·투간·통근 검증이 추가로 필요합니다.',
    ];

    source.summary = { title: '오염된 요약', analysis: [...contaminated], advice: [...contaminated] };
    source.keyTakeaways = contaminated.map((body, index) => ({ title: `오염 카드 ${index}`, body }));
    source.questionAnswers = contaminated.map((analysis, index) => ({
      question: `오염 질문 ${index}`,
      title: `오염 답변 ${index}`,
      analysis,
      advice: [contaminated[(index + 1) % contaminated.length]],
    }));
    source.sections = [{
      id: 'compatibility-evidence-v2',
      title: '오염된 관계 원문',
      paragraphs: [...contaminated],
      cards: contaminated.map((body, index) => ({ title: `카드 ${index}`, body })),
      details: contaminated.map((content, index) => ({ summary: `상세 ${index}`, content })),
      callout: { title: '오염 강조', body: contaminated[0], tone: 'warning' },
    }];
    source.actionPlan = {
      ...source.actionPlan,
      priorities: [...contaminated],
      dos: [...contaminated],
      avoids: [...contaminated],
    };

    const model = buildMzLoveViewModel(source);
    const chapterStrings = model.chapters.flatMap((chapter) => [
      chapter.eyebrow,
      chapter.title,
      chapter.subtitle ?? '',
      chapter.factBomb,
      chapter.interpretation,
      chapter.realLifeScene,
      chapter.counterpoint,
      chapter.checkSignal,
      chapter.action,
      chapter.characterLine,
      chapter.scene?.alt ?? '',
    ]);
    const actionStrings = [
      ...model.redFlags,
      ...model.greenFlags,
      ...model.actionPlan.stop,
      ...model.actionPlan.start,
      ...model.actionPlan.check,
      ...model.actionPlan.thirtyDays.flatMap((mission) => [mission.title, mission.task]),
      ...model.disclaimers,
    ];
    const customerCopy = [
      model.cover.title,
      model.cover.subtitle,
      model.cover.eyebrow,
      model.cover.relationshipLabel,
      ...model.cover.keywords,
      ...chapterStrings,
      ...actionStrings,
    ].join('\n');
    const forbidden = /억부|후보\s*:|규칙\s*:|MRE-|근거\s*\d+\s*건|교차\s*합|십성\s*활성|삼합|방합|화기\s*성립|월령|투간|통근|대표\s*결과물|가격|제공\s*범위|계약|고정비|책임\s*범위|매출|정산|반복\s*고객|고객/u;

    expect(model.chapters).toHaveLength(13);
    expect(model.chapters.every((chapter) => [
      chapter.factBomb,
      chapter.interpretation,
      chapter.realLifeScene,
      chapter.counterpoint,
      chapter.checkSignal,
      chapter.action,
      chapter.characterLine,
    ].every((text) => text.trim().length > 0))).toBe(true);
    expect(customerCopy).not.toMatch(forbidden);
    contaminated.forEach((text) => expect(customerCopy).not.toContain(text));
    expect(model.chapters.flatMap((chapter) => chapter.evidence)).toEqual([]);
    expect(adaptSajuReportToMzLoveSummary(source).evidence.some((item) => contaminated.includes(item.description))).toBe(true);
  });

  it('rejects safe-looking but off-topic copy and keeps every chapter lead on its own relationship topic', () => {
    const offTopicCommunication = '답장 간격과 연락 말투 때문에 메시지를 여러 번 다시 읽습니다.';
    const fixture = MZ_LOVE_FIXTURES_BY_KEY.dating.report;
    const report = {
      ...fixture,
      chapters: fixture.chapters.map((chapter) => ({
        ...chapter,
        result: {
          ...chapter.result,
          factBomb: offTopicCommunication,
          interpretation: offTopicCommunication,
          realLifeScene: offTopicCommunication,
          counterpoint: offTopicCommunication,
          checkSignal: offTopicCommunication,
          action: offTopicCommunication,
          characterLine: { ...chapter.result.characterLine, text: offTopicCommunication },
        },
      })),
    };
    const topics = {
      'love-self': /연애|호감|감정|마음|판단|가능성/u,
      'repeated-attraction': /반복|설렘|설레|끌림|패턴|불안/u,
      'attracted-partner': /첫인상|끌리는|매력|호기심|호감|관계/u,
      'lasting-partner': /오래|장기|지속|안정|책임|갈등|회복/u,
      'attraction-comparison': /설렘|안정|비교|차이|각각|다른 기준/u,
      'next-partner': /다음|인연|앞으로 만날|관계/u,
      'meeting-scenes': /만남|만나|장소|생활 반경|소개|모임|접점|인연/u,
      'twelve-month-timing': /12개월|개월|이번 달|매달|달|시기|흐름|구간|타이밍|속도 조절|앞으로/u,
      'communication-pattern': /연락|답장|메시지|대화|말투|표현/u,
      'relationship-status': /관계|합의|방향|기다릴|재회|이별/u,
      'relationship-flags': /신호|경고|위험|안정|경계|불안|신뢰|회복|사과/u,
      'action-plan': /행동|실천|기록|질문|선택|연습|점검|한 주|30일/u,
      'final-fact': /마지막|결국|선택|관계|사랑|함께/u,
    } as const;

    const model = buildMzLoveViewModel(report);

    expect(model.chapters).toHaveLength(13);
    model.chapters.forEach((chapter) => {
      expect(chapter.factBomb, `${chapter.id} factBomb`).toMatch(topics[chapter.id]);
      expect(chapter.interpretation, `${chapter.id} interpretation`).toMatch(topics[chapter.id]);
      if (chapter.id !== 'communication-pattern') {
        expect(chapter.factBomb).not.toBe(offTopicCommunication);
        expect(chapter.interpretation).not.toBe(offTopicCommunication);
      }
    });

    const timing = model.chapters.find((chapter) => chapter.id === 'twelve-month-timing');
    expect(timing?.factBomb).toContain('흐름');
    expect(timing?.interpretation).toContain('연애 흐름');
    expect(timing?.evidence).toEqual([]);
  });
});
