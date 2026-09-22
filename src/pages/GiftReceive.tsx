import { Gift, LockKeyhole } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import { fetchGift, redeemGift, type GiftSummary } from '../features/gifts/api';
import { beginKakaoLogin } from '../lib/auth';
import { getProductById } from '../products/registry';
import '../styles/my.css';
import '../styles/gift.css';

/**
 * 선물 받는 화면.
 *
 * 링크를 열면 누가 무엇을 보냈는지 **로그인 전에** 보인다. 무엇을 받는지 모르는 채로
 * 로그인을 요구하면 대부분 떠난다.
 *
 * 받을 때는 로그인을 요구한다. 누가 받았는지 남아야 분쟁이 정리되고, 만들어진 리포트가
 * 그 사람 보관함에 들어간다.
 */
function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}까지`;
}

export default function GiftReceive() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [gift, setGift] = useState<GiftSummary | null>(null);
  const [stage, setStage] = useState<'loading' | 'missing' | 'ready'>('loading');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchGift(code)
      .then((summary) => {
        if (cancelled) return;
        setGift(summary);
        setStage('ready');
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setError(caught instanceof Error ? caught.message : '선물을 불러오지 못했습니다.');
        setStage('missing');
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  const product = gift ? getProductById(gift.productId) : undefined;

  const receive = useCallback(async () => {
    if (!gift || busy) return;

    if (!isAuthenticated || !user?.authToken) {
      const login = beginKakaoLogin(`/gift/${gift.code}`);

      if (!login.ok) {
        setError(login.message);
        return;
      }

      window.location.href = login.url;
      return;
    }

    setBusy(true);
    setError('');

    try {
      const redeemed = await redeemGift(gift.code, user.authToken);

      /* 받은 다음은 곧바로 출생정보 입력이다. 리포트 권한은 상태로만 넘긴다 —
         주소에 실으면 브라우저 기록과 공유 링크에 토큰이 남는다. */
      navigate(`/form/${redeemed.productId}`, {
        state: {
          tabOrigin: '/',
          recoveredEntitlement: { reportAccessToken: redeemed.reportAccessToken },
          giftFrom: redeemed.buyerName
        }
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '선물을 받지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }, [busy, gift, isAuthenticated, navigate, user?.authToken]);

  if (stage === 'loading') {
    return (
      <main className="my-replay-page">
        <MobileTopBar title="선물" backTo="/" backLabel="홈" />
        <section className="my-manse-empty" aria-busy="true">
          <p>선물을 확인하고 있어요.</p>
        </section>
      </main>
    );
  }

  if (stage === 'missing' || !gift) {
    return (
      <main className="my-replay-page">
        <MobileTopBar title="선물" backTo="/" backLabel="홈" />
        <section className="my-manse-empty">
          <span className="my-gate-eyebrow">GIFT UNAVAILABLE</span>
          <h1>사용할 수 없는 선물이에요</h1>
          <p>{error || '선물이 만료되었거나 이미 사용되었을 수 있어요.'}</p>
          <Link to="/" className="my-manse-cta">
            운월당 둘러보기
          </Link>
        </section>
      </main>
    );
  }

  const unavailable = gift.state !== 'open';

  return (
    <main className="my-replay-page">
      <MobileTopBar title="선물" backTo="/" backLabel="홈" />

      <section className="my-replay-content ud-gift">
        <div className="ud-gift-seal" aria-hidden="true">
          <Gift size={30} strokeWidth={1.5} />
        </div>

        <span className="my-gate-eyebrow">A GIFT ARRIVED</span>
        <h1>
          {gift.buyerName}님이
          <br />
          사주 한 장을 보냈습니다
        </h1>

        {gift.message ? <blockquote className="ud-gift-message">{gift.message}</blockquote> : null}

        <article className="ud-gift-product">
          {product ? <img src={product.home.image} alt="" loading="lazy" decoding="async" /> : null}
          <div>
            <strong>{product?.home.title || gift.productId}</strong>
            <p>{product?.home.subtitle || '운월당 사주 리포트'}</p>
            <small>{formatExpiry(gift.expiresAt)}</small>
          </div>
        </article>

        {unavailable ? (
          <p className="ud-gift-state">
            {gift.state === 'used' ? '이미 사용된 선물입니다.' : '사용 기간이 지난 선물입니다.'}
          </p>
        ) : (
          <>
            <button type="button" className="my-manse-cta ud-gift-cta" disabled={busy} onClick={() => void receive()}>
              {busy ? '선물을 받는 중' : isAuthenticated ? '선물 받고 사주 보기' : '카카오로 1초만에 받기'}
            </button>
            <p className="ud-gift-note">
              <LockKeyhole size={13} aria-hidden="true" />
              받으신 뒤 출생정보를 입력하면 리포트가 만들어집니다. 보낸 분께는 손님의 생년월일시가
              전달되지 않습니다.
            </p>
          </>
        )}

        {error ? (
          <p className="my-login-error" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
