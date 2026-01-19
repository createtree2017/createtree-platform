/**
 * 제작소 에디터 공통 에셋 관리 Hook
 * 모든 에디터(포토북, 엽서, 행사)에서 공유하는 에셋 관련 로직을 통합
 */

import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import { uploadMultipleFromDevice, deleteImage, toAssetItems } from '@/services/imageIngestionService';
import { computeDefaultImagePlacement, computeSpreadImagePlacement } from '@/utils/canvasPlacement';
import { generateId } from '@/components/photobook-v2/utils';
import { getPlacementMode } from '@/constants/editorConfig';
import type { AssetItem, CanvasObject } from '@/components/photobook-v2/types';

export interface CanvasDimensions {
  widthPx: number;
  heightPx: number;
  spreadWidthPx?: number;
}

export interface UseEditorAssetActionsConfig {
  isSpreadMode: boolean;
  getCanvasDimensions: () => CanvasDimensions;
  getCurrentObjectsCount: () => number;
  addAssets: (assets: AssetItem[]) => void;
  addObject: (obj: CanvasObject) => void;
  removeAsset: (id: string) => void;
  setIsUploading: (uploading: boolean) => void;
  addPendingUpload?: (upload: { id: number; name: string }) => void;
  removePendingUpload?: (id: number) => void;
}

export interface EditorAssetActions {
  handleUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleDragStart: (e: React.DragEvent, asset: AssetItem) => void;
  handleAssetClick: (asset: AssetItem) => void;
  handleDeleteAsset: (asset: AssetItem) => Promise<void>;
}

export function useEditorAssetActions(config: UseEditorAssetActionsConfig): EditorAssetActions {
  const { toast } = useToast();
  const {
    isSpreadMode,
    getCanvasDimensions,
    getCurrentObjectsCount,
    addAssets,
    addObject,
    removeAsset,
    setIsUploading,
    addPendingUpload,
    removePendingUpload,
  } = config;

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    
    const fileArray = Array.from(files);
    const pendingIds: number[] = [];
    
    if (addPendingUpload) {
      fileArray.forEach((file, index) => {
        const pendingId = Date.now() + index;
        pendingIds.push(pendingId);
        addPendingUpload({ id: pendingId, name: file.name });
      });
    }
    
    try {
      const result = await uploadMultipleFromDevice(fileArray);
      
      if (result.success && result.assets) {
        const newAssets: AssetItem[] = toAssetItems(result.assets);
        addAssets(newAssets);
        toast({ title: '업로드 완료', description: `${newAssets.length}개 이미지가 업로드되었습니다.` });
      } else {
        toast({ title: '업로드 실패', description: result.errors?.join(', ') || '이미지 업로드에 실패했습니다.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: '업로드 실패', description: '이미지 업로드 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      if (removePendingUpload) {
        pendingIds.forEach(id => removePendingUpload(id));
      }
      setIsUploading(false);
      e.target.value = '';
    }
  }, [setIsUploading, addAssets, toast, addPendingUpload, removePendingUpload]);

  const handleDragStart = useCallback((e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleAssetClick = useCallback((asset: AssetItem) => {
    const dims = getCanvasDimensions();
    const placementMode = getPlacementMode();

    let placement;
    if (isSpreadMode && dims.spreadWidthPx) {
      placement = computeSpreadImagePlacement({
        assetWidth: asset.width,
        assetHeight: asset.height,
        pageWidthPx: dims.widthPx,
        pageHeightPx: dims.heightPx,
        spreadWidthPx: dims.spreadWidthPx,
        mode: placementMode,
      });
    } else {
      placement = computeDefaultImagePlacement({
        assetWidth: asset.width,
        assetHeight: asset.height,
        canvasWidthPx: dims.widthPx,
        canvasHeightPx: dims.heightPx,
        mode: placementMode,
      });
    }

    const newObject: CanvasObject = {
      id: generateId(),
      type: 'image',
      src: asset.url,
      fullSrc: asset.fullUrl || asset.url,
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
      rotation: 0,
      contentX: placement.contentX,
      contentY: placement.contentY,
      contentWidth: placement.contentWidth,
      contentHeight: placement.contentHeight,
      zIndex: getCurrentObjectsCount() + 1,
      opacity: 1,
    };

    addObject(newObject);
  }, [isSpreadMode, getCanvasDimensions, getCurrentObjectsCount, addObject]);

  const handleDeleteAsset = useCallback(async (asset: AssetItem) => {
    const originalUrl = asset.fullUrl;
    const previewUrl = asset.url;
    
    if (originalUrl?.includes('storage.googleapis.com') || previewUrl?.includes('storage.googleapis.com')) {
      try {
        await deleteImage(originalUrl, previewUrl);
      } catch (err) {
        console.error('GCS 파일 삭제 실패:', err);
      }
    }
    
    removeAsset(asset.id);
  }, [removeAsset]);

  return {
    handleUpload,
    handleDragStart,
    handleAssetClick,
    handleDeleteAsset,
  };
}
