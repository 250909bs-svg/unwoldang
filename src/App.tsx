import { lazy, Suspense, useLayoutEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { buildHashCallbackLocation } from './lib/auth';
import { readPendingPayment } from './features/payments/storage';
import BottomTabBar from './components/BottomTabBar';
import Footer from './components/Footer';
import Seo from './components/Seo';
import ProductRouteBoundary from './products/components/ProductRouteBoundary';
import { Loading as UiLoading } from './shared/ui';
import {
  HistoricalReportRouteBoundary,
  ProductCheckoutRouteBoundary,
  ProductIntakeRouteBoundary,
  ProductLoadingRouteBoundary
} from './products/components/ProductFlowRouteBoundaries';

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
const LoveReadingEntry = lazy(() => import('./pages/LoveReadingEntry'));
const LoveReadingIntake = lazy(() => import('./pages/LoveReadingIntake'));
const LoveReadingPreview = lazy(() => import('./pages/LoveReadingPreview'));
const GenericProductDetail = lazy(() => import('./products/components/GenericProductDetail'));
const NotFound = lazy(() => import('./pages/NotFound'));

const callbackHashLocation = buildHashCallbackLocation();

if (callbackHashLocation) {
  window.location.replace(`${window.location.origin}${callbackHashLocation}`);
}

function RouteLoadingFallback() {
  return (
    <main className="app-route-loading" aria-busy="true">
      <UiLoading size="lg" label={<strong>페이지를 불러오는 중이에요.</strong>} />
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
          <Route
            path="/detail/past-life-goblin"
            element={
              <ProductRouteBoundary productId="past-life-goblin">
                <PastLifeEntry />
              </ProductRouteBoundary>
            }
          />
          <Route
            path="/detail/past-life-goblin/immersion"
            element={
              <ProductRouteBoundary productId="past-life-goblin">
                <PastLifeImmersion />
              </ProductRouteBoundary>
            }
          />
          <Route
            path="/detail/past-life-goblin/about"
            element={
              <ProductRouteBoundary productId="past-life-goblin">
                <PastLifeLanding />
              </ProductRouteBoundary>
            }
          />
          <Route
            path="/detail/general-saju"
            element={
              <ProductRouteBoundary productId="general-signature">
                <GeneralSajuLanding />
              </ProductRouteBoundary>
            }
          />
          <Route
            path="/detail/love-reading"
            element={
              <ProductRouteBoundary productId="love-reading">
                <LoveReadingEntry />
              </ProductRouteBoundary>
            }
          />
          <Route path="/detail/:id" element={<GenericProductDetail />} />
          <Route
            path="/form/love-reading"
            element={
              <ProductRouteBoundary productId="love-reading">
                <LoveReadingIntake />
              </ProductRouteBoundary>
            }
          />
          <Route
            path="/preview/love-reading"
            element={
              <ProductRouteBoundary productId="love-reading">
                <LoveReadingPreview />
              </ProductRouteBoundary>
            }
          />
          <Route
            path="/form/:id"
            element={
              <ProductIntakeRouteBoundary>
                <Form />
              </ProductIntakeRouteBoundary>
            }
          />
          <Route
            path="/checkout"
            element={
              <ProductCheckoutRouteBoundary>
                <Checkout />
              </ProductCheckoutRouteBoundary>
            }
          />
          <Route
            path="/loading"
            element={
              <ProductLoadingRouteBoundary>
                <Loading />
              </ProductLoadingRouteBoundary>
            }
          />
          <Route
            path="/report/:id"
            element={
              <HistoricalReportRouteBoundary>
                <Report />
              </HistoricalReportRouteBoundary>
            }
          />
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
  const isCheckoutRoute = location.pathname === '/checkout';
  const isLoadingRoute = location.pathname === '/loading';
  const isPastLifeLandingRoute = location.pathname.startsWith('/detail/past-life-goblin');
  const isPastLifeReportRoute = location.pathname === '/report/past-life-goblin';
  const isGeneralDetailRoute = location.pathname === '/detail/general-saju';
  const isLoveDetailRoute = location.pathname === '/detail/love-reading';
  const isLoveFormRoute = location.pathname === '/form/love-reading';
  const isLovePreviewRoute = location.pathname === '/preview/love-reading';
  const isLoveReportRoute = location.pathname === '/report/love-reading';
  const isImmersiveLoveRoute = isLoveDetailRoute || isLoveFormRoute || isLovePreviewRoute || isLoveReportRoute;
  const isLegalRoute = ['/terms', '/privacy', '/refund'].includes(location.pathname);
  const locationProduct = (location.state as { product?: unknown } | null)?.product;
  const persistedProduct = isCheckoutRoute || isLoadingRoute ? readPendingPayment()?.productId : undefined;
  const flowProduct = typeof locationProduct === 'string' ? locationProduct : persistedProduct;
  const uiThemeProduct = location.pathname.includes('past-life-goblin')
    ? 'past-life-goblin'
    : location.pathname.includes('love-reading')
      ? 'love-reading'
      : location.pathname.includes('general-signature') || location.pathname.includes('general-saju')
        ? 'general-signature'
        : flowProduct;
  const uiTheme = ['past-life-goblin', 'love-reading', 'general-signature'].includes(uiThemeProduct || '')
    ? uiThemeProduct
    : 'default';
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
      data-ui-theme={uiTheme}
      className={
        isAdminRoute
          ? 'app-container admin-app-container'
          : isGeneralDetailRoute
            ? 'app-container general-saju-app-container'
          : isLoveDetailRoute
            ? 'app-container mz-love-app-container'
            : isLoveFormRoute || isLovePreviewRoute
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
      <AppRoutes hideGlobalChrome={isPastLifeLandingRoute || isImmersiveLoveRoute || isGeneralDetailRoute || isCheckoutRoute} />
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
