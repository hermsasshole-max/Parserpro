package com.receiptscannerpro.app;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "parserpro_app_update_prefs";
    private static final String KEY_LAST_VERSION_CODE = "last_installed_version_code";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeReceiptOcrPlugin.class);
        registerPlugin(PlayBillingPlugin.class);
        super.onCreate(savedInstanceState);

        refreshWebViewCacheOnAppUpdate();

        // Defensive fallback: if any OEM ROM leaves system/navigation bar insets unconsumed
        // after Capacitor's DecorView listener, apply them to android.R.id.content so bottom
        // app controls never sit underneath Back / Home / Recents buttons.
        final View contentView = findViewById(android.R.id.content);
        if (contentView != null) {
            ViewCompat.setOnApplyWindowInsetsListener(contentView, (v, windowInsets) -> {
                Insets bars = windowInsets.getInsets(
                    WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                );
                v.setPadding(bars.left, bars.top, bars.right, bars.bottom);
                return new WindowInsetsCompat.Builder(windowInsets)
                    .setInsets(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout(),
                        Insets.of(0, 0, 0, 0)
                    )
                    .build();
            });
            ViewCompat.requestApplyInsets(contentView);
        }
    }

    @SuppressWarnings("deprecation")
    private void refreshWebViewCacheOnAppUpdate() {
        try {
            PackageInfo pkgInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            long currentVersionCode = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                ? pkgInfo.getLongVersionCode()
                : pkgInfo.versionCode;

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            long previousVersionCode = prefs.getLong(KEY_LAST_VERSION_CODE, -1L);

            if (previousVersionCode != currentVersionCode) {
                if (getBridge() != null) {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        // Clears HTTP/disk asset cache only — preserves localStorage & IndexedDB user receipts
                        webView.clearCache(true);
                    }
                }
                prefs.edit().putLong(KEY_LAST_VERSION_CODE, currentVersionCode).apply();
            }
        } catch (Exception ignored) {
            // Non-fatal safeguard
        }
    }
}

