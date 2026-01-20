import { useState, useRef } from 'react';
import { Plus, Minus, X, Edit2, Check, GripVertical, RotateCcw } from 'lucide-react';

export interface PageItem {
  id: string;
  objects: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    src?: string;
  }>;
  background?: string;
  backgroundLeft?: string;
  backgroundRight?: string;
  quantity?: number;
  orientation?: 'landscape' | 'portrait';
}

export interface PageDimensions {
  widthPx: number;
  heightPx: number;
}

interface ProductPageStripProps {
  mode: 'single' | 'spread';
  pages: PageItem[];
  currentIndex: number;
  dimensions: PageDimensions;
  label?: string;
  maxPages?: number | null;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onDelete?: (index: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onUpdateQuantity?: (index: number, quantity: number) => void;
  onToggleOrientation?: (index: number) => void;
}

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

export const ProductPageStrip: React.FC<ProductPageStripProps> = ({
  mode,
  pages,
  currentIndex,
  dimensions,
  label = mode === 'spread' ? '페이지' : '디자인',
  maxPages,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
  onUpdateQuantity,
  onToggleOrientation
}) => {
  const isAtMaxPages = maxPages != null && pages.length >= maxPages;
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteTargetIndex, setDeleteTargetIndex] = useState<number | null>(null);
  const draggedRef = useRef<number | null>(null);

  const thumbHeight = 80;
  const ratio = dimensions.widthPx / dimensions.heightPx;
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
    if (fromIndex !== null && fromIndex !== toIndex && onReorder) {
      onReorder(fromIndex, toIndex);
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
    const page = pages[index];
    const newQuantity = Math.max(1, (page.quantity || 1) + delta);
    onUpdateQuantity?.(index, newQuantity);
  };

