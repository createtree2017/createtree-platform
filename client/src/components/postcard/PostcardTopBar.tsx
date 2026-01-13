import { useState, useRef, useEffect } from 'react';
import { 
  Save, 
  Scissors, 
  ZoomIn, 
  ZoomOut,
  ChevronDown,
  Trash2,
  Maximize,
  ArrowLeft,
  FolderOpen,
  Pencil,
  Layers
} from 'lucide-react';
import { PostcardEditorState, ProductVariant } from './types';

interface PostcardTopBarProps {
  state: PostcardEditorState;
  projectTitle?: string;
  isSaving?: boolean;
  variants: ProductVariant[];
  onSave: () => void;
  onLoad: () => void;
  onTitleChange: (title: string) => void;
  onToggleBleed: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onSetScale: (scale: number) => void;
  onChangeVariant: (variantId: number) => void;
  onDeleteSelected: () => void;
  onBack?: () => void;
}

export const PostcardTopBar: React.FC<PostcardTopBarProps> = ({
  state,
  projectTitle = '새 엽서',
  isSaving = false,
  variants,
  onSave,
  onLoad,
  onTitleChange,
  onToggleBleed,
  onZoomIn,
  onZoomOut,
  onFitView,
  onSetScale,
  onChangeVariant,
  onDeleteSelected,
  onBack
}) => {
  const [isVariantMenuOpen, setIsVariantMenuOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectTitle);
  const menuRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  
  const [zoomInput, setZoomInput] = useState(Math.round(state.scale * 100).toString());

  useEffect(() => {
    setTitleInput(projectTitle);
  }, [projectTitle]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

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

  useEffect(() => {
    setZoomInput(Math.round(state.scale * 100).toString());
  }, [state.scale]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsVariantMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleZoomCommit = () => {
    let val = parseInt(zoomInput, 10);
    if (isNaN(val)) {
      setZoomInput(Math.round(state.scale * 100).toString());
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

  const selectedVariant = variants.find(v => v.id === state.variantId);

  return (
    <div className="h-16 bg-gray-900 border-b border-gray-700 flex items-center justify-between px-4 z-20 shadow-sm relative">
      <div className="flex items-center space-x-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-2 rounded-md text-gray-400 hover:bg-gray-800 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        
        <div className="flex items-center space-x-2 text-indigo-400 font-bold text-xl mr-4">
          <Layers className="w-6 h-6" />
          {isEditingTitle ? (
            <input
              ref={titleInputRef}
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onBlur={handleTitleSubmit}
              onKeyDown={handleTitleKeyDown}
              className="bg-gray-800 border border-indigo-500 rounded px-2 py-1 text-white text-lg font-bold w-48 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          ) : (
            <button 
              onClick={() => setIsEditingTitle(true)}
              className="flex items-center gap-1 hover:bg-gray-800 rounded px-2 py-1 text-white"
              title="Click to edit title"
            >
              <span>{projectTitle}</span>
              <Pencil className="w-3.5 h-3.5 text-gray-400" />
            </button>
          )}
        </div>

        <div className="h-6 w-px bg-gray-700" />

        <div className="relative" ref={menuRef}>
          <button 
            className="px-3 py-1.5 rounded-md bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium flex items-center space-x-2 transition-colors"
            onClick={() => setIsVariantMenuOpen(!isVariantMenuOpen)}
          >
            <span>{selectedVariant?.name || '사이즈 선택'}</span>
            <ChevronDown className="w-4 h-4" />
          </button>
          {isVariantMenuOpen && (
            <div className="absolute top-full left-0 mt-1 w-56 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50">
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 flex items-center justify-between ${
                    state.variantId === variant.id ? 'bg-indigo-900/30 text-indigo-400' : 'text-gray-300'
                  }`}
                  onClick={() => {
                    onChangeVariant(variant.id);
                    setIsVariantMenuOpen(false);
                  }}
                >
                  <span>{variant.name}</span>
                  <span className="text-xs text-gray-500">{variant.widthMm}x{variant.heightMm}mm</span>
                  {variant.isBest && (
                    <span className="ml-2 px-1.5 py-0.5 text-[10px] bg-orange-500 text-white rounded">BEST</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <button 
          onClick={onToggleBleed}
          className={`p-2 rounded-md transition-colors ${state.showBleed ? 'bg-red-900/30 text-red-400' : 'text-gray-400 hover:bg-gray-800'}`}
          title="Show Bleed Area"
        >
          <Scissors className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-gray-700" />

        <button onClick={onZoomOut} className="p-2 rounded-md text-gray-400 hover:bg-gray-800" title="Zoom Out">
          <ZoomOut className="w-5 h-5" />
        </button>
        <div className="flex items-center bg-gray-800 rounded-md px-1">
          <input 
            type="text"
            value={zoomInput}
            onChange={(e) => setZoomInput(e.target.value)}
            onBlur={handleZoomCommit}
            onKeyDown={handleZoomKeyDown}
            className="w-12 text-center py-1 text-sm bg-transparent text-gray-300 outline-none"
          />
          <span className="text-sm text-gray-400 pr-1">%</span>
        </div>
        <button onClick={onZoomIn} className="p-2 rounded-md text-gray-400 hover:bg-gray-800" title="Zoom In">
          <ZoomIn className="w-5 h-5" />
        </button>
        <button onClick={onFitView} className="p-2 rounded-md text-gray-400 hover:bg-gray-800" title="Fit to View">
          <Maximize className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-gray-700" />

        <button 
          onClick={onDeleteSelected}
          className="p-2 rounded-md text-gray-400 hover:bg-gray-800 hover:text-red-400"
          title="Delete Selected"
          disabled={!state.selectedObjectId}
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <div className="h-6 w-px bg-gray-700" />

        <button 
          onClick={onLoad}
          className="px-3 py-1.5 rounded-md text-gray-300 hover:bg-gray-800 text-sm font-medium flex items-center space-x-1"
          title="Load Project"
        >
          <FolderOpen className="w-4 h-4" />
          <span>불러오기</span>
        </button>

        <button 
          onClick={onSave}
          disabled={isSaving}
          className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium flex items-center space-x-1 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? '저장 중...' : '저장'}</span>
        </button>
      </div>
    </div>
  );
};
