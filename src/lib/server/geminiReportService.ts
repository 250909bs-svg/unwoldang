import type {
  BirthLocationData,
  BirthTimePrecision,
  DayBoundaryPolicy,
  IntakeFormData,
  PartnerBirthData,
  ServiceId
} from '../../api/mockData';
import type { PastLifeAnalysisContext } from '../analysisPayload';
import { buildLoveReunionReport } from '../../products/love-reunion/reportModel';
import {
  LOVE_REUNION_CONTEXT_VERSION,
  normalizeLoveReunionContext,
  validateLoveReunionFormData,
  type LoveReunionContext,
  type LoveReunionFormData
} from '../../products/love-reunion/contract';
import { normalizeLoveFocus } from '../loveFocus';
import { normalizeLoveReaction } from '../mz-love-fact/microChoice';
import { validateIntakeBirthInputs } from '../birthInputValidation';
import { buildDeterministicSajuBasis, type DeterministicSajuBasis } from '../saju/deterministicBasis';
import { buildPastLifeProfile } from '../saju/pastLifeProfile';
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
import {
  hasMalformedReportEvidenceReference,
  lockCommercialReportFacts,
  parseReportEvidenceReferences,
  stripReportEvidenceReferences
} from '../saju/v2/reportFactGuard';

type RelationshipStatus = IntakeFormData['relationshipStatus'] | null | undefined;
type RelationshipDuration = IntakeFormData['relationshipDuration'] | null | undefined;
type ServerReportFormData = Partial<IntakeFormData> & { reunionContext?: LoveReunionContext };

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
      precision?: BirthTimePrecision;
      dayBoundaryPolicy?: DayBoundaryPolicy;
      location?: BirthLocationData | null;
    };
    partner?: PartnerBirthData | null;
    relationship?: {
      status?: RelationshipStatus;
      duration?: RelationshipDuration;
      microChoice?: IntakeFormData['loveReaction'];
      focus?: IntakeFormData['loveFocus'];
    };
    pastLifeContext?: PastLifeAnalysisContext | null;
    reunionContext?: LoveReunionContext | null;
    questions?: string[];
  };
  reportMode?: string;
  promptVersion?: string;
  debug?: boolean;
};

export type GeminiDraft = {
  heroNote?: string;
  summary?: Partial<SajuReportData['summary']>;
  keyTakeaways?: Partial<ReportCard>[];
  questionAnswers?: Partial<QuestionAnswerBlock>[];
  sections?: Array<{
    id: string;
    paragraphs?: string[];
    bullets?: string[];
    callout?: Partial<NonNullable<ReportSection['callout']>>;
    details?: Partial<ReportDetail>[];
    cards?: Partial<ReportCard>[];
  }>;
  currentDayun?: Partial<SajuReportData['currentDayun']>;
  nextDayun?: Partial<SajuReportData['nextDayun']>;
  actionPlan?: Partial<ActionPlan>;
};

const DEFAULT_GEMINI_REQUEST_TIMEOUT_MS = 22000;

