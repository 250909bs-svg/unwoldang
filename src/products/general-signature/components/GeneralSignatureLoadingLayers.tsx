import { GENERAL_SIGNATURE_PRODUCT } from '../product';
import '../general-signature-flow.css';

export default function GeneralSignatureLoadingLayers() {
  return (
    <div className="general-signature-loading-layers" aria-label="계산과 해설 생성 구분">
      <article>
        <span>01 · CALCULATION</span>
        <strong>계산 데이터</strong>
        <p>명식·오행·십신·대운·세운과 입력 정책을 먼저 고정합니다.</p>
      </article>
      <article>
        <span>02 · NARRATIVE</span>
        <strong>해설과 행동</strong>
        <p>고정된 근거를 바꾸지 않고 질문 2개와 행동 가이드로 연결합니다.</p>
      </article>
      <small>{GENERAL_SIGNATURE_PRODUCT.displayName}</small>
    </div>
  );
}
