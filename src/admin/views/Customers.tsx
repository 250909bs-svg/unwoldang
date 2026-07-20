import {
  CustomerDetailPanel,
  InsightCard,
  OrderDetailPanel
} from '../components';
import { filterCustomerProfiles, type buildCustomerSegments } from '../data/adminAnalytics';
import type {
  AdminOrder,
  AdminView,
  CustomerFilter,
  CustomerProfile
} from '../types/admin';
import { formatCurrency, formatDateTime } from '../utils/formatters';

export function Customers({
  customerSegments,
  customerProfiles,
  customerFilter,
  setCustomerFilter,
  setSelectedCustomerId,
  selectedCustomer,
  allOrders,
  setSelectedOrderId,
  setActiveView,
  selectedOrder,
  selectedOrderCustomer,
  filteredCustomerProfiles
}: {
  customerSegments: ReturnType<typeof buildCustomerSegments>;
  customerProfiles: CustomerProfile[];
  customerFilter: CustomerFilter;
  setCustomerFilter: (filter: CustomerFilter) => void;
  setSelectedCustomerId: (customerId: string) => void;
  selectedCustomer?: CustomerProfile;
  allOrders: AdminOrder[];
  setSelectedOrderId: (orderId: string) => void;
  setActiveView: (view: AdminView) => void;
  selectedOrder?: AdminOrder;
  selectedOrderCustomer?: CustomerProfile;
  filteredCustomerProfiles: CustomerProfile[];
}) {
  const activeView = 'customers' as const;

  return (
    <>
      {activeView === 'customers' ? (
        <section className="admin-panel">
          <div className="admin-panel-head">
            <div>
              <span>고객 관리</span>
              <h2>고객 정보와 재구매 가능성</h2>
            </div>
            <p>카카오 로그인 고객은 개인정보를 마스킹하고, 상세 접근은 서버 권한 확인 후 열어야 합니다.</p>
          </div>

          <div className="admin-insight-grid">
            {customerSegments.map((segment) => (
              <InsightCard key={segment.label} title={segment.label} value={`${segment.value}명`} body={segment.note} icon={segment.icon} tone={segment.label.includes('위험') ? 'warn' : 'good'} />
            ))}
          </div>

          <div className="admin-customer-filter-bar">
            {[
              { id: 'all' as const, label: '전체 고객', value: `${customerProfiles.length}명` },
              { id: 'registered' as const, label: '가입 고객', value: `${customerProfiles.filter((profile) => profile.status === 'registered').length}명` },
              { id: 'paid' as const, label: '결제 고객', value: `${customerProfiles.filter((profile) => profile.paidOrders > 0).length}명` },
              { id: 'vip' as const, label: 'VIP/재구매', value: `${customerProfiles.filter((profile) => profile.segment === 'VIP' || profile.segment === '재구매 후보').length}명` },
              { id: 'risk' as const, label: '이탈 위험', value: `${customerProfiles.filter((profile) => profile.segment === '이탈 위험' || profile.segment === '가입만 완료' || profile.riskScore >= 65).length}명` }
            ].map((filter) => (
              <button
                key={filter.id}
                type="button"
                className={customerFilter === filter.id ? 'active' : ''}
                onClick={() => {
                  setCustomerFilter(filter.id);
                  const nextProfile = filterCustomerProfiles(customerProfiles, filter.id)[0];
                  if (nextProfile) {
                    setSelectedCustomerId(nextProfile.id);
                  }
                }}
              >
                <span>{filter.label}</span>
                <strong>{filter.value}</strong>
              </button>
            ))}
          </div>

          <section className="admin-drilldown-layout">
            <CustomerDetailPanel
              profile={selectedCustomer}
              orders={allOrders}
              onSelectOrder={(orderId) => {
                setSelectedOrderId(orderId);
                setActiveView('orders');
              }}
            />
            <OrderDetailPanel
              order={selectedOrder}
              customer={selectedOrderCustomer}
              onSelectCustomer={(customerId) => setSelectedCustomerId(customerId)}
            />
          </section>

          <div className="admin-customer-grid">
            {filteredCustomerProfiles.map((customer) => (
              <button
                key={customer.id}
                type="button"
                className={selectedCustomer?.id === customer.id ? 'active' : ''}
                onClick={() => setSelectedCustomerId(customer.id)}
              >
                <div className="admin-avatar">{customer.maskedName.slice(0, 1)}</div>
                <div>
                  <strong>{customer.maskedName}</strong>
                  <span>{customer.email} · {customer.segment}</span>
                </div>
                <dl>
                  <dt>상태</dt>
                  <dd>{customer.status === 'paid' ? '결제' : '가입'}</dd>
                  <dt>구매</dt>
                  <dd>{customer.paidOrders}건</dd>
                  <dt>누적</dt>
                  <dd>{formatCurrency(customer.spent)}</dd>
                  <dt>열람</dt>
                  <dd>{customer.readRate}%</dd>
                  <dt>최근</dt>
                  <dd>{formatDateTime(customer.lastSeen)}</dd>
                </dl>
                <p>{customer.lastProduct} · 위험도 {customer.riskScore}점</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

    </>
  );
}
