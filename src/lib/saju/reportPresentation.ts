import { normalizeCustomerFacingTextTree } from '../koreanText';
import type { ReportSection, SajuReportData } from './report';

const CUSTOMER_FORBIDDEN_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/은\(는\)|이\(가\)|을\(를\)|과\(와\)/, '조사 placeholder'],
  [/님가|미상로|편인와/, '잘못된 한국어 조사'],
  [/\b(?:not-configured|supported|conditional|insufficient|balanced|eokbu|tonggwan)\b/i, '내부 상태값'],
  [/MRE-V2|unwoldang-myeongri-v/i, '내부 엔진 식별자'],
  [/\bundefined\b|\bnull\b|\[object Object\]/i, '직렬화 오류 문자열']
];

function cleanList(values?: string[]) {
  return values?.map((value) => value.trim()).filter(Boolean);
}

function cleanSection(section: ReportSection): ReportSection {
  const paragraphs = cleanList(section.paragraphs);
  const bullets = cleanList(section.bullets);
  const cards = section.cards
    ?.filter((card) => card.title?.trim() && card.body?.trim())
    .map((card) => ({ ...card, title: card.title.trim(), body: card.body.trim() }));
  const details = section.details
    ?.filter((detail) => detail.summary?.trim() && detail.content?.trim())
    .map((detail) => ({ ...detail, summary: detail.summary.trim(), content: detail.content.trim() }));
  const table = section.table
    ? {
        headers: section.table.headers.map((header) => header.trim()),
        rows: section.table.rows.filter((row) => row.some((cell) => cell.trim()))
      }
    : undefined;
  const callout = section.callout?.body?.trim()
    ? { title: section.callout.title?.trim(), body: section.callout.body.trim() }
    : undefined;
  const hasBody = Boolean(
    paragraphs?.length || bullets?.length || cards?.length || details?.length || table?.rows.length || callout
  );

  return {
    ...section,
    title: section.title.trim(),
    subtitle: section.subtitle?.trim(),
    paragraphs,
    bullets,
    cards,
    details,
    table,
    callout: hasBody
      ? callout
      : {
          title: '현재 명식의 판정 기준',
          body: '현재 명식에서는 이 항목을 단독으로 확정할 조건이 충분하지 않아 월령·강약·대운을 함께 보아 해석합니다.'
        }
  };
}

function visibleReportPayload(report: SajuReportData) {
  const { engineMeta: _engineMeta, qualityAudit: _qualityAudit, ...visible } = report;
  return visible;
}

function collectVisibleStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectVisibleStrings);
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(collectVisibleStrings);
  }
  return [];
}

export function findCustomerReportTextViolations(report: SajuReportData) {
  const text = collectVisibleStrings(visibleReportPayload(report)).join('\n');
  const violations = CUSTOMER_FORBIDDEN_PATTERNS
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label);

  if (report.engineMeta?.calculationPrecision === 'exact-minute' && /미정|미상|\bunknown\b/i.test(text)) {
    violations.push('정확 시각 리포트의 미정·미상 값');
  }

  return [...new Set(violations)];
}

export function finalizeCustomerReport(report: SajuReportData): SajuReportData {
  const { engineMeta, ...customerFields } = report;
  const normalized = normalizeCustomerFacingTextTree(customerFields) as Omit<SajuReportData, 'engineMeta'>;

  return {
    ...normalized,
    questionPreview: report.questionPreview,
    questionAnswers: normalized.questionAnswers.map((answer, index) => ({
      ...answer,
      question: report.questionAnswers[index]?.question || answer.question
    })),
    sections: normalized.sections.map(cleanSection),
    engineMeta
  };
}

export function assertCustomerReportQuality(report: SajuReportData) {
  const violations = findCustomerReportTextViolations(report);
  if (violations.length > 0) {
    throw new Error(`고객 리포트 문장 품질 검사를 통과하지 못했습니다: ${violations.join(', ')}`);
  }
}
