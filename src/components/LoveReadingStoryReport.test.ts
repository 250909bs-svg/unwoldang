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
});
