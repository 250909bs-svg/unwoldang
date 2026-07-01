import type { ReportQualityAudit, ReportQualityScoreItem, SajuReportData } from './report';

const BANNED_TERMS = [
  '열기/닫기',
  'attraction',
  'long-term',
  'caution',
  'action',
  'route',
  'contact',
  'mirror',
  'pattern',
  'need',
  'face mood',
  'career',
  'marriage'
];

const TYPO_SIGNALS = [
  '비견은 비견은',
  '식신은 식신은',
  '화이 강하게',
  '돈·사업 구조과',
  '나회사계속',
  '입니다.입니다',
  '중요합니다.입니다',
  '안전합니다.입니다',
  '토 · 화을',
  '토·화을'
];

function flattenReportTexts(report: SajuReportData) {
  const texts: string[] = [
    report.title,
    report.subtitle,
    report.badge,
    report.heroNote,
    report.summary.title,
    ...report.summary.analysis,
    ...report.summary.advice,
    ...report.legalNotice,
    report.currentDayun.summary,
    report.currentDayun.focus,
    report.currentDayun.caution,
    report.nextDayun.summary,
    report.nextDayun.focus,
    report.nextDayun.caution,
    ...report.keyTakeaways.flatMap((card) => [card.title, card.body, card.badge || '']),
    ...report.questionAnswers.flatMap((answer) => [
      answer.question,
      answer.title,
      answer.analysis,
      ...answer.advice
    ]),
    ...report.yearLuck.flatMap((item) => [
      item.ganzhi,
      item.headline,
      item.summary,
      item.focus,
      item.warning
    ]),
    ...report.monthLuck.flatMap((item) => [
      item.ganzhi,
      item.summary,
      item.focus,
      item.warning
    ]),
    report.actionPlan.title,
    ...report.actionPlan.priorities,
    ...report.actionPlan.dos,
    ...report.actionPlan.avoids,
    ...report.actionPlan.luckyDays.map((item) => item.reason),
    ...report.actionPlan.unluckyDays.map((item) => item.reason)
  ];

  for (const section of report.sections) {
    texts.push(section.title, section.subtitle || '');
    texts.push(...(section.paragraphs || []), ...(section.bullets || []));
    if (section.callout) {
      texts.push(section.callout.title || '', section.callout.body);
    }
    if (section.table) {
      texts.push(...section.table.headers, ...section.table.rows.flat());
    }
    for (const card of section.cards || []) {
      texts.push(card.title, card.body, card.badge || '');
    }
    for (const detail of section.details || []) {
      texts.push(detail.summary, detail.content);
    }
  }

  return texts.filter(Boolean);
}

function splitSentences(texts: string[]) {
  return texts
    .flatMap((text) => text.replace(/([.!?。！？])/g, '$1\n').split(/\n+/g))
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.replace(/\s/g, '').length >= 18);
}

