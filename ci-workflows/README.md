# CI/CD Workflows

These workflow files are stored here to avoid GitHub OAuth scope restrictions during direct sync from Google AI Studio.

## Included Workflows:
1. `bundle-release.yml`: Builds a cryptographically signed Android App Bundle (`ParserPro-release.aab`) via `./gradlew bundleRelease` with auto-incrementing `versionCode` for Google Play Console, and publishes a direct 1-click `.aab` download to **GitHub Releases** (`v1.0-playstore-aab`).
2. `build-apk.yml`: Automatically builds an installable debug Android APK using Capacitor and Android SDK 36, and publishes `app-debug.apk` to **GitHub Releases** (`v1.0-debug`).
3. `deploy.yml`: Deploys the web application to GitHub Pages.

## How to enable them on GitHub:
Once pushed to your GitHub repository (if `.github/workflows/` was skipped by OAuth sync):
1. Go to your repository on GitHub.
2. Ensure **Settings** -> **Actions** -> **General** -> **Workflow permissions** is set to **Read and write permissions** -> **Save**.
3. If `.github/workflows/bundle-release.yml` is not yet updated in `.github/workflows/`, copy `ci-workflows/bundle-release.yml` into `.github/workflows/bundle-release.yml` and commit directly on GitHub.

### Downloading `ParserPro-release.aab` & Matching Google Play Console Signing Key (`4A:C2:38:...`)
1. Run **Build Release Android App Bundle (Play Console)** under the **Actions** tab (runs automatically on push to `main`/`master`, or manually via **Run workflow**).
2. Download **`ParserPro-release.aab`** with 1 click (no unzipping required) from your repository's **Releases** page (`v1.0-playstore-aab`), or from the direct link in the workflow's **Summary** page.
3. **Matching Play Console's Expected Certificate (`SHA1: 4A:C2:38:3A:F5:41:99:5E:99:FD:CC:CD:E5:BC:F7:C8:2A:52:DC:3B`)**:
   - **If you HAVE your original `.jks` / `.keystore` file**: Add `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` under **Settings → Secrets and variables → Actions** (`ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` are auto-detected if omitted), or upload your `.jks`/`.keystore` into `android/signing/` (private repos only) + set `ANDROID_KEYSTORE_PASSWORD`.
   - **If you LOST the old `4A:C2:38:...` keystore**: First download the **`PlayConsole-Upload-Keystore-Backup-SAVE-THIS`** artifact from the Actions run page and save the 4 secrets inside `GITHUB_SECRETS_SETUP.txt` into GitHub Secrets so the new key stays permanent. Then download **`upload_certificate.pem`** (1-click from **GitHub Releases `v1.0-playstore-aab`**) and upload it in **Google Play Console → Test and release → Setup → App signing → Request upload key reset**.

### GitHub Pages Settings
The `deploy.yml` workflow deploys to the `gh-pages` branch:
1. Under **Settings** -> **Pages**:
   - **Source**: Select **Deploy from a branch**
   - **Branch**: Select **`gh-pages`** and folder **`/ (root)`**.
