import { useRef, useCallback, useEffect } from 'react';

export interface PointerDragOptions {
  onDragStart?: (e: PointerEvent, startPos: { x: number; y: number }) => void;
  onDragMove?: (e: PointerEvent, delta: { dx: number; dy: number }, currentPos: { x: number; y: number }) => void;
  onDragEnd?: (e: PointerEvent) => void;
  scale?: number;
  disabled?: boolean;
}

export interface PointerDragResult {
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  isDragging: boolean;
}

export function usePointerDrag({
  onDragStart,
  onDragMove,
  onDragEnd,
  scale = 1,
  disabled = false,
}: PointerDragOptions): PointerDragResult {
  const isDraggingRef = useRef(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const activePointerIdRef = useRef<number | null>(null);
  const targetElementRef = useRef<HTMLElement | null>(null);
  
  const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd });
  const scaleRef = useRef(scale);
  
  useEffect(() => {
    callbacksRef.current = { onDragStart, onDragMove, onDragEnd };
  }, [onDragStart, onDragMove, onDragEnd]);
  
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  const cleanupRef = useRef<(() => void) | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    
    e.stopPropagation();
    e.preventDefault();
    
    isDraggingRef.current = true;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    activePointerIdRef.current = e.pointerId;
    targetElementRef.current = e.currentTarget as HTMLElement;
    
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
    
    const pointerId = e.pointerId;
    const startX = e.clientX;
    const startY = e.clientY;
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current || moveEvent.pointerId !== pointerId) return;
      
      moveEvent.preventDefault();
      
      const currentScale = scaleRef.current;
      const dx = (moveEvent.clientX - startX) / currentScale;
      const dy = (moveEvent.clientY - startY) / currentScale;
      
      callbacksRef.current.onDragMove?.(moveEvent, { dx, dy }, { x: moveEvent.clientX, y: moveEvent.clientY });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      
      isDraggingRef.current = false;
      
      if (targetElementRef.current) {
        try {
          targetElementRef.current.releasePointerCapture(upEvent.pointerId);
        } catch {}
      }
      
      activePointerIdRef.current = null;
      targetElementRef.current = null;
      
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      
      cleanupRef.current = null;
      
      callbacksRef.current.onDragEnd?.(upEvent);
    };
    
    cleanupRef.current = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    
    callbacksRef.current.onDragStart?.(e.nativeEvent, { x: e.clientX, y: e.clientY });
  }, [disabled]);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  return {
    handlers: {
      onPointerDown: handlePointerDown,
    },
    isDragging: isDraggingRef.current,
  };
}

export interface RotateDragOptions {
  getCenterPoint: () => { x: number; y: number } | null;
  initialRotation: number;
  onRotate: (newRotation: number) => void;
  onRotateEnd?: () => void;
  disabled?: boolean;
}

export function useRotateDrag({
  getCenterPoint,
  initialRotation,
  onRotate,
  onRotateEnd,
  disabled = false,
}: RotateDragOptions): PointerDragResult {
  const startAngleRef = useRef(0);
  const startRotationRef = useRef(0);
  const centerRef = useRef({ x: 0, y: 0 });

  return usePointerDrag({
    disabled,
    onDragStart: (e) => {
      const center = getCenterPoint();
      if (!center) return;
      
      centerRef.current = center;
      startRotationRef.current = initialRotation;
      startAngleRef.current = Math.atan2(
        e.clientY - center.y,
        e.clientX - center.x
      ) * (180 / Math.PI);
    },
    onDragMove: (e) => {
      const currentAngle = Math.atan2(
        e.clientY - centerRef.current.y,
        e.clientX - centerRef.current.x
      ) * (180 / Math.PI);
      
      const deltaAngle = currentAngle - startAngleRef.current;
      onRotate(Math.round(startRotationRef.current + deltaAngle));
    },
    onDragEnd: () => {
      onRotateEnd?.();
    },
  });
}

export interface ResizeDragOptions {
  handle: string;
  object: {
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    contentX?: number;
    contentY?: number;
    contentWidth?: number;
    contentHeight?: number;
  };
  scale: number;
  onResize: (updates: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    contentX?: number;
    contentY?: number;
    contentWidth?: number;
    contentHeight?: number;
  }) => void;
  onResizeEnd?: () => void;
  disabled?: boolean;
}

function getRotatedDelta(screenDx: number, screenDy: number, rotationDeg: number) {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    dx: screenDx * cos + screenDy * sin,
    dy: screenDy * cos - screenDx * sin
  };
}

