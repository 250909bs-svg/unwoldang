import type { AiReportProvider } from '../../../lib/aiReport';
import type { ReportAccessMode } from '../../../lib/reportAccessGate';
import type { SajuReportData } from '../../../lib/saju/report';
import { buildGeneralSignatureReportViewModel } from '../presentation';
import '../general-signature-flow.css';

type Props = {
  report: SajuReportData;
  accessMode: ReportAccessMode;
  provider?: AiReportProvider;
};

export default function GeneralSignatureReportGuide({ report, accessMode, provider }: Props) {
  const viewModel = buildGeneralSignatureReportViewModel(report, { accessMode, provider });

  return (
    <section className="premium-report-section general-signature-report-guide" id="general-guide">
      <header className="general-signature-report-guide-head">
        <div>
          <span>GENERAL SIGNATURE MAP</span>
          <h2>계산 사실과 해설을 나눠 읽는 종합사주</h2>
          <p>위쪽 기준값을 먼저 확인한 뒤, 아래 열 개 주제를 같은 근거 흐름으로 따라가세요.</p>
        </div>
        <strong>{viewModel.accessLabel}</strong>
      </header>

      <div className="general-signature-report-layer-grid">
        <article className="general-signature-report-layer calculation-layer">
          <header>
            <span>LOCKED</span>
            <h3>{viewModel.calculation.label}</h3>
            <p>{viewModel.calculation.source}</p>
          </header>
          <dl>
            {viewModel.calculation.facts.map((fact) => (
              <div key={fact.id}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>
            ))}
          </dl>
          {viewModel.calculation.uncertainty.length ? (
            <details>
              <summary>계산 불확실성 {viewModel.calculation.uncertainty.length}건</summary>
              <ul>{viewModel.calculation.uncertainty.map((item) => <li key={item}>{item}</li>)}</ul>
            </details>
          ) : null}
        </article>

        <article className="general-signature-report-layer narrative-layer">
          <header>
            <span>EXPLAINED</span>
            <h3>{viewModel.narrative.label}</h3>
            <p>{viewModel.narrative.source}</p>
          </header>
          <nav aria-label="종합사주 주제 바로가기">
            {viewModel.narrative.tracks.map((track, index) => (
              <a key={track.id} href={`#${track.anchor}`}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{track.label}</strong>
                <small>{track.description}</small>
              </a>
            ))}
          </nav>
        </article>
      </div>
    </section>
  );
}
