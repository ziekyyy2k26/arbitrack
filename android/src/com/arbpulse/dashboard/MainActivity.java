package com.arbpulse.dashboard;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.res.AssetManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_ORIGIN = "https://" + APP_HOST;
    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            getWindow().setStatusBarColor(Color.parseColor("#0F172A"));
        }

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        webView.setBackgroundColor(Color.parseColor("#F8FAFC"));
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        }

        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new LocalAssetWebViewClient(getAssets()));

        setContentView(webView);

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(APP_ORIGIN + "/index.html");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public boolean saveFile(final String filename, final String mimeType, final String content) {
            try {
                final String safeName = filename.replaceAll("[^a-zA-Z0-9._-]", "_");
                final String cleanMime = (mimeType != null && !mimeType.isEmpty())
                        ? mimeType.split(";")[0].trim()
                        : "text/csv";
                final byte[] bytes = content.getBytes(StandardCharsets.UTF_8);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentResolver resolver = getContentResolver();
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                    values.put(MediaStore.Downloads.MIME_TYPE, cleanMime);
                    values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                    Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri == null) {
                        return false;
                    }
                    try (OutputStream out = resolver.openOutputStream(uri)) {
                        if (out == null) return false;
                        out.write(bytes);
                        out.flush();
                    }
                } else {
                    File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (dir == null) dir = getFilesDir();
                    if (!dir.exists()) dir.mkdirs();
                    File outFile = new File(dir, safeName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(bytes);
                        fos.flush();
                    }
                }

                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        Toast.makeText(
                                MainActivity.this,
                                "Saved to Downloads/" + safeName,
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                });
                return true;
            } catch (Exception e) {
                return false;
            }
        }
    }

    private static final class LocalAssetWebViewClient extends WebViewClient {
        private final AssetManager assets;

        LocalAssetWebViewClient(AssetManager assets) {
            this.assets = assets;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri != null && APP_HOST.equalsIgnoreCase(uri.getHost())) {
                return false;
            }
            return false;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (uri == null || !APP_HOST.equalsIgnoreCase(uri.getHost())) {
                return super.shouldInterceptRequest(view, request);
            }

            String reqPath = uri.getPath();
            if (reqPath == null || reqPath.isEmpty() || "/".equals(reqPath)) {
                reqPath = "/index.html";
            }

            // Let /api/* return 404 JSON so standalone client-side engine activates cleanly
            if (reqPath.startsWith("/api/")) {
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-store");
                return new WebResourceResponse(
                        "application/json",
                        "UTF-8",
                        404,
                        "Not Found",
                        headers,
                        new ByteArrayInputStream("{\"standalone\":true}".getBytes(StandardCharsets.UTF_8))
                );
            }

            String assetRel = reqPath.startsWith("/") ? reqPath.substring(1) : reqPath;
            InputStream stream = openAssetOrSpaFallback(assetRel);
            if (stream == null) {
                return new WebResourceResponse(
                        "text/plain",
                        "UTF-8",
                        404,
                        "Not Found",
                        null,
                        new ByteArrayInputStream(new byte[0])
                );
            }

            String effectivePath = assetExists("dist/" + assetRel) ? assetRel : "index.html";
            String mime = guessMimeType(effectivePath);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            headers.put("Cache-Control", effectivePath.startsWith("assets/") ? "public, max-age=31536000" : "no-cache");

            return new WebResourceResponse(mime, "UTF-8", 200, "OK", headers, stream);
        }

        private boolean assetExists(String path) {
            try (InputStream is = assets.open(path)) {
                return is != null;
            } catch (IOException e) {
                return false;
            }
        }

        private InputStream openAssetOrSpaFallback(String assetRel) {
            try {
                return assets.open("dist/" + assetRel);
            } catch (IOException ignored) {
                if (!assetRel.contains(".")) {
                    try {
                        return assets.open("dist/index.html");
                    } catch (IOException ignored2) {
                        return null;
                    }
                }
                return null;
            }
        }

        private static String guessMimeType(String path) {
            String lower = path.toLowerCase(Locale.US);
            if (lower.endsWith(".html")) return "text/html";
            if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
            if (lower.endsWith(".css")) return "text/css";
            if (lower.endsWith(".svg")) return "image/svg+xml";
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".json")) return "application/json";
            if (lower.endsWith(".woff2")) return "font/woff2";
            return "application/octet-stream";
        }
    }
}
