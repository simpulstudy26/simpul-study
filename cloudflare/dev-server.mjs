// Python이 없는 PC(윈도우)에서 미리보기용: site/ 정적 파일 + /api/* 를 cloudflare/api.js로 연결
// 실행: node cloudflare/dev-server.mjs [포트]   (기본 8012)
// 사전(/api/dict)은 그대로 작동. D1이 필요한 API(문제 만들기·관리자)는 여기서는 503을 돌려준다.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './api.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const port = Number(process.argv[2] || process.env.PORT || 8012);
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.pdf': 'application/pdf'
};

http.createServer(async (req, res) => {
  // 브라우저가 쓴 주소(localhost/127.0.0.1)를 그대로 써야 api.js의 같은 사이트 검사(Origin)가 맞는다
  const url = new URL(req.url, 'http://' + (req.headers.host || '127.0.0.1:' + port));
  try {
    if (url.pathname.startsWith('/api/')) {
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await new Promise(ok => {
        const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => ok(Buffer.concat(chunks)));
      });
      const r = await handle({ request: new Request(url, { method: req.method, headers: req.headers, body }), env: {} });
      res.writeHead(r.status, Object.fromEntries(r.headers));
      return res.end(Buffer.from(await r.arrayBuffer()));
    }
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(site, p));
    if (!file.startsWith(site + path.sep) || file.split(path.sep).some(part => part.startsWith('.'))) { res.writeHead(404); return res.end(); }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }
}).listen(port, '127.0.0.1', () => console.log('SIMPUL 미리보기: http://127.0.0.1:' + port + '/index.html'));
