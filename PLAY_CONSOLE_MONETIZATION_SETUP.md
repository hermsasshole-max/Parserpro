# Google Play Console Monetization Setup (`com.receiptscannerpro.app`)

ParserPro (`v1.5.0`, `versionCode 230+`) embeds **Google Play Billing Library `8.3.0`** and `<uses-permission android:name="com.android.vending.BILLING" />` with native Capacitor bridge `PlayBillingPlugin.java`.

---

## 1. Upload `ParserPro-release-v230.aab` First
Google Play Console unlocks **Monetize with Play → Products → Subscriptions** as soon as a signed `.aab` containing `com.android.vending.BILLING` and Billing Library v8 is uploaded to an Internal, Closed, or Production track:
1. Push/sync to GitHub and wait for **Build Release Android App Bundle (Play Console)** to finish.
2. Download **`ParserPro-release-v230.aab`** from **GitHub Releases (`v1.0-playstore-aab`)**.
3. Upload **`ParserPro-release-v230.aab`** to **Testing → Internal testing** (save draft or roll out).

---

## 2. Create Your 2 Monthly Subscriptions in Play Console
In Google Play Console, go to **Monetize with Play → Products → Subscriptions** (ensure your Merchant / Payments profile is linked under **Setup → Payments profile**), and create these exact two Product IDs:

### Subscription 1 — Mid Tier (`$1.99 / month`)
- **Product ID**: `parserpro_mid_monthly`
- **Name**: `ParserPro Mid Tier`
- **Description**: `75 automatic receipt scans/month, up to 3-photo batch scanning, all 5 category budgets, full A–Z monthly item price variance, and Monthly PDF Statements.`
- **Base Plan**:
  - **Base plan ID**: `mid-monthly`
  - **Type**: Auto-renewing (`Monthly`)
  - **Grace period**: `3 days` (recommended)
  - **Price**: **`$1.99 USD`** -> Click **Update exchange rates** to auto-convert across all countries -> **Save** -> **Activate**.

### Subscription 2 — Full Package (`$3.99 / month`)
- **Product ID**: `parserpro_full_monthly`
- **Name**: `ParserPro Full Package`
- **Description**: `Unlimited receipt scans & stack batching, 6-month interactive spending chart, unlimited A–Z month-to-month comparisons, Excel/CSV exports, and full device backups.`
- **Base Plan**:
  - **Base plan ID**: `full-monthly`
  - **Type**: Auto-renewing (`Monthly`)
  - **Grace period**: `3 days` (recommended)
  - **Price**: **`$3.99 USD`** -> Click **Update exchange rates** -> **Save** -> **Activate**.
- **Optional Free Trial Offer** *(supported automatically by the app)*:
  - Under `full-monthly`, click **Add offer** -> Offer ID: `trial-7d` -> Eligibility: `New customer acquisition` -> Phase: **Free trial (`7 days`)** -> **Save** -> **Activate**.

---

## 3. Complete 3-Tier Feature Unlock Matrix

| App Feature | Free (`$0/mo`) | Mid Tier (`$1.99/mo`) | Full Package (`$3.99/mo`) |
| :--- | :--- | :--- | :--- |
| **Automatic Photo Scans** | `12 / month` | `75 / month` | **Unlimited** |
| **Multi-Photo Batch Scanning** | `1 photo` | `Up to 3 photos` | **Unlimited stack** |
| **Manual Entry & Duplicate Blocker** | Unlimited | Unlimited | Unlimited |
| **Active Monthly Category Budgets** | `Up to 2 categories` | **All 5 categories** | **All 5 categories** |
| **Monthly Item Frequency & Variance** | `Top 5 items` | **Full A–Z + history** | **Full A–Z + history** |
| **PDF & Print Exports** | Single receipt | **+ Monthly Statement PDF** | **+ Month-Compare PDF** |
| **Month-to-Month Item Comparison** | `Top 5 items` | `Top 12 items` | **Unlimited A–Z** |
| **6-Month Interactive Spending Chart** | Summary average | Summary average | **Full interactive chart** |
| **Excel / CSV Spreadsheet Exports** | — | — | **Monthly, Compare & All-Time** |
| **Device `.json` Backups & Snapshots** | Restore free | Restore free | **Save backups & snapshots** |

---

## 4. License Testing Without Real Charges
1. Go to **Play Console → Setup → License testing**.
2. Add your Gmail address to **License testers** and set **License response** to `RESPOND_NORMALLY`.
3. Install from your Internal Testing opt-in link and test subscribing to **Mid Tier (`$1.99/mo`)**, upgrading with automatic proration to **Full Package (`$3.99/mo`)**, and tapping **Restore Google Play Purchase** using Google Play's built-in **Test Card (always approves)**.
