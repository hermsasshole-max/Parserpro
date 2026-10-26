# Google Play Console Upload Keystore Setup (`com.cortech.praiserpro`)

Google Play Console expects `com.cortech.praiserpro` bundles to be signed with the upload certificate matching:
`SHA1: 4A:C2:38:3A:F5:41:99:5E:99:FD:CC:CD:E5:BC:F7:C8:2A:52:DC:3B`

Choose **Option A** if you still have that `.jks` / `.keystore` file, or **Option B** if you no longer have it.

---

## Option A: You HAVE the `.jks` / `.keystore` file (`4A:C2:38:...`)

### Easiest Way 1 — GitHub Secrets (Recommended for Public & Private Repos)
1. Convert your keystore file to Base64:
   - **Windows PowerShell**: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\your-key.jks")) | Set-Clipboard`
   - **macOS**: `base64 -i /path/to/your-key.jks | tr -d '\n' | pbcopy`
   - **Linux**: `base64 -w 0 /path/to/your-key.jks`
2. In your GitHub repo, open **Settings → Secrets and variables → Actions** and add:
   - `ANDROID_KEYSTORE_BASE64`: *(paste the Base64 string)*
   - `ANDROID_KEYSTORE_PASSWORD`: *(your keystore password)*
   - `ANDROID_KEY_ALIAS` *(optional — auto-detected if omitted!)*
   - `ANDROID_KEY_PASSWORD` *(optional — defaults to `ANDROID_KEYSTORE_PASSWORD` if omitted!)*
3. Re-run **Build Release Android App Bundle (Play Console)**.

### Easiest Way 2 — Direct File Upload on GitHub (Private Repos Only, Zero Base64 Needed)
1. Ensure your GitHub repository visibility is **Private**.
2. On GitHub, open this `android/signing/` folder, click **Add file → Upload files**, and upload your `.jks`, `.keystore`, or `.p12` file directly here.
3. In **Settings → Secrets and variables → Actions**, add:
   - `ANDROID_KEYSTORE_PASSWORD`: *(your keystore password)*
   - *(Optional)* `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` if different from the keystore password.
4. Re-run **Build Release Android App Bundle (Play Console)**.

---

## Option B: You LOST the old `4A:C2:38:...` keystore file

Google Play Console lets you replace a lost upload key in 3 quick steps:
1. Open your latest **Build Release Android App Bundle (Play Console)** run in GitHub Actions, download the **`PlayConsole-Upload-Keystore-Backup-SAVE-THIS`** artifact at the bottom of the page, and add the 4 secrets inside `GITHUB_SECRETS_SETUP.txt` (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`) to **Settings → Secrets and variables → Actions** so all future builds permanently use the new key.
2. Re-run the workflow once and download **`upload_certificate.pem`** (1-click download from **GitHub Releases `v1.0-playstore-aab`** or inside the backup zip).
3. In **Google Play Console → Test and release → Setup → App signing** (under *Upload key certificate*), click **Request upload key reset**, choose **"I lost my upload key"**, and upload **`upload_certificate.pem`**. Once Google Play activates the reset, upload `ParserPro-release.aab`.
