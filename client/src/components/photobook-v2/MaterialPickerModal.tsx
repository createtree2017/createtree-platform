import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, Plus, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface MaterialItem {
  id: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  categoryId?: number;
  keywords?: string;
  colorHex?: string;
}

interface ColorGroup {
  id: string;
  name: string;
  colors: string[];
}

const SOLID_COLOR_PALETTES: ColorGroup[] = [
  {
    id: 'basic',
    name: '기본 색상',
    colors: [
      '#000000', '#4a4a4a', '#9e9e9e', '#e0e0e0', '#ffffff',
      '#ff0000', '#ff6600', '#ffcc00', '#00cc00', '#00cccc',
      '#0000cc', '#6600cc', '#c9a227', '#5c4033'
    ]
  },
  {
    id: 'warm',
    name: '따뜻한 색상',
    colors: [
      '#2e4a1e', '#4a6b2a', '#6b8c3c', '#8b6914',
      '#6b1414', '#8b0000', '#4a0000', '#1a1a1a',
      '#d4a574', '#e8a24c', '#c9553d', '#1a7d7d',
      '#cc9966', '#a67d5d', '#e8d5b7', '#f5e6d3',
      '#f0c040', '#d45500', '#8b4513', '#006666'
    ]
  },
  {
    id: 'cool',
    name: '차가운 색상',
    colors: [
      '#1a237e', '#283593', '#303f9f', '#3f51b5',
      '#5c6bc0', '#7986cb', '#9fa8da', '#c5cae9',
      '#006064', '#00838f', '#0097a7', '#00acc1',
      '#4db6ac', '#80cbc4', '#2c5d34', '#3a7a44',
      '#6b8e4e', '#8bc34a', '#c5e1a5', '#dcedc8'
    ]
  },
  {
    id: 'nature',
    name: '자연 색상',
    colors: [
      '#800040', '#cc3366', '#ff6699', '#ffcc00', '#0066cc',
      '#003399', '#006633', '#009966', '#66cc33', '#cccc00',
      '#cc9900', '#996600', '#cc6600', '#996633', '#663300',
      '#f8e8c0', '#ffe066', '#ffff99', '#003366', '#6699cc',
      '#99ccff', '#e6f2ff'
    ]
  },
  {
    id: 'soft',
    name: '부드러운 색상',
    colors: [
      '#fce4ec', '#f8bbd9', '#f48fb1', '#ffccbc',
      '#ffe0b2', '#fff3e0', '#e8f5e9', '#c8e6c9',
      '#b2dfdb', '#e0f7fa', '#e1f5fe', '#e3f2fd',
      '#ede7f6', '#f3e5f5', '#fce4ec', '#fff9c4',
      '#fff59d', '#ffee58', '#d4e157', '#aed581',
      '#81c784', '#4db6ac', '#4dd0e1', '#4fc3f7',
      '#64b5f6', '#7986cb', '#9575cd', '#ba68c8',
      '#f06292', '#e57373'
    ]
  },
  {
    id: 'elegant',
    name: '우아한 색상',
    colors: [
      '#8b7355', '#a08060', '#b8956b', '#d4a574',
      '#3e2723', '#4e342e', '#5d4037', '#f5f5dc',
      '#faf0e6', '#fff8dc', '#1a1a1a', '#2d2d2d',
      '#c9a227', '#8b0000', '#4a0000', '#d4a574',
      '#b8956b', '#8b7355', '#6b5344', '#e8d5b7',
      '#f5e6d3', '#faf0e6', '#ffe4e1', '#dda0dd',
      '#d8bfd8', '#e6e6fa', '#b0c4de', '#778899'
    ]
  },
  {
    id: 'retro',
    name: '복고/빈티지 색상',
    colors: [
      '#ffb347', '#66cdaa', '#20b2aa', '#00688b',
      '#2f4f4f', '#708090', '#800080', '#ffe4c4',
      '#c9a227', '#00008b', '#6495ed', '#ffd700',
      '#b22222', '#a0522d', '#daa520', '#ff7f50',
      '#3c3c3c', '#c9e4a5', '#87ceeb', '#ff4500',
      '#004d4d'
    ]
  }
];

interface CategoryItem {
  id: number;
  name: string;
  type: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
}

interface MaterialPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'background' | 'icon';
  onSelect: (material: MaterialItem) => void;
}

type ViewMode = 'categories' | 'solid';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const buildUrl = (base: string, params: Record<string, string | number | null | undefined>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.append(key, String(value));
    }
  });
  const queryString = searchParams.toString();
  return queryString ? `${base}?${queryString}` : base;
};

