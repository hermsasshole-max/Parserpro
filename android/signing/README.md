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

> **How Play App Signing works**: Google Play holds the private keys for the `.der` App Signing certificates on Google's servers to sign APKs delivered to end users. Your `.aab` bundle (`ParserPro-release-v<versionCode>.aab`) is signed with an **Upload Keystore** (`.jks` / `.p12`) when uploading to Play Console.

---

## 2. Deterministic Upload Keystore & Automatic Play Console Key Recovery

Random per-build signing key generation has been permanently eliminated:

1. **Automatic Play Console Upload Key Recovery (`SHA-1: F5:BA:06:8E:1E:42:BC:00:0F:7F:80:C4:8E:81:42:F3:E9:...`)**:
   - During CI, `bundle-release.yml` automatically scans your repository's `PlayConsole-Upload-Keystore-Backup-SAVE-THIS` artifacts, locates the exact Upload Keystore registered with Google Play Console (`F5:BA:06:8E:...`), signs your new bundle (`versionCode >= 230`) with it, and refreshes the backup artifact's 90-day retention.
2. **Permanent Fallback Repository Upload Keystore (`android/signing/upload-keystore.p12`)**:
   - If running in a repository without prior artifacts or GitHub Secrets, builds always sign with the permanent committed `android/signing/upload-keystore.p12` (`SHA-1: 03:D0:5B:95:5C:87:A3:14:FE:4C:D3:1D:75:F2:7B:A5:68:3E:06:CE`) and `android/signing/upload_certificate.pem` (also served at `/upload_certificate.pem`) — never rotating keys between builds.
   - If you ever reset your Upload Key in **Play Console → Setup → App signing → Upload key certificate → Request upload key reset**, upload `upload_certificate.pem`.

---

## 3. Native Debug Symbols (`native-debug-symbols.zip`) & R8 DEX Optimization (`mapping.txt`)

- **Automatic Version Progression (`versionCode >= 230`)**: Every build automatically produces a single uniquely named **`ParserPro-release-v<versionCode>.aab`** (`versionCode >= 230`, strictly above all previously used Play Console versions including `152`, `204`, `215`, `216`, and `217`) on GitHub Releases (`v1.0-playstore-aab`, promoted to **Latest**) and cleans out older `.aab` files so you never accidentally upload an older bundle.
- **Before Uploading in Play Console**: Always tap **`✕`** next to any previously failed `.aab` rows sitting in Play Console's **Upload app bundles** list before uploading the new `ParserPro-release-v<versionCode>.aab`.
- **Embedded Optimization & Symbols**: `minifyEnabled true`, `shrinkResources true`, `proguard-android-optimize.txt` (`BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map`), and `ndk.debugSymbolLevel = 'FULL'` are embedded directly inside the `.aab`.
