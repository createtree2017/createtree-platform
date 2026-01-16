import { useRef, useCallback, useEffect } from 'react';

interface PinchZoomOptions {
  scale: number;
  panOffset: { x: number; y: number };
  minScale?: number;
  maxScale?: number;
  enabled: boolean;
  onScaleChange: (scale: number) => void;
  onPanChange: (offset: { x: number; y: number }) => void;
}

interface PointerData {
  id: number;
  x: number;
  y: number;
}

export function usePinchZoom({
  scale,
  panOffset,
  minScale = 0.1,
  maxScale = 3,
  enabled,
  onScaleChange,
  onPanChange
}: PinchZoomOptions) {
  const pointerMapRef = useRef<Map<number, PointerData>>(new Map());
  const initialPinchDistRef = useRef<number>(0);
  const initialScaleRef = useRef<number>(scale);
  const initialPanRef = useRef<{ x: number; y: number }>(panOffset);
  const initialMidpointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPinchingRef = useRef(false);
  const lastSinglePointerRef = useRef<{ x: number; y: number } | null>(null);

  const scaleRef = useRef(scale);
  const panOffsetRef = useRef(panOffset);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    panOffsetRef.current = panOffset;
  }, [panOffset]);

  const getDistance = (p1: PointerData, p2: PointerData): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getMidpoint = (p1: PointerData, p2: PointerData): { x: number; y: number } => ({
    x: (p1.x + p2.x) / 2,
    y: (p1.y + p2.y) / 2
  });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;

    e.preventDefault();
    e.stopPropagation();

    const pointer: PointerData = { id: e.pointerId, x: e.clientX, y: e.clientY };
    pointerMapRef.current.set(e.pointerId, pointer);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    if (pointerMapRef.current.size === 1) {
      lastSinglePointerRef.current = { x: e.clientX, y: e.clientY };
      initialPanRef.current = { ...panOffsetRef.current };
    } else if (pointerMapRef.current.size === 2) {
      const pointers = Array.from(pointerMapRef.current.values());
      initialPinchDistRef.current = getDistance(pointers[0], pointers[1]);
      initialScaleRef.current = scaleRef.current;
      initialMidpointRef.current = getMidpoint(pointers[0], pointers[1]);
      initialPanRef.current = { ...panOffsetRef.current };
      isPinchingRef.current = true;
      lastSinglePointerRef.current = null;
    }
  }, [enabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!enabled) return;
    if (!pointerMapRef.current.has(e.pointerId)) return;

    pointerMapRef.current.set(e.pointerId, { id: e.pointerId, x: e.clientX, y: e.clientY });

    if (pointerMapRef.current.size === 2 && isPinchingRef.current) {
      const pointers = Array.from(pointerMapRef.current.values());
      const currentDist = getDistance(pointers[0], pointers[1]);
      const currentMidpoint = getMidpoint(pointers[0], pointers[1]);

      const scaleRatio = currentDist / initialPinchDistRef.current;
      let newScale = initialScaleRef.current * scaleRatio;
      newScale = Math.max(minScale, Math.min(maxScale, newScale));

      const midpointDx = currentMidpoint.x - initialMidpointRef.current.x;
      const midpointDy = currentMidpoint.y - initialMidpointRef.current.y;

      const newPan = {
        x: initialPanRef.current.x + midpointDx,
        y: initialPanRef.current.y + midpointDy
      };

      onScaleChange(newScale);
      onPanChange(newPan);
    } else if (pointerMapRef.current.size === 1 && lastSinglePointerRef.current) {
      const dx = e.clientX - lastSinglePointerRef.current.x;
      const dy = e.clientY - lastSinglePointerRef.current.y;

      const newPan = {
        x: initialPanRef.current.x + dx,
        y: initialPanRef.current.y + dy
      };

      onPanChange(newPan);
    }
  }, [enabled, minScale, maxScale, onScaleChange, onPanChange]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    pointerMapRef.current.delete(e.pointerId);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (pointerMapRef.current.size < 2) {
      isPinchingRef.current = false;
    }

    if (pointerMapRef.current.size === 1) {
      const remainingPointer = Array.from(pointerMapRef.current.values())[0];
      lastSinglePointerRef.current = { x: remainingPointer.x, y: remainingPointer.y };
      initialPanRef.current = { ...panOffsetRef.current };
    } else if (pointerMapRef.current.size === 0) {
      lastSinglePointerRef.current = null;
    }
  }, []);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    pointerMapRef.current.delete(e.pointerId);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (pointerMapRef.current.size < 2) {
      isPinchingRef.current = false;
    }

    if (pointerMapRef.current.size === 0) {
      lastSinglePointerRef.current = null;
    }
  }, []);

  return {
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel
    }
  };
}
