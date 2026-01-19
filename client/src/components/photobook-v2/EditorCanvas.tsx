import { useRef, useCallback, useMemo } from 'react';
import { EditorState, CanvasObject, AssetItem } from './types';
import { DraggableObject } from './DraggableObject';
import { DISPLAY_DPI, BLEED_INCHES } from './constants';
import { generateId, screenToCanvasCoordinates } from './utils';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useMobile } from '@/hooks/use-mobile';
import { computeSpreadImagePlacement } from '@/utils/canvasPlacement';
import { useSnapGuide } from '@/hooks/useSnapGuide';
import { SnapGuideLines } from '@/components/SnapGuideLines';

interface SnapCallbacks {
  onDragStart?: () => void;
  onDragMove?: (x: number, y: number, width: number, height: number) => { x: number; y: number };
  onDragEnd?: () => void;
}

interface EditorCanvasProps {
  state: EditorState;
  isPanningMode: boolean;
  isMagnifierMode?: boolean;
  onUpdateObject: (id: string, updates: Partial<CanvasObject>) => void;
  onSelectObject: (id: string | null) => void;
  onAddObject: (obj: CanvasObject) => void;
  onDeleteObject: (id: string) => void;
  onDuplicateObject: (id: string) => void;
  onChangeOrder: (id: string, dir: 'up' | 'down') => void;
  onUpdatePanOffset: (offset: { x: number, y: number }) => void;
  onSetScale?: (scale: number) => void;
  onPreviewImage?: (obj: CanvasObject) => void;
}

