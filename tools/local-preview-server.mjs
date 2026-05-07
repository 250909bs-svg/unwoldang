import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'node:http';

const root = normalize(join(process.cwd(), 'dist'));
const host = process.env.HOST ?? '0.0.0.0';
const port = Number(process.env.PORT ?? 4174);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function safePathname(url = '/') {
  const pathname = decodeURIComponent(new URL(url, `http://${host}:${port}`).pathname);
  return pathname === '/' ? '/index.html' : pathname;
}

function resolveFile(pathname) {
  const requested = normalize(join(root, pathname));
  if (!requested.startsWith(root)) {
    return join(root, 'index.html');
  }

  if (existsSync(requested)) {
    const stats = statSync(requested);
    return stats.isDirectory() ? join(requested, 'index.html') : requested;
  }

  return join(root, 'index.html');
}

createServer((req, res) => {
  const pathname = safePathname(req.url);
  const file = resolveFile(pathname);
  const type = contentTypes[extname(file)] ?? 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': type });
  createReadStream(file).pipe(res);
}).listen(port, host, () => {
  console.log(`preview server ready at http://${host}:${port}`);
});
