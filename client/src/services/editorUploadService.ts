export interface UploadedImage {
  originalUrl: string;
  previewUrl: string;
  filename: string;
  originalWidth: number;
  originalHeight: number;
  previewWidth: number;
  previewHeight: number;
}

export interface UploadResult {
  success: boolean;
  data?: UploadedImage;
  error?: string;
}

export interface MultiUploadResult {
  success: boolean;
  data?: UploadedImage[];
  error?: string;
}

export async function uploadEditorImage(file: File): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/editor-upload/single', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || '업로드 실패'
      };
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[EditorUpload] 업로드 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '업로드 중 오류 발생'
    };
  }
}

export async function uploadEditorImages(files: File[]): Promise<MultiUploadResult> {
  try {
    const formData = new FormData();
    files.forEach(file => {
      formData.append('files', file);
    });

    const response = await fetch('/api/editor-upload/multiple', {
      method: 'POST',
      body: formData,
      credentials: 'include'
    });

    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || '업로드 실패'
      };
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[EditorUpload] 다중 업로드 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '업로드 중 오류 발생'
    };
  }
}

export async function uploadEditorImagesSequentially(
  files: File[],
  onProgress?: (completed: number, total: number) => void
): Promise<MultiUploadResult> {
  const results: UploadedImage[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const result = await uploadEditorImage(files[i]);
    
    if (result.success && result.data) {
      results.push(result.data);
    } else {
      errors.push(`${files[i].name}: ${result.error || '알 수 없는 오류'}`);
    }
    
    onProgress?.(i + 1, files.length);
  }
  
  if (results.length === 0 && errors.length > 0) {
    return {
      success: false,
      error: errors.join(', ')
    };
  }
  
  return {
    success: true,
    data: results
  };
}

export interface DeleteResult {
  success: boolean;
  deleted?: string[];
  errors?: string[];
  error?: string;
}

// 갤러리 이미지를 프로젝트용 GCS에 복사
export async function copyFromGallery(imageUrl: string): Promise<UploadResult> {
  try {
    const response = await fetch('/api/editor-upload/copy-from-gallery', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ imageUrl }),
      credentials: 'include'
    });

    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || '갤러리 이미지 복사 실패'
      };
    }

    return {
      success: true,
      data: result.data
    };
  } catch (error) {
    console.error('[EditorUpload] 갤러리 이미지 복사 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '복사 중 오류 발생'
    };
  }
}

export async function deleteEditorImage(originalUrl?: string, previewUrl?: string): Promise<DeleteResult> {
  try {
    const response = await fetch('/api/editor-upload/delete', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ originalUrl, previewUrl }),
      credentials: 'include'
    });

    const result = await response.json();
    
    if (!response.ok) {
      return {
        success: false,
        error: result.error || '삭제 실패'
      };
    }

    return {
      success: true,
      deleted: result.deleted,
      errors: result.errors
    };
  } catch (error) {
    console.error('[EditorUpload] 삭제 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '삭제 중 오류 발생'
    };
  }
}
