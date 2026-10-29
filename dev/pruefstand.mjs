// Prüfstand: das Modul im Browser mit dem echten Dienst testen, ohne ein Yuvomi zu installieren.
//
//   node service/src/server.js       (mit YUVOMI_URL=http://127.0.0.1:8080 PUBLIC_ORIGIN=http://127.0.0.1:8080)
//   node dev/pruefstand.mjs          → http://127.0.0.1:8080/m/bibellese
//
// Er spielt die Teile von Yuvomi, die das Modul braucht: /api/v1/auth/me und /api/v1/family/members
// für fünf Testpersonen (Wechsel über ?als=paul|maria|lea|jonas|oma), /api.js und /utils/*.js als kleine
// Nachbauten, und lädt Yuvomis echte Stylesheets aus YUVOMI_QUELLE (geklontes Yuvomi-Repo).

import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hier = path.dirname(fileURLToPath(import.meta.url));
const wurzel = path.join(hier, '..');
const PORT = Number(process.env.PORT || 8080);
const DIENST = new URL(process.env.DIENST || 'http://127.0.0.1:3100');
const QUELLE = process.env.YUVOMI_QUELLE || '';

const PERSONEN = {
  paul: { id: 1, display_name: 'Paul', role: 'admin', family_role: 'dad', avatar_color: '#2563EB', recht: 'write' },
  maria: { id: 2, display_name: 'Maria', role: 'member', family_role: 'mom', avatar_color: '#CE2A63', recht: 'write' },
  lea: { id: 3, display_name: 'Lea', role: 'member', family_role: 'child', avatar_color: '#C2410C', recht: 'write' },
  jonas: { id: 4, display_name: 'Jonas', role: 'member', family_role: 'child', avatar_color: '#157F3D', recht: 'write' },
  oma: { id: 5, display_name: 'Oma', role: 'member', family_role: 'grandparent', avatar_color: '#42587E', recht: 'read' },
};

const TYPEN = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml' };
const sende = (res, status, typ, inhalt, kopf = {}) => { res.writeHead(status, { 'content-type': typ, 'cache-control': 'no-store', ...kopf }); res.end(inhalt); };
const datei = (res, pfad) => {
  if (!fs.existsSync(pfad) || !fs.statSync(pfad).isFile()) return sende(res, 404, 'text/plain', 'nicht gefunden');
  return sende(res, 200, TYPEN[path.extname(pfad)] ?? 'application/octet-stream', fs.readFileSync(pfad));
};
const sitzung = (req) => PERSONEN[/sid=(\w+)/.exec(req.headers.cookie ?? '')?.[1]];

http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  // Bibellese-Dienst durchreichen (wie der Reverse Proxy).
  if (p.startsWith('/api/extensions/bibellese')) {
    const weiter = http.request({ hostname: DIENST.hostname, port: DIENST.port, path: req.url, method: req.method,
      headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress, 'x-forwarded-host': req.headers.host, 'x-forwarded-proto': 'http' } },
    (a) => { res.writeHead(a.statusCode, a.headers); a.pipe(res); });
    weiter.on('error', () => sende(res, 502, 'application/json', '{"error":"Bibellese-Dienst nicht erreichbar","code":"offline"}'));
    req.pipe(weiter);
    return;
  }

  // Die Teile von Yuvomi, die das Modul fragt.
  if (p === '/api/v1/auth/me') {
    const wer = sitzung(req);
    if (!wer) return sende(res, 401, 'application/json', '{"error":"Not authenticated"}');
    const { recht, ...user } = wer;
    return sende(res, 200, 'application/json', JSON.stringify({ user, permissions: { admin: user.role === 'admin', modules: { 'ext:bibellese': recht } } }));
  }
  if (p === '/api/v1/family/members') {
    if (!sitzung(req)) return sende(res, 401, 'application/json', '{"error":"Not authenticated"}');
    return sende(res, 200, 'application/json', JSON.stringify({ data: Object.values(PERSONEN).map(({ recht, role, ...m }) => m) }));
  }

  // Seite: Anmelden als Testperson und das Modul unter /m/bibellese.
  if (p === '/m/bibellese' || p === '/') {
    const als = url.searchParams.get('als');
    if (als && PERSONEN[als]) return sende(res, 302, 'text/plain', '', { location: '/m/bibellese', 'set-cookie': `sid=${als}; Path=/; SameSite=Lax` });
    if (!sitzung(req)) return sende(res, 302, 'text/plain', '', { location: '/m/bibellese?als=paul' });
    return datei(res, path.join(hier, 'pruefstand', 'seite.html'));
  }
  // Dashboard-Kachel in Yuvomis Kachelrahmen.
  if (p === '/kachel') {
    if (!sitzung(req)) return sende(res, 302, 'text/plain', '', { location: '/m/bibellese?als=paul' });
    return datei(res, path.join(hier, 'pruefstand', 'kachel.html'));
  }
  if (p.startsWith('/modules/bibellese/')) return datei(res, path.join(wurzel, p));
  if (p === '/api.js' || p.startsWith('/utils/') || p.startsWith('/pruefstand/')) return datei(res, path.join(hier, 'pruefstand', p.replace(/^\/(pruefstand\/)?/, '')));
  if (p === '/lucide.min.js') return datei(res, path.join(wurzel, 'mockup/vendor/lucide.min.js'));
  if (p.startsWith('/styles/')) {
    if (!QUELLE) return sende(res, 200, 'text/css', p === '/styles/tokens.css' ? fs.readFileSync(path.join(wurzel, 'mockup/vendor/yuvomi-tokens.css')) : '');
    return datei(res, path.join(QUELLE, 'public', p));
  }
  return sende(res, 404, 'text/plain', 'nicht gefunden');
}).listen(PORT, '127.0.0.1', () => console.log(`[prüfstand] http://127.0.0.1:${PORT}/m/bibellese (Dienst ${DIENST.host})`));
