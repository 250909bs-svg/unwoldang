import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import { buildPastLifeProfile } from '../../lib/saju/pastLifeProfile';
import type { PastLifeProfile, SajuReportData } from '../../lib/saju/report';
import { buildSajuReport } from '../../lib/saju/reportBuilder';
import { PAST_LIFE_REPORT_TOPIC_COUNT } from './contract';
import { buildPastLifeGoblinReport } from './reportBuilder';
import {
  PAST_LIFE_READING_STEP_IDS,
  buildPastLifeWebtoonViewModel
} from './webtoonViewModel';

const input: Partial<IntakeFormData> = {
  name: '해린',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  q1: '왜 같은 관계 역할을 반복하나요?',
  q2: '오늘 바꿀 선택은 무엇인가요?',
  pastLifeTopic: '재회 후유증',
  repeatedScene: '상대의 사정을 먼저 이해하다가 결국 혼자 관계를 정리해요.',
  frequentEmotion: '억울함과 피로',
  hiddenDesire: '책임을 내려놓고도 사랑받고 싶어요.',
  chosenSymbol: '붉은 실',
  readingTone: '균형 있게'
};

function fixture() {
  const report = buildPastLifeGoblinReport(buildSajuReport('past-life-goblin', input));
  const profile = buildPastLifeProfile(report, input);
  return { report, profile };
}

