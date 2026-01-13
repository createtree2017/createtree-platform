export type AlbumSize = '8x8' | '8x10' | '10x10' | '12x12' | 'A4';

export interface AlbumConfig {
  id: AlbumSize;
  name: string;
  widthInches: number;
  heightInches: number;
  dpi: number;
}

export interface CanvasObject {
  id: string;
  type: 'image' | 'text';
  src?: string;
  text?: string;
  
  x: number; 
  y: number;
  width: number;
  height: number;
  rotation: number;
  
  contentX?: number;
  contentY?: number;
  contentWidth?: number;
  contentHeight?: number;

  zIndex: number;
  opacity: number;
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

export interface AssetItem {
  id: string;
  url: string;
  name: string;
  width: number;
  height: number;
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
  showGrid: boolean;
}

export interface ProjectData {
  id?: number;
  title: string;
  editorState: EditorState;
  createdAt?: string;
  updatedAt?: string;
}
