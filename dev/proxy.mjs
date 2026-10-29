// Entwicklungs-Proxy: eine Herkunft für Yuvomi und den Bibellese-Dienst, wie später der Reverse Proxy.
//   node dev/proxy.mjs            → http://127.0.0.1:8080
// Umgebung: PROXY_PORT (8080), YUVOMI (http://127.0.0.1:3000), DIENST (http://127.0.0.1:3100)

import http from 'node:http';
import net from 'node:net';

const PORT = Number(process.env.PROXY_PORT || 8080);
const YUVOMI = new URL(process.env.YUVOMI || 'http://127.0.0.1:3000');
const DIENST = new URL(process.env.DIENST || 'http://127.0.0.1:3100');
const ziel = (url) => (url.startsWith('/api/extensions/bibellese') ? DIENST : YUVOMI);

const server = http.createServer((req, res) => {
  const z = ziel(req.url);
  const weiter = http.request({
    hostname: z.hostname, port: z.port, path: req.url, method: req.method,
    headers: {
      ...req.headers,
      'x-forwarded-for': req.socket.remoteAddress,
      'x-forwarded-host': req.headers.host,
      'x-forwarded-proto': 'http',
    },
  }, (antwort) => {
    res.writeHead(antwort.statusCode, antwort.headers);
    antwort.pipe(res);
  });
  weiter.on('error', () => {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: `${z.host} nicht erreichbar`, code: 'offline' }));
  });
  req.pipe(weiter);
});

// WebSockets (falls Yuvomi sie nutzt) einfach durchreichen.
server.on('upgrade', (req, socket, kopf) => {
  const z = ziel(req.url);
  const gegen = net.connect(Number(z.port), z.hostname, () => {
    gegen.write(`${req.method} ${req.url} HTTP/1.1\r\n${Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`);
    gegen.write(kopf);
    socket.pipe(gegen).pipe(socket);
  });
  gegen.on('error', () => socket.destroy());
});

server.listen(PORT, '127.0.0.1', () => console.log(`[proxy] http://127.0.0.1:${PORT} → Yuvomi ${YUVOMI.host}, Bibellese ${DIENST.host}`));
