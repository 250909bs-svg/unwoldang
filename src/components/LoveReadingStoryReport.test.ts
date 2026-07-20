import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { EvidenceTag } from '../lib/mz-love-fact/types';
import type { SajuReportData } from '../lib/saju/report';
import LoveReadingStoryReport, { EvidenceDisclosure } from './LoveReadingStoryReport';

const TRACEABLE_EVIDENCE: EvidenceTag = {
  id: 'compatibility-evidence-v2:1',
  label: '관계 근거',
  value: '약속을 실제로 지키는 행동을 확인합니다.',
  description: '같은 관계 분석 원문에서 가져온 설명입니다.',
  source: 'relationship',
  sourcePath: 'sections.0.paragraphs.1',
  immutable: true,
  confidence: 0.82,
};

function personalizedLoveReport(): SajuReportData {
  return {
    serialNumber: 'PERSONAL-LOVE-001',
    serviceId: 'love-reading',
    dayMaster: '정화',
    dayMasterElement: '화',
    strengthLabel: '중화',
    pillars: { year: '경오', month: '을유', day: '정묘', hour: '계사' },
    helpfulElements: ['목', '화'],
    cautiousElements: ['수'],
    tenGods: [{ label: '정관', value: 30 }],
    visibleTenGods: [],
    engineMeta: { calculationPrecision: 'exact-minute', uncertainty: [], confidence: 0.86 },
    customerName: '하린',
    questionPreview: '다음 연애 시기가 궁금해요.',
    createdAt: '2026-07-19T00:00:00.000Z',
    summary: {
      title: '연애 요약',
      analysis: ['새로운 관계는 말보다 반복되는 만남과 약속에서 시작됩니다.'],
      advice: ['마음이 움직일 때 다음 약속이 구체적으로 잡히는지 확인하세요.'],
    },
    keyTakeaways: [],
    questionAnswers: [
      {
        question: '다음 연애는 언제 시작될까요?',
        title: '관계가 움직이는 시기',
        analysis: '다음 사랑은 연락만 이어지는 순간보다 실제 만남과 약속이 반복되는 흐름에서 시작될 가능성이 큽니다.',
        advice: ['새로운 만남이 생기면 다음 약속이 구체적으로 이어지는지 확인하세요.'],
      },
      {
        question: '제가 놓치면 안 될 사람의 신호는 무엇인가요?',
        title: '오래 갈 관계의 신호',
        analysis: '불편한 대화 뒤에도 연락을 끊지 않고 관계를 회복하려는 행동이 오래 갈 사람의 중요한 신호입니다.',
        advice: ['말의 강도보다 약속과 경계 존중이 반복되는지 살펴보세요.'],
      },
    ],
    sections: [],
    actionPlan: {
      title: '실천',
      priorities: ['관계 행동 확인'],
      dos: ['원하는 관계를 짧게 말하기'],
      avoids: ['답장 속도 하나로 결론 내리기'],
      luckyDays: [],
      unluckyDays: [],
    },
    monthLuck: [],
  } as unknown as SajuReportData;
}

