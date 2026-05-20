import type { IntakeFormData, ServiceId } from '../../api/mockData';
import { buildDeterministicSajuBasis } from '../saju/deterministicBasis';
import { normalizeFormDataWithKasi } from './kasiCalendarService';
import {
  buildPremiumSajuPromptContext,
  PREMIUM_SAJU_HUMAN_SENSORY_POLICY,
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

const DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 22000;

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

function getGeminiRequestTimeoutMs(env: EnvRecord) {
  const configured = Number(env.GEMINI_REQUEST_TIMEOUT_MS);

  if (Number.isFinite(configured) && configured >= 10000) {
    return configured;
  }

  return DEFAULT_GEMINI_REQUEST_TIMEOUT_MS;
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
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
      parts: [{ text: PREMIUM_SAJU_SYSTEM_PROMPT }, { text: PREMIUM_SAJU_HUMAN_SENSORY_POLICY }]
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
                  'Avoid repetitive wording in the first summary. Do not keep repeating the same Korean nouns such as 기준, 구조, 문서화, 정교하게, 확장. Rotate concrete real-life expressions such as 정산 원칙, 역할 경계, 가격표, 생활 리듬, 책임 범위, 계약 습관, 일정 통제, 에너지 배분, 관계 장면, 회복 방식.',
                  'Never repeat the same helper sentence across sections. In particular, do not reuse endings like "생활 속에서 반복될 때 힘을 얻습니다" or "실제 선택 기준으로 써야 합니다". Each paragraph needs a different image, reason, and action.',
                  'The report must feel like saju/myeongri analysis, not self-development coaching. Use myeongri terms naturally and explain them: 월령, 조후, 통근, 투간, 합충, 십성, 용신, 희신, 대운, 세운, 월운.',
                  'Do not interpret fiveElements by raw percentages only. Explain why month command, seasonal climate, rooted branches, exposed stems, and fortune cycles can make one element feel stronger than the displayed ratio.',
                  'If multiple fiveElements have the same top value, do not say one of them is the largest. Separate the visible natal distribution from elements activated by dayun/seun.',
                  'Never describe an element with value 0 or clearly weak in fiveElements as excessive. If cautiousElements includes a missing element, explain it as a missing direction, relationship boundary, or growth axis, not as overabundance.',
                  'When explaining branch relations such as 육합, 충, 형, 파, 해, 원진, refer to branches only: 년지 申 and 시지 巳, 월지 酉 and 일지 子. Do not say the whole pillars 기유 and 무자 are 파.',
                  'For 12운성, use the day stem standard. Example: for 戊 day stem, 申=병, 酉=사, 子=태, 巳=건록/임관. Do not use a table that makes 戊申 장생 or 戊子 제왕.',
                  'For dayun, do not compress the branch into one simplified ten-god. Explain stem ten-god plus hidden stems. Example for 戊 day stem and 乙巳 dayun: 乙=정관, 巳 hidden stems 丙=편인, 戊=비견, 庚=식신.',
                  'For cold or dry/wet charts, include 조후 logic: why warmth, cooling, moisture, dryness, or circulation matters. Tie helpfulElements and cautiousElements to this climate logic, not only to generic balance.',
                  'For tenGods, explain why dominantTenGods create real abilities or risks: 식상 as expression/content/counseling/design, 재성 as customers/market/money circulation, 비겁 as self-standard/competition, 관성 as responsibility/rules, 인성 as study/support/recovery.',
                  'Avoid numeric fortune-score language in customer-facing prose. Convert yearLuck/monthLuck scores into phases such as 공개기, 확장기, 조율기, 정비기, 회복기, and explain what to do in that phase.',
                  'The opening summary must feel like a senior human consultant wrote it: compress repeated abstract logic, add concrete scenes, emotional pattern reasons, relationship behavior, money/work operations, and immediately actionable behaviors.',
                  'Make the summary commercially satisfying without simply making it longer. Prefer specific diagnosis and practical examples over generic fortune-telling filler.',
                  'For love, marriage, and relationship sections, use a premium matchmaking-agency plus relationship-psychology style: attraction type, long-term partner type, failing pattern, how the other person reads the customer, contact style, hidden emotional need, breakup trigger, relationship stamina, face mood, likely social/professional environment, meeting route, married-life shape, do-not-miss person, avoid person, and 30-day actions.',
                  'Quality bar: write as if a 20-year senior Korean myeongri consultant will audit every sentence. Every conclusion must be tied to deterministicBasis, the baseReport fields, or the customer questions.',
                  'Do not invent unsupported facts. If the chart does not support a precise claim, express it as a tendency, condition, or verification checklist.',
                  'For every major section, include four layers: myeongri basis, real-life scene, risk if mishandled, and one concrete next action.',
                  'Question answers must directly answer the customer question first, then explain the basis, then give a 7-day verification action. Avoid vague reassurance.',
                  'Add life-graph style interpretation in the wording: year-by-year likely themes, why the timing appears, and what the customer should do in that period.',
                  'If baseReport.serviceId is life-flow, structure the yearly report as: opening, natal core analysis, yearly map, 12 monthly readings, money, love, career, relationships, health, luck actions, closing. Each month must include total luck, money, love, relationships, health, action tip, avoid action, and key point.',
                  'For life-flow yearly map: 2026 is 丙午 with strong fire in both stem and branch; 2027 is 丁未 with remaining fire fixed into earth, emphasizing consolidation and burden management; 2028 is 戊申, emphasizing metal, outputs, systems, settlement, and performance verification. Never reuse the same expansion sentence for these years.',
                  'For life-flow, the opening must include a one-line annual diagnosis, a weather/season metaphor, what to discard this year, and what to hold so money and people stick.',
                  'For life-flow, money/love/career/relationship/health/luck-action sections must be concrete enough to sell as a premium new-year fortune report, not a generic annual horoscope.',
                  'Include yongsin/huisin explanation using helpfulElements and cautiousElements: why the helpful elements are needed, what happens when missing elements are neglected, and why cautious elements can destabilize the chart when excessive.',
                  'Career and business paragraphs must be concrete: solo/team fit, online/offline fit, brand/sales/operation style, customer type, revenue model, and what structure to avoid.',
                  'Relationship paragraphs must describe real behavior patterns: why the customer distances after a good start, what causes others to depend on them, what happens when tired, and which relationships bring money or opportunity.',
                  'Love paragraphs must avoid generic advice like "responsible partner" unless grounded in the chart. Describe contact tempo, certainty needs, emotional delay/depth, ambiguity fatigue, and relationship turning points based on deterministicBasis shensha/yunseong/day pillar only when supported.',
                  'Dayun paragraphs must be stronger than a one-line trend. Explain how currentDayun changes customer flow, money pressure, movement, relationship volume, fatigue, and what should be reduced or formalized.',
                  'The paid report should feel like it reads the customer life pattern, not like a generic organized essay. Use scenes, examples, and human observations while staying within deterministic facts.',
                  'Use premium Korean copywriting: concrete, calm, emotionally accurate, and useful. Avoid fear marketing, childish expressions, excessive pink-romance tone, and generic AI phrasing.',
                  'Never overpromise perfect accuracy. Increase trust by showing what is certain from the chart, what is conditional, and what the customer should verify in real life.',
                  'Do not claim a guaranteed spouse, exact face, exact job, exact wedding date, pregnancy, divorce, affair, illness, accident, or legal/financial outcome.',
                  'Top rule: the user wants life resonance, not abstract explanation. Prioritize visceral realism over textbook wording.',
                  'Answer in a scene-first style. Convert traits into concrete moments from daily life (reply delay, pricing ambiguity, over-responsibility burnout, sudden distancing, emotional shutdown).',
                  'For each major section include: user behavior, others perception, repeated failure loop, a blow-up scene (money/love/relationship), and one immediate habit change.',
                  'Use the order: direct hit diagnosis -> myeongri reason -> practical fix.',
                  'Do not soften every sentence with hedging. Avoid repetitive endings and avoid empty reassurance.',
                  'Minimize abstract buzzwords such as 균형/흐름/방향성/에너지/조율/리듬/안정감. Prefer concrete language: 돈/연락/약속/피로/거리감/책임/일정/말투/소비.',
                  'Do not repeat stock phrases across sections. If a similar conclusion appears, rewrite with a different scene, different emotional trigger, and different action.',
                  'Mix short and medium sentence length intentionally so the report feels human, not machine-uniform.',
                  'Each section should contain one capture-worthy one-liner that a user wants to save or share.',
                  'Do not produce generic coaching tone. Speak as a veteran consultant who has observed the pattern for years.'
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getGeminiRequestTimeoutMs(env));
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify(buildGeminiRequestPayload(baseReport, deterministicBasis))
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error('Gemini response timed out. Returning deterministic fallback report.');
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

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
