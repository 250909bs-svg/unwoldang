import { Activity, AlertTriangle, Clock, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { InsightCard } from '../components';
import type { buildIssueRows } from '../data/adminAnalytics';
import { formatDateTime } from '../utils/formatters';

export function Issues({
  highSeverityIssues,
  issueRows,
  hasIssueData
}: {
  highSeverityIssues: number;
  issueRows: ReturnType<typeof buildIssueRows>;
  hasIssueData: boolean;
}) {
  const activeView = 'issues' as const;

  return (
    <>
      {activeView === 'issues' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>오류 신고</span>
              <h2>오류·오타·불일치 신고함</h2>
            </div>
            <p>{hasIssueData ? '심각도 높은 신고는 상품명, 주문번호, 원국 계산값, 결제 상태를 묶어서 먼저 검수합니다.' : '현재 관리자 API가 신고 기록을 제공하지 않아 건수를 추정하지 않습니다.'}</p>
          </div>

          <div className="admin-insight-grid">
            <InsightCard title="긴급 검수" value={hasIssueData ? `${highSeverityIssues}건` : '미수집'} body={hasIssueData ? '계산값·결제·생성 실패 우선' : '신고 API 연결 필요'} icon={AlertTriangle} tone="warn" />
            <InsightCard title="처리 중" value={hasIssueData ? `${issueRows.filter((issue) => issue.status === '처리 중').length}건` : '미수집'} body={hasIssueData ? '고객 재안내 전 내부 확인' : '처리 상태 계약 필요'} icon={Activity} />
            <InsightCard title="대기" value={hasIssueData ? `${issueRows.filter((issue) => issue.status === '대기').length}건` : '미수집'} body={hasIssueData ? '동일 유형 반복 여부 확인' : '대기 상태 계약 필요'} icon={Clock} />
            <InsightCard title="운영 기준" value={hasIssueData ? '24시간' : '미수집'} body={hasIssueData ? '유료 고객 신고는 하루 안에 답변하는 기준' : 'SLA 정책 연결 필요'} icon={ShieldCheck} tone="good" />
          </div>

          <div className="admin-issue-list">
            {!hasIssueData ? <p className="admin-empty-detail">신고 데이터가 연결되지 않았습니다.</p> : issueRows.map((issue) => (
              <article key={issue.id} className={issue.severity}>
                <MessageSquareWarning size={18} />
                <div>
                  <strong>{issue.type}</strong>
                  <p>{issue.customer} · {issue.product} · {issue.orderId}</p>
                </div>
                <span>{issue.status}</span>
                <small>{formatDateTime(issue.createdAt)}</small>
              </article>
            ))}
          </div>
        </section>
      ) : null}

    </>
  );
}
