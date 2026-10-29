# CI/CD Workflows (`com.receiptscannerpro.app`)

These workflow files mirror `.github/workflows/` to avoid GitHub OAuth scope restrictions during direct sync from Google AI Studio.

## Included Workflows:
1. `bundle-release.yml`: Verifies all 3 Google Play App Signing certificates (`deployment_cert.der`, `hybrid_classical_cert.der`, `hybrid_pqc_cert.der`), enforces a strictly increasing `versionCode >= 151` (`versionName 1.0.51+`), runs R8 DEX code optimization + resource shrinking (`proguard-android-optimize.txt`), embeds both R8 deobfuscation mapping (`proguard.map`) and NDK `FULL` native debug symbols into `ParserPro-release-v<versionCode>.aab` for **`com.receiptscannerpro.app`**, and publishes 1-click downloads of **`ParserPro-release-v<versionCode>.aab`**, **`mapping.txt`**, and **`native-debug-symbols.zip`** to **GitHub Releases** (`v1.0-playstore-aab`).
2. `build-apk.yml`: Automatically builds an installable debug Android APK (`com.receiptscannerpro.app`) using Capacitor and Android SDK 36, and publishes `app-debug.apk` to **GitHub Releases** (`v1.0-debug`).
3. `deploy.yml`: Deploys the web application (including `/.well-known/assetlinks.json`) to GitHub Pages.

## How to enable them on GitHub:
Once pushed to your GitHub repository:
1. Ensure **Settings → Actions → General → Workflow permissions** is set to **Read and write permissions** → **Save**.
2. If `.github/workflows/bundle-release.yml` was skipped during OAuth sync, copy `ci-workflows/bundle-release.yml` into `.github/workflows/bundle-release.yml` and commit on GitHub.

### Uploading `ParserPro-release-v<versionCode>.aab` to Google Play Console (`com.receiptscannerpro.app`)
1. Run **Build Release Android App Bundle (Play Console)** under the **Actions** tab and wait for the green checkmark.
2. Download **`ParserPro-release-v<versionCode>.aab`** (e.g. `ParserPro-release-v151.aab`) with 1 click from **Releases (`v1.0-playstore-aab`)** or the workflow **Summary** link, and upload it to your **`com.receiptscannerpro.app`** app in Google Play Console.
3. Ensure the 4 Upload Key secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) from the first upload's **`PlayConsole-Upload-Keystore-Backup-SAVE-THIS`** artifact are saved under **Settings → Secrets and variables → Actions** so all updates sign with the exact same Upload Key.

### GitHub Pages Settings
Under **Settings → Pages**, set **Source** to **Deploy from a branch**, select **`gh-pages`** and folder **`/ (root)`**.
