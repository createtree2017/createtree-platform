import { useRef, useCallback, useMemo } from 'react';
import { CanvasObject } from './types';
import { RefreshCw, Trash2, ArrowUp, ArrowDown, Move, Copy, FlipHorizontal2, Scan } from 'lucide-react';
import { usePointerDrag } from '@/hooks/usePointerDrag';
import { useMobile } from '@/hooks/use-mobile';

interface SnapCallbacks {
  onDragStart?: () => void;
  onDragMove?: (x: number, y: number, width: number, height: number) => { x: number; y: number };
  onDragEnd?: () => void;
}

interface DraggableObjectProps {
  object: CanvasObject;
  isSelected: boolean;
  scale: number;
  isPanningMode?: boolean;
  onSelect: (e: React.MouseEvent | React.PointerEvent) => void;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
  onDelete: (id: string) => void;
  onChangeOrder: (id: string, direction: 'up' | 'down') => void;
  onDuplicate: (id: string) => void;
  onDoubleClick?: (object: CanvasObject) => void;
  renderLayer: 'content' | 'overlay';
  snapCallbacks?: SnapCallbacks;
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

export const DraggableObject: React.FC<DraggableObjectProps> = ({
  object,
  isSelected,
  scale,
  isPanningMode = false,
  onSelect,
  onUpdate,
  onDelete,
  onChangeOrder,
  onDuplicate,
  onDoubleClick,
  renderLayer,
  snapCallbacks,
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const objectStartRef = useRef({ x: 0, y: 0 });

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (renderLayer === 'overlay') return;
    e.stopPropagation();
    if (onDoubleClick && object.type === 'image') {
      onDoubleClick(object);
    }
  };

  const { handlers: moveHandlers } = usePointerDrag({
    scale,
    disabled: isPanningMode || renderLayer === 'overlay',
    onDragStart: (e) => {
      objectStartRef.current = { x: object.x, y: object.y };
      onSelect(e as unknown as React.PointerEvent);
      snapCallbacks?.onDragStart?.();
    },
    onDragMove: (_, delta) => {
      let newX = Math.round(objectStartRef.current.x + delta.dx);
      let newY = Math.round(objectStartRef.current.y + delta.dy);
      
      if (snapCallbacks?.onDragMove) {
        const snapped = snapCallbacks.onDragMove(newX, newY, object.width, object.height);
        newX = snapped.x;
        newY = snapped.y;
      }
      
      onUpdate(object.id, { x: newX, y: newY });
    },
    onDragEnd: () => {
      snapCallbacks?.onDragEnd?.();
    },
  });

  const objectMoveStartRef = useRef({ x: 0, y: 0 });
  const { handlers: objectMoveHandlers } = usePointerDrag({
    scale,
    disabled: isPanningMode,
    onDragStart: () => {
      objectMoveStartRef.current = { x: object.x, y: object.y };
      snapCallbacks?.onDragStart?.();
    },
    onDragMove: (_, delta) => {
      let newX = Math.round(objectMoveStartRef.current.x + delta.dx);
      let newY = Math.round(objectMoveStartRef.current.y + delta.dy);
      
      if (snapCallbacks?.onDragMove) {
        const snapped = snapCallbacks.onDragMove(newX, newY, object.width, object.height);
        newX = snapped.x;
        newY = snapped.y;
      }
      
      onUpdate(object.id, { x: newX, y: newY });
    },
    onDragEnd: () => {
      snapCallbacks?.onDragEnd?.();
    },
  });

  const rotateStartRef = useRef({ angle: 0, rotation: 0 });
  const rotateCenterRef = useRef({ x: 0, y: 0 });
  const { handlers: rotateHandlers } = usePointerDrag({
    disabled: isPanningMode,
    onDragStart: (e) => {
      const rect = elementRef.current?.getBoundingClientRect();
      if (!rect) return;
      
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      rotateCenterRef.current = { x: centerX, y: centerY };
      
      const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      rotateStartRef.current = { angle: startAngle, rotation: object.rotation };
    },
    onDragMove: (e) => {
      const { x: centerX, y: centerY } = rotateCenterRef.current;
      const currentAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
      const deltaAngle = currentAngle - rotateStartRef.current.angle;
      onUpdate(object.id, { rotation: Math.round(rotateStartRef.current.rotation + deltaAngle) });
    },
  });

  const panStartRef = useRef({ cx: 0, cy: 0 });
  const { handlers: panHandlers } = usePointerDrag({
    scale,
    disabled: isPanningMode,
    onDragStart: () => {
      panStartRef.current = {
        cx: object.contentX || 0,
        cy: object.contentY || 0,
      };
    },
    onDragMove: (_, delta) => {
      const w = object.width;
      const h = object.height;
      const cw = object.contentWidth || w;
      const ch = object.contentHeight || h;
      const { dx, dy } = getRotatedDelta(delta.dx, delta.dy, object.rotation);

      const minCX = w - cw;
      const maxCX = 0;
      const minCY = h - ch;
      const maxCY = 0;

      let newCX = panStartRef.current.cx + dx;
      let newCY = panStartRef.current.cy + dy;

      newCX = Math.min(maxCX, Math.max(minCX, newCX));
      newCY = Math.min(maxCY, Math.max(minCY, newCY));

      onUpdate(object.id, {
        contentX: Math.round(newCX),
        contentY: Math.round(newCY)
      });
    },
  });

  const createResizeHandler = useCallback((handle: string) => {
    const resizeStartRef = { current: { x: 0, y: 0, w: 0, h: 0, r: 0, cx: 0, cy: 0, cw: 0, ch: 0 } };
    const resizePosRef = { current: { x: 0, y: 0 } };

    return (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();

      resizePosRef.current = { x: e.clientX, y: e.clientY };
      resizeStartRef.current = {
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
        
        const startState = resizeStartRef.current;
        const screenDx = (moveEvent.clientX - resizePosRef.current.x) / scale;
        const screenDy = (moveEvent.clientY - resizePosRef.current.y) / scale;
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
  }, [object, scale, onUpdate]);

  const resizeHandlers = useMemo(() => ({
    e: createResizeHandler('e'),
    w: createResizeHandler('w'),
    n: createResizeHandler('n'),
    s: createResizeHandler('s'),
    ne: createResizeHandler('ne'),
    nw: createResizeHandler('nw'),
    se: createResizeHandler('se'),
    sw: createResizeHandler('sw'),
  }), [createResizeHandler]);

  const isMobile = useMobile();
  const handleSize = 12 / scale; 
  const handleOffset = handleSize / 2;
  const touchAreaSize = isMobile ? handleSize * 2 : handleSize;
  const touchAreaOffset = touchAreaSize / 2;

  const cWidth = object.contentWidth || object.width;
  const cHeight = object.contentHeight || object.height;
  const cX = object.contentX || 0;
  const cY = object.contentY || 0;
  
  const canPanContent = cWidth > object.width || cHeight > object.height;

  if (renderLayer === 'content') {
    return (
        <div
            ref={elementRef}
            className={`absolute group touch-none select-none ${isPanningMode ? 'pointer-events-none' : 'cursor-move'}`}
            style={{
                transform: `translate3d(${object.x}px, ${object.y}px, 0) rotate(${object.rotation}deg)`,
                width: `${object.width}px`,
                height: `${object.height}px`,
                zIndex: object.zIndex,
                willChange: 'transform',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                touchAction: 'none',
            }}
            onPointerDown={moveHandlers.onPointerDown}
            onDoubleClick={handleDoubleClick}
            onClick={(e) => e.stopPropagation()} 
        >
            <div 
                className={`w-full h-full relative overflow-hidden ${!isSelected && !isPanningMode ? 'hover:outline hover:outline-1 hover:outline-indigo-300' : ''}`}
                style={{
                    transform: object.isFlippedX ? 'scaleX(-1)' : undefined
                }}
            >
                {object.type === 'image' && (
                <img 
                    src={object.src} 
                    className="absolute max-w-none pointer-events-none block" 
                    alt="content"
                    draggable={false}
                    style={{
                        width: `${cWidth}px`,
                        height: `${cHeight}px`,
                        left: `${cX}px`,
                        top: `${cY}px`
                    }} 
                />
                )}
            </div>
        </div>
    );
  }

  return (
    <div
      ref={elementRef}
      className="absolute touch-none select-none pointer-events-none"
      style={{
        transform: `translate3d(${object.x}px, ${object.y}px, 0) rotate(${object.rotation}deg)`,
        width: `${object.width}px`,
        height: `${object.height}px`,
        zIndex: object.zIndex,
        touchAction: 'none',
      }}
    >
        {isSelected && !isPanningMode && (
            <>
                <div className="absolute inset-0 outline outline-2 outline-indigo-500 pointer-events-none" />

                <div 
                    className="absolute left-1/2 -translate-x-1/2 flex gap-1 z-50 pointer-events-auto"
                    style={{
                        top: `-${22 / scale}px`,
                        transform: `translateX(-50%) scale(${1/scale})`,
                        transformOrigin: 'bottom center',
                        touchAction: 'none',
                    }}
                >
                    <div 
                        className="rounded-full bg-white border border-gray-400 flex items-center justify-center cursor-move shadow-md hover:bg-gray-100 text-gray-700 touch-none"
                        style={{ width: 32, height: 32, touchAction: 'none' }}
                        onPointerDown={objectMoveHandlers.onPointerDown}
                        title="오브젝트 이동"
                    >
                        <Move size={16} />
                    </div>
                    <div 
                        className="rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center cursor-grab shadow-md hover:bg-gray-600 text-white touch-none"
                        style={{ width: 32, height: 32, touchAction: 'none' }}
                        onPointerDown={rotateHandlers.onPointerDown}
                        title="회전"
                    >
                        <RefreshCw size={16} />
                    </div>
                </div>

                {canPanContent && (
                    <div 
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto"
                        style={{
                            transform: `translate(-50%, -50%) scale(${1/scale})`,
                            transformOrigin: 'center center',
                            touchAction: 'none',
                        }}
                    >
                        <div 
                            className="rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center cursor-move shadow-lg hover:bg-indigo-500 text-white touch-none"
                            style={{ width: 40, height: 40, touchAction: 'none' }}
                            onPointerDown={panHandlers.onPointerDown}
                            title="크롭 내용 이동"
                        >
                            <Scan size={20} />
                        </div>
                    </div>
                )}

                <div 
                    className="absolute left-1/2 -translate-x-1/2 flex bg-white rounded-md shadow-lg border border-gray-200 p-1" 
                    style={{ 
                        bottom: `-${20 / scale}px`, 
                        transform: `translateX(-50%) scale(${1/scale})`, 
                        transformOrigin: 'top center',
                        pointerEvents: 'auto',
                        zIndex: 100
                    }}
                >
                    <button onClick={(e) => { e.stopPropagation(); onChangeOrder(object.id, 'up'); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Bring Forward">
                        <ArrowUp size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onChangeOrder(object.id, 'down'); }} className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Send Backward">
                        <ArrowDown size={16} />
                    </button>
                    <div className="w-px bg-gray-200 mx-1 my-0.5"></div>
                    <button onClick={(e) => { e.stopPropagation(); onDuplicate(object.id); }} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="복사">
                        <Copy size={16} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onUpdate(object.id, { isFlippedX: !object.isFlippedX }); }} className="p-1.5 hover:bg-indigo-50 rounded text-indigo-600" title="좌우반전">
                        <FlipHorizontal2 size={16} />
                    </button>
                    <div className="w-px bg-gray-200 mx-1 my-0.5"></div>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(object.id); }} className="p-1.5 hover:bg-red-50 rounded text-red-500" title="삭제">
                        <Trash2 size={16} />
                    </button>
                </div>

                {/* Edge handles (E, W, N, S) with extended touch area on mobile */}
                <div 
                    className="absolute cursor-ew-resize z-50 pointer-events-auto touch-none flex items-center justify-center" 
                    style={{ width: touchAreaSize, height: touchAreaSize, right: -touchAreaOffset, top: '50%', marginTop: -touchAreaOffset, touchAction: 'none' }}
                    onPointerDown={resizeHandlers.e}
                >
                    <div className="bg-white border border-indigo-500" style={{ width: handleSize, height: handleSize }} />
                </div>
                <div 
                    className="absolute cursor-ew-resize z-50 pointer-events-auto touch-none flex items-center justify-center" 
                    style={{ width: touchAreaSize, height: touchAreaSize, left: -touchAreaOffset, top: '50%', marginTop: -touchAreaOffset, touchAction: 'none' }}
                    onPointerDown={resizeHandlers.w}
                >
                    <div className="bg-white border border-indigo-500" style={{ width: handleSize, height: handleSize }} />
                </div>
                <div 
                    className="absolute cursor-ns-resize z-50 pointer-events-auto touch-none flex items-center justify-center" 
                    style={{ width: touchAreaSize, height: touchAreaSize, left: '50%', top: -touchAreaOffset, marginLeft: -touchAreaOffset, touchAction: 'none' }}
                    onPointerDown={resizeHandlers.n}
                >
                    <div className="bg-white border border-indigo-500" style={{ width: handleSize, height: handleSize }} />
                </div>
                <div 
                    className="absolute cursor-ns-resize z-50 pointer-events-auto touch-none flex items-center justify-center" 
                    style={{ width: touchAreaSize, height: touchAreaSize, left: '50%', bottom: -touchAreaOffset, marginLeft: -touchAreaOffset, touchAction: 'none' }}
                    onPointerDown={resizeHandlers.s}
                >
                    <div className="bg-white border border-indigo-500" style={{ width: handleSize, height: handleSize }} />
                </div>

                {/* Corner handles (NW, NE, SW, SE) with extended touch area on mobile */}
                <div 
                    className="absolute cursor-nw-resize z-50 pointer-events-auto touch-none flex items-center justify-center" 
                    style={{ width: touchAreaSize, height: touchAreaSize, left: -touchAreaOffset, top: -touchAreaOffset, touchAction: 'none' }}
                    onPointerDown={resizeHandlers.nw}
                >
                    <div className="bg-white border-2 border-indigo-500 rounded-full" style={{ width: handleSize, height: handleSize }} />
                </div>
                <div 
                    className="absolute cursor-ne-resize z-50 pointer-events-auto touch-none flex items-center justify-center" 
                    style={{ width: touchAreaSize, height: touchAreaSize, right: -touchAreaOffset, top: -touchAreaOffset, touchAction: 'none' }}
                    onPointerDown={resizeHandlers.ne}
                >
                    <div className="bg-white border-2 border-indigo-500 rounded-full" style={{ width: handleSize, height: handleSize }} />
                </div>
                <div 
                    className="absolute cursor-sw-resize z-50 pointer-events-auto touch-none flex items-center justify-center" 
                    style={{ width: touchAreaSize, height: touchAreaSize, left: -touchAreaOffset, bottom: -touchAreaOffset, touchAction: 'none' }}
                    onPointerDown={resizeHandlers.sw}
                >
                    <div className="bg-white border-2 border-indigo-500 rounded-full" style={{ width: handleSize, height: handleSize }} />
                </div>
                <div 
                    className="absolute cursor-se-resize z-50 pointer-events-auto touch-none flex items-center justify-center" 
                    style={{ width: touchAreaSize, height: touchAreaSize, right: -touchAreaOffset, bottom: -touchAreaOffset, touchAction: 'none' }}
                    onPointerDown={resizeHandlers.se}
                >
                    <div className="bg-white border-2 border-indigo-500 rounded-full" style={{ width: handleSize, height: handleSize }} />
                </div>
            </>
        )}
    </div>
  );
};
