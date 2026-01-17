/**
 * 중앙집중식 에디터 타입 정의
 * 모든 제품 에디터(postcard, party, photobook-v2, calendar)에서 공통으로 사용
 */

/** GCS에 저장된 이미지 자산 - 모든 에디터 공통 */
export interface NormalizedAsset {
  id: string;
  previewUrl: string;      // 편집용 저해상도 (GCS)
  originalUrl: string;     // 내보내기용 고해상도 (GCS)
  filename: string;
  width: number;
  height: number;
}

/** 캔버스에 배치된 객체 */
export interface CanvasObject {
  id: string;
  type: 'image' | 'text';
  src?: string;            // 편집 시 표시용 (previewUrl)
  fullSrc?: string;        // 내보내기용 (originalUrl)
  text?: string;
  
  x: number; 
  y: number;
  width: number;
  height: number;
  rotation: number;
  isFlippedX?: boolean;
  
  contentX?: number;
  contentY?: number;
  contentWidth?: number;
  contentHeight?: number;

  zIndex: number;
  opacity: number;
}

/** 레거시 AssetItem과 호환 - 점진적 마이그레이션용 */
export interface AssetItem {
  id: string;
  url: string;              // previewUrl과 동일
  fullUrl?: string;         // originalUrl과 동일
  name: string;
  width: number;
  height: number;
}

/** NormalizedAsset을 레거시 AssetItem으로 변환 */
export function toAssetItem(asset: NormalizedAsset): AssetItem {
  return {
    id: asset.id,
    url: asset.previewUrl,
    fullUrl: asset.originalUrl,
    name: asset.filename,
    width: asset.width,
    height: asset.height,
  };
}

/** AssetItem에서 캔버스 이미지 객체 생성 */
export function createImageObject(
  asset: AssetItem,
  options: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex: number;
  }
): CanvasObject {
  return {
    id: options.id,
    type: 'image',
    src: asset.url,
    fullSrc: asset.fullUrl || asset.url,
    x: options.x,
    y: options.y,
    width: options.width,
    height: options.height,
    rotation: 0,
    contentX: 0,
    contentY: 0,
    contentWidth: options.width,
    contentHeight: options.height,
    zIndex: options.zIndex,
    opacity: 1,
  };
}

/** GCS URL인지 확인 */
export function isGcsUrl(url: string): boolean {
  return url.includes('storage.googleapis.com') || url.includes('storage.cloud.google.com');
}

/** 내보내기용 URL 선택 - fullSrc 우선, GCS URL 필수 */
export function getExportUrl(obj: CanvasObject): string | null {
  const url = obj.fullSrc || obj.src;
  if (!url) return null;
  if (!isGcsUrl(url)) {
    console.warn('[Editor] 내보내기 URL이 GCS가 아님:', url);
    return null;
  }
  return url;
}

// ============================================================
// 갤러리 선택 유틸리티 - ID 기반 선택 시스템
// ============================================================

/** 갤러리 이미지 선택 상태 타입 (ID 기반) */
export type GallerySelectionSet = Set<number>;

/** 갤러리 선택 토글 - 불변성 유지 */
export function toggleGallerySelection(
  currentSelection: GallerySelectionSet,
  imageId: number
): GallerySelectionSet {
  const newSet = new Set(currentSelection);
  if (newSet.has(imageId)) {
    newSet.delete(imageId);
  } else {
    newSet.add(imageId);
  }
  return newSet;
}

/** 갤러리 선택 초기화 */
export function createEmptyGallerySelection(): GallerySelectionSet {
  return new Set<number>();
}