  const handleDelete = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    if (pages.length > 1) {
      setDeleteTargetIndex(index);
      setShowDeleteDialog(true);
    }
  };

  const confirmDelete = () => {
    if (deleteTargetIndex !== null && onDelete) {
      onDelete(deleteTargetIndex);
    }
    setShowDeleteDialog(false);
    setDeleteTargetIndex(null);
  };

  const getSummary = () => {
    if (mode === 'spread') {
      return `${pages.length * 2} 페이지`;
    }
    const totalQuantity = pages.reduce((sum, p) => sum + (p.quantity || 1), 0);
    return `${pages.length}개 디자인 · 총 ${totalQuantity}장`;
  };

  const renderThumbnail = (page: PageItem, index: number) => {
    const isActive = index === currentIndex;
    const isDragging = draggedIndex === index;
    const isDragOver = dragOverIndex === index;
    
    const canvasWidth = dimensions.widthPx;
    const canvasHeight = dimensions.heightPx;
    
    if (mode === 'spread') {
      const leftBg = page.backgroundLeft || page.background;
      const rightBg = page.backgroundRight || page.background;
      
      return (
        <div 
          key={page.id}
          draggable={isEditMode}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          onClick={() => !isEditMode && onSelect(index)}
          className={`group flex flex-col items-center transition-all duration-200 ${
            isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
          } ${isActive && !isEditMode ? 'scale-105' : 'opacity-70 hover:opacity-100'} ${
            isDragging ? 'opacity-50 scale-95' : ''
          } ${isDragOver ? 'scale-110' : ''}`}
        >
          <div className="relative">
            {isEditMode && (
              <div className="absolute -left-6 top-1/2 -translate-y-1/2 text-gray-400">
                <GripVertical className="w-4 h-4" />
              </div>
            )}
            
            {/* 삭제 버튼 - single 모드와 동일 */}
            {pages.length > 1 && onDelete && !isEditMode && (
              <button
                onClick={(e) => handleDelete(e, index)}
                className="absolute -top-1 -right-1 z-30 bg-red-500/90 hover:bg-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3 text-white" />
              </button>
            )}
            
            <div 
              className={`relative bg-white shadow-sm border-2 overflow-hidden transition-colors ${
                isDragOver 
                  ? 'border-indigo-400 border-dashed' 
                  : isActive && !isEditMode 
                    ? 'border-indigo-600 shadow-md' 
                    : 'border-gray-300 group-hover:border-gray-400'
              }`}
              style={{ width: thumbWidth, height: thumbHeight }}
            >
              <div 
                className="absolute top-0 bottom-0 left-0 w-1/2"
                style={getBackgroundStyle(leftBg)}
              />
              <div 
                className="absolute top-0 bottom-0 right-0 w-1/2"
                style={getBackgroundStyle(rightBg)}
              />
              
              <div className="absolute top-0 bottom-0 left-1/2 w-px bg-gray-300 z-10" />
              
              {page.objects.map(obj => (
                <div 
                  key={obj.id}
                  className="absolute z-20"
                  style={{
                    left: `${(obj.x / canvasWidth) * 100}%`,
                    top: `${(obj.y / canvasHeight) * 100}%`,
                    width: `${(obj.width / canvasWidth) * 100}%`,
                    height: `${(obj.height / canvasHeight) * 100}%`,
                    transform: `rotate(${obj.rotation}deg)`,
                    backgroundImage: obj.src ? `url(${obj.src})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
              ))}
            </div>
          </div>
          <span className={`mt-2 text-xs font-medium ${isActive && !isEditMode ? 'text-indigo-600' : 'text-gray-500'}`}>
            {index * 2 + 1}-{index * 2 + 2}
          </span>
        </div>
      );
    }

    const quantity = page.quantity || 1;
    const orientation = page.orientation || 'landscape';
    
    // 페이지별 orientation에 따른 개별 썸네일 크기 계산
    const pageRatio = orientation === 'portrait' 
      ? dimensions.heightPx / dimensions.widthPx  // portrait: 높이/너비
      : dimensions.widthPx / dimensions.heightPx;  // landscape: 너비/높이
    const pageThumbWidth = thumbHeight * pageRatio;
    const pageThumbHeight = thumbHeight;
    
    // 캔버스 크기도 orientation에 맞게 조정
    const pageCanvasWidth = orientation === 'portrait' ? dimensions.heightPx : dimensions.widthPx;
    const pageCanvasHeight = orientation === 'portrait' ? dimensions.widthPx : dimensions.heightPx;
    
    return (
      <div 
        key={page.id}
        draggable={isEditMode}
        onDragStart={(e) => handleDragStart(e, index)}
        onDragOver={(e) => handleDragOver(e, index)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, index)}
        onDragEnd={handleDragEnd}
        onClick={() => !isEditMode && onSelect(index)}
        className={`
          relative shrink-0 rounded-lg overflow-hidden transition-all cursor-pointer group
          ${isActive ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-white' : 'hover:ring-1 hover:ring-gray-400'}
          ${isDragging ? 'opacity-50' : ''}
          ${isDragOver ? 'ring-2 ring-blue-400' : ''}
          ${isEditMode ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
        style={{ width: pageThumbWidth + 24, minWidth: pageThumbWidth + 24 }}
      >
        {isEditMode && (
          <div className="absolute top-1 left-1 z-20 bg-gray-200/90 rounded p-0.5 cursor-grab">
            <GripVertical className="w-3 h-3 text-gray-600" />
          </div>
        )}
        
        {pages.length > 1 && onDelete && (
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
            width: pageThumbWidth, 
            height: pageThumbHeight,
            ...getBackgroundStyle(page.background)
          }}
        >
          {page.objects.map(obj => (
            <div 
              key={obj.id}
              className="absolute z-10"
              style={{
                left: `${(obj.x / pageCanvasWidth) * 100}%`,
                top: `${(obj.y / pageCanvasHeight) * 100}%`,
                width: `${(obj.width / pageCanvasWidth) * 100}%`,
                height: `${(obj.height / pageCanvasHeight) * 100}%`,
                transform: `rotate(${obj.rotation}deg)`,
                backgroundImage: obj.src ? `url(${obj.src})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            />
          ))}
          {page.objects.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
              빈 디자인
            </div>
          )}
        </div>

        {onUpdateQuantity && (
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
        )}
        
        <div className={`absolute inset-x-0 bottom-0 h-0.5 ${isActive ? 'bg-indigo-500' : 'bg-transparent'}`} />
      </div>
    );
  };

  return (
    <div className="min-h-40 md:min-h-44 h-auto bg-gray-100 border-t border-gray-200 flex flex-col shrink-0">
      <div className="px-4 py-2 flex justify-between items-center text-xs text-gray-600 uppercase font-bold tracking-wider">
        <div className="flex items-center gap-2">
          <span>{label}</span>
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
        <span>{getSummary()}</span>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-start pt-2 px-4 space-x-4 pb-4">
        {pages.map((page, index) => renderThumbnail(page, index))}
        
        {!isEditMode && !isAtMaxPages && (
          <button 
            onClick={onAdd}
            className="shrink-0 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-gray-400 hover:text-gray-500 hover:bg-gray-200/50 transition-colors"
            style={{ width: mode === 'spread' ? thumbWidth : thumbWidth + 24, height: thumbHeight + (mode === 'single' ? 48 : 0) }}
          >
            <Plus className="w-6 h-6" />
          </button>
        )}
        
        {!isEditMode && isAtMaxPages && (
          <div 
            className="shrink-0 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center text-gray-400 bg-gray-50"
            style={{ width: mode === 'spread' ? thumbWidth : thumbWidth + 24, height: thumbHeight + (mode === 'single' ? 48 : 0) }}
          >
            <span className="text-xs text-center px-2">마지막<br/>페이지</span>
          </div>
        )}
        
        <div className="w-4 shrink-0" />
      </div>

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowDeleteDialog(false)}
          ></div>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full z-10 overflow-hidden animate-in fade-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {mode === 'spread' ? '페이지 삭제' : '디자인 삭제'}
              </h3>
              <p className="text-gray-600 mb-6">
                {mode === 'spread' 
                  ? '현재 페이지와 포함된 모든 이미지가 삭제됩니다.' 
                  : '현재 디자인과 포함된 모든 이미지가 삭제됩니다.'
                }<br/>이 작업은 되돌릴 수 없습니다.
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
