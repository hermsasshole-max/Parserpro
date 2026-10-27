package com.receiptscannerpro.app;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Rect;
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

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Bundled Google ML Kit On-Device Receipt OCR Plugin for Android.
 * Works 100% offline with zero network latency and reconstructs horizontal
 * receipt rows (keeping left-aligned item names paired with right-aligned prices).
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

                Bitmap bitmap = decodeBoundedBitmap(decoded, 2400);
                if (bitmap == null) {
                    call.reject("Could not decode receipt bitmap");
                    return;
                }

                InputImage image = InputImage.fromBitmap(bitmap, 0);
                client.process(image)
                        .addOnSuccessListener(visionText -> {
                            try {
                                String reconstructed = reconstructReceiptRows(visionText);
                                String rawText = visionText.getText() != null ? visionText.getText() : "";
                                String bestText = !reconstructed.trim().isEmpty() ? reconstructed : rawText;

                                JSObject result = new JSObject();
                                result.put("text", bestText);
                                result.put("rawText", rawText);
                                result.put("engine", "native_mlkit");

                                JSArray blocksArr = new JSArray();
                                for (Text.TextBlock block : visionText.getTextBlocks()) {
                                    blocksArr.put(block.getText());
                                }
                                result.put("blocks", blocksArr);
                                call.resolve(result);
                            } finally {
                                try {
                                    if (!bitmap.isRecycled()) {
                                        bitmap.recycle();
                                    }
                                } catch (Exception ignored) {
                                }
                            }
                        })
                        .addOnFailureListener(err -> {
                            try {
                                if (!bitmap.isRecycled()) {
                                    bitmap.recycle();
                                }
                            } catch (Exception ignored) {
                            }
                            call.reject(err != null && err.getMessage() != null
                                    ? err.getMessage()
                                    : "ML Kit receipt recognition failed");
                        });
            } catch (Exception ex) {
                call.reject(ex.getMessage() != null ? ex.getMessage() : "Unexpected native OCR failure");
            }
        });
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

    private static Bitmap decodeBoundedBitmap(byte[] bytes, int maxDim) {
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
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
    }

    private static class PositionedLine {
        final String text;
        final float centerY;
        final float height;
        final int left;

        PositionedLine(String text, Rect box) {
            this.text = text;
            this.centerY = (box.top + box.bottom) * 0.5f;
            this.height = Math.max(8f, (float) (box.bottom - box.top));
            this.left = box.left;
        }
    }

    /**
     * Groups ML Kit Text.Lines that sit on the same horizontal receipt row (within ~55% line height)
     * and joins them left-to-right so item descriptions on the left stay paired with prices on the right.
     */
    private static String reconstructReceiptRows(Text visionText) {
        if (visionText == null) return "";

        List<PositionedLine> allLines = new ArrayList<>();
        for (Text.TextBlock block : visionText.getTextBlocks()) {
            for (Text.Line line : block.getLines()) {
                String txt = line.getText() != null ? line.getText().trim() : "";
                Rect box = line.getBoundingBox();
                if (!txt.isEmpty() && box != null) {
                    allLines.add(new PositionedLine(txt, box));
                }
            }
        }

        if (allLines.isEmpty()) {
            return visionText.getText() != null ? visionText.getText() : "";
        }

        Collections.sort(allLines, Comparator.comparingDouble(a -> a.centerY));

        List<List<PositionedLine>> rows = new ArrayList<>();
        for (PositionedLine item : allLines) {
            List<PositionedLine> matchedRow = null;
            for (int i = rows.size() - 1; i >= Math.max(0, rows.size() - 3); i--) {
                List<PositionedLine> candidateRow = rows.get(i);
                float sumY = 0f;
                float sumH = 0f;
                for (PositionedLine pl : candidateRow) {
                    sumY += pl.centerY;
                    sumH += pl.height;
                }
                float avgY = sumY / candidateRow.size();
                float avgH = sumH / candidateRow.size();
                float tolerance = Math.max(avgH, item.height) * 0.58f;
                if (Math.abs(item.centerY - avgY) <= tolerance) {
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
