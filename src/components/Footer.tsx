import { Link, useLocation } from 'react-router-dom';

const hiddenPrefixes = ['/form/', '/checkout', '/loading', '/report/'];

export default function Footer() {
  const location = useLocation();

  if (hiddenPrefixes.some((prefix) => location.pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <footer className="site-footer">
      <div className="site-footer-inner compact">
        <div className="site-footer-copy compact">
          <p>ⓒ 2025 케이컴퍼니 | 대표: 김명숙 | 사업자등록번호: 308-13-16314</p>
          <p>통신판매업 신고번호: 제 2025-서울구로-0005호</p>
          <p>주소: 서울특별시 구로구 구로동180-3</p>
          <p>상호명: 케이컴퍼니(운월당)</p>
          <p>고객센터 전화: 050420111894 | 이메일: 250909bs@gmail.com</p>
          <p>개인정보보호책임자: 차민호</p>
        </div>

        <div className="site-footer-links compact">
          <Link to="/terms">이용약관</Link>
          <span>|</span>
          <Link to="/privacy">개인정보처리방침</Link>
          <span>|</span>
          <Link to="/refund">환불정책</Link>
        </div>
      </div>
    </footer>
  );
}
