import { Check, Copy, Share2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { buildGiftUrl } from '../features/gifts/api';
import { getProductById } from '../products/registry';
import '../styles/my.css';
import '../styles/gift.css';

type GiftSentState = {
  code?: string;
  expiresAt?: string;
  productId?: string;
};

/**
 * 결제가 끝난 뒤의 화면. 결과물은 리포트가 아니라 **링크**다.
 *
 * 링크를 잃으면 돈을 낸 사람이 선물을 전할 수 없다. 그래서 복사와 공유를 둘 다 두고,
 * 코드 자체도 크게 적는다 — 링크가 막힌 메신저에서는 코드를 불러 줄 수 있어야 한다.
 */
export default function GiftSent() {
  const location = useLocation();
  const state = (location.state as GiftSentState | null) ?? null;
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const code = state?.code || '';
  const product = state?.productId ? getProductById(state.productId) : undefined;
  const url = code ? buildGiftUrl(code) : '';

  if (!code) {
    return (
      <main className="my-replay-page">
        <MobileTopBar title="선물하기" backTo="/my" backLabel="마이" />
        <section className="my-manse-empty">
          <span className="my-gate-eyebrow">NO GIFT</span>
          <h1>보여 드릴 선물이 없습니다</h1>
          <p>
            결제를 마치면 이 화면에 선물 링크가 나옵니다.
            <br />
            이미 결제하셨다면 보관함에서 확인하실 수 있습니다.
          </p>
          <Link to="/my/reports" className="my-manse-cta">
            보관함 열기
          </Link>
        </section>
      </main>
    );
  }

  const share = async () => {
    setError('');

    const text = `운월당에서 ${product?.home.title || '사주 리포트'} 한 장을 보냈어요.`;

    try {
      if (navigator.share) {
        await navigator.share({ title: '운월당 선물', text, url });
        return;
      }

      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError('공유하지 못했습니다. 아래 링크를 직접 복사해 주세요.');
    }
  };

  const copy = async () => {
    setError('');

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setError('복사하지 못했습니다. 아래 주소를 길게 눌러 복사해 주세요.');
    }
  };

  return (
    <main className="my-replay-page">
      <MobileTopBar title="선물하기" backTo="/my" backLabel="마이" />

      <section className="my-replay-content ud-gift">
        <div className="ud-gift-seal" aria-hidden="true">
          <Check size={30} strokeWidth={2} />
        </div>

        <span className="my-gate-eyebrow">GIFT READY</span>
        <h1>선물이 준비됐습니다</h1>
        <p className="ud-gift-sent-lead">
          아래 링크를 받는 분께 보내 주세요. 받는 분이 직접 출생정보를 넣고 리포트를
          받습니다.
        </p>

        <div className="ud-gift-code" aria-label="선물 코드">
          {code}
        </div>

        <div className="ud-gift-actions">
          <button type="button" className="my-manse-cta ud-gift-cta" onClick={() => void share()}>
            <Share2 size={17} aria-hidden="true" />
            선물 링크 공유하기
          </button>
          <button type="button" className="ud-gift-copy" onClick={() => void copy()}>
            <Copy size={15} aria-hidden="true" />
            {copied ? '복사했어요' : '링크만 복사'}
          </button>
        </div>

        <p className="ud-gift-url">{url}</p>

        {error ? (
          <p className="my-login-error" role="alert">
            {error}
          </p>
        ) : null}

        <p className="ud-gift-note">
          링크는 90일 동안 한 번만 쓸 수 있습니다. 받는 분의 생년월일시는 손님께 전달되지
          않습니다.
        </p>

        <Link to="/my" className="ud-gift-back">
          마이로 돌아가기
        </Link>
      </section>
    </main>
  );
}