export type ReportResponsePayload = {
  provider: 'gemini' | 'deterministic-fallback';
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

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function safeText(value: unknown, maxLength = 6000) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

function safeTextArray(value: unknown, maxItems: number, maxLength = 3000) {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .map((item) => safeText(item, maxLength))
    .filter((item): item is string => Boolean(item))
    .slice(0, maxItems);
  return items.length > 0 ? items : undefined;
}

export function sanitizeGeminiDraft(value: unknown, base: SajuReportData): GeminiDraft {
  const root = asRecord(value);
  if (!root) {
    throw new Error('Gemini JSON 최상위 값이 객체가 아닙니다.');
  }

  const summary = asRecord(root.summary);
  const rawCards = Array.isArray(root.keyTakeaways) ? root.keyTakeaways : [];
  const rawAnswers = Array.isArray(root.questionAnswers) ? root.questionAnswers : [];
  const rawSections = Array.isArray(root.sections) ? root.sections : [];
  const currentDayun = asRecord(root.currentDayun);
  const nextDayun = asRecord(root.nextDayun);
  const actionPlan = asRecord(root.actionPlan);

  const keyTakeaways = base.keyTakeaways.flatMap((baseCard) => {
    const match = rawCards
      .map(asRecord)
      .find((candidate) => candidate && candidate.title === baseCard.title);
    if (!match) return [];
    return [{
      title: baseCard.title,
      body: safeText(match.body, 2400),
      badge: safeText(match.badge, 120)
    }];
  });

  const questionAnswers = base.questionAnswers.flatMap((baseAnswer) => {
    const match = rawAnswers
      .map(asRecord)
      .find((candidate) => candidate && candidate.question === baseAnswer.question);
    if (!match) return [];
    return [{
      question: baseAnswer.question,
      title: safeText(match.title, 500),
      analysis: safeText(match.analysis, 12000),
      advice: safeTextArray(match.advice, 10, 2000)
    }];
  });

  const sections = base.sections
    .filter((baseSection) => !baseSection.id.endsWith('-v2'))
    .flatMap((baseSection) => {
      const match = rawSections
        .map(asRecord)
        .find((candidate) => candidate && candidate.id === baseSection.id);
      if (!match) return [];
      const rawSectionCards = Array.isArray(match.cards) ? match.cards : [];
      const rawDetails = Array.isArray(match.details) ? match.details : [];
      const callout = asRecord(match.callout);
      return [{
        id: baseSection.id,
        paragraphs: safeTextArray(match.paragraphs, 30, 5000),
        bullets: safeTextArray(match.bullets, 40, 3000),
        callout: callout
          ? {
              title: safeText(callout.title, 300),
              body: safeText(callout.body, 4000)
            }
          : undefined,
        cards: (baseSection.cards || []).flatMap((baseCard) => {
          const card = rawSectionCards
            .map(asRecord)
            .find((candidate) => candidate && candidate.title === baseCard.title);
          return card
            ? [{
                title: baseCard.title,
                body: safeText(card.body, 3000),
                badge: safeText(card.badge, 120)
              }]
            : [];
        }),
        details: (baseSection.details || []).flatMap((baseDetail) => {
          const detail = rawDetails
            .map(asRecord)
            .find((candidate) => candidate && candidate.summary === baseDetail.summary);
          return detail
            ? [{ summary: baseDetail.summary, content: safeText(detail.content, 8000) }]
            : [];
        })
      }];
    });

  const sanitizeDays = (
    rawValue: unknown,
    baseDays: SajuReportData['actionPlan']['luckyDays']
  ) => {
    const rawDays = Array.isArray(rawValue) ? rawValue : [];
    return baseDays.flatMap((baseDay) => {
      const match = rawDays
        .map(asRecord)
        .find((candidate) => candidate && Number(candidate.day) === baseDay.day);
      const reason = match ? safeText(match.reason, 1500) : undefined;
      return reason ? [{ day: baseDay.day, reason }] : [];
    });
  };

  return {
    heroNote: safeText(root.heroNote, 4000),
    summary: summary
      ? {
          title: safeText(summary.title, 500),
          analysis: safeTextArray(summary.analysis, 12, 5000),
          advice: safeTextArray(summary.advice, 20, 2500)
        }
      : undefined,
    keyTakeaways: keyTakeaways.length ? keyTakeaways : undefined,
    questionAnswers: questionAnswers.length ? questionAnswers : undefined,
    sections: sections.length ? sections : undefined,
    currentDayun: currentDayun
      ? {
          summary: safeText(currentDayun.summary, 5000),
          focus: safeText(currentDayun.focus, 2500),
          caution: safeText(currentDayun.caution, 2500)
        }
      : undefined,
    nextDayun: nextDayun
      ? {
          summary: safeText(nextDayun.summary, 5000),
          focus: safeText(nextDayun.focus, 2500),
          caution: safeText(nextDayun.caution, 2500)
        }
      : undefined,
    actionPlan: actionPlan
      ? {
          title: safeText(actionPlan.title, 500),
          priorities: safeTextArray(actionPlan.priorities, 20, 2000),
          dos: safeTextArray(actionPlan.dos, 20, 2000),
          avoids: safeTextArray(actionPlan.avoids, 20, 2000),
          luckyDays: sanitizeDays(actionPlan.luckyDays, base.actionPlan.luckyDays),
          unluckyDays: sanitizeDays(actionPlan.unluckyDays, base.actionPlan.unluckyDays)
        }
      : undefined
  };
}

type EvidenceScope = 'interpretation' | 'temporal' | 'compatibility';

interface EvidenceCatalog {
  byScope: Record<EvidenceScope, Set<string>>;
  scopesById: Map<string, Set<EvidenceScope>>;
}

const ALL_EVIDENCE_SCOPES: EvidenceScope[] = ['interpretation', 'temporal', 'compatibility'];
const TEMPORAL_SECTION_IDS = new Set(['fortune', 'year', 'ten', 'detail12', 'detailRel', 'detailSal', 'month']);
const MIXED_SECTION_IDS = new Set(['business', 'money', 'career', 'love']);

function collectEvidenceCatalog(basis: DeterministicSajuBasis): EvidenceCatalog {
  const byScope: EvidenceCatalog['byScope'] = {
    interpretation: new Set<string>(),
    temporal: new Set<string>(),
    compatibility: new Set<string>()
  };
  const scopesById = new Map<string, Set<EvidenceScope>>();
  const add = (scope: EvidenceScope, id: unknown) => {
    if (typeof id !== 'string' || !id.trim()) return;
    const normalized = id.trim();
    byScope[scope].add(normalized);
    const scopes = scopesById.get(normalized) || new Set<EvidenceScope>();
    scopes.add(scope);
    scopesById.set(normalized, scopes);
  };
  const addMany = (scope: EvidenceScope, ids: unknown) => {
    if (Array.isArray(ids)) ids.forEach((id) => add(scope, id));
  };

  const interpretation = basis.commercialV2.interpretation;
  if (interpretation) {
    const visitInterpretation = (value: unknown) => {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(visitInterpretation);
        return;
      }
      Object.entries(value as Record<string, unknown>).forEach(([key, child]) => {
        if ((key === 'id' || key === 'ruleId') && typeof child === 'string') {
          add('interpretation', child);
        }
        visitInterpretation(child);
      });
    };
    visitInterpretation(interpretation);
  }

  const temporal = basis.commercialV2.temporal;
  temporal?.relations.forEach((item) => add('temporal', item.id));
  temporal?.tenGodActivations.forEach((item) => {
    add('temporal', item.id);
    addMany('temporal', item.evidenceIds);
  });
  temporal?.findings.forEach((item) => {
    add('temporal', item.id);
    addMany('temporal', item.evidenceIds);
  });

  const compatibility = basis.commercialV2.compatibility;
  compatibility?.crossRelations.forEach((item) => add('compatibility', item.id));
  compatibility?.facts.forEach((item) => {
    add('compatibility', item.id);
    addMany('compatibility', item.relationIds);
  });
  compatibility?.dimensions.forEach((item) => {
    add('compatibility', item.id);
    addMany('compatibility', item.evidenceIds);
  });
  if (compatibility) {
    addMany('compatibility', compatibility.dayMaster.conclusion.evidenceIds);
    addMany('compatibility', compatibility.spousePalace.relationIds);
    addMany('compatibility', compatibility.spousePalace.conclusion.evidenceIds);
    add('compatibility', compatibility.elementExchange.personAReceives.evidenceId);
    add('compatibility', compatibility.elementExchange.personBReceives.evidenceId);
    addMany('compatibility', compatibility.elementExchange.conclusion.evidenceIds);
    addMany('compatibility', compatibility.overview.evidenceIds);
  }

  return { byScope, scopesById };
}

