interface AndroidGalleryBridge {
  saveImageToGallery(base64Data: string, filename: string, mimeType: string): string;
}

declare global {
  interface Window {
    CreateTreeAndroid?: AndroidGalleryBridge;
  }
}

interface AndroidGallerySaveResult {
  success: boolean;
  message?: string;
}

function isAndroidGalleryBridgeAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.CreateTreeAndroid?.saveImageToGallery === "function";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("이미지를 읽을 수 없습니다."));
        return;
      }

      resolve(result.split(",")[1] || "");
    };
    reader.onerror = () => reject(new Error("이미지를 읽는 중 오류가 발생했습니다."));
    reader.readAsDataURL(blob);
  });
}

export async function saveImageToAndroidGallery(
  downloadUrl: string,
  filename: string
): Promise<AndroidGallerySaveResult> {
  if (!isAndroidGalleryBridgeAvailable()) {
    return {
      success: false,
      message: "Android 갤러리 저장 브리지를 사용할 수 없습니다.",
    };
  }

  try {
    const response = await fetch(downloadUrl, {
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`이미지 다운로드 실패: ${response.status}`);
    }

    const blob = await response.blob();
    const mimeType = blob.type || response.headers.get("content-type") || "image/webp";
    const base64Data = await blobToBase64(blob);
    const rawResult = window.CreateTreeAndroid!.saveImageToGallery(base64Data, filename, mimeType);
    const result = JSON.parse(rawResult) as AndroidGallerySaveResult;

    return result;
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Android 갤러리 저장 중 오류가 발생했습니다.",
    };
  }
}

export function canSaveImageToAndroidGallery(): boolean {
  return isAndroidGalleryBridgeAvailable();
}
