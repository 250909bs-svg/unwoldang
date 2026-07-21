import type { AiReportProvider } from '../../lib/aiReport';
import type { ReportAccessMode } from '../../lib/reportAccessGate';
import type { SajuReportData } from '../../lib/saju/report';
import { GENERAL_SIGNATURE_PRODUCT } from './product';

export type GeneralSignatureCalculationFact = {
  id: 'pillars' | 'elements' | 'ten-gods' | 'timing' | 'policy';
  label: string;
  value: string;
};

export type GeneralSignatureReportViewModel = {
  calculation: {
    label: '계산 사실';
    source: string;
    facts: GeneralSignatureCalculationFact[];
    uncertainty: string[];
  };
  narrative: {
    label: '해설과 행동';
    source: string;
    tracks: typeof GENERAL_SIGNATURE_PRODUCT.report.tracks;
  };
  accessLabel: string;
};

function getCalculationPrecisionLabel(report: SajuReportData) {
  switch (report.engineMeta?.calculationPrecision) {
    case 'exact-minute':
      return '정확 시각';
    case 'legacy-range':
      return `시간대 ${report.engineMeta?.scenarioCount || 1}개 시나리오 비교`;
    case 'unknown':
      return `시간 미상 ${report.engineMeta?.scenarioCount || 13}개 시나리오 비교`;
    default:
      return '보관본 계산 정책';
  }
}

function getDayBoundaryLabel(report: SajuReportData) {
  if (report.engineMeta?.dayBoundaryPolicy !== 'late-zi-next-day') {
    return '달력상 자정 기준';
  }

  return report.engineMeta.trueSolarTime.applied
    ? '진태양시 보정 후 23:00~23:59 익일 기준'
    : '입력 시각 23:00~23:59 익일 기준';
}

function getNarrativeSource(provider?: AiReportProvider) {
  if (provider === 'gemini') {
    return '검증된 계산 근거를 바탕으로 구성한 AI 해설';
  }

  if (provider === 'deterministic-fallback') {
    return '검증된 내부 명리 엔진 문장';
  }

  return '계산 근거에 연결된 생활 해설';
}

function getAccessLabel(mode: ReportAccessMode) {
  switch (mode) {
    case 'archive-replay':
      return '결제 보관본 재열람';
    case 'new-generation':
      return '결제 검증 완료 리포트';
    case 'local-preview':
      return '개발 전용 미리보기';
    default:
      return '접근 확인 필요';
  }
}

export function buildGeneralSignatureReportViewModel(
  report: SajuReportData,
  options: { accessMode: ReportAccessMode; provider?: AiReportProvider }
): GeneralSignatureReportViewModel {
  const elementTotal = Math.max(report.fiveElements.reduce((sum, item) => sum + item.value, 0), 1);
  const elements = report.fiveElements
    .map((item) => `${item.label} ${Math.round((item.value / elementTotal) * 100)}%`)
    .join(' · ');
  const tenGods = [...report.tenGods]
    .sort((left, right) => right.value - left.value)
    .slice(0, 4)
    .map((item) => `${item.label} ${item.value}`)
    .join(' · ');
  const pillars = [report.pillars.year, report.pillars.month, report.pillars.day, report.pillars.hour || '시주 미상'].join(' · ');
  const firstYear = report.yearLuck[0];
  const timing = firstYear
    ? `${report.currentDayun.name} 대운 · ${firstYear.year} ${firstYear.ganzhi} 세운`
    : `${report.currentDayun.name} 대운 · 세운 기록 확인`;
  const policy = `${getCalculationPrecisionLabel(report)} · ${getDayBoundaryLabel(report)}`;

  return {
    calculation: {
      label: '계산 사실',
      source: `${report.engineMeta?.engineVersion || '운월당 명리 엔진'} · 해설이 변경할 수 없는 기준값`,
      facts: [
        { id: 'pillars', label: '명식', value: pillars },
        { id: 'elements', label: '오행', value: elements },
        { id: 'ten-gods', label: '십신', value: tenGods || '십신 분포 기록' },
        { id: 'timing', label: '대운·세운', value: timing },
        { id: 'policy', label: '시간 정책', value: policy }
      ],
      uncertainty: [...(report.engineMeta?.uncertainty || [])]
    },
    narrative: {
      label: '해설과 행동',
      source: getNarrativeSource(options.provider),
      tracks: GENERAL_SIGNATURE_PRODUCT.report.tracks
    },
    accessLabel: getAccessLabel(options.accessMode)
  };
}
