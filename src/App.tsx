import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import {
  getRouteShellPolicy,
  getShellContainerClassName,
  useShellDocumentAttributes
} from './app/shell';
import { buildHashCallbackLocation } from './lib/auth';
import BottomTabBar from './components/BottomTabBar';
import Footer from './components/Footer';
import Seo from './components/Seo';
import ProductRouteBoundary from './products/components/ProductRouteBoundary';
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
const MyReports = lazy(() => import('./pages/MyReports'));
const MyManseryeok = lazy(() => import('./pages/MyManseryeok'));
const DailyFortune = lazy(() => import('./pages/DailyFortune'));
const MyCoupons = lazy(() => import('./pages/MyCoupons'));
const Chat = lazy(() => import('./pages/Chat'));
const Admin = lazy(() => import('./pages/Admin'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const GeneralSajuLanding = lazy(() => import('./pages/GeneralSajuLanding'));
const LoveReadingEntry = lazy(() => import('./pages/LoveReadingEntry'));
const LoveReadingIntake = lazy(() => import('./pages/LoveReadingIntake'));
const LoveReadingPreview = lazy(() => import('./pages/LoveReadingPreview'));
const GuiyeondoPage = lazy(() => import('./features/guiyeondo/GuiyeondoPage'));
const ReunionLanding = lazy(() => import('./features/reunion/ReunionLanding'));
const ReunionIntake = lazy(() => import('./features/reunion/ReunionIntake'));
const ReunionPreview = lazy(() => import('./features/reunion/ReunionPreview'));
const GuiyeondoGuestPage = lazy(() => import('./features/guiyeondo/GuiyeondoGuestPage'));
const GenericProductDetail = lazy(() => import('./products/components/GenericProductDetail'));
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

function AppRoutes({
  showFooter,
  showBottomTab
}: {
  showFooter: boolean;
  showBottomTab: boolean;
}) {
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
          <Route path="/guiyeondo" element={<GuiyeondoPage />} />
          <Route path="/g/:publicId" element={<GuiyeondoGuestPage />} />
          <Route path="/tarot" element={<Navigate to="/" replace />} />
          <Route path="/my" element={<My />} />
          <Route path="/my/reports" element={<MyReports />} />
          <Route path="/my/manseryeok" element={<MyManseryeok />} />
          <Route path="/today" element={<DailyFortune />} />
          <Route path="/my/coupons" element={<MyCoupons />} />
          <Route path="/chat" element={<Chat />} />
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
          <Route
            path="/detail/love-reunion"
            element={
              <ProductRouteBoundary productId="love-reunion">
                <ReunionLanding />
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
            path="/form/love-reunion"
            element={
              <ProductRouteBoundary productId="love-reunion">
                <ReunionIntake />
              </ProductRouteBoundary>
            }
          />
          <Route
            path="/preview/love-reunion"
            element={
              <ProductRouteBoundary productId="love-reunion">
                <ReunionPreview />
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

      {showFooter ? <Footer /> : null}
      {showBottomTab ? <BottomTabBar /> : null}
    </>
  );
}

function AppShell() {
  const location = useLocation();
  const policy = getRouteShellPolicy(location.pathname);

  useShellDocumentAttributes(policy);

  return (
    <div className={getShellContainerClassName(policy)} data-shell-surface={policy.surface}>
      <AppRoutes showFooter={policy.footer} showBottomTab={policy.bottomTab === 'visible'} />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppShell />
    </Router>
  );
}

export default App;
