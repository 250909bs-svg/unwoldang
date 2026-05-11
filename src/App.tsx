import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import Menu from './pages/Menu';
import Test from './pages/Test';
import FaceAI from './pages/FaceAI';
import Dreams from './pages/Dreams';
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
        <Route path="/dreams" element={<Dreams />} />
        <Route path="/tarot" element={<Tarot />} />
        <Route path="/my" element={<My />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/kakao/callback" element={<KakaoCallback />} />
        <Route path="/payment/toss/callback" element={<PaymentCallback />} />
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

function App() {
  return (
    <Router>
      <div className="app-container">
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;
