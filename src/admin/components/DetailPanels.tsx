import { UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AdminOrder, CustomerProfile } from '../types/admin';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export function CustomerDetailPanel({
  profile,
  orders,
  onSelectOrder
}: {
  profile?: CustomerProfile;
  orders: AdminOrder[];
  onSelectOrder: (orderId: string) => void;
}) {
  if (!profile) {
    return (
      <article className="admin-detail-panel empty">
        <strong>고객을 선택하세요</strong>
        <p>가입 고객이나 결제 고객 카드를 클릭하면 상세 정보가 표시됩니다.</p>
      </article>
    );
  }

  const customerOrders = orders
    .filter((order) => order.customerName === profile.name)
    .sort((left, right) => +new Date(right.createdAt) - +new Date(left.createdAt));
  const firstPaidOrder = [...customerOrders].reverse().find((order) => order.status === 'paid');
  const latestOrder = customerOrders[0];
  const journeyRows = [
    { label: '가입', value: formatDateTime(profile.signedAt), status: '완료' },
    { label: '첫 결제', value: firstPaidOrder ? formatDateTime(firstPaidOrder.createdAt) : '아직 없음', status: firstPaidOrder ? '완료' : '전환 필요' },
    { label: '최근 상품', value: latestOrder?.productName || profile.lastProduct, status: latestOrder?.status || profile.status },
    { label: '최근 활동', value: formatDateTime(profile.lastSeen), status: profile.readRate >= 75 ? '관심 유지' : '재유입 필요' }
  ];
  const riskReasons = [
    profile.paidOrders === 0 ? '가입 후 결제 없음' : '',
    profile.readRate < 70 ? '리포트 열람률 낮음' : '',
    profile.riskScore >= 70 ? '이탈 위험도 높음' : '',
    latestOrder?.status === 'failed' ? '최근 결제 실패' : '',
    latestOrder?.reportStatus === 'failed' ? '최근 리포트 생성 실패' : ''
  ].filter(Boolean);

  return (
    <article className="admin-detail-panel">
      <div className="admin-detail-head">
        <div className="admin-avatar large">{profile.maskedName.slice(0, 1)}</div>
        <div>
          <span>{profile.provider === 'kakao' ? 'KAKAO CUSTOMER' : 'LOCAL CUSTOMER'}</span>
          <h3>{profile.maskedName}</h3>
          <p>{profile.email} · {profile.sourceChannel} · {profile.device === 'mobile' ? '모바일' : '데스크톱'}</p>
        </div>
        <b className={`admin-segment-badge ${profile.segment === '이탈 위험' || profile.segment === '가입만 완료' ? 'warn' : 'good'}`}>
          {profile.segment}
        </b>
      </div>

      <div className="admin-detail-metrics">
        <div><span>가입일</span><strong>{formatDateTime(profile.signedAt)}</strong></div>
        <div><span>결제</span><strong>{profile.paidOrders}건</strong></div>
        <div><span>누적 결제</span><strong>{formatCurrency(profile.spent)}</strong></div>
        <div><span>열람률</span><strong>{profile.readRate}%</strong></div>
        <div><span>위험도</span><strong>{profile.riskScore}점</strong></div>
        <div><span>최근 활동</span><strong>{formatDateTime(profile.lastSeen)}</strong></div>
      </div>

      <div className="admin-next-action">
        <span>다음 추천 액션</span>
        <strong>{profile.nextAction}</strong>
        <p>고객 상태에 따라 다음 상품 추천, 결제 이탈 복구, 리포트 품질 확인을 다르게 처리합니다.</p>
      </div>

      <div className="admin-detail-timeline">
        {journeyRows.map((row) => (
          <div key={`${profile.id}-${row.label}`}>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
            <em>{row.status}</em>
          </div>
        ))}
      </div>

      <div className="admin-detail-tags">
        <span>유입 {profile.sourceChannel}</span>
        <span>{profile.provider === 'kakao' ? '카카오 로그인' : '데모/로컬'}</span>
        <span>{profile.device === 'mobile' ? '모바일 중심' : 'PC 유입'}</span>
        <span>{riskReasons.length ? riskReasons.join(' · ') : '위험 신호 낮음'}</span>
      </div>

      <div className="admin-detail-list">
        <div className="admin-detail-list-head">
          <span>결제 이력</span>
          <strong>{customerOrders.length}건</strong>
        </div>
        {customerOrders.length ? (
          customerOrders.map((order) => (
            <button key={order.id} type="button" onClick={() => onSelectOrder(order.id)}>
              <span>{formatDateTime(order.createdAt)}</span>
              <strong>{order.productName}</strong>
              <em>{formatCurrency(order.amount)} · {order.status} · {order.reportStatus}</em>
            </button>
          ))
        ) : (
          <p className="admin-empty-detail">가입 후 결제 이력이 없습니다. 첫 결제 전환 캠페인 대상으로 분류하세요.</p>
        )}
      </div>
    </article>
  );
}

