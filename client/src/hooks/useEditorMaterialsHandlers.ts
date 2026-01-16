import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

export type SurfaceModel = 'single' | 'spread';
export type BackgroundTarget = 'left' | 'right' | 'both';

export interface MaterialItem {
  id: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  colorHex?: string;
}

interface SingleSurfaceCallbacks {
  surfaceModel: 'single';
  getCurrentDesignIndex: () => number;
  updateDesignBackground: (index: number, background: string | undefined) => void;
  getObjectsCount: () => number;
  addObject: (obj: any) => void;
  getCanvasDimensions: () => { widthPx: number; heightPx: number };
  showToast?: (message: string) => void;
}

interface SpreadSurfaceCallbacks {
  surfaceModel: 'spread';
  getCurrentSpreadIndex: () => number;
  updateSpreadBackground: (index: number, target: BackgroundTarget, background: string | undefined) => void;
  getObjectsCount: () => number;
  addObject: (obj: any) => void;
  showToast?: (message: string) => void;
}

type EditorMaterialsConfig = SingleSurfaceCallbacks | SpreadSurfaceCallbacks;

const generateId = () => uuidv4();

export function useEditorMaterialsHandlers(config: EditorMaterialsConfig) {
  const [selectedBackgrounds, setSelectedBackgrounds] = useState<MaterialItem[]>([]);
  const [selectedIcons, setSelectedIcons] = useState<MaterialItem[]>([]);

  const handleSelectBackground = useCallback((bg: MaterialItem) => {
    setSelectedBackgrounds(prev => {
      if (prev.find(b => b.id === bg.id)) return prev;
      return [...prev, bg];
    });
  }, []);

  const handleSelectIcon = useCallback((icon: MaterialItem) => {
    setSelectedIcons(prev => {
      if (prev.find(i => i.id === icon.id)) return prev;
      return [...prev, icon];
    });
  }, []);

  const handleRemoveBackground = useCallback((id: number) => {
    setSelectedBackgrounds(prev => prev.filter(b => b.id !== id));
  }, []);

  const handleRemoveIcon = useCallback((id: number) => {
    setSelectedIcons(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleApplyBackground = useCallback((bg: MaterialItem, target: BackgroundTarget = 'both') => {
    const isClearBackground = bg.id === 0;
    const bgValue = isClearBackground ? undefined : (bg.colorHex || bg.imageUrl);
    
    if (config.surfaceModel === 'single') {
      const index = config.getCurrentDesignIndex();
      config.updateDesignBackground(index, bgValue);
      
      if (config.showToast) {
        if (isClearBackground) {
          config.showToast('배경이 제거되었습니다');
        } else {
          config.showToast('배경이 적용되었습니다');
        }
      }
    } else {
      const index = config.getCurrentSpreadIndex();
      config.updateSpreadBackground(index, target, bgValue);
      
      if (config.showToast) {
        const targetLabel = target === 'left' ? '왼쪽 페이지' : target === 'right' ? '오른쪽 페이지' : '양면';
        if (isClearBackground) {
          config.showToast(`${targetLabel}의 배경이 제거되었습니다`);
        } else {
          config.showToast(`${targetLabel}에 배경이 적용되었습니다`);
        }
      }
    }
  }, [config]);

  const handleApplyIcon = useCallback((icon: MaterialItem) => {
    let iconX = 200;
    let iconY = 200;
    let iconSize = 150;
    
    if (config.surfaceModel === 'single') {
      const dims = config.getCanvasDimensions();
      iconSize = dims.widthPx * 0.15;
      iconX = dims.widthPx / 2 - iconSize / 2;
      iconY = dims.heightPx / 2 - iconSize / 2;
    }
    
    const newObject = {
      id: generateId(),
      type: 'image' as const,
      src: icon.imageUrl,
      x: iconX,
      y: iconY,
      width: iconSize,
      height: iconSize,
      rotation: 0,
      zIndex: config.getObjectsCount() + 1,
      opacity: 1,
      contentX: 0,
      contentY: 0,
      contentWidth: iconSize,
      contentHeight: iconSize,
    };
    
    config.addObject(newObject);
    
    if (config.showToast) {
      config.showToast('아이콘이 추가되었습니다');
    }
  }, [config]);

  return {
    selectedBackgrounds,
    selectedIcons,
    setSelectedBackgrounds,
    setSelectedIcons,
    handleSelectBackground,
    handleSelectIcon,
    handleRemoveBackground,
    handleRemoveIcon,
    handleApplyBackground,
    handleApplyIcon,
    surfaceModel: config.surfaceModel,
  };
}
