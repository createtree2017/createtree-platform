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
import { getEditorConfig, getDisplayDpi } from '@/constants/editorConfig';
import { 
  EDITOR_DISPLAY_DPI, 
  getEffectiveEditorDpi, 
  migrateDesignsArray,
  createEditorDpiPayload 
} from '@/utils/editorDpi';
import { Loader2, X, Check, Plus, Pencil, Trash2, Download } from 'lucide-react';
import { UnifiedDownloadModal } from '@/components/common/UnifiedDownloadModal';
import { PreviewImage } from '@/components/common/ImagePreviewDialog';
import { ProductLoadModal, DeleteConfirmModal, ProductProject as LoadModalProject } from '@/components/common/ProductLoadModal';
import { ProductStartupModal } from '@/components/common/ProductStartupModal';
import { PreviewModal } from '@/components/common/PreviewModal';
import { usePreviewRenderer, PreviewDesign, PreviewConfig } from '@/hooks/usePreviewRenderer';
import { useModalHistory } from '@/hooks/useModalHistory';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog';
import { useModal } from '@/hooks/useModal';
import { PartyPopper } from 'lucide-react';
import { DesignData } from '@/services/exportService';
import { GalleryImageItem, saveExtractedImage } from '@/services/imageIngestionService';
import { toggleGallerySelection, createEmptyGallerySelection } from '@/types/editor';
import { generateAndUploadThumbnail, updateProductThumbnail } from '@/services/thumbnailService';
import { useGalleryImageCopy } from '@/hooks/useGalleryImageCopy';
import { useAutoArrange, AUTO_ARRANGE_CONFIRM_MESSAGE } from '@/hooks/useAutoArrange';
import { isAdmin, MemberType } from '@/lib/auth-utils';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const partyConfig = getEditorConfig('party');

const DEFAULT_VARIANT_CONFIG: VariantConfig = {
  widthMm: 210,
  heightMm: 297,
  bleedMm: 3,
  dpi: 300
};

const createDesign = (): PostcardDesign => ({
  id: generateId(),
  objects: [],
  background: '#ffffff',
  quantity: 1,
  orientation: 'portrait'
});

const createInitialState = (defaultScale: number): PostcardEditorState => ({
  variantId: null,
  variantConfig: DEFAULT_VARIANT_CONFIG,
  designs: [createDesign()],
  currentDesignIndex: 0,
  assets: [],
  selectedObjectId: null,
  scale: defaultScale,
  panOffset: { x: 0, y: 0 },
  showBleed: false
});


