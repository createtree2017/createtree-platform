import { useState, useRef } from 'react';
import { EditorState } from './types';
import { DPI } from './constants';
import { Edit2, GripVertical, Check } from 'lucide-react';

interface PageStripProps {
  state: EditorState;
  onSelectSpread: (index: number) => void;
  onAddSpread: () => void;
  onReorderSpread?: (fromIndex: number, toIndex: number) => void;
}

const getBackgroundStyle = (bg: string | undefined): React.CSSProperties => {
  if (!bg) return {};
  if (bg.startsWith('#')) {
    return { backgroundColor: bg };
  }
  return { 
    backgroundImage: `url(${bg})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center'
  };
};

export const PageStrip: React.FC<PageStripProps> = ({ state, onSelectSpread, onAddSpread, onReorderSpread }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const draggedRef = useRef<number | null>(null);

  const ratio = (state.albumSize.widthInches * 2) / state.albumSize.heightInches;
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
    if (fromIndex !== null && fromIndex !== toIndex && onReorderSpread) {
      onReorderSpread(fromIndex, toIndex);
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

  return (
    <div className="h-40 bg-gray-100 border-t border-gray-200 flex flex-col shrink-0">
      <div className="px-4 py-2 flex justify-between items-center text-xs text-gray-500 uppercase font-bold tracking-wider">
        <div className="flex items-center gap-2">
          <span>Pages</span>
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
        <span>{state.spreads.length * 2} Pages total</span>
      </div>
      
      <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center px-4 space-x-4 pb-2">
        {state.spreads.map((spread, index) => {
          const isActive = index === state.currentSpreadIndex;
          const leftBg = spread.backgroundLeft || spread.background;
          const rightBg = spread.backgroundRight || spread.background;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;
          
          return (
            <div 
              key={spread.id}
              draggable={isEditMode}
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => !isEditMode && onSelectSpread(index)}
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
                  
                  {spread.objects.map(obj => (
                    <div 
                      key={obj.id}
                      className="absolute z-20"
                      style={{
                        left: `${(obj.x / (state.albumSize.widthInches * 2 * DPI)) * 100}%`,
                        top: `${(obj.y / (state.albumSize.heightInches * DPI)) * 100}%`,
                        width: `${(obj.width / (state.albumSize.widthInches * 2 * DPI)) * 100}%`,
                        height: `${(obj.height / (state.albumSize.heightInches * DPI)) * 100}%`,
                        transform: `rotate(${obj.rotation}deg)`,
                        backgroundImage: `url(${obj.src})`,
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
        })}

        {!isEditMode && (
          <button 
            onClick={onAddSpread}
            className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded hover:border-indigo-400 hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 transition-colors"
            style={{ width: thumbWidth, height: thumbHeight }}
          >
            <span className="text-2xl">+</span>
          </button>
        )}
        
        <div className="w-4 shrink-0" />
      </div>
    </div>
  );
};
