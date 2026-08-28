import { describe, expect, it } from 'vitest';
import { isMatchCoupleReportModel } from './modelValidation';

function validArchiveModel(): Record<string, unknown> {
  return {
    version: 'match-couple-report-v1',
    names: ['본인', '상대방'],
    relationshipSummary: '관계 요약',
    context: {
      version: 'match-couple-v1',
      relationshipStatus: 'dating',
      relationshipDuration: 'under3',
      majorConflict: '',
      desiredInsight: '',
      questions: ['질문 1', '질문 2'],
      selfLocationUnknown: true,
      partnerLocationUnknown: true,
      selfSolarTimeCorrectionRequested: false,
      partnerSolarTimeCorrectionRequested: false
    },
    people: [null, null],
    overview: null,
    relations: [{ id: 'combine', label: '합', items: [] }],
    guidance: null,
    cautionWords: [],
    cautionActions: [],
    relationshipRules: [],
    experiment: [{ days: '1~7일', title: '관찰', action: '기록', check: '점검' }],
    questions: ['질문 1', '질문 2'],
    limitations: [],
    evidenceIds: [],
    generatedFrom: { calendarEngine: 'calendar-v2.0.0', compatibilityEngine: null }
  };
}

describe('match-couple archived model validation', () => {
  it('accepts a structurally complete limited report', () => {
    expect(isMatchCoupleReportModel(validArchiveModel())).toBe(true);
  });

  it('rejects null relation and experiment entries before rendering', () => {
    const relationCorrupt = validArchiveModel();
    relationCorrupt.relations = [{ id: 'combine', label: '합', items: [null] }];

    const experimentCorrupt = validArchiveModel();
    experimentCorrupt.experiment = [null];

    expect(isMatchCoupleReportModel(relationCorrupt)).toBe(false);
    expect(isMatchCoupleReportModel(experimentCorrupt)).toBe(false);
  });

  it('rejects malformed nested person facts', () => {
    const corrupt = validArchiveModel();
    corrupt.people = [
      {
        id: 'self',
        name: '본인',
        dayMaster: '갑',
        dayMasterElement: '목',
        pillars: null,
        fiveElements: [null],
        tenGods: [],
        spousePalace: {},
        availability: { status: 'available' }
      },
      null
    ];

    expect(isMatchCoupleReportModel(corrupt)).toBe(false);
  });
});