describe('LoveReadingStoryReport evidence disclosure', () => {
  it('omits the evidence section when no traceable evidence exists', () => {
    const disclosure = createElement(EvidenceDisclosure, { evidence: [] });
    expect(renderToStaticMarkup(disclosure)).toBe('');
  });

  it('uses a touch and keyboard accessible disclosure instead of title-only metadata', () => {
    const disclosure = createElement(EvidenceDisclosure, { evidence: [TRACEABLE_EVIDENCE] });
    const markup = renderToStaticMarkup(disclosure);

    expect(markup).toContain('<details>');
    expect(markup).toContain('<summary>');
    expect(markup).toContain('약속을 실제로 지키는 행동을 확인합니다.');
    expect(markup).toContain('같은 관계 분석 원문에서 가져온 설명입니다.');
    expect(markup).toContain('관계 분석 원문');
    expect(markup).not.toContain(' title=');
  });

  it('renders all thirteen chapters without leaking engine, audit, or business prose', () => {
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
    const report = {
      serialNumber: 'CONTAMINATED-LOVE-001',
      dayMaster: '갑목',
      dayMasterElement: '목',
      strengthLabel: '중화',
      pillars: { year: '경오', month: '을유', day: '갑자', hour: '정묘' },
      helpfulElements: ['수'],
      cautiousElements: ['금'],
      tenGods: [{ label: '정관', value: 30 }],
      visibleTenGods: [{ pillar: '월주', stem: '을', stemHanja: '乙', stemTenGod: '겁재', branch: '유', branchHanja: '酉', branchMainStem: '신', branchTenGod: '정관', reading: contaminated[0] }],
      engineMeta: { calculationPrecision: 'exact-minute', uncertainty: [], confidence: 0.84 },
      customerName: '달님',
      questionPreview: '새로운 연애에서 어떤 관계를 선택해야 할까요?',
      createdAt: '2026-07-18T00:00:00.000Z',
      summary: { title: '오염된 요약', analysis: [...contaminated], advice: [...contaminated] },
      keyTakeaways: contaminated.map((body, index) => ({ title: `오염 카드 ${index}`, body })),
      questionAnswers: contaminated.map((analysis, index) => ({
        question: `오염 질문 ${index}`,
        title: `오염 답변 ${index}`,
        analysis,
        advice: [contaminated[(index + 1) % contaminated.length]],
      })),
      sections: [{ id: 'compatibility-evidence-v2', title: '오염 근거', paragraphs: [...contaminated] }],
      actionPlan: { title: '오염 행동', priorities: [...contaminated], dos: [...contaminated], avoids: [...contaminated], luckyDays: [], unluckyDays: [] },
      monthLuck: [{ year: 2026, month: 8, ganzhi: '병신', score: 84, summary: contaminated[0], focus: contaminated[4], warning: contaminated[2] }],
    } as unknown as SajuReportData;

    const markup = renderToStaticMarkup(createElement(LoveReadingStoryReport, { report }));
    const forbidden = /억부|후보\s*:|규칙\s*:|MRE-|근거\s*\d+\s*건|교차\s*합|십성\s*활성|삼합|방합|화기\s*성립|월령|투간|통근|대표\s*결과물|가격|제공\s*범위|계약|고정비|책임\s*범위|매출|정산|반복\s*고객|고객/u;

    expect(markup.match(/id="mz-love-chapter-title-\d+"/g)).toHaveLength(13);
    expect(markup).not.toMatch(forbidden);
    contaminated.forEach((text) => expect(markup).not.toContain(text));
    expect(markup).toContain('대화와 만남의 접점을 한 번 더 넓혀 보기 좋은 흐름이에요.');
    expect(markup).toContain('13개 연애 챕터');
  });

  it('shows the selected focus and both exact customer questions as a paid webtoon consultation', () => {
    const report = personalizedLoveReport();
    const customerQuestions = [
      '다음 연애는 언제 시작될까요?',
      '제가 놓치면 안 될 사람의 신호는 무엇인가요?',
    ];
    const markup = renderToStaticMarkup(createElement(LoveReadingStoryReport, {
      report,
      relationshipStatus: 'single',
      relationshipDuration: 'under3',
      birthTimeKnown: true,
      loveFocus: 'next-love-timing',
      customerQuestions,
    }));

    expect(markup).toContain('다음 연애를 하는 시기');
    expect(markup).toContain('내가 고른 1순위 해석 · 지금부터 12개월 연애 흐름');
    expect(markup).toContain('“다음 연애는 언제 시작될까요?”');
    expect(markup).toContain('“제가 놓치면 안 될 사람의 신호는 무엇인가요?”');
    expect(markup).toContain('실제 만남과 약속이 반복되는 흐름');
    expect(markup).toContain('관계를 회복하려는 행동');
    expect(markup).toContain('action-plan-calendar.avif');
    expect(markup).toContain('report-seal-final.avif');
    expect(markup.match(/명리·현실 근거 5단계 펼쳐보기/g)).toHaveLength(13);
  });
});
