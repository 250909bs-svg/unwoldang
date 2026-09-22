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

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { siteBusinessInfo } from '../content/legal';
import { useAuth } from '../context/AuthContext';
import { MY_MENU_ENTRIES, type MyMenuEntry } from '../features/my/myMenu';
import { markMyMenuSeen, readSeenMyMenuIds, shouldBadgeMyMenu } from '../features/my/myMenuSeen';
import { resolveManseryeokSource } from '../features/my/manseryeok';
import { beginKakaoLogin } from '../lib/auth';
import { readReportArchiveEntries } from '../lib/reportArchive';
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
    /* 60px 카드 옆 한 줄에 들어가는 길이로 맞춘다. 길면 마지막 줄에 한 글자만 남는다. */
    note: '타고난 원국과 올해의 흐름을 한 번에'
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

/**
 * 메뉴 한 줄 — 아이콘 · 이름 · (배지) · (강조) · 화살표.
 *
 * 이름 아래에 설명을 달지 않는다. 줄마다 설명이 붙으면 목록이 아니라 글이 되어 훑어보는
 * 속도가 사라진다. 설명은 `aria-label` 로만 남겨 화면 낭독기에는 전달한다.
 */
function MenuRow({ entry, badge, onOpen }: { entry: MyMenuEntry; badge: boolean; onOpen: (id: string) => void }) {
  const Icon = MENU_ICONS[entry.id] || Sparkles;

  const body = (
    <>
      <span className="my-menu-icon" aria-hidden="true">
        <Icon size={21} strokeWidth={1.7} />
      </span>
      <span className="my-menu-label">
        {entry.label}
        {badge ? (
          <i className="my-menu-badge" aria-label="새로 볼 내용 있음">
            N
          </i>
        ) : null}
      </span>
      {entry.status === 'soon' ? <span className="my-menu-tag">준비 중</span> : null}
      {entry.accent ? <em className="my-menu-accent">{entry.accent}</em> : null}
      <ChevronRight size={19} className="my-menu-arrow" aria-hidden="true" />
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
    <Link
      to={entry.to}
      className="my-menu-row"
      aria-label={entry.note ? `${entry.label} — ${entry.note}` : entry.label}
      onClick={() => onOpen(entry.id)}
    >
      {body}
    </Link>
  );
}

export default function My() {
  const { user, isAuthenticated, logout } = useAuth();
  const primary = MY_MENU_ENTRIES.filter((entry) => entry.group === 'primary');
  const share = MY_MENU_ENTRIES.filter((entry) => entry.group === 'share');
  const [seen, setSeen] = useState(() => readSeenMyMenuIds());

  /*
   * 배지는 **보여 줄 것이 실제로 있는 줄에만** 붙인다.
   *
   * 전부에 붙이면 그건 알림이 아니라 장식이고, 빨간 점이 다섯 개면 하나도 안 본다.
   * 그래서 화면마다 "지금 열면 뭔가 있는가" 를 따로 묻는다. 여기 없는 항목(쿠폰 ·
   * 초대하기 · 준비 중)은 배지를 받지 않는다 — 쿠폰 보유 여부는 서버에 물어야 알고,
   * 그 한 줄을 위해 이 화면이 요청을 하나 더 하지는 않는다.
   */
  const hasBirthData = useMemo(() => Boolean(resolveManseryeokSource(user?.id)), [user?.id]);
  const hasReports = useMemo(() => readReportArchiveEntries(user?.id).length > 0, [user?.id]);

  const HAS_CONTENT: Record<string, boolean> = {
    manseryeok: hasBirthData,
    'daily-fortune': hasBirthData,
    reports: hasReports
  };

  const markSeen = (id: string) => {
    markMyMenuSeen(id);
    setSeen(readSeenMyMenuIds());
  };

  const badgeFor = (entry: MyMenuEntry) =>
    shouldBadgeMyMenu({
      id: entry.id,
      live: entry.status === 'live',
      hasContent: HAS_CONTENT[entry.id] === true,
      seen
    });

  return (
    <main className="my-replay-page my-menu-page">
      <MobileTopBar title="마이" backTo="/" backLabel="홈" />

      <div className="my-menu-content">
        <AccountRow />
        <FeatureCards />

        <nav className="my-menu-list" aria-label="마이 메뉴">
          {primary.map((entry) => (
            <MenuRow key={entry.id} entry={entry} badge={badgeFor(entry)} onOpen={markSeen} />
          ))}
        </nav>

        <nav className="my-menu-list my-menu-list-share" aria-label="함께 보기">
          {share.map((entry) => (
            <MenuRow key={entry.id} entry={entry} badge={badgeFor(entry)} onOpen={markSeen} />
          ))}
        </nav>

        {/* 참고 화면처럼 조용한 링크 묶음. 고객센터는 전화·메일이 실제 값이라 링크로 연다. */}
        <section className="my-support" aria-label="고객 지원 및 약관">
          <a className="my-support-link" href={`tel:${siteBusinessInfo.phone}`}>
            고객센터
          </a>
          <Link className="my-support-link" to="/terms">
            이용약관
          </Link>
          <Link className="my-support-link" to="/privacy">
            개인정보처리방침
          </Link>
          <Link className="my-support-link" to="/refund">
            환불정책
          </Link>
        </section>

        <p className="my-support-business">
          {siteBusinessInfo.companyName} · 대표 {siteBusinessInfo.representative} · 사업자등록번호{' '}
          {siteBusinessInfo.businessRegistrationNumber}
          <br />
          고객센터 {siteBusinessInfo.phone} · {siteBusinessInfo.email}
        </p>

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
