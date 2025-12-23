import { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Layout, X, Check, FolderOpen } from 'lucide-react';
import { AssetItem } from './types';

interface SidebarProps {
  assets: AssetItem[];
  usedAssetIds: Set<string>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragStart: (e: React.DragEvent, asset: AssetItem) => void;
  onAssetClick: (asset: AssetItem) => void;
  onDeleteAsset: (id: string) => void;
  onOpenGallery?: () => void;
  isLoadingGallery?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  assets, 
  usedAssetIds,
  onUpload, 
  onDragStart, 
  onAssetClick,
  onDeleteAsset,
  onOpenGallery,
  isLoadingGallery = false
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'photos' | 'layouts'>('photos');

  return (
    <div className="w-80 flex flex-col h-full bg-white border-r border-gray-200 shadow-xl z-10">
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('photos')}
          className={`flex-1 py-4 text-sm font-medium flex flex-col items-center space-y-1 ${activeTab === 'photos' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ImageIcon className="w-5 h-5" />
          <span>Photos</span>
        </button>
        <button 
          onClick={() => setActiveTab('layouts')}
          className={`flex-1 py-4 text-sm font-medium flex flex-col items-center space-y-1 ${activeTab === 'layouts' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Layout className="w-5 h-5" />
          <span>Layouts</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {activeTab === 'photos' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
              >
                <Upload className="w-6 h-6 mb-1" />
                <span className="text-xs font-medium">Upload</span>
                <input 
                  ref={fileInputRef}
                  type="file" 
                  multiple 
                  accept="image/*" 
                  className="hidden" 
                  onChange={onUpload}
                />
              </div>
              
              {onOpenGallery && (
                <div 
                  onClick={onOpenGallery}
                  className="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  <FolderOpen className="w-6 h-6 mb-1" />
                  <span className="text-xs font-medium">Gallery</span>
                </div>
              )}
            </div>

            {isLoadingGallery && (
              <div className="text-center text-gray-500 py-4 text-sm">
                Loading gallery...
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {assets.map((asset) => {
                const isUsed = usedAssetIds.has(asset.id);
                return (
                  <div 
                    key={asset.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, asset)}
                    onClick={() => onAssetClick(asset)}
                    className={`relative group aspect-square bg-gray-200 rounded-md overflow-hidden cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${isUsed ? 'ring-2 ring-green-500' : 'hover:ring-2 hover:ring-indigo-400'}`}
                  >
                    <img 
                      src={asset.url} 
                      alt={asset.name} 
                      className={`w-full h-full object-cover pointer-events-none transition-opacity ${isUsed ? 'opacity-70' : ''}`}
                    />
                    
                    {!isUsed && (
                       <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity pointer-events-none" />
                    )}

                    {isUsed && (
                      <div className="absolute top-1.5 left-1.5 bg-green-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md z-10 pointer-events-none flex items-center gap-0.5">
                        <Check size={10} strokeWidth={3} />
                        USED
                      </div>
                    )}
                    
                    {!isUsed && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()} 
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          onDeleteAsset(asset.id);
                        }}
                        className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 shadow-md opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 cursor-pointer"
                        title="Remove photo"
                      >
                        <X size={14} />
                      </button>
                    )}

                    <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 text-white text-[10px] px-1 rounded pointer-events-none">
                      {isUsed ? 'Add another' : 'Click to add'}
                    </div>
                  </div>
                );
              })}
              {assets.length === 0 && (
                 <div className="col-span-2 text-center text-gray-400 py-10 text-sm">
                   No photos yet. Upload some to get started!
                 </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'layouts' && (
          <div className="text-center text-gray-500 py-10">
            <p className="text-sm">Auto-layout templates would appear here.</p>
            <p className="text-xs mt-2">(Coming soon)</p>
          </div>
        )}
      </div>
    </div>
  );
};
