import { Ticket } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import {
  claimCoupon,
  fetchCouponWallet,
  type CouponWallet
} from '../features/coupons/api';
import MyAuthGate from '../features/my/MyAuthGate';
import '../styles/my.css';

/**
 * 쿠폰 지갑.
 *
 * 할인 금액을 여기서 계산하지 않는다. 서버가 상태(usable/expired/used)까지 정해 주고
 * 화면은 그대로 그린다 — 화면이 "쓸 수 있다" 고 판단했는데 결제에서 거절되면 그보다
 * 나쁜 경험이 없다.
 */
function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}까지`;
}

const STATE_LABELS = {
  usable: '',
  expired: '기간 만료',
  used: '사용 완료'
} as const;

function CouponWalletView() {
  const { user } = useAuth();
  const [wallet, setWallet] = useState<CouponWallet | null>(null);
  const [error, setError] = useState('');
  const [busyCode, setBusyCode] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!user?.authToken) {
      /* 로컬 미리보기 계정에는 서버 토큰이 없다. 빈 지갑으로 그려 두면 "쿠폰이 없다" 는
         거짓말이 되므로, 연결이 없다는 사실을 그대로 말한다. */
      setWallet({ enabled: false, wallet: [], claimable: [] });
      return;
    }

    try {
      setWallet(await fetchCouponWallet(user.authToken));
      setError('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '쿠폰을 불러오지 못했습니다.');
    }
  }, [user?.authToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClaim = async (code: string) => {
    if (!user?.authToken || busyCode) return;

    setBusyCode(code);
    setError('');

    try {
      const result = await claimCoupon(user.authToken, code);
      setNotice(result.message);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '쿠폰을 받지 못했습니다.');
    } finally {
      setBusyCode('');
    }
  };

  return (
    <main className="my-replay-page">
      <MobileTopBar title="쿠폰" backTo="/my" backLabel="마이" />

      <section className="my-replay-content">
        <div className="my-replay-title">
          <span>COUPONS</span>
          <h1>내 쿠폰</h1>
          <p>결제할 때 쓸 쿠폰을 모아 둡니다. 할인 금액은 결제 화면에서 적용됩니다.</p>
        </div>

        {error ? <p className="my-login-error">{error}</p> : null}
        {notice ? <p className="ud-coupon-notice" role="status">{notice}</p> : null}

        {wallet && !wallet.enabled ? (
          <p className="ud-coupon-disabled">
            지금은 쿠폰 보관소에 연결되어 있지 않습니다. 로그인 후 다시 열어 주세요.
          </p>
        ) : null}

        {wallet?.claimable.length ? (
          <section className="ud-coupon-group">
            <div className="my-section-label">
              <Ticket size={15} />
              받을 수 있는 쿠폰
            </div>
            {wallet.claimable.map((coupon) => (
              <article key={coupon.code} className="ud-coupon is-claimable">
                <div className="ud-coupon-amount">
                  <strong>{coupon.discount.toLocaleString('ko-KR')}</strong>
                  <em>원</em>
                </div>
                <div className="ud-coupon-body">
                  <strong>{coupon.label}</strong>
                  <p>{coupon.description}</p>
                  <small>
                    {coupon.minOrderAmount.toLocaleString('ko-KR')}원 이상 · {formatExpiry(coupon.expiresAt)}
                  </small>
                </div>
                <button
                  type="button"
                  className="ud-coupon-claim"
                  disabled={Boolean(busyCode)}
                  onClick={() => void handleClaim(coupon.code)}
                >
                  {busyCode === coupon.code ? '받는 중' : '받기'}
                </button>
              </article>
            ))}
          </section>
        ) : null}

        <section className="ud-coupon-group">
          <div className="my-section-label">
            <Ticket size={15} />
            보유한 쿠폰
          </div>

          {wallet?.wallet.length ? (
            wallet.wallet.map((coupon) => (
              <article key={coupon.code} className={`ud-coupon is-${coupon.state}`}>
                <div className="ud-coupon-amount">
                  <strong>{coupon.discount.toLocaleString('ko-KR')}</strong>
                  <em>원</em>
                </div>
                <div className="ud-coupon-body">
                  <strong>{coupon.label}</strong>
                  <p>{coupon.description}</p>
                  <small>
                    {coupon.minOrderAmount.toLocaleString('ko-KR')}원 이상 · {formatExpiry(coupon.expiresAt)}
                    {coupon.perUserLimit > 1 ? ` · ${coupon.remaining}회 남음` : ''}
                  </small>
                </div>
                {coupon.state === 'usable' ? null : (
                  <span className="ud-coupon-state">{STATE_LABELS[coupon.state]}</span>
                )}
              </article>
            ))
          ) : (
            <p className="ud-coupon-empty">아직 보유한 쿠폰이 없습니다.</p>
          )}
        </section>

        <p className="ud-coupon-note">
          쿠폰은 결제 화면에서 하나만 적용됩니다. 할인 뒤 결제 금액이 최소 금액보다 낮아지면
          그만큼만 깎입니다.
        </p>

        <Link to="/detail/general-saju" className="my-manse-cta ud-coupon-cta">
          쿠폰 쓰러 가기
        </Link>
      </section>
    </main>
  );
}

export default function MyCoupons() {
  return (
    <MyAuthGate title="쿠폰" returnTo="/my/coupons">
      <CouponWalletView />
    </MyAuthGate>
  );
}