function availableScopes(scopes: EvidenceScope[], catalog: EvidenceCatalog) {
  return scopes.filter((scope) => catalog.byScope[scope].size > 0);
}

function primaryEvidenceScopes(basis: DeterministicSajuBasis, catalog: EvidenceCatalog) {
  // Top-level summaries and action plans intentionally combine natal and
  // timing interpretation; narrower structures below use stricter scopes.
  const scopes: EvidenceScope[] = ['interpretation', 'temporal'];
  if (basis.commercialV2.compatibility) scopes.push('compatibility');
  return availableScopes(scopes, catalog);
}

function questionEvidenceScopes(
  question: string,
  basis: DeterministicSajuBasis,
  catalog: EvidenceCatalog
) {
  const scopes: EvidenceScope[] = ['interpretation'];
  if (/언제|시기|올해|내년|이번|다음|월|년|대운|세운|월운|이직|이동|재회/.test(question)) {
    scopes.push('temporal');
  }
  if (/궁합|상대|연애|사랑|결혼|배우자|남자친구|여자친구|파트너|관계/.test(question)) {
    scopes.push('compatibility');
  }
  if (basis.commercialV2.compatibility) scopes.push('compatibility');
  return availableScopes([...new Set(scopes)], catalog);
}

function sectionEvidenceScopes(
  sectionId: string,
  basis: DeterministicSajuBasis,
  catalog: EvidenceCatalog
) {
  if (TEMPORAL_SECTION_IDS.has(sectionId)) {
    return availableScopes(['temporal'], catalog);
  }

  const scopes: EvidenceScope[] = ['interpretation'];
  if (MIXED_SECTION_IDS.has(sectionId)) scopes.push('temporal');
  if (sectionId === 'love' && basis.commercialV2.compatibility) scopes.push('compatibility');
  return availableScopes(scopes, catalog);
}

function validateGeneratedProse(
  path: string,
  value: string | undefined,
  permittedScopes: EvidenceScope[],
  catalog: EvidenceCatalog,
  expected: string | undefined
) {
  if (!value) return;
  if (hasMalformedReportEvidenceReference(value)) {
    throw new Error(`Gemini 근거 인용 형식이 잘못되었습니다 (${path}).`);
  }

  const references = parseReportEvidenceReferences(value);
  if (references.length === 0 || references.some((reference) => reference.ids.length === 0)) {
    throw new Error(`Gemini 생성 문장에 근거 ID가 없습니다 (${path}).`);
  }
  if (!stripReportEvidenceReferences(value)) {
    throw new Error(`Gemini 생성 문장에 근거 인용 외 설명이 없습니다 (${path}).`);
  }

  references.forEach((reference) => {
    reference.ids.forEach((id) => {
      const actualScopes = catalog.scopesById.get(id);
      if (!actualScopes) {
        throw new Error(`Gemini가 존재하지 않는 명리 근거를 인용했습니다 (${path}): ${id}`);
      }
      if (!permittedScopes.some((scope) => actualScopes.has(scope))) {
        throw new Error(`Gemini가 문장 범위와 무관한 명리 근거를 인용했습니다 (${path}): ${id}`);
      }
    });
  });

  if (expected === undefined || stripReportEvidenceReferences(value) !== expected.trim()) {
    throw new Error(`Gemini 생성 문장이 결정론적 기본 문구와 일치하지 않습니다 (${path}).`);
  }
}