export const EditorCanvas: React.FC<EditorCanvasProps> = ({
  state,
  isPanningMode,
  isMagnifierMode = false,
  onUpdateObject,
  onSelectObject,
  onAddObject,
  onDeleteObject,
  onDuplicateObject,
  onChangeOrder,
  onUpdatePanOffset,
  onSetScale,
  onPreviewImage
}) => {
  const isMobile = useMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentSpreadIndex, spreads, albumSize, scale, panOffset, showBleed } = state;
  const showGrid = (state as { showGrid?: boolean }).showGrid;
  const currentSpread = spreads[currentSpreadIndex];

  const pageWidthPx = albumSize.widthInches * DISPLAY_DPI;
  const pageHeightPx = albumSize.heightInches * DISPLAY_DPI;
  const spreadWidthPx = pageWidthPx * 2;
  const spreadHeightPx = pageHeightPx;
  
  const bleedPx = BLEED_INCHES * DISPLAY_DPI;

  const { activeLines, startSnapping, updateSnap, endSnapping } = useSnapGuide();

  const canvasBounds = useMemo(() => ({
    width: spreadWidthPx,
    height: spreadHeightPx,
  }), [spreadWidthPx, spreadHeightPx]);

  const getSnapCallbacks = useCallback((objectId: string): SnapCallbacks => ({
    onDragStart: () => {
      startSnapping(canvasBounds, currentSpread.objects, objectId);
    },
    onDragMove: (x: number, y: number, width: number, height: number) => {
      return updateSnap(x, y, width, height);
    },
    onDragEnd: () => {
      endSnapping();
    },
  }), [canvasBounds, currentSpread.objects, startSnapping, updateSnap, endSnapping]);

  const isDraggingPan = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const panStartOffset = useRef({ x: 0, y: 0 });
  const activePointerIdRef = useRef<number | null>(null);

  const handlePanPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPanningMode) return;
    
    e.preventDefault();
    isDraggingPan.current = true;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
    panStartOffset.current = { x: panOffset.x, y: panOffset.y };
    activePointerIdRef.current = e.pointerId;
    
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingPan.current || moveEvent.pointerId !== activePointerIdRef.current) return;
      
      const dx = moveEvent.clientX - lastPanPos.current.x;
      const dy = moveEvent.clientY - lastPanPos.current.y;
      
      panStartOffset.current = {
        x: panStartOffset.current.x + dx,
        y: panStartOffset.current.y + dy
      };
      
      onUpdatePanOffset({
        x: panStartOffset.current.x,
        y: panStartOffset.current.y
      });
      
      lastPanPos.current = { x: moveEvent.clientX, y: moveEvent.clientY };
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== activePointerIdRef.current) return;
      
      isDraggingPan.current = false;
      activePointerIdRef.current = null;
      
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(upEvent.pointerId);
      } catch {}
      
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  }, [isPanningMode, onUpdatePanOffset]);

  const pinchZoomEnabled = isMobile && isMagnifierMode && !!onSetScale;
  const { handlers: pinchZoomHandlers } = usePinchZoom({
    scale,
    panOffset,
    minScale: 0.1,
    maxScale: 3,
    enabled: pinchZoomEnabled,
    onScaleChange: (newScale) => {
      if (onSetScale) onSetScale(newScale);
    },
    onPanChange: onUpdatePanOffset
  });

  const handleCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (pinchZoomEnabled) {
      pinchZoomHandlers.onPointerDown(e);
    } else if (isPanningMode) {
      handlePanPointerDown(e);
    }
  }, [pinchZoomEnabled, isPanningMode, pinchZoomHandlers, handlePanPointerDown]);

  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (pinchZoomEnabled) {
      pinchZoomHandlers.onPointerMove(e);
    }
  }, [pinchZoomEnabled, pinchZoomHandlers]);

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (pinchZoomEnabled) {
      pinchZoomHandlers.onPointerUp(e);
    }
  }, [pinchZoomEnabled, pinchZoomHandlers]);

  const handleCanvasPointerCancel = useCallback((e: React.PointerEvent) => {
    if (pinchZoomEnabled) {
      pinchZoomHandlers.onPointerCancel(e);
    }
  }, [pinchZoomEnabled, pinchZoomHandlers]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const assetData = e.dataTransfer.getData('application/json');
    if (!assetData) return;

    const asset: AssetItem = JSON.parse(assetData);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const coords = screenToCanvasCoordinates(e.clientX, e.clientY, rect, scale);
    
    const placement = computeSpreadImagePlacement({
      assetWidth: asset.width,
      assetHeight: asset.height,
      pageWidthPx,
      pageHeightPx,
      spreadWidthPx,
      mode: 'cover',
    });
    
    const newObject: CanvasObject = {
      id: generateId(),
      type: 'image',
      src: asset.url,
      fullSrc: asset.fullUrl || asset.url,
      x: coords.x - placement.width / 2,
      y: coords.y - placement.height / 2,
      width: placement.width,
      height: placement.height,
      rotation: 0,
      contentX: placement.contentX,
      contentY: placement.contentY,
      contentWidth: placement.contentWidth,
      contentHeight: placement.contentHeight,
      zIndex: currentSpread.objects.length + 1,
      opacity: 1,
    };

    onAddObject(newObject);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleBackgroundClick = () => {
    if (!isPanningMode) {
      onSelectObject(null);
    }
  };

  return (
    <div 
      className={`flex-1 bg-gray-200 overflow-hidden flex items-center justify-center relative select-none ${isPanningMode ? (isDraggingPan.current ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      style={{ touchAction: isPanningMode || pinchZoomEnabled ? 'none' : 'auto' }}
      onClick={handleBackgroundClick}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerCancel}
    >
      <div 
        ref={containerRef}
        className="relative shrink-0 shadow-2xl transition-transform duration-75 ease-out"
        style={{
          width: spreadWidthPx,
          height: spreadHeightPx,
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div className="absolute inset-0 overflow-hidden flex">
            <div 
              className="w-1/2 h-full"
              style={{
                backgroundColor: (currentSpread.backgroundLeft || currentSpread.background)?.startsWith('#') 
                  ? (currentSpread.backgroundLeft || currentSpread.background) 
                  : '#ffffff',
                backgroundImage: (currentSpread.backgroundLeft || currentSpread.background) && !(currentSpread.backgroundLeft || currentSpread.background)?.startsWith('#') 
                  ? `url(${currentSpread.backgroundLeft || currentSpread.background})` 
                  : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div 
              className="w-1/2 h-full"
              style={{
                backgroundColor: (currentSpread.backgroundRight || currentSpread.background)?.startsWith('#') 
                  ? (currentSpread.backgroundRight || currentSpread.background) 
                  : '#ffffff',
                backgroundImage: (currentSpread.backgroundRight || currentSpread.background) && !(currentSpread.backgroundRight || currentSpread.background)?.startsWith('#') 
                  ? `url(${currentSpread.backgroundRight || currentSpread.background})` 
                  : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
        </div>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div 
              className="absolute top-0 bottom-0 left-1/2 w-16 -ml-8 z-0" 
              style={{
                background: 'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.05) 45%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.05) 55%, rgba(0,0,0,0) 100%)'
              }}
            />

            <div className="absolute top-0 bottom-0 left-1/2 w-0 border-l border-dashed border-gray-300 z-10" />

            {showGrid && (
              <div 
                className="absolute inset-0 z-0 opacity-20"
                style={{ 
                  backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
                  backgroundSize: `${DISPLAY_DPI/2}px ${DISPLAY_DPI/2}px`
                }} 
              />
            )}

            <div className="absolute bottom-4 left-4 text-gray-400 text-2xl font-bold select-none">
              {currentSpreadIndex * 2 + 1}
            </div>
            <div className="absolute bottom-4 right-4 text-gray-400 text-2xl font-bold select-none">
              {currentSpreadIndex * 2 + 2}
            </div>
        </div>

        <div className="absolute inset-0 overflow-hidden z-20">
            {currentSpread.objects
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((obj) => (
                <DraggableObject
                  key={obj.id}
                  object={obj}
                  isSelected={state.selectedObjectId === obj.id}
                  scale={scale}
                  isPanningMode={isPanningMode}
                  onSelect={() => !isPanningMode && onSelectObject(obj.id)}
                  onUpdate={onUpdateObject}
                  onDelete={onDeleteObject}
                  onDuplicate={onDuplicateObject}
                  onChangeOrder={onChangeOrder}
                  onDoubleClick={onPreviewImage}
                  renderLayer="content"
                  snapCallbacks={getSnapCallbacks(obj.id)}
                />
            ))}
        </div>

        {showBleed && (
          <div className="absolute inset-0 pointer-events-none z-30 border-2 border-red-400 opacity-50" style={{ margin: `${bleedPx}px` }}>
            <div className="absolute top-0 right-0 bg-red-400 text-white text-[20px] px-2 font-bold">Safe Area</div>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none z-40">
          <SnapGuideLines
            activeLines={activeLines}
            canvasWidth={spreadWidthPx}
            canvasHeight={spreadHeightPx}
            scale={scale}
          />
        </div>

        <div className="absolute inset-0 overflow-visible z-50 pointer-events-none">
            {!isPanningMode && currentSpread.objects
              .sort((a, b) => a.zIndex - b.zIndex)
              .map((obj) => (
                <DraggableObject
                  key={`overlay-${obj.id}`}
                  object={obj}
                  isSelected={state.selectedObjectId === obj.id}
                  scale={scale}
                  isPanningMode={isPanningMode}
                  onSelect={() => onSelectObject(obj.id)}
                  onUpdate={onUpdateObject}
                  onDelete={onDeleteObject}
                  onDuplicate={onDuplicateObject}
                  onChangeOrder={onChangeOrder}
                  renderLayer="overlay"
                />
            ))}
        </div>

      </div>
    </div>
  );
};