describe('past-life webtoon view model', () => {
  it('builds five volumes, fifteen panels, five reading steps, and all 26 topics', () => {
    const { report, profile } = fixture();
    const viewModel = buildPastLifeWebtoonViewModel(report, profile);
    const panels = viewModel.volumes.flatMap((volume) => volume.panels);
    const topics = panels.flatMap((panel) => panel.topics);

    expect(viewModel.volumes).toHaveLength(5);
    expect(panels).toHaveLength(15);
    expect(new Set(panels.map((panel) => panel.artwork.src)).size).toBe(15);
    expect(topics.map((topic) => topic.number)).toEqual(
      Array.from({ length: PAST_LIFE_REPORT_TOPIC_COUNT }, (_, index) => index + 1)
    );

    viewModel.volumes.forEach((volume) => {
      expect(volume.panels).toHaveLength(3);
      expect(volume.readingSteps.map((step) => step.id)).toEqual(
        PAST_LIFE_READING_STEP_IDS
      );
      expect(volume.readingSteps.map((step) => step.label)).toEqual([
        '상징장면',
        '반복기질',
        '다른가능성',
        '현생확인',
        '오늘행동'
      ]);
      expect(volume.evidence.length).toBeGreaterThanOrEqual(3);
    });
  });

  it('matches shuffled numbered prose to its canonical topic and keeps custom titles', () => {
    const { report, profile } = fixture();
    const sealSection = report.sections.find((section) => section.id === 'pastlife-seal');

    if (!sealSection?.details || sealSection.details.length < 2) {
      throw new Error('Expected the seal volume fixture to contain at least two details.');
    }

    const firstDetail = sealSection.details[0]!;
    const secondDetail = sealSection.details[1]!;
    const shuffledReport: SajuReportData = {
      ...report,
      sections: report.sections.map((section) =>
        section === sealSection
          ? {
              ...section,
              details: [
                {
                  ...secondDetail,
                  summary: '02. 고객 맞춤 상징 인물',
                  content: '두 번째 번호의 고유 본문입니다.'
                },
                {
                  ...firstDetail,
                  summary: '01. 고객 맞춤 봉인명',
                  content: '첫 번째 번호의 고유 본문입니다.'
                },
                ...section.details.slice(2)
              ]
            }
          : section
      )
    };

    const topics = buildPastLifeWebtoonViewModel(shuffledReport, profile).volumes[0].panels
      .flatMap((panel) => panel.topics);

    expect(topics.find((topic) => topic.number === 1)).toEqual({
      number: 1,
      title: '고객 맞춤 봉인명',
      content: '첫 번째 번호의 고유 본문입니다.'
    });
    expect(topics.find((topic) => topic.number === 2)).toEqual({
      number: 2,
      title: '고객 맞춤 상징 인물',
      content: '두 번째 번호의 고유 본문입니다.'
    });
  });

  it('uses index fallback only for numberless legacy details', () => {
    const { report, profile } = fixture();
    const sealSection = report.sections.find((section) => section.id === 'pastlife-seal');

    if (!sealSection?.details || sealSection.details.length < 2) {
      throw new Error('Expected the seal volume fixture to contain at least two details.');
    }

    const legacyReport: SajuReportData = {
      ...report,
      sections: report.sections.map((section) =>
        section === sealSection
          ? {
              ...section,
              details: [
                {
                  ...section.details[0]!,
                  summary: '레거시 맞춤 제목',
                  content: '번호 없는 첫 번째 레거시 본문입니다.'
                },
                {
                  ...section.details[1]!,
                  summary: '99. 잘못된 번호 제목',
                  content: '두 번째 자리에 놓인 잘못된 번호 본문입니다.'
                },
                ...section.details.slice(2)
              ]
            }
          : section
      )
    };

    const topics = buildPastLifeWebtoonViewModel(legacyReport, profile).volumes[0].panels
      .flatMap((panel) => panel.topics);
    const topicOne = topics.find((topic) => topic.number === 1);
    const topicTwo = topics.find((topic) => topic.number === 2);

    expect(topicOne).toMatchObject({
      title: '레거시 맞춤 제목',
      content: '번호 없는 첫 번째 레거시 본문입니다.'
    });
    expect(topicTwo?.title).not.toBe('잘못된 번호 제목');
    expect(topicTwo?.content).not.toBe('두 번째 자리에 놓인 잘못된 번호 본문입니다.');
  });

  it('highlights the intake focus and exposes only evidence copied from report or profile fields', () => {
    const { report, profile } = fixture();
    const viewModel = buildPastLifeWebtoonViewModel(report, profile);
    const focused = viewModel.volumes.filter((volume) => volume.isFocused);
    const sealEvidence = viewModel.volumes[0].evidence;
    const relationshipEvidence = viewModel.volumes[1].evidence;
    const presentEvidence = viewModel.volumes[3].evidence;

    expect(viewModel.focus).toEqual({ label: '재회 후유증', volumeId: 'karma' });
    expect(focused.map((volume) => volume.id)).toEqual(['karma']);
    expect(sealEvidence.find((item) => item.id === 'day-master')?.value).toBe(
      `${report.dayMaster} · ${report.dayMasterElement}`
    );
    expect(relationshipEvidence.find((item) => item.id === 'customer-scene')?.value).toBe(
      profile.repeatedScene
    );
    expect(presentEvidence.find((item) => item.id === 'current-dayun')?.value).toBe(
      report.currentDayun.name
    );
    expect(viewModel.volumes.flatMap((volume) => volume.evidence).every(
      (item) => item.sourcePath.length > 0
    )).toBe(true);
  });

  it('marks a missing birth time and carries the limitation into engine evidence', () => {
    const { report, profile } = fixture();
    const unknownTimeReport: SajuReportData = {
      ...report,
      pillars: { ...report.pillars, hour: null },
      engineMeta: report.engineMeta
        ? { ...report.engineMeta, calculationPrecision: 'unknown' }
        : undefined
    };
    const viewModel = buildPastLifeWebtoonViewModel(unknownTimeReport, profile);
    const engineEvidence = viewModel.volumes
      .flatMap((volume) => volume.evidence)
      .filter((item) => item.source !== 'customer-input');

    expect(viewModel.birthTimeKnown).toBe(false);
    expect(viewModel.limitation).toContain('출생시간이 없어 시주를 제외');
    expect(engineEvidence.length).toBeGreaterThan(0);
    engineEvidence.forEach((item) => expect(item.uncertainty).toBe(viewModel.limitation));
    expect(viewModel.volumes[0].readingSteps[1].value).toContain('출생시간이 없어');
  });

  it('sanitizes unsafe archived prose and dialogue without mutating source data', () => {
    const { report, profile } = fixture();
    const unsafeClaim = '당신의 전생은 조선 왕실의 재판관이었습니다.';
    const unsafeSections = report.sections.map((section) => {
      if (section.id !== 'pastlife-seal' || !section.details) return section;
      return {
        ...section,
        details: [{ ...section.details[0], content: unsafeClaim }, ...section.details.slice(1)]
      };
    });
    const unsafeReport: SajuReportData = { ...report, sections: unsafeSections };
    const unsafeProfile: PastLifeProfile = {
      ...profile,
      storyBeats: profile.storyBeats.map((beat, index) =>
        index === 0 ? { ...beat, scene: unsafeClaim, goblinLine: unsafeClaim } : beat
      )
    };

    const viewModel = buildPastLifeWebtoonViewModel(unsafeReport, unsafeProfile);
    const renderedCopy = JSON.stringify(viewModel);

    expect(renderedCopy).not.toContain(unsafeClaim);
    expect(renderedCopy).toContain('상징 서사');
    expect(unsafeReport.sections.find((section) => section.id === 'pastlife-seal')?.details?.[0].content)
      .toBe(unsafeClaim);
    expect(unsafeProfile.storyBeats[0].scene).toBe(unsafeClaim);
  });

  it('rejects a report belonging to another product contract', () => {
    const { report, profile } = fixture();
    const otherProduct = { ...report, serviceId: 'general-signature' } as SajuReportData;

    expect(() => buildPastLifeWebtoonViewModel(otherProduct, profile)).toThrow(
      'Past-life webtoon view model cannot render product: general-signature'
    );
  });
});