export default function PartyPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isMobile = useMobile();
  
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState(partyConfig.defaultProjectTitle);
  const [state, setState] = useState<PostcardEditorState>(() => createInitialState(partyConfig.defaultScale));
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMagnifierMode, setIsMagnifierMode] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<Set<number>>(createEmptyGallerySelection);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(true);
  
  // 미션 컨텍스트 상태
  const [missionContext, setMissionContext] = useState<{ subMissionId: number; maxPages: number | null; themeMissionId: string | null } | null>(null);
  const [isMissionContextLoading, setIsMissionContextLoading] = useState(false);
  const [deletingProject, setDeletingProject] = useState<ProductProject | null>(null);
  const [activeGalleryFilter, setActiveGalleryFilter] = useState<GalleryFilterKey>('all');
  const modal = useModal();
  const [loadingProjectId, setLoadingProjectId] = useState<number | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedStateRef = useRef<string | null>(null);
  const isLoadingProjectRef = useRef(false);
  
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

  const currentDesign = state.designs[state.currentDesignIndex];
  const { widthMm, heightMm, bleedMm, dpi } = state.variantConfig;
  const displayDpi = getDisplayDpi();
  const orientation = currentDesign?.orientation || 'portrait';
  const dims = getEffectiveDimensions(state.variantConfig, orientation, displayDpi);
  const canvasWidth = dims.widthPx;
  const canvasHeight = dims.heightPx;
  const bleedPx = (bleedMm / 25.4) * displayDpi;

  const autoArrange = useAutoArrange({
    config: {
      canvasWidth,
      canvasHeight,
      bleedPx,
    },
    objects: currentDesign?.objects || [],
    onApply: (updates) => {
      setState(prev => {
        const newDesigns = [...prev.designs];
        const design = { ...newDesigns[prev.currentDesignIndex] };
        design.objects = design.objects.map(obj => {
          const update = updates.find(u => u.id === obj.id);
          if (update) {
            return {
              ...obj,
              x: update.x,
              y: update.y,
              width: update.width,
              height: update.height,
              contentWidth: update.width,
              contentHeight: update.height,
            };
          }
          return obj;
        });
        newDesigns[prev.currentDesignIndex] = design;
        return { ...prev, designs: newDesigns };
      });
    },
  });
  
  const { pendingUploads, copyGalleryImages, addPendingUpload, removePendingUpload } = useGalleryImageCopy({
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
    if (isLoadingProjectRef.current) return; // 프로젝트 로딩 중에는 isDirty 체크 스킵
    const currentStateStr = JSON.stringify({ state, projectTitle });
    setIsDirty(currentStateStr !== lastSavedStateRef.current);
  }, [state, projectTitle]);

  const hasInitializedVariant = useRef(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<{ data: ProductProject[] }>({
    queryKey: ['/api/products/projects', 'party', 'list'],
    queryFn: async () => {
      const response = await fetch('/api/products/projects?categorySlug=party&lightweight=true', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: !!user,
  });

  const { data: variants, isLoading: variantsLoading } = useQuery<{ data: ProductVariant[] }>({
    queryKey: ['/api/products/categories/party/variants'],
    queryFn: async () => {
      const response = await fetch('/api/products/categories/party/variants');
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
  const missionContextRef = useRef(missionContext);
  
  useEffect(() => {
    projectTitleRef.current = projectTitle;
  }, [projectTitle]);
  
  useEffect(() => {
    missionContextRef.current = missionContext;
  }, [missionContext]);

  const { save: saveProject, isSaving, resetProjectId } = useProjectSave({
    categorySlug: 'party',
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
      },
      subMissionId: missionContextRef.current?.subMissionId || null
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
              orientation: firstDesign.orientation || 'portrait',
            },
            variant: {
              widthMm: currentState.variantConfig.widthMm,
              heightMm: currentState.variantConfig.heightMm,
              bleedMm: currentState.variantConfig.bleedMm,
            },
            projectId: savedProjectId,
            projectType: 'party',
          });
          
          if (result.success && result.thumbnailUrl) {
            await updateProductThumbnail(savedProjectId, result.thumbnailUrl);
            queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
            console.log('[Party] 썸네일 업데이트 완료');
          }
        } catch (error) {
          console.warn('[Party] 썸네일 생성 실패 (저장은 완료됨):', error);
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
    isLoadingProjectRef.current = true;
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
      orientation: d.orientation || 'portrait'
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
    // 다음 렌더링 사이클 후에 로딩 플래그 해제
    setTimeout(() => { isLoadingProjectRef.current = false; }, 100);
    
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
    isLoadingProjectRef.current = true;
    setProjectId(null);
    setProjectTitle('새 행사용');
    
    const defaultVariant = variants?.data?.find(v => v.isBest) || variants?.data?.[0];
    
    if (defaultVariant) {
      hasInitializedVariant.current = true;
    }
    
    const newState = {
      ...createInitialState(partyConfig.defaultScale),
      variantId: defaultVariant?.id || null,
      variantConfig: defaultVariant ? {
        widthMm: defaultVariant.widthMm,
        heightMm: defaultVariant.heightMm,
        bleedMm: defaultVariant.bleedMm,
        dpi: defaultVariant.dpi
      } : DEFAULT_VARIANT_CONFIG
    };
    setState(newState);
    lastSavedStateRef.current = JSON.stringify({ state: newState, projectTitle: '새 행사용' });
    setIsDirty(false);
    setTimeout(() => { isLoadingProjectRef.current = false; }, 100);
    
    setShowStartupModal(false);
    setShowLoadModal(false);
  }, [variants?.data]);

  // 미션 컨텍스트 로드 함수
  const loadMissionContext = useCallback(async (subMissionId: number) => {
    setIsMissionContextLoading(true);
    try {
      const response = await fetch(`/api/products/party/mission-context?subMissionId=${subMissionId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch mission context');
      }
      const data = await response.json();
      
      // 미션 컨텍스트 상태 설정
      setMissionContext({ subMissionId, maxPages: data.maxPages, themeMissionId: data.themeMissionId || null });
      setShowStartupModal(false);
      
      if (data.existingProject) {
        // 기존 프로젝트가 있으면 로드
        loadProject(data.existingProject);
      } else if (data.templateProject) {
        // 템플릿 프로젝트가 있으면 데이터를 복사해서 새 프로젝트 시작
        isLoadingProjectRef.current = true;
        const templateData = data.templateProject.designsData as any;
        const templateVariant = variants?.data?.find(v => v.id === data.templateProject.variantId);
        const fallbackVariant = variants?.data?.find(v => v.isBest) || variants?.data?.[0];
        
        if (templateVariant || fallbackVariant) {
          hasInitializedVariant.current = true;
        }
        
        const resolvedVariantConfig = templateVariant ? {
          widthMm: templateVariant.widthMm,
          heightMm: templateVariant.heightMm,
          bleedMm: templateVariant.bleedMm,
          dpi: templateVariant.dpi
        } : fallbackVariant ? {
          widthMm: fallbackVariant.widthMm,
          heightMm: fallbackVariant.heightMm,
          bleedMm: fallbackVariant.bleedMm,
          dpi: fallbackVariant.dpi
        } : templateData?.variantConfig || DEFAULT_VARIANT_CONFIG;
        
        const loadedDesigns = (templateData?.designs || [createDesign()]).map((d: PostcardDesign) => ({
          ...d,
          id: generateId(), // 새 ID 생성
          orientation: d.orientation || 'portrait'
        }));
        
        const templateTitle = `미션 - ${data.templateProject.title || '새 행사용'}`;
        setProjectId(null); // 새 프로젝트로 시작
        setProjectTitle(templateTitle);
        
        const newState = {
          variantId: data.templateProject.variantId || fallbackVariant?.id || null,
          variantConfig: resolvedVariantConfig,
          designs: loadedDesigns,
          currentDesignIndex: 0,
          assets: templateData?.assets || [],
          selectedObjectId: null,
          scale: partyConfig.defaultScale,
          panOffset: { x: 0, y: 0 },
          showBleed: false
        };
        setState(newState);
        lastSavedStateRef.current = JSON.stringify({ state: newState, projectTitle: templateTitle });
        setIsDirty(false);
        setTimeout(() => { isLoadingProjectRef.current = false; }, 100);
      } else {
        // 템플릿도 없으면 빈 프로젝트 시작
        handleNewProject();
      }
    } catch (error) {
      console.error('Error loading mission context:', error);
      toast({ title: '미션 정보 로드 실패', description: '미션 정보를 불러오는데 실패했습니다.', variant: 'destructive' });
      handleNewProject();
    } finally {
      setIsMissionContextLoading(false);
    }
  }, [loadProject, handleNewProject, variants?.data, toast]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get('load');
    const subMissionIdParam = params.get('subMissionId');
    
    // 미션 컨텍스트 모드 처리 (subMissionId가 있을 때)
    if (subMissionIdParam && !missionContext && !authLoading && user && !isMissionContextLoading) {
      const subMissionId = parseInt(subMissionIdParam, 10);
      if (!isNaN(subMissionId)) {
        loadMissionContext(subMissionId);
        return;
      }
    }
    
    // 기존 load 로직 (미션 컨텍스트가 아닐 때만)
    if (loadId && !projectId && !authLoading && user && !missionContext) {
      const idNum = parseInt(loadId, 10);
      if (!isNaN(idNum)) {
        setShowStartupModal(false);
        handleLoadProject(idNum);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [authLoading, user, projectId, handleLoadProject, missionContext, isMissionContextLoading, loadMissionContext]);

  const handleRenameProject = useCallback(async (projectId: number, newTitle: string) => {
    await apiRequest(`/api/products/projects/${projectId}`, { 
      method: 'PATCH', 
      data: { title: newTitle } 
    });
    queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
  }, []);

  const handleToggleTemplate = useCallback(async (projectId: number, isTemplate: boolean) => {
    await apiRequest(`/api/products/projects/${projectId}/template`, { 
      method: 'PATCH', 
      data: { isTemplate } 
    });
    queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
    toast({ 
      title: isTemplate ? '템플릿으로 지정됨' : '템플릿 해제됨',
      description: isTemplate ? '이 프로젝트를 세부미션에 연결할 수 있습니다.' : '템플릿 지정이 해제되었습니다.'
    });
  }, [toast]);

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
      const orientation = currentDesign?.orientation || 'portrait';
      return getEffectiveDimensions(state.variantConfig, orientation, getDisplayDpi());
    },
    getCurrentObjectsCount: () => state.designs[state.currentDesignIndex]?.objects?.length || 0,
    addAssets: (newAssets) => setState(prev => ({ ...prev, assets: [...prev.assets, ...newAssets] })),
    addObject: handleAddObject,
    removeAsset: (id) => setState(prev => ({ ...prev, assets: prev.assets.filter(a => a.id !== id) })),
    setIsUploading,
    addPendingUpload,
    removePendingUpload,
  });

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
      const orientation = currentDesign?.orientation || 'portrait';
      return getEffectiveDimensions(state.variantConfig, orientation, getDisplayDpi());
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
    // 미션 컨텍스트가 있고 maxPages가 설정되어 있으면 페이지 수 제한 확인
    if (missionContext?.maxPages && state.designs.length >= missionContext.maxPages) {
      toast({ 
        title: '페이지 추가 불가', 
        description: `이 미션은 최대 ${missionContext.maxPages}페이지까지 만들 수 있습니다.`, 
        variant: 'destructive' 
      });
      return;
    }
    
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
      const oldOrientation = design.orientation || 'portrait';
      const newOrientation = oldOrientation === 'landscape' ? 'portrait' : 'landscape';
      
      const oldDims = getEffectiveDimensions(prev.variantConfig, oldOrientation, getDisplayDpi());
      const newDims = getEffectiveDimensions(prev.variantConfig, newOrientation, getDisplayDpi());
      
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
  const handleFitView = useCallback(() => {
    if (!workspaceRef.current) {
      setState(prev => ({ ...prev, scale: 0.3, panOffset: { x: 0, y: 0 } }));
      return;
    }
    
    const currentDesign = state.designs[state.currentDesignIndex];
    const orientation = currentDesign?.orientation || 'portrait';
    const dims = getEffectiveDimensions(state.variantConfig, orientation, getDisplayDpi());
    
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
  }, [state.designs, state.currentDesignIndex, state.variantConfig]);
  const handleSetScale = (scale: number) => setState(prev => ({ ...prev, scale }));
  const handleToggleBleed = () => setState(prev => ({ ...prev, showBleed: !prev.showBleed }));

  useEffect(() => {
    handleFitView();
    let timeoutId: ReturnType<typeof setTimeout>;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleFitView, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutId);
    };
  }, [handleFitView]);

  const handlePreviewImage = (obj: CanvasObject) => {
    if (obj.type === 'image' && obj.src) {
      modal.open('imagePreview', {
        image: {
          src: obj.src,
          fullSrc: obj.fullSrc || obj.src,
          title: '이미지 미리보기'
        },
        open: true,
        onOpenChange: (open: boolean) => !open && modal.close()
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
    setIsPreviewLoading(true);
    try {
      await renderAllPages();
      setShowPreviewModal(true);
    } finally {
      setIsPreviewLoading(false);
    }
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
        productTypeName="행사용"
        ProductIcon={PartyPopper}
        projectCount={projects?.data?.length || 0}
        onCreate={handleNewProject}
        onLoad={() => { setShowStartupModal(false); setShowLoadModal(true); }}
        onGoHome={() => { setShowStartupModal(false); navigate(missionContext?.themeMissionId ? `/missions/${missionContext.themeMissionId}` : '/'); }}
        unsavedGuard={unsavedGuard}
      />

      <ProductLoadModal
        isOpen={showLoadModal}
        productTypeName="행사용"
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
        onDownload={(id) => downloadManager.initiateDownload(id, 'party')}
        unsavedGuard={unsavedGuard}
        isAdmin={isAdmin(user?.memberType as MemberType | undefined)}
        onToggleTemplate={handleToggleTemplate}
      />

      <DeleteConfirmModal
        isOpen={!!deletingProject}
        productTypeName="행사용"
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

      <ProductEditorTopBar
        projectTitle={projectTitle}
        isSaving={isSaving}
        scale={state.scale}
        showBleed={state.showBleed}
        sizeOptions={[{ id: state.variantId || 10, name: 'A4' }]}
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
        onBack={() => unsavedGuard.guardedNavigate(() => navigate(missionContext?.themeMissionId ? `/missions/${missionContext.themeMissionId}` : '/'))}
        isMagnifierMode={isMagnifierMode}
        onToggleMagnifier={() => setIsMagnifierMode(prev => !prev)}
        isPreviewLoading={isPreviewLoading}
        onPreview={handlePreview}
        onAutoArrange={autoArrange.handleArrangeClick}
        autoArrangeDisabled={!autoArrange.canArrange}
        titleDisabled={!!missionContext}
        sizeDisabled={!!missionContext}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          assets={state.assets}
          usedAssetIds={getUsedAssetIds()}
          onUpload={assetActions.handleUpload}
          onDragStart={assetActions.handleDragStart}
          onAssetClick={assetActions.handleAssetClick}
          onDeleteAsset={(id) => {
            const asset = state.assets.find(a => a.id === id);
            if (asset) assetActions.handleDeleteAsset(asset);
          }}
          onExtractImage={(asset: AssetItem) => modal.open('imageExtractor', {
            imageUrl: asset.url,
            onExtract: async (extractedBlob: Blob) => {
              const result = await saveExtractedImage(extractedBlob, `${asset.name}_extracted.png`);
              if (result.success && result.asset) {
                const newAsset: AssetItem = {
                  id: result.asset.id,
                  url: result.asset.previewUrl,
                  fullUrl: result.asset.originalUrl,
                  name: result.asset.filename || `${asset.name}_extracted`,
                  width: result.asset.width,
                  height: result.asset.height,
                };
                setState(prev => ({ ...prev, assets: [...prev.assets, newAsset] }));
                toast({ title: '이미지가 추출되었습니다' });
              } else {
                toast({ title: '이미지 추출 저장 실패', description: result.error, variant: 'destructive' });
              }
              modal.close();
            }
          })}
          onOpenGallery={() => setShowGalleryModal(true)}
          isLoadingGallery={galleryLoading}
          pendingUploads={pendingUploads}
          onOpenBackgroundPicker={() => modal.open('materialPicker', { type: 'background', onSelect: handleSelectBackground })}
          onOpenIconPicker={() => modal.open('materialPicker', { type: 'icon', onSelect: handleSelectIcon })}
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
          widthPx: getEffectiveDimensions(state.variantConfig, 'landscape', getDisplayDpi()).widthPx,
          heightPx: getEffectiveDimensions(state.variantConfig, 'landscape', getDisplayDpi()).heightPx
        }}
        maxPages={missionContext?.maxPages}
        onSelect={handleSelectDesign}
        onAdd={handleAddDesign}
        onDelete={handleDeleteDesign}
        onReorder={handleReorderDesign}
        // 장수 선택 UI 숨김 (추후 필요 시 주석 해제)
        // onUpdateQuantity={handleUpdateQuantity}
        // onToggleOrientation={handleToggleOrientation}
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
