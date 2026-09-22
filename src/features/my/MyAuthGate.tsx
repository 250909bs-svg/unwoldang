import { type PropsWithChildren, useState } from 'react';
import MobileTopBar from '../../components/MobileTopBar';
import { useAuth } from '../../context/AuthContext';
import { beginKakaoLogin } from '../../lib/auth';

/**
 * 마이 아래 화면들의 로그인 문. 세 화면이 같은 규칙을 쓰게 한 곳에 모았다.
 *
 * 로그인 화면으로 밀어내지 않고 이 자리에서 묻는다. 어디로 가려다 막혔는지 화면에
 * 남아 있어야, 로그인한 다음 원래 보려던 것으로 돌아오는 게 자연스럽다.
 */
export default function MyAuthGate({
  title,
  returnTo,
  children
}: PropsWithChildren<{ title: string; returnTo: string }>) {
  const { isAuthenticated } = useAuth();
  const [loginError, setLoginError] = useState('');

  if (isAuthenticated) return <>{children}</>;

  const handleKakaoLogin = () => {
    const login = beginKakaoLogin(returnTo);

    if (!login.ok) {
      setLoginError(login.message);
      return;
    }

    window.location.href = login.url;
  };

  return (
    <main className="my-replay-page my-gate-page">
      <MobileTopBar title={title} backTo="/my" backLabel="마이" />

      <section className="my-gate">
        <span className="my-gate-eyebrow">SIGN IN</span>
        <h1>{title}는 로그인 후에 열립니다</h1>
        <p>
          카카오로 로그인하면 이 화면으로 바로 돌아옵니다.
          <br />
          받아 본 리포트와 출생정보를 계정에 연결해 둡니다.
        </p>
        <button type="button" className="my-kakao-button" onClick={handleKakaoLogin}>
          카카오로 시작하기
        </button>
        {loginError ? <p className="my-login-error">{loginError}</p> : null}
      </section>
    </main>
  );
}
