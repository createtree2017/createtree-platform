/**
 * 제작소 에디터 공통 설정
 * 모든 에디터(포토북, 엽서, 행사)에서 공유하는 설정값을 중앙 관리
 */

export type EditorType = 'photobook' | 'postcard' | 'party';
export type PlacementMode = 'cover' | 'contain' | 'center';
export type DataStructure = 'spreads' | 'designs';

export interface EditorConfig {
  type: EditorType;
  dataStructure: DataStructure;
  defaultScale: number;
  defaultProjectTitle: string;
  categorySlug: string;
  displayDpi: number;
}

export interface PlacementConfig {
  mode: PlacementMode;
  scaleFactor?: number;
}

export const SHARED_EDITOR_SETTINGS = {
  placementMode: 'center' as PlacementMode,
  displayDpi: 150,
  thumbnailMaxSize: 1024,
} as const;

export const EDITOR_CONFIGS: Record<EditorType, EditorConfig> = {
  photobook: {
    type: 'photobook',
    dataStructure: 'spreads',
    defaultScale: 0.15,
    defaultProjectTitle: '새 포토북',
    categorySlug: 'photobook',
    displayDpi: 150,
  },
  postcard: {
    type: 'postcard',
    dataStructure: 'designs',
    defaultScale: 0.3,
    defaultProjectTitle: '새 엽서',
    categorySlug: 'postcard',
    displayDpi: 150,
  },
  party: {
    type: 'party',
    dataStructure: 'designs',
    defaultScale: 0.3,
    defaultProjectTitle: '새 행사용',
    categorySlug: 'party',
    displayDpi: 150,
  },
};

export function getEditorConfig(type: EditorType): EditorConfig {
  return EDITOR_CONFIGS[type];
}

export function getPlacementMode(): PlacementMode {
  return SHARED_EDITOR_SETTINGS.placementMode;
}

export function getDisplayDpi(): number {
  return SHARED_EDITOR_SETTINGS.displayDpi;
}
