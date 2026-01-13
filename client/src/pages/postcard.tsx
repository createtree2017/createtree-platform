import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { GALLERY_FILTERS, GalleryFilterKey } from '@shared/constants';

import { Sidebar, BackgroundTarget } from '@/components/photobook-v2/Sidebar';
import { PostcardEditorCanvas } from '@/components/postcard/PostcardEditorCanvas';
import { DesignStrip } from '@/components/postcard/DesignStrip';
import { PostcardTopBar } from '@/components/postcard/PostcardTopBar';
import { 
  PostcardEditorState, 
  PostcardDesign, 
  VariantConfig,
  ProductVariant,
  ProductProject,
  getEffectiveDimensions
} from '@/components/postcard/types';
import { CanvasObject, AssetItem } from '@/components/photobook-v2/types';
import { generateId } from '@/components/photobook-v2/utils';
import { Loader2, X, Check, Plus, Pencil, Trash2 } from 'lucide-react';
import { ImageExtractorModal } from '@/components/ImageExtractor';
import { MaterialPickerModal } from '@/components/photobook-v2/MaterialPickerModal';

const DEFAULT_VARIANT_CONFIG: VariantConfig = {
  widthMm: 148,
  heightMm: 105,
  bleedMm: 3,
  dpi: 300
};

const createDesign = (): PostcardDesign => ({
  id: generateId(),
  objects: [],
  background: '#ffffff',
  quantity: 1,
  orientation: 'landscape'
});

const createInitialState = (): PostcardEditorState => ({
  variantId: null,
  variantConfig: DEFAULT_VARIANT_CONFIG,
  designs: [createDesign()],
  currentDesignIndex: 0,
  assets: [],
  selectedObjectId: null,
  scale: 0.3,
  panOffset: { x: 0, y: 0 },
  showBleed: false
});

interface MaterialItem {
  id: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  categoryId?: number;
  keywords?: string;
  colorHex?: string;
}

