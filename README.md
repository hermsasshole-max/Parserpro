# ParserPro

Household receipt wallet for Android. Scan a till slip, keep it on the phone, and see what is still returnable, which prices moved, and how the month is pacing against your limits.

Package id: `com.receiptscannerpro.app`

## Local web preview

1. `npm install`
2. Optional: set `GEMINI_API_KEY` for cloud OCR. Without it, Android uses on-device ML Kit and Tesseract.
3. `npm run dev`

## Play Console bundle

GitHub Actions workflow: `.github/workflows/bundle-release.yml`

It installs dependencies, builds the web app, runs `npx cap sync android`, then `gradle bundleRelease` with AGP 9.0.1. Version code stays at or above 3000 and increments from the GitHub run number.

Signing uses repository `android/signing/` or the `ANDROID_KEYSTORE_*` secrets. Keep the repository private if the upload keystore stays in the tree. Prefer GitHub Actions secrets for the keystore password.

Release build needs JDK 21 and Android SDK 36, which the workflow installs.

## Checks

- `npm test`
- `npm run typecheck`
- `npm run build`
