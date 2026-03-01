/**
 * afterSign hook for electron-builder.
 *
 * When no Apple Developer identity is configured, this ad-hoc signs
 * the app bundle so macOS will allow it to launch after the user
 * bypasses Gatekeeper (right-click → Open).
 *
 * Without ad-hoc signing, macOS may refuse to run the app at all
 * because the binary has no code signature.
 *
 * If APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID env vars
 * are set, this will notarize with Apple instead.
 */
const { execSync } = require('child_process');
const path = require('path');

module.exports = async function afterSign(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  // If real signing credentials are available, notarize
  if (process.env.APPLE_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD && process.env.APPLE_TEAM_ID) {
    console.log('  • Notarizing with Apple...');
    // Notarization requires @electron/notarize — skip if not installed
    try {
      const { notarize } = require('@electron/notarize');
      await notarize({
        appBundleId: context.packager.config.appId,
        appPath,
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      });
      console.log('  • Notarization complete');
    } catch (err) {
      console.warn('  • Notarization failed:', err.message);
      console.warn('  • Falling back to ad-hoc signing');
      adHocSign(appPath);
    }
    return;
  }

  // Check if electron-builder already signed with a real identity
  try {
    const sigInfo = execSync(`codesign -dvv "${appPath}" 2>&1`, { encoding: 'utf8' });
    const isAdHoc = sigInfo.includes('Signature=adhoc');
    const hasTeamId = /TeamIdentifier=(?!not set)/.test(sigInfo);

    if (!isAdHoc && hasTeamId) {
      console.log('  • App is already signed with a real identity, skipping ad-hoc signing');
      return;
    }
  } catch (_) {
    // codesign check failed — proceed with ad-hoc signing
  }

  // No real signature — ad-hoc sign so the app is launchable
  adHocSign(appPath);
};

function adHocSign(appPath) {
  console.log('  • Ad-hoc signing:', appPath);
  try {
    execSync(
      `codesign --force --deep --sign - "${appPath}"`,
      { stdio: 'inherit' }
    );
    console.log('  • Ad-hoc signing complete');
  } catch (err) {
    console.warn('  • Ad-hoc signing failed:', err.message);
    console.warn('  • App may not launch on macOS without manual Gatekeeper bypass');
  }
}