export const MaterialPickerModal: React.FC<MaterialPickerModalProps> = ({
  isOpen,
  onClose,
  type,
  onSelect,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(type === 'background' ? 'solid' : 'categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [customColors, setCustomColors] = useState<string[]>([]);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [tempColor, setTempColor] = useState('#6b8c3c');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (isOpen) {
      setViewMode(type === 'background' ? 'solid' : 'categories');
      setSelectedCategoryId(null);
      setSearchTerm('');
      setDebouncedSearch('');
    }
  }, [isOpen, type]);

  const categoriesUrl = buildUrl('/api/photobook/materials/categories', { type });
  const { data: categoriesData, isLoading: isLoadingCategories } = useQuery<ApiResponse<CategoryItem[]>>({
    queryKey: [categoriesUrl],
    enabled: isOpen,
  });

  const materialsEndpoint = type === 'background' ? 'backgrounds' : 'icons';
  const materialsUrl = buildUrl(`/api/photobook/materials/${materialsEndpoint}`, {
    categoryId: selectedCategoryId,
    search: debouncedSearch,
  });
  
  const { data: materialsData, isLoading: isLoadingMaterials } = useQuery<ApiResponse<MaterialItem[]>>({
    queryKey: [materialsUrl],
    enabled: isOpen,
  });

  const categories = categoriesData?.data || [];
  const materials = materialsData?.data || [];

  const filteredMaterials = useMemo(() => {
    let result = materials;

    if (selectedCategoryId !== null) {
      result = result.filter((m) => m.categoryId === selectedCategoryId);
    }

    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(searchLower) ||
          (m.keywords && m.keywords.toLowerCase().includes(searchLower))
      );
    }

    return result;
  }, [materials, selectedCategoryId, debouncedSearch]);

  const handleSelect = (material: MaterialItem) => {
    onSelect(material);
    onClose();
  };

  const handleSolidColorSelect = (colorHex: string) => {
    const solidMaterial: MaterialItem = {
      id: Date.now(),
      name: colorHex,
      imageUrl: '',
      colorHex: colorHex,
    };
    onSelect(solidMaterial);
    onClose();
  };

  const handleAddCustomColor = () => {
    if (tempColor && !customColors.includes(tempColor)) {
      setCustomColors(prev => [...prev, tempColor]);
    }
    setShowColorPicker(false);
  };

  const handleRemoveCustomColor = (color: string) => {
    setCustomColors(prev => prev.filter(c => c !== color));
  };

  const title = type === 'background' ? '배경 선택' : '아이콘 선택';
  const isLoading = isLoadingCategories || isLoadingMaterials;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0 overflow-hidden">
        <div className="flex flex-col h-full max-h-[85vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="w-48 border-r border-gray-200 bg-gray-50">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-1">
                  {type === 'background' && (
                    <button
                      onClick={() => setViewMode('solid')}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        viewMode === 'solid'
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      단색
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setViewMode('categories');
                      setSelectedCategoryId(null);
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      viewMode === 'categories' && selectedCategoryId === null
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    전체
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => {
                        setViewMode('categories');
                        setSelectedCategoryId(category.id);
                      }}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        viewMode === 'categories' && selectedCategoryId === category.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {viewMode === 'solid' ? (
                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-3">색상추가</h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowColorPicker(true)}
                          className="w-10 h-10 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
                        >
                          <Plus className="w-5 h-5 text-gray-400" />
                        </button>
                        {customColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => handleSolidColorSelect(color)}
                            className="relative w-10 h-10 rounded-lg border border-gray-200 hover:ring-2 hover:ring-indigo-400 transition-all group"
                            style={{ backgroundColor: color }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveCustomColor(color);
                              }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            >
                              ×
                            </button>
                          </button>
                        ))}
                      </div>
                      {showColorPicker && (
                        <div className="mt-3 p-3 bg-white border border-gray-200 rounded-lg shadow-lg inline-block">
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={tempColor}
                              onChange={(e) => setTempColor(e.target.value)}
                              className="w-12 h-12 rounded cursor-pointer border-0"
                            />
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-gray-500 font-mono">{tempColor}</span>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleAddCustomColor}
                                  className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700"
                                >
                                  추가
                                </button>
                                <button
                                  onClick={() => setShowColorPicker(false)}
                                  className="px-3 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300"
                                >
                                  취소
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {SOLID_COLOR_PALETTES.map((group) => (
                      <div key={group.id}>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">{group.name}</h3>
                        <div className="flex flex-wrap gap-1">
                          {group.colors.map((color, idx) => (
                            <button
                              key={`${group.id}-${idx}`}
                              onClick={() => handleSolidColorSelect(color)}
                              className={cn(
                                'w-8 h-8 rounded hover:ring-2 hover:ring-indigo-400 hover:ring-offset-1 transition-all',
                                color === '#ffffff' && 'border border-gray-200'
                              )}
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <>
                  <div className="p-4 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="검색어를 입력하세요..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="p-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-20">
                          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        </div>
                      ) : filteredMaterials.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                          <p className="text-sm">검색 결과가 없습니다</p>
                        </div>
                      ) : (
                        <div
                          className={cn(
                            'grid gap-3',
                            type === 'background'
                              ? 'grid-cols-3'
                              : 'grid-cols-4'
                          )}
                        >
                          {filteredMaterials.map((material) => (
                            <button
                              key={material.id}
                              onClick={() => handleSelect(material)}
                              className={cn(
                                'relative group rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-400 transition-all shadow-sm hover:shadow-md',
                                type === 'background' ? 'aspect-video' : 'aspect-square'
                              )}
                              style={{
                                backgroundImage:
                                  'linear-gradient(45deg, #e0e0e0 25%, transparent 25%), linear-gradient(-45deg, #e0e0e0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e0e0e0 75%), linear-gradient(-45deg, transparent 75%, #e0e0e0 75%)',
                                backgroundSize: '12px 12px',
                                backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0px',
                                backgroundColor: '#f5f5f5',
                              }}
                            >
                              <img
                                src={material.thumbnailUrl || material.imageUrl}
                                alt={material.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-opacity" />
                              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <p className="text-white text-xs font-medium truncate">
                                  {material.name}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialPickerModal;
