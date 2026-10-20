const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

function createLanServer({ folder, ip }) {
  const upstreamCa = fs.readFileSync(path.join(folder, 'upstream.crt'));
  const server = https.createServer({
    key: fs.readFileSync(path.join(folder, 'server.key')),
    cert: fs.readFileSync(path.join(folder, 'server.crt')),
    minVersion: 'TLSv1.2',
  }, (req, res) => {
    if (req.headers.host !== `${ip}:8443` || !req.url.startsWith('/api/')) {
      res.writeHead(404).end();
      return;
    }
    const login = req.method === 'POST' && req.url.toLowerCase() === '/api/usuario/login';
    if (!login && !/^Bearer \S+$/.test(req.headers.authorization ?? '')) {
      res.writeHead(401, { 'Content-Type': 'application/json' }).end(JSON.stringify({ Message: 'Iniciá sesión para consultar SITMAS.' }));
      return;
    }
    const headers = { ...req.headers, host: 'localhost:44325' };
    delete headers.connection;
    const upstream = https.request({
      hostname: 'localhost', port: 44325, path: req.url, method: req.method,
      headers, ca: upstreamCa, timeout: 20000,
    }, (response) => {
      res.writeHead(response.statusCode, response.headers);
      response.pipe(res);
    });
    upstream.on('timeout', () => upstream.destroy(new Error('Tiempo de espera agotado')));
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }).end(JSON.stringify({ Message: 'No se pudo consultar la API local. Comprobá SITMAS y su certificado.' }));
      else res.destroy();
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
  });
  server.requestTimeout = 30000;
  return server;
}

if (require.main === module) {
  const { X509Certificate } = require('node:crypto');
  const folder = path.join(__dirname, '../.local/lan-api');
  const cert = new X509Certificate(fs.readFileSync(path.join(folder, 'server.crt')));
  const ip = cert.subjectAltName?.match(/^IP Address:([\d.]+)$/)?.[1];
  if (!ip) throw new Error('Prepará el certificado con scripts/prepare-lan-api.ps1.');
  const server = createLanServer({ folder, ip });
  server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  server.listen(8443, ip, () => console.log(`Puente SITMAS: https://${ip}:8443/api → https://localhost:44325/api. Ctrl+C para detener.`));
}

module.exports = { createLanServer };
