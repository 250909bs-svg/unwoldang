import type { SajuReportData } from './report';

function customerText(report: SajuReportData) {
  const { engineMeta: _engineMeta, qualityAudit: _qualityAudit, ...visible } = report;
  return JSON.stringify(visible);
}

export function findReportConsistencyViolations(report: SajuReportData) {
  const violations: string[] = [];
  const meta = report.engineMeta;
  const visible = customerText(report);

  if (meta?.calculationPrecision === 'exact-minute') {
    if (!report.pillars.year || !report.pillars.month || !report.pillars.day || !report.pillars.hour) {
      violations.push('정확 시각 입력인데 사주 네 기둥이 완성되지 않았습니다.');
    }
    if (/미정|미상|\bunknown\b/i.test(visible)) {
      violations.push('정확 시각 리포트에 불확정 계산값이 노출됩니다.');
    }
  }

  if (meta?.calculationPrecision === 'unknown' && report.pillars.hour !== null) {
    violations.push('출생시간 미상인데 시주가 확정됐습니다.');
  }

  if (meta?.yongsinConsensusStatus === 'confirmed' && meta.helpfulElementSource !== 'expert-consensus') {
    violations.push('용신 합의 상태와 도움 오행 출처가 일치하지 않습니다.');
  }

  if (meta?.yongsinConsensusStatus !== 'confirmed' && meta?.helpfulElementSource === 'expert-consensus') {
    violations.push('비확정 용신 후보가 확정 도움 오행으로 승격됐습니다.');
  }

  const expertText = JSON.stringify(report.sections.filter((section) => section.id === 'expert-evidence-v2'));
  if (meta?.climateTemperature === 'cold' && /한난은\s*(?:더운|온난)/.test(expertText)) {
    violations.push('조후 한난 결론이 계산값과 반대로 표시됩니다.');
  }
  if (meta?.climateTemperature === 'hot' && /한난은\s*(?:추운|한랭)/.test(expertText)) {
    violations.push('조후 한난 결론이 계산값과 반대로 표시됩니다.');
  }
  if (meta?.climateMoisture === 'dry' && /조습은\s*(?:습한|과습)/.test(expertText)) {
    violations.push('조후 조습 결론이 계산값과 반대로 표시됩니다.');
  }
  if (meta?.climateMoisture === 'wet' && /조습은\s*(?:건조한|건조)/.test(expertText)) {
    violations.push('조후 조습 결론이 계산값과 반대로 표시됩니다.');
  }

  const actionItems = report.actionPlan.priorities.map((item) => item.replace(/\s+/g, ' ').trim());
  if (actionItems.some((item) => !item)) {
    violations.push('실행 계획에 빈 항목이 있습니다.');
  }
  if (new Set(actionItems).size !== actionItems.length) {
    violations.push('실행 계획에 동일한 행동이 반복됩니다.');
  }

  return violations;
}

export function assertReportConsistency(report: SajuReportData) {
  const violations = findReportConsistencyViolations(report);
  if (violations.length > 0) {
    throw new Error(`리포트 일관성 검사를 통과하지 못했습니다: ${violations.join(' ')}`);
  }
}
