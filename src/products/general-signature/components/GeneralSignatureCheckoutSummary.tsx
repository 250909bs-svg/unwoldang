import type { IntakeFormData } from '../../../api/mockData';
import { getGeneralSignatureInputPolicySummary } from '../intake';
import { GENERAL_SIGNATURE_PRODUCT } from '../product';
import '../general-signature-flow.css';

type Props = { formData: Partial<IntakeFormData> };

export default function GeneralSignatureCheckoutSummary({ formData }: Props) {
  const policy = getGeneralSignatureInputPolicySummary(formData);

  return (
    <section className="general-signature-checkout-contract" aria-labelledby="general-signature-contract-title">
      <header>
        <span>REPORT CONTRACT</span>
        <h2 id="general-signature-contract-title">{GENERAL_SIGNATURE_PRODUCT.checkout.contractTitle}</h2>
      </header>
      <ol>
        {GENERAL_SIGNATURE_PRODUCT.checkout.stages.map((stage, index) => (
          <li key={stage}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{stage}</strong>
          </li>
        ))}
      </ol>
      <dl>
        <div><dt>달력</dt><dd>{policy.calendar}</dd></div>
        <div><dt>시각</dt><dd>{policy.birthTime}</dd></div>
        <div><dt>날짜 경계</dt><dd>{policy.dayBoundary}</dd></div>
        <div><dt>출생지</dt><dd>{policy.solarTime}</dd></div>
      </dl>
      <p>{GENERAL_SIGNATURE_PRODUCT.checkout.securityNote}</p>
    </section>
  );
}
