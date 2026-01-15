/**
 * 중앙집중식 이미지 로드 시스템
 * 모든 제품 에디터에서 공통으로 사용
 * 
 * 핵심 규칙:
 * - 모든 이미지는 GCS에 저장되어야 함
 * - 갤러리 이미지는 직접 사용 금지 → 반드시 GCS에 복사 후 사용
 * - 반환되는 Asset은 항상 previewUrl과 originalUrl 모두 GCS URL
 */

import { NormalizedAsset, toAssetItem, AssetItem } from '@/types/editor';

// ============================================================
// 타입 정의
// ============================================================

export interface UploadResult {
  success: boolean;
  asset?: NormalizedAsset;
  error?: string;
}

export interface MultiUploadResult {
  success: boolean;
  assets?: NormalizedAsset[];
  errors?: string[];
}

export interface DeleteResult {
  success: boolean;
  deleted?: string[];
  error?: string;
}

/** 갤러리 API에서 반환하는 이미지 타입 */
export interface GalleryImageItem {
  id: number;
  url: string;
  thumbnailUrl?: string;
  fullUrl?: string;
  originalUrl?: string;
  transformedUrl?: string;
}

// ============================================================
// 디바이스 업로드
// ============================================================

/** 단일 파일 업로드 */
export async function uploadFromDevice(file: File): Promise<UploadResult> {
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
      return { success: false, error: result.error || '업로드 실패' };
    }

    const asset: NormalizedAsset = {
      id: generateId(),
      previewUrl: result.data.previewUrl,
      originalUrl: result.data.originalUrl,
      filename: result.data.filename,
      width: result.data.originalWidth,
      height: result.data.originalHeight,
    };

    return { success: true, asset };
  } catch (error) {
    console.error('[ImageIngestion] 업로드 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '업로드 중 오류 발생'
    };
  }
}

/** 다중 파일 순차 업로드 (진행률 콜백 지원) */
export async function uploadMultipleFromDevice(
  files: File[],
  onProgress?: (completed: number, total: number) => void
): Promise<MultiUploadResult> {
  const assets: NormalizedAsset[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const result = await uploadFromDevice(files[i]);
    
    if (result.success && result.asset) {
      assets.push(result.asset);
    } else {
      errors.push(`${files[i].name}: ${result.error || '알 수 없는 오류'}`);
    }
    
    onProgress?.(i + 1, files.length);
  }
  
  if (assets.length === 0 && errors.length > 0) {
    return { success: false, errors };
  }
  
  return { success: true, assets, errors: errors.length > 0 ? errors : undefined };
}

// ============================================================
// 갤러리 이미지 복사
// ============================================================

/** 갤러리 이미지에서 가장 적합한 소스 URL 선택 */
function selectGallerySourceUrl(item: GalleryImageItem): string {
  // 우선순위: fullUrl > originalUrl > transformedUrl > url
  // fullUrl과 originalUrl이 가장 고해상도일 가능성 높음
  return item.fullUrl || item.originalUrl || item.transformedUrl || item.url;
}

/** 갤러리 이미지를 GCS에 복사하여 프로젝트용 자산으로 변환 */
export async function copyFromGallery(item: GalleryImageItem): Promise<UploadResult> {
  try {
    const sourceUrl = selectGallerySourceUrl(item);
    
    console.log('[ImageIngestion] 갤러리 복사 시작:', sourceUrl);

    const response = await fetch('/api/editor-upload/copy-from-gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl: sourceUrl }),
      credentials: 'include'
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { success: false, error: result.error || '갤러리 이미지 복사 실패' };
    }

    const asset: NormalizedAsset = {
      id: generateId(),
      previewUrl: result.data.previewUrl,
      originalUrl: result.data.originalUrl,
      filename: result.data.filename,
      width: result.data.originalWidth,
      height: result.data.originalHeight,
    };

    console.log('[ImageIngestion] 갤러리 복사 완료:', asset.originalUrl);
    return { success: true, asset };
  } catch (error) {
    console.error('[ImageIngestion] 갤러리 복사 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '복사 중 오류 발생'
    };
  }
}

/** 다중 갤러리 이미지 복사 (진행률 콜백 지원) */
export async function copyMultipleFromGallery(
  items: GalleryImageItem[],
  onProgress?: (completed: number, total: number) => void
): Promise<MultiUploadResult> {
  const assets: NormalizedAsset[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < items.length; i++) {
    const result = await copyFromGallery(items[i]);
    
    if (result.success && result.asset) {
      assets.push(result.asset);
    } else {
      errors.push(`이미지 ${items[i].id}: ${result.error || '알 수 없는 오류'}`);
    }
    
    onProgress?.(i + 1, items.length);
  }
  
  if (assets.length === 0 && errors.length > 0) {
    return { success: false, errors };
  }
  
  return { success: true, assets, errors: errors.length > 0 ? errors : undefined };
}

// ============================================================
// 이미지 삭제
// ============================================================

/** GCS에서 이미지 삭제 */
export async function deleteImage(originalUrl?: string, previewUrl?: string): Promise<DeleteResult> {
  try {
    const response = await fetch('/api/editor-upload/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ originalUrl, previewUrl }),
      credentials: 'include'
    });

    const result = await response.json();
    
    if (!response.ok) {
      return { success: false, error: result.error || '삭제 실패' };
    }

    return { success: true, deleted: result.deleted };
  } catch (error) {
    console.error('[ImageIngestion] 삭제 오류:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '삭제 중 오류 발생'
    };
  }
}

// ============================================================
// 유틸리티
// ============================================================

function generateId(): string {
  return `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/** NormalizedAsset 배열을 AssetItem 배열로 변환 (레거시 호환) */
export function toAssetItems(assets: NormalizedAsset[]): AssetItem[] {
  return assets.map(toAssetItem);
}

/** AssetItem에서 삭제에 필요한 URL 추출 */
export function getDeleteUrls(asset: AssetItem): { originalUrl?: string; previewUrl?: string } {
  return {
    originalUrl: asset.fullUrl,
    previewUrl: asset.url
  };
}
