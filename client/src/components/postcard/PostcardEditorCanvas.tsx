import { useRef, useCallback } from 'react';
import { PostcardEditorState, getEffectiveDimensions } from './types';
import { CanvasObject, AssetItem } from '../photobook-v2/types';
import { DraggableObject } from '../photobook-v2/DraggableObject';
import { generateId, screenToCanvasCoordinates } from '../photobook-v2/utils';
import { DISPLAY_DPI } from '../photobook-v2/constants';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useMobile } from '@/hooks/use-mobile';
import { computeDefaultImagePlacement } from '@/utils/canvasPlacement';

interface PostcardEditorCanvasProps {
  state: PostcardEditorState;
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
  workspaceRef?: React.RefObject<HTMLDivElement>;
  onPreviewImage?: (obj: CanvasObject) => void;
}

const MM_TO_INCHES = 1 / 25.4;

export const PostcardEditorCanvas: React.FC<PostcardEditorCanvasProps> = ({
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
  workspaceRef,
  onPreviewImage
}) => {
  const isMobile = useMobile();
  const containerRef = useRef<HTMLDivElement>(null);
  const internalWorkspaceRef = useRef<HTMLDivElement>(null);
  const effectiveWorkspaceRef = workspaceRef || internalWorkspaceRef;
  const { currentDesignIndex, designs, variantConfig, scale, panOffset, showBleed } = state;
  const currentDesign = designs[currentDesignIndex];
  const orientation = currentDesign?.orientation || 'landscape';

  const dims = getEffectiveDimensions(variantConfig, orientation, DISPLAY_DPI);
  const bleedInches = variantConfig.bleedMm * MM_TO_INCHES;

  const canvasWidthPx = dims.widthPx;
  const canvasHeightPx = dims.heightPx;
  const bleedPx = bleedInches * DISPLAY_DPI;

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
    
    const placement = computeDefaultImagePlacement({
      assetWidth: asset.width,
      assetHeight: asset.height,
      canvasWidthPx,
      canvasHeightPx,
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
      zIndex: currentDesign.objects.length + 1,
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

  const getBackgroundStyle = () => {
    const bg = currentDesign?.background;
    if (!bg || bg.startsWith('#')) {
      return { backgroundColor: bg || '#ffffff' };
    }
    return {
      backgroundColor: '#ffffff',
      backgroundImage: `url(${bg})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center'
    };
  };

  return (
    <div 
      ref={effectiveWorkspaceRef}
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
          width: canvasWidthPx,
          height: canvasHeightPx,
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div 
          className="absolute inset-0 overflow-hidden"
          style={getBackgroundStyle()}
        />

        <div className="absolute inset-0 overflow-hidden z-20">
          {currentDesign?.objects
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
              />
          ))}
        </div>

        {showBleed && (
          <div 
            className="absolute pointer-events-none z-30 border-2 border-red-400 opacity-50" 
            style={{ 
              left: bleedPx, 
              top: bleedPx, 
              right: bleedPx, 
              bottom: bleedPx 
            }}
          >
            <div className="absolute top-0 right-0 bg-red-400 text-white text-[20px] px-2 font-bold">Safe Area</div>
          </div>
        )}

        <div className="absolute inset-0 overflow-visible z-30 pointer-events-none">
          {!isPanningMode && currentDesign?.objects
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