export function assertGeminiEvidenceReferences(
  draft: GeminiDraft,
  basis: DeterministicSajuBasis,
  base: SajuReportData
) {
  const catalog = collectEvidenceCatalog(basis);
  const primaryScopes = primaryEvidenceScopes(basis, catalog);
  const validate = (
    path: string,
    value: string | undefined,
    expected: string | undefined,
    scopes = primaryScopes
  ) => {
    validateGeneratedProse(path, value, scopes, catalog, expected);
  };

  validate('heroNote', draft.heroNote, base.heroNote);
  if (draft.summary) {
    validate('summary.title', draft.summary.title, base.summary.title);
    draft.summary.analysis?.forEach((value, index) => (
      validate(`summary.analysis.${index}`, value, base.summary.analysis[index])
    ));
    draft.summary.advice?.forEach((value, index) => (
      validate(`summary.advice.${index}`, value, base.summary.advice[index])
    ));
  }
  draft.keyTakeaways?.forEach((card, index) => {
    const baseCard = base.keyTakeaways.find((candidate) => candidate.title === card.title);
    validate(`keyTakeaways.${index}.body`, card.body, baseCard?.body);
    validate(`keyTakeaways.${index}.badge`, card.badge, baseCard?.badge);
  });
  draft.questionAnswers?.forEach((answer, index) => {
    const baseAnswer = base.questionAnswers.find((candidate) => candidate.question === answer.question);
    const scopes = questionEvidenceScopes(answer.question || '', basis, catalog);
    validate(`questionAnswers.${index}.title`, answer.title, baseAnswer?.title, scopes);
    validate(`questionAnswers.${index}.analysis`, answer.analysis, baseAnswer?.analysis, scopes);
    answer.advice?.forEach((value, adviceIndex) => (
      validate(
        `questionAnswers.${index}.advice.${adviceIndex}`,
        value,
        baseAnswer?.advice[adviceIndex],
        scopes
      )
    ));
  });
  draft.sections?.forEach((section, index) => {
    const baseSection = base.sections.find((candidate) => candidate.id === section.id);
    const scopes = sectionEvidenceScopes(section.id, basis, catalog);
    section.paragraphs?.forEach((value, paragraphIndex) => (
      validate(
        `sections.${index}.paragraphs.${paragraphIndex}`,
        value,
        baseSection?.paragraphs?.[paragraphIndex],
        scopes
      )
    ));
    section.bullets?.forEach((value, bulletIndex) => (
      validate(
        `sections.${index}.bullets.${bulletIndex}`,
        value,
        baseSection?.bullets?.[bulletIndex],
        scopes
      )
    ));
    if (section.callout) {
      validate(`sections.${index}.callout.title`, section.callout.title, baseSection?.callout?.title, scopes);
      validate(`sections.${index}.callout.body`, section.callout.body, baseSection?.callout?.body, scopes);
    }
    section.cards?.forEach((card, cardIndex) => {
      const baseCard = baseSection?.cards?.find((candidate) => candidate.title === card.title);
      validate(`sections.${index}.cards.${cardIndex}.body`, card.body, baseCard?.body, scopes);
      validate(`sections.${index}.cards.${cardIndex}.badge`, card.badge, baseCard?.badge, scopes);
    });
    section.details?.forEach((detail, detailIndex) => {
      const baseDetail = baseSection?.details?.find((candidate) => candidate.summary === detail.summary);
      validate(`sections.${index}.details.${detailIndex}.content`, detail.content, baseDetail?.content, scopes);
    });
  });

  const temporalScopes = availableScopes(['temporal'], catalog);
  if (draft.currentDayun) {
    validate('currentDayun.summary', draft.currentDayun.summary, base.currentDayun.summary, temporalScopes);
    validate('currentDayun.focus', draft.currentDayun.focus, base.currentDayun.focus, temporalScopes);
    validate('currentDayun.caution', draft.currentDayun.caution, base.currentDayun.caution, temporalScopes);
  }
  if (draft.nextDayun) {
    validate('nextDayun.summary', draft.nextDayun.summary, base.nextDayun.summary, temporalScopes);
    validate('nextDayun.focus', draft.nextDayun.focus, base.nextDayun.focus, temporalScopes);
    validate('nextDayun.caution', draft.nextDayun.caution, base.nextDayun.caution, temporalScopes);
  }
  if (draft.actionPlan) {
    validate('actionPlan.title', draft.actionPlan.title, base.actionPlan.title);
    draft.actionPlan.priorities?.forEach((value, index) => (
      validate(`actionPlan.priorities.${index}`, value, base.actionPlan.priorities[index])
    ));
    draft.actionPlan.dos?.forEach((value, index) => (
      validate(`actionPlan.dos.${index}`, value, base.actionPlan.dos[index])
    ));
    draft.actionPlan.avoids?.forEach((value, index) => (
      validate(`actionPlan.avoids.${index}`, value, base.actionPlan.avoids[index])
    ));
    draft.actionPlan.luckyDays?.forEach((day, index) => {
      const baseDay = base.actionPlan.luckyDays.find((candidate) => candidate.day === day.day);
      validate(`actionPlan.luckyDays.${index}.reason`, day.reason, baseDay?.reason, temporalScopes);
    });
    draft.actionPlan.unluckyDays?.forEach((day, index) => {
      const baseDay = base.actionPlan.unluckyDays.find((candidate) => candidate.day === day.day);
      validate(`actionPlan.unluckyDays.${index}.reason`, day.reason, baseDay?.reason, temporalScopes);
    });
  }

  if (Object.values(catalog.byScope).every((ids) => ids.size === 0) && Object.keys(draft).length > 0) {
    throw new Error('검증 가능한 상용 명리 근거가 없어 Gemini 생성 문장을 사용할 수 없습니다.');
  }
}

function stripGeneratedEvidence(value: string | undefined) {
  return value === undefined ? undefined : stripReportEvidenceReferences(value);
}

/**
 * Evidence IDs are transport-time validation metadata. They must never reach
 * customer-facing report copy, where an ID could look like a source-backed
 * endorsement of prose authored by a text model.
 */