function normalizeSentence(sentence: string) {
  return sentence
    .replace(/\d+/g, '#')
    .replace(/[“”"'.?!,·:;()[\]{}]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

function findRepeatedSentences(texts: string[]) {
  const seen = new Map<string, { sentence: string; count: number }>();

  for (const sentence of splitSentences(texts)) {
    const normalized = normalizeSentence(sentence);
    if (normalized.length < 18) continue;
    const current = seen.get(normalized);
    if (current) {
      current.count += 1;
    } else {
      seen.set(normalized, { sentence, count: 1 });
    }
  }

  return Array.from(seen.values())
    .filter((item) => item.count >= 2)
    .map((item) => item.sentence)
    .slice(0, 12);
}

function findBannedTerms(texts: string[]) {
  const haystack = texts.join('\n').toLowerCase();
  return BANNED_TERMS.filter((term) => haystack.includes(term.toLowerCase()));
}

function findTypoSignals(texts: string[]) {
  const haystack = texts.join('\n');
  const fixedSignals = TYPO_SIGNALS.filter((signal) => haystack.includes(signal));
  const repeatedSubjectSignals = haystack.match(/([가-힣]{2,6})은\s+\1은/g) || [];
  return Array.from(new Set([...fixedSignals, ...repeatedSubjectSignals])).slice(0, 12);
}

function findEmptySectionWarnings(report: SajuReportData) {
  return report.sections
    .filter((section) => {
      const hasText = [
        ...(section.paragraphs || []),
        ...(section.bullets || []),
        section.callout?.body || '',
        ...(section.cards || []).map((card) => card.body),
        ...(section.details || []).map((detail) => detail.content),
        ...(section.table?.rows.flat() || [])
      ].some((text) => text.trim().length > 0);
      return !hasText;
    })
    .map((section) => `빈 섹션: ${section.title}`);
}

function clampScore(value: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(value)));
}

function countActionSignals(report: SajuReportData) {
  const text = flattenReportTexts(report).join('\n');
  const matches = text.match(/오늘|7일|30일|90일|가격표|정산|제공 범위|환불|마감|기록|메모|실행|체크리스트/g);
  return matches?.length || 0;
}

function scoreItems(report: SajuReportData, repeated: string[], banned: string[], typos: string[], emptyWarnings: string[]): ReportQualityScoreItem[] {
  const questionTextLength = report.questionAnswers.reduce((sum, answer) => sum + answer.analysis.replace(/\s/g, '').length, 0);
  const answerAdviceCount = report.questionAnswers.reduce((sum, answer) => sum + answer.advice.length, 0);
  const hasVisibleTenGods = report.visibleTenGods.length >= 4;
  const hasBasisNote = report.tenGodBasisNote.includes('지장간 포함');
  const hasPillars = Boolean(report.pillars.year && report.pillars.month && report.pillars.day);
  const actionSignals = countActionSignals(report);
  const text = flattenReportTexts(report).join('\n');
  const hasCoreMyeongriTerms = ['월령', '조후', '십성', '대운'].filter((term) => text.includes(term)).length;

  return [
    {
      label: '개인맞춤성',
      max: 20,
      score: clampScore(
        10 +
          (report.customerName ? 3 : 0) +
          (report.questionAnswers.length > 0 ? 3 : 0) +
          (questionTextLength >= 600 ? 4 : questionTextLength >= 300 ? 2 : 0),
        20
      )
    },
    {
      label: '명리 정확성',
      max: 20,
      score: clampScore(
        8 +
          (hasPillars ? 4 : 0) +
          (report.fiveElements.length === 5 ? 3 : 0) +
          (hasVisibleTenGods ? 3 : 0) +
          (hasBasisNote ? 2 : 0),
        20
      )
    },
    {
      label: '질문 직답성',
      max: 15,
      score: clampScore(
        report.questionAnswers.length === 0
          ? 11
          : report.questionAnswers.reduce((sum, answer) => {
              const direct = /결론부터|바로 답하면|우선순위|답은/.test(answer.analysis) ? 3 : 0;
              const length = answer.analysis.replace(/\s/g, '').length >= 300 ? 3 : 1;
              return sum + direct + length;
            }, 0),
        15
      )
    },
    {
      label: '실행 가능성',
      max: 15,
      score: clampScore(6 + Math.min(9, Math.floor(actionSignals / 2)) + Math.min(3, answerAdviceCount / 6), 15)
    },
    {
      label: '문장 품질',
      max: 10,
      score: clampScore(10 - typos.length * 2 - emptyWarnings.length * 2, 10)
    },
    {
      label: '중복 제거',
      max: 10,
      score: clampScore(10 - repeated.length * 2, 10)
    },
    {
      label: '상품 만족도',
      max: 10,
      score: clampScore(
        4 +
          (report.keyTakeaways.length >= 5 ? 2 : 0) +
          (report.sections.some((section) => section.title.includes('체크리스트') || section.title.includes('프리미엄')) ? 2 : 0) +
          (hasCoreMyeongriTerms >= 3 ? 2 : 0) -
          banned.length,
        10
      )
    }
  ];
}

export function scoreReportQuality(report: SajuReportData): ReportQualityAudit {
  const texts = flattenReportTexts(report);
  const repeatedSentences = findRepeatedSentences(texts);
  const bannedTerms = findBannedTerms(texts);
  const typoSignals = findTypoSignals(texts);
  const emptyWarnings = findEmptySectionWarnings(report);
  const items = scoreItems(report, repeatedSentences, bannedTerms, typoSignals, emptyWarnings);
  const score = items.reduce((sum, item) => sum + item.score, 0);
  const warnings = [
    ...repeatedSentences.map((sentence) => `반복 문장: ${sentence}`),
    ...bannedTerms.map((term) => `잔여 라벨: ${term}`),
    ...typoSignals.map((signal) => `문장 오류 의심: ${signal}`),
    ...emptyWarnings
  ].slice(0, 24);

  return {
    score,
    status: score >= 90 && warnings.length === 0 ? 'pass' : 'warn',
    items,
    warnings,
    repeatedSentences,
    bannedTerms,
    typoSignals
  };
}
