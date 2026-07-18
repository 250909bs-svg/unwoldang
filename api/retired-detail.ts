const retiredPage = `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>종료된 페이지 | 운월당</title>
    <style>
      :root { color-scheme: dark; font-family: "Noto Sans KR", sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #080706; color: #f8f2e8; }
      main { width: min(520px, 100%); padding: 36px 28px; border: 1px solid #514536; border-radius: 24px; background: #15110d; text-align: center; }
      small { color: #d5ad69; font-weight: 800; letter-spacing: .14em; }
      h1 { margin: 14px 0 10px; font-size: clamp(26px, 7vw, 38px); }
      p { margin: 0; color: #c9bfb2; line-height: 1.75; }
      a { display: inline-flex; margin-top: 24px; padding: 13px 20px; border-radius: 999px; background: #f3e6cf; color: #17100a; font-weight: 800; text-decoration: none; }
    </style>
  </head>
  <body>
    <main>
      <small>410 · PAGE CLOSED</small>
      <h1>이 페이지는 종료되었어요.</h1>
      <p>이전 상세화면은 더 이상 제공하지 않습니다.<br />현재 운영 중인 운월당 콘텐츠는 홈에서 확인해 주세요.</p>
      <a href="/">운월당 홈으로 가기</a>
    </main>
  </body>
</html>`;

export default function handler(_req: any, res: any) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  return res.status(410).send(retiredPage);
}
