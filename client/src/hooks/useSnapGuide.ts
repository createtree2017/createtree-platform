/**
 * 스냅 가이드 훅
 * 드래그 중 스냅 로직을 관리하고 활성 가이드 라인 상태를 제공
 */

import { useState, useCallback, useRef } from 'react';
import {
  applySnap,
  calculateSnapLines,
  findNearestSnap,
  DEFAULT_SNAP_CONFIG,
  type SnapConfig,
  type ActiveSnapLine,
  type CanvasBounds,
  type SnapLine,
} from '@/utils/snapGuide';
import type { CanvasObject } from '@/types/editor';

interface UseSnapGuideOptions {
  enabled?: boolean;
  threshold?: number;
}

interface UseSnapGuideReturn {
  activeLines: ActiveSnapLine[];
  snapConfig: SnapConfig;
  setSnapEnabled: (enabled: boolean) => void;
  startSnapping: (canvas: CanvasBounds, objects: CanvasObject[], excludeId: string) => void;
  updateSnap: (x: number, y: number, width: number, height: number) => { x: number; y: number };
  endSnapping: () => void;
  clearActiveLines: () => void;
}

export function useSnapGuide(options: UseSnapGuideOptions = {}): UseSnapGuideReturn {
  const { enabled = true, threshold = DEFAULT_SNAP_CONFIG.threshold } = options;

  const [activeLines, setActiveLines] = useState<ActiveSnapLine[]>([]);
  const [snapConfig, setSnapConfig] = useState<SnapConfig>({
    enabled,
    threshold,
  });

  const snapLinesRef = useRef<SnapLine[]>([]);
  const canvasBoundsRef = useRef<CanvasBounds | null>(null);

  const setSnapEnabled = useCallback((newEnabled: boolean) => {
    setSnapConfig(prev => ({ ...prev, enabled: newEnabled }));
    if (!newEnabled) {
      setActiveLines([]);
    }
  }, []);

  const startSnapping = useCallback((
    canvas: CanvasBounds,
    objects: CanvasObject[],
    excludeId: string
  ) => {
    canvasBoundsRef.current = canvas;
    snapLinesRef.current = calculateSnapLines(canvas, objects, excludeId);
  }, []);

  const updateSnap = useCallback((
    x: number,
    y: number,
    width: number,
    height: number
  ): { x: number; y: number } => {
    if (!snapConfig.enabled) {
      return { x, y };
    }

    const result = findNearestSnap(x, y, width, height, snapLinesRef.current, snapConfig);
    setActiveLines(result.activeLines);

    return { x: result.x, y: result.y };
  }, [snapConfig]);

  const endSnapping = useCallback(() => {
    setActiveLines([]);
    snapLinesRef.current = [];
    canvasBoundsRef.current = null;
  }, []);

  const clearActiveLines = useCallback(() => {
    setActiveLines([]);
  }, []);

  return {
    activeLines,
    snapConfig,
    setSnapEnabled,
    startSnapping,
    updateSnap,
    endSnapping,
    clearActiveLines,
  };
}
