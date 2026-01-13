import { useState, useRef } from 'react';
import { PostcardDesign, VariantConfig, getEffectiveDimensions } from './types';
import { Plus, Minus, X, Edit2, Check, GripVertical, RotateCcw } from 'lucide-react';

interface DesignStripProps {
  designs: PostcardDesign[];
  currentDesignIndex: number;
  variantConfig: VariantConfig;
  onSelectDesign: (index: number) => void;
  onAddDesign: () => void;
  onDeleteDesign: (index: number) => void;
  onUpdateQuantity: (index: number, quantity: number) => void;
  onReorderDesign?: (fromIndex: number, toIndex: number) => void;
  onToggleOrientation?: (index: number) => void;
}

const MM_TO_INCHES = 1 / 25.4;
const DEFAULT_DPI = 300;

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
  onReorderDesign,
  onToggleOrientation
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const draggedRef = useRef<number | null>(null);

  const thumbHeight = 80;

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
      setDeleteTargetIndex(index);
      setShowDeleteDialog(true);
    }
  };

  const confirmDelete = () => {
    if (deleteTargetIndex !== null) {
      onDeleteDesign(deleteTargetIndex);
    }
    setShowDeleteDialog(false);
    setDeleteTargetIndex(null);
  };

  const totalQuantity = designs.reduce((sum, d) => sum + (d.quantity || 1), 0);

  return (
    <div className="h-44 bg-gray-100 border-t border-gray-200 flex flex-col shrink-0">
      <div className="px-4 py-2 flex justify-between items-center text-xs text-gray-600 uppercase font-bold tracking-wider">
        <div className="flex items-center gap-2">
          <span>디자인</span>
          <button
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
              isEditMode 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
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
          const orientation = design.orientation || 'landscape';
          const dims = getEffectiveDimensions(variantConfig, orientation);
          const ratio = dims.widthMm / dims.heightMm;
          const thumbWidth = thumbHeight * ratio;
          
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
                ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white' : 'hover:ring-1 hover:ring-gray-400'}
                ${isDragging ? 'opacity-50' : ''}
                ${isDragOver ? 'ring-2 ring-blue-400' : ''}
                ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}
              `}
              style={{ width: thumbWidth + 24, minWidth: thumbWidth + 24 }}
            >
              {isEditMode && (
                <div className="absolute top-1 left-1 z-20 bg-gray-200/90 rounded p-0.5 cursor-grab">
                  <GripVertical className="w-3 h-3 text-gray-600" />
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
                className="overflow-hidden relative mx-auto mt-2 bg-white shadow-sm border border-gray-300"
                style={{ 
                  width: thumbWidth, 
                  height: thumbHeight,
                  ...getBackgroundStyle(design.background)
                }}
              >
                {design.objects.map(obj => (
                  <div 
                    key={obj.id}
                    className="absolute z-10"
                    style={{
                      left: `${(obj.x / dims.widthPx) * 100}%`,
                      top: `${(obj.y / dims.heightPx) * 100}%`,
                      width: `${(obj.width / dims.widthPx) * 100}%`,
                      height: `${(obj.height / dims.heightPx) * 100}%`,
                      transform: `rotate(${obj.rotation}deg)`,
                      backgroundImage: obj.src ? `url(${obj.src})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                ))}
                {design.objects.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
                    빈 디자인
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-1 py-1 px-2 bg-gray-200">
                {onToggleOrientation && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onToggleOrientation(index); }}
                    className="p-0.5 rounded bg-gray-300 hover:bg-gray-400 text-gray-700 mr-1"
                    title={orientation === 'landscape' ? '세로로 변경' : '가로로 변경'}
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                )}
                <button
                  onClick={(e) => handleQuantityChange(e, index, -1)}
                  disabled={quantity <= 1}
                  className="p-0.5 rounded bg-gray-300 hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-medium text-gray-900 min-w-[20px] text-center">{quantity}</span>
                <button
                  onClick={(e) => handleQuantityChange(e, index, 1)}
                  className="p-0.5 rounded bg-gray-300 hover:bg-gray-400 text-gray-700"
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
          className="shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 hover:bg-gray-200/50 transition-colors"
          style={{ width: thumbHeight * 1.4 + 24, height: thumbHeight + 48 }}
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowDeleteDialog(false)}
          ></div>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full z-10 overflow-hidden animate-in fade-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">디자인 삭제</h3>
              <p className="text-gray-600 mb-6">
                현재 디자인과 포함된 모든 이미지가 삭제됩니다.<br/>이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setShowDeleteDialog(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors font-medium text-sm"
                >
                  취소
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 rounded-md transition-colors font-medium text-sm"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
