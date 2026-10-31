const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createMobileHandler, createUpstream } = require('./mobile-api.cjs');

function createDevServer() {
  const ca = fs.readFileSync(path.join(__dirname, '../.local/lan-api/upstream.crt'));
  const server = http.createServer(createMobileHandler({
    alerts: require('./avisos-viaje.cjs').crearAvisosViaje(process.env.SITMAS_ALERTS_FILE ?? (process.platform === 'win32' ? 'D:/descarga codex/plugin-data/sitmas-movil/trip-alerts.json' : path.join(__dirname, '../.local/trip-alerts.json'))), upstream: createUpstream(ca), hosts: ['localhost', '127.0.0.1'],
    origins: ['http://localhost:8081', 'http://localhost:8082', 'http://127.0.0.1:8081', 'http://127.0.0.1:8082'],
  }));
  server.requestTimeout = 30000;
  return server;
}

if (require.main === module) {
  const server = createDevServer();
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
  server.listen(8098, '127.0.0.1', () => console.log('Acceso móvil local protegido: http://localhost:8098/api. Solo Juan y Mauro. Ctrl+C para detener.'));
}

module.exports = { createDevServer };
