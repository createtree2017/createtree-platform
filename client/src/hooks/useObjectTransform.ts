import { useRef, useCallback, useMemo } from 'react';
import { usePointerDrag, useRotateDrag, useResizeDrag, usePanContentDrag } from './usePointerDrag';

export interface TransformableObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  contentX?: number;
  contentY?: number;
  contentWidth?: number;
  contentHeight?: number;
}

export interface ObjectTransformOptions {
  object: TransformableObject;
  scale: number;
  disabled?: boolean;
  onUpdate: (id: string, updates: Partial<TransformableObject>) => void;
  getElementRef: () => HTMLElement | null;
}

export interface ObjectTransformResult {
  moveHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  rotateHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  getResizeHandlers: (handle: string) => {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  panContentHandlers: {
    onPointerDown: (e: React.PointerEvent) => void;
  };
  canPanContent: boolean;
}

export function useObjectTransform({
  object,
  scale,
  disabled = false,
  onUpdate,
  getElementRef,
}: ObjectTransformOptions): ObjectTransformResult {
  const startPosRef = useRef({ x: 0, y: 0 });

  const handleMoveUpdate = useCallback((updates: Partial<TransformableObject>) => {
    onUpdate(object.id, updates);
  }, [object.id, onUpdate]);

  const { handlers: moveHandlers } = usePointerDrag({
    scale,
    disabled,
    onDragStart: () => {
      startPosRef.current = { x: object.x, y: object.y };
    },
    onDragMove: (_, delta) => {
      handleMoveUpdate({
        x: Math.round(startPosRef.current.x + delta.dx),
        y: Math.round(startPosRef.current.y + delta.dy),
      });
    },
  });

  const getCenterPoint = useCallback(() => {
    const el = getElementRef();
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
  }, [getElementRef]);

  const handleRotateUpdate = useCallback((newRotation: number) => {
    onUpdate(object.id, { rotation: newRotation });
  }, [object.id, onUpdate]);

  const { handlers: rotateHandlers } = useRotateDrag({
    getCenterPoint,
    initialRotation: object.rotation,
    onRotate: handleRotateUpdate,
    disabled,
  });

  const handleResizeUpdate = useCallback((updates: Partial<TransformableObject>) => {
    onUpdate(object.id, updates);
  }, [object.id, onUpdate]);

  const getResizeHandlers = useCallback((handle: string) => {
    const { handlers } = useResizeDrag({
      handle,
      object,
      scale,
      onResize: handleResizeUpdate,
      disabled,
    });
    return handlers;
  }, [object, scale, handleResizeUpdate, disabled]);

  const handlePanUpdate = useCallback((updates: { contentX: number; contentY: number }) => {
    onUpdate(object.id, updates);
  }, [object.id, onUpdate]);

  const { handlers: panContentHandlers } = usePanContentDrag({
    object,
    scale,
    onPan: handlePanUpdate,
    disabled,
  });

  const canPanContent = useMemo(() => {
    const cWidth = object.contentWidth || object.width;
    const cHeight = object.contentHeight || object.height;
    return cWidth > object.width || cHeight > object.height;
  }, [object.contentWidth, object.contentHeight, object.width, object.height]);

  return {
    moveHandlers,
    rotateHandlers,
    getResizeHandlers,
    panContentHandlers,
    canPanContent,
  };
}

export function createResizeHandler(
  handle: string,
  object: TransformableObject,
  scale: number,
  onUpdate: (id: string, updates: Partial<TransformableObject>) => void,
  disabled: boolean = false
) {
  const startStateRef = { current: { x: 0, y: 0, w: 0, h: 0, r: 0, cx: 0, cy: 0, cw: 0, ch: 0 } };
  const startPosRef = { current: { x: 0, y: 0 } };

  const getRotatedDelta = (screenDx: number, screenDy: number, rotationDeg: number) => {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      dx: screenDx * cos + screenDy * sin,
      dy: screenDy * cos - screenDx * sin
    };
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    
    e.stopPropagation();
    e.preventDefault();

    startPosRef.current = { x: e.clientX, y: e.clientY };
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

    const target = e.currentTarget as HTMLElement;
    const pointerId = e.pointerId;

    try {
      target.setPointerCapture(pointerId);
    } catch {}

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return;
      
      const startState = startStateRef.current;
      const screenDx = (moveEvent.clientX - startPosRef.current.x) / scale;
      const screenDy = (moveEvent.clientY - startPosRef.current.y) / scale;
      const { dx: rawDx, dy: rawDy } = getRotatedDelta(screenDx, screenDy, startState.r);

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

      onUpdate(object.id, {
        width: Math.round(newW),
        height: Math.round(newH),
        x: Math.round(newX),
        y: Math.round(newY),
        contentWidth: Math.round(newCW),
        contentHeight: Math.round(newCH),
        contentX: Math.round(newCX),
        contentY: Math.round(newCY)
      });
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return;
      
      try {
        target.releasePointerCapture(pointerId);
      } catch {}
      
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  return { onPointerDown: handlePointerDown };
}