export function stripGeminiEvidenceMetadata(draft: GeminiDraft): GeminiDraft {
  return {
    ...draft,
    heroNote: stripGeneratedEvidence(draft.heroNote),
    summary: draft.summary
      ? {
          ...draft.summary,
          title: stripGeneratedEvidence(draft.summary.title),
          analysis: draft.summary.analysis?.map((value) => stripReportEvidenceReferences(value)),
          advice: draft.summary.advice?.map((value) => stripReportEvidenceReferences(value))
        }
      : undefined,
    keyTakeaways: draft.keyTakeaways?.map((card) => ({
      ...card,
      body: stripGeneratedEvidence(card.body),
      badge: stripGeneratedEvidence(card.badge)
    })),
    questionAnswers: draft.questionAnswers?.map((answer) => ({
      ...answer,
      title: stripGeneratedEvidence(answer.title),
      analysis: stripGeneratedEvidence(answer.analysis),
      advice: answer.advice?.map((value) => stripReportEvidenceReferences(value))
    })),
    sections: draft.sections?.map((section) => ({
      ...section,
      paragraphs: section.paragraphs?.map((value) => stripReportEvidenceReferences(value)),
      bullets: section.bullets?.map((value) => stripReportEvidenceReferences(value)),
      callout: section.callout
        ? {
            ...section.callout,
            title: stripGeneratedEvidence(section.callout.title),
            body: stripGeneratedEvidence(section.callout.body)
          }
        : undefined,
      cards: section.cards?.map((card) => ({
        ...card,
        body: stripGeneratedEvidence(card.body),
        badge: stripGeneratedEvidence(card.badge)
      })),
      details: section.details?.map((detail) => ({
        ...detail,
        content: stripGeneratedEvidence(detail.content)
      }))
    })),
    currentDayun: draft.currentDayun
      ? {
          ...draft.currentDayun,
          summary: stripGeneratedEvidence(draft.currentDayun.summary),
          focus: stripGeneratedEvidence(draft.currentDayun.focus),
          caution: stripGeneratedEvidence(draft.currentDayun.caution)
        }
      : undefined,
    nextDayun: draft.nextDayun
      ? {
          ...draft.nextDayun,
          summary: stripGeneratedEvidence(draft.nextDayun.summary),
          focus: stripGeneratedEvidence(draft.nextDayun.focus),
          caution: stripGeneratedEvidence(draft.nextDayun.caution)
        }
      : undefined,
    actionPlan: draft.actionPlan
      ? {
          ...draft.actionPlan,
          title: stripGeneratedEvidence(draft.actionPlan.title),
          priorities: draft.actionPlan.priorities?.map((value) => stripReportEvidenceReferences(value)),
          dos: draft.actionPlan.dos?.map((value) => stripReportEvidenceReferences(value)),
          avoids: draft.actionPlan.avoids?.map((value) => stripReportEvidenceReferences(value)),
          luckyDays: draft.actionPlan.luckyDays?.map((day) => ({
            ...day,
            reason: stripReportEvidenceReferences(day.reason)
          })),
          unluckyDays: draft.actionPlan.unluckyDays?.map((day) => ({
            ...day,
            reason: stripReportEvidenceReferences(day.reason)
          }))
        }
      : undefined
  };
}

function serializeEvidenceCatalog(basis: DeterministicSajuBasis) {
  const catalog = collectEvidenceCatalog(basis);
  return ALL_EVIDENCE_SCOPES.reduce<Record<EvidenceScope, string[]>>((result, scope) => {
    result[scope] = [...catalog.byScope[scope]].sort();
    return result;
  }, {
    interpretation: [],
    temporal: [],
    compatibility: []
  });
}

export class ReportRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ReportRequestError';
    this.status = status;
  }
}

export function toFormData(body: ReportRequestBody): ServerReportFormData {
  const pastLifeContext = body.payload?.pastLifeContext;
  const rawReunionContext = body.payload?.reunionContext;
  const reunionContext = body.serviceId === 'love-reunion' &&
    rawReunionContext?.version === LOVE_REUNION_CONTEXT_VERSION
    ? normalizeLoveReunionContext(rawReunionContext)
    : undefined;

  return {
    name: body.payload?.user?.name || '',
    gender: body.payload?.user?.gender,
    calendar: body.payload?.birth?.calendar,
    isLeapMonth: Boolean(body.payload?.birth?.isLeapMonth),
    birthDate: body.payload?.birth?.date || '',
    birthTime: body.payload?.birth?.time || '',
    isUnknownTime: Boolean(body.payload?.birth?.isUnknownTime),
    birthTimePrecision: body.payload?.birth?.precision,
    dayBoundaryPolicy: body.payload?.birth?.dayBoundaryPolicy,
    birthLocation: body.payload?.birth?.location || undefined,
    partner: body.payload?.partner || undefined,
    relationshipStatus: body.payload?.relationship?.status || '',
    relationshipDuration: body.payload?.relationship?.duration || '',
    loveReaction: normalizeLoveReaction(body.payload?.relationship?.microChoice) ?? undefined,
    loveFocus: normalizeLoveFocus(body.payload?.relationship?.focus) ?? undefined,
    pastLifeTopic: pastLifeContext?.topic || '',
    repeatedScene: pastLifeContext?.repeatedScene || '',
    frequentEmotion: pastLifeContext?.frequentEmotion || '',
    hiddenDesire: pastLifeContext?.hiddenDesire || '',
    chosenSymbol: pastLifeContext?.chosenSymbol || '',
    readingTone: pastLifeContext?.readingTone || '',
    ...(reunionContext ? { reunionContext } : {}),
    q1: body.payload?.questions?.[0] || '',
    q2: body.payload?.questions?.[1] || ''
  };
}

function assertTextLength(value: string | undefined, label: string, maxLength: number) {
  if ((value?.trim().length || 0) > maxLength) {
    throw new ReportRequestError(422, `${label}은(는) ${maxLength}자 이내로 입력해 주세요.`);
  }
}

function assertSupportedBirthYear(value: string | undefined, label: string) {
  const year = Number(value?.slice(0, 4));
  if (!Number.isInteger(year) || year < 1900 || year > 2099) {
    throw new ReportRequestError(
      422,
      `${label} 생년월일은 상용 검증 범위인 1900-2099년 안에서 입력해 주세요.`
    );
  }
}

