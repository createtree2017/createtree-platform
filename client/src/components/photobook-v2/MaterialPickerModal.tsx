import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
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
}

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
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    if (isOpen) {
      setSelectedCategoryId(null);
      setSearchTerm('');
      setDebouncedSearch('');
    }
  }, [isOpen]);

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
                  <button
                    onClick={() => setSelectedCategoryId(null)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      selectedCategoryId === null
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    전체
                  </button>
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategoryId(category.id)}
                      className={cn(
                        'w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                        selectedCategoryId === category.id
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
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialPickerModal;
