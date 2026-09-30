# CI/CD Workflows

These workflow files are stored here to avoid GitHub OAuth scope restrictions during direct sync from Google AI Studio.

## Included Workflows:
1. `bundle-release.yml`: Builds a production-ready Android App Bundle (`.aab`) via `./gradlew bundleRelease` for Google Play Store publishing.
2. `build-apk.yml`: Automatically builds an installable debug Android APK using Capacitor and Android SDK 36.
3. `deploy.yml`: Deploys the web application to GitHub Pages.

## How to enable them on GitHub:
Once pushed to your GitHub repository:
1. Go to your repository on GitHub.
2. Click **Add file** -> **Create new file**.
3. Name it `.github/workflows/bundle-release.yml` and paste the contents of `ci-workflows/bundle-release.yml`.
4. Name it `.github/workflows/build-apk.yml` and paste the contents of `ci-workflows/build-apk.yml`.
5. Name it `.github/workflows/deploy.yml` and paste the contents of `ci-workflows/deploy.yml`.
6. Commit directly on GitHub.

### GitHub Pages Settings
The updated `deploy.yml` uses the reliable `peaceiris/actions-gh-pages` engine which deploys to the `gh-pages` branch without crashing on `HttpError: Not Found`.

1. In your GitHub repository, ensure Actions have write permissions:
   - Go to **Settings** -> **Actions** -> **General** -> scroll down to **Workflow permissions** -> select **Read and write permissions** -> **Save**.
2. Under **Settings** -> **Pages**:
   - **Source**: Select **Deploy from a branch**
   - **Branch**: Select **`gh-pages`** and folder **`/ (root)`**.
3. Your site will automatically be live at `https://hermsasshole-max.github.io/Parserpro/`!
