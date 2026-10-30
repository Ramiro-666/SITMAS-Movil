const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createHmac } = require('node:crypto');
const { createMobileHandler } = require('./mobile-api.cjs');

const sign = (id, exp = Math.floor(Date.now() / 1000) + 300, secret = 'fixture-only') => {
  const data = [Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: String(id), exp })).toString('base64url')].join('.');
  return data + '.' + createHmac('sha256', secret).update(data).digest('base64url');
};
const result = (status, value) => ({ status, body: Buffer.from(JSON.stringify(value)), headers: { 'content-type': 'application/json' } });

test('el servidor móvil exige identidad validada y no entrega datos a otras cuentas', async t => {
  const calls = [];
  let unavailable = false, inactive = false, mismatch = false, loginMismatch = false;
  const upstream = async (path, method, headers, body) => {
    calls.push({ path, method });
    if (unavailable) throw new Error('offline');
    if (path === '/api/Usuario/Login') {
      const id = JSON.parse(body).Usuario === 'juan' ? 1 : JSON.parse(body).Usuario === 'mauro' ? 11 : 12;
      return result(200, { idUsuario: id, nombre: 'Fixture', rol: 'Fixture', token: sign(loginMismatch ? 11 : id) });
    }
    const token = headers.authorization?.slice(7);
    let claim;
    try { claim = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')); } catch { return result(401, {}); }
    if (token !== sign(claim.sub, claim.exp) || claim.exp <= Date.now() / 1000) return result(401, {});
    if (path.startsWith('/api/Usuario/ListarPorId/')) return result(200, { Id: mismatch ? 12 : Number(claim.sub), Id_Estado_Usuario: inactive ? 2 : 1 });
    return result(200, [{ Id: 112 }]);
  };
  const server = http.createServer(createMobileHandler({ upstream, hosts: ['127.0.0.1'], origins: ['http://localhost:8081'] }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (path, token, init = {}) => fetch(base + path, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
  assert.equal((await request('/api/hojaruta')).status, 401);
  assert.equal((await request('/api/hojaruta', 'invalid')).status, 401);
  assert.equal((await request('/api/hojaruta', sign(1, 1))).status, 401);
  assert.equal((await request('/api/hojaruta', sign(1, undefined, 'forged'))).status, 401);
  assert.equal((await request('/api/hojaruta', sign(12))).status, 403);
  assert.ok(!calls.some(c => c.path === '/api/hojaruta'));
  for (const id of [1, 11]) {
    const r = await request('/api/hojaruta', sign(id));
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), [{ Id: 112 }]);
    assert.match(r.headers.get('cache-control'), /no-store/);
  }
  inactive = true;
  assert.equal((await request('/api/hojaruta', sign(1))).status, 403);
  inactive = false;
  mismatch = true;
  assert.equal((await request('/api/hojaruta', sign(1))).status, 403);
  mismatch = false;
  unavailable = true;
  assert.equal((await request('/api/hojaruta', sign(1))).status, 502);
  unavailable = false;
  for (const user of ['juan', 'mauro', 'otro']) {
    const r = await request('/api/Usuario/Login', undefined, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Usuario: user, Password: 'fixture' }) });
    assert.equal(r.status, user === 'otro' ? 403 : 200);
    const body = await r.json();
    if (user === 'otro') { assert.equal(body.token, undefined); assert.match(body.Message, /comuníquese con su supervisor/); }
    else assert.ok(body.token);
  }
  loginMismatch = true;
  const badLogin = await request('/api/Usuario/Login', undefined, { method: 'POST', body: JSON.stringify({ Usuario: 'juan' }) });
  assert.equal(badLogin.status, 502);
  assert.equal((await badLogin.json()).token, undefined);
  loginMismatch = false;
  assert.equal((await request('/api/Usuario/Login', undefined, { method: 'POST', body: 'x'.repeat(129 * 1024) })).status, 413);
  assert.equal((await request('/api/Usuario/ListarTodo', sign(1))).status, 404);
  assert.equal((await request('/api/../Usuario/ListarTodo', sign(1))).status, 404);
  const cors = await request('/api/hojaruta', undefined, { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081' } });
  assert.equal(cors.status, 204);
  assert.equal(cors.headers.get('access-control-allow-origin'), 'http://localhost:8081');
  assert.equal((await request('/api/hojaruta', sign(1), { headers: { Origin: 'https://evil.invalid' } })).status, 403);
});
