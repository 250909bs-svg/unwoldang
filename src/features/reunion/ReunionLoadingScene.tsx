import { AlertTriangle, RotateCcw } from 'lucide-react';
import ReunionPicture from './ReunionPicture';
import '../../styles/reunion.css';

type ReunionLoadingSceneProps = {
  progress?: number;
  message?: string;
  error?: string | null;
  onRetry?: () => void;
};

const loadingSteps = ['두 사람의 명식 확인', '관계 흐름 정리', '행동 기준 구성', '리포트 점검'] as const;

export default function ReunionLoadingScene({
  progress = 0,
  message = '두 사람의 흐름과 현재 상황을 나누어 읽고 있어요.',
  error,
  onRetry
}: ReunionLoadingSceneProps) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const activeStep = Math.min(loadingSteps.length - 1, Math.floor(safeProgress / 25));

  return (
    <section
      className={`reunion-loading-scene${error ? ' is-error' : ''}`}
      aria-labelledby="reunion-loading-title"
      aria-busy={!error && safeProgress < 100}
    >
      <div className="reunion-loading-visual" aria-hidden="true">
        <ReunionPicture image="contact" className="reunion-loading-picture" alt="" />
        <span className="reunion-thread-line" />
        <i /><i /><i />
      </div>

      {error ? (
        <div className="reunion-loading-copy" role="alert">
          <AlertTriangle size={25} aria-hidden="true" />
          <h1 id="reunion-loading-title">리포트를 완성하지 못했어요</h1>
          <p>{error}</p>
          {onRetry ? (
            <button type="button" className="reunion-primary-button" onClick={onRetry}>
              <RotateCcw size={18} aria-hidden="true" />
              다시 시도
            </button>
          ) : null}
        </div>
      ) : (
        <div className="reunion-loading-copy" role="status" aria-live="polite">
          <span>운월당 재회운</span>
          <h1 id="reunion-loading-title">기대와 근거를<br />차분히 나누고 있어요</h1>
          <p>{message}</p>
          <div className="reunion-loading-meter">
            <div>
              <span>분석 진행</span>
              <strong>{safeProgress}%</strong>
            </div>
            <progress value={safeProgress} max={100}>{safeProgress}%</progress>
          </div>
          <ol className="reunion-loading-steps">
            {loadingSteps.map((step, index) => (
              <li key={step} className={index <= activeStep ? 'is-active' : undefined}>
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <small>화면을 닫아도 결제 내역으로 결과를 다시 확인할 수 있어요.</small>
        </div>
      )}
    </section>
  );
}
