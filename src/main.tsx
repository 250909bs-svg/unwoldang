import { StrictMode, type ReactNode, useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext.tsx';
import './index.css';
import './styles/past-life.css';
import './styles/mz-love-fact.css';
import './styles/mz-love-report.css';

function AppReadyBoundary({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    document.documentElement.classList.remove('app-booting', 'app-booting-dark');
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
