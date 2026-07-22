import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { findServiceById, type IntakeFormData, type ServiceId } from '../api/mockData';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import type { ReportGenerationMetaV1 } from '../features/reports/contracts';
import { readPendingPayment, renewPaymentEntitlement, savePendingPayment } from '../lib/auth';
import { getAiReportEndpoint, requestAiReport, type AiReportProvider } from '../lib/aiReport';
import { getPaymentMode, getPortOneConfirmEndpoint } from '../lib/runtimeConfig';
import { buildSajuReport } from '../lib/saju/reportBuilder';
import type { SajuReportData } from '../lib/saju/report';
import { getProductById } from '../products/registry';

type LoadingLocationState = {
  product?: ServiceId;
  formData?: Partial<IntakeFormData>;
  paymentMethod?: string;
  orderId?: string;
  tabOrigin?: string;
  reportAccessToken?: string;
  reportData?: SajuReportData;
  reportProvider?: AiReportProvider;
  reportGenerationMeta?: ReportGenerationMetaV1;
  reportDegraded?: boolean;
};

const LOADING_FALLBACK_TIMEOUT_MS = 100000;

const LOADING_PILLARS = [
  { key: 'hour', label: '시주' },
  { key: 'day', label: '일주' },
  { key: 'month', label: '월주' },
  { key: 'year', label: '년주' }
] as const;

const LOADING_PHASES = ['원국 계산', '오행 균형', '질문 해석', '리포트 완성'];

const LOADING_PREVIEW_FORM_DATA: Partial<IntakeFormData> = {
  name: '차민호',
  gender: 'female',
  calendar: 'solar',
  isLeapMonth: false,
  birthDate: '1992-09-09',
  birthTime: '10:24',
  isUnknownTime: false,
  relationshipStatus: 'single',
  q1: '올해 가장 크게 들어오는 기회는 어느 쪽인가요?',
  q2: '재물운과 직업운 중 어떤 쪽에 집중해야 하나요?'
};

