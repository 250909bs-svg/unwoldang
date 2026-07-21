import { UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AdminOrder, CustomerProfile } from '../types/admin';
import { formatCurrency, formatDateTime } from '../utils/formatters';
import { getAdminProductStatusLabel } from '../utils/productStatus';

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
  const segmentLabel = profile.analyticsAvailable ? profile.segment : profile.segment === 'VIP' ? '반복 리포트' : '리포트 고객';
  const journeyRows = [
    { label: profile.analyticsAvailable ? '가입' : '첫 리포트 기록', value: formatDateTime(profile.signedAt), status: '완료' },
    { label: profile.analyticsAvailable ? '첫 결제' : '첫 리포트 보관', value: firstPaidOrder ? formatDateTime(firstPaidOrder.createdAt) : '아직 없음', status: firstPaidOrder ? '완료' : profile.analyticsAvailable ? '전환 필요' : '기록 없음' },
    { label: '최근 상품', value: latestOrder?.productName || profile.lastProduct, status: latestOrder?.status || profile.status },
    { label: '최근 활동', value: formatDateTime(profile.lastSeen), status: profile.analyticsAvailable ? profile.readRate >= 75 ? '관심 유지' : '재유입 필요' : '기록' }
  ];
  const riskReasons = [
    profile.paidOrders === 0 ? '가입 후 결제 없음' : '',
    profile.analyticsAvailable && profile.readRate < 70 ? '리포트 열람률 낮음' : '',
    profile.analyticsAvailable && profile.riskScore >= 70 ? '이탈 위험도 높음' : '',
    latestOrder?.status === 'failed' ? '최근 결제 실패' : '',
    latestOrder?.reportStatus === 'failed' ? '최근 리포트 생성 실패' : ''
  ].filter(Boolean);

  return (
    <article className="admin-detail-panel">
      <div className="admin-detail-head">
        <div className="admin-avatar large">{profile.maskedName.slice(0, 1)}</div>
        <div>
          <span>{profile.provider === 'kakao' ? 'KAKAO CUSTOMER' : profile.provider === 'demo' ? 'DEMO CUSTOMER' : 'CUSTOMER RECORD'}</span>
          <h3>{profile.maskedName}</h3>
          <p>{profile.email} · {profile.sourceChannel} · {profile.device === 'mobile' ? '모바일' : profile.device === 'desktop' ? '데스크톱' : '기기 미수집'}</p>
        </div>
        <b className={`admin-segment-badge ${profile.segment === '이탈 위험' || profile.segment === '가입만 완료' ? 'warn' : 'good'}`}>
          {segmentLabel}
        </b>
      </div>

      <div className="admin-detail-metrics">
        <div><span>{profile.analyticsAvailable ? '가입일' : '첫 기록'}</span><strong>{formatDateTime(profile.signedAt)}</strong></div>
        <div><span>{profile.analyticsAvailable ? '결제' : '완료 리포트'}</span><strong>{profile.paidOrders}건</strong></div>
        <div><span>{profile.analyticsAvailable ? '누적 결제' : '카탈로그 합계'}</span><strong>{formatCurrency(profile.spent)}</strong></div>
        <div><span>열람률</span><strong>{profile.analyticsAvailable ? `${profile.readRate}%` : '미수집'}</strong></div>
        <div><span>위험도</span><strong>{profile.analyticsAvailable ? `${profile.riskScore}점` : '미수집'}</strong></div>
        <div><span>최근 활동</span><strong>{formatDateTime(profile.lastSeen)}</strong></div>
      </div>

      <div className="admin-next-action">
        <span>다음 추천 액션</span>
        <strong>{profile.nextAction}</strong>
        <p>{profile.analyticsAvailable ? '고객 상태에 따라 다음 상품 추천, 결제 이탈 복구, 리포트 품질 확인을 다르게 처리합니다.' : '관리자 API가 제공하는 리포트 보관 기록만 표시합니다.'}</p>
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
        <span>{profile.provider === 'kakao' ? '카카오 로그인' : profile.provider === 'demo' ? '개발 데모' : '인증 정보 미수집'}</span>
        <span>{profile.device === 'mobile' ? '모바일 중심' : profile.device === 'desktop' ? 'PC 유입' : '기기 미수집'}</span>
        <span>{profile.analyticsAvailable ? riskReasons.length ? riskReasons.join(' · ') : '위험 신호 낮음' : '행동 분석 미수집'}</span>
      </div>

      <div className="admin-detail-list">
        <div className="admin-detail-list-head">
          <span>{profile.analyticsAvailable ? '결제 이력' : '리포트 보관 이력'}</span>
          <strong>{customerOrders.length}건</strong>
        </div>
        {customerOrders.length ? (
          customerOrders.map((order) => (
            <button key={order.id} type="button" onClick={() => onSelectOrder(order.id)}>
              <span>{formatDateTime(order.createdAt)}</span>
              <strong>{order.productName}</strong>
              <em>{order.source === 'real' ? `카탈로그 ${formatCurrency(order.amount)} · 보관 완료` : `${formatCurrency(order.amount)} · ${order.status} · ${order.reportStatus}`}</em>
            </button>
          ))
        ) : (
          <p className="admin-empty-detail">{profile.analyticsAvailable ? '가입 후 결제 이력이 없습니다. 첫 결제 전환 캠페인 대상으로 분류하세요.' : '연결된 리포트 보관 기록이 없습니다.'}</p>
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
      label: order.source === 'real' ? '리포트 보관' : '결제 요청',
      value: formatDateTime(order.createdAt),
      status: order.source === 'real' ? '완료' : order.status === 'failed' ? '실패' : order.status === 'pending' ? '대기' : '완료'
    },
    {
      label: 'AI 분석',
      value: order.analyticsEstimated ? `${order.reportLatencySec}초` : '미수집',
      status: order.reportStatus === 'failed' ? '실패' : order.reportStatus === 'generating' ? '생성중' : '완료'
    },
    {
      label: '결과 열람',
      value: order.analyticsEstimated ? `${order.readRate}%` : '미수집',
      status: order.analyticsEstimated ? order.readRate >= 80 ? '우수' : order.readRate >= 60 ? '보통' : '개선' : '미수집'
    },
    {
      label: '오류 신고',
      value: order.analyticsEstimated ? `${order.issueCount}건` : '미수집',
      status: order.analyticsEstimated ? order.issueCount ? '확인' : '없음' : '미수집'
    }
  ];

  return (
    <article className="admin-detail-panel">
      <div className="admin-detail-head">
        <span className={`admin-status-dot ${order.status}`} />
        <div>
          <span>{order.source === 'real' ? '리포트 보관 상세' : '주문 상세'}</span>
          <h3>{order.orderId}</h3>
          <p>
            {order.productName} · {getAdminProductStatusLabel(order.productStatus)} · {order.sourceChannel} · {order.device === 'mobile' ? '모바일' : order.device === 'desktop' ? '데스크톱' : '미수집'}
          </p>
        </div>
        <b className={`admin-segment-badge ${order.status === 'paid' ? 'good' : 'warn'}`}>{order.source === 'real' ? '보관 완료' : order.status}</b>
      </div>

      <div className="admin-detail-metrics">
        <div><span>{order.source === 'real' ? '카탈로그 금액' : '결제금액'}</span><strong>{formatCurrency(order.amount)}</strong></div>
        <div><span>결제수단</span><strong>{order.paymentMethod}</strong></div>
        <div><span>리포트</span><strong>{order.reportStatus}</strong></div>
        <div><span>생성 시간</span><strong>{order.analyticsEstimated ? `${order.reportLatencySec}초` : '미수집'}</strong></div>
        <div><span>열람률</span><strong>{order.analyticsEstimated ? `${order.readRate}%` : '미수집'}</strong></div>
        <div><span>신고</span><strong>{order.analyticsEstimated ? `${order.issueCount}건` : '미수집'}</strong></div>
      </div>

      <div className="admin-next-action">
        <span>주문 처리</span>
        <strong>
          {!order.analyticsEstimated
            ? '리포트 보관 완료 기록입니다. 열람, 생성 지연, 신고 분석은 미수집입니다.'
            : order.status === 'failed'
              ? '결제 실패 고객에게 재결제 안내와 고객센터 문구를 노출하세요.'
            : order.reportStatus === 'generating'
              ? '생성 지연 상태입니다. 로딩 이탈과 API 응답 시간을 확인하세요.'
              : '정상 생성 주문입니다. 열람률이 낮으면 리포트 초반 요약을 점검하세요.'}
        </strong>
        <p>{formatDateTime(order.createdAt)} {order.source === 'real' ? '리포트 보관 시각' : '결제 요청'} 기준으로 확인합니다.</p>
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
        <span className={`admin-product-status ${order.productStatus}`}>{getAdminProductStatusLabel(order.productStatus)}</span>
        <span>유입 {order.sourceChannel}</span>
        <span>{order.device === 'mobile' ? '모바일 결제' : order.device === 'desktop' ? 'PC 결제' : '기기 미수집'}</span>
        <span>{order.archive ? '리포트 보관 있음' : '리포트 보관 없음'}</span>
      </div>

      {customer ? (
        <button type="button" className="admin-linked-customer" onClick={() => onSelectCustomer(customer.id)}>
          <UserRound size={17} />
          <span>{customer.maskedName} 고객 상세 열기</span>
          <strong>{customer.analyticsAvailable ? formatCurrency(customer.spent) : `카탈로그 ${formatCurrency(customer.spent)}`}</strong>
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
