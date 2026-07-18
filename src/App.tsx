import { lazy, Suspense, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { buildHashCallbackLocation } from './lib/auth';
import BottomTabBar from './components/BottomTabBar';
import Footer from './components/Footer';
import Seo from './components/Seo';

const Home = lazy(() => import('./pages/Home'));
const Test = lazy(() => import('./pages/Test'));
const FaceAI = lazy(() => import('./pages/FaceAI'));
const Search = lazy(() => import('./pages/Search'));
const PastLifeEntry = lazy(() => import('./pages/PastLifeEntry'));
const PastLifeImmersion = lazy(() => import('./pages/PastLifeImmersion'));
const PastLifeLanding = lazy(() => import('./pages/PastLifeLanding'));
const Form = lazy(() => import('./pages/Form'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Loading = lazy(() => import('./pages/Loading'));
const Report = lazy(() => import('./pages/Report'));
const Login = lazy(() => import('./pages/Login'));
const KakaoCallback = lazy(() => import('./pages/KakaoCallback'));
const PaymentCallback = lazy(() => import('./pages/PaymentCallback'));
const My = lazy(() => import('./pages/My'));
const Admin = lazy(() => import('./pages/Admin'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const GeneralSajuLanding = lazy(() => import('./pages/GeneralSajuLanding'));
const LoveReadingLanding = lazy(() => import('./pages/LoveReadingLanding'));
const NotFound = lazy(() => import('./pages/NotFound'));

const callbackHashLocation = buildHashCallbackLocation();

if (callbackHashLocation) {
  window.location.replace(`${window.location.origin}${callbackHashLocation}`);
}

function RouteLoadingFallback() {
  return (
    <main className="app-route-loading" role="status" aria-live="polite" aria-busy="true">
      <strong>페이지를 불러오는 중이에요.</strong>
      <span>잠시만 기다려 주세요.</span>
    </main>
  );
}

function AppRoutes({ hideGlobalChrome = false }: { hideGlobalChrome?: boolean }) {
  return (
    <>
      <Seo />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu" element={<Navigate to="/" replace />} />
          <Route path="/test" element={<Test />} />
          <Route path="/test/face-ai" element={<FaceAI />} />
          <Route path="/search" element={<Search />} />
          <Route path="/tarot" element={<Navigate to="/" replace />} />
          <Route path="/my" element={<My />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
          <Route path="/payment/portone/callback" element={<PaymentCallback />} />
          <Route path="/detail/past-life-goblin" element={<PastLifeEntry />} />
          <Route path="/detail/past-life-goblin/immersion" element={<PastLifeImmersion />} />
          <Route path="/detail/past-life-goblin/about" element={<PastLifeLanding />} />
          <Route path="/detail/general-saju" element={<GeneralSajuLanding />} />
          <Route path="/detail/love-reading" element={<LoveReadingLanding />} />
          <Route path="/form/:id" element={<Form />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/loading" element={<Loading />} />
          <Route path="/report/:id" element={<Report />} />
          <Route path="/terms" element={<LegalPage pageKey="terms" />} />
          <Route path="/privacy" element={<LegalPage pageKey="privacy" />} />
          <Route path="/refund" element={<LegalPage pageKey="refund" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>

      {!hideGlobalChrome ? <Footer /> : null}
      {!hideGlobalChrome ? <BottomTabBar /> : null}
    </>
  );
}

function AppShell() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isPastLifeLandingRoute = location.pathname.startsWith('/detail/past-life-goblin');
  const isPastLifeReportRoute = location.pathname === '/report/past-life-goblin';
  const isGeneralDetailRoute = location.pathname === '/detail/general-saju';
  const isLoveDetailRoute = location.pathname === '/detail/love-reading';
  const isLoveFormRoute = location.pathname === '/form/love-reading';
  const isLoveReportRoute = location.pathname === '/report/love-reading';
  const isImmersiveLoveRoute = isLoveDetailRoute || isLoveFormRoute || isLoveReportRoute;
  const isLegalRoute = ['/terms', '/privacy', '/refund'].includes(location.pathname);
  const usesDarkAppShell =
    location.pathname === '/' ||
    location.pathname.startsWith('/test') ||
    location.pathname.startsWith('/search') ||
    location.pathname.startsWith('/my') ||
    location.pathname.startsWith('/login') ||
    isPastLifeLandingRoute ||
    isGeneralDetailRoute ||
    isImmersiveLoveRoute ||
    isLegalRoute;

  useLayoutEffect(() => {
    document.body.classList.toggle('home-all-black', usesDarkAppShell);

    return () => {
      document.body.classList.remove('home-all-black');
    };
  }, [usesDarkAppShell]);

  return (
    <div
      className={
        isAdminRoute
          ? 'app-container admin-app-container'
          : isGeneralDetailRoute
            ? 'app-container general-saju-app-container'
          : isLoveDetailRoute
            ? 'app-container mz-love-app-container'
            : isLoveFormRoute
              ? 'app-container mz-love-intake-app-container'
              : isLoveReportRoute
                ? 'app-container mz-love-report-app-container'
          : isPastLifeLandingRoute
            ? 'app-container past-life-app-container'
            : isPastLifeReportRoute
              ? 'app-container past-life-report-app-container'
            : 'app-container'
      }
    >
      <AppRoutes hideGlobalChrome={isPastLifeLandingRoute || isImmersiveLoveRoute || isGeneralDetailRoute} />
    </div>
  );
}

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppShell />
    </Router>
  );
}

export default App;
