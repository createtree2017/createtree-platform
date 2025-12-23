
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
  src?: string; // For images
  text?: string; // For text
  
  // Frame Dimensions (The mask/container)
  x: number; 
  y: number;
  width: number;
  height: number;
  rotation: number; // Degrees
  
  // Content Dimensions (The image inside the frame)
  // If undefined, these default to matching the frame (0,0, width, height)
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
  background: string;
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
  scale: number; // Viewport zoom level
  panOffset: { x: number, y: number }; // Viewport pan offset
  showBleed: boolean;
  showGrid: boolean;
}
