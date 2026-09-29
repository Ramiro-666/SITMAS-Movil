// Demo aislada: API ficticia en memoria + Expo web. No cambia .env.local.
const { fork, spawn } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
let expo;
let stopping = false;
const mock = fork(path.join(__dirname, 'mock-sitmas.cjs'), [], {
  cwd: root,
  stdio: ['inherit', 'inherit', 'inherit', 'ipc'],
});
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  expo?.kill();
  mock.kill();
  process.exitCode = code;
}
mock.once('message', (message) => {
  if (message !== 'ready' || stopping) return;
  console.log('Demo con datos ficticios. Usuario: demo / contraseña: demo.');
  const cli = path.join(
    path.dirname(require.resolve('expo/package.json')),
    'bin',
    'cli',
  );
  expo = spawn(process.execPath, [cli, 'start', '--web', '--port', '8082'], {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env: {
      ...process.env,
      EXPO_PUBLIC_SITMAS_API_URL: 'http://localhost:8097/api',
    },
  });
  expo.on('error', (error) => {
    console.error(error.message);
    stop(1);
  });
  expo.on('exit', (code) => stop(code || 0));
});
mock.on('error', (error) => {
  console.error(error.message);
  stop(1);
});
mock.on('exit', (code) => stop(code || 0));
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
