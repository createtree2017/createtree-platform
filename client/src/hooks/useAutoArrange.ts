/**
 * 캔버스 자동 정렬 공통 Hook
 * 모든 에디터(포토북, 엽서, 행사)에서 공통으로 사용
 * 
 * 책임:
 * - 정렬 옵션 상태 관리 (밀착/띄어쓰기)
 * - 확인 모달 표시/제어 (중앙화된 모달 시스템 사용)
 * - Masonry 레이아웃 계산 → 에디터 상태 업데이트
 */

import { useState, useCallback, useMemo } from 'react';
import { 
  calculateMasonryLayout, 
  type MasonryImage, 
  type MasonryPlacement 
} from '@/utils/masonryLayout';
import type { CanvasObject } from '@/types/editor';
import { useModal } from '@/hooks/useModal';

export interface AutoArrangeConfig {
  canvasWidth: number;
  canvasHeight: number;
  bleedPx?: number;
}

export interface UseAutoArrangeInput {
  config: AutoArrangeConfig;
  objects: CanvasObject[];
  onApply: (updates: Array<{ id: string; x: number; y: number; width: number; height: number }>) => void;
}

export interface UseAutoArrangeReturn {
  isTight: boolean;
  setIsTight: (value: boolean) => void;
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
 * 자동 정렬 공통 Hook
 */
export function useAutoArrange(input: UseAutoArrangeInput): UseAutoArrangeReturn {
  const { config, objects, onApply } = input;
  const modal = useModal();
  
  const [isTight, setIsTight] = useState(false);

  const imageObjects = useMemo(() => 
    objects.filter((obj): obj is CanvasObject & { type: 'image' } => obj.type === 'image'),
    [objects]
  );

  const canArrange = imageObjects.length > 0;
  const imageCount = imageObjects.length;

  const handleConfirmInternal = useCallback((finalIsTight: boolean) => {
    modal.close();
    setIsTight(finalIsTight);

    const gap = finalIsTight ? 0 : DEFAULT_GAP;
    const padding = finalIsTight ? 0 : DEFAULT_PADDING;

    const bleedOffset = finalIsTight ? 0 : (config.bleedPx ?? 0);
    const arrangeWidth = config.canvasWidth - (bleedOffset * 2);
    const arrangeHeight = config.canvasHeight - (bleedOffset * 2);

    const masonryImages: MasonryImage[] = imageObjects.map((obj) => ({
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
      x: placement.x + bleedOffset,
      y: placement.y + bleedOffset,
      width: placement.width,
      height: placement.height,
    }));

    onApply(updates);
  }, [config, imageObjects, onApply, modal]);

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
    showConfirmModal: false,
    canArrange,
    imageCount,
    handleArrangeClick,
    handleConfirm: handleConfirmInternal,
    handleCancel: handleCancelInternal,
  };
}

/**
 * 자동 정렬 확인 모달 메시지
 */
export const AUTO_ARRANGE_CONFIRM_MESSAGE = 
  '정렬 시 캔버스의 이미지를 자동으로 정렬하기 위해 이미지 크기가 변경될 수 있습니다. 자동 정렬할까요?';

/**
 * 자동 정렬 관련 상수
 */
export const AUTO_ARRANGE_CONSTANTS = {
  defaultGap: DEFAULT_GAP,
  defaultPadding: DEFAULT_PADDING,
} as const;
