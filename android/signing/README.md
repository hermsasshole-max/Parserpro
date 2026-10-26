# Google Play Console Signing Setup (`com.receiptscannerpro.app`)

## 1. Integrated Google Play App Signing Certificates (`play-store-certs/`)

Your uploaded Google Play Console App Signing certificates (`deployment_cert.der`, `hybrid_classical_cert.der`, and `hybrid_pqc_cert.der`) are installed in `android/signing/play-store-certs/` (in both `.der` and `.pem` formats) and linked to `public/.well-known/assetlinks.json` for `com.receiptscannerpro.app`:

- **Deployment Certificate (`deployment_cert.der`)**:
  - `SHA-1`: `AA:14:BE:52:28:F8:80:7C:13:DE:D0:86:F1:11:6A:0F:AE:93:17:4D`
  - `SHA-256`: `47:4A:47:3D:23:74:45:84:40:9F:FD:15:F5:E5:ED:FD:8E:C0:0A:27:67:6D:52:4F:41:D1:FA:3B:DC:A6:2E:19`
- **Hybrid Classical Certificate (`hybrid_classical_cert.der`)**:
  - `SHA-1`: `74:9C:E0:25:BD:DA:4E:CA:7D:83:3B:DE:57:E3:B4:E1:1F:79:0C:4B`
  - `SHA-256`: `16:F5:4D:1B:55:E1:99:46:9B:99:81:DE:A9:59:A7:FB:30:7F:37:83:47:62:FE:31:4A:A3:BB:06:46:9F:FF:9B`
- **Hybrid PQC Certificate (`hybrid_pqc_cert.der`)**:
  - `SHA-1`: `5E:FF:72:FD:93:ED:59:02:92:20:BF:31:BD:8A:1B:92:D8:56:7C:3B`
  - `SHA-256`: `E7:C0:F4:CF:9F:BF:55:48:6E:58:01:CC:56:59:49:D0:06:53:18:59:C4:17:66:5D:91:BD:0A:20:0D:8A:57:AA`

> **How Play App Signing works**: Google Play holds the private keys for the `.der` App Signing certificates on Google's servers to sign APKs delivered to end users. Your `.aab` bundle (`ParserPro-release.aab`) is signed with an **Upload Keystore** (`.jks` / `.p12`) when uploading to Play Console.

---

## 2. First Upload & Locking Your Upload Key on GitHub

1. Run **Build Release Android App Bundle (Play Console)** in GitHub Actions and download **`ParserPro-release.aab`** (1-click download from **GitHub Releases `v1.0-playstore-aab`**).
2. Upload **`ParserPro-release.aab`** to your new **`com.receiptscannerpro.app`** listing in Google Play Console. Google Play automatically registers this bundle's signing key as your Upload Key.
3. **Important — Save the Upload Key for Future Updates**:
   - At the bottom of that same GitHub Actions run page, download **`PlayConsole-Upload-Keystore-Backup-SAVE-THIS`**.
   - Open `GITHUB_SECRETS_SETUP.txt` and add the 4 secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) in **GitHub → Settings → Secrets and variables → Actions** so all future updates sign with the exact same Upload Key.
   - *(Alternatively, if you already have your own `.jks` / `.keystore` upload key, add `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEYSTORE_PASSWORD` to GitHub Secrets before uploading your first `.aab`.)*

---

## 3. Native Debug Symbols (`native-debug-symbols.zip`)

- **Automatic in New `.aab` Builds**: `ndk.debugSymbolLevel = 'FULL'` is enabled in `android/app/build.gradle`, so new `ParserPro-release.aab` builds automatically embed native debug symbols inside `BUNDLE-METADATA/com.android.tools.build.debugsymbols/`.
- **Standalone `.zip` Upload (for Existing Bundles)**: `android/signing/native-debug-symbols.zip` (and the 1-click `native-debug-symbols.zip` download on GitHub Releases `v1.0-playstore-aab`) contains the ABI-rooted native symbol libraries (`arm64-v8a/`, `armeabi-v7a/`, `x86/`, `x86_64/`). Upload it in **Google Play Console → App bundle explorer → Downloads → Native debug symbols** (or via the `⋮` menu next to your bundle on the release page → **Upload native debug symbols (.zip)**).

---

## 4. R8 DEX Code Optimization & Deobfuscation Mapping (`mapping.txt`)

- **Enabled in `android/app/build.gradle` & `android/gradle.properties`**:
  - `minifyEnabled true` + `shrinkResources true`
  - `proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'`
  - `android.enableR8.fullMode=true`
- **Capacitor-Safe ProGuard Rules (`android/app/proguard-rules.pro`)**: Preserves `SourceFile,LineNumberTable` for readable Play Console stack traces while keeping Capacitor WebView `@JavascriptInterface` bridges, `@CapacitorPlugin` / `@PluginMethod` classes (`CameraPlugin`, `FilesystemPlugin`, `SharePlugin`), `io.ionic.libs.**`, and `Gson` TypeTokens intact.
- **Automatic Deobfuscation in Play Console**: Because DEX optimization compiles directly into the `.dex` files inside `ParserPro-release.aab`, build a fresh `ParserPro-release.aab` via **Build Release Android App Bundle (Play Console)** and upload it to Play Console. The R8 mapping file is automatically embedded at `BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map` and also published standalone as **`mapping.txt`** on GitHub Releases (`v1.0-playstore-aab`).
