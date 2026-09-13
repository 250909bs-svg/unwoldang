import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('general signature premium report UI contract', () => {
  const introSource = readSource('./GeneralSignatureReportIntro.tsx');
  const reportSource = readSource('../../pages/Report.tsx');
  const appSource = readSource('../../App.tsx');
  const cssSource = readSource('./generalSignatureReport.css');

  it('binds the cover and overview to the generated report instead of a named sample', () => {
    expect(introSource).toContain('report.customerName');
    expect(introSource).toContain('report.pillars');
    expect(introSource).toContain('report.currentDayun');
    expect(introSource).toContain('input.birthDate');
    expect(introSource).not.toContain("'차민호'");
    expect(introSource).not.toContain('gs-cover-masthead');
    expect(introSource).not.toContain('정통 사주 명리 연구소');
    expect(introSource).not.toContain('PRIVATE REPORT');
  });

  it('keeps the core report chapters and customer questions in the editorial flow', () => {
    expect(reportSource).toContain('SajuWonGukBoard report={report}');
    expect(reportSource).toContain('PremiumDayunFlow report={report}');
    expect(reportSource).toContain('<GeneralSignatureQuestionAnswer');
    expect(reportSource).toContain('className="gs-action-horizons"');
    expect(reportSource).toContain('className="premium-list gs-question-action-list"');
    expect(reportSource).toContain("qa.title.replace(/^\\d+\\.\\s*/, '')");
  });

  it('uses the report-specific full-width shell and avoids loading character video', () => {
    expect(appSource).toContain("location.pathname === '/report/general-signature'");
    expect(appSource).toContain("'app-container general-signature-report-app-container'");
    expect(reportSource).toContain('!isGeneralSignature && reportCharacterVideo');
    expect(cssSource).toContain('max-width: 980px');
    expect(cssSource).toContain('@media (max-width: 767px)');
  });

  it('keeps customer questions closed and internal audit sections out of the customer renderer', () => {
    expect(reportSource).toContain('className="premium-qa-block gs-question-disclosure"');
    expect(reportSource).toContain("open={report.serviceId === 'general-signature' ? false : detail.open}");
    expect(reportSource).toContain('prepareStaticReportExport(reportPaper, clonedPaper, !isGeneralSignature)');
    expect(reportSource).not.toContain('명리 근거 자세히 보기');
    expect(reportSource).not.toContain('number={`근거 ${index + 1}`}');
    expect(reportSource).not.toContain('className="premium-report-section gs-expert-analysis"');
    expect(reportSource).not.toContain('EXPERT ANALYSIS');
  });

  it('uses the six-chapter customer hierarchy and a single concise footer disclaimer', () => {
    expect(reportSource).toContain('getGeneralSignatureChapterNumber(section)');
    expect(reportSource).not.toContain("return '03-1'");
    expect(reportSource).not.toContain("return '03-2'");
    expect(reportSource).not.toContain('return `04-${topicIndex + 1}`');
    expect(reportSource).toContain("!isGeneralSignature ? summaryChapter : null");
    expect(reportSource).toContain("!isGeneralSignature ? (");
    expect(reportSource).not.toContain("id={isGeneralSignature ? 'support' : 'legal'}");
    expect(reportSource).toContain('특정 결과를 보장하거나 의료·법률·세무·투자 판단을 대신하지 않습니다');
    expect(reportSource).toContain("!['fortune', 'year', 'month', 'saju', 'logic'].includes(section.id)");
    expect(reportSource).toContain('GENERAL_SIGNATURE_TOPIC_ORDER.indexOf');
  });

  it('keeps a real HTML download action without the removed consultant masthead', () => {
    expect(reportSource).toContain('className="gs-report-download-button"');
    expect(reportSource).toContain('onClick={handleDownloadHtmlReport}');
    expect(reportSource).toContain('HTML 리포트 다운로드');
    expect(reportSource).not.toContain(['운월', '선생'].join(''));
  });

  it('removes score-meter visuals and disables remaining legacy report animation', () => {
    expect(reportSource).not.toContain('premium-month-meter');
    expect(reportSource).not.toContain('{item.score}점');
    expect(reportSource).toContain("summary: `${month.year}.${String(month.month).padStart(2, '0')} · ${getLuckPhase(month.score)} · ${month.ganzhi}`");
    expect(reportSource).not.toContain('순서는 월운 점수와 사건성을 함께 본 결과입니다');
    expect(cssSource).not.toContain('.premium-month-meter');
    expect(reportSource).not.toContain("section.id === 'month' ? <PremiumMonthCalendar");
    expect(cssSource).toContain('animation: none !important;');
  });

  it('does not hard-code the representative chart into reusable interpretation copy', () => {
    expect(reportSource).not.toContain("title: '무토 일간의 체감'");
    expect(reportSource).not.toContain('이 명식은 금수 환경에서');
    expect(reportSource).toContain("hasBranchPair(report, '자', '유')");
    expect(reportSource).toContain("hasBranchPair(report, '사', '신')");
  });

  it('keeps long report text and evidence tables readable on mobile', () => {
    expect(reportSource).toContain('data-label={visibleTable.headers[cellIndex]');
    expect(cssSource).toContain('.general-signature-report .premium-table td::before');
    expect(cssSource).toContain('font-size: 1rem;');
    expect(cssSource).toContain('width: 44px;');
    expect(cssSource).toContain('height: 44px;');
  });

  it('labels surface element counts separately from weighted strength analysis', () => {
    expect(reportSource).toContain('<h3>오행 분포</h3>');
    expect(reportSource).toContain('천간·지지 8글자의 단순 개수');
    expect(reportSource).toContain('가중 세력 점수와는 구분합니다');
    expect(reportSource).toContain('className="premium-element-bar"');
    expect(reportSource).toContain('className="premium-tengod-bar"');
  });
});
