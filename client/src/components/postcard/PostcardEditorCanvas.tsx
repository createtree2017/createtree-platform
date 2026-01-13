import { useRef, useEffect } from 'react';
import { PostcardEditorState, PostcardDesign, VariantConfig } from './types';
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
  onUpdatePanOffset
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentDesignIndex, designs, variantConfig, scale, panOffset, showBleed } = state;
  const currentDesign = designs[currentDesignIndex];

  const widthInches = variantConfig.widthMm * MM_TO_INCHES;
  const heightInches = variantConfig.heightMm * MM_TO_INCHES;
  const bleedInches = variantConfig.bleedMm * MM_TO_INCHES;
  const dpi = variantConfig.dpi;

  const canvasWidthPx = widthInches * dpi;
  const canvasHeightPx = heightInches * dpi;
  const bleedPx = bleedInches * dpi;

  const isDraggingPan = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });

  const handlePanMouseDown = (e: React.MouseEvent) => {
    if (!isPanningMode) return;
    isDraggingPan.current = true;
    lastPanPos.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingPan.current) return;
      
      const dx = e.clientX - lastPanPos.current.x;
      const dy = e.clientY - lastPanPos.current.y;
      
      onUpdatePanOffset({
        x: panOffset.x + dx,
        y: panOffset.y + dy
      });
      
      lastPanPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleGlobalMouseUp = () => {
      isDraggingPan.current = false;
    };

    if (isPanningMode) {
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
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
      className={`flex-1 bg-gray-200 overflow-hidden flex items-center justify-center relative select-none ${isPanningMode ? (isDraggingPan.current ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      onClick={handleBackgroundClick}
      onMouseDown={handlePanMouseDown}
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
