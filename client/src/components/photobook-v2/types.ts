export { CanvasObject, AssetItem } from '@/types/editor';
import type { CanvasObject, AssetItem } from '@/types/editor';

export type AlbumSize = '8x8' | '8x10' | '10x10' | '12x12' | 'A4';

export interface AlbumConfig {
  id: AlbumSize;
  name: string;
  widthInches: number;
  heightInches: number;
  dpi: number;
}

export interface Spread {
  id: string;
  pageLeftId: string;
  pageRightId: string; 
  objects: CanvasObject[];
  background?: string;
  backgroundLeft?: string;
  backgroundRight?: string;
}

export interface EditorState {
  albumSize: AlbumConfig;
  spreads: Spread[];
  currentSpreadIndex: number;
  assets: AssetItem[];
  selectedObjectId: string | null;
  scale: number;
  panOffset: { x: number, y: number };
  showBleed: boolean;
}

export interface ProjectData {
  id?: number;
  title: string;
  editorState: EditorState;
  createdAt?: string;
  updatedAt?: string;
}