export default function Loading() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const locationState = (location.state as LoadingLocationState | null) ?? null;
  const recoveredPayment = useMemo(() => readPendingPayment(), []);
  const product = locationState?.product || recoveredPayment?.productId;
  const productDefinition = getProductById(product)!;
  const formData = locationState?.formData || recoveredPayment?.formData;
  const paymentMethod = locationState?.paymentMethod || recoveredPayment?.paymentMethod;
  const orderId = locationState?.orderId || recoveredPayment?.orderId;
  const tabOrigin = locationState?.tabOrigin || recoveredPayment?.tabOrigin;
  const initialReportAccessToken = locationState?.reportAccessToken || recoveredPayment?.reportAccessToken;
  const service = findServiceById(productDefinition.id);
  const isPastLifeProduct = productDefinition.flow.intakeVariant === 'past-life';
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [reportData, setReportData] = useState<SajuReportData | null>(locationState?.reportData || null);
  const [reportProvider, setReportProvider] = useState<AiReportProvider | null>(locationState?.reportProvider || null);
  const [reportGenerationMeta, setReportGenerationMeta] = useState<ReportGenerationMetaV1 | null>(
    locationState?.reportGenerationMeta || null
  );
  const [reportDegraded, setReportDegraded] = useState(
    locationState?.reportDegraded ?? locationState?.reportGenerationMeta?.fallback ?? false
  );
  const [reportAccessToken, setReportAccessToken] = useState(initialReportAccessToken || '');
  const [analysisFinished, setAnalysisFinished] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const [analysisFailed, setAnalysisFailed] = useState(false);
  const generationRunRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const hasAiEndpoint = Boolean(getAiReportEndpoint());
  const paymentMode = getPaymentMode();
  const requiresVerifiedPayment = paymentMode === 'live' || paymentMode === 'disabled';
  const confirmEndpoint = getPortOneConfirmEndpoint();
  const canRenewReportAccess = Boolean(
    requiresVerifiedPayment && confirmEndpoint && user?.authToken && (orderId || recoveredPayment?.orderId)
  );
  const canRequestAiReport = hasAiEndpoint && (Boolean(reportAccessToken) || canRenewReportAccess);
  const isMissingLiveReportAccess =
    requiresVerifiedPayment && !locationState?.reportData && (!hasAiEndpoint || (!reportAccessToken && !canRenewReportAccess));
  const previewReport = useMemo(() => {
    if (reportData) return reportData;
    if (!product) return null;
    try {
      return buildSajuReport(product || service.id, formData || LOADING_PREVIEW_FORM_DATA);
    } catch {
      return null;
    }
  }, [formData, product, reportData, service.id]);
  const elementTotal = Math.max(previewReport?.fiveElements.reduce((sum, item) => sum + item.value, 0) || 0, 1);

  const messages = useMemo(
    () =>
      isPastLifeProduct
        ? ['흑장부에서 당신의 이름을 찾는 중입니다.', '인연의 실을 맞추고 있습니다.', '현생에 남은 반복 장면을 읽고 있습니다.', '마지막 봉인을 풀고 있습니다.']
        : canRequestAiReport
        ? [
            `${service.advisor} 스타일로 프리미엄 리포트를 구성하고 있습니다.`,
            '입력한 사주 정보와 질문 2개를 바탕으로 AI 분석 결과를 생성하고 있습니다.',
            '총괄 요약, 질문 응답, 대운과 연운까지 결과 구조를 정리하고 있습니다.',
            '분석이 거의 완료되었습니다. 결과 화면으로 이동합니다.'
          ]
        : [
            `${service.advisor} 스타일로 기본 리포트를 구성하고 있습니다.`,
            '결제 상태와 입력값을 확인한 뒤 운월당 정밀 리포트를 구성하고 있습니다.',
            '질문 2개와 사주 입력값을 묶어서 결과 구조를 정리하고 있습니다.',
            '분석이 거의 완료되었습니다. 결과 화면으로 이동합니다.'
          ],
    [canRequestAiReport, isPastLifeProduct, service.advisor]
  );

  useEffect(() => {
    const generateReport = async () => {
      if (analysisFinished) return;
      if (!product || locationState?.reportData) {
        setAnalysisFinished(true);
        return;
      }
      if (isMissingLiveReportAccess) {
        setAnalysisNotice('결제 검증 정보가 확인되지 않아 리포트를 열 수 없습니다. 결제 화면에서 다시 진행해 주세요.');
        setAnalysisFinished(true);
        return;
      }
      if (!canRequestAiReport) {
        setReportData(buildSajuReport(product || service.id, formData || LOADING_PREVIEW_FORM_DATA));
        setAnalysisFinished(true);
        return;
      }

      try {
        const resolvedOrderId = orderId || recoveredPayment?.orderId;
        let resolvedReportAccessToken = reportAccessToken;
        if (requiresVerifiedPayment && confirmEndpoint && user?.authToken && resolvedOrderId) {
          try {
            const renewed = await renewPaymentEntitlement(confirmEndpoint, user.authToken, resolvedOrderId);
            resolvedReportAccessToken = renewed.reportAccessToken;
            if (recoveredPayment?.orderId === resolvedOrderId) {
              savePendingPayment({ ...recoveredPayment, reportAccessToken: renewed.reportAccessToken });
            }
          } catch (renewError) {
            if (!resolvedReportAccessToken) throw renewError;
          }
        }
        if (!resolvedReportAccessToken) {
          throw new Error('결제 리포트 접근 권한을 갱신할 수 없습니다. 카카오 로그인 후 다시 시도해 주세요.');
        }
        const generated = await requestAiReport(product, formData || {}, {
          orderId: resolvedOrderId,
          reportAccessToken: resolvedReportAccessToken
        });
        if (!generated) throw new Error('리포트 생성 서버 응답을 확인할 수 없습니다.');

        setReportData(generated.report);
        setReportProvider(generated.provider);
        setReportGenerationMeta(generated.generationMeta);
        setReportDegraded(generated.degraded);
        setReportAccessToken(resolvedReportAccessToken);
        if (generated.degraded) {
          setAnalysisNotice('AI 보강이 일시적으로 지연되어 검증된 내부 명리 엔진 리포트로 제공됩니다.');
        }
      } catch (error) {
        console.error('AI report request failed:', error);
        setAnalysisFailed(true);
        setAnalysisNotice(
          error instanceof Error
            ? error.message
            : 'AI 분석 생성에 실패했습니다. 결제 리포트는 기본 문장으로 대체하지 않고 다시 시도해야 합니다.'
        );
      } finally {
        setAnalysisFinished(true);
      }
    };

    const generationKey = `${product || 'missing'}:${orderId || recoveredPayment?.orderId || 'no-order'}`;
    if (!generationRunRef.current || generationRunRef.current.key !== generationKey) {
      generationRunRef.current = { key: generationKey, promise: generateReport() };
    }
    void generationRunRef.current.promise;
  }, [analysisFinished, canRequestAiReport, confirmEndpoint, formData, isMissingLiveReportAccess, locationState?.reportData, orderId, product, recoveredPayment, reportAccessToken, requiresVerifiedPayment, service.id, user?.authToken]);

  useEffect(() => {
    if (analysisFinished) return;
    const fallbackTimer = window.setTimeout(() => {
      if (canRequestAiReport) {
        setAnalysisFailed(true);
        setAnalysisNotice('AI 분석 응답이 예상보다 길어졌습니다. 기본 리포트로 대체하지 않고 다시 시도해 주세요.');
      } else {
        setAnalysisNotice('분석 응답이 예상보다 길어져 내부 리포트로 먼저 이동합니다.');
      }
      setAnalysisFinished(true);
    }, LOADING_FALLBACK_TIMEOUT_MS);
    return () => window.clearTimeout(fallbackTimer);
  }, [analysisFinished, canRequestAiReport]);

  useEffect(() => {
    const progressTimer = window.setInterval(() => {
      setProgress((prev) => {
        const ceiling = analysisFinished ? 100 : 92;
        const nextValue = Math.min(prev + 5, ceiling);
        if (nextValue >= 100) window.clearInterval(progressTimer);
        return nextValue;
      });
    }, 140);
    const messageTimer = window.setInterval(() => {
      setMessageIndex((prev) => Math.min(prev + 1, messages.length - 1));
    }, 820);
    return () => {
      window.clearInterval(progressTimer);
      window.clearInterval(messageTimer);
    };
  }, [analysisFinished, messages.length]);

  useEffect(() => {
    if (!analysisFinished || analysisFailed || progress < 100) return;
    const moveTimer = window.setTimeout(() => {
      if (isMissingLiveReportAccess) {
        navigate('/checkout', { replace: true, state: { product, formData, tabOrigin } });
        return;
      }
      navigate(`/report/${service.id}`, {
        replace: true,
        state: {
          ...locationState,
          product,
          formData,
          paymentMethod,
          orderId,
          tabOrigin,
          reportAccessToken,
          reportData: reportData || undefined,
          reportProvider: reportProvider || undefined,
          reportGenerationMeta: reportGenerationMeta || undefined,
          reportDegraded
        }
      });
    }, 300);
    return () => window.clearTimeout(moveTimer);
  }, [analysisFailed, analysisFinished, formData, isMissingLiveReportAccess, locationState, navigate, orderId, paymentMethod, product, progress, reportAccessToken, reportData, reportDegraded, reportGenerationMeta, reportProvider, service.id, tabOrigin]);

  return (
    <main className={isPastLifeProduct ? 'mobile-page-shell past-life-loading-page' : 'mobile-page-shell'}>
      <div className="mobile-page-card">
        <MobileTopBar title="리포트 생성 중" backTo="/" backLabel="홈" />
        <section className="mobile-page-content centered">
          <div className="mobile-loading-card saju-loading-card">
            <div className="saju-loading-head">
              <span className="mobile-chip">{isPastLifeProduct ? '도깨비 전생장부 봉인 해제' : '운월당 사주 원국 분석'}</span>
              <h1>{messages[messageIndex]}</h1>
            </div>
            {previewReport ? (
              <div className="saju-loading-board" aria-label="사주 원국 미리보기">
                <div className="saju-loading-board-head"><span>{previewReport.customerName}</span><strong>사주 원국</strong></div>
                <div className="saju-loading-pillars">
                  {LOADING_PILLARS.map((item) => {
                    const value = previewReport.pillars[item.key] || '미상';
                    return <article key={item.key}><span>{item.label}</span><strong>{value}</strong></article>;
                  })}
                </div>
              </div>
            ) : null}
            {previewReport ? (
              <div className="saju-loading-elements" aria-label="오행 분포">
                <div className="saju-loading-elements-head"><span>오행 분포</span><strong>{previewReport.dayMaster} 일간</strong></div>
                <div className="saju-loading-element-list">
                  {previewReport.fiveElements.map((item) => (
                    <div key={item.label} className={item.value === 0 ? 'empty' : undefined}>
                      <span>{item.label}</span>
                      <div className="saju-loading-element-track"><em style={{ width: `${Math.max(7, (item.value / elementTotal) * 100)}%`, background: item.color }} /></div>
                      <strong>{Math.round((item.value / elementTotal) * 100)}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <div className="saju-loading-phases" aria-label="분석 진행 단계">
              {(isPastLifeProduct ? ['이름 탐색', '인연 정렬', '현생 해석', '봉인 해제'] : LOADING_PHASES).map((phase, index) => (
                <span key={phase} className={progress >= (index + 1) * 24 ? 'active' : undefined}>{phase}</span>
              ))}
            </div>
            {analysisNotice ? <p className="mobile-loading-notice">{analysisNotice}</p> : null}
            {analysisFailed ? <div className="mobile-loading-actions"><button type="button" className="app-black-button" onClick={() => window.location.reload()}>AI 분석 다시 시도</button></div> : null}
            <div className="saju-loading-progress"><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><strong>{progress}%</strong></div>
          </div>
        </section>
      </div>
    </main>
  );
}
