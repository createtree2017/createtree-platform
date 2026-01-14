import { useState, useRef, useEffect, ReactNode } from 'react';
import { 
  Save, 
  Scissors, 
  ZoomIn, 
  ZoomOut,
  ChevronDown,
  Maximize,
  ArrowLeft,
  FolderOpen,
  Pencil,
  Layers
} from 'lucide-react';
import { useMobile } from '@/hooks/use-mobile';

export interface SizeOption {
  id: number | string;
  name: string;
  displaySize?: string;
  isBest?: boolean;
}

export interface ProductEditorTopBarProps {
  projectTitle: string;
  isSaving?: boolean;
  scale: number;
  showBleed?: boolean;
  sizeOptions: SizeOption[];
  selectedSizeId: number | string | null;
  onSave: () => void;
  onLoad: () => void;
  onTitleChange: (title: string) => void;
  onToggleBleed?: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onSetScale: (scale: number) => void;
  onChangeSize: (sizeId: number | string) => void;
  onBack?: () => void;
  extraControls?: ReactNode;
}

export const ProductEditorTopBar: React.FC<ProductEditorTopBarProps> = ({
  projectTitle,
  isSaving = false,
  scale,
  showBleed = false,
  sizeOptions,
  selectedSizeId,
  onSave,
  onLoad,
  onTitleChange,
  onToggleBleed,
  onZoomIn,
  onZoomOut,
  onFitView,
  onSetScale,
  onChangeSize,
  onBack,
  extraControls
}) => {
  const isMobile = useMobile();
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectTitle);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [zoomInput, setZoomInput] = useState(Math.round(scale * 100).toString());
  const [isEditingZoom, setIsEditingZoom] = useState(false);

  useEffect(() => {
    setTitleInput(projectTitle);
  }, [projectTitle]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  useEffect(() => {
    if (!isEditingZoom) {
      setZoomInput(Math.round(scale * 100).toString());
    }
  }, [scale, isEditingZoom]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsSizeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTitleSubmit = () => {
    const trimmed = titleInput.trim();
    if (trimmed && trimmed !== projectTitle) {
      onTitleChange(trimmed);
    } else {
      setTitleInput(projectTitle);
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setTitleInput(projectTitle);
      setIsEditingTitle(false);
    }
  };

  const handleZoomCommit = () => {
    setIsEditingZoom(false);
    let val = parseInt(zoomInput, 10);
    if (isNaN(val)) {
      setZoomInput(Math.round(scale * 100).toString());
      return;
    }
    val = Math.max(10, Math.min(val, 500));
    onSetScale(val / 100);
    setZoomInput(val.toString());
  };

  const handleZoomKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const selectedSize = sizeOptions.find(s => s.id === selectedSizeId);

  const titleSectionContent = (
    <div className="flex items-center space-x-2 text-indigo-600 font-bold text-lg md:text-xl">
      <Layers className="w-5 h-5 md:w-6 md:h-6 flex-shrink-0" />
      {isEditingTitle ? (
        <input
          ref={titleInputRef}
          type="text"
          value={titleInput}
          onChange={(e) => setTitleInput(e.target.value)}
          onBlur={handleTitleSubmit}
          onKeyDown={handleTitleKeyDown}
          className="bg-white border border-indigo-300 rounded px-2 py-1 text-gray-900 text-base md:text-lg font-bold w-32 md:w-48 outline-none focus:ring-2 focus:ring-indigo-500"
          maxLength={50}
        />
      ) : (
        <button 
          onClick={() => setIsEditingTitle(true)}
          className="flex items-center gap-1 hover:bg-gray-100 rounded px-2 py-1 text-gray-900 min-w-0"
          title="클릭하여 이름 변경"
        >
          <span className="truncate max-w-[120px] md:max-w-[200px]">{projectTitle}</span>
          <Pencil className="w-3 h-3 md:w-3.5 md:h-3.5 text-gray-600 flex-shrink-0" />
        </button>
      )}
    </div>
  );

  const SizeSelector = () => (
    <div className="relative" ref={menuRef}>
      <button 
        className="px-2 md:px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs md:text-sm font-medium flex items-center space-x-1 md:space-x-2 transition-colors"
        onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
      >
        <span className="truncate max-w-[80px] md:max-w-[150px]">
          {selectedSize?.name || '사이즈 선택'}
        </span>
        <ChevronDown className={`w-3 h-3 md:w-4 md:h-4 flex-shrink-0 transition-transform ${isSizeMenuOpen ? 'rotate-180' : ''}`} />
      </button>
      {isSizeMenuOpen && (
        <div className="absolute top-full right-0 md:left-0 md:right-auto mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-64 overflow-auto">
          {sizeOptions.map((option) => (
            <button
              key={option.id}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                selectedSizeId === option.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'
              }`}
              onClick={() => {
                onChangeSize(option.id);
                setIsSizeMenuOpen(false);
              }}
            >
              <span>{option.name}</span>
              {option.displaySize && (
                <span className="text-xs text-gray-500">{option.displaySize}</span>
              )}
              {option.isBest && (
                <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-orange-500 text-white rounded">BEST</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const ControlButtons = () => (
    <div className="flex items-center space-x-1 md:space-x-2">
      {onToggleBleed && (
        <button 
          onClick={onToggleBleed}
          className={`p-1.5 md:p-2 rounded-md transition-colors ${showBleed ? 'bg-red-50 text-red-600' : 'text-gray-600 hover:bg-gray-100'}`}
          title="칼선 표시"
        >
          <Scissors className="w-4 h-4 md:w-5 md:h-5" />
        </button>
      )}

      <div className="hidden md:block h-6 w-px bg-gray-200" />

      <button onClick={onZoomOut} className="p-1.5 md:p-2 rounded-md text-gray-600 hover:bg-gray-100" title="축소">
        <ZoomOut className="w-4 h-4 md:w-5 md:h-5" />
      </button>
      
      <div className="flex items-center bg-gray-100 rounded-md px-1">
        <input 
          type="text"
          value={zoomInput}
          onChange={(e) => setZoomInput(e.target.value)}
          onFocus={() => setIsEditingZoom(true)}
          onBlur={handleZoomCommit}
          onKeyDown={handleZoomKeyDown}
          className="w-8 md:w-12 text-center py-1 text-xs md:text-sm bg-transparent text-gray-700 outline-none"
        />
        <span className="text-xs md:text-sm text-gray-600 pr-1">%</span>
      </div>
      
      <button onClick={onZoomIn} className="p-1.5 md:p-2 rounded-md text-gray-600 hover:bg-gray-100" title="확대">
        <ZoomIn className="w-4 h-4 md:w-5 md:h-5" />
      </button>
      
      <button onClick={onFitView} className="p-1.5 md:p-2 rounded-md text-gray-600 hover:bg-gray-100" title="화면 맞춤">
        <Maximize className="w-4 h-4 md:w-5 md:h-5" />
      </button>
    </div>
  );

  const ActionButtons = () => (
    <div className="flex items-center space-x-1 md:space-x-2">
      <button 
        onClick={onLoad}
        className="px-2 md:px-3 py-1.5 rounded-md text-gray-700 hover:bg-gray-100 text-xs md:text-sm font-medium flex items-center space-x-1"
        title="불러오기"
      >
        <FolderOpen className="w-4 h-4" />
        <span className="hidden sm:inline">불러오기</span>
      </button>

      <button 
        onClick={onSave}
        disabled={isSaving}
        className="px-3 md:px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs md:text-sm font-medium flex items-center space-x-1 disabled:opacity-50"
      >
        <Save className="w-4 h-4" />
        <span>{isSaving ? '저장 중...' : '저장'}</span>
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <div className="bg-white border-b border-gray-200 z-20 shadow-sm">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
          <div className="flex items-center space-x-2">
            {onBack && (
              <button 
                onClick={onBack}
                className="p-1.5 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
                title="뒤로"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            {titleSectionContent}
          </div>
          <SizeSelector />
        </div>
        
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center space-x-2">
            <ControlButtons />
          </div>
          {extraControls}
          <div className="flex items-center space-x-2">
            <ActionButtons />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-20 shadow-sm relative">
      <div className="flex items-center space-x-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
            title="뒤로"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        
        {titleSectionContent}
        <div className="h-6 w-px bg-gray-200" />
        <SizeSelector />
        
        {extraControls && (
          <>
            <div className="h-6 w-px bg-gray-200" />
            {extraControls}
          </>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <ControlButtons />
        <div className="h-6 w-px bg-gray-200" />
        <ActionButtons />
      </div>
    </div>
  );
};