function hasInvariantDay(calculation: NonNullable<ReturnType<typeof validateIntakeBirthInputs>['self']['calculation']>) {
  return new Set(
    calculation.scenarios.map(({ bazi }) => `${bazi.d_gz.tg}:${bazi.d_gz.dz}`)
  ).size === 1;
}

/** Server-side release gate. Client validation is convenience, never authority. */
export function assertCommercialReportRequest(
  serviceId: ServiceId,
  formData: ServerReportFormData
) {
  const requirePartner = serviceId === 'match-couple' || serviceId === 'match-destiny';
  if (serviceId === 'love-reunion') {
    const context = formData.reunionContext;

    if (!context || context.version !== LOVE_REUNION_CONTEXT_VERSION) {
      throw new ReportRequestError(
        422,
        `재회운 분석 맥락은 v${LOVE_REUNION_CONTEXT_VERSION} 형식이어야 합니다.`
      );
    }

    if (!context.contactBoundary) {
      throw new ReportRequestError(422, '연락 거절 또는 안전 경계 여부를 확인해 주세요.');
    }

    if (formData.partner && (!context.partnerBirthKnown || !context.partnerDataPermissionConfirmed)) {
      throw new ReportRequestError(
        422,
        '상대방 출생정보를 제공하고 분석에 사용하는 데 필요한 권한 확인이 필요합니다.'
      );
    }

    const reunionValidation = validateLoveReunionFormData(formData);

    if (!reunionValidation.valid) {
      throw new ReportRequestError(422, reunionValidation.errors.join(' '));
    }
  }
  const validation = validateIntakeBirthInputs(formData, { requirePartner });

  if (!validation.valid) {
    throw new ReportRequestError(
      422,
      validation.errors.map((error) => error.message).join(' ')
    );
  }

  assertTextLength(formData.name, '이름', 50);
  assertTextLength(formData.q1, '첫 번째 질문', 500);
  assertTextLength(formData.q2, '두 번째 질문', 500);
  assertTextLength(formData.birthLocation?.label, '출생지', 120);
  assertSupportedBirthYear(formData.birthDate, '본인');

  if (!formData.q1?.trim() || !formData.q2?.trim()) {
    throw new ReportRequestError(422, '유료 리포트는 개인화 질문 두 가지를 모두 입력해야 합니다.');
  }

  if (!validation.self.calculation || !hasInvariantDay(validation.self.calculation)) {
    throw new ReportRequestError(
      422,
      '출생시간 시나리오에 따라 일주가 달라 단일 유료 리포트를 만들 수 없습니다. 출생시간 또는 자시 경계 정책을 확인해 주세요.'
    );
  }

  if (formData.partner) {
    assertTextLength(formData.partner.name, '상대방 이름', 50);
    assertTextLength(formData.partner.birthLocation?.label, '상대방 출생지', 120);
    assertSupportedBirthYear(formData.partner.birthDate, '상대방');
  }

  if (validation.partner?.calculation && !hasInvariantDay(validation.partner.calculation)) {
    throw new ReportRequestError(
      422,
      '상대방 출생시간 시나리오에 따라 일주가 달라 정밀 궁합을 만들 수 없습니다. 상대방 출생시간을 확인해 주세요.'
    );
  }
}

function mergeCards(baseCards: ReportCard[], draftCards?: Partial<ReportCard>[]) {
  if (!draftCards?.length) {
    return baseCards;
  }

  return baseCards.map((card) => {
    const generated = draftCards.find((candidate) => candidate.title === card.title);
    return generated
      ? { ...card, body: generated.body || card.body, badge: generated.badge || card.badge }
      : card;
  });
}

function mergeDetails(baseDetails: ReportDetail[] | undefined, draftDetails?: Partial<ReportDetail>[]) {
  if (!baseDetails || !draftDetails?.length) {
    return baseDetails;
  }

  return baseDetails.map((detail) => {
    const generated = draftDetails.find((candidate) => candidate.summary === detail.summary);
    return generated?.content ? { ...detail, content: generated.content } : detail;
  });
}

function mergeSections(baseSections: ReportSection[], draftSections?: GeminiDraft['sections']) {
  if (!draftSections?.length) {
    return baseSections;
  }

  return baseSections.map((section) => {
    if (section.id.endsWith('-v2')) {
      return section;
    }
    const matched = draftSections.find((candidate) => candidate.id === section.id);

    if (!matched) {
      return section;
    }

    return {
      ...section,
      paragraphs: matched.paragraphs?.filter(Boolean) || section.paragraphs,
      bullets: matched.bullets?.filter(Boolean) || section.bullets,
      callout: matched.callout?.body
        ? {
            title: matched.callout.title || section.callout?.title,
            body: matched.callout.body
          }
        : section.callout,
      cards: section.cards ? mergeCards(section.cards, matched.cards) : section.cards,
      details: mergeDetails(section.details, matched.details)
    };
  });
}

function mergeQuestionAnswers(baseAnswers: QuestionAnswerBlock[], draftAnswers?: Partial<QuestionAnswerBlock>[]) {
  if (!draftAnswers?.length) {
    return baseAnswers;
  }

  return baseAnswers.map((answer) => {
    const draft = draftAnswers.find((candidate) => candidate.question === answer.question);

    if (!draft) {
      return answer;
    }

    return {
      ...answer,
      question: answer.question,
      title: draft.title || answer.title,
      analysis: draft.analysis || answer.analysis,
      advice: draft.advice?.filter(Boolean) || answer.advice
    };
  });
}

