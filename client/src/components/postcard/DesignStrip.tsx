import { useState, useRef } from 'react';
import { PostcardDesign, VariantConfig } from './types';
import { Plus, Minus, X, Edit2, Check, GripVertical } from 'lucide-react';

interface DesignStripProps {
  designs: PostcardDesign[];
  currentDesignIndex: number;
  variantConfig: VariantConfig;
  onSelectDesign: (index: number) => void;
  onAddDesign: () => void;
  onDeleteDesign: (index: number) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onReorderDesign?: (fromIndex: number, toIndex: number) => void;
}

const MM_TO_INCHES = 1 / 25.4;

const getBackgroundStyle = (bg: string | undefined): React.CSSProperties => {
  if (!bg) return { backgroundColor: '#ffffff' };
  if (bg.startsWith('#')) {
    return { backgroundColor: bg };
  }
  return { 
    backgroundImage: `url(${bg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };
};

export const DesignStrip: React.FC<DesignStripProps> = ({
  designs,
  currentDesignIndex,
  variantConfig,
  onSelectDesign,
  onAddDesign,
  onDeleteDesign,
  onUpdateQuantity,
  onReorderDesign
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggedRef = useRef<number | null>(null);

  const widthInches = variantConfig.widthMm * MM_TO_INCHES;
  const heightInches = variantConfig.heightMm * MM_TO_INCHES;
  const ratio = widthInches / heightInches;
  const thumbHeight = 80;
  const thumbWidth = thumbHeight * ratio;

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (!isEditMode) return;
    draggedRef.current = index;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (!isEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (draggedRef.current !== null && draggedRef.current !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = draggedRef.current;
    if (fromIndex !== null && fromIndex !== toIndex && onReorderDesign) {
      onReorderDesign(fromIndex, toIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
    draggedRef.current = null;
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
    draggedRef.current = null;
  };

  const handleQuantityChange = (e: React.MouseEvent, index: number, delta: number) => {
    e.stopPropagation();
    const design = designs[index];
    const newQuantity = Math.max(1, (design.quantity || 1) + delta);
    onUpdateQuantity(index, newQuantity);
  };

  const handleDelete = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (designs.length > 1) {
      onDeleteDesign(index);
    }
  };

  const totalQuantity = designs.reduce((sum, d) => sum + (d.quantity || 1), 0);

  return (
    <div className="h-44 bg-gray-900 border-t border-gray-700 flex flex-col shrink-0">
      <div className="px-4 py-2 flex justify-between items-center text-xs text-gray-400 uppercase font-bold tracking-wider">
        <div className="flex items-center gap-2">
          <span>디자인</span>
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              isEditMode 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {isEditMode ? (
              <>
                <Check className="w-3 h-3" />
                완료
              </>
            ) : (
              <>
                <Edit2 className="w-3 h-3" />
                편집
              </>
            )}
          </button>
        </div>
        <span>{designs.length}개 디자인 · 총 {totalQuantity}장</span>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center px-4 space-x-4 pb-2">
        {designs.map((design, index) => {
          const isActive = index === currentDesignIndex;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          const quantity = design.quantity || 1;
          
          return (
            <div 
              key={design.id}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => !isEditMode && onSelectDesign(index)}
              className={`
                relative shrink-0 rounded-lg overflow-hidden transition-all cursor-pointer group
                ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-gray-900' : 'hover:ring-1 hover:ring-gray-500'}
                ${isDragging ? 'opacity-50' : ''}
                ${isDragOver ? 'ring-2 ring-blue-400' : ''}
                ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}
              `}
              style={{ width: thumbWidth + 24, minWidth: thumbWidth + 24 }}
            >
              {isEditMode && (
                <div className="absolute top-1 left-1 z-20 bg-gray-800/90 rounded p-0.5 cursor-grab">
                  <GripVertical className="w-3 h-3 text-gray-400" />
                </div>
              )}
              
              {designs.length > 1 && (
                <button
                  onClick={(e) => handleDelete(e, index)}
                  className="absolute top-1 right-1 z-20 bg-red-500/90 hover:bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
              
              <div 
                className="w-full overflow-hidden relative mx-auto mt-2"
                style={{ 
                  width: thumbWidth, 
                  height: thumbHeight,
                  ...getBackgroundStyle(design.background)
                }}
              >
                <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                  {design.objects.length > 0 ? (
                    <span className="bg-gray-800/70 px-1 rounded">{design.objects.length} 오브젝트</span>
                  ) : (
                    <span className="text-gray-500">빈 디자인</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center gap-1 py-1 px-2 bg-gray-800">
                <button
                  onClick={(e) => handleQuantityChange(e, index, -1)}
                  disabled={quantity <= 1}
                  className="p-0.5 rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-300"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-medium text-white min-w-[20px] text-center">{quantity}</span>
                <button
                  onClick={(e) => handleQuantityChange(e, index, 1)}
                  className="p-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              
              <div className={`absolute inset-x-0 bottom-0 h-0.5 ${isActive ? 'bg-indigo-500' : 'bg-transparent'}`} />
            </div>
          );
        })}
        
        <button 
          onClick={onAddDesign}
          className="shrink-0 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-gray-500 hover:border-gray-500 hover:text-gray-400 hover:bg-gray-800/50 transition-colors"
          style={{ width: thumbWidth + 24, height: thumbHeight + 48 }}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