export function OrderDetailPanel({
  order,
  customer,
  onSelectCustomer
}: {
  order?: AdminOrder;
  customer?: CustomerProfile;
  onSelectCustomer: (customerId: string) => void;
}) {
  if (!order) {
    return (
      <article className="admin-detail-panel empty">
        <strong>주문을 선택하세요</strong>
        <p>주문 행을 클릭하면 결제와 리포트 생성 상세가 표시됩니다.</p>
      </article>
    );
  }

  const orderSteps = [
    {
      label: '결제 요청',
      value: formatDateTime(order.createdAt),
      status: order.status === 'failed' ? '실패' : order.status === 'pending' ? '대기' : '완료'
    },
    {
      label: 'AI 분석',
      value: `${order.reportLatencySec}초`,
      status: order.reportStatus === 'failed' ? '실패' : order.reportStatus === 'generating' ? '생성중' : '완료'
    },
    {
      label: '결과 열람',
      value: `${order.readRate}%`,
      status: order.readRate >= 80 ? '우수' : order.readRate >= 60 ? '보통' : '개선'
    },
    {
      label: '오류 신고',
      value: `${order.issueCount}건`,
      status: order.issueCount ? '확인' : '없음'
    }
  ];

  return (
    <article className="admin-detail-panel">
      <div className="admin-detail-head">
        <span className={`admin-status-dot ${order.status}`} />
        <div>
          <span>주문 상세</span>
          <h3>{order.orderId}</h3>
          <p>{order.productName} · {order.sourceChannel} · {order.device === 'mobile' ? '모바일' : '데스크톱'}</p>
        </div>
        <b className={`admin-segment-badge ${order.status === 'paid' ? 'good' : 'warn'}`}>{order.status}</b>
      </div>

      <div className="admin-detail-metrics">
        <div><span>결제금액</span><strong>{formatCurrency(order.amount)}</strong></div>
        <div><span>결제수단</span><strong>{order.paymentMethod}</strong></div>
        <div><span>리포트</span><strong>{order.reportStatus}</strong></div>
        <div><span>생성 시간</span><strong>{order.reportLatencySec}초</strong></div>
        <div><span>열람률</span><strong>{order.readRate}%</strong></div>
        <div><span>신고</span><strong>{order.issueCount}건</strong></div>
      </div>

      <div className="admin-next-action">
        <span>주문 처리</span>
        <strong>
          {order.status === 'failed'
            ? '결제 실패 고객에게 재결제 안내와 고객센터 문구를 노출하세요.'
            : order.reportStatus === 'generating'
              ? '생성 지연 상태입니다. 로딩 이탈과 API 응답 시간을 확인하세요.'
              : '정상 생성 주문입니다. 열람률이 낮으면 리포트 초반 요약을 점검하세요.'}
        </strong>
        <p>{formatDateTime(order.createdAt)} 결제 요청 기준으로 확인합니다.</p>
      </div>

      <div className="admin-detail-timeline order">
        {orderSteps.map((step) => (
          <div key={`${order.id}-${step.label}`}>
            <span>{step.label}</span>
            <strong>{step.value}</strong>
            <em>{step.status}</em>
          </div>
        ))}
      </div>

      <div className="admin-detail-tags">
        <span>상품 {order.productName}</span>
        <span>유입 {order.sourceChannel}</span>
        <span>{order.device === 'mobile' ? '모바일 결제' : 'PC 결제'}</span>
        <span>{order.archive ? '리포트 보관 있음' : '리포트 보관 없음'}</span>
      </div>

      {customer ? (
        <button type="button" className="admin-linked-customer" onClick={() => onSelectCustomer(customer.id)}>
          <UserRound size={17} />
          <span>{customer.maskedName} 고객 상세 열기</span>
          <strong>{formatCurrency(customer.spent)}</strong>
        </button>
      ) : null}

      {order.archive ? (
        <Link
          className="admin-report-open-link"
          to={`/report/${order.productId}`}
          state={{
            formData: order.archive.formData,
            paymentMethod: order.archive.paymentMethod,
            orderId: order.archive.orderId,
            reportData: order.archive.reportData
          }}
        >
          리포트 화면 열기
        </Link>
      ) : null}
    </article>
  );
}
