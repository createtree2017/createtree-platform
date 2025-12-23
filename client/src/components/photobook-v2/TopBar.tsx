import { useState, useRef, useEffect } from 'react';
import { 
  Save, 
  Plus, 
  Grid, 
  Layers, 
  Scissors, 
  ZoomIn, 
  ZoomOut,
  ChevronDown,
  Trash2,
  Maximize,
  ArrowLeft,
  FolderOpen
} from 'lucide-react';
import { AlbumConfig, EditorState } from './types';
import { ALBUM_SIZES } from './constants';

interface TopBarProps {
  state: EditorState;
  projectTitle?: string;
  isSaving?: boolean;
  onSave: () => void;
  onLoad: () => void;
  onAddSpread: () => void;
  onDeleteSpread: () => void;
  onToggleGrid: () => void;
  onToggleBleed: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onSetScale: (scale: number) => void;
  onChangeAlbumSize: (size: AlbumConfig) => void;
  onDeleteSelected: () => void;
  onBack?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  state,
  projectTitle = 'PhotoBook',
  isSaving = false,
  onSave,
  onLoad,
  onAddSpread,
  onDeleteSpread,
  onToggleGrid,
  onToggleBleed,
  onZoomIn,
  onZoomOut,
  onFitView,
  onSetScale,
  onChangeAlbumSize,
  onDeleteSelected,
  onBack
}) => {
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  const [zoomInput, setZoomInput] = useState(Math.round(state.scale * 100).toString());

  useEffect(() => {
    setZoomInput(Math.round(state.scale * 100).toString());
  }, [state.scale]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsSizeMenuOpen(false);
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

  const isDeleteDisabled = state.spreads.length <= 1;

  return (
    <div className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 z-20 shadow-sm relative">
      <div className="flex items-center space-x-4">
        {onBack && (
          <button 
            onClick={onBack}
            className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
            title="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        
        <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xl mr-4">
          <Layers className="w-6 h-6" />
          <span>{projectTitle}</span>
        </div>
        
        <div className="hidden md:flex items-center relative" ref={menuRef}>
          <button 
            onClick={() => setIsSizeMenuOpen(!isSizeMenuOpen)}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md flex items-center space-x-2 hover:bg-gray-200 transition-colors border border-transparent focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
          >
            <span>{state.albumSize.name}</span>
            <ChevronDown className={`w-4 h-4 opacity-50 transition-transform ${isSizeMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          
          {isSizeMenuOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-md shadow-lg border border-gray-200 z-50 py-1">
              {Object.values(ALBUM_SIZES).map((size) => (
                <button
                  key={size.id}
                  onClick={() => {
                    onChangeAlbumSize(size);
                    setIsSizeMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-sm hover:bg-indigo-50 hover:text-indigo-600 ${state.albumSize.id === size.id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700'}`}
                >
                  {size.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center">
        <div className="h-10 w-px bg-gray-200 mx-4"></div>
        
        <div className="flex items-center space-x-4">
          <button 
            onClick={onAddSpread}
            className="flex flex-col items-center justify-center min-w-[64px] group hover:bg-gray-50 rounded-md py-1 transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-700 group-hover:text-indigo-600" />
            <span className="text-[11px] font-medium text-indigo-600 mt-1">Add Spread</span>
          </button>
          
          <button 
            onClick={onDeleteSpread}
            disabled={isDeleteDisabled}
            className={`flex flex-col items-center justify-center min-w-[64px] group rounded-md py-1 transition-colors ${isDeleteDisabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50 cursor-pointer'}`}
          >
            <Trash2 className={`w-5 h-5 ${isDeleteDisabled ? 'text-gray-400' : 'text-red-400 group-hover:text-red-600'}`} />
            <span className={`text-[11px] font-medium mt-1 ${isDeleteDisabled ? 'text-gray-400' : 'text-red-400 group-hover:text-red-600'}`}>Delete Spread</span>
          </button>
        </div>

        <div className="h-10 w-px bg-gray-200 mx-4"></div>

        <button 
          onClick={onDeleteSelected}
          disabled={!state.selectedObjectId} 
          className={`flex flex-col items-center justify-center min-w-[64px] group rounded-md py-1 transition-colors ${!state.selectedObjectId ? 'opacity-30 cursor-not-allowed' : 'hover:bg-amber-50 cursor-pointer'}`}
        >
          <Trash2 className={`w-5 h-5 ${!state.selectedObjectId ? 'text-gray-400' : 'text-amber-600 group-hover:text-amber-800'}`} />
          <span className={`text-[11px] font-medium mt-1 ${!state.selectedObjectId ? 'text-gray-400' : 'text-amber-600 group-hover:text-amber-800'}`}>Delete Object</span>
        </button>

        <div className="h-10 w-px bg-gray-200 mx-4"></div>

        <div className="flex items-center space-x-1">
          <button onClick={onToggleGrid} className={`p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors ${state.showGrid ? 'bg-indigo-100 text-indigo-600' : ''}`} title="Toggle Grid">
            <Grid className="w-5 h-5" />
          </button>
          <button onClick={onToggleBleed} className={`p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors ${state.showBleed ? 'bg-indigo-100 text-indigo-600' : ''}`} title="Toggle Bleed/Trim Lines">
            <Scissors className="w-5 h-5" />
          </button>
        </div>

        <div className="h-8 w-px bg-gray-300 mx-3"></div>

        <div className="flex items-center space-x-1">
          <button onClick={onZoomOut} className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors" title="Zoom Out">
            <ZoomOut className="w-5 h-5" />
          </button>
          
          <div className="relative flex items-center justify-center w-14">
            <input 
              type="text" 
              value={zoomInput}
              onChange={(e) => setZoomInput(e.target.value)}
              onBlur={handleZoomCommit}
              onKeyDown={handleZoomKeyDown}
              className="w-full text-center text-xs font-mono text-gray-700 border-none bg-transparent focus:ring-1 focus:ring-indigo-500 rounded px-0 py-1"
            />
            <span className="absolute right-1 text-xs text-gray-400 pointer-events-none">%</span>
          </div>

          <button onClick={onZoomIn} className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors" title="Zoom In">
            <ZoomIn className="w-5 h-5" />
          </button>
          <button onClick={onFitView} className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors" title="Fit to Screen">
            <Maximize className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <button 
          onClick={onLoad}
          className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors shadow-sm text-sm font-medium"
        >
          <FolderOpen className="w-4 h-4" />
          <span>불러오기</span>
        </button>
        <button 
          onClick={onSave} 
          disabled={isSaving}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors shadow-sm text-sm font-medium disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? '저장 중...' : '저장'}</span>
        </button>
      </div>
    </div>
  );
};
