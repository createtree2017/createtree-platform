import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import { useProjectSave } from '@/hooks/useProjectSave';
import { useMobile } from '@/hooks/use-mobile';
import { GALLERY_FILTERS, GalleryFilterKey } from '@shared/constants';

import { Sidebar } from '@/components/photobook-v2/Sidebar';
import { useEditorMaterialsHandlers, BackgroundTarget, MaterialItem } from '@/hooks/useEditorMaterialsHandlers';
import { useEditorAssetActions } from '@/hooks/useEditorAssetActions';
import { useEditorKeyboard } from '@/hooks/useEditorKeyboard';
import { PostcardEditorCanvas } from '@/components/postcard/PostcardEditorCanvas';
import { ProductEditorTopBar, SizeOption } from '@/components/product-editor';
import { ProductPageStrip, PageItem, PageDimensions } from '@/components/product-editor/ProductPageStrip';
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
import { DISPLAY_DPI } from '@/components/photobook-v2/constants';
import { 
  EDITOR_DISPLAY_DPI, 
  getEffectiveEditorDpi, 
  migrateDesignsArray,
  createEditorDpiPayload 
} from '@/utils/editorDpi';
import { Loader2, X, Check, Plus, Pencil, Trash2, Download } from 'lucide-react';
import { ImageExtractorModal } from '@/components/ImageExtractor';
import { MaterialPickerModal } from '@/components/photobook-v2/MaterialPickerModal';
import { UnifiedDownloadModal } from '@/components/common/UnifiedDownloadModal';
import { ImagePreviewDialog, PreviewImage } from '@/components/common/ImagePreviewDialog';
import { ProductLoadModal, DeleteConfirmModal, ProductProject as LoadModalProject } from '@/components/common/ProductLoadModal';
import { ProductStartupModal } from '@/components/common/ProductStartupModal';
import { PreviewModal } from '@/components/common/PreviewModal';
import { usePreviewRenderer, PreviewDesign, PreviewConfig } from '@/hooks/usePreviewRenderer';
import { useModalHistory } from '@/hooks/useModalHistory';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog';
import { Mail } from 'lucide-react';
import { DesignData } from '@/services/exportService';
import { GalleryImageItem, saveExtractedImage } from '@/services/imageIngestionService';
import { toggleGallerySelection, createEmptyGallerySelection } from '@/types/editor';
import { generateAndUploadThumbnail, updateProductThumbnail } from '@/services/thumbnailService';
import { useGalleryImageCopy } from '@/hooks/useGalleryImageCopy';

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


