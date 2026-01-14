import { useRef } from 'react';
import { CanvasObject } from './types';
import { RefreshCw, Trash2, ArrowUp, ArrowDown, Move, Copy, FlipHorizontal2, Scan } from 'lucide-react';

interface DraggableObjectProps {
  object: CanvasObject;
  isSelected: boolean;
  scale: number;
  isPanningMode?: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onUpdate: (id: string, updates: Partial<CanvasObject>) => void;
  onDelete: (id: string) => void;
  onChangeOrder: (id: string, direction: 'up' | 'down') => void;
  onDuplicate: (id: string) => void;
  onDoubleClick?: (object: CanvasObject) => void;
  renderLayer: 'content' | 'overlay';
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
  renderLayer
}) => {
  const elementRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const objectStart = useRef({ 
    x: 0, y: 0, w: 0, h: 0, r: 0,
    cw: 0, ch: 0, cx: 0, cy: 0
  });

  const getRotatedDelta = (screenDx: number, screenDy: number, rotationDeg: number) => {
    const rad = (rotationDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    return {
      dx: screenDx * cos + screenDy * sin,
      dy: screenDy * cos - screenDx * sin
    };
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (renderLayer === 'overlay') return;
    e.stopPropagation();
    if (onDoubleClick && object.type === 'image') {
      onDoubleClick(object);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (renderLayer === 'overlay') return;
    e.stopPropagation();
    onSelect(e);
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    objectStart.current = { 
        x: object.x, y: object.y, w: object.width, h: object.height, r: object.rotation,
        cw: object.contentWidth || object.width, ch: object.contentHeight || object.height,
        cx: object.contentX || 0, cy: object.contentY || 0
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = (moveEvent.clientX - dragStart.current.x) / scale;
      const dy = (moveEvent.clientY - dragStart.current.y) / scale;

      onUpdate(object.id, {
        x: Math.round(objectStart.current.x + dx),
        y: Math.round(objectStart.current.y + dy),
      });
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeStart = (e: React.MouseEvent, handle: string) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    
    const startState = {
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

    const handleResizeMove = (moveEvent: MouseEvent) => {
        const screenDx = (moveEvent.clientX - startX) / scale;
        const screenDy = (moveEvent.clientY - startY) / scale;
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
                let tentativeW = Math.max(20, startState.w + dx);
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
                let tentativeH = Math.max(20, startState.h + dy);
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

    const handleResizeUp = () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeUp);
    };

    window.addEventListener('mousemove', handleResizeMove);
    window.addEventListener('mouseup', handleResizeUp);
  };

  const handlePanStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startCX = object.contentX || 0;
    const startCY = object.contentY || 0;
    const w = object.width;
    const h = object.height;
    const cw = object.contentWidth || w;
    const ch = object.contentHeight || h;
    const rotation = object.rotation;

    const handlePanMove = (moveEvent: MouseEvent) => {
        const screenDx = (moveEvent.clientX - startX) / scale;
        const screenDy = (moveEvent.clientY - startY) / scale;
        const { dx, dy } = getRotatedDelta(screenDx, screenDy, rotation);
        
        const minCX = w - cw;
        const maxCX = 0;
        const minCY = h - ch;
        const maxCY = 0;

        let newCX = startCX + dx;
        let newCY = startCY + dy;

        newCX = Math.min(maxCX, Math.max(minCX, newCX));
        newCY = Math.min(maxCY, Math.max(minCY, newCY));

        onUpdate(object.id, {
            contentX: Math.round(newCX),
            contentY: Math.round(newCY)
        });
    };

    const handlePanUp = () => {
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanUp);
    };

    window.addEventListener('mousemove', handlePanMove);
    window.addEventListener('mouseup', handlePanUp);
  };

  const handleObjectMoveStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startObjX = object.x;
    const startObjY = object.y;

    const handleMoveMove = (moveEvent: MouseEvent) => {
        const dx = (moveEvent.clientX - startX) / scale;
        const dy = (moveEvent.clientY - startY) / scale;

        onUpdate(object.id, {
            x: Math.round(startObjX + dx),
            y: Math.round(startObjY + dy)
        });
    };

    const handleMoveUp = () => {
        window.removeEventListener('mousemove', handleMoveMove);
        window.removeEventListener('mouseup', handleMoveUp);
    };

    window.addEventListener('mousemove', handleMoveMove);
    window.addEventListener('mouseup', handleMoveUp);
  };

  const handleRotateStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const rect = elementRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    const startRotation = object.rotation;

    const handleRotateMove = (moveEvent: MouseEvent) => {
      const currentAngle = Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) * (180 / Math.PI);
      const deltaAngle = currentAngle - startAngle;
      onUpdate(object.id, { rotation: Math.round(startRotation + deltaAngle) });
    };

    const handleRotateUp = () => {
      window.removeEventListener('mousemove', handleRotateMove);
      window.removeEventListener('mouseup', handleRotateUp);
    };

    window.addEventListener('mousemove', handleRotateMove);
    window.addEventListener('mouseup', handleRotateUp);
  };

  const handleSize = 12 / scale; 
  const handleOffset = handleSize / 2;

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
            }}
            onMouseDown={handleMouseDown}
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
      }}
    >
        {isSelected && !isPanningMode && (
            <>
                <div className="absolute inset-0 outline outline-2 outline-indigo-500 pointer-events-none" />

                {/* 상단 메뉴: 이동, 회전 */}
                <div 
                    className="absolute left-1/2 -translate-x-1/2 flex gap-1 z-50 pointer-events-auto"
                    style={{
                        top: `-${22 / scale}px`,
                        transform: `translateX(-50%) scale(${1/scale})`,
                        transformOrigin: 'bottom center'
                    }}
                >
                    <div 
                        className="rounded-full bg-white border border-gray-400 flex items-center justify-center cursor-move shadow-md hover:bg-gray-100 text-gray-700"
                        style={{ width: 32, height: 32 }}
                        onMouseDown={handleObjectMoveStart}
                        title="오브젝트 이동"
                    >
                        <Move size={16} />
                    </div>
                    <div 
                        className="rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center cursor-grab shadow-md hover:bg-gray-600 text-white"
                        style={{ width: 32, height: 32 }}
                        onMouseDown={handleRotateStart}
                        title="회전"
                    >
                        <RefreshCw size={16} />
                    </div>
                </div>

                {/* 중앙: 크롭 내용 이동 버튼 (크롭된 이미지에서만 표시) */}
                {canPanContent && (
                    <div 
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto"
                        style={{
                            transform: `translate(-50%, -50%) scale(${1/scale})`,
                            transformOrigin: 'center center'
                        }}
                    >
                        <div 
                            className="rounded-full bg-indigo-600 border-2 border-white flex items-center justify-center cursor-move shadow-lg hover:bg-indigo-500 text-white"
                            style={{ width: 40, height: 40 }}
                            onMouseDown={handlePanStart}
                            title="크롭 내용 이동"
                        >
                            <Scan size={20} />
                        </div>
                    </div>
                )}

                {/* 하단 메뉴: 복제, 위/아래, 삭제, 플립 */}
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

                <div 
                    className="absolute bg-white border border-indigo-500 cursor-ew-resize z-50 pointer-events-auto" 
                    style={{ width: handleSize, height: handleSize, right: -handleOffset, top: '50%', marginTop: -handleOffset }}
                    onMouseDown={(e) => handleResizeStart(e, 'e')} 
                />
                <div 
                    className="absolute bg-white border border-indigo-500 cursor-ew-resize z-50 pointer-events-auto" 
                    style={{ width: handleSize, height: handleSize, left: -handleOffset, top: '50%', marginTop: -handleOffset }}
                    onMouseDown={(e) => handleResizeStart(e, 'w')} 
                />
                <div 
                    className="absolute bg-white border border-indigo-500 cursor-ns-resize z-50 pointer-events-auto" 
                    style={{ width: handleSize, height: handleSize, left: '50%', top: -handleOffset, marginLeft: -handleOffset }}
                    onMouseDown={(e) => handleResizeStart(e, 'n')} 
                />
                <div 
                    className="absolute bg-white border border-indigo-500 cursor-ns-resize z-50 pointer-events-auto" 
                    style={{ width: handleSize, height: handleSize, left: '50%', bottom: -handleOffset, marginLeft: -handleOffset }}
                    onMouseDown={(e) => handleResizeStart(e, 's')} 
                />

                <div 
                    className="absolute bg-white border-2 border-indigo-500 rounded-full cursor-nw-resize z-50 pointer-events-auto" 
                    style={{ width: handleSize, height: handleSize, left: -handleOffset, top: -handleOffset }}
                    onMouseDown={(e) => handleResizeStart(e, 'nw')} 
                />
                <div 
                    className="absolute bg-white border-2 border-indigo-500 rounded-full cursor-ne-resize z-50 pointer-events-auto" 
                    style={{ width: handleSize, height: handleSize, right: -handleOffset, top: -handleOffset }}
                    onMouseDown={(e) => handleResizeStart(e, 'ne')} 
                />
                <div 
                    className="absolute bg-white border-2 border-indigo-500 rounded-full cursor-sw-resize z-50 pointer-events-auto" 
                    style={{ width: handleSize, height: handleSize, left: -handleOffset, bottom: -handleOffset }}
                    onMouseDown={(e) => handleResizeStart(e, 'sw')} 
                />
                <div 
                    className="absolute bg-white border-2 border-indigo-500 rounded-full cursor-se-resize z-50 pointer-events-auto" 
                    style={{ width: handleSize, height: handleSize, right: -handleOffset, bottom: -handleOffset }}
                    onMouseDown={(e) => handleResizeStart(e, 'se')} 
                />
            </>
        )}
    </div>
  );
};
