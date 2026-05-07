import type { IntakeFormData, ServiceId } from '../../api/mockData';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { normalizeFormDataWithKasi } from './kasiCalendarService';
import {
  buildPremiumSajuPromptContext,
  PREMIUM_SAJU_PROMPT_VERSION,
  PREMIUM_SAJU_REPORT_MODE,
  PREMIUM_SAJU_SYSTEM_PROMPT
} from '../saju/premiumReportPrompt';
import {
  type ActionPlan,
  type QuestionAnswerBlock,
  type ReportCard,
  type ReportDetail,
  type ReportSection,
  type SajuReportData
} from '../saju/report';
import { buildSajuReport } from '../saju/reportBuilder';

type RelationshipStatus = IntakeFormData['relationshipStatus'] | null | undefined;
type RelationshipDuration = IntakeFormData['relationshipDuration'] | null | undefined;

export type ReportRequestBody = {
  serviceId?: ServiceId;
  payload?: {
    user?: {
      name?: string;
      gender?: 'male' | 'female';
    };
    birth?: {
      calendar?: 'solar' | 'lunar';
      isLeapMonth?: boolean;
      date?: string;
      time?: string | null;
      isUnknownTime?: boolean;
    };
    relationship?: {
      status?: RelationshipStatus;
      duration?: RelationshipDuration;
    };
    questions?: string[];
  };
  reportMode?: string;
  promptVersion?: string;
  debug?: boolean;
};

type GeminiDraft = {
  heroNote?: string;
  legalNotice?: string[];
  summary?: Partial<SajuReportData['summary']>;
  keyTakeaways?: Partial<ReportCard>[];
  questionAnswers?: Partial<QuestionAnswerBlock>[];
  sections?: Array<Partial<ReportSection> & { id: string; details?: Partial<ReportDetail>[]; cards?: Partial<ReportCard>[] }>;
  currentDayun?: Partial<SajuReportData['currentDayun']>;
  nextDayun?: Partial<SajuReportData['nextDayun']>;
  actionPlan?: Partial<ActionPlan>;
};

export type ReportResponsePayload = {
  provider: 'gemini';
  reportMode: string;
  promptVersion: string;
  report: SajuReportData;
  debug?: {
    deterministicBasis: ReturnType<typeof buildDeterministicSajuBasis>;
  };
};

type EnvRecord = Record<string, string | undefined>;

function getEnv() {
  const maybeProcess = globalThis as {
    process?: {
      env?: EnvRecord;
    };
  };

  return maybeProcess.process?.env ?? {};
}

export class ReportRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ReportRequestError';
    this.status = status;
  }
}

function toFormData(body: ReportRequestBody): Partial<IntakeFormData> {
  return {
    name: body.payload?.user?.name || '',
    gender: body.payload?.user?.gender || 'female',
    calendar: body.payload?.birth?.calendar || 'solar',
    isLeapMonth: Boolean(body.payload?.birth?.isLeapMonth),
    birthDate: body.payload?.birth?.date || '',
    birthTime: body.payload?.birth?.time || '',
    isUnknownTime: Boolean(body.payload?.birth?.isUnknownTime),
    relationshipStatus: body.payload?.relationship?.status || '',
    relationshipDuration: body.payload?.relationship?.duration || '',
    q1: body.payload?.questions?.[0] || '',
    q2: body.payload?.questions?.[1] || ''
  };
}

function mergeCards(baseCards: ReportCard[], draftCards?: Partial<ReportCard>[]) {
  if (!draftCards?.length) {
    return baseCards;
  }

  return baseCards.map((card, index) => ({
    ...card,
    ...draftCards[index]
  }));
}

function mergeDetails(baseDetails: ReportDetail[] | undefined, draftDetails?: Partial<ReportDetail>[]) {
  if (!baseDetails || !draftDetails?.length) {
    return baseDetails;
  }

  return baseDetails.map((detail, index) => ({
    ...detail,
    ...draftDetails[index]
  }));
}

function mergeSections(baseSections: ReportSection[], draftSections?: GeminiDraft['sections']) {
  if (!draftSections?.length) {
    return baseSections;
  }

  return baseSections.map((section) => {
    const matched = draftSections.find((candidate) => candidate.id === section.id);

    if (!matched) {
      return section;
    }

    return {
      ...section,
      paragraphs: matched.paragraphs?.filter(Boolean) || section.paragraphs,
      bullets: matched.bullets?.filter(Boolean) || section.bullets,
      callout: matched.callout?.body ? { ...section.callout, ...matched.callout } : section.callout,
      cards: section.cards ? mergeCards(section.cards, matched.cards) : section.cards,
      details: mergeDetails(section.details, matched.details)
    };
  });
}

