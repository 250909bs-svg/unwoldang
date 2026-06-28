import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Test from './pages/Test';
import FaceAI from './pages/FaceAI';
import Search from './pages/Search';
import Tarot from './pages/Tarot';
import Detail from './pages/Detail';
import Form from './pages/Form';
import Checkout from './pages/Checkout';
import Loading from './pages/Loading';
import Report from './pages/Report';
import Login from './pages/Login';
import KakaoCallback from './pages/KakaoCallback';
import PaymentCallback from './pages/PaymentCallback';
import My from './pages/My';
import Admin from './pages/Admin';
import LegalPage from './pages/LegalPage';
import { buildHashCallbackLocation } from './lib/auth';
import BottomTabBar from './components/BottomTabBar';
import Footer from './components/Footer';
import Seo from './components/Seo';

const callbackHashLocation = buildHashCallbackLocation();

if (callbackHashLocation) {
  window.location.replace(`${window.location.origin}${callbackHashLocation}`);
}

function AppRoutes() {
  return (
    <>
      <Seo />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/menu" element={<Menu />} />
        <Route path="/test" element={<Test />} />
        <Route path="/test/face-ai" element={<FaceAI />} />
        <Route path="/search" element={<Search />} />
        <Route path="/tarot" element={<Tarot />} />
        <Route path="/my" element={<My />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
        <Route path="/payment/portone/callback" element={<PaymentCallback />} />
        <Route path="/detail/:id" element={<Detail />} />
        <Route path="/form/:id" element={<Form />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/loading" element={<Loading />} />
        <Route path="/report/:id" element={<Report />} />
        <Route path="/terms" element={<LegalPage pageKey="terms" />} />
        <Route path="/privacy" element={<LegalPage pageKey="privacy" />} />
        <Route path="/refund" element={<LegalPage pageKey="refund" />} />
      </Routes>

      <Footer />
      <BottomTabBar />
    </>
  );
}

function AppShell() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isWideAppRoute = location.pathname.startsWith('/form/');

  return (
    <div
      className={[
        'app-container',
        isAdminRoute ? 'admin-app-container' : '',
        !isAdminRoute && isWideAppRoute ? 'wide-app-container' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <AppRoutes />
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
