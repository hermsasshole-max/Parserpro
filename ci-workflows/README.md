# CI/CD Workflows (`com.receiptscannerpro.app`)

These workflow files mirror `.github/workflows/` to avoid GitHub OAuth scope restrictions during direct sync from Google AI Studio.

## Included Workflows:
1. `bundle-release.yml`: Verifies the Google Play App Signing certificates (`deployment_cert.der` — `SHA1: AA:14:BE:52:28:F8:80:7C:13:DE:D0:86:F1:11:6A:0F:AE:93:17:4D`), builds a cryptographically signed Android App Bundle (`ParserPro-release.aab`) for **`com.receiptscannerpro.app`** with auto-incrementing `versionCode`, and publishes a direct 1-click `.aab` download to **GitHub Releases** (`v1.0-playstore-aab`).
2. `build-apk.yml`: Automatically builds an installable debug Android APK (`com.receiptscannerpro.app`) using Capacitor and Android SDK 36, and publishes `app-debug.apk` to **GitHub Releases** (`v1.0-debug`).
3. `deploy.yml`: Deploys the web application (including `/.well-known/assetlinks.json`) to GitHub Pages.

## How to enable them on GitHub:
Once pushed to your GitHub repository:
1. Ensure **Settings → Actions → General → Workflow permissions** is set to **Read and write permissions** → **Save**.
2. If `.github/workflows/bundle-release.yml` was skipped during OAuth sync, copy `ci-workflows/bundle-release.yml` into `.github/workflows/bundle-release.yml` and commit on GitHub.

### Uploading `ParserPro-release.aab` to Google Play Console (`com.receiptscannerpro.app`)
1. Run **Build Release Android App Bundle (Play Console)** under the **Actions** tab.
2. Download **`ParserPro-release.aab`** with 1 click from **Releases (`v1.0-playstore-aab`)** or the workflow **Summary** link, and upload it to your **`com.receiptscannerpro.app`** app in Google Play Console.
3. Download **`PlayConsole-Upload-Keystore-Backup-SAVE-THIS`** from that Actions run and save the 4 values in `GITHUB_SECRETS_SETUP.txt` (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) under **Settings → Secrets and variables → Actions** so all future updates sign with the exact same Upload Key.

### GitHub Pages Settings
Under **Settings → Pages**, set **Source** to **Deploy from a branch**, select **`gh-pages`** and folder **`/ (root)`**.
