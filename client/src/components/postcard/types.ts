import { CanvasObject, AssetItem } from '../photobook-v2/types';

export interface PostcardDesign {
  id: string;
  objects: CanvasObject[];
  background: string;
  quantity: number;
}

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
