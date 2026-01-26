/**
 * 포토북 전용 자동 정렬 Hook
 * 스프레드 구조에서 왼쪽/오른쪽/양쪽 페이지 선택 기능 제공
 * 
 * 공통 useAutoArrange Hook을 확장하여 포토북 특수 기능 추가
 * 중앙화된 모달 시스템 사용
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { 
  calculateMasonryLayout, 
  getPhotobookPageBounds,
  isImageInPageBounds,
  type MasonryImage,
  type MasonryPlacement,
  type PhotobookPageTarget 
} from '@/utils/masonryLayout';
import type { CanvasObject } from '@/types/editor';
import { useModal } from '@/hooks/useModal';
import { AUTO_ARRANGE_CONFIRM_MESSAGE } from '@/hooks/useAutoArrange';

export interface PhotobookAutoArrangeConfig {
  spreadWidth: number;
  spreadHeight: number;
  bleedPx?: number;
}

export interface UsePhotobookAutoArrangeInput {
  config: PhotobookAutoArrangeConfig;
  objects: CanvasObject[];
  onApply: (updates: Array<{ id: string; x: number; y: number; width: number; height: number }>) => void;
}

export interface UsePhotobookAutoArrangeReturn {
  isTight: boolean;
  setIsTight: (value: boolean) => void;
  pageTarget: PhotobookPageTarget;
  setPageTarget: (value: PhotobookPageTarget) => void;
  showConfirmModal: boolean;
  canArrange: boolean;
  imageCount: number;
  handleArrangeClick: () => void;
  handleConfirm: (isTight: boolean) => void;
  handleCancel: () => void;
}

const DEFAULT_GAP = 20;
const DEFAULT_PADDING = 20;

/**
 * 포토북 자동 정렬 Hook
 * 스프레드의 왼쪽/오른쪽/양쪽 페이지 선택하여 정렬
 */
export function usePhotobookAutoArrange(input: UsePhotobookAutoArrangeInput): UsePhotobookAutoArrangeReturn {
  const { config, objects, onApply } = input;
  const modal = useModal();
  
  const [isTight, setIsTight] = useState(false);
  const [pageTarget, setPageTarget] = useState<PhotobookPageTarget>('both');
  const pageTargetRef = useRef(pageTarget);
  pageTargetRef.current = pageTarget;

  const imageObjects = useMemo(() => 
    objects.filter((obj): obj is CanvasObject & { type: 'image' } => obj.type === 'image'),
    [objects]
  );

  const targetImages = useMemo(() => {
    if (pageTarget === 'both') return imageObjects;
    
    return imageObjects.filter((obj) => 
      isImageInPageBounds(obj.x, obj.width, config.spreadWidth, pageTarget)
    );
  }, [imageObjects, pageTarget, config.spreadWidth]);

  const canArrange = targetImages.length > 0;
  const imageCount = targetImages.length;

  const handleConfirmInternal = useCallback((finalIsTight: boolean) => {
    modal.close();
    setIsTight(finalIsTight);

    const gap = finalIsTight ? 0 : DEFAULT_GAP;
    const padding = finalIsTight ? 0 : DEFAULT_PADDING;
    const bleedOffset = finalIsTight ? 0 : (config.bleedPx ?? 0);

    const pageBounds = getPhotobookPageBounds(
      config.spreadWidth,
      config.spreadHeight,
      pageTargetRef.current
    );

    const arrangeWidth = pageBounds.width - (bleedOffset * 2);
    const arrangeHeight = pageBounds.height - (bleedOffset * 2);

    const masonryImages: MasonryImage[] = targetImages.map((obj) => ({
      id: obj.id,
      aspectRatio: obj.width / obj.height,
    }));

    const result = calculateMasonryLayout({
      canvasWidth: arrangeWidth,
      canvasHeight: arrangeHeight,
      images: masonryImages,
      gap,
      padding,
    });

    const updates = result.placements.map((placement: MasonryPlacement) => ({
      id: placement.id,
      x: placement.x + pageBounds.x + bleedOffset,
      y: placement.y + pageBounds.y + bleedOffset,
      width: placement.width,
      height: placement.height,
    }));

    onApply(updates);
  }, [config, targetImages, onApply, modal]);

  const handleCancelInternal = useCallback(() => {
    modal.close();
  }, [modal]);

  const handleArrangeClick = useCallback(() => {
    if (!canArrange) return;
    modal.open('autoArrangeConfirm', {
      message: AUTO_ARRANGE_CONFIRM_MESSAGE,
      initialIsTight: isTight,
      onConfirm: handleConfirmInternal,
      onCancel: handleCancelInternal
    });
  }, [canArrange, modal, isTight, handleConfirmInternal, handleCancelInternal]);

  return {
    isTight,
    setIsTight,
    pageTarget,
    setPageTarget,
    showConfirmModal: false,
    canArrange,
    imageCount,
    handleArrangeClick,
    handleConfirm: handleConfirmInternal,
    handleCancel: handleCancelInternal,
  };
}

/**
 * 페이지 타겟 레이블
 */
export const PAGE_TARGET_LABELS: Record<PhotobookPageTarget, string> = {
  left: '왼쪽 페이지',
  right: '오른쪽 페이지',
  both: '양쪽 페이지',
};

/**
 * 페이지 타겟 옵션 목록
 */
export const PAGE_TARGET_OPTIONS: Array<{ value: PhotobookPageTarget; label: string }> = [
  { value: 'both', label: '양쪽 페이지' },
  { value: 'left', label: '왼쪽 페이지' },
  { value: 'right', label: '오른쪽 페이지' },
];
