const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const { isIP } = require('node:net');

module.exports = function withLanCertificate(config) {
  const api = new URL(process.env.EXPO_PUBLIC_SITMAS_API_URL);
  if (api.protocol !== 'https:' || isIP(api.hostname) !== 4 ||
      !/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(api.hostname)) {
    throw new Error('El certificado LAN solo se puede usar con la IPv4 privada de esta PC por HTTPS.');
  }
  config = withAndroidManifest(config, (result) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(result.modResults);
    app.$['android:networkSecurityConfig'] = '@xml/sitmas_lan_network';
    app.$['android:usesCleartextTraffic'] = 'false';
    return result;
  });
  return withDangerousMod(config, ['android', async (result) => {
    const resources = path.join(result.modRequest.platformProjectRoot, 'app/src/main/res');
    fs.mkdirSync(path.join(resources, 'raw'), { recursive: true });
    fs.mkdirSync(path.join(resources, 'xml'), { recursive: true });
    fs.copyFileSync(path.join(result.modRequest.projectRoot, 'assets/certificates/sitmas-lan-ca.pem'), path.join(resources, 'raw/sitmas_lan_ca.pem'));
    fs.writeFileSync(path.join(resources, 'xml/sitmas_lan_network.xml'), `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false"><trust-anchors><certificates src="system" /></trust-anchors></base-config>
  <domain-config cleartextTrafficPermitted="false">
    <domain includeSubdomains="false">${api.hostname}</domain>
    <trust-anchors><certificates src="@raw/sitmas_lan_ca" /></trust-anchors>
  </domain-config>
</network-security-config>
`);
    return result;
  }]);
};
