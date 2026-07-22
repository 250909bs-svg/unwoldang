import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import type { IntakeFormData } from '../../api/mockData';
import { clearPendingPayment, readStoredAuthUser } from '../../lib/auth';
import { evaluateReportAccess, type ReportAccessMode } from '../../lib/reportAccessGate';
import { saveRemoteReportArchiveEntry, saveReportArchiveEntry } from '../../lib/reportArchive';
import { buildSajuReport } from '../../lib/saju/reportBuilder';
import type { SajuReportData } from '../../lib/saju/report';
import { canReadHistoricalReport, getProductById } from '../registry';
import ProductUnavailable from '../components/ProductUnavailable';
import { buildMatchCoupleReportModel } from './analysis';
import { createMatchCoupleShareData } from './share';
import { isMatchCoupleReportModel } from './modelValidation';
import MatchCoupleStoryReport from './ReportStory';
import type { MatchCoupleReportModel, MatchCoupleStoredFormData } from './types';
import './match-couple.css';

type MatchCoupleReportData = SajuReportData & {
  matchCoupleModel?: unknown;
};

export function createArchivedMatchCoupleReport(
  canonicalReport: MatchCoupleReportData | null,
  model: MatchCoupleReportModel | null
) {
  if (!canonicalReport || !model) return canonicalReport;
  const archivedModel: MatchCoupleReportModel = {
    ...model,
    context: {
      ...model.context,
      majorConflict: '',
      desiredInsight: '',
      questions: ['', '']
    }
  };

  return {
    ...canonicalReport,
    birthLabel: '',
    questionPreview: '',
    metaGrid: [],
    sections: [],
    questionAnswers: model.guidance === null
      ? []
      : canonicalReport.questionAnswers.map((answer, index) => ({
          ...answer,
          question: model.questions[index] || answer.question
        })),
    matchCoupleModel: archivedModel
  } satisfies MatchCoupleReportData;
}

export function canBuildMatchCoupleModel(mode: ReportAccessMode, usesPreviewData: boolean) {
  return usesPreviewData || mode === 'new-generation';
}


type MatchCoupleReportLocationState = {
  formData?: Partial<MatchCoupleStoredFormData>;
  paymentMethod?: string;
  orderId?: string;
  reportAccessToken?: string;
  reportData?: MatchCoupleReportData;
  reportProvider?: 'gemini' | 'deterministic-fallback';
};

export default function MatchCoupleReport() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as MatchCoupleReportLocationState | null) || {};
  const product = getProductById('match-couple');
  const [shareMessage, setShareMessage] = useState('');
  const reportAccess = evaluateReportAccess({
    hostname: typeof window === 'undefined' ? '' : window.location.hostname,
    isDevelopment: import.meta.env.DEV,
    expectedServiceId: 'match-couple',
    orderId: state.orderId,
    reportAccessToken: state.reportAccessToken,
    reportData: state.reportData
  });

  const canonicalReport = useMemo<MatchCoupleReportData | null>(() => {
    if (state.reportData) return state.reportData;
    if (!reportAccess.usesPreviewData || !state.formData?.birthDate) return null;
    return buildSajuReport('match-couple', state.formData as Partial<IntakeFormData>);
  }, [reportAccess.usesPreviewData, state.formData, state.reportData]);

  const model = useMemo(() => {
    if (isMatchCoupleReportModel(canonicalReport?.matchCoupleModel)) {
      return canonicalReport.matchCoupleModel;
    }
    if (!canBuildMatchCoupleModel(reportAccess.mode, reportAccess.usesPreviewData)) {
      return null;
    }
    if (!state.formData?.birthDate || !state.formData.partner?.birthDate) return null;
    try {
      return buildMatchCoupleReportModel(state.formData);
    } catch {
      return null;
    }
  }, [
    canonicalReport?.matchCoupleModel,
    reportAccess.mode,
    reportAccess.usesPreviewData,
    state.formData
  ]);

  const archivedReport = useMemo(
    () => createArchivedMatchCoupleReport(canonicalReport, model),
    [canonicalReport, model]
  );

  useEffect(() => {
    document.title = '월연도령 사주궁합 리포트 | 운월당';
  }, []);

  useEffect(() => {
    if (!reportAccess.canRender && canReadHistoricalReport(product.id)) {
      navigate(product.routes.intake, { replace: true });
    }
  }, [navigate, product.id, product.routes.intake, reportAccess.canRender]);

  useEffect(() => {
    if (!reportAccess.canArchive || !state.orderId || !archivedReport || !model) {
      return;
    }

    const authUser = readStoredAuthUser();
    const archiveEntry = {
      id: `match-couple:${state.orderId}`,
      orderId: state.orderId,
      productId: 'match-couple' as const,
      customerName: model.names[0],
      title: product.displayName,
      subtitle: `${model.names[0]}님과 ${model.names[1]}님의 두 사람 비교 리포트`,
      createdAt: archivedReport.createdAt,
      paymentMethod: state.paymentMethod,
      reportData: archivedReport,
      reportProvider: state.reportProvider
    };

    saveReportArchiveEntry(archiveEntry, authUser?.id);
    if (authUser?.authToken && state.reportAccessToken) {
      void saveRemoteReportArchiveEntry(archiveEntry, {
        authToken: authUser.authToken,
        reportAccessToken: state.reportAccessToken
      });
    }
    clearPendingPayment();
  }, [
    archivedReport,
    model,
    product.displayName,
    reportAccess.canArchive,
    state.orderId,
    state.paymentMethod,
    state.reportAccessToken,
    state.reportProvider
  ]);

  const handleShare = async () => {
    if (!model) return;
    const data = createMatchCoupleShareData(model, window.location.origin);
    try {
      if (navigator.share) {
        await navigator.share(data);
        setShareMessage('상품 링크를 공유했습니다.');
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${data.text}\n${data.url}`);
        setShareMessage('개인정보를 제외한 상품 링크를 복사했습니다.');
      } else {
        setShareMessage(`공유 링크: ${data.url}`);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setShareMessage('공유하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (!canReadHistoricalReport(product.id)) {
    return <ProductUnavailable product={product} />;
  }

  if (!reportAccess.canRender) {
    return (
      <main className="match-couple-page match-couple-report-page">
        <section className="match-couple-state-card" role="status">
          <BookOpen aria-hidden="true" />
          <h1>결제한 리포트에서 열어주세요</h1>
          <p>리포트는 주문과 상품에 묶인 서버 권한을 확인한 뒤에만 표시됩니다.</p>
          <Link to={product.routes.intake}>궁합 입력으로 돌아가기</Link>
        </section>
      </main>
    );
  }

  if (!canonicalReport || !model) {
    return (
      <main className="match-couple-page match-couple-report-page">
        <section className="match-couple-state-card" role="alert">
          <BookOpen aria-hidden="true" />
          <h1>두 사람의 입력을 다시 확인해 주세요</h1>
          <p>이 보관 리포트에는 전용 비교 분석에 필요한 두 사람의 입력 기록이 없습니다.</p>
          <Link to={product.routes.intake}>궁합 다시 입력하기</Link>
        </section>
      </main>
    );
  }

  const answers = model.guidance === null ? [] : canonicalReport.questionAnswers.slice(0, 2);

  return (
    <main className="match-couple-page match-couple-report-page">
      <MatchCoupleStoryReport
        model={model}
        answers={answers}
        createdAt={canonicalReport.createdAt}
        storageKey={canonicalReport.serialNumber || state.orderId || 'local-preview'}
        shareMessage={shareMessage}
        onShare={handleShare}
      />
    </main>
  );
}
