import type { IntakeFormData } from '../../../api/mockData';
import { getGeneralSignatureInputPolicySummary } from '../intake';
import { GENERAL_SIGNATURE_PRODUCT } from '../product';
import '../general-signature-flow.css';

type Props = { formData: Partial<IntakeFormData> };

export default function GeneralSignaturePolicyNotice({ formData }: Props) {
  const summary = getGeneralSignatureInputPolicySummary(formData);

  return (
    <aside className="general-signature-policy-note" aria-label="종합사주 계산 정책 안내">
      <header><span>CALCULATION POLICY</span><strong>선택한 기준을 계산 기록에 그대로 남깁니다</strong></header>
      <dl>
        <div><dt>달력</dt><dd>{summary.calendar}</dd></div>
        <div><dt>출생 시각</dt><dd>{summary.birthTime}</dd></div>
        <div><dt>23시 경계</dt><dd>{summary.dayBoundary}</dd></div>
        <div><dt>출생지</dt><dd>{summary.solarTime}</dd></div>
      </dl>
      <details>
        <summary>시간 미상·음력·윤달 정책 자세히 보기</summary>
        <ul>
          {GENERAL_SIGNATURE_PRODUCT.intake.policies.map((policy) => (
            <li key={policy.id}><strong>{policy.title}</strong><span>{policy.body}</span></li>
          ))}
        </ul>
      </details>
    </aside>
  );
}
