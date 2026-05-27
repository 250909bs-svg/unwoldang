import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { findServiceById, type IntakeFormData, type ServiceId } from '../api/mockData';
import MobileTopBar from '../components/MobileTopBar';
import { readPendingPayment } from '../lib/auth';
import { getAiReportEndpoint, requestAiReport } from '../lib/aiReport';
import { getPaymentMode } from '../lib/runtimeConfig';
import { buildSajuReport } from '../lib/saju/reportBuilder';
import type { SajuReportData } from '../lib/saju/report';

type LoadingLocationState = {
  product?: ServiceId;
  formData?: Partial<IntakeFormData>;
  paymentMethod?: string;
  orderId?: string;
  tabOrigin?: string;
  reportAccessToken?: string;
  reportData?: SajuReportData;
};

const LOADING_FALLBACK_TIMEOUT_MS = 28000;

const LOADING_PILLARS = [
  { key: 'hour', label: '시주' },
  { key: 'day', label: '일주' },
  { key: 'month', label: '월주' },
  { key: 'year', label: '년주' }
] as const;

const LOADING_PHASES = ['원국 계산', '오행 균형', '질문 해석', '리포트 완성'];

const LOADING_PREVIEW_FORM_DATA: Partial<IntakeFormData> = {
  name: '운월당',
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
  const locationState = (location.state as LoadingLocationState | null) ?? null;
  const recoveredPayment = useMemo(() => readPendingPayment(), []);
  const product = locationState?.product || recoveredPayment?.productId;
  const formData = locationState?.formData || recoveredPayment?.formData;
  const paymentMethod = locationState?.paymentMethod || recoveredPayment?.paymentMethod;
  const orderId = locationState?.orderId || recoveredPayment?.orderId;
  const tabOrigin = locationState?.tabOrigin || recoveredPayment?.tabOrigin;
  const reportAccessToken = locationState?.reportAccessToken || recoveredPayment?.reportAccessToken;
  const service = findServiceById(product);
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [reportData, setReportData] = useState<SajuReportData | null>(locationState?.reportData || null);
  const [analysisFinished, setAnalysisFinished] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const hasAiEndpoint = Boolean(getAiReportEndpoint());
  const paymentMode = getPaymentMode();
  const canRequestAiReport = hasAiEndpoint && Boolean(reportAccessToken);
  const isMissingLiveReportAccess =
    paymentMode === 'live' && hasAiEndpoint && !locationState?.reportData && !reportAccessToken;
  const previewReport = useMemo(() => {
    if (reportData) {
      return reportData;
    }

    if (!product) {
      return null;
    }

    try {
      return buildSajuReport(product || service.id, formData || LOADING_PREVIEW_FORM_DATA);
    } catch {
      return null;
    }
  }, [formData, product, reportData, service.id]);
  const elementTotal = Math.max(previewReport?.fiveElements.reduce((sum, item) => sum + item.value, 0) || 0, 1);

  const messages = useMemo(
    () =>
      canRequestAiReport
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
    [canRequestAiReport, service.advisor]
  );

  useEffect(() => {
    let cancelled = false;

    const generateReport = async () => {
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
        const generated = await requestAiReport(product, formData || {}, {
          orderId,
          reportAccessToken
        });

        if (!cancelled) {
          setReportData(generated);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('AI report request failed:', error);
          setAnalysisNotice(
            error instanceof Error
              ? error.message
              : 'AI 분석 응답이 지연되어 내부 리포트로 먼저 전환합니다.'
          );
        }
      } finally {
        if (!cancelled) {
          setAnalysisFinished(true);
        }
      }
    };

    void generateReport();

    return () => {
      cancelled = true;
    };
  }, [canRequestAiReport, formData, isMissingLiveReportAccess, locationState?.reportData, orderId, product, reportAccessToken, service.id]);

  useEffect(() => {
    if (analysisFinished) {
      return;
    }

    const fallbackTimer = window.setTimeout(() => {
      setAnalysisNotice('AI 분석 응답이 예상보다 길어져 내부 리포트로 먼저 이동합니다.');
      setAnalysisFinished(true);
    }, LOADING_FALLBACK_TIMEOUT_MS);

    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, [analysisFinished]);

  useEffect(() => {
    const progressTimer = window.setInterval(() => {
      setProgress((prev) => {
        const ceiling = analysisFinished ? 100 : 92;
        const nextValue = Math.min(prev + 5, ceiling);

        if (nextValue >= 100) {
          window.clearInterval(progressTimer);
        }

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
    if (!analysisFinished || progress < 100) {
      return;
    }

    const moveTimer = window.setTimeout(() => {
      if (isMissingLiveReportAccess) {
        navigate('/checkout', {
          replace: true,
          state: {
            product,
            formData,
            tabOrigin
          }
        });
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
          reportData: reportData || undefined
        }
      });
    }, 300);

    return () => {
      window.clearTimeout(moveTimer);
    };
  }, [analysisFinished, formData, isMissingLiveReportAccess, locationState, navigate, orderId, paymentMethod, product, progress, reportAccessToken, reportData, service.id, tabOrigin]);

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="리포트 생성 중" backTo="/" backLabel="홈" />

        <section className="mobile-page-content centered">
          <div className="mobile-loading-card saju-loading-card">
            <div className="saju-loading-head">
              <span className="mobile-chip">운월당 사주 원국 분석</span>
              <h1>{messages[messageIndex]}</h1>
            </div>

            {previewReport ? (
              <div className="saju-loading-board" aria-label="사주 원국 미리보기">
                <div className="saju-loading-board-head">
                  <span>{previewReport.customerName}</span>
                  <strong>사주 원국</strong>
                </div>
                <div className="saju-loading-pillars">
                  {LOADING_PILLARS.map((item) => {
                    const value = previewReport.pillars[item.key] || '미상';

                    return (
                      <article key={item.key}>
                        <span>{item.label}</span>
                        <strong>{value}</strong>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {previewReport ? (
              <div className="saju-loading-elements" aria-label="오행 분포">
                <div className="saju-loading-elements-head">
                  <span>오행 분포</span>
                  <strong>{previewReport.dayMaster} 일간</strong>
                </div>
                <div className="saju-loading-element-list">
                  {previewReport.fiveElements.map((item) => (
                    <div key={item.label} className={item.value === 0 ? 'empty' : undefined}>
                      <span>{item.label}</span>
                      <div className="saju-loading-element-track">
                        <em style={{ width: `${Math.max(7, (item.value / elementTotal) * 100)}%`, background: item.color }} />
                      </div>
                      <strong>{Math.round((item.value / elementTotal) * 100)}%</strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="saju-loading-phases" aria-label="분석 진행 단계">
              {LOADING_PHASES.map((phase, index) => (
                <span key={phase} className={progress >= (index + 1) * 24 ? 'active' : undefined}>
                  {phase}
                </span>
              ))}
            </div>

            {analysisNotice ? <p className="mobile-loading-notice">{analysisNotice}</p> : null}

            <div className="saju-loading-progress">
              <div className="progress-track">
                <span style={{ width: `${progress}%` }} />
              </div>
              <strong>{progress}%</strong>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
