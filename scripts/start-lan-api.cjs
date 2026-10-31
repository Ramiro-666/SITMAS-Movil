const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

function createLanServer({ folder, ip }) {
  const upstreamCa = fs.readFileSync(path.join(folder, 'upstream.crt'));
  const { createMobileHandler, createUpstream } = require('./mobile-api.cjs');
  const server = https.createServer({
    key: fs.readFileSync(path.join(folder, 'server.key')),
    cert: fs.readFileSync(path.join(folder, 'server.crt')),
    minVersion: 'TLSv1.2',
  }, createMobileHandler({ alerts: require('./avisos-viaje.cjs').crearAvisosViaje(process.env.SITMAS_ALERTS_FILE ?? (process.platform === 'win32' ? 'D:/descarga codex/plugin-data/sitmas-movil/trip-alerts.json' : path.join(__dirname, '../.local/trip-alerts.json'))), upstream: createUpstream(upstreamCa), hosts: [ip] }));
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
