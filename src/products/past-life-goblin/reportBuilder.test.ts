import { describe, expect, it } from 'vitest';
import type { IntakeFormData } from '../../api/mockData';
import type { PastLifeProfile, ReportSection } from '../../lib/saju/report';
import { buildSajuReport } from '../../lib/saju/reportBuilder';
import {
  PAST_LIFE_PRODUCT_ID,
  PAST_LIFE_REPORT_TOPIC_COUNT,
  PAST_LIFE_REPORT_VOLUMES,
  formatPastLifeReportTopic
} from './contract';
import {
  buildPastLifeGoblinReport,
  ensurePastLifeGoblinReport,
  hasCompletePastLifeGoblinReport
} from './reportBuilder';

const ENGINE_EVIDENCE_IDS = [
  'calculation-audit-v2',
  'expert-evidence-v2',
  'temporal-evidence-v2',
  'compatibility-evidence-v2'
] as const;

function makeFormData(): Partial<IntakeFormData> {
  return {
    name: '김도윤',
    gender: 'male',
    calendar: 'solar',
    isLeapMonth: false,
    birthDate: '1994-05-17',
    birthTime: '21:30',
    isUnknownTime: false,
    q1: '관계에서 같은 역할을 반복하는 이유가 궁금해요.',
    q2: '지금 바꿀 수 있는 선택은 무엇인가요?'
  };
}

function makePastLifeReport() {
  return buildSajuReport(PAST_LIFE_PRODUCT_ID, makeFormData());
}

describe('past-life goblin report builder', () => {
  it('builds the five contracted volumes and all 26 topics in contract order', () => {
    const report = buildPastLifeGoblinReport(makePastLifeReport());
    const volumeSections = report.sections.filter((section) => section.id.startsWith('pastlife-'));

    expect(volumeSections.map((section) => section.id)).toEqual(
      PAST_LIFE_REPORT_VOLUMES.map((volume) => volume.sectionId)
    );
    expect(volumeSections.map((section) => section.title)).toEqual(
      PAST_LIFE_REPORT_VOLUMES.map((volume) => `${volume.volume} ${volume.title}`)
    );
    expect(volumeSections.map((section) => section.subtitle)).toEqual(
      PAST_LIFE_REPORT_VOLUMES.map((volume) => volume.line)
    );

    const details = volumeSections.flatMap((section) => section.details ?? []);
    expect(details).toHaveLength(PAST_LIFE_REPORT_TOPIC_COUNT);
    expect(details.map((detail) => detail.summary)).toEqual(
      PAST_LIFE_REPORT_VOLUMES.flatMap((volume) =>
        volume.topics.map((topic) => formatPastLifeReportTopic(topic.number))
      )
    );
  });

  it('preserves immutable engine evidence sections and past-life-profile-v2 by reference', () => {
    const generated = makePastLifeReport();
    const evidenceSections: ReportSection[] = ENGINE_EVIDENCE_IDS.map((id) => ({
      id,
      title: id,
      paragraphs: [`${id}-immutable`]
    }));
    const profile = {
      version: 'past-life-profile-v2',
      seed: 240517
    } as PastLifeProfile;
    const report = {
      ...generated,
      sections: [
        ...generated.sections.filter((section) => !ENGINE_EVIDENCE_IDS.includes(section.id as never)),
        ...evidenceSections
      ],
      pastLifeProfile: profile
    };

    const built = buildPastLifeGoblinReport(report);

    expect(built.sections.slice(0, evidenceSections.length)).toEqual(evidenceSections);
    evidenceSections.forEach((section) => {
      expect(built.sections.find((candidate) => candidate.id === section.id)).toBe(section);
    });
    expect(built.pastLifeProfile).toBe(profile);
  });

  it('keeps a complete archived five-volume report unchanged', () => {
    const built = buildPastLifeGoblinReport(makePastLifeReport());
    const archivedSections = built.sections.map((section) => {
      if (section.id !== PAST_LIFE_REPORT_VOLUMES[0].sectionId || !section.details) return section;

      return {
        ...section,
        details: [
          { ...section.details[0], summary: '01. 보관된 맞춤형 봉인명' },
          ...section.details.slice(1)
        ]
      };
    });
    const archived = { ...built, sections: archivedSections };

    expect(hasCompletePastLifeGoblinReport(archived)).toBe(true);
    expect(ensurePastLifeGoblinReport(archived)).toBe(archived);
  });

  it('is a no-op for every other product contract', () => {
    const generalReport = buildSajuReport('general-signature', makeFormData());

    expect(buildPastLifeGoblinReport(generalReport)).toBe(generalReport);
    expect(ensurePastLifeGoblinReport(generalReport)).toBe(generalReport);
  });
});