function mergeQuestionAnswers(baseAnswers: QuestionAnswerBlock[], draftAnswers?: Partial<QuestionAnswerBlock>[]) {
  if (!draftAnswers?.length) {
    return baseAnswers;
  }

  return baseAnswers.map((answer, index) => ({
    ...answer,
    ...draftAnswers[index],
    advice: draftAnswers[index]?.advice?.filter(Boolean) || answer.advice
  }));
}

function mergeActionPlan(base: ActionPlan, draft?: Partial<ActionPlan>): ActionPlan {
  if (!draft) {
    return base;
  }

  return {
    ...base,
    ...draft,
    priorities: draft.priorities?.filter(Boolean) || base.priorities,
    dos: draft.dos?.filter(Boolean) || base.dos,
    avoids: draft.avoids?.filter(Boolean) || base.avoids,
    luckyDays: draft.luckyDays?.length
      ? draft.luckyDays.map((item) => ({
          day: Number(item.day),
          reason: item.reason || ''
        }))
      : base.luckyDays,
    unluckyDays: draft.unluckyDays?.length
      ? draft.unluckyDays.map((item) => ({
          day: Number(item.day),
          reason: item.reason || ''
        }))
      : base.unluckyDays
  };
}

function mergeFortuneWindow(base: SajuReportData['currentDayun'], draft?: Partial<SajuReportData['currentDayun']>) {
  if (!draft) {
    return base;
  }

  return {
    ...base,
    summary: draft.summary || base.summary,
    focus: draft.focus || base.focus,
    caution: draft.caution || base.caution
  };
}

function mergeGeminiDraft(base: SajuReportData, draft?: GeminiDraft | null): SajuReportData {
  if (!draft) {
    return base;
  }

  return {
    ...base,
    heroNote: draft.heroNote || base.heroNote,
    legalNotice: draft.legalNotice?.filter(Boolean) || base.legalNotice,
    summary: {
      ...base.summary,
      ...draft.summary,
      analysis: draft.summary?.analysis?.filter(Boolean) || base.summary.analysis,
      advice: draft.summary?.advice?.filter(Boolean) || base.summary.advice
    },
    keyTakeaways: mergeCards(base.keyTakeaways, draft.keyTakeaways),
    questionAnswers: mergeQuestionAnswers(base.questionAnswers, draft.questionAnswers),
    sections: mergeSections(base.sections, draft.sections),
    currentDayun: mergeFortuneWindow(base.currentDayun, draft.currentDayun),
    nextDayun: mergeFortuneWindow(base.nextDayun, draft.nextDayun),
    actionPlan: mergeActionPlan(base.actionPlan, draft.actionPlan)
  };
}

