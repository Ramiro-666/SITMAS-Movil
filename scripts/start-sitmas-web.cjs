// Inicia Expo web contra SITMAS real. No crea servidores ni datos de demostración.
const { spawn } = require('node:child_process');
const path = require('node:path');
const { load } = require('@expo/env');
const root = path.resolve(__dirname, '..');
process.env.NODE_ENV ||= 'development';
load(root);
const api = (
  process.env.EXPO_PUBLIC_SITMAS_API_URL || 'https://localhost:44325/api'
).replace(/\/$/, '');
const target = new URL(api);
if (
  !['http:', 'https:'].includes(target.protocol) ||
  target.username ||
  target.password
) {
  console.error(
    'EXPO_PUBLIC_SITMAS_API_URL debe ser una URL HTTP(S) de la API, sin credenciales.',
  );
  process.exit(1);
}
if (
  ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
  target.port === '8097'
) {
  console.error(
    'El puerto 8097 pertenecía a la demo retirada. Usá la API real de SITMAS en EXPO_PUBLIC_SITMAS_API_URL.',
  );
  process.exit(1);
}
if (process.argv.includes('--legacy-demo'))
  console.log(
    'web:demo ahora abre SITMAS con datos reales. Podés usar npm run web.',
  );
console.log('API SITMAS: ' + api);
console.log('Ingresá con tu cuenta de SITMAS. La API debe estar iniciada.');
const cli = path.join(
  path.dirname(require.resolve('expo/package.json')),
  'bin',
  'cli',
);
const forwarded = process.argv
  .slice(2)
  .filter((arg) => arg !== '--legacy-demo');
const expo = spawn(
  process.execPath,
  [cli, 'start', '--web', '--port', '8082', ...forwarded],
  {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: { ...process.env, EXPO_PUBLIC_SITMAS_API_URL: api },
  },
);
expo.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
expo.on('exit', (code) => {
  process.exitCode = code || 0;
});
process.on('SIGINT', () => expo.kill());
process.on('SIGTERM', () => expo.kill());
