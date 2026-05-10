import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { findServiceById, type IntakeFormData, type ServiceId } from '../api/mockData';
import MobileTopBar from '../components/MobileTopBar';
import { readPendingPayment } from '../lib/auth';
import { getAiReportEndpoint, requestAiReport } from '../lib/aiReport';
import type { SajuReportData } from '../lib/saju/report';

type LoadingLocationState = {
  product?: ServiceId;
  formData?: Partial<IntakeFormData>;
  paymentMethod?: string;
  orderId?: string;
  tabOrigin?: string;
  reportData?: SajuReportData;
};

const LOADING_FALLBACK_TIMEOUT_MS = 65000;

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
  const service = findServiceById(product);
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [reportData, setReportData] = useState<SajuReportData | null>(locationState?.reportData || null);
  const [analysisFinished, setAnalysisFinished] = useState(false);
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const hasAiEndpoint = Boolean(getAiReportEndpoint());

  const messages = useMemo(
    () =>
      hasAiEndpoint
        ? [
            `${service.advisor} 스타일로 프리미엄 리포트를 구성하고 있습니다.`,
            '입력한 사주 정보와 질문 2개를 바탕으로 AI 분석 결과를 생성하고 있습니다.',
            '총괄 요약, 질문 응답, 대운과 연운까지 결과 구조를 정리하고 있습니다.',
            '분석이 거의 완료되었습니다. 결과 화면으로 이동합니다.'
          ]
        : [
            `${service.advisor} 스타일로 기본 리포트를 구성하고 있습니다.`,
            '아직 AI 결과 API가 연결되지 않아 내부 생성 로직으로 결과를 만들고 있습니다.',
            '질문 2개와 사주 입력값을 묶어서 결과 구조를 정리하고 있습니다.',
            '분석이 거의 완료되었습니다. 결과 화면으로 이동합니다.'
          ],
    [hasAiEndpoint, service.advisor]
  );

  useEffect(() => {
    let cancelled = false;

    const generateReport = async () => {
      if (!product || locationState?.reportData) {
        setAnalysisFinished(true);
        return;
      }

      try {
        const generated = await requestAiReport(product, formData || {});

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
  }, [formData, locationState?.reportData, product]);

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
      navigate(`/report/${service.id}`, {
        replace: true,
        state: {
          ...locationState,
          product,
          formData,
          paymentMethod,
          orderId,
          tabOrigin,
          reportData: reportData || undefined
        }
      });
    }, 300);

    return () => {
      window.clearTimeout(moveTimer);
    };
  }, [analysisFinished, formData, locationState, navigate, product, progress, reportData, service.id, tabOrigin]);

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="리포트 생성 중" backTo="/" backLabel="홈" />

        <section className="mobile-page-content centered">
          <div className="mobile-loading-card">
            <span className="mobile-chip">GENERATING REPORT</span>
            <h1>{messages[messageIndex]}</h1>
            <p>
              주문번호 {orderId || '임시주문'} / 결제수단 {paymentMethod || 'demo'} 기준으로 결과 리포트를 생성하고 있습니다.
              {hasAiEndpoint
                ? ' 연결된 AI 결과 API로 프리미엄 분석 요청을 보내는 중입니다.'
                : ' 아직 AI API가 연결되지 않아 내부 생성 로직으로 먼저 처리합니다.'}
            </p>
            {analysisNotice ? <p className="mobile-loading-notice">{analysisNotice}</p> : null}
            <div className="progress-track">
              <span style={{ width: `${progress}%` }} />
            </div>
            <strong>{progress}%</strong>
          </div>
        </section>
      </div>
    </main>
  );
}