function buildGeminiRequestPayload(baseReport: SajuReportData, deterministicBasis: ReturnType<typeof buildDeterministicSajuBasis>) {
  const partialSchema = {
    type: 'OBJECT',
    properties: {
      heroNote: { type: 'STRING' },
      legalNotice: { type: 'ARRAY', items: { type: 'STRING' } },
      summary: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          analysis: { type: 'ARRAY', items: { type: 'STRING' } },
          advice: { type: 'ARRAY', items: { type: 'STRING' } }
        }
      },
      keyTakeaways: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING' },
            body: { type: 'STRING' },
            tone: { type: 'STRING' },
            badge: { type: 'STRING' }
          }
        }
      },
      questionAnswers: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            question: { type: 'STRING' },
            title: { type: 'STRING' },
            analysis: { type: 'STRING' },
            advice: { type: 'ARRAY', items: { type: 'STRING' } }
          }
        }
      },
      sections: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            id: { type: 'STRING' },
            title: { type: 'STRING' },
            subtitle: { type: 'STRING' },
            paragraphs: { type: 'ARRAY', items: { type: 'STRING' } },
            bullets: { type: 'ARRAY', items: { type: 'STRING' } },
            details: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  summary: { type: 'STRING' },
                  content: { type: 'STRING' },
                  open: { type: 'BOOLEAN' }
                }
              }
            },
            cards: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  body: { type: 'STRING' },
                  tone: { type: 'STRING' },
                  badge: { type: 'STRING' }
                }
              }
            },
            callout: {
              type: 'OBJECT',
              properties: {
                title: { type: 'STRING' },
                body: { type: 'STRING' }
              }
            }
          }
        }
      },
      currentDayun: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          focus: { type: 'STRING' },
          caution: { type: 'STRING' }
        }
      },
      nextDayun: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          focus: { type: 'STRING' },
          caution: { type: 'STRING' }
        }
      },
      actionPlan: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          priorities: { type: 'ARRAY', items: { type: 'STRING' } },
          dos: { type: 'ARRAY', items: { type: 'STRING' } },
          avoids: { type: 'ARRAY', items: { type: 'STRING' } },
          luckyDays: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                day: { type: 'NUMBER' },
                reason: { type: 'STRING' }
              }
            }
          },
          unluckyDays: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                day: { type: 'NUMBER' },
                reason: { type: 'STRING' }
              }
            }
          }
        }
      }
    }
  };

  return {
    systemInstruction: {
      parts: [{ text: PREMIUM_SAJU_SYSTEM_PROMPT }]
    },
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: JSON.stringify({
              context: buildPremiumSajuPromptContext({
                customerInput: deterministicBasis.input,
                deterministicBasis,
                debug: false
              }),
              requiredOutput:
                [
                  'Return JSON only.',
                  'Use deterministicBasis as the single source of truth.',
                  'Never change pillars, fiveElements, tenGods, dayun names, dayun ranges, seun, wolyun, birth data, serialNumber, or createdAt.',
                  'The golden sample in the system prompt is a validation case only. Do not copy its pillars or dayun into other users.',
                  'Rewrite only explanatory text blocks: heroNote, summary text, Q&A text, section paragraphs, cards, details, and actionPlan wording.',
                  'For love, marriage, and relationship sections, use a premium matchmaking-agency plus relationship-psychology style: attraction type, long-term partner type, failing pattern, how the other person reads the customer, contact style, hidden emotional need, breakup trigger, relationship stamina, face mood, likely social/professional environment, meeting route, married-life shape, do-not-miss person, avoid person, and 30-day actions.',
                  'Do not claim a guaranteed spouse, exact face, exact job, exact wedding date, pregnancy, divorce, affair, illness, accident, or legal/financial outcome.'
                ].join(' '),
              baseReport,
              deterministicBasis
            })
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.8,
      topP: 0.9,
      responseMimeType: 'application/json',
      responseSchema: partialSchema
    }
  };
}

async function requestGeminiDraft(baseReport: SajuReportData, deterministicBasis: ReturnType<typeof buildDeterministicSajuBasis>) {
  const env = getEnv();
  const apiKey = env.GEMINI_API_KEY;
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';

  if (!apiKey) {
    return null;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildGeminiRequestPayload(baseReport, deterministicBasis))
  });

  const parsed = (await response.json()) as {
    error?: { message?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  if (!response.ok) {
    throw new Error(parsed?.error?.message || 'Gemini 응답 생성에 실패했습니다.');
  }

  const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    return null;
  }

  return JSON.parse(text) as GeminiDraft;
}

export async function generateGeminiSajuReport(body: ReportRequestBody): Promise<ReportResponsePayload> {
  const serviceId = body.serviceId;

  if (!serviceId) {
    throw new ReportRequestError(400, 'serviceId는 필수입니다.');
  }

  const inputFormData = toFormData(body);
  const { formData, verification } = await normalizeFormDataWithKasi(inputFormData);
  const deterministicBasis = buildDeterministicSajuBasis(serviceId, formData, verification);
  const fallbackReport = buildSajuReport(serviceId, formData, deterministicBasis);

  let mergedReport = fallbackReport;

  try {
    const draft = await requestGeminiDraft(fallbackReport, deterministicBasis);
    mergedReport = mergeGeminiDraft(fallbackReport, draft);
  } catch (geminiError) {
    console.error('Gemini report draft failed:', geminiError);
  }

  return {
    provider: 'gemini',
    reportMode: body.reportMode || PREMIUM_SAJU_REPORT_MODE,
    promptVersion: body.promptVersion || PREMIUM_SAJU_PROMPT_VERSION,
    report: mergedReport,
    debug: body.debug
      ? {
          deterministicBasis
        }
      : undefined
  };
}
