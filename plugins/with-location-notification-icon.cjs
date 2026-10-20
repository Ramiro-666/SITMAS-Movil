const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// expo-location usa notification_icon antes del ícono de inicio a color.
module.exports = config => withDangerousMod(config, ['android', async result => {
  const drawable = path.join(result.modRequest.platformProjectRoot, 'app/src/main/res/drawable');
  fs.mkdirSync(drawable, { recursive: true });
  fs.copyFileSync(
    path.join(result.modRequest.projectRoot, 'assets/images/sitmas/bio-notification.xml'),
    path.join(drawable, 'notification_icon.xml'),
  );
  return result;
}]);
