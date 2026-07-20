import { Activity, AlertTriangle, Clock, MessageSquareWarning, ShieldCheck } from 'lucide-react';
import { InsightCard } from '../components';
import type { buildIssueRows } from '../data/adminAnalytics';
import { formatDateTime } from '../utils/formatters';

export function Issues({
  highSeverityIssues,
  issueRows
}: {
  highSeverityIssues: number;
  issueRows: ReturnType<typeof buildIssueRows>;
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
            <p>심각도 높은 신고는 상품명, 주문번호, 원국 계산값, 결제 상태를 묶어서 먼저 검수합니다.</p>
          </div>

          <div className="admin-insight-grid">
            <InsightCard title="긴급 검수" value={`${highSeverityIssues}건`} body="계산값·결제·생성 실패 우선" icon={AlertTriangle} tone="warn" />
            <InsightCard title="처리 중" value={`${issueRows.filter((issue) => issue.status === '처리 중').length}건`} body="고객 재안내 전 내부 확인" icon={Activity} />
            <InsightCard title="대기" value={`${issueRows.filter((issue) => issue.status === '대기').length}건`} body="동일 유형 반복 여부 확인" icon={Clock} />
            <InsightCard title="운영 기준" value="24시간" body="유료 고객 신고는 하루 안에 답변하는 기준" icon={ShieldCheck} tone="good" />
          </div>

          <div className="admin-issue-list">
            {issueRows.map((issue) => (
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
