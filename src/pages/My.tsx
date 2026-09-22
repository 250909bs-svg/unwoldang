import {
  BookOpen,
  ChevronRight,
  FileText,
  Gift,
  LogOut,
  MessageCircle,
  Sparkles,
  Sun,
  Ticket,
  UserPlus,
  UserRound,
  type LucideIcon
} from 'lucide-react';

import { useState } from 'react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { siteBusinessInfo } from '../content/legal';
import { useAuth } from '../context/AuthContext';
import { MY_MENU_ENTRIES, type MyMenuEntry } from '../features/my/myMenu';
import { beginKakaoLogin } from '../lib/auth';
import { getProductById } from '../products/registry';
import '../styles/my.css';

/**
 * 마이 — 메뉴 한 장.
 *
 * 예전에는 이 경로가 보관함 자체였다. 보관함은 "리포트" 항목 아래로 들어가고, 이 화면은
 * 계정과 기능 입구를 모으는 자리가 됐다. 상단바·하단바는 운월당 것을 그대로 쓴다.
 *
 * 아직 없는 기능은 눌리지 않는 줄로 둔다. 링크처럼 보이는데 아무 데도 안 가는 것보다,
 * 준비 중이라고 적혀 있는 게 정직하다. 어느 줄이 어느 상태인지는 `myMenu.ts` 한 곳에서
 * 정하고 테스트가 경로 존재를 확인한다.
 */
const MENU_ICONS: Record<string, LucideIcon> = {
  manseryeok: BookOpen,
  reports: FileText,
  'daily-fortune': Sun,
  chat: MessageCircle,
  coupon: Ticket,
  gift: Gift,
  invite: UserPlus
};

/** 상단 카드는 지금 실제로 팔거나 열려 있는 것만 올린다. */
const FEATURE_CARDS = [
  {
    id: 'general-signature',
    to: '/detail/general-saju',
    title: '종합사주 리포트',
    note: '타고난 원국부터 올해의 흐름까지 한 번에'
  },
  {
    id: 'guiyeondo',
    to: '/guiyeondo',
    title: '귀연도',
    note: '내 곁의 귀한 인연을 지도로 이어 보기'
  }
] as const;

function AccountRow() {
  const { user, isAuthenticated } = useAuth();
  const [loginError, setLoginError] = useState('');

  const handleKakaoLogin = () => {
    const login = beginKakaoLogin('/my');

    if (!login.ok) {
      setLoginError(login.message);
      return;
    }

    window.location.href = login.url;
  };

  return (
    <section className="my-account">
      <div className="my-account-row">
        <span className="my-account-avatar" aria-hidden="true">
          <UserRound size={22} strokeWidth={1.6} />
        </span>
        <div className="my-account-name">
          {isAuthenticated ? (
            <>
              <strong>{user?.nickname || '운월당 회원'}</strong>
              <em>{user?.provider === 'kakao' ? '카카오 계정으로 연결됨' : '연결된 계정'}</em>
            </>
          ) : (
            <>
              <strong>로그인</strong>
              <em>리포트와 만세력을 계정에 보관합니다</em>
            </>
          )}
        </div>
        {isAuthenticated ? null : (
          <button type="button" className="my-kakao-button my-account-kakao" onClick={handleKakaoLogin}>
            카카오로 시작
          </button>
        )}
      </div>
      {loginError ? <p className="my-login-error">{loginError}</p> : null}
    </section>
  );
}

function FeatureCards() {
  return (
    <section className="my-feature-cards" aria-label="바로 가기">
      {FEATURE_CARDS.map((card) => {
        /* 이미지는 상품 정의에서 가져온다. 여기에 파일명을 다시 적으면 상품 아트를
           바꿀 때 이 화면만 옛 그림을 들고 있게 된다. */
        const product = getProductById(card.id);

        return (
          <Link key={card.id} to={card.to} className="my-feature-card">
            {product ? (
              <img
                src={product.home.image}
                alt=""
                loading="lazy"
                decoding="async"
                style={product.home.imagePosition ? { objectPosition: product.home.imagePosition } : undefined}
              />
            ) : (
              <span className="my-feature-card-glyph" aria-hidden="true">
                <Sparkles size={22} />
              </span>
            )}
            <div className="my-feature-card-copy">
              <strong>{card.title}</strong>
              <p>{card.note}</p>
            </div>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        );
      })}
    </section>
  );
}

function MenuRow({ entry }: { entry: MyMenuEntry }) {
  const Icon = MENU_ICONS[entry.id] || Sparkles;

  const body = (
    <>
      <span className="my-menu-icon" aria-hidden="true">
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <span className="my-menu-copy">
        <strong>{entry.label}</strong>
        {entry.note ? <em>{entry.note}</em> : null}
      </span>
      {entry.status === 'soon' ? (
        <span className="my-menu-tag">준비 중</span>
      ) : (
        <ChevronRight size={18} className="my-menu-arrow" aria-hidden="true" />
      )}
    </>
  );

  if (entry.status === 'soon' || !entry.to) {
    /* 링크가 아니라 문단이다. 탭으로 잡히지도, 눌리지도 않아야 한다 — 누를 수 있게
       두면 "눌렀는데 아무 일도 안 난다" 가 된다. */
    return (
      <p className="my-menu-row is-soon" aria-disabled="true">
        {body}
      </p>
    );
  }

  return (
    <Link to={entry.to} className="my-menu-row">
      {body}
    </Link>
  );
}

export default function My() {
  const { isAuthenticated, logout } = useAuth();
  const primary = MY_MENU_ENTRIES.filter((entry) => entry.group === 'primary');
  const share = MY_MENU_ENTRIES.filter((entry) => entry.group === 'share');

  return (
    <main className="my-replay-page my-menu-page">
      <MobileTopBar title="마이" backTo="/" backLabel="홈" />

      <div className="my-menu-content">
        <AccountRow />
        <FeatureCards />

        <nav className="my-menu-list" aria-label="마이 메뉴">
          {primary.map((entry) => (
            <MenuRow key={entry.id} entry={entry} />
          ))}
        </nav>

        <nav className="my-menu-list my-menu-list-share" aria-label="함께 보기">
          {share.map((entry) => (
            <MenuRow key={entry.id} entry={entry} />
          ))}
        </nav>

        <section className="my-support" aria-label="고객 지원 및 약관">
          <div className="my-support-contact">
            <span>고객센터</span>
            <a href={`tel:${siteBusinessInfo.phone}`}>{siteBusinessInfo.phone}</a>
            <a href={`mailto:${siteBusinessInfo.email}`}>{siteBusinessInfo.email}</a>
          </div>
          <div className="my-support-links">
            <Link to="/terms">이용약관</Link>
            <Link to="/privacy">개인정보처리방침</Link>
            <Link to="/refund">환불정책</Link>
          </div>
          <p className="my-support-business">
            {siteBusinessInfo.companyName} · 대표 {siteBusinessInfo.representative} · 사업자등록번호{' '}
            {siteBusinessInfo.businessRegistrationNumber}
          </p>
        </section>

        {isAuthenticated ? (
          <button type="button" className="my-logout-button" onClick={logout}>
            <LogOut size={15} />
            로그아웃
          </button>
        ) : null}
      </div>
    </main>
  );
}
