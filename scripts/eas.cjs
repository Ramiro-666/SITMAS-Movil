// Estado/caché locales; EAS necesita temporales fuera del repositorio.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const cache = path.join(root, '.local/npm-cache/_npx');
const installation = fs.readdirSync(cache).map(name => path.join(cache, name, 'node_modules/eas-cli'))
  .find(folder => fs.existsSync(path.join(folder, 'package.json')) && JSON.parse(fs.readFileSync(path.join(folder, 'package.json'))).version === '25.2.0');
if (!installation) throw new Error('Falta EAS CLI 25.2.0 en la caché local de my-app.');
const storage = path.join(root, '.local/eas');
const temporary = 'D:\\descarga codex\\plugin-temp\\sitmas-movil-eas';
const directories = { USERPROFILE: storage, APPDATA: path.join(storage, 'roaming'), LOCALAPPDATA: path.join(storage, 'local'), TEMP: temporary, TMP: temporary };
for (const folder of Object.values(directories)) fs.mkdirSync(folder, { recursive: true });
const result = spawnSync(process.execPath, [path.join(installation, 'bin/run'), ...process.argv.slice(2)], {
  cwd: root, stdio: 'inherit', env: { ...process.env, ...directories, EXPO_NO_TELEMETRY: '1', EAS_NO_TELEMETRY: '1' },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
