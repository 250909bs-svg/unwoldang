import type {
  PastLifePortrait,
  PastLifeProfile,
  ReportCard,
  ReportSection,
  SajuReportData
} from '../../lib/saju/report';
import { sanitizePastLifeNarrative } from './contentSafety';
import { PAST_LIFE_PRODUCT_ID } from './contract';

/**
 * Creates a render-only safe copy when archived or server-authored prose
 * contains factual past-life certainty, fear pressure, or internal prompt
 * leakage. Safe reports retain their original reference so paid artifacts are
 * not rewritten merely by being opened.
 */
export function sanitizePastLifeReportForRendering(
  report: SajuReportData
): SajuReportData {
  if (report.serviceId !== PAST_LIFE_PRODUCT_ID) return report;

  let changed = false;
  const safe = (value: string) => {
    const sanitized = sanitizePastLifeNarrative(value);
    if (sanitized !== value) changed = true;
    return sanitized;
  };
  const safeOptional = (value: string | undefined) =>
    typeof value === 'string' ? safe(value) : value;
  const safeList = (values: string[]) => values.map(safe);
  const safeCard = (card: ReportCard): ReportCard => ({
    ...card,
    title: safe(card.title),
    body: safe(card.body),
    badge: safeOptional(card.badge)
  });
  const safePortrait = (portrait: PastLifePortrait): PastLifePortrait => ({
    ...portrait,
    imageAlt: safe(portrait.imageAlt),
    eyebrow: safe(portrait.eyebrow),
    title: safe(portrait.title),
    role: safe(portrait.role),
    appearance: safeList(portrait.appearance),
    attire: safe(portrait.attire),
    gaze: safe(portrait.gaze),
    caption: safe(portrait.caption)
  });
  const safeProfile = (profile: PastLifeProfile): PastLifeProfile => ({
    ...profile,
    sealName: safe(profile.sealName),
    archetype: safe(profile.archetype),
    eraMood: safe(profile.eraMood),
    place: safe(profile.place),
    vocation: safe(profile.vocation),
    keepsake: safe(profile.keepsake),
    openingLine: safe(profile.openingLine),
    selfPortrait: safePortrait(profile.selfPortrait),
    connectionPortrait: safePortrait(profile.connectionPortrait),
    connectionRole: safe(profile.connectionRole),
    firstMeeting: safe(profile.firstMeeting),
    unfinishedPromise: safe(profile.unfinishedPromise),
    finalSeparation: safe(profile.finalSeparation),
    presentEcho: safe(profile.presentEcho),
    evidence: safeList(profile.evidence),
    storyBeats: profile.storyBeats.map((beat) => ({
      ...beat,
      title: safe(beat.title),
      scene: safe(beat.scene),
      goblinLine: safe(beat.goblinLine),
      presentEcho: safe(beat.presentEcho)
    })),
    disclaimer: safe(profile.disclaimer)
  });
  const safeSection = (section: ReportSection): ReportSection => ({
    ...section,
    title: safe(section.title),
    subtitle: safeOptional(section.subtitle),
    paragraphs: section.paragraphs?.map(safe),
    bullets: section.bullets?.map(safe),
    cards: section.cards?.map(safeCard),
    details: section.details?.map((detail) => ({
      ...detail,
      summary: safe(detail.summary),
      content: safe(detail.content)
    })),
    callout: section.callout
      ? {
          ...section.callout,
          title: safeOptional(section.callout.title),
          body: safe(section.callout.body)
        }
      : undefined,
    table: section.table
      ? {
          headers: section.table.headers.map(safe),
          rows: section.table.rows.map((row) => row.map(safe))
        }
      : undefined
  });

  const sanitized: SajuReportData = {
    ...report,
    title: safe(report.title),
    subtitle: safe(report.subtitle),
    badge: safe(report.badge),
    heroNote: safe(report.heroNote),
    keyTakeaways: report.keyTakeaways.map(safeCard),
    currentDayun: {
      ...report.currentDayun,
      summary: safe(report.currentDayun.summary),
      focus: safe(report.currentDayun.focus),
      caution: safe(report.currentDayun.caution)
    },
    nextDayun: {
      ...report.nextDayun,
      summary: safe(report.nextDayun.summary),
      focus: safe(report.nextDayun.focus),
      caution: safe(report.nextDayun.caution)
    },
    legalNotice: safeList(report.legalNotice),
    visibleTenGods: report.visibleTenGods.map((item) => ({
      ...item,
      reading: safe(item.reading)
    })),
    tenGodBasisNote: safe(report.tenGodBasisNote),
    summary: {
      ...report.summary,
      title: safe(report.summary.title),
      analysis: safeList(report.summary.analysis),
      advice: safeList(report.summary.advice)
    },
    questionAnswers: report.questionAnswers.map((answer) => ({
      ...answer,
      question: answer.question,
      title: safe(answer.title),
      analysis: safe(answer.analysis),
      advice: safeList(answer.advice)
    })),
    sections: report.sections.map(safeSection),
    yearLuck: report.yearLuck.map((item) => ({
      ...item,
      headline: safe(item.headline),
      summary: safe(item.summary),
      focus: safe(item.focus),
      warning: safe(item.warning)
    })),
    monthLuck: report.monthLuck.map((item) => ({
      ...item,
      summary: safe(item.summary),
      focus: safe(item.focus),
      warning: safe(item.warning)
    })),
    actionPlan: {
      ...report.actionPlan,
      title: safe(report.actionPlan.title),
      priorities: safeList(report.actionPlan.priorities),
      dos: safeList(report.actionPlan.dos),
      avoids: safeList(report.actionPlan.avoids),
      luckyDays: report.actionPlan.luckyDays.map((item) => ({
        ...item,
        reason: safe(item.reason)
      })),
      unluckyDays: report.actionPlan.unluckyDays.map((item) => ({
        ...item,
        reason: safe(item.reason)
      }))
    },
    qualityAudit: {
      ...report.qualityAudit,
      warnings: safeList(report.qualityAudit.warnings),
      repeatedSentences: safeList(report.qualityAudit.repeatedSentences),
      bannedTerms: safeList(report.qualityAudit.bannedTerms),
      typoSignals: safeList(report.qualityAudit.typoSignals)
    },
    engineMeta: report.engineMeta
      ? {
          ...report.engineMeta,
          releaseBlockers: safeList(report.engineMeta.releaseBlockers),
          reviewFlags: safeList(report.engineMeta.reviewFlags),
          uncertainty: safeList(report.engineMeta.uncertainty)
        }
      : undefined,
    pastLifeProfile: report.pastLifeProfile
      ? safeProfile(report.pastLifeProfile)
      : undefined
  };

  return changed ? sanitized : report;
}
