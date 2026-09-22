import { StrictMode, type ReactNode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import './index.css';
import './app/shell/appShell.css';
/* 디자인 토큰. 커스텀 프로퍼티뿐이고 두 컨테이너 클래스 안에서만 유효해서,
   전역으로 실어도 그 클래스가 없는 화면에는 영향이 없다. */
import './styles/ud-tokens.css';

function AppReadyBoundary({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.classList.remove('app-booting', 'app-booting-light');
  }, []);

  return children;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppReadyBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </AppReadyBoundary>
  </StrictMode>,
);
