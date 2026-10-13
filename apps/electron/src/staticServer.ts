import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.map': 'application/json', '.md': 'text/markdown; charset=utf-8',
};

/**
 * Serves the built web client on 127.0.0.1. The window needs a real http address (not file://): localStorage, IndexedDB and fetch to
 * raw.githubusercontent.com (theme updates) all key off the origin, and a fixed port keeps that origin, so the user's choices stay.
 * Unknown paths fall back to index.html (client-side routes).
 */
export function startStaticServer(webDir: string, port: number): Promise<{ port: number; close(): Promise<void> }> {
  const root = normalize(webDir + sep);
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      let file = normalize(join(webDir, path));
      if (!file.startsWith(root) && file !== normalize(webDir)) { res.writeHead(403).end(); return; }
      const s = await stat(file).catch(() => null);
      if (!s?.isFile()) file = join(webDir, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream', 'cache-control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600' });
      res.end(body);
    } catch { res.writeHead(500).end(); }
  });
  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      resolve({
        port: typeof addr === 'object' && addr ? addr.port : port,
        close: () => new Promise<void>((done) => { server.close(() => done()); server.closeAllConnections(); }),
      });
    });
  });
}
