// Comprobación de solo lectura: requiere la API y npm run api:lan encendidos.
const https = require('node:https');
const tls = require('node:tls');
const fs = require('node:fs');
const path = require('node:path');
const { X509Certificate } = require('node:crypto');
const assert = require('node:assert/strict');
const certificate = fs.readFileSync(path.join(__dirname, '../.local/lan-api/server.crt'));
const ip = new X509Certificate(certificate).subjectAltName.match(/^IP Address:([\d.]+)$/)[1];
const ca = fs.readFileSync(path.join(__dirname, '../assets/certificates/sitmas-lan-ca.pem'));
function get(urlPath, host = `${ip}:8443`, authorization) {
  return new Promise((resolve, reject) => {
    const request = https.get({ hostname: ip, port: 8443, path: urlPath, ca,
      // Aun al probar un Host inválido, verificar la identidad TLS real del puente.
      checkServerIdentity: (_, cert) => tls.checkServerIdentity(ip, cert),
      headers: { host, ...(authorization ? { authorization } : {}) }, timeout: 6000,
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body }));
    });
    request.on('timeout', () => request.destroy(new Error('No se pudo conectar con el puente.')));
    request.on('error', reject);
  });
}
(async () => {
  const result = await get('/api/hojaruta/hoy');
  assert.equal(result.status, 401);
  const backend = await get('/api/hojaruta/hoy', `${ip}:8443`, 'Bearer invalid-pilot-test');
  assert.equal(backend.status, 401, backend.body);
  assert.match(backend.body, /Token inválido o expirado/);
  assert.equal((await get('/')).status, 404);
  assert.equal((await get('/api/hojaruta/hoy', 'example.invalid')).status, 404);
  console.log('HTTPS y conexión a la API correctos; acceso sin sesión, token inválido, rutas y Host ajenos rechazados.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