function mergeActionPlan(base: ActionPlan, draft?: Partial<ActionPlan>): ActionPlan {
  if (!draft) {
    return base;
  }

  return {
    ...base,
    title: draft.title || base.title,
    priorities: draft.priorities?.filter(Boolean) || base.priorities,
    dos: draft.dos?.filter(Boolean) || base.dos,
    avoids: draft.avoids?.filter(Boolean) || base.avoids,
    luckyDays: base.luckyDays.map((item) => ({
      ...item,
      reason: draft.luckyDays?.find((candidate) => candidate.day === item.day)?.reason || item.reason
    })),
    unluckyDays: base.unluckyDays.map((item) => ({
      ...item,
      reason: draft.unluckyDays?.find((candidate) => candidate.day === item.day)?.reason || item.reason
    }))
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
    legalNotice: base.legalNotice,
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

function buildGeminiRequestPayload(baseReport: SajuReportData, deterministicBasis: DeterministicSajuBasis) {
  const partialSchema = {
    type: 'OBJECT',
    properties: {
      heroNote: { type: 'STRING' },
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
              evidenceIdCatalog: serializeEvidenceCatalog(deterministicBasis),
              requiredOutput:
                [
                  'Return JSON only.',
                  'Use deterministicBasis as the single source of truth.',
                  'Within deterministicBasis, commercialV2 is the highest-priority expert evidence layer. Never replace it with a simpler five-element count or generic yongsin heuristic.',
                  'Do not rewrite or reinterpret calculation-audit-v2, expert-evidence-v2, temporal-evidence-v2, or compatibility-evidence-v2. Their wording and evidence IDs are immutable.',
                  'When commercialV2.interpretation.consensus is unresolved or conditional, explicitly preserve the conflict and never call a candidate a confirmed yongsin.',
                  'When commercialV2 calendar stableSelection is unstable-day, do not make a single day-master, yongsin, temporal, or compatibility conclusion. Ask for a more exact birth time and explain only invariant facts.',
                  'RELEASE-SAFE OUTPUT RULE: Do not author, rewrite, paraphrase, expand, shorten, or infer any customer-facing prose. For every explanatory field you return, copy the corresponding baseReport string byte-for-byte and only append evidence metadata in the exact format [근거:ID] (multiple IDs: [근거:ID1,ID2]). After the citation is removed, the value must exactly equal baseReport. This applies independently to heroNote, summary title and every summary item, every generated card body or badge, every Q&A title/analysis/advice item, every section paragraph/bullet/callout/card/detail, every dayun field, and every action-plan title/item/day reason. If no matching evidence exists, omit that field.',
                  'Use evidence IDs from the relevant catalog only: currentDayun, nextDayun, fortune/year/month/detail12/detailRel/detailSal/ten sections, and lucky/unlucky-day reasons may cite temporal IDs only. Natal-only sections must cite interpretation IDs. Relationship copy may cite compatibility IDs only when commercialV2.compatibility exists. Never use an unrelated valid ID merely to satisfy citation syntax.',
                  'Do not add citations to structural matching keys copied from baseReport: section id, question, existing card title, detail summary, or day number. Those keys must remain exact so the response can be merged safely.',
                  'Never change pillars, fiveElements, tenGods, dayun names, dayun ranges, seun, wolyun, birth data, serialNumber, or createdAt.',
                  'The golden sample in the system prompt is a validation case only. Do not copy its pillars or dayun into other users.',
                  'Return only exact deterministic prose echoes plus evidence metadata. Never return a novel factual claim, interpretation, example, recommendation, or stylistic improvement, even if an evidence ID appears related.',
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
                  'Each questionAnswers analysis must be at least 300 Korean characters and must read like a paid one-on-one consultation, not a short summary.',
                  'Each questionAnswers advice array must contain exactly 10 concrete numbered items. Cover conclusion, myeongri basis, when, where, how, who to involve, money/time/fatigue criteria, 7-day verification, what to avoid, and the final decision rule.',
                  'For each customer question, answer 1 to 10 in detail enough that the customer understands when, where, how, and with whom to act. Do not end with only abstract saju tendencies.',
                  'For questionAnswers, do not classify the question into a fixed category template. Do not output generic titles such as "질문을 실제 사건으로 쪼개야 답이 보입니다" unless the customer actually asked for that method. The title must be a direct answer to the exact question.',
                  'Keep each customer question exactly as provided, and answer only that question. If the customer compares named options, compare those exact options by money, commute, relationships, fatigue, and opportunity. If the customer asks where to meet love, give concrete meeting routes and places, not only relationship attitude advice.',
                  'For location, moving, career-choice, dating-place, school, work, or neighborhood questions, never answer with abstract four-box advice only. Give a conditional recommendation first, then the saju basis, then a real-life checklist.',
                  'Question answers must be different for each person. Use deterministicBasis, currentDayun, yearLuck/monthLuck, relationship status, and the exact words in customerInput.questions. Do not reuse a stock answer across users.',
                  'If the exact question cannot be answered deterministically, say what can be read from the chart and what must be verified in reality. Still answer the practical choice directly with conditions.',
                  'Add life-graph style interpretation in the wording: year-by-year likely themes, why the timing appears, and what the customer should do in that period.',
                  'If baseReport.serviceId is life-flow, structure the yearly report as: opening, natal core analysis, yearly map, 12 monthly readings, money, love, career, relationships, health, luck actions, closing. Each month must include total luck, money, love, relationships, health, action tip, avoid action, and key point.',
                  'For life-flow yearly map: 2026 is 丙午 with strong fire in both stem and branch; 2027 is 丁未 with remaining fire fixed into earth, emphasizing consolidation and burden management; 2028 is 戊申, emphasizing metal, outputs, systems, settlement, and performance verification. Never reuse the same expansion sentence for these years.',
                  'For life-flow, the opening must include a one-line annual diagnosis, a weather/season metaphor, what to discard this year, and what to hold so money and people stick.',
                  'For life-flow, money/love/career/relationship/health/luck-action sections must be concrete enough to sell as a premium new-year fortune report, not a generic annual horoscope.',
                  'If baseReport.serviceId is past-life-goblin, treat past life as a symbolic narrative translated from the deterministic saju chart, never as a verified historical fact or recovered memory.',
                  'For past-life-goblin, structure the interpretation around: goblin past-life character, myeongri evidence, inherited talent, repeated relationship scene, money/work habit, emotional shutdown trigger, present-life mission, and a 30-day action ritual grounded in ordinary behavior.',
                  'For past-life-goblin, every symbolic claim must cite a chart basis such as day master, month command, visible/hidden ten gods, branch relations, helpful elements, or current dayun. Do not invent a country, era, occupation, death, named person, crime, curse, or supernatural certainty.',
                  'For past-life-goblin questions, answer the exact concern first and then connect it to the repeated natal pattern. Keep the MZ tone vivid and readable, but avoid childish slang, horror marketing, spiritual coercion, or claims that the customer must buy a ritual or talisman.',
                  'For past-life-goblin, preserve the five-book order exactly: 봉인록 topics 1-5, 인연록 topics 6-9, 업록 topics 10-15, 현생록 topics 16-20, 해원록 topics 21-26. Every uncomfortable interpretation must end with a concrete present-life action.',
                  'For past-life-goblin, create a symbolic seal name from deterministic traits, but never present the seal name, period, place, occupation, relationship, or final event as verified history. Use explicit language such as 상징 장면, 서사, 반복 패턴, or 현실 확인 when needed.',
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
                  'Do not produce generic coaching tone. Speak as a veteran consultant who has observed the pattern for years.',
                  'FINAL RELEASE-SAFE OVERRIDE: all earlier style and quality instructions describe how the deterministic baseReport was prepared; they do not authorize new prose. Your only permitted operation is exact baseReport prose echo plus valid evidence metadata. Omit anything you cannot echo exactly.'
                ].join(' '),
              baseReport,
              deterministicBasis
            })
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,
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

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getGeminiRequestTimeoutMs(env));
  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
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

  const draft = sanitizeGeminiDraft(JSON.parse(text), baseReport);
  assertGeminiEvidenceReferences(draft, deterministicBasis, baseReport);
  return stripGeminiEvidenceMetadata(draft);
}

export async function generateGeminiSajuReport(body: ReportRequestBody): Promise<ReportResponsePayload> {
  const serviceId = body.serviceId;

  if (!serviceId) {
    throw new ReportRequestError(400, 'serviceId는 필수입니다.');
  }

  const inputFormData = toFormData(body);
  assertCommercialReportRequest(serviceId, inputFormData);
  const { formData: normalizedFormData, verification } = await normalizeFormDataWithKasi(inputFormData);
  const formData: ServerReportFormData = {
    ...normalizedFormData,
    ...(inputFormData.reunionContext ? { reunionContext: inputFormData.reunionContext } : {})
  };

  if (inputFormData.calendar === 'lunar' && verification.status !== 'verified') {
    throw new ReportRequestError(
      503,
      '한국 음력 생일은 KASI 교차 검증이 완료되어야 유료 리포트를 생성할 수 있습니다. 잠시 후 다시 시도해 주세요.'
    );
  }

  const deterministicBasis = buildDeterministicSajuBasis(serviceId, formData, verification);
  if (deterministicBasis.commercialV2.releaseAudit.decision === 'blocked') {
    throw new ReportRequestError(
      422,
      `상용 리포트 생성이 중단되었습니다. ${deterministicBasis.commercialV2.releaseAudit.blockers.join(' ')}`
    );
  }
  const genericReport = buildSajuReport(serviceId, formData, deterministicBasis);
  const builtReport = serviceId === 'love-reunion'
    ? buildLoveReunionReport(genericReport, formData as Partial<LoveReunionFormData>)
    : genericReport;
  const fallbackReport =
    serviceId === 'past-life-goblin'
      ? { ...builtReport, pastLifeProfile: buildPastLifeProfile(builtReport, formData) }
      : builtReport;

  let draft: GeminiDraft | null = null;

  try {
    draft = await requestGeminiDraft(fallbackReport, deterministicBasis);
  } catch (geminiError) {
    console.error('Gemini report draft failed:', geminiError);
  }

  if (!draft) {
    return {
      provider: 'deterministic-fallback',
      reportMode: PREMIUM_SAJU_REPORT_MODE,
      promptVersion: PREMIUM_SAJU_PROMPT_VERSION,
      report: fallbackReport,
      debug: undefined
    };
  }

  const mergedReport = mergeGeminiDraft(fallbackReport, draft);
  const guardedReport = lockCommercialReportFacts(fallbackReport, mergedReport);

  return {
    provider: 'gemini',
    reportMode: PREMIUM_SAJU_REPORT_MODE,
    promptVersion: PREMIUM_SAJU_PROMPT_VERSION,
    report: guardedReport,
    debug: undefined
  };
}