export default function PostcardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isMobile = useMobile();
  
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState('새 엽서');
  const [state, setState] = useState<PostcardEditorState>(createInitialState);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMagnifierMode, setIsMagnifierMode] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<Set<number>>(createEmptyGallerySelection);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(true);
  const [deletingProject, setDeletingProject] = useState<ProductProject | null>(null);
  const [extractingAsset, setExtractingAsset] = useState<AssetItem | null>(null);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [activeGalleryFilter, setActiveGalleryFilter] = useState<GalleryFilterKey>('all');
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [loadingProjectId, setLoadingProjectId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedStateRef = useRef<string | null>(null);
  
  const { closeWithHistory: closePreviewWithHistory } = useModalHistory({
    isOpen: showPreviewModal,
    onClose: () => setShowPreviewModal(false),
    modalId: 'preview',
  });

  const unsavedGuard = useUnsavedChangesGuard({
    isDirty,
    onSave: async () => {
      await saveProject();
    },
  });
  
  const downloadManager = useDownloadManager();
  
  const { pendingUploads, copyGalleryImages } = useGalleryImageCopy({
    onImageCopied: (asset) => {
      const assetItem: AssetItem = {
        id: asset.id,
        url: asset.previewUrl,
        fullUrl: asset.originalUrl,
        name: asset.filename,
        width: asset.width,
        height: asset.height,
      };
      setState(prev => ({ ...prev, assets: [...prev.assets, assetItem] }));
    }
  });
  
  useEffect(() => {
    setSidebarCollapsed(isMobile);
  }, [isMobile]);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (lastSavedStateRef.current === null) return;
    const currentStateStr = JSON.stringify({ state, projectTitle });
    setIsDirty(currentStateStr !== lastSavedStateRef.current);
  }, [state, projectTitle]);

  const hasInitializedVariant = useRef(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<{ data: ProductProject[] }>({
    queryKey: ['/api/products/projects', 'postcard', 'list'],
    queryFn: async () => {
      const response = await fetch('/api/products/projects?categorySlug=postcard&lightweight=true', {
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
    transformedUrl?: string;
    originalUrl?: string;
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

  const projectTitleRef = useRef(projectTitle);
  
  useEffect(() => {
    projectTitleRef.current = projectTitle;
  }, [projectTitle]);

  const { save: saveProject, isSaving, resetProjectId } = useProjectSave({
    categorySlug: 'postcard',
    projectId,
    setProjectId,
    getPayload: () => ({
      title: projectTitleRef.current,
      variantId: stateRef.current.variantId,
      designsData: {
        designs: stateRef.current.designs,
        assets: stateRef.current.assets,
        variantConfig: stateRef.current.variantConfig,
        ...createEditorDpiPayload()
      }
    }),
    onSaveSuccess: async (savedProjectId) => {
      lastSavedStateRef.current = JSON.stringify({ state: stateRef.current, projectTitle: projectTitleRef.current });
      setIsDirty(false);
      
      const currentState = stateRef.current;
      if (currentState.designs.length > 0 && currentState.variantConfig) {
        const firstDesign = currentState.designs[0];
        try {
          const result = await generateAndUploadThumbnail({
            design: {
              id: firstDesign.id,
              objects: firstDesign.objects,
              background: firstDesign.background || '#ffffff',
              orientation: firstDesign.orientation || 'landscape',
            },
            variant: {
              widthMm: currentState.variantConfig.widthMm,
              heightMm: currentState.variantConfig.heightMm,
              bleedMm: currentState.variantConfig.bleedMm,
            },
            projectId: savedProjectId,
            projectType: 'postcard',
          });
          
          if (result.success && result.thumbnailUrl) {
            await updateProductThumbnail(savedProjectId, result.thumbnailUrl);
            queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
            console.log('[Postcard] 썸네일 업데이트 완료');
          }
        } catch (error) {
          console.warn('[Postcard] 썸네일 생성 실패 (저장은 완료됨):', error);
        }
      }
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
    
    const convertThumbnailToOriginal = (url: string): string => {
      if (!url?.includes('/thumbnails/')) return url;
      return url.replace('/thumbnails/', '/');
    };
    
    const migratedAssets = (data?.assets || []).map((asset: AssetItem) => {
      if (asset.url?.includes('/thumbnails/')) {
        const resolvedUrl = asset.fullUrl || convertThumbnailToOriginal(asset.url);
        return { ...asset, url: resolvedUrl, fullUrl: asset.fullUrl || resolvedUrl };
      }
      return asset;
    });
    
    const savedEditorDpi = getEffectiveEditorDpi(data?.editorDpi);
    const urlMigratedDesigns = loadedDesigns.map((design: PostcardDesign) => ({
      ...design,
      objects: design.objects.map((obj: CanvasObject) => {
        if (obj.type === 'image' && obj.src?.includes('/thumbnails/')) {
          const resolvedSrc = obj.fullSrc || convertThumbnailToOriginal(obj.src);
          return { ...obj, src: resolvedSrc, fullSrc: obj.fullSrc || resolvedSrc };
        }
        return obj;
      })
    }));
    const migratedDesigns = migrateDesignsArray(urlMigratedDesigns, savedEditorDpi, EDITOR_DISPLAY_DPI) as PostcardDesign[];
    
    const loadedState = {
      variantId: project.variantId,
      variantConfig: resolvedVariantConfig,
      designs: migratedDesigns,
      currentDesignIndex: 0,
      assets: migratedAssets,
      selectedObjectId: null,
      scale: 0.3,
      panOffset: { x: 0, y: 0 },
      showBleed: false
    };
    setState(loadedState);
    lastSavedStateRef.current = JSON.stringify({ state: loadedState, projectTitle: project.title });
    setIsDirty(false);
    
    setShowLoadModal(false);
    setShowStartupModal(false);
  }, [variants?.data]);

  const handleLoadProject = useCallback(async (projectId: number) => {
    setLoadingProjectId(projectId);
    try {
      const response = await fetch(`/api/products/projects/${projectId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch project');
      const { data } = await response.json();
      loadProject(data);
    } catch (error) {
      console.error('Error loading project:', error);
      toast({ title: '불러오기 실패', description: '프로젝트를 불러오는데 실패했습니다.', variant: 'destructive' });
    } finally {
      setLoadingProjectId(null);
    }
  }, [loadProject, toast]);

  const handleNewProject = useCallback(() => {
    setProjectId(null);
    setProjectTitle('새 엽서');
    
    const defaultVariant = variants?.data?.find(v => v.isBest) || variants?.data?.[0];
    
    if (defaultVariant) {
      hasInitializedVariant.current = true;
    }
    
    const newState = {
      ...createInitialState(),
      variantId: defaultVariant?.id || null,
      variantConfig: defaultVariant ? {
        widthMm: defaultVariant.widthMm,
        heightMm: defaultVariant.heightMm,
        bleedMm: defaultVariant.bleedMm,
        dpi: defaultVariant.dpi
      } : DEFAULT_VARIANT_CONFIG
    };
    setState(newState);
    lastSavedStateRef.current = JSON.stringify({ state: newState, projectTitle: '새 엽서' });
    setIsDirty(false);
    
    setShowStartupModal(false);
    setShowLoadModal(false);
  }, [variants?.data]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get('load');
    if (loadId && !projectId && !authLoading && user) {
      const idNum = parseInt(loadId, 10);
      if (!isNaN(idNum)) {
        setShowStartupModal(false);
        handleLoadProject(idNum);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [authLoading, user, projectId, handleLoadProject]);

  const handleRenameProject = useCallback(async (projectId: number, newTitle: string) => {
    await apiRequest(`/api/products/projects/${projectId}`, { 
      method: 'PATCH', 
      data: { title: newTitle } 
    });
    queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
  }, []);

  const handleAddObject = useCallback((obj: CanvasObject) => {
    setState(prev => {
      const newDesigns = [...prev.designs];
      newDesigns[prev.currentDesignIndex] = {
        ...newDesigns[prev.currentDesignIndex],
        objects: [...newDesigns[prev.currentDesignIndex].objects, obj]
      };
      return { ...prev, designs: newDesigns, selectedObjectId: obj.id };
    });
  }, []);

  const handleDeleteObject = useCallback((id: string) => {
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
  }, []);

  const assetActions = useEditorAssetActions({
    isSpreadMode: false,
    getCanvasDimensions: () => {
      const currentDesign = state.designs[state.currentDesignIndex];
      const orientation = currentDesign?.orientation || 'landscape';
      const dims = getEffectiveDimensions(state.variantConfig, orientation, DISPLAY_DPI);
      return { widthPx: dims.widthPx, heightPx: dims.heightPx };
    },
    getCurrentObjectsCount: () => state.designs[state.currentDesignIndex]?.objects?.length || 0,
    addAssets: (assets) => setState(prev => ({ ...prev, assets: [...prev.assets, ...assets] })),
    addObject: handleAddObject,
    removeAsset: (id) => setState(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== id) })),
    setIsUploading,
  });

  const handleDeleteAssetById = useCallback((id: string) => {
    const asset = state.assets.find(a => a.id === id);
    if (asset) {
      assetActions.handleDeleteAsset(asset);
    }
  }, [state.assets, assetActions]);

  useEditorKeyboard({
    selectedObjectId: state.selectedObjectId,
    onDeleteObject: handleDeleteObject,
    onSpacePressed: setIsSpacePressed,
  });

  const materialsHandlers = useEditorMaterialsHandlers({
    surfaceModel: 'single',
    getCurrentDesignIndex: () => state.currentDesignIndex,
    updateDesignBackground: (index: number, background: string | undefined) => {
      setState(prev => {
        const newDesigns = [...prev.designs];
        newDesigns[index] = { ...newDesigns[index], background: background ?? '#ffffff' };
        return { ...prev, designs: newDesigns };
      });
    },
    getObjectsCount: () => state.designs[state.currentDesignIndex]?.objects?.length || 0,
    addObject: handleAddObject,
    getCanvasDimensions: () => {
      const currentDesign = state.designs[state.currentDesignIndex];
      const orientation = currentDesign?.orientation || 'landscape';
      return getEffectiveDimensions(state.variantConfig, orientation, DISPLAY_DPI);
    },
    showToast: (message: string) => toast({ title: message }),
  });

  const { 
    selectedBackgrounds, 
    selectedIcons, 
    handleSelectBackground, 
    handleSelectIcon, 
    handleRemoveBackground, 
    handleRemoveIcon, 
    handleApplyBackground, 
    handleApplyIcon 
  } = materialsHandlers;

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
      
      const oldDims = getEffectiveDimensions(prev.variantConfig, oldOrientation, DISPLAY_DPI);
      const newDims = getEffectiveDimensions(prev.variantConfig, newOrientation, DISPLAY_DPI);
      
      const transformedObjects = design.objects.map(obj => {
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        
        const relCenterX = centerX / oldDims.widthPx;
        const relCenterY = centerY / oldDims.heightPx;
        
        const newCenterX = relCenterX * newDims.widthPx;
        const newCenterY = relCenterY * newDims.heightPx;
        
        let newX = newCenterX - obj.width / 2;
        let newY = newCenterY - obj.height / 2;
        
        newX = Math.max(0, Math.min(newX, newDims.widthPx - obj.width));
        newY = Math.max(0, Math.min(newY, newDims.heightPx - obj.height));
        
        return {
          ...obj,
          x: newX,
          y: newY
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
  const handleFitView = () => {
    if (!workspaceRef.current) {
      setState(prev => ({ ...prev, scale: 0.3, panOffset: { x: 0, y: 0 } }));
      return;
    }
    
    const currentDesign = state.designs[state.currentDesignIndex];
    const orientation = currentDesign?.orientation || 'landscape';
    const dims = getEffectiveDimensions(state.variantConfig, orientation, DISPLAY_DPI);
    
    const containerRect = workspaceRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    const padding = 20;
    const availableWidth = containerWidth - padding * 2;
    const availableHeight = containerHeight - padding * 2;
    
    const scaleX = availableWidth / dims.widthPx;
    const scaleY = availableHeight / dims.heightPx;
    const fitScale = Math.max(0.1, Math.min(scaleX, scaleY, 1.5));
    
    setState(prev => ({ ...prev, scale: fitScale, panOffset: { x: 0, y: 0 } }));
  };
  const handleSetScale = (scale: number) => setState(prev => ({ ...prev, scale }));
  const handleToggleBleed = () => setState(prev => ({ ...prev, showBleed: !prev.showBleed }));

  const handlePreviewImage = (obj: CanvasObject) => {
    if (obj.type === 'image' && obj.src) {
      setPreviewImage({
        src: obj.src,
        fullSrc: obj.fullSrc || obj.src,
        title: '이미지 미리보기'
      });
    }
  };

  const handleAddGalleryImages = async () => {
    if (!galleryImages || selectedGalleryIds.size === 0) return;
    
    const selectedIds = Array.from(selectedGalleryIds);
    setShowGalleryModal(false);
    setSelectedGalleryIds(createEmptyGallerySelection());
    
    await copyGalleryImages(galleryImages, selectedIds);
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

  const previewDesigns: PreviewDesign[] = useMemo(() => 
    state.designs.map(d => ({
      id: d.id,
      objects: d.objects,
      background: d.background || '#ffffff',
      orientation: d.orientation
    })), 
    [state.designs]
  );

  const previewConfig: PreviewConfig = useMemo(() => ({
    widthMm: state.variantConfig.widthMm,
    heightMm: state.variantConfig.heightMm,
    dpi: state.variantConfig.dpi
  }), [state.variantConfig]);

  const { pages: previewPages, isRendering: isRenderingPreview, renderAllPages } = usePreviewRenderer({
    designs: previewDesigns,
    config: previewConfig,
    getPageLabel: (index) => `${index + 1} 페이지`
  });

  const handlePreview = useCallback(async () => {
    await renderAllPages();
    setShowPreviewModal(true);
  }, [renderAllPages]);

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
      <ProductStartupModal
        isOpen={showStartupModal}
        productTypeName="엽서"
        ProductIcon={Mail}
        projectCount={projects?.data?.length || 0}
        onCreate={handleNewProject}
        onLoad={() => { setShowStartupModal(false); setShowLoadModal(true); }}
        onGoHome={() => { setShowStartupModal(false); navigate('/'); }}
      />

      <ProductLoadModal
        isOpen={showLoadModal}
        productTypeName="엽서"
        projects={projects?.data || []}
        isLoading={projectsLoading}
        currentProjectId={projectId}
        loadingProjectId={loadingProjectId}
        downloadingProjectId={downloadManager.loadingProjectId}
        onClose={() => setShowLoadModal(false)}
        onLoad={handleLoadProject}
        onCreate={handleNewProject}
        onRename={handleRenameProject}
        onDelete={(project) => setDeletingProject(project as ProductProject)}
        onDownload={(id) => downloadManager.initiateDownload(id, 'postcard')}
      />

      <DeleteConfirmModal
        isOpen={!!deletingProject}
        productTypeName="엽서"
        projectTitle={deletingProject?.title || ''}
        isDeleting={deleteMutation.isPending}
        onClose={() => setDeletingProject(null)}
        onConfirm={() => {
          if (deletingProject) {
            deleteMutation.mutate(deletingProject.id);
          }
        }}
      />

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
                    const isSelected = selectedGalleryIds.has(img.id);
                    return (
                      <div
                        key={img.id}
                        onClick={() => setSelectedGalleryIds(toggleGallerySelection(selectedGalleryIds, img.id))}
                        className={`relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-colors ${
                          isSelected ? 'border-indigo-500' : 'border-transparent hover:border-gray-400'
                        }`}
                      >
                        <img 
                          src={img.thumbnailUrl || img.transformedUrl || img.url} 
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
                {selectedGalleryIds.size}개 선택됨
              </span>
              <button
                onClick={handleAddGalleryImages}
                disabled={selectedGalleryIds.size === 0}
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
          onExtract={async (extractedBlob: Blob) => {
            const result = await saveExtractedImage(extractedBlob, `${extractingAsset.name}_extracted.png`);
            if (result.success && result.asset) {
              const asset: AssetItem = {
                id: result.asset.id,
                url: result.asset.previewUrl,
                fullUrl: result.asset.originalUrl,
                name: result.asset.filename || `${extractingAsset.name}_extracted`,
                width: result.asset.width,
                height: result.asset.height,
              };
              setState(prev => ({ ...prev, assets: [...prev.assets, asset] }));
              toast({ title: '이미지가 추출되었습니다' });
            } else {
              toast({ title: '이미지 추출 저장 실패', description: result.error, variant: 'destructive' });
            }
            setExtractingAsset(null);
          }}
        />
      )}

      {showBackgroundPicker && (
        <MaterialPickerModal
          isOpen={showBackgroundPicker}
          type="background"
          onClose={() => setShowBackgroundPicker(false)}
          onSelect={handleSelectBackground}
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

      <ProductEditorTopBar
        projectTitle={projectTitle}
        isSaving={isSaving}
        scale={state.scale}
        showBleed={state.showBleed}
        sizeOptions={(variants?.data || []).map((v): SizeOption => ({
          id: v.id,
          name: v.name,
          displaySize: `${v.widthMm}x${v.heightMm}mm`,
          isBest: v.isBest
        }))}
        selectedSizeId={state.variantId}
        onSave={saveProject}
        onLoad={() => setShowLoadModal(true)}
        onTitleChange={setProjectTitle}
        onToggleBleed={handleToggleBleed}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitView={handleFitView}
        onSetScale={handleSetScale}
        onChangeSize={(id) => handleChangeVariant(id as number)}
        onBack={() => unsavedGuard.guardedNavigate(() => navigate('/'))}
        isMagnifierMode={isMagnifierMode}
        onToggleMagnifier={() => setIsMagnifierMode(prev => !prev)}
        onPreview={handlePreview}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          assets={state.assets}
          usedAssetIds={getUsedAssetIds()}
          onUpload={assetActions.handleUpload}
          onDragStart={assetActions.handleDragStart}
          onAssetClick={assetActions.handleAssetClick}
          onDeleteAsset={handleDeleteAssetById}
          onExtractImage={setExtractingAsset}
          onOpenGallery={() => setShowGalleryModal(true)}
          isLoadingGallery={galleryLoading}
          pendingUploads={pendingUploads}
          onOpenBackgroundPicker={() => setShowBackgroundPicker(true)}
          onOpenIconPicker={() => setShowIconPicker(true)}
          onSelectBackground={handleApplyBackground}
          onSelectIcon={handleApplyIcon}
          onRemoveBackground={handleRemoveBackground}
          onRemoveIcon={handleRemoveIcon}
          selectedBackgrounds={selectedBackgrounds}
          selectedIcons={selectedIcons}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
          surfaceModel="single"
        />

        <PostcardEditorCanvas
          state={state}
          isPanningMode={isSpacePressed || isMagnifierMode}
          isMagnifierMode={isMagnifierMode}
          onUpdateObject={handleUpdateObject}
          onSelectObject={(id) => setState(prev => ({ ...prev, selectedObjectId: id }))}
          onAddObject={handleAddObject}
          onDeleteObject={handleDeleteObject}
          onDuplicateObject={handleDuplicateObject}
          onChangeOrder={handleChangeOrder}
          onUpdatePanOffset={(offset) => setState(prev => ({ ...prev, panOffset: offset }))}
          onSetScale={handleSetScale}
          workspaceRef={workspaceRef}
          onPreviewImage={handlePreviewImage}
        />
      </div>

      <ProductPageStrip
        mode="single"
        pages={state.designs.map(d => ({
          id: d.id,
          objects: d.objects,
          background: d.background,
          quantity: d.quantity,
          orientation: d.orientation
        }))}
        currentIndex={state.currentDesignIndex}
        dimensions={{
          widthPx: getEffectiveDimensions(state.variantConfig, 'landscape', DISPLAY_DPI).widthPx,
          heightPx: getEffectiveDimensions(state.variantConfig, 'landscape', DISPLAY_DPI).heightPx
        }}
        onSelect={handleSelectDesign}
        onAdd={handleAddDesign}
        onDelete={handleDeleteDesign}
        onReorder={handleReorderDesign}
        onUpdateQuantity={handleUpdateQuantity}
        onToggleOrientation={handleToggleOrientation}
      />

      {downloadManager.isModalOpen && downloadManager.downloadData && (
        <UnifiedDownloadModal
          isOpen={true}
          onClose={downloadManager.closeModal}
          categorySlug={downloadManager.downloadData.categorySlug}
          designs={downloadManager.downloadData.designs}
          variantConfig={downloadManager.downloadData.variantConfig}
          projectTitle={downloadManager.downloadData.projectTitle}
        />
      )}

      <ImagePreviewDialog
        image={previewImage}
        open={!!previewImage}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />

      <PreviewModal
        isOpen={showPreviewModal}
        onClose={closePreviewWithHistory}
        pages={previewPages}
        initialPageIndex={state.currentDesignIndex}
        title={projectTitle}
      />

      <UnsavedChangesDialog
        isOpen={unsavedGuard.showExitDialog}
        onClose={unsavedGuard.handleCancelExit}
        onSave={unsavedGuard.handleSaveAndExit}
        onDiscard={unsavedGuard.handleConfirmExit}
        isSaving={unsavedGuard.isSaving}
      />
    </div>
  );
}
