import { useRef, useState } from 'react';
import { Upload, Image as ImageIcon, Palette, X, Check, FolderOpen, Scissors, Plus, Sticker } from 'lucide-react';
import { AssetItem } from './types';

interface MaterialItem {
  id: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  colorHex?: string;
}

interface SidebarProps {
  assets: AssetItem[];
  usedAssetIds: Set<string>;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDragStart: (e: React.DragEvent, asset: AssetItem) => void;
  onAssetClick: (asset: AssetItem) => void;
  onDeleteAsset: (id: string) => void;
  onExtractImage?: (asset: AssetItem) => void;
  onOpenGallery?: () => void;
  isLoadingGallery?: boolean;
  onOpenBackgroundPicker?: () => void;
  onOpenIconPicker?: () => void;
  onSelectBackground?: (background: MaterialItem) => void;
  onSelectIcon?: (icon: MaterialItem) => void;
  onRemoveBackground?: (id: number) => void;
  onRemoveIcon?: (id: number) => void;
  selectedBackgrounds?: MaterialItem[];
  selectedIcons?: MaterialItem[];
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  assets, 
  usedAssetIds,
  onUpload, 
  onDragStart, 
  onAssetClick,
  onDeleteAsset,
  onExtractImage,
  onOpenGallery,
  isLoadingGallery = false,
  onOpenBackgroundPicker,
  onOpenIconPicker,
  onSelectBackground,
  onSelectIcon,
  onRemoveBackground,
  onRemoveIcon,
  selectedBackgrounds = [],
  selectedIcons = []
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<'photos' | 'materials'>('photos');
  const [materialSubTab, setMaterialSubTab] = useState<'backgrounds' | 'icons'>('backgrounds');

  return (
    <div className="w-80 flex flex-col h-full bg-white border-r border-gray-200 shadow-xl z-10">
      <div className="flex border-b border-gray-200">
        <button 
          onClick={() => setActiveTab('photos')}
          className={`flex-1 py-4 text-sm font-medium flex flex-col items-center space-y-1 ${activeTab === 'photos' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <ImageIcon className="w-5 h-5" />
          <span>사진</span>
        </button>
        <button 
          onClick={() => setActiveTab('materials')}
          className={`flex-1 py-4 text-sm font-medium flex flex-col items-center space-y-1 ${activeTab === 'materials' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          <Palette className="w-5 h-5" />
          <span>꾸미기재료</span>
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
                <span className="text-xs font-medium">업로드</span>
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
                  <span className="text-xs font-medium">갤러리</span>
                </div>
              )}
            </div>

            {isLoadingGallery && (
              <div className="text-center text-gray-500 py-4 text-sm">
                갤러리 로딩 중...
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
                    className={`relative group aspect-square rounded-md overflow-hidden cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow ${isUsed ? 'ring-2 ring-green-500' : 'hover:ring-2 hover:ring-indigo-400'}`}
                    style={{
                      backgroundImage: 'linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)',
                      backgroundSize: '12px 12px',
                      backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                      backgroundColor: '#f5f5f5'
                    }}
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
                        사용중
                      </div>
                    )}
                    
                    {!isUsed && (
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20">
                        {onExtractImage && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()} 
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              onExtractImage(asset);
                            }}
                            className="p-1.5 rounded-full bg-white text-gray-500 hover:text-purple-600 hover:bg-purple-50 shadow-md cursor-pointer"
                            title="이미지 추출"
                          >
                            <Scissors size={14} />
                          </button>
                        )}
                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()} 
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            onDeleteAsset(asset.id);
                          }}
                          className="p-1.5 rounded-full bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 shadow-md cursor-pointer"
                          title="사진 삭제"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 bg-black bg-opacity-50 text-white text-[10px] px-1 rounded pointer-events-none">
                      {isUsed ? '다시 추가' : '클릭하여 추가'}
                    </div>
                  </div>
                );
              })}
              {assets.length === 0 && (
                 <div className="col-span-2 text-center text-gray-400 py-10 text-sm">
                   사진이 없습니다. 업로드해주세요!
                 </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button 
                onClick={() => setMaterialSubTab('backgrounds')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${materialSubTab === 'backgrounds' ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                <Palette size={16} />
                배경
              </button>
              <button 
                onClick={() => setMaterialSubTab('icons')}
                className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${materialSubTab === 'icons' ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
              >
                <Sticker size={16} />
                아이콘
              </button>
            </div>

            {materialSubTab === 'backgrounds' && (
              <div className="space-y-3">
                <button
                  onClick={onOpenBackgroundPicker}
                  className="w-full border-2 border-dashed border-indigo-300 rounded-lg p-4 flex flex-col items-center justify-center text-indigo-600 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-sm font-medium">배경 선택하기</span>
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  {selectedBackgrounds.map((bg) => (
                    <div 
                      key={bg.id} 
                      className="relative group aspect-square rounded-md overflow-hidden shadow-sm border border-gray-200 cursor-pointer"
                      style={bg.colorHex ? { backgroundColor: bg.colorHex } : undefined}
                      onClick={() => onSelectBackground?.(bg)}
                    >
                      {!bg.colorHex && (
                        <img 
                          src={bg.thumbnailUrl || bg.imageUrl} 
                          alt={bg.name} 
                          className="w-full h-full object-cover"
                        />
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveBackground?.(bg.id);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-full bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-[10px] px-1 py-0.5 truncate">
                        {bg.colorHex || bg.name}
                      </div>
                    </div>
                  ))}
                  {selectedBackgrounds.length === 0 && (
                    <div className="col-span-2 text-center text-gray-400 py-10 text-sm">
                      배경이 없습니다. 선택해주세요!
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 text-center">배경을 클릭하면 현재 페이지에 적용됩니다</p>
              </div>
            )}

            {materialSubTab === 'icons' && (
              <div className="space-y-3">
                <button
                  onClick={onOpenIconPicker}
                  className="w-full border-2 border-dashed border-indigo-300 rounded-lg p-4 flex flex-col items-center justify-center text-indigo-600 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                >
                  <Plus className="w-6 h-6 mb-1" />
                  <span className="text-sm font-medium">아이콘 선택하기</span>
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  {selectedIcons.map((icon) => (
                    <div 
                      key={icon.id} 
                      className="relative group aspect-square rounded-md overflow-hidden shadow-sm border border-gray-200 bg-white"
                      style={{
                        backgroundImage: 'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                        backgroundSize: '8px 8px',
                        backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                      }}
                    >
                      <img 
                        src={icon.thumbnailUrl || icon.imageUrl} 
                        alt={icon.name} 
                        className="w-full h-full object-contain p-2 cursor-pointer"
                        onClick={() => onSelectIcon?.(icon)}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveIcon?.(icon.id);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-full bg-white text-gray-500 hover:text-red-600 hover:bg-red-50 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white text-[10px] px-1 py-0.5 truncate">
                        {icon.name}
                      </div>
                    </div>
                  ))}
                  {selectedIcons.length === 0 && (
                    <div className="col-span-2 text-center text-gray-400 py-10 text-sm">
                      아이콘이 없습니다. 선택해주세요!
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 text-center">아이콘을 클릭하면 캔버스에 추가됩니다</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