export default function PostcardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState('새 엽서');
  const [state, setState] = useState<PostcardEditorState>(createInitialState);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<Set<string>>(new Set());
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(true);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProjectTitle, setEditingProjectTitle] = useState('');
  const [deletingProject, setDeletingProject] = useState<ProductProject | null>(null);
  const [extractingAsset, setExtractingAsset] = useState<AssetItem | null>(null);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [selectedBackgrounds, setSelectedBackgrounds] = useState<MaterialItem[]>([]);
  const [selectedIcons, setSelectedIcons] = useState<MaterialItem[]>([]);
  const [activeGalleryFilter, setActiveGalleryFilter] = useState<GalleryFilterKey>('all');

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const hasInitializedVariant = useRef(false);

  const { data: projects, isLoading: projectsLoading } = useQuery<{ data: ProductProject[] }>({
    queryKey: ['/api/products/projects', 'postcard'],
    queryFn: async () => {
      const response = await fetch('/api/products/projects?categorySlug=postcard', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: !!user,
  });

  const { data: variants, isLoading: variantsLoading } = useQuery<{ data: ProductVariant[] }>({
    queryKey: ['/api/products/categories/postcard/variants'],
    queryFn: async () => {
      const response = await fetch('/api/products/categories/postcard/variants');
      if (!response.ok) throw new Error('Failed to fetch variants');
      return response.json();
    }
  });

  useEffect(() => {
    if (variants?.data && variants.data.length > 0 && !hasInitializedVariant.current) {
      hasInitializedVariant.current = true;
      
      if (projectId && state.variantId) {
        const variant = variants.data.find(v => v.id === state.variantId);
        if (variant) {
          setState(prev => ({
            ...prev,
            variantConfig: {
              widthMm: variant.widthMm,
              heightMm: variant.heightMm,
              bleedMm: variant.bleedMm,
              dpi: variant.dpi
            }
          }));
        }
      } else if (!projectId) {
        const defaultVariant = variants.data.find(v => v.isBest) || variants.data[0];
        if (defaultVariant) {
          setState(prev => ({
            ...prev,
            variantId: defaultVariant.id,
            variantConfig: {
              widthMm: defaultVariant.widthMm,
              heightMm: defaultVariant.heightMm,
              bleedMm: defaultVariant.bleedMm,
              dpi: defaultVariant.dpi
            }
          }));
        }
      }
    }
  }, [variants?.data, projectId, state.variantId]);

  interface GalleryImage {
    id: number;
    url: string;
    thumbnailUrl?: string;
    fullUrl?: string;
    title?: string;
    createdAt?: string;
  }

  const { data: galleryImages, isLoading: galleryLoading, refetch: refetchGallery } = useQuery<GalleryImage[]>({
    queryKey: ['/api/gallery', activeGalleryFilter],
    queryFn: async () => {
      const filterParam = activeGalleryFilter !== 'all' ? `?filter=${activeGalleryFilter}` : '';
      const response = await fetch(`/api/gallery${filterParam}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to fetch gallery');
      return response.json();
    },
    enabled: !!user && showGalleryModal
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const designsData = {
        designs: state.designs,
        assets: state.assets,
        variantConfig: state.variantConfig
      };
      
      if (projectId) {
        return apiRequest(`/api/products/projects/${projectId}`, {
          method: 'PATCH',
          data: {
            title: projectTitle,
            variantId: state.variantId,
            designsData,
            status: 'draft'
          }
        });
      } else {
        return apiRequest('/api/products/projects', {
          method: 'POST',
          data: {
            categorySlug: 'postcard',
            variantId: state.variantId,
            title: projectTitle,
            designsData,
            status: 'draft'
          }
        });
      }
    },
    onSuccess: (response: any) => {
      const project = response?.data || response;
      if (!projectId && project?.id) {
        setProjectId(project.id);
      }
      queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
      toast({ title: '저장 완료', description: '프로젝트가 저장되었습니다.' });
    },
    onError: (error) => {
      console.error('Save error:', error);
      toast({ title: '저장 실패', description: '프로젝트 저장에 실패했습니다.', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/products/projects/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
      toast({ title: '삭제 완료', description: '프로젝트가 삭제되었습니다.' });
      setDeletingProject(null);
    },
    onError: () => {
      toast({ title: '삭제 실패', description: '프로젝트 삭제에 실패했습니다.', variant: 'destructive' });
    }
  });

  const loadProject = useCallback((project: ProductProject) => {
    setProjectId(project.id);
    setProjectTitle(project.title);
    
    const data = project.designsData as any;
    const variant = variants?.data?.find(v => v.id === project.variantId);
    const fallbackVariant = variants?.data?.find(v => v.isBest) || variants?.data?.[0];
    const savedVariantConfig = data?.variantConfig;
    
    if (variant || fallbackVariant) {
      hasInitializedVariant.current = true;
    }
    
    const resolvedVariantConfig = variant ? {
      widthMm: variant.widthMm,
      heightMm: variant.heightMm,
      bleedMm: variant.bleedMm,
      dpi: variant.dpi
    } : fallbackVariant ? {
      widthMm: fallbackVariant.widthMm,
      heightMm: fallbackVariant.heightMm,
      bleedMm: fallbackVariant.bleedMm,
      dpi: fallbackVariant.dpi
    } : savedVariantConfig ? {
      widthMm: savedVariantConfig.widthMm,
      heightMm: savedVariantConfig.heightMm,
      bleedMm: savedVariantConfig.bleedMm,
      dpi: savedVariantConfig.dpi
    } : DEFAULT_VARIANT_CONFIG;
    
    const loadedDesigns = (data?.designs || [createDesign()]).map((d: PostcardDesign) => ({
      ...d,
      orientation: d.orientation || 'landscape'
    }));
    
    setState({
      variantId: project.variantId,
      variantConfig: resolvedVariantConfig,
      designs: loadedDesigns,
      currentDesignIndex: 0,
      assets: data?.assets || [],
      selectedObjectId: null,
      scale: 0.3,
      panOffset: { x: 0, y: 0 },
      showBleed: false
    });
    
    setShowLoadModal(false);
    setShowStartupModal(false);
  }, [variants?.data]);

  const handleNewProject = useCallback(() => {
    setProjectId(null);
    setProjectTitle('새 엽서');
    
    const defaultVariant = variants?.data?.find(v => v.isBest) || variants?.data?.[0];
    
    if (defaultVariant) {
      hasInitializedVariant.current = true;
    }
    
    setState({
      ...createInitialState(),
      variantId: defaultVariant?.id || null,
      variantConfig: defaultVariant ? {
        widthMm: defaultVariant.widthMm,
        heightMm: defaultVariant.heightMm,
        bleedMm: defaultVariant.bleedMm,
        dpi: defaultVariant.dpi
      } : DEFAULT_VARIANT_CONFIG
    });
    
    setShowStartupModal(false);
    setShowLoadModal(false);
  }, [variants?.data]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (!['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) && state.selectedObjectId) {
          handleDeleteObject(state.selectedObjectId);
        }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state.selectedObjectId]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const asset: AssetItem = {
            id: generateId(),
            url,
            name: file.name,
            width: img.width,
            height: img.height,
          };
          setState(prev => ({ ...prev, assets: [...prev.assets, asset] }));
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleDragStart = (e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
  };

  const handleAssetClick = (asset: AssetItem) => {
    const currentDesign = state.designs[state.currentDesignIndex];
    const orientation = currentDesign.orientation || 'landscape';
    const dims = getEffectiveDimensions(state.variantConfig, orientation);
    
    const defaultWidth = dims.widthPx * 0.4;
    const ratio = asset.width / asset.height;
    const defaultHeight = defaultWidth / ratio;

    const newObject: CanvasObject = {
      id: generateId(),
      type: 'image',
      src: asset.url,
      x: dims.widthPx / 2 - defaultWidth / 2,
      y: dims.heightPx / 2 - defaultHeight / 2,
      width: defaultWidth,
      height: defaultHeight,
      rotation: 0,
      contentX: 0,
      contentY: 0,
      contentWidth: defaultWidth,
      contentHeight: defaultHeight,
      zIndex: currentDesign.objects.length + 1,
      opacity: 1,
    };

    setState(prev => {
      const newDesigns = [...prev.designs];
      newDesigns[prev.currentDesignIndex] = {
        ...newDesigns[prev.currentDesignIndex],
        objects: [...newDesigns[prev.currentDesignIndex].objects, newObject]
      };
      return { ...prev, designs: newDesigns, selectedObjectId: newObject.id };
    });
  };

  const handleDeleteAsset = (id: string) => {
    setState(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== id) }));
  };

  const handleAddObject = (obj: CanvasObject) => {
    setState(prev => {
      const newDesigns = [...prev.designs];
      newDesigns[prev.currentDesignIndex] = {
        ...newDesigns[prev.currentDesignIndex],
        objects: [...newDesigns[prev.currentDesignIndex].objects, obj]
      };
      return { ...prev, designs: newDesigns, selectedObjectId: obj.id };
    });
  };

  const handleUpdateObject = (id: string, updates: Partial<CanvasObject>) => {
    setState(prev => {
      const newDesigns = [...prev.designs];
      newDesigns[prev.currentDesignIndex] = {
        ...newDesigns[prev.currentDesignIndex],
        objects: newDesigns[prev.currentDesignIndex].objects.map(o => 
          o.id === id ? { ...o, ...updates } : o
        )
      };
      return { ...prev, designs: newDesigns };
    });
  };

  const handleDeleteObject = (id: string) => {
    setState(prev => {
      const newDesigns = [...prev.designs];
      newDesigns[prev.currentDesignIndex] = {
        ...newDesigns[prev.currentDesignIndex],
        objects: newDesigns[prev.currentDesignIndex].objects.filter(o => o.id !== id)
      };
      return { 
        ...prev, 
        designs: newDesigns,
        selectedObjectId: prev.selectedObjectId === id ? null : prev.selectedObjectId
      };
    });
  };

  const handleDuplicateObject = (id: string) => {
    const currentDesign = state.designs[state.currentDesignIndex];
    const obj = currentDesign.objects.find(o => o.id === id);
    if (!obj) return;

    const newObj: CanvasObject = {
      ...obj,
      id: generateId(),
      x: obj.x + 20,
      y: obj.y + 20,
      zIndex: currentDesign.objects.length + 1
    };

    handleAddObject(newObj);
  };

  const handleChangeOrder = (id: string, dir: 'up' | 'down') => {
    setState(prev => {
      const newDesigns = [...prev.designs];
      const design = newDesigns[prev.currentDesignIndex];
      const sorted = [...design.objects].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex(o => o.id === id);
      if (idx === -1) return prev;

      const swapIdx = dir === 'up' ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;

      const temp = sorted[idx].zIndex;
      sorted[idx].zIndex = sorted[swapIdx].zIndex;
      sorted[swapIdx].zIndex = temp;

      newDesigns[prev.currentDesignIndex] = {
        ...design,
        objects: sorted
      };
      return { ...prev, designs: newDesigns };
    });
  };

  const handleSelectDesign = (index: number) => {
    setState(prev => ({ ...prev, currentDesignIndex: index, selectedObjectId: null }));
  };

  const handleAddDesign = () => {
    setState(prev => ({
      ...prev,
      designs: [...prev.designs, createDesign()],
      currentDesignIndex: prev.designs.length
    }));
  };

  const handleDeleteDesign = (index: number) => {
    if (state.designs.length <= 1) return;
    setState(prev => {
      const newDesigns = prev.designs.filter((_, i) => i !== index);
      const newIndex = Math.min(prev.currentDesignIndex, newDesigns.length - 1);
      return { ...prev, designs: newDesigns, currentDesignIndex: newIndex };
    });
  };

  const handleUpdateQuantity = (index: number, quantity: number) => {
    setState(prev => {
      const newDesigns = [...prev.designs];
      newDesigns[index] = { ...newDesigns[index], quantity };
      return { ...prev, designs: newDesigns };
    });
  };

  const handleReorderDesign = (fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newDesigns = [...prev.designs];
      const [removed] = newDesigns.splice(fromIndex, 1);
      newDesigns.splice(toIndex, 0, removed);
      
      let newCurrentIndex = prev.currentDesignIndex;
      if (fromIndex === prev.currentDesignIndex) {
        newCurrentIndex = toIndex;
      } else if (fromIndex < prev.currentDesignIndex && toIndex >= prev.currentDesignIndex) {
        newCurrentIndex--;
      } else if (fromIndex > prev.currentDesignIndex && toIndex <= prev.currentDesignIndex) {
        newCurrentIndex++;
      }
      
      return { ...prev, designs: newDesigns, currentDesignIndex: newCurrentIndex };
    });
  };

  const handleToggleOrientation = (index: number) => {
    setState(prev => {
      const newDesigns = [...prev.designs];
      const design = newDesigns[index];
      const oldOrientation = design.orientation || 'landscape';
      const newOrientation = oldOrientation === 'landscape' ? 'portrait' : 'landscape';
      
      const oldDims = getEffectiveDimensions(prev.variantConfig, oldOrientation);
      const newDims = getEffectiveDimensions(prev.variantConfig, newOrientation);
      
      const transformedObjects = design.objects.map(obj => {
        const relX = obj.x / oldDims.widthPx;
        const relY = obj.y / oldDims.heightPx;
        const relW = obj.width / oldDims.widthPx;
        const relH = obj.height / oldDims.heightPx;
        
        return {
          ...obj,
          x: relX * newDims.widthPx,
          y: relY * newDims.heightPx,
          width: relW * newDims.widthPx,
          height: relH * newDims.heightPx
        };
      });
      
      newDesigns[index] = { ...design, orientation: newOrientation, objects: transformedObjects };
      return { ...prev, designs: newDesigns };
    });
  };

  const handleChangeVariant = (variantId: number) => {
    const variant = variants?.data?.find(v => v.id === variantId);
    if (!variant) return;
    
    setState(prev => ({
      ...prev,
      variantId,
      variantConfig: {
        widthMm: variant.widthMm,
        heightMm: variant.heightMm,
        bleedMm: variant.bleedMm,
        dpi: variant.dpi
      }
    }));
  };

  const handleZoomIn = () => setState(prev => ({ ...prev, scale: Math.min(prev.scale * 1.2, 5) }));
  const handleZoomOut = () => setState(prev => ({ ...prev, scale: Math.max(prev.scale / 1.2, 0.1) }));
  const handleFitView = () => setState(prev => ({ ...prev, scale: 0.3, panOffset: { x: 0, y: 0 } }));
  const handleSetScale = (scale: number) => setState(prev => ({ ...prev, scale }));
  const handleToggleBleed = () => setState(prev => ({ ...prev, showBleed: !prev.showBleed }));

  const handleSelectBackground = (bg: MaterialItem, _target: BackgroundTarget) => {
    setState(prev => {
      const newDesigns = [...prev.designs];
      newDesigns[prev.currentDesignIndex] = {
        ...newDesigns[prev.currentDesignIndex],
        background: bg.imageUrl
      };
      return { ...prev, designs: newDesigns };
    });
    if (!selectedBackgrounds.find(b => b.id === bg.id)) {
      setSelectedBackgrounds(prev => [...prev, bg]);
    }
  };

  const handleSelectIcon = (icon: MaterialItem) => {
    const currentDesign = state.designs[state.currentDesignIndex];
    const orientation = currentDesign.orientation || 'landscape';
    const dims = getEffectiveDimensions(state.variantConfig, orientation);
    
    const iconSize = dims.widthPx * 0.15;
    
    const newObject: CanvasObject = {
      id: generateId(),
      type: 'image',
      src: icon.imageUrl,
      x: dims.widthPx / 2 - iconSize / 2,
      y: dims.heightPx / 2 - iconSize / 2,
      width: iconSize,
      height: iconSize,
      rotation: 0,
      contentX: 0,
      contentY: 0,
      contentWidth: iconSize,
      contentHeight: iconSize,
      zIndex: currentDesign.objects.length + 1,
      opacity: 1,
    };

    handleAddObject(newObject);
    
    if (!selectedIcons.find(i => i.id === icon.id)) {
      setSelectedIcons(prev => [...prev, icon]);
    }
  };

  const handleAddGalleryImages = () => {
    if (!galleryImages || selectedGalleryImages.size === 0) return;
    
    selectedGalleryImages.forEach(url => {
      const img = new Image();
      img.onload = () => {
        const asset: AssetItem = {
          id: generateId(),
          url,
          name: 'Gallery Image',
          width: img.width,
          height: img.height,
        };
        setState(prev => ({ ...prev, assets: [...prev.assets, asset] }));
      };
      img.src = url;
    });
    
    setSelectedGalleryImages(new Set());
    setShowGalleryModal(false);
  };

  const getUsedAssetIds = () => {
    const used = new Set<string>();
    state.designs.forEach(design => {
      design.objects.forEach(obj => {
        if (obj.type === 'image' && obj.src) {
          const asset = state.assets.find(a => a.url === obj.src);
          if (asset) used.add(asset.id);
        }
      });
    });
    return used;
  };

  if (authLoading || variantsLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-900">
        <h2 className="text-2xl font-bold mb-4">로그인이 필요합니다</h2>
        <button 
          onClick={() => navigate('/auth')}
          className="px-6 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700 text-white"
        >
          로그인하기
        </button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 overflow-hidden">
      {showStartupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4 border border-gray-200 shadow-xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">엽서 에디터</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={handleNewProject}
                className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
              >
                <Plus className="w-12 h-12 text-indigo-600 mb-2" />
                <span className="text-gray-900 font-medium">새 프로젝트</span>
              </button>
              
              <button
                onClick={() => { setShowStartupModal(false); setShowLoadModal(true); }}
                className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
              >
                <Pencil className="w-12 h-12 text-green-600 mb-2" />
                <span className="text-gray-900 font-medium">불러오기</span>
                {projects?.data && projects.data.length > 0 && (
                  <span className="text-xs text-gray-600 mt-1">{projects.data.length}개 프로젝트</span>
                )}
              </button>
            </div>
            
            <button
              onClick={() => navigate('/')}
              className="w-full py-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              홈으로 돌아가기
            </button>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col border border-gray-200 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">프로젝트 불러오기</h3>
              <button 
                onClick={() => setShowLoadModal(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {projectsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : projects?.data && projects.data.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {projects.data.map(project => (
                    <div 
                      key={project.id}
                      className="bg-gray-100 rounded-lg p-4 cursor-pointer hover:bg-gray-200 transition-colors group relative border border-gray-200"
                      onClick={() => loadProject(project)}
                    >
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProjectId(project.id);
                            setEditingProjectTitle(project.title);
                          }}
                          className="p-1 bg-white rounded hover:bg-gray-100 border border-gray-200"
                        >
                          <Pencil className="w-4 h-4 text-gray-700" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingProject(project);
                          }}
                          className="p-1 bg-red-100 rounded hover:bg-red-200"
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                      
                      {project.thumbnailUrl ? (
                        <img 
                          src={project.thumbnailUrl} 
                          alt={project.title}
                          className="w-full h-24 object-cover rounded mb-2"
                        />
                      ) : (
                        <div className="w-full h-24 bg-gray-200 rounded mb-2 flex items-center justify-center text-gray-500">
                          미리보기 없음
                        </div>
                      )}
                      
                      {editingProjectId === project.id ? (
                        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingProjectTitle}
                            onChange={(e) => setEditingProjectTitle(e.target.value)}
                            className="flex-1 bg-white border border-gray-300 rounded px-2 py-1 text-sm text-gray-900"
                            autoFocus
                          />
                          <button
                            onClick={async () => {
                              await apiRequest(`/api/products/projects/${project.id}`, { method: 'PATCH', data: { title: editingProjectTitle } });
                              queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
                              setEditingProjectId(null);
                            }}
                            className="p-1 bg-green-600 rounded hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <h4 className="font-medium text-gray-900 truncate">{project.title}</h4>
                      )}
                      <p className="text-xs text-gray-600">
                        {new Date(project.updatedAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  저장된 프로젝트가 없습니다
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleNewProject}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                새 프로젝트 만들기
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 border border-gray-200 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">프로젝트 삭제</h3>
            <p className="text-gray-700 mb-6">
              "{deletingProject.title}" 프로젝트를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingProject(null)}
                className="flex-1 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300"
              >
                취소
              </button>
              <button
                onClick={() => deleteMutation.mutate(deletingProject.id)}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {showGalleryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden flex flex-col border border-gray-200 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">갤러리에서 선택</h3>
              <button onClick={() => setShowGalleryModal(false)} className="text-gray-600 hover:text-gray-900">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="flex gap-2 mb-4 flex-wrap">
              {GALLERY_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveGalleryFilter(filter.key as GalleryFilterKey)}
                  className={`px-3 py-1 rounded-full text-sm ${
                    activeGalleryFilter === filter.key 
                      ? 'bg-indigo-600 text-white' 
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {galleryLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
              ) : galleryImages && galleryImages.length > 0 ? (
                <div className="grid grid-cols-4 gap-3">
                  {galleryImages.map(img => {
                    const imageUrl = img.fullUrl || img.url;
                    const isSelected = selectedGalleryImages.has(imageUrl);
                    return (
                      <div
                        key={img.id}
                        onClick={() => {
                          const newSet = new Set(selectedGalleryImages);
                          if (isSelected) {
                            newSet.delete(imageUrl);
                          } else {
                            newSet.add(imageUrl);
                          }
                          setSelectedGalleryImages(newSet);
                        }}
                        className={`relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                          isSelected ? 'border-indigo-500' : 'border-transparent hover:border-gray-400'
                        }`}
                      >
                        <img 
                          src={img.thumbnailUrl || imageUrl} 
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {isSelected && (
                          <div className="absolute top-2 right-2 bg-indigo-500 rounded-full p-1">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  갤러리에 이미지가 없습니다
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
              <span className="text-gray-600">
                {selectedGalleryImages.size}개 선택됨
              </span>
              <button
                onClick={handleAddGalleryImages}
                disabled={selectedGalleryImages.size === 0}
                className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      {extractingAsset && (
        <ImageExtractorModal
          isOpen={!!extractingAsset}
          imageUrl={extractingAsset.url}
          onClose={() => setExtractingAsset(null)}
          onExtract={(extractedBlob: Blob) => {
            const extractedUrl = URL.createObjectURL(extractedBlob);
            const img = new Image();
            img.onload = () => {
              const asset: AssetItem = {
                id: generateId(),
                url: extractedUrl,
                name: `${extractingAsset.name}_extracted`,
                width: img.width,
                height: img.height,
              };
              setState(prev => ({ ...prev, assets: [...prev.assets, asset] }));
            };
            img.src = extractedUrl;
            setExtractingAsset(null);
          }}
        />
      )}

      {showBackgroundPicker && (
        <MaterialPickerModal
          isOpen={showBackgroundPicker}
          type="background"
          onClose={() => setShowBackgroundPicker(false)}
          onSelect={(material) => handleSelectBackground(material, 'both')}
        />
      )}

      {showIconPicker && (
        <MaterialPickerModal
          isOpen={showIconPicker}
          type="icon"
          onClose={() => setShowIconPicker(false)}
          onSelect={handleSelectIcon}
        />
      )}

      <PostcardTopBar
        state={state}
        projectTitle={projectTitle}
        isSaving={saveMutation.isPending}
        variants={variants?.data || []}
        onSave={() => saveMutation.mutate()}
        onLoad={() => setShowLoadModal(true)}
        onTitleChange={setProjectTitle}
        onToggleBleed={handleToggleBleed}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onSetScale={handleSetScale}
        onChangeVariant={handleChangeVariant}
        onDeleteSelected={() => state.selectedObjectId && handleDeleteObject(state.selectedObjectId)}
        onBack={() => navigate('/')}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          assets={state.assets}
          usedAssetIds={getUsedAssetIds()}
          onUpload={handleUpload}
          onDragStart={handleDragStart}
          onAssetClick={handleAssetClick}
          onDeleteAsset={handleDeleteAsset}
          onExtractImage={setExtractingAsset}
          onOpenGallery={() => setShowGalleryModal(true)}
          isLoadingGallery={galleryLoading}
          onOpenBackgroundPicker={() => setShowBackgroundPicker(true)}
          onOpenIconPicker={() => setShowIconPicker(true)}
          onSelectBackground={handleSelectBackground}
          onSelectIcon={handleSelectIcon}
          onRemoveBackground={(id) => setSelectedBackgrounds(prev => prev.filter(b => b.id !== id))}
          onRemoveIcon={(id) => setSelectedIcons(prev => prev.filter(i => i.id !== id))}
          selectedBackgrounds={selectedBackgrounds}
          selectedIcons={selectedIcons}
        />

        <PostcardEditorCanvas
          state={state}
          isPanningMode={isSpacePressed}
          onUpdateObject={handleUpdateObject}
          onSelectObject={(id) => setState(prev => ({ ...prev, selectedObjectId: id }))}
          onAddObject={handleAddObject}
          onDeleteObject={handleDeleteObject}
          onDuplicateObject={handleDuplicateObject}
          onChangeOrder={handleChangeOrder}
          onUpdatePanOffset={(offset) => setState(prev => ({ ...prev, panOffset: offset }))}
        />
      </div>

      <DesignStrip
        designs={state.designs}
        currentDesignIndex={state.currentDesignIndex}
        variantConfig={state.variantConfig}
        onSelectDesign={handleSelectDesign}
        onAddDesign={handleAddDesign}
        onDeleteDesign={handleDeleteDesign}
        onUpdateQuantity={handleUpdateQuantity}
        onReorderDesign={handleReorderDesign}
        onToggleOrientation={handleToggleOrientation}
      />
    </div>
  );
}