export function useResizeDrag({
  handle,
  object,
  scale,
  onResize,
  onResizeEnd,
  disabled = false,
}: ResizeDragOptions): PointerDragResult {
  const startStateRef = useRef({
    x: 0, y: 0, w: 0, h: 0, r: 0,
    cx: 0, cy: 0, cw: 0, ch: 0
  });

  return usePointerDrag({
    scale,
    disabled,
    onDragStart: () => {
      startStateRef.current = {
        x: object.x,
        y: object.y,
        w: object.width,
        h: object.height,
        r: object.rotation,
        cx: object.contentX || 0,
        cy: object.contentY || 0,
        cw: object.contentWidth || object.width,
        ch: object.contentHeight || object.height
      };
    },
    onDragMove: (_, delta) => {
      const startState = startStateRef.current;
      const { dx: rawDx, dy: rawDy } = getRotatedDelta(delta.dx, delta.dy, startState.r);

      let dx = rawDx;
      let dy = rawDy;
      let newW = startState.w;
      let newH = startState.h;
      let newX = startState.x;
      let newY = startState.y;
      let newCX = startState.cx;
      let newCY = startState.cy;
      let newCW = startState.cw;
      let newCH = startState.ch;

      const isCorner = ['nw', 'ne', 'sw', 'se'].includes(handle);

      if (isCorner) {
        const ratio = startState.w / startState.h;
        if (handle.includes('e')) newW = Math.max(50, startState.w + dx);
        if (handle.includes('w')) newW = Math.max(50, startState.w - dx);
        newH = newW / ratio;

        const scaleFactor = newW / startState.w;
        newCW = startState.cw * scaleFactor;
        newCH = startState.ch * scaleFactor;
        newCX = startState.cx * scaleFactor;
        newCY = startState.cy * scaleFactor;

        const rad = (startState.r * Math.PI) / 180;
        const deltaW = newW - startState.w;
        const deltaH = newH - startState.h;

        if (handle.includes('w')) {
          newX = startState.x - (deltaW * Math.cos(rad));
          newY = startState.y - (deltaW * Math.sin(rad));
        }
        if (handle.includes('n')) {
          newX = newX + (deltaH * Math.sin(rad));
          newY = newY - (deltaH * Math.cos(rad));
        }
      } else {
        if (handle === 'e') {
          const maxW = startState.cx + startState.cw;
          const tentativeW = Math.max(20, startState.w + dx);
          newW = Math.min(tentativeW, maxW);
        } else if (handle === 'w') {
          const minDx = startState.cx;
          const maxDx = startState.w - 20;
          dx = Math.min(maxDx, Math.max(minDx, dx));
          newW = startState.w - dx;
          const rad = (startState.r * Math.PI) / 180;
          newX = startState.x + (dx * Math.cos(rad));
          newY = startState.y + (dx * Math.sin(rad));
          newCX = startState.cx - dx;
        } else if (handle === 's') {
          const maxH = startState.cy + startState.ch;
          const tentativeH = Math.max(20, startState.h + dy);
          newH = Math.min(tentativeH, maxH);
        } else if (handle === 'n') {
          const minDy = startState.cy;
          const maxDy = startState.h - 20;
          dy = Math.min(maxDy, Math.max(minDy, dy));
          newH = startState.h - dy;
          const rad = (startState.r * Math.PI) / 180;
          newX = startState.x - (dy * Math.sin(rad));
          newY = startState.y + (dy * Math.cos(rad));
          newCY = startState.cy - dy;
        }
      }

      onResize({
        width: Math.round(newW),
        height: Math.round(newH),
        x: Math.round(newX),
        y: Math.round(newY),
        contentWidth: Math.round(newCW),
        contentHeight: Math.round(newCH),
        contentX: Math.round(newCX),
        contentY: Math.round(newCY)
      });
    },
    onDragEnd: () => {
      onResizeEnd?.();
    },
  });
}

export interface PanContentDragOptions {
  object: {
    width: number;
    height: number;
    rotation: number;
    contentX?: number;
    contentY?: number;
    contentWidth?: number;
    contentHeight?: number;
  };
  scale: number;
  onPan: (updates: { contentX: number; contentY: number }) => void;
  onPanEnd?: () => void;
  disabled?: boolean;
}

export function usePanContentDrag({
  object,
  scale,
  onPan,
  onPanEnd,
  disabled = false,
}: PanContentDragOptions): PointerDragResult {
  const startStateRef = useRef({
    cx: 0, cy: 0, w: 0, h: 0, cw: 0, ch: 0, r: 0
  });

  return usePointerDrag({
    scale,
    disabled,
    onDragStart: () => {
      startStateRef.current = {
        cx: object.contentX || 0,
        cy: object.contentY || 0,
        w: object.width,
        h: object.height,
        cw: object.contentWidth || object.width,
        ch: object.contentHeight || object.height,
        r: object.rotation
      };
    },
    onDragMove: (_, delta) => {
      const { cx: startCX, cy: startCY, w, h, cw, ch, r } = startStateRef.current;
      const { dx, dy } = getRotatedDelta(delta.dx, delta.dy, r);

      const minCX = w - cw;
      const maxCX = 0;
      const minCY = h - ch;
      const maxCY = 0;

      let newCX = startCX + dx;
      let newCY = startCY + dy;

      newCX = Math.min(maxCX, Math.max(minCX, newCX));
      newCY = Math.min(maxCY, Math.max(minCY, newCY));

      onPan({
        contentX: Math.round(newCX),
        contentY: Math.round(newCY)
      });
    },
    onDragEnd: () => {
      onPanEnd?.();
    },
  });
}
