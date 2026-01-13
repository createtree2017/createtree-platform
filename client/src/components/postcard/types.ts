import { CanvasObject, AssetItem } from '../photobook-v2/types';

export type Orientation = 'landscape' | 'portrait';

export interface PostcardDesign {
  id: string;
  objects: CanvasObject[];
  background: string;
  quantity: number;
  orientation: Orientation;
}

export const getEffectiveDimensions = (
  variantConfig: VariantConfig,
  orientation: Orientation
): { widthMm: number; heightMm: number; widthPx: number; heightPx: number } => {
  const baseWidth = variantConfig.widthMm;
  const baseHeight = variantConfig.heightMm;
  const dpi = variantConfig.dpi || 300;
  
  const isLandscape = orientation === 'landscape';
  const widthMm = isLandscape ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);
  const heightMm = isLandscape ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
  
  const widthPx = widthMm * dpi / 25.4;
  const heightPx = heightMm * dpi / 25.4;
  
  return { widthMm, heightMm, widthPx, heightPx };
};

export interface VariantConfig {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  dpi: number;
}

export interface PostcardEditorState {
  variantId: number | null;
  variantConfig: VariantConfig;
  designs: PostcardDesign[];
  currentDesignIndex: number;
  assets: AssetItem[];
  selectedObjectId: string | null;
  scale: number;
  panOffset: { x: number; y: number };
  showBleed: boolean;
}

export interface ProductVariant {
  id: number;
  categoryId: number;
  name: string;
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  dpi: number;
  isBest: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface ProductProject {
  id: number;
  userId: number;
  categoryId: number;
  variantId: number | null;
  title: string;
  status: string;
  designsData: any;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}
