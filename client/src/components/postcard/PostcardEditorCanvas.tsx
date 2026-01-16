import { useRef, useCallback } from 'react';
import { PostcardEditorState, getEffectiveDimensions } from './types';
import { CanvasObject, AssetItem } from '../photobook-v2/types';
import { DraggableObject } from '../photobook-v2/DraggableObject';
import { generateId, screenToCanvasCoordinates } from '../photobook-v2/utils';

interface PostcardEditorCanvasProps {
  state: PostcardEditorState;
  isPanningMode: boolean;
  onUpdateObject: (id: string, updates: Partial<CanvasObject>) => void;
  onSelectObject: (id: string | null) => void;
  onAddObject: (obj: CanvasObject) => void;
  onDeleteObject: (id: string) => void;
  onDuplicateObject: (id: string) => void;
  onChangeOrder: (id: string, dir: 'up' | 'down') => void;
  onUpdatePanOffset: (offset: { x: number, y: number }) => void;
  workspaceRef?: React.RefObject<HTMLDivElement>;
  onPreviewImage?: (obj: CanvasObject) => void;
}

const MM_TO_INCHES = 1 / 25.4;

export const PostcardEditorCanvas: React.FC<PostcardEditorCanvasProps> = ({
  state,
  isPanningMode,
  onUpdateObject,
  onSelectObject,
  onAddObject,
  onDeleteObject,
  onDuplicateObject,
  onChangeOrder,
  onUpdatePanOffset,
  workspaceRef,
  onPreviewImage
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const internalWorkspaceRef = useRef<HTMLDivElement>(null);
  const effectiveWorkspaceRef = workspaceRef || internalWorkspaceRef;
  const { currentDesignIndex, designs, variantConfig, scale, panOffset, showBleed } = state;
  const currentDesign = designs[currentDesignIndex];
  const orientation = currentDesign?.orientation || 'landscape';

  const dims = getEffectiveDimensions(variantConfig, orientation);
  const bleedInches = variantConfig.bleedMm * MM_TO_INCHES;
  const dpi = variantConfig.dpi;

  const canvasWidthPx = dims.widthPx;
  const canvasHeightPx = dims.heightPx;
  const bleedPx = bleedInches * dpi;

  const isDraggingPan = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const activePointerIdRef = useRef<number | null>(null);

  const handlePanPointerDown = useCallback((e: React.PointerEvent) => {
    if (!isPanningMode) return;
    
    e.preventDefault();
    isDraggingPan.current = true;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
    activePointerIdRef.current = e.pointerId;
    
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingPan.current || moveEvent.pointerId !== activePointerIdRef.current) return;
      
      const dx = moveEvent.clientX - lastPanPos.current.x;
      const dy = moveEvent.clientY - lastPanPos.current.y;
      
      onUpdatePanOffset({
        x: panOffset.x + dx,
        y: panOffset.y + dy
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
  }, [isPanningMode, panOffset, onUpdatePanOffset]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const assetData = e.dataTransfer.getData('application/json');
    if (!assetData) return;

    const asset: AssetItem = JSON.parse(assetData);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const coords = screenToCanvasCoordinates(e.clientX, e.clientY, rect, scale);
    
    const defaultWidth = canvasWidthPx * 0.4;
    const ratio = asset.width / asset.height;
    const defaultHeight = defaultWidth / ratio;
    
    const newObject: CanvasObject = {
      id: generateId(),
      type: 'image',
      src: asset.url,
      fullSrc: asset.fullUrl || asset.url,
      x: coords.x - defaultWidth / 2,
      y: coords.y - defaultHeight / 2,
      width: defaultWidth,
      height: defaultHeight,
      rotation: 0,
      contentX: 0,
      contentY: 0,
      contentWidth: defaultWidth,
      contentHeight: defaultHeight,
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
      style={{ touchAction: isPanningMode ? 'none' : 'auto' }}
      onClick={handleBackgroundClick}
      onPointerDown={handlePanPointerDown}
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
