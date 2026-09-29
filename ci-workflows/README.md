# CI/CD Workflows

These workflow files are stored here to avoid GitHub OAuth scope restrictions during direct sync from Google AI Studio.

## Included Workflows:
1. `build-apk.yml`: Automatically builds a signed or unsigned debug Android APK using Capacitor and Android SDK 36.
2. `deploy.yml`: Deploys the web application to GitHub Pages.

## How to enable them on GitHub:
Once pushed to your GitHub repository:
1. Go to your repository on GitHub.
2. Click **Add file** -> **Create new file**.
3. Name it `.github/workflows/build-apk.yml` and paste the contents of `ci-workflows/build-apk.yml`.
4. Name it `.github/workflows/deploy.yml` and paste the contents of `ci-workflows/deploy.yml`.
5. Commit directly on GitHub.

### Critical: Configure GitHub Pages Source
Before running `deploy.yml`:
1. Go to repository **Settings** -> **Pages** (in the left sidebar).
2. Under **Build and deployment**, set **Source** to **GitHub Actions** (instead of "Deploy from a branch").
3. Click Save.
Now re-run the workflow or push, and it will deploy smoothly without `HttpError: Not Found`.
