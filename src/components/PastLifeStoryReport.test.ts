import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../api/mockData';
import { buildPastLifeProfile } from '../lib/saju/pastLifeProfile';
import type { SajuReportData } from '../lib/saju/report';
import { buildSajuReport } from '../lib/saju/reportBuilder';
import {
  PAST_LIFE_PRODUCT_ID,
  PAST_LIFE_REPORT_VOLUMES
} from '../products/past-life-goblin/contract';
import { ensurePastLifeGoblinReport } from '../products/past-life-goblin/reportBuilder';
import PastLifeStoryReport from './PastLifeStoryReport';

const componentSource = readFileSync(
  new URL('./PastLifeStoryReport.tsx', import.meta.url),
  'utf8'
);

const INPUT: Partial<IntakeFormData> = {
  name: '해린',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  q1: '왜 끝난 관계에서도 같은 책임을 떠안나요?',
  q2: '다음 관계에서는 어떤 행동부터 바꿔야 하나요?',
  pastLifeTopic: '연애',
  repeatedScene: '상대의 사정을 먼저 이해하다가 결국 혼자 관계를 정리해요.',
  frequentEmotion: '억울함과 피로',
  hiddenDesire: '책임을 내려놓고도 사랑받고 싶어요.',
  chosenSymbol: '붉은 실',
  readingTone: '균형 있게'
};

function makeFixture() {
  const report = ensurePastLifeGoblinReport(
    buildSajuReport(PAST_LIFE_PRODUCT_ID, INPUT)
  );
  const profile = buildPastLifeProfile(report, INPUT);

  return { report, profile };
}

function renderReport(report: SajuReportData = makeFixture().report) {
  const profile = buildPastLifeProfile(report, INPUT);
  return renderToStaticMarkup(createElement(PastLifeStoryReport, { report, profile }));
}

function count(markup: string, fragment: string) {
  return markup.split(fragment).length - 1;
}

function imageTags(markup: string) {
  return markup.match(/<img\b[^>]*>/gu) ?? [];
}

describe('PastLifeStoryReport webtoon SSR', () => {
  it('renders five episodes, fifteen panels, and every contracted topic title', () => {
    const { report, profile } = makeFixture();
    const markup = renderToStaticMarkup(
      createElement(PastLifeStoryReport, { report, profile })
    );

    expect(count(markup, 'data-volume="')).toBe(5);
    expect(count(markup, 'data-panel="')).toBe(15);

    const topicTitles = PAST_LIFE_REPORT_VOLUMES.flatMap((volume) =>
      volume.topics.map((topic) => topic.title)
    );
    expect(topicTitles).toHaveLength(26);
    topicTitles.forEach((title) => expect(markup).toContain(`<h3>${title}</h3>`));
  });

  it('uses fifteen AVIF pictures and lazy-loads every image except the prologue', () => {
    const markup = renderReport();
    const images = imageTags(markup);
    const eagerImages = images.filter((tag) => tag.includes('loading="eager"'));
    const lazyImages = images.filter((tag) => tag.includes('loading="lazy"'));

    expect(count(markup, 'type="image/avif"')).toBe(15);
    expect(eagerImages).toHaveLength(1);
    expect(eagerImages[0]).toContain('/media/dokkaebi-guide-poster.webp');
    expect(lazyImages).toHaveLength(images.length - 1);

    images.forEach((tag) => {
      expect(tag).toMatch(/\bwidth="\d+"/u);
      expect(tag).toMatch(/\bheight="\d+"/u);
      expect(tag).toMatch(/\balt="[^"]*"/u);
    });
  });

  it('labels every symbolic scene and exposes five evidence formulas', () => {
    const markup = renderReport();

    expect(count(markup, '상징 장면 · 실제 전생 기록 아님')).toBe(15);
    expect(count(markup, '명리·현실 근거 5단계 펼쳐보기')).toBe(5);
    ['상징장면', '반복기질', '다른가능성', '현생확인', '오늘행동'].forEach(
      (label) => expect(count(markup, `<strong>${label}</strong>`)).toBe(5)
    );
  });

  it('carries the four-step input, both questions, and four 30-day missions into the report', () => {
    const markup = renderReport();

    [
      INPUT.pastLifeTopic,
      INPUT.repeatedScene,
      INPUT.frequentEmotion,
      INPUT.hiddenDesire,
      INPUT.q1,
      INPUT.q2
    ].forEach((value) => expect(markup).toContain(value));

    expect(count(markup, 'type="checkbox"')).toBe(4);
    expect(markup).toContain('1주차 · 바로 답하지 않기');
    expect(markup).toContain('2주차 · 감정에 이름 붙이기');
    expect(markup).toContain('3주차 · 경계를 먼저 말하기');
    expect(markup).toContain('4주차 · 달라진 증거 남기기');
    expect(markup).toContain('max="4"');
  });

  it('persists only filtered static mission IDs to localStorage', () => {
    expect(componentSource).toContain(
      "const RELEASE_MISSION_IDS = ['pause', 'name', 'boundary', 'record'] as const;"
    );
    expect(componentSource).toContain(
      'RELEASE_MISSION_IDS.includes(value as ReleaseMissionId)'
    );
    expect(componentSource).toContain(
      '<ReleaseMission key={report.serialNumber} report={report} profile={profile} />'
    );
    expect(renderReport()).toContain(
      '완료한 미션 ID와 익명 리포트 식별자만 이 기기에 보관합니다.'
    );

    const writes = [...componentSource.matchAll(
      /localStorage\.setItem\(\s*storageKey,\s*JSON\.stringify\(([^)]+)\)\s*\)/gu
    )];
    expect(writes.map((match) => match[1].trim())).toEqual(['completed']);
    expect(writes[0]?.[0]).not.toMatch(
      /profile|repeatedScene|frequentEmotion|hiddenDesire|customerName|birth/iu
    );
  });

  it('removes injected factual past-life certainty from archived report prose', () => {
    const { report, profile } = makeFixture();
    const unsafeClaim = '당신의 전생은 조선 시대의 궁중 무당이었습니다.';
    const unsafeReport: SajuReportData = {
      ...report,
      currentDayun: { ...report.currentDayun, summary: unsafeClaim },
      questionAnswers: report.questionAnswers.map((answer) => ({
        ...answer,
        analysis: unsafeClaim,
        advice: [unsafeClaim]
      })),
      sections: report.sections.map((section) => {
        if (section.id !== 'pastlife-seal' || !section.details) return section;
        return {
          ...section,
          details: [
            { ...section.details[0], content: unsafeClaim },
            ...section.details.slice(1)
          ]
        };
      })
    };
    const markup = renderToStaticMarkup(
      createElement(PastLifeStoryReport, { report: unsafeReport, profile })
    );

    expect(markup).not.toContain(unsafeClaim);
    expect(markup).toContain('과거를 증명하는 기록이 아닙니다');
    expect(
      unsafeReport.sections.find((section) => section.id === 'pastlife-seal')?.details?.[0]
        .content
    ).toBe(unsafeClaim);
  });
});
