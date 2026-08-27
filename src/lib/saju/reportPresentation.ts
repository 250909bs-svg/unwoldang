import { normalizeCustomerFacingTextTree } from '../koreanText';
import type { ReportSection, SajuReportData } from './report';

const CUSTOMER_FORBIDDEN_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/은\(는\)|이\(가\)|을\(를\)|과\(와\)/, '조사 placeholder'],
  [/님가|미상로|편인와/, '잘못된 한국어 조사'],
  [/\b(?:not-configured|supported|conditional|insufficient|balanced|eokbu|tonggwan)\b/i, '내부 상태값'],
  [/MRE-V2|unwoldang-myeongri-v/i, '내부 엔진 식별자'],
  [/\bundefined\b|\bnull\b|\[object Object\]/i, '직렬화 오류 문자열']
];

const CUSTOMER_ADDITIONAL_FORBIDDEN_PATTERNS: ReadonlyArray<[RegExp, string]> = [
  [/겁재은|식신와|정인가|사은 사건|태은 사건|무은지형|돈·사업 구조과|비교적 균형적인 편입니다로 판정했습니다/, '잘못된 한국어 조사'],
  [/\b(?:weak|strong|cold|hot|dry|wet|johu|byeongyak)\b/i, '내부 상태값'],
  [/\b(?:relation|natal|dayun|seun|wolyun|luck):|branch\+|fingerprint|engine version|rule id/i, '내부 근거 식별자'],
  [/고객 체감|읽는 사람이|상담받는 느낌|AI가|프롬프트|\bLLM\b/i, '제작 과정 메타 문구'],
  [/30 SECOND BRIEFING|TIME DESIGN/i, '영문 장식 문구'],
  [/마음이 식으면[^.!?\n]{0,30}회복이 오래 걸리지 않습니다/, '의미가 반대인 회복 문장']
];

const INTERNAL_AUDIT_ROW = /엔진|상용 발행|근거 충족|재현 지문/;
const INTERNAL_AUDIT_TEXT = /외부.*(?:미연결|실패)|수동 검토|전문가 검토|레거시|상용 발행|발행 차단/;
const INTERNAL_DETAIL_LINE = /^(?:규칙|근거 ID|내부 근거|재현 지문)\s*:/;

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

function customerTendency(value: string) {
  return value
    .replace(/\blatent-friction\b/gi, '잠재적 마찰 가능성')
    .replace(/\bsupportive\b/gi, '조화를 돕는 흐름')
    .replace(/\btension\b/gi, '조정이 필요한 흐름')
    .replace(/\bneutral\b/gi, '중립적인 흐름')
    .replace(/\btransformative\b/gi, '변화를 만드는 흐름')
    .replace(/\bfriction\b/gi, '마찰 가능성');
}

function removeInternalDetailLines(value: string) {
  return value.split(/\n+/)
    .filter((line) => line.trim() && !INTERNAL_DETAIL_LINE.test(line.trim()))
    .join('\n\n');
}

function sanitizeCustomerSection(section: ReportSection): ReportSection {
  if (section.id === 'calculation-audit-v2') {
    const paragraphs = section.paragraphs
      ?.filter((paragraph) => !/감사 정보|엔진|미래 사건의 적중 확률/.test(paragraph))
      .map((paragraph) => paragraph.replace(/대표 시나리오/g, '적용값'));
    const rows = section.table?.rows.filter(([label, value]) => (
      !INTERNAL_AUDIT_ROW.test(label) &&
      (label !== '외부 역법 대조' || /일치|대조 완료/.test(value))
    ));
    const bullets = section.bullets?.filter((item) => !INTERNAL_AUDIT_TEXT.test(item));
    return {
      ...section,
      title: '계산 기준',
      subtitle: '입력값과 적용한 달력·시간 정책을 함께 기록했습니다.',
      paragraphs,
      table: section.table && rows?.length ? { ...section.table, rows } : undefined,
      bullets: bullets?.length ? bullets : undefined
    };
  }

  if (section.id === 'expert-evidence-v2') {
    return {
      ...section,
      title: '월령·조후·용신 근거 자세히 보기',
      subtitle: '쉬운 결론 뒤에 적용한 명리 관점과 판단 근거를 보존했습니다.',
      cards: section.cards?.filter((card) => card.title !== '판정 출처')
        .map((card) => ({ ...card, badge: undefined })),
      details: section.details?.map((detail) => ({
        ...detail,
        summary: detail.summary
          .replace(/\s*·\s*(?:근거가 충분합니다|조건을 함께 봐야 합니다|현재 정보로는 판단을 유보합니다).*$/, '')
          .replace(/\s*·\s*근거 (?:강함|보통|제한).*$/, ''),
        content: removeInternalDetailLines(detail.content),
        open: false
      }))
    };
  }

  if (section.id === 'temporal-evidence-v2' || section.id === 'compatibility-evidence-v2') {
    return {
      ...section,
      cards: section.cards?.map((card) => ({
        ...card,
        badge: card.badge ? customerTendency(card.badge).replace(/\s*·\s*근거 (?:강함|보통|제한)/, '') : undefined
      })),
      details: section.details?.map((detail) => ({
        ...detail,
        summary: customerTendency(detail.summary),
        content: removeInternalDetailLines(detail.content),
        open: false
      }))
    };
  }

  return section;
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
  const violations = [...CUSTOMER_FORBIDDEN_PATTERNS, ...CUSTOMER_ADDITIONAL_FORBIDDEN_PATTERNS]
    .filter(([pattern]) => pattern.test(text))
    .map(([, label]) => label);

  if (report.serviceId === 'general-signature' && /1인 브랜드|상담형 (?:상품|서비스)|개인 맞춤 리포트|디지털 리포트|후속 질문권|월간 점검|B2B 운영|2,900원 유입|9,900원 주력|34,900원 심층|파일럿 고객/.test(text)) {
    violations.push('입력하지 않은 직업·사업 모델 자기투영');
  }

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
    sections: normalized.sections.map(cleanSection).map(sanitizeCustomerSection),
    engineMeta
  };
}

export function assertCustomerReportQuality(report: SajuReportData) {
  const violations = findCustomerReportTextViolations(report);
  if (violations.length > 0) {
    throw new Error(`고객 리포트 문장 품질 검사를 통과하지 못했습니다: ${violations.join(', ')}`);
  }
}
