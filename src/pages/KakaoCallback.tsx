import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import MobileTopBar from '../components/MobileTopBar';
import { useAuth } from '../context/AuthContext';
import { decodeAuthState, getExternalCallbackBaseUrl } from '../lib/auth';

type CallbackStatus = 'loading' | 'error';

type KakaoExchangeResponse = {
  user?: {
    id?: string | number;
    nickname?: string;
    email?: string;
    avatar?: string;
  };
  id?: string | number;
  nickname?: string;
  email?: string;
  profile_image?: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
  };
  kakao_account?: {
    email?: string;
    profile?: {
      nickname?: string;
      profile_image_url?: string;
    };
  };
};

const normalizeKakaoUser = (payload: KakaoExchangeResponse) => {
  if (payload.user) {
    return {
      id: String(payload.user.id || `kakao-${Date.now()}`),
      nickname: payload.user.nickname || '카카오 회원',
      email: payload.user.email,
      avatar: payload.user.avatar
    };
  }

  return {
    id: String(payload.id || `kakao-${Date.now()}`),
    nickname: payload.nickname || payload.properties?.nickname || payload.kakao_account?.profile?.nickname || '카카오 회원',
    email: payload.email || payload.kakao_account?.email,
    avatar: payload.profile_image || payload.properties?.profile_image || payload.kakao_account?.profile?.profile_image_url
  };
};

export default function KakaoCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { completeLogin, loginDemo } = useAuth();
  const [status, setStatus] = useState<CallbackStatus>('loading');
  const [message, setMessage] = useState('카카오 로그인 결과를 확인하고 있습니다.');

  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const code = params.get('code');
  const error = params.get('error');
  const errorDescription = params.get('error_description');
  const decodedState = decodeAuthState(params.get('state'));
  const returnTo = decodedState?.returnTo || '/menu';

  useEffect(() => {
    const run = async () => {
      if (error) {
        setStatus('error');
        setMessage(errorDescription || '카카오 로그인 중 오류가 발생했습니다.');
        return;
      }

      if (!code) {
        setStatus('error');
        setMessage('카카오에서 전달된 인증 코드가 없습니다.');
        return;
      }

      const exchangeEndpoint = import.meta.env.VITE_KAKAO_TOKEN_EXCHANGE_ENDPOINT;

      if (!exchangeEndpoint) {
        loginDemo('카카오 테스트 회원');
        navigate(returnTo, { replace: true });
        return;
      }

      try {
        const response = await fetch(exchangeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            code,
            redirectUri: getExternalCallbackBaseUrl()
          })
        });

        if (!response.ok) {
          throw new Error('카카오 토큰 교환 요청이 실패했습니다.');
        }

        const payload = (await response.json()) as KakaoExchangeResponse;
        completeLogin({
          ...normalizeKakaoUser(payload),
          provider: 'kakao'
        });
        navigate(returnTo, { replace: true });
      } catch (caughtError) {
        setStatus('error');
        setMessage(caughtError instanceof Error ? caughtError.message : '카카오 로그인 처리 중 문제가 발생했습니다.');
      }
    };

    void run();
  }, [code, completeLogin, error, errorDescription, loginDemo, navigate, returnTo]);

  return (
    <main className="mobile-page-shell">
      <div className="mobile-page-card">
        <MobileTopBar title="카카오 연결" backTo="/login" backLabel="로그인" />
        <section className="mobile-page-content centered">
          <div className="mobile-loading-card">
            <span className="mobile-chip">KAKAO CALLBACK</span>
            <h1>{message}</h1>
            {status === 'loading' ? (
              <div className="progress-track">
                <span style={{ width: '72%' }} />
              </div>
            ) : (
              <div className="mobile-notice-box">다시 로그인 버튼을 눌러 시도하거나 테스트 로그인으로 먼저 확인할 수 있습니다.</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
