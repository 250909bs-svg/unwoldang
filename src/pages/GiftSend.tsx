import { ChevronRight, Gift } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import MyAuthGate from '../features/my/MyAuthGate';
import { GIFT_MESSAGE_MAX_LENGTH } from '../features/gifts/constants';
import { activeProducts } from '../products/registry';
import '../styles/my.css';
import '../styles/gift.css';

/**
 * 선물 보내기 — 상품을 고르고 한마디를 적는다.
 *
 * 선물은 **내 출생정보를 넣지 않는** 결제다. 받는 사람이 자기 정보로 리포트를 만들기
 * 때문이다. 그래서 여기서는 상품과 메시지만 고르고 결제로 넘긴다.
 *
 * 팔고 있는 상품만 올린다 — 로컬 미리보기에서만 보이는 상품을 선물로 보내면, 받은
 * 사람이 링크를 열었을 때 그 상품이 없다.
 */
function GiftSendView() {
  const navigate = useNavigate();
  const [productId, setProductId] = useState(activeProducts[0]?.id ?? '');
  const [message, setMessage] = useState('');

  const product = activeProducts.find((item) => item.id === productId);

  return (
    <main className="my-replay-page">
      <MobileTopBar title="선물하기" backTo="/my" backLabel="마이" />

      <section className="my-replay-content ud-gift-send">
        <div className="my-replay-title">
          <span>SEND A GIFT</span>
          <h1>사주 한 장을 선물합니다</h1>
          <p>
            결제하시면 링크가 하나 나옵니다. 받는 분이 그 링크에서 자기 출생정보를 넣고
            리포트를 받습니다 — 손님이 상대의 생년월일시를 물어볼 필요가 없습니다.
          </p>
        </div>

        <fieldset className="ud-gift-choices">
          <legend className="my-section-label">
            <Gift size={15} />
            어떤 사주를 보낼까요
          </legend>

          {activeProducts.map((item) => (
            <label key={item.id} className={productId === item.id ? 'is-selected' : ''}>
              <input
                type="radio"
                name="gift-product"
                value={item.id}
                checked={productId === item.id}
                onChange={() => setProductId(item.id)}
              />
              <img src={item.home.image} alt="" loading="lazy" decoding="async" />
              <span>
                <strong>{item.home.title}</strong>
                <em>{item.price.toLocaleString('ko-KR')}원</em>
              </span>
            </label>
          ))}
        </fieldset>

        <label className="ud-gift-message-field">
          <span className="my-section-label">받는 분께 한마디</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={GIFT_MESSAGE_MAX_LENGTH}
            rows={3}
            placeholder="생일 축하해. 올해 흐름 한번 봐."
          />
          <small>
            {message.length} / {GIFT_MESSAGE_MAX_LENGTH}
          </small>
        </label>

        <button
          type="button"
          className="my-manse-cta ud-gift-cta"
          disabled={!product}
          onClick={() =>
            navigate('/checkout', {
              state: { product: productId, tabOrigin: '/my', gift: true, giftMessage: message.trim() }
            })
          }
        >
          {product ? `${product.price.toLocaleString('ko-KR')}원 결제하고 선물 링크 받기` : '선물할 사주를 골라 주세요'}
          <ChevronRight size={18} aria-hidden="true" />
        </button>

        <p className="ud-gift-note">
          선물 링크는 90일 동안 쓸 수 있고, 한 번만 사용됩니다. 받는 분이 열지 않은 선물은
          보관함에서 다시 확인하실 수 있습니다.
        </p>

        <Link to="/my/reports" className="ud-gift-back">
          보낸 선물 확인하기
        </Link>
      </section>
    </main>
  );
}

export default function GiftSend() {
  return (
    <MyAuthGate title="선물하기" returnTo="/gift">
      <GiftSendView />
    </MyAuthGate>
  );
}
