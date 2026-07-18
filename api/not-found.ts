type VercelResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  send(body: string): VercelResponse;
};

export default function handler(_request: unknown, response: VercelResponse) {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
  response.setHeader('X-Robots-Tag', 'noindex, nofollow');

  return response.status(404).send(`<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex,nofollow" />
    <title>페이지를 찾을 수 없습니다 | 운월당</title>
  </head>
  <body>
    <main>
      <h1>페이지를 찾을 수 없어요.</h1>
      <p>주소가 바뀌었거나 존재하지 않는 페이지입니다.</p>
      <a href="/">운월당 홈으로 이동</a>
    </main>
  </body>
</html>`);
}
