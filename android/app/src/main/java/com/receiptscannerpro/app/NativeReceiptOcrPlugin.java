package com.receiptscannerpro.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.graphics.Point;
import android.graphics.Rect;
import android.media.ExifInterface;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Bundled Google ML Kit On-Device Receipt OCR Plugin for Android.
 * Features:
 *  - EXIF rotation normalization
 *  - Full 2D bounding-box + 4-corner local baseline slope extraction (for folded/curled paper de-warping)
 *  - Dual-Pass Native Shadow-Flattened OCR (removes dark fold creases & cylindrical roll shading)
 */
@CapacitorPlugin(name = "NativeReceiptOcr")
public class NativeReceiptOcrPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private TextRecognizer recognizer;

    @Override
    public void load() {
        super.load();
        try {
            recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        } catch (Exception ignored) {
            recognizer = null;
        }
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", getOrCreateRecognizer() != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void recognizeReceipt(PluginCall call) {
        final String base64Input = call.getString("imageBase64", "");
        if (base64Input == null || base64Input.trim().isEmpty()) {
            call.reject("Missing imageBase64 payload");
            return;
        }

        executor.execute(() -> {
            Bitmap originalBitmap = null;
            Bitmap flattenedBitmap = null;
            try {
                TextRecognizer client = getOrCreateRecognizer();
                if (client == null) {
                    call.reject("Native ML Kit recognizer unavailable on this device");
                    return;
                }

                String cleanB64 = base64Input.trim();
                int commaIdx = cleanB64.indexOf(',');
                if (commaIdx != -1 && cleanB64.startsWith("data:")) {
                    cleanB64 = cleanB64.substring(commaIdx + 1);
                }

                byte[] decoded = Base64.decode(cleanB64, Base64.DEFAULT);
                if (decoded == null || decoded.length == 0) {
                    call.reject("Failed to decode receipt image bytes");
                    return;
                }

                originalBitmap = decodeOrientedBitmap(decoded, 2400);
                if (originalBitmap == null) {
                    call.reject("Could not decode receipt bitmap");
                    return;
                }

                // Pass 1: Crisp original bitmap
                Text primaryVision = runMlKitSync(client, originalBitmap, 10000);

                // Pass 2: Adaptive shadow-flattened bitmap (recovers faint thermal text inside dark folds & curls)
                Text enhancedVision = null;
                try {
                    flattenedBitmap = createShadowFlattenedBitmap(originalBitmap);
                    if (flattenedBitmap != null) {
                        enhancedVision = runMlKitSync(client, flattenedBitmap, 10000);
                    }
                } catch (Throwable ignored) {
                    // Graceful fallback to primary pass if low memory
                }

                if (primaryVision == null && enhancedVision == null) {
                    call.reject("ML Kit receipt recognition failed");
                    return;
                }

                Text mainVision = primaryVision != null ? primaryVision : enhancedVision;
                int imgW = originalBitmap.getWidth();
                int imgH = originalBitmap.getHeight();

                JSObject primaryPage = mainVision != null
                        ? buildSpatialPageJson(mainVision, imgW, imgH)
                        : null;
                JSObject enhancedPage = enhancedVision != null
                        ? buildSpatialPageJson(enhancedVision, imgW, imgH)
                        : null;

                String bestText = primaryPage != null ? primaryPage.optString("text", "") : "";
                String rawText = mainVision != null && mainVision.getText() != null ? mainVision.getText() : "";
                if (bestText.trim().isEmpty() && enhancedPage != null) {
                    bestText = enhancedPage.optString("text", "");
                }
                if (bestText.trim().isEmpty()) {
                    bestText = rawText;
                }

                JSObject result = new JSObject();
                result.put("text", bestText);
                result.put("rawText", rawText);
                result.put("engine", "native_mlkit");
                if (primaryPage != null) {
                    result.put("primary", primaryPage);
                }
                if (enhancedPage != null) {
                    result.put("enhanced", enhancedPage);
                }

                JSArray blocksArr = new JSArray();
                if (mainVision != null) {
                    for (Text.TextBlock block : mainVision.getTextBlocks()) {
                        blocksArr.put(block.getText());
                    }
                }
                result.put("blocks", blocksArr);
                call.resolve(result);
            } catch (Exception ex) {
                call.reject(ex.getMessage() != null ? ex.getMessage() : "Unexpected native OCR failure");
            } finally {
                try {
                    if (flattenedBitmap != null && !flattenedBitmap.isRecycled()) {
                        flattenedBitmap.recycle();
                    }
                } catch (Exception ignored) {
                }
                try {
                    if (originalBitmap != null && !originalBitmap.isRecycled()) {
                        originalBitmap.recycle();
                    }
                } catch (Exception ignored) {
                }
            }
        });
    }

    private static Text runMlKitSync(TextRecognizer client, Bitmap bitmap, long timeoutMs) {
        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicReference<Text> outRef = new AtomicReference<>(null);
        InputImage image = InputImage.fromBitmap(bitmap, 0);
        client.process(image)
                .addOnSuccessListener(text -> {
                    outRef.set(text);
                    latch.countDown();
                })
                .addOnFailureListener(err -> latch.countDown());
        try {
            latch.await(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        return outRef.get();
    }

    private synchronized TextRecognizer getOrCreateRecognizer() {
        if (recognizer == null) {
            try {
                recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
            } catch (Exception ignored) {
                return null;
            }
        }
        return recognizer;
    }

    private static Bitmap decodeOrientedBitmap(byte[] bytes, int maxDim) {
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);

        int inSampleSize = 1;
        int w = bounds.outWidth;
        int h = bounds.outHeight;
        if (w > 0 && h > 0) {
            while ((w / inSampleSize) > maxDim * 2 || (h / inSampleSize) > maxDim * 2) {
                inSampleSize *= 2;
            }
        }

        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = inSampleSize;
        opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
        Bitmap decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
        if (decoded == null) return null;

        int rotationDegrees = 0;
        try {
            ExifInterface exif = new ExifInterface(new ByteArrayInputStream(bytes));
            int orientation = exif.getAttributeInt(
                    ExifInterface.TAG_ORIENTATION,
                    ExifInterface.ORIENTATION_NORMAL
            );
            if (orientation == ExifInterface.ORIENTATION_ROTATE_90) {
                rotationDegrees = 90;
            } else if (orientation == ExifInterface.ORIENTATION_ROTATE_180) {
                rotationDegrees = 180;
            } else if (orientation == ExifInterface.ORIENTATION_ROTATE_270) {
                rotationDegrees = 270;
            }
        } catch (Exception ignored) {
        }

        if (rotationDegrees != 0) {
            Matrix matrix = new Matrix();
            matrix.postRotate(rotationDegrees);
            Bitmap rotated = Bitmap.createBitmap(
                    decoded, 0, 0, decoded.getWidth(), decoded.getHeight(), matrix, true
            );
            if (rotated != decoded) {
                decoded.recycle();
            }
            return rotated;
        }
        return decoded;
    }

    /**
     * Fast O(W*H) integral-image illumination normalizer that flattens dark shadows inside
     * receipt folds/creases and uneven cylindrical curl lighting.
     */
    private static Bitmap createShadowFlattenedBitmap(Bitmap src) {
        int w = src.getWidth();
        int h = src.getHeight();
        if (w <= 0 || h <= 0 || (long) w * (long) h > 6_500_000L) {
            return null;
        }

        int total = w * h;
        int[] pixels = new int[total];
        src.getPixels(pixels, 0, w, 0, 0, w, h);

        int[] lum = new int[total];
        for (int i = 0; i < total; i++) {
            int c = pixels[i];
            int r = (c >> 16) & 0xFF;
            int g = (c >> 8) & 0xFF;
            int b = c & 0xFF;
            lum[i] = (r * 77 + g * 150 + b * 29) >> 8;
        }

        int stride = w + 1;
        long[] integral = new long[(w + 1) * (h + 1)];
        for (int y = 1; y <= h; y++) {
            long rowSum = 0;
            int srcOff = (y - 1) * w;
            int curRow = y * stride;
            int prevRow = (y - 1) * stride;
            for (int x = 1; x <= w; x++) {
                rowSum += lum[srcOff + x - 1];
                integral[curRow + x] = integral[prevRow + x] + rowSum;
            }
        }

        int radius = Math.max(18, Math.min(w, h) / 26);
        for (int y = 0; y < h; y++) {
            int y0 = Math.max(0, y - radius);
            int y1 = Math.min(h, y + radius + 1);
            int r0 = y0 * stride;
            int r1 = y1 * stride;
            int rowOff = y * w;

            for (int x = 0; x < w; x++) {
                int x0 = Math.max(0, x - radius);
                int x1 = Math.min(w, x + radius + 1);
                long area = (long) (x1 - x0) * (long) (y1 - y0);
                long sum = integral[r1 + x1] - integral[r0 + x1] - integral[r1 + x0] + integral[r0 + x0];
                float localBg = Math.max(38f, (float) sum / (float) area);
                float norm = ((float) lum[rowOff + x] / localBg) * 248f;
                int v;
                if (norm < 206f) {
                    v = Math.round(206f - (206f - norm) * 1.65f);
                } else {
                    v = Math.round(255f - (255f - norm) * 0.25f);
                }
                if (v < 0) v = 0;
                else if (v > 255) v = 255;
                pixels[rowOff + x] = 0xFF000000 | (v << 16) | (v << 8) | v;
            }
        }

        Bitmap out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        out.setPixels(pixels, 0, w, 0, 0, w, h);
        return out;
    }

    private static float computeCornerSlope(Point[] corners) {
        if (corners == null || corners.length < 4) return 0f;
        float dxTop = (float) (corners[1].x - corners[0].x);
        float dyTop = (float) (corners[1].y - corners[0].y);
        float dxBot = (float) (corners[2].x - corners[3].x);
        float dyBot = (float) (corners[2].y - corners[3].y);
        float dx = dxTop + dxBot;
        if (Math.abs(dx) < 8f) return 0f;
        float slope = (dyTop + dyBot) / dx;
        if (slope < -0.4f || slope > 0.4f) return 0f;
        return slope;
    }

    private static JSObject buildSpatialPageJson(Text visionText, int imgWidth, int imgHeight) {
        JSObject page = new JSObject();
        page.put("width", imgWidth);
        page.put("height", imgHeight);

        JSArray linesArr = new JSArray();
        JSArray elementsArr = new JSArray();

        for (Text.TextBlock block : visionText.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                String lt = line.getText() != null ? line.getText().trim() : "";
                Rect lBox = line.getBoundingBox();
                float lSlope = computeCornerSlope(line.getCornerPoints());
                if (!lt.isEmpty() && lBox != null) {
                    JSObject lObj = new JSObject();
                    lObj.put("text", lt);
                    lObj.put("left", lBox.left);
                    lObj.put("top", lBox.top);
                    lObj.put("right", lBox.right);
                    lObj.put("bottom", lBox.bottom);
                    lObj.put("slope", lSlope);
                    linesArr.put(lObj);
                }

                for (Text.Element el : line.getElements()) {
                    String et = el.getText() != null ? el.getText().trim() : "";
                    Rect eBox = el.getBoundingBox();
                    if (!et.isEmpty() && eBox != null) {
                        float eSlope = computeCornerSlope(el.getCornerPoints());
                        JSObject eObj = new JSObject();
                        eObj.put("text", et);
                        eObj.put("left", eBox.left);
                        eObj.put("top", eBox.top);
                        eObj.put("right", eBox.right);
                        eObj.put("bottom", eBox.bottom);
                        eObj.put("slope", eSlope != 0f ? eSlope : lSlope);
                        elementsArr.put(eObj);
                    }
                }
            }
        }

        String reconstructed = reconstructSlopeAwareRows(visionText, imgWidth);
        String raw = visionText.getText() != null ? visionText.getText() : "";
        page.put("text", !reconstructed.trim().isEmpty() ? reconstructed : raw);
        page.put("rawText", raw);
        page.put("lines", linesArr);
        page.put("elements", elementsArr);
        return page;
    }

    private static class PositionedLine {
        final String text;
        final float centerX;
        final float centerY;
        final float height;
        final int left;
        final int right;
        final float slope;
        float rectifiedY;

        PositionedLine(String text, Rect box, float slope) {
            this.text = text;
            this.left = box.left;
            this.right = box.right;
            this.centerX = (box.left + box.right) * 0.5f;
            this.centerY = (box.top + box.bottom) * 0.5f;
            this.height = Math.max(8f, (float) (box.bottom - box.top));
            this.slope = slope;
            this.rectifiedY = this.centerY;
        }
    }

    /**
     * Slope-aware row reconstruction fallback inside native Java using local baseline angles.
     */
    private static String reconstructSlopeAwareRows(Text visionText, int imgWidth) {
        if (visionText == null) return "";

        List<PositionedLine> allLines = new ArrayList<>();
        float weightedSlopeSum = 0f;
        float slopeWeight = 0f;

        for (Text.TextBlock block : visionText.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                String txt = line.getText() != null ? line.getText().trim() : "";
                Rect box = line.getBoundingBox();
                if (!txt.isEmpty() && box != null) {
                    float s = computeCornerSlope(line.getCornerPoints());
                    PositionedLine pl = new PositionedLine(txt, box, s);
                    allLines.add(pl);
                    float w = (float) (box.right - box.left);
                    if (w >= imgWidth * 0.14f) {
                        weightedSlopeSum += s * w;
                        slopeWeight += w;
                    }
                }
            }
        }

        if (allLines.isEmpty()) {
            return visionText.getText() != null ? visionText.getText() : "";
        }

        float globalSlope = slopeWeight > 1f ? (weightedSlopeSum / slopeWeight) : 0f;
        float xRef = imgWidth * 0.25f;
        for (PositionedLine pl : allLines) {
            float localS = (pl.right - pl.left >= imgWidth * 0.2f && pl.slope != 0f)
                    ? (pl.slope * 0.6f + globalSlope * 0.4f)
                    : globalSlope;
            pl.rectifiedY = pl.centerY - localS * (pl.centerX - xRef);
        }

        Collections.sort(allLines, Comparator.comparingDouble(a -> a.rectifiedY));

        List<List<PositionedLine>> rows = new ArrayList<>();
        for (PositionedLine item : allLines) {
            List<PositionedLine> matchedRow = null;
            for (int i = rows.size() - 1; i >= Math.max(0, rows.size() - 4); i--) {
                List<PositionedLine> candidateRow = rows.get(i);
                float sumY = 0f;
                float sumH = 0f;
                for (PositionedLine pl : candidateRow) {
                    sumY += pl.rectifiedY;
                    sumH += pl.height;
                }
                float avgY = sumY / candidateRow.size();
                float avgH = sumH / candidateRow.size();
                float tolerance = Math.max(avgH, item.height) * 0.68f;
                if (Math.abs(item.rectifiedY - avgY) <= tolerance) {
                    matchedRow = candidateRow;
                    break;
                }
            }
            if (matchedRow != null) {
                matchedRow.add(item);
            } else {
                List<PositionedLine> newRow = new ArrayList<>();
                newRow.add(item);
                rows.add(newRow);
            }
        }

        StringBuilder sb = new StringBuilder();
        for (List<PositionedLine> row : rows) {
            Collections.sort(row, Comparator.comparingInt(a -> a.left));
            if (sb.length() > 0) {
                sb.append('\n');
            }
            for (int i = 0; i < row.size(); i++) {
                if (i > 0) {
                    sb.append("   ");
                }
                sb.append(row.get(i).text);
            }
        }
        return sb.toString();
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        try {
            if (recognizer != null) {
                recognizer.close();
                recognizer = null;
            }
        } catch (Exception ignored) {
        }
        executor.shutdownNow();
    }
}
