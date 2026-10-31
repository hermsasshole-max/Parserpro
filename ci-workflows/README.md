# CI/CD Workflows (`com.receiptscannerpro.app`)

These workflow files mirror `.github/workflows/` to avoid GitHub OAuth scope restrictions during direct sync from Google AI Studio.

## Included Workflows:
1. `bundle-release.yml`: Verifies all 3 Google Play App Signing certificates (`deployment_cert.der`, `hybrid_classical_cert.der`, `hybrid_pqc_cert.der`), enforces a strictly increasing `versionCode >= 230` (`versionName 1.5.0+`, strictly above all previously used Play Console versions), embeds Google Play Billing Library `8.3.0` (`com.android.vending.BILLING`) for the 3-tier monetization plans (`parserpro_mid_monthly` at `$1.99/mo` and `parserpro_full_monthly` at `$3.99/mo`), runs R8 DEX code optimization + resource shrinking (`proguard-android-optimize.txt`), embeds both R8 deobfuscation mapping (`proguard.map`) and NDK `FULL` native debug symbols into `ParserPro-release-v<versionCode>.aab` for **`com.receiptscannerpro.app`**, and publishes 1-click downloads of **`ParserPro-release-v<versionCode>.aab`**, **`mapping.txt`**, and **`native-debug-symbols.zip`** to **GitHub Releases** (`v1.0-playstore-aab`, marked as **Latest**).
2. `build-apk.yml`: Automatically builds an installable debug Android APK (`com.receiptscannerpro.app`) using Capacitor and Android SDK 36, and publishes `app-debug.apk` to **GitHub Releases** (`v1.0-debug`).
3. `deploy.yml`: Deploys the web application (including `/.well-known/assetlinks.json`) to GitHub Pages.

## How to enable them on GitHub:
Once pushed to your GitHub repository:
1. Ensure **Settings → Actions → General → Workflow permissions** is set to **Read and write permissions** → **Save**.
2. If `.github/workflows/bundle-release.yml` was skipped during OAuth sync, copy `ci-workflows/bundle-release.yml` into `.github/workflows/bundle-release.yml` and commit on GitHub.

### Uploading `ParserPro-release-v<versionCode>.aab` to Google Play Console (`com.receiptscannerpro.app`)
1. Sync your latest changes to GitHub so **Build Release Android App Bundle (Play Console)** runs under the **Actions** tab and wait for the green checkmark (~3 minutes).
2. Open **Releases → Latest (`v1.0-playstore-aab`)** and download **`ParserPro-release-v230.aab`** (or newer `ParserPro-release-v<versionCode>.aab`). First tap **`✕`** next to any older `.aab` row in Google Play Console, then upload the newly downloaded `ParserPro-release-v230.aab`.
3. Once `ParserPro-release-v230.aab` is uploaded to Internal/Closed Testing, open **Monetize with Play → Products → Subscriptions** and create `parserpro_mid_monthly` (`mid-monthly` at `$1.99/mo`) and `parserpro_full_monthly` (`full-monthly` at `$3.99/mo`). See `PLAY_CONSOLE_MONETIZATION_SETUP.md` for step-by-step instructions.

### GitHub Pages Settings
Under **Settings → Pages**, set **Source** to **Deploy from a branch**, select **`gh-pages`** and folder **`/ (root)`**.
