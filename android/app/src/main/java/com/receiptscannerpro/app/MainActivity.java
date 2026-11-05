package com.receiptscannerpro.app;

import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;
import java.io.File;

public class MainActivity extends BridgeActivity {
    private static final String PREFS_NAME = "parserpro_app_update_prefs";
    private static final String KEY_LAST_VERSION_CODE = "last_installed_version_code";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        boolean didAppUpdate = purgeStaleWebViewServiceWorkersBeforeBoot();

        registerPlugin(NativeReceiptOcrPlugin.class);
        registerPlugin(PlayBillingPlugin.class);
        super.onCreate(savedInstanceState);

        configureWebViewAfterBoot(didAppUpdate);

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

    /**
     * Runs BEFORE super.onCreate() (before Chromium opens app_webview) whenever the installed
     * Play Store / APK versionCode changes. Deletes ONLY stale Service Worker & HTTP/bytecode
     * cache folders while keeping Local Storage and IndexedDB user receipts 100% intact.
     */
    @SuppressWarnings("deprecation")
    private boolean purgeStaleWebViewServiceWorkersBeforeBoot() {
        try {
            PackageInfo pkgInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            long currentVersionCode = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                ? pkgInfo.getLongVersionCode()
                : pkgInfo.versionCode;

            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            long previousVersionCode = prefs.getLong(KEY_LAST_VERSION_CODE, -1L);

            if (previousVersionCode != currentVersionCode) {
                File dataDir = new File(getApplicationInfo().dataDir);
                File appWebViewDir = new File(dataDir, "app_webview");
                File defaultProfileDir = new File(appWebViewDir, "Default");

                // Delete ONLY Service Worker, CacheStorage, HTTP Cache, and V8 Code Cache
                // NEVER delete "Local Storage" or "IndexedDB" where receipts & settings live
                String[] safeToPurgeSubdirs = new String[] {
                    "Service Worker",
                    "CacheStorage",
                    "Cache",
                    "Code Cache",
                    "GPUCache"
                };

                for (String sub : safeToPurgeSubdirs) {
                    deleteRecursively(new File(appWebViewDir, sub));
                    deleteRecursively(new File(defaultProfileDir, sub));
                }

                deleteDirectoryContents(getCacheDir());
                deleteDirectoryContents(getCodeCacheDir());

                prefs.edit().putLong(KEY_LAST_VERSION_CODE, currentVersionCode).commit();
                return true;
            }
        } catch (Exception ignored) {
            // Non-fatal safeguard
        }
        return false;
    }

    @SuppressWarnings("deprecation")
    private void configureWebViewAfterBoot(boolean didAppUpdate) {
        try {
            if (getBridge() == null) return;
            final WebView webView = getBridge().getWebView();
            if (webView == null) return;

            WebSettings settings = webView.getSettings();
            if (settings != null) {
                // Ensure packaged local assets always load directly from the updated APK without reading stale HTTP disk cache
                settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            }

            PackageInfo pkgInfo = getPackageManager().getPackageInfo(getPackageName(), 0);
            final long currentVersionCode = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
                ? pkgInfo.getLongVersionCode()
                : pkgInfo.versionCode;
            final String currentVersionName = pkgInfo.versionName != null
                ? pkgInfo.versionName.replace("'", "")
                : "1.8.0";

            // Unconditionally evict memory/disk webview cache to prevent stale chunk execution
            webView.clearCache(true);

            webView.postDelayed(() -> {
                try {
                    StringBuilder js = new StringBuilder();
                    js.append("(function(){try{");
                    js.append("window.__PARSERPRO_NATIVE_VERSION__={versionName:'")
                        .append(currentVersionName)
                        .append("',versionCode:")
                        .append(currentVersionCode)
                        .append("};");
                    js.append("window.dispatchEvent(new CustomEvent('parserpro-native-version'));");
                    if (didAppUpdate) {
                        js.append("if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(function(r){r.forEach(function(x){x.unregister();});});}");
                        js.append("if('caches' in window){caches.keys().then(function(k){k.forEach(function(c){caches.delete(c);});});}");
                    }
                    js.append("}catch(e){}})();");
                    webView.evaluateJavascript(js.toString(), null);
                } catch (Exception ignored) {}
            }, 350);
        } catch (Exception ignored) {
            // Non-fatal safeguard
        }
    }

    private void deleteDirectoryContents(File dir) {
        if (dir == null || !dir.exists() || !dir.isDirectory()) return;
        File[] children = dir.listFiles();
        if (children == null) return;
        for (File child : children) {
            deleteRecursively(child);
        }
    }

    private void deleteRecursively(File target) {
        if (target == null || !target.exists()) return;
        if (target.isDirectory()) {
            File[] children = target.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursively(child);
                }
            }
        }
        //noinspection ResultOfMethodCallIgnored
        target.delete();
    }
}

