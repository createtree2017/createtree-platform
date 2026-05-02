package com.createtree.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;

import java.io.OutputStream;
import java.util.Locale;

public class AndroidGalleryBridge {
    private final Context context;

    public AndroidGalleryBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public String saveImageToGallery(String base64Data, String filename, String mimeType) {
        Uri uri = null;

        try {
            byte[] imageBytes = Base64.decode(base64Data, Base64.DEFAULT);
            String safeMimeType = normalizeMimeType(mimeType);
            String safeFilename = normalizeFilename(filename, safeMimeType);

            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, safeFilename);
            values.put(MediaStore.Images.Media.MIME_TYPE, safeMimeType);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/AI문화센터");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                throw new IllegalStateException("갤러리 저장 위치를 만들 수 없습니다.");
            }

            try (OutputStream outputStream = resolver.openOutputStream(uri)) {
                if (outputStream == null) {
                    throw new IllegalStateException("이미지 저장 스트림을 열 수 없습니다.");
                }

                outputStream.write(imageBytes);
                outputStream.flush();
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues publishedValues = new ContentValues();
                publishedValues.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, publishedValues, null, null);
            }

            return "{\"success\":true,\"message\":\"갤러리에 저장되었습니다.\"}";
        } catch (Exception error) {
            if (uri != null) {
                context.getContentResolver().delete(uri, null, null);
            }

            return "{\"success\":false,\"message\":\"" + escapeJson(error.getMessage()) + "\"}";
        }
    }

    private String normalizeMimeType(String mimeType) {
        if (mimeType == null || mimeType.trim().isEmpty()) {
            return "image/webp";
        }

        String normalized = mimeType.toLowerCase(Locale.ROOT).split(";")[0].trim();
        if (normalized.equals("image/jpeg") || normalized.equals("image/png") || normalized.equals("image/webp")) {
            return normalized;
        }

        return "image/webp";
    }

    private String normalizeFilename(String filename, String mimeType) {
        String fallbackName = "createtree-image-" + System.currentTimeMillis();
        String safeName = filename == null || filename.trim().isEmpty() ? fallbackName : filename.trim();
        safeName = safeName.replaceAll("[\\\\/:*?\"<>|]", "_");

        String extension = extensionForMimeType(mimeType);
        if (!safeName.toLowerCase(Locale.ROOT).matches(".*\\.(jpg|jpeg|png|webp)$")) {
            safeName = safeName + extension;
        }

        return safeName;
    }

    private String extensionForMimeType(String mimeType) {
        if ("image/jpeg".equals(mimeType)) {
            return ".jpg";
        }
        if ("image/png".equals(mimeType)) {
            return ".png";
        }

        return ".webp";
    }

    private String escapeJson(String value) {
        if (value == null) {
            return "알 수 없는 오류가 발생했습니다.";
        }

        return value.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
