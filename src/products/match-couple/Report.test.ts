import { describe, expect, it } from 'vitest';
import type { SajuReportData } from '../../lib/saju/report';
import { canBuildMatchCoupleModel, createArchivedMatchCoupleReport } from './Report';
import type { MatchCoupleReportModel } from './types';

describe('match-couple report archive privacy', () => {
  it('keeps the generated answers but replaces contextualized server questions with the two raw questions', () => {
    const canonicalReport = {
      birthLabel: '1992-09-09 / 10:24 / 양력 / 여성',
      questionPreview: '[주요 갈등] 민감한 갈등 원문',
      metaGrid: [
        { label: '기본정보', value: '1992-09-09 / 10:24' },
        { label: '질문 요약', value: '민감한 맥락' }
      ],
      sections: [{ id: 'private', title: '민감한 섹션', content: ['민감한 갈등 원문'] }],
      questionAnswers: [
        {
          question: '[주요 갈등] 민감한 갈등 원문\n[질문 1] 대화는 어떻게 할까요?',
          title: '첫 답변',
          analysis: '첫 분석',
          advice: ['첫 조언']
        },
        {
          question: '[알고 싶은 점] 민감한 맥락\n[질문 2] 역할은 어떻게 나눌까요?',
          title: '둘째 답변',
          analysis: '둘째 분석',
          advice: ['둘째 조언']
        }
      ]
    } as unknown as SajuReportData;
    const model = {
      questions: ['대화는 어떻게 할까요?', '역할은 어떻게 나눌까요?'],
      context: {
        version: 'match-couple-v1',
        relationshipStatus: 'dating',
        relationshipDuration: 'under3',
        majorConflict: '민감한 갈등 원문',
        desiredInsight: '민감한 맥락',
        questions: ['대화는 어떻게 할까요?', '역할은 어떻게 나눌까요?'],
        selfLocationUnknown: false,
        partnerLocationUnknown: false,
        selfSolarTimeCorrectionRequested: true,
        partnerSolarTimeCorrectionRequested: true
      }
    } as MatchCoupleReportModel;

    const archived = createArchivedMatchCoupleReport(canonicalReport, model);
    const archivedModel = archived?.matchCoupleModel as MatchCoupleReportModel;

    expect(archived?.questionAnswers.map((answer) => answer.question)).toEqual(model.questions);
    expect(archived?.questionAnswers[0].analysis).toBe('첫 분석');
    expect(archivedModel).not.toBe(model);
    expect(archivedModel.context.majorConflict).toBe('');
    expect(archivedModel.context.desiredInsight).toBe('');
    expect(archived?.birthLabel).toBe('');
    expect(archived?.metaGrid).toEqual([]);
    expect(archived?.sections).toEqual([]);
    expect(JSON.stringify(archived)).not.toContain('민감한 갈등 원문');
    expect(JSON.stringify(archived)).not.toContain('민감한 맥락');
    expect(JSON.stringify(archived)).not.toContain('1992-09-09');
  });

  it('drops server answers when restored uncertainty withholds the compatibility model', () => {
    const canonicalReport = {
      questionAnswers: [{ question: '서버용 무보정 질문', title: '답변', analysis: '분석', advice: [] }]
    } as unknown as SajuReportData;
    const model = {
      questions: ['원문 질문', '둘째 질문'],
      guidance: null
    } as MatchCoupleReportModel;

    expect(createArchivedMatchCoupleReport(canonicalReport, model)?.questionAnswers).toEqual([]);
  });

  it('only rebuilds a model for local preview or a token-bearing new generation', () => {
    expect(canBuildMatchCoupleModel('local-preview', true)).toBe(true);
    expect(canBuildMatchCoupleModel('new-generation', false)).toBe(true);
    expect(canBuildMatchCoupleModel('archive-replay', false)).toBe(false);
    expect(canBuildMatchCoupleModel('locked', false)).toBe(false);
  });
});
