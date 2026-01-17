import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useDownloadManager } from '@/hooks/useDownloadManager';
import { useMobile } from '@/hooks/use-mobile';
import { GALLERY_FILTERS, GalleryFilterKey } from '@shared/constants';

import { Sidebar } from '@/components/photobook-v2/Sidebar';
import { useEditorMaterialsHandlers, BackgroundTarget, MaterialItem } from '@/hooks/useEditorMaterialsHandlers';
import { EditorCanvas } from '@/components/photobook-v2/EditorCanvas';
import { ProductEditorTopBar, SizeOption } from '@/components/product-editor';
import { ProductPageStrip, PageItem } from '@/components/product-editor/ProductPageStrip';
import { INITIAL_ALBUM, DPI, DISPLAY_DPI, ALBUM_SIZES } from '@/components/photobook-v2/constants';
import { LEGACY_DPI, migrateObjectCoordinates } from '@/utils/dimensionUtils';
import { 
  EditorState, 
  Spread, 
  AssetItem, 
  CanvasObject,
  AlbumConfig
} from '@/components/photobook-v2/types';
import { generateId } from '@/components/photobook-v2/utils';
import { Loader2, X, Check, Layers, Plus, Pencil, Trash2, Download } from 'lucide-react';
import { ImageExtractorModal } from '@/components/ImageExtractor';
import { MaterialPickerModal } from '@/components/photobook-v2/MaterialPickerModal';
import { ImagePreviewDialog, PreviewImage } from '@/components/common/ImagePreviewDialog';
import { UnifiedDownloadModal } from '@/components/common/UnifiedDownloadModal';
import { ProductLoadModal, DeleteConfirmModal, ProductProject as LoadModalProject } from '@/components/common/ProductLoadModal';
import { ProductStartupModal } from '@/components/common/ProductStartupModal';
import { PreviewModal } from '@/components/common/PreviewModal';
import { usePreviewRenderer, PreviewDesign, PreviewConfig } from '@/hooks/usePreviewRenderer';
import { useModalHistory } from '@/hooks/useModalHistory';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog';
import { uploadMultipleFromDevice, deleteImage, copyFromGallery, GalleryImageItem, toAssetItems, saveExtractedImage } from '@/services/imageIngestionService';
import { toggleGallerySelection, createEmptyGallerySelection } from '@/types/editor';
import { generateAndUploadThumbnail, updatePhotobookCoverImage } from '@/services/thumbnailService';

const createSpread = (index: number): Spread => ({
  id: generateId(),
  pageLeftId: generateId(),
  pageRightId: generateId(),
  objects: [],
  background: '#ffffff'
});

const createInitialState = (): EditorState => ({
  albumSize: INITIAL_ALBUM,
  spreads: [createSpread(0)],
  currentSpreadIndex: 0,
  assets: [],
  selectedObjectId: null,
  scale: 0.15,
  panOffset: { x: 0, y: 0 },
  showBleed: false,
});

interface PhotobookProject {
  id: number;
  title: string;
  pagesData: any;
  status: string;
  createdAt: string;
  updatedAt: string;
}


export default function PhotobookV2Page() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const isMobile = useMobile();
  
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState('새 포토북');
  const [state, setState] = useState<EditorState>(createInitialState);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isMagnifierMode, setIsMagnifierMode] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [selectedGalleryIds, setSelectedGalleryIds] = useState<Set<number>>(createEmptyGallerySelection);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(true);
  const [deletingProject, setDeletingProject] = useState<PhotobookProject | null>(null);
  const [extractingAsset, setExtractingAsset] = useState<AssetItem | null>(null);
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [activeGalleryFilter, setActiveGalleryFilter] = useState<GalleryFilterKey>('all');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingUploads, setPendingUploads] = useState<{ id: number; name: string }[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedStateRef = useRef<string | null>(null);
  const clearCacheRef = useRef<(() => void) | null>(null);
  
  const { closeWithHistory: closePreviewWithHistory } = useModalHistory({
    isOpen: showPreviewModal,
    onClose: () => setShowPreviewModal(false),
    modalId: 'preview',
  });

  const unsavedGuard = useUnsavedChangesGuard({
    isDirty,
    onSave: async () => {
      await new Promise<void>((resolve, reject) => {
        saveProjectMutation.mutate(undefined, {
          onSuccess: () => resolve(),
          onError: () => reject(),
        });
      });
    },
  });
  
  const downloadManager = useDownloadManager();
  
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

  const [loadingProjectId, setLoadingProjectId] = useState<number | null>(null);

  const { data: projects, isLoading: projectsLoading } = useQuery<{ data: PhotobookProject[] }>({
    queryKey: ['/api/photobook/projects', 'list'],
    queryFn: async () => {
      const response = await fetch('/api/photobook/projects?lightweight=true', {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch projects');
      return response.json();
    },
    enabled: !!user,
  });

  interface GalleryImage {
    id: number;
    url: string;
    transformedUrl: string;
    thumbnailUrl: string;
    fullUrl?: string;
    originalUrl?: string;
    title: string;
    type: string;
    createdAt: string;
  }

  const { data: galleryImages, isLoading: galleryLoading } = useQuery<GalleryImage[]>({
    queryKey: ['/api/gallery', activeGalleryFilter],
    queryFn: async () => {
      const filterParam = activeGalleryFilter !== 'all' ? `?filter=${activeGalleryFilter}` : '';
      const response = await fetch(`/api/gallery${filterParam}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('갤러리 로드 실패');
      return response.json();
    },
    enabled: !!user && showGalleryModal,
  });

  const createProjectMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest('/api/photobook/projects', { 
        method: 'POST',
        data: {
          title,
          canvasWidth: Math.round(state.albumSize.widthInches * DPI * 2),
          canvasHeight: Math.round(state.albumSize.heightInches * DPI)
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        setProjectId(data.data.id);
        setProjectTitle(data.data.title);
        queryClient.invalidateQueries({ queryKey: ['/api/photobook/projects'] });
        toast({ title: '프로젝트가 생성되었습니다' });
      }
    },
    onError: () => {
      toast({ title: '프로젝트 생성 실패', variant: 'destructive' });
    }
  });

  const saveProjectMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        const createResponse = await apiRequest('/api/photobook/projects', { 
          method: 'POST',
          data: {
            title: projectTitle,
            canvasWidth: Math.round(state.albumSize.widthInches * DPI * 2),
            canvasHeight: Math.round(state.albumSize.heightInches * DPI)
          }
        });
        const createData = await createResponse.json();
        if (createData.success && createData.data) {
          setProjectId(createData.data.id);
          const updateResponse = await apiRequest(`/api/photobook/projects/${createData.data.id}`, {
            method: 'PATCH',
            data: {
              pagesData: { 
                editorState: state,
                editorDpi: DISPLAY_DPI,
                version: 2
              },
              title: projectTitle
            }
          });
          return updateResponse.json();
        }
        throw new Error('프로젝트 생성 실패');
      }

      const response = await apiRequest(`/api/photobook/projects/${projectId}`, {
        method: 'PATCH',
        data: {
          pagesData: { 
            editorState: state,
            editorDpi: DISPLAY_DPI,
            version: 2
          },
          title: projectTitle
        }
      });
      return response.json();
    },
    onSuccess: async (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/photobook/projects'] });
        toast({ title: '저장되었습니다' });
        lastSavedStateRef.current = JSON.stringify({ state: stateRef.current, projectTitle });
        setIsDirty(false);
        
        const savedProjectId = data.data?.id || projectId;
        if (savedProjectId && stateRef.current.spreads.length > 0) {
          const INCH_TO_MM = 25.4;
          const currentState = stateRef.current;
          const firstSpread = currentState.spreads[0];
          
          try {
            const result = await generateAndUploadThumbnail({
              design: {
                id: firstSpread.id,
                objects: firstSpread.objects,
                background: firstSpread.background || '#ffffff',
                backgroundLeft: firstSpread.backgroundLeft,
                backgroundRight: firstSpread.backgroundRight,
                orientation: 'landscape',
              },
              variant: {
                widthMm: currentState.albumSize.widthInches * 2 * INCH_TO_MM,
                heightMm: currentState.albumSize.heightInches * INCH_TO_MM,
              },
              projectId: savedProjectId,
              projectType: 'photobook',
            });
            
            if (result.success && result.thumbnailUrl) {
              await updatePhotobookCoverImage(savedProjectId, result.thumbnailUrl);
              queryClient.invalidateQueries({ queryKey: ['/api/photobook/projects'] });
              console.log('[Photobook] 썸네일 업데이트 완료');
            }
          } catch (error) {
            console.warn('[Photobook] 썸네일 생성 실패 (저장은 완료됨):', error);
          }
        }
      }
    },
    onError: () => {
      toast({ title: '저장 실패', variant: 'destructive' });
    }
  });

  
  const deleteProjectMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/photobook/projects/${id}`, {
        method: 'DELETE'
      });
      return response.json();
    },
    onSuccess: (data, deletedId) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/photobook/projects'] });
        toast({ title: '포토북이 삭제되었습니다' });
        if (projectId === deletedId) {
          setProjectId(null);
          setProjectTitle('새 포토북');
          setState(createInitialState());
        }
      }
    },
    onError: () => {
      toast({ title: '삭제 실패', variant: 'destructive' });
    }
  });

  const renameProjectMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      const response = await apiRequest(`/api/photobook/projects/${id}`, {
        method: 'PATCH',
        data: { title }
      });
      return response.json();
    },
    onSuccess: (data, variables) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/photobook/projects'] });
        toast({ title: '이름이 변경되었습니다' });
        if (projectId === variables.id) {
          setProjectTitle(variables.title);
        }
      }
    },
    onError: () => {
      toast({ title: '이름 변경 실패', variant: 'destructive' });
    }
  });

  const handleRenameProject = useCallback(async (projectId: number, newTitle: string) => {
    await new Promise<void>((resolve, reject) => {
      renameProjectMutation.mutate(
        { id: projectId, title: newTitle },
        {
          onSuccess: () => resolve(),
          onError: () => reject(new Error('Rename failed'))
        }
      );
    });
  }, [renameProjectMutation]);

  const handleExtractImage = (asset: AssetItem) => {
    setExtractingAsset(asset);
  };

  const handleExtractComplete = async (blob: Blob) => {
    const result = await saveExtractedImage(blob, `${extractingAsset?.name || 'image'}_extracted.png`);
    
    if (result.success && result.asset) {
      setState(prev => ({
        ...prev,
        assets: [...prev.assets, {
          id: result.asset!.id,
          url: result.asset!.previewUrl,
          fullUrl: result.asset!.originalUrl,
          name: result.asset!.filename || '추출 이미지',
          width: result.asset!.width,
          height: result.asset!.height
        }]
      }));
      toast({ title: '이미지가 추출되었습니다' });
    } else {
      toast({ title: '이미지 추출 저장 실패', description: result.error, variant: 'destructive' });
    }
    
    setExtractingAsset(null);
  };

  const usedAssetIds = useMemo(() => {
    const usedUrls = new Set<string>();
    state.spreads.forEach(spread => {
      spread.objects.forEach(obj => {
        if (obj.type === 'image' && obj.src) {
          usedUrls.add(obj.src);
        }
      });
    });
    
    const ids = new Set<string>();
    state.assets.forEach(asset => {
      if (usedUrls.has(asset.url)) {
        ids.add(asset.id);
      }
    });
    return ids;
  }, [state.spreads, state.assets]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const result = await uploadMultipleFromDevice(Array.from(files));
      
      if (result.success && result.assets) {
        const newAssets: AssetItem[] = toAssetItems(result.assets);
        
        setState(prev => ({ ...prev, assets: [...prev.assets, ...newAssets] }));
        toast({ title: '업로드 완료', description: `${newAssets.length}개 이미지가 업로드되었습니다.` });
      } else {
        toast({ title: '업로드 실패', description: result.errors?.join(', ') || '이미지 업로드에 실패했습니다.', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: '업로드 실패', description: '이미지 업로드 중 오류가 발생했습니다.', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    if (usedAssetIds.has(assetId)) {
      return;
    }
    setAssetToDelete(assetId);
  };

  const confirmDeleteAsset = async () => {
    if (assetToDelete) {
      const asset = state.assets.find(a => a.id === assetToDelete);
      if (asset) {
        const originalUrl = asset.fullUrl;
        const previewUrl = asset.url;
        
        if (originalUrl?.includes('storage.googleapis.com') || previewUrl?.includes('storage.googleapis.com')) {
          deleteImage(originalUrl, previewUrl).catch(err => {
            console.error('GCS 파일 삭제 실패:', err);
          });
        }
      }
      setState(prev => ({
        ...prev,
        assets: prev.assets.filter(a => a.id !== assetToDelete)
      }));
      setAssetToDelete(null);
    }
  };

  const handleOpenGallery = () => {
    setSelectedGalleryIds(createEmptyGallerySelection());
    setActiveGalleryFilter('all');
    setShowGalleryModal(true);
  };

  const handleToggleGalleryImage = (imageId: number) => {
    setSelectedGalleryIds(toggleGallerySelection(selectedGalleryIds, imageId));
  };

  const handleAddGalleryImages = async () => {
    if (!galleryImages || selectedGalleryIds.size === 0) return;
    
    const selectedIds = Array.from(selectedGalleryIds);
    setShowGalleryModal(false);
    setSelectedGalleryIds(createEmptyGallerySelection());
    
    const pending = selectedIds.map(id => {
      const img = galleryImages.find(g => g.id === id);
      return { id, name: img?.title || `이미지 ${id}` };
    }).filter(p => p !== null);
    
    setPendingUploads(pending);
    
    let addedCount = 0;
    for (const id of selectedIds) {
      const galleryImg = galleryImages.find(g => g.id === id);
      if (!galleryImg) {
        setPendingUploads(prev => prev.filter(p => p.id !== id));
        continue;
      }
      
      try {
        const result = await copyFromGallery(galleryImg as GalleryImageItem);
        
        setPendingUploads(prev => prev.filter(p => p.id !== id));
        
        if (result.success && result.asset) {
          const asset: AssetItem = {
            id: result.asset.id,
            url: result.asset.previewUrl,
            fullUrl: result.asset.originalUrl,
            name: result.asset.filename,
            width: result.asset.width,
            height: result.asset.height,
          };
          setState(prev => ({ ...prev, assets: [...prev.assets, asset] }));
          addedCount++;
        } else {
          console.error('[Photobook] 갤러리 이미지 복사 실패:', result.error);
        }
      } catch (error) {
        console.error('[Photobook] 갤러리 이미지 처리 오류:', error);
        setPendingUploads(prev => prev.filter(p => p.id !== id));
      }
    }
    
    if (addedCount > 0) {
      toast({ title: `${addedCount}개 이미지가 추가되었습니다` });
    }
  };

  const handleDragStart = (e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAssetClick = (asset: AssetItem) => {
    const { albumSize, currentSpreadIndex, spreads } = state;
    const currentSpread = spreads[currentSpreadIndex];
    
    const pageWidthPx = albumSize.widthInches * DISPLAY_DPI;
    const spreadWidthPx = pageWidthPx * 2;
    const pageHeightPx = albumSize.heightInches * DISPLAY_DPI;

    const defaultWidth = pageWidthPx * 0.4;
    const ratio = asset.width / asset.height;
    const defaultHeight = defaultWidth / ratio;
    
    const centerX = spreadWidthPx / 2;
    const centerY = pageHeightPx / 2;

    const newObject: CanvasObject = {
      id: generateId(),
      type: 'image',
      src: asset.url,
      fullSrc: asset.fullUrl || asset.url,
      x: centerX - defaultWidth / 2,
      y: centerY - defaultHeight / 2,
      width: defaultWidth,
      height: defaultHeight,
      rotation: 0,
      contentX: 0,
      contentY: 0,
      contentWidth: defaultWidth,
      contentHeight: defaultHeight,
      zIndex: currentSpread.objects.length + 1,
      opacity: 1,
    };
    
    addObject(newObject);
  };

  const updateObject = (id: string, updates: Partial<CanvasObject>) => {
    setState(prev => {
      const newSpreads = prev.spreads.map((spread, idx) => {
        if (idx !== prev.currentSpreadIndex) return spread;
        return {
          ...spread,
          objects: spread.objects.map(obj => 
            obj.id === id ? { ...obj, ...updates } : obj
          )
        };
      });
      return { ...prev, spreads: newSpreads };
    });
  };

  const addObject = (obj: CanvasObject) => {
    setState(prev => {
      const newSpreads = prev.spreads.map((spread, idx) => {
        if (idx !== prev.currentSpreadIndex) return spread;
        return {
          ...spread,
          objects: [...spread.objects, obj]
        };
      });
      return { ...prev, spreads: newSpreads, selectedObjectId: obj.id };
    });
  };

  const materialsHandlers = useEditorMaterialsHandlers({
    surfaceModel: 'spread',
    getCurrentSpreadIndex: () => state.currentSpreadIndex,
    updateSpreadBackground: (index: number, target: BackgroundTarget, background: string | undefined) => {
      setState(s => {
        const newSpreads = [...s.spreads];
        const currentSpread = newSpreads[index];
        
        if (target === 'left') {
          newSpreads[index] = { ...currentSpread, backgroundLeft: background };
        } else if (target === 'right') {
          newSpreads[index] = { ...currentSpread, backgroundRight: background };
        } else {
          newSpreads[index] = { 
            ...currentSpread, 
            background, 
            backgroundLeft: undefined, 
            backgroundRight: undefined 
          };
        }
        return { ...s, spreads: newSpreads };
      });
    },
    getObjectsCount: () => state.spreads[state.currentSpreadIndex]?.objects?.length || 0,
    addObject,
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

  const deleteObject = useCallback((id: string) => {
    setState(prev => {
      const newSpreads = prev.spreads.map((spread, idx) => {
        if (idx !== prev.currentSpreadIndex) return spread;
        return {
          ...spread,
          objects: spread.objects.filter(obj => obj.id !== id)
        };
      });
      return { ...prev, spreads: newSpreads, selectedObjectId: null };
    });
  }, []);

  const duplicateObject = useCallback((id: string) => {
    setState(prev => {
      const currentSpread = prev.spreads[prev.currentSpreadIndex];
      const objToDuplicate = currentSpread.objects.find(obj => obj.id === id);
      if (!objToDuplicate) return prev;
      
      const newObj = {
        ...objToDuplicate,
        id: generateId(),
        x: objToDuplicate.x + 30,
        y: objToDuplicate.y + 30,
        zIndex: currentSpread.objects.length + 1
      };
      
      const newSpreads = prev.spreads.map((spread, idx) => {
        if (idx !== prev.currentSpreadIndex) return spread;
        return {
          ...spread,
          objects: [...spread.objects, newObj]
        };
      });
      return { ...prev, spreads: newSpreads, selectedObjectId: newObj.id };
    });
  }, []);

  const changeOrder = (id: string, direction: 'up' | 'down') => {
    setState(prev => {
      const currentSpread = prev.spreads[prev.currentSpreadIndex];
      const index = currentSpread.objects.findIndex(o => o.id === id);
      if (index === -1) return prev;

      const newObjects = [...currentSpread.objects];
      const obj = { ...newObjects[index] };
      
      newObjects.splice(index, 1);
      if (direction === 'up') {
        newObjects.splice(Math.min(newObjects.length, index + 1), 0, obj);
      } else {
        newObjects.splice(Math.max(0, index - 1), 0, obj);
      }

      const updatedObjects = newObjects.map((o, i) => ({ ...o, zIndex: i + 1 }));
      
      const newSpreads = prev.spreads.map((spread, idx) => {
        if (idx !== prev.currentSpreadIndex) return spread;
        return { ...spread, objects: updatedObjects };
      });
      
      return { ...prev, spreads: newSpreads };
    });
  };

  const addSpread = useCallback(() => {
    setState(prev => ({
      ...prev,
      spreads: [...prev.spreads, createSpread(prev.spreads.length)],
      currentSpreadIndex: prev.spreads.length,
      selectedObjectId: null
    }));
  }, []);

  const requestDeleteSpread = useCallback(() => {
    const currentState = stateRef.current;
    if (currentState.spreads.length <= 1) {
      toast({ title: '최소 한 페이지는 유지해야 합니다', variant: 'destructive' });
      return;
    }
    setShowDeleteDialog(true);
  }, [toast]);

  const confirmDeleteSpread = useCallback(() => {
    setState(prev => {
      const newSpreads = prev.spreads.filter((_, i) => i !== prev.currentSpreadIndex);
      const newIndex = Math.max(0, Math.min(newSpreads.length - 1, prev.currentSpreadIndex));
      return {
        ...prev,
        spreads: newSpreads,
        currentSpreadIndex: newIndex,
        selectedObjectId: null
      };
    });
    setShowDeleteDialog(false);
  }, []);

  const handleSave = () => {
    saveProjectMutation.mutate();
  };

  const handleLoad = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/photobook/projects'] });
    setShowLoadModal(true);
  };

  const handleTitleChange = async (newTitle: string) => {
    const oldTitle = projectTitle;
    setProjectTitle(newTitle);
    
    if (projectId) {
      try {
        const response = await apiRequest(`/api/photobook/projects/${projectId}`, {
          method: 'PATCH',
          data: { title: newTitle }
        });
        const data = await response.json();
        
        if (!response.ok || !data.success) {
          setProjectTitle(oldTitle);
          toast({ title: '제목 저장 실패', variant: 'destructive' });
          return;
        }
        
        queryClient.invalidateQueries({ queryKey: ['/api/photobook/projects'] });
        toast({ title: '제목이 저장되었습니다' });
      } catch {
        setProjectTitle(oldTitle);
        toast({ title: '제목 저장 실패', variant: 'destructive' });
      }
    }
  };

  const handleStartNew = () => {
    setProjectId(null);
    setProjectTitle('새 포토북');
    const newState = createInitialState();
    setState(newState);
    lastSavedStateRef.current = JSON.stringify({ state: newState, projectTitle: '새 포토북' });
    setIsDirty(false);
    setShowStartupModal(false);
  };

  const handleStartFromLoad = () => {
    setShowStartupModal(false);
    handleLoad();
  };

  const handleLoadProject = useCallback(async (projectIdToLoad: number) => {
    setLoadingProjectId(projectIdToLoad);
    try {
      const response = await fetch(`/api/photobook/projects/${projectIdToLoad}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to fetch project');
      const result = await response.json();
      if (result.success && result.data) {
        const project = result.data as PhotobookProject;
        
        const convertThumbnailToOriginal = (url: string): string => {
          if (!url?.includes('/thumbnails/')) return url;
          return url.replace('/thumbnails/', '/');
        };
        
        if (project.pagesData?.editorState) {
          const editorState = project.pagesData.editorState;
          
          const migratedAssets = (editorState.assets || []).map((asset: AssetItem) => {
            if (asset.url?.includes('/thumbnails/')) {
              const resolvedUrl = asset.fullUrl || convertThumbnailToOriginal(asset.url);
              return { ...asset, url: resolvedUrl, fullUrl: asset.fullUrl || resolvedUrl };
            }
            return asset;
          });
          
          const savedEditorDpi = project.pagesData.editorDpi || LEGACY_DPI;
          const migratedSpreads = (editorState.spreads || []).map((spread: Spread) => ({
            ...spread,
            objects: spread.objects.map((obj: CanvasObject) => {
              let migratedObj = obj;
              if (obj.type === 'image' && obj.src?.includes('/thumbnails/')) {
                const resolvedSrc = obj.fullSrc || convertThumbnailToOriginal(obj.src);
                migratedObj = { ...obj, src: resolvedSrc, fullSrc: obj.fullSrc || resolvedSrc };
              }
              return migrateObjectCoordinates(migratedObj, savedEditorDpi, DISPLAY_DPI);
            })
          }));
          
          const loadedState = {
            ...editorState,
            assets: migratedAssets,
            spreads: migratedSpreads
          };
          setState(loadedState);
          lastSavedStateRef.current = JSON.stringify({ state: loadedState, projectTitle: project.title });
          setIsDirty(false);
        } else {
          const newState = createInitialState();
          setState(newState);
          lastSavedStateRef.current = JSON.stringify({ state: newState, projectTitle: project.title });
          setIsDirty(false);
        }
        
        clearCacheRef.current?.();
        setProjectId(project.id);
        setProjectTitle(project.title);
        setShowLoadModal(false);
        setShowStartupModal(false);
        toast({ title: `"${project.title}" 프로젝트를 불러왔습니다` });
      } else {
        toast({ title: '프로젝트를 찾을 수 없습니다', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error loading project:', error);
      toast({ title: '불러오기 실패', description: '프로젝트를 불러오는데 실패했습니다.', variant: 'destructive' });
    } finally {
      setLoadingProjectId(null);
    }
  }, [toast]);

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

  const handleDeleteSelected = useCallback(() => {
    setState(prev => {
      if (!prev.selectedObjectId) return prev;
      
      const newSpreads = prev.spreads.map((spread, idx) => {
        if (idx !== prev.currentSpreadIndex) return spread;
        return {
          ...spread,
          objects: spread.objects.filter(obj => obj.id !== prev.selectedObjectId)
        };
      });
      
      return { ...prev, spreads: newSpreads, selectedObjectId: null };
    });
  }, []);

  const handleFitView = useCallback(() => {
    const effectiveSidebarWidth = sidebarCollapsed ? 48 : 320;
    const topBarHeight = 64;
    const pageStripHeight = 176;
    const padding = 60;

    const viewportWidth = window.innerWidth - effectiveSidebarWidth - padding;
    const viewportHeight = window.innerHeight - topBarHeight - pageStripHeight - padding;

    const albumPixelWidth = state.albumSize.widthInches * 2 * DISPLAY_DPI;
    const albumPixelHeight = state.albumSize.heightInches * DISPLAY_DPI;

    const scaleW = viewportWidth / albumPixelWidth;
    const scaleH = viewportHeight / albumPixelHeight;

    const newScale = Math.min(scaleW, scaleH);

    setState(prev => ({ 
      ...prev, 
      scale: Math.max(Math.min(newScale, 0.8), 0.02),
      panOffset: { x: 0, y: 0 }
    })); 
  }, [state.albumSize, sidebarCollapsed]);

  const handleSelectSpread = (idx: number) => {
    setState(s => ({ ...s, currentSpreadIndex: idx, selectedObjectId: null }));
  };

  const handleReorderSpread = useCallback((fromIndex: number, toIndex: number) => {
    setState(prev => {
      const newSpreads = [...prev.spreads];
      const [removed] = newSpreads.splice(fromIndex, 1);
      newSpreads.splice(toIndex, 0, removed);
      
      let newCurrentIndex = prev.currentSpreadIndex;
      if (prev.currentSpreadIndex === fromIndex) {
        newCurrentIndex = toIndex;
      } else if (fromIndex < prev.currentSpreadIndex && toIndex >= prev.currentSpreadIndex) {
        newCurrentIndex = prev.currentSpreadIndex - 1;
      } else if (fromIndex > prev.currentSpreadIndex && toIndex <= prev.currentSpreadIndex) {
        newCurrentIndex = prev.currentSpreadIndex + 1;
      }
      
      return { ...prev, spreads: newSpreads, currentSpreadIndex: newCurrentIndex };
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const currentState = stateRef.current;
      
      if (e.code === 'Space' && !isSpacePressed) {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          setIsSpacePressed(true);
        }
      }

      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (currentState.selectedObjectId) {
          e.preventDefault();
          handleDeleteSelected();
          return;
        }
      }

      if (currentState.selectedObjectId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        
        setState(prev => {
          if (!prev.selectedObjectId) return prev;
          
          const newSpreads = prev.spreads.map((spread, idx) => {
            if (idx !== prev.currentSpreadIndex) return spread;
            
            const objIndex = spread.objects.findIndex(o => o.id === prev.selectedObjectId);
            if (objIndex === -1) return spread;

            const newObjects = spread.objects.map((obj, i) => {
              if (i !== objIndex) return obj;
              const newObj = { ...obj };
              switch (e.key) {
                case 'ArrowUp': newObj.y -= step; break;
                case 'ArrowDown': newObj.y += step; break;
                case 'ArrowLeft': newObj.x -= step; break;
                case 'ArrowRight': newObj.x += step; break;
              }
              return newObj;
            });
            
            return { ...spread, objects: newObjects };
          });
          
          return { ...prev, spreads: newSpreads };
        });
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    }
  }, [isSpacePressed, handleDeleteSelected]);

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

  const previewDesigns: PreviewDesign[] = useMemo(() => 
    state.spreads.map(spread => ({
      id: spread.id,
      objects: spread.objects,
      background: spread.background || '#ffffff',
      backgroundLeft: spread.backgroundLeft,
      backgroundRight: spread.backgroundRight,
      orientation: 'landscape' as const
    })), 
    [state.spreads]
  );

  const previewConfig: PreviewConfig = useMemo(() => {
    const INCH_TO_MM = 25.4;
    const spreadWidthMm = state.albumSize.widthInches * 2 * INCH_TO_MM;
    const spreadHeightMm = state.albumSize.heightInches * INCH_TO_MM;
    return {
      widthMm: spreadWidthMm,
      heightMm: spreadHeightMm,
      dpi: DPI
    };
  }, [state.albumSize]);

  const { pages: previewPages, isRendering: isRenderingPreview, renderAllPages, clearCache } = usePreviewRenderer({
    designs: previewDesigns,
    config: previewConfig,
    getPageLabel: (index) => `${index * 2 + 1}-${index * 2 + 2} 페이지`
  });

  useEffect(() => {
    clearCacheRef.current = clearCache;
  }, [clearCache]);

  const handlePreview = useCallback(async () => {
    clearCache();
    await renderAllPages();
    setShowPreviewModal(true);
  }, [clearCache, renderAllPages]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden text-gray-800 font-sans relative">
      <ProductEditorTopBar
        projectTitle={projectTitle}
        isSaving={saveProjectMutation.isPending}
        scale={state.scale}
        showBleed={state.showBleed}
        sizeOptions={Object.entries(ALBUM_SIZES).map(([key, config], idx) => ({
          id: idx + 1,
          name: config.name.split('(')[0].trim(),
          displaySize: key
        }))}
        selectedSizeId={Object.keys(ALBUM_SIZES).findIndex(key => key === state.albumSize.id) + 1 || 1}
        isMagnifierMode={isMagnifierMode}
        onToggleMagnifier={() => setIsMagnifierMode(prev => !prev)}
        onSave={handleSave}
        onLoad={handleLoad}
        onTitleChange={handleTitleChange}
        onToggleBleed={() => setState(s => ({ ...s, showBleed: !s.showBleed }))}
        onZoomIn={() => setState(s => ({ ...s, scale: s.scale * 1.1 }))}
        onZoomOut={() => setState(s => ({ ...s, scale: s.scale * 0.9 }))}
        onFitView={handleFitView}
        onSetScale={(newScale: number) => setState(s => ({ ...s, scale: newScale }))}
        onChangeSize={(sizeId) => {
          const id = typeof sizeId === 'number' ? sizeId : parseInt(sizeId, 10);
          const sizeKeys = Object.keys(ALBUM_SIZES);
          const selectedKey = sizeKeys[id - 1];
          const selectedSize = ALBUM_SIZES[selectedKey];
          if (selectedSize) {
            setState(s => ({ ...s, albumSize: selectedSize }));
          }
        }}
        onBack={() => unsavedGuard.guardedNavigate(() => navigate('/'))}
        onPreview={handlePreview}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          assets={state.assets} 
          usedAssetIds={usedAssetIds}
          onUpload={handleUpload}
          onDragStart={handleDragStart}
          onAssetClick={handleAssetClick}
          onDeleteAsset={handleDeleteAsset}
          onExtractImage={handleExtractImage}
          onOpenGallery={handleOpenGallery}
          isLoadingGallery={isUploading || galleryLoading}
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
          surfaceModel="spread"
        />
        
        <EditorCanvas 
          state={state}
          isPanningMode={isSpacePressed || isMagnifierMode}
          isMagnifierMode={isMagnifierMode}
          onUpdateObject={updateObject}
          onSelectObject={(id) => setState(s => ({ ...s, selectedObjectId: id }))}
          onAddObject={addObject}
          onDeleteObject={deleteObject}
          onDuplicateObject={duplicateObject}
          onChangeOrder={changeOrder}
          onUpdatePanOffset={(offset) => setState(s => ({ ...s, panOffset: offset }))}
          onSetScale={(newScale: number) => setState(s => ({ ...s, scale: newScale }))}
          onPreviewImage={(obj) => {
            if (obj.type === 'image' && obj.src) {
              setPreviewImage({
                src: obj.src,
                fullSrc: obj.fullSrc || obj.src,
                title: '이미지 미리보기'
              });
            }
          }}
        />
      </div>

      <ProductPageStrip
        mode="spread"
        pages={state.spreads.map(spread => ({
          id: spread.id,
          objects: spread.objects,
          background: spread.background,
          backgroundLeft: spread.backgroundLeft,
          backgroundRight: spread.backgroundRight
        }))}
        currentIndex={state.currentSpreadIndex}
        dimensions={{
          widthPx: Math.round(state.albumSize.widthInches * DPI * 2),
          heightPx: Math.round(state.albumSize.heightInches * DPI)
        }}
        label="페이지"
        onSelect={handleSelectSpread}
        onAdd={addSpread}
        onDelete={requestDeleteSpread}
        onReorder={handleReorderSpread}
      />

      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowDeleteDialog(false)}
          ></div>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full z-10 overflow-hidden animate-in fade-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">페이지 삭제</h3>
              <p className="text-gray-600 mb-6">
                현재 페이지와 포함된 모든 사진이 삭제됩니다.<br/>이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setShowDeleteDialog(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors font-medium text-sm"
                >
                  취소
                </button>
                <button 
                  onClick={confirmDeleteSpread}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors font-medium text-sm shadow-sm"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {assetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setAssetToDelete(null)}
          ></div>
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full z-10 overflow-hidden animate-in fade-in duration-200">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">사진 삭제</h3>
              <p className="text-gray-600 mb-6">
                보관함에서 이 사진을 삭제하시겠습니까?
              </p>
              <div className="flex justify-end space-x-3">
                <button 
                  onClick={() => setAssetToDelete(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors font-medium text-sm"
                >
                  취소
                </button>
                <button 
                  onClick={confirmDeleteAsset}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors font-medium text-sm shadow-sm"
                >
                  삭제
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showGalleryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setShowGalleryModal(false)}
          ></div>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] z-10 overflow-hidden animate-in fade-in duration-200 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">내 갤러리에서 선택</h3>
              <button 
                onClick={() => setShowGalleryModal(false)}
                className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex flex-wrap gap-2 p-4 border-b bg-gray-50">
              {GALLERY_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveGalleryFilter(filter.key)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-full transition-all ${
                    activeGalleryFilter === filter.key
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              {galleryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : !galleryImages || galleryImages.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <p>
                    {activeGalleryFilter === 'all' 
                      ? '갤러리에 이미지가 없습니다.' 
                      : `${GALLERY_FILTERS.find(f => f.key === activeGalleryFilter)?.label || ''}이(가) 없습니다.`
                    }
                  </p>
                  <p className="text-sm mt-2">먼저 이미지를 생성해 주세요.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {galleryImages.map((img) => {
                    const displayUrl = img.thumbnailUrl || img.transformedUrl || img.url;
                    const isSelected = selectedGalleryIds.has(img.id);
                    const existsInAssets = state.assets.some(a => a.fullUrl === img.fullUrl || a.url === (img.transformedUrl || img.url));
                    
                    return (
                      <div 
                        key={img.id}
                        onClick={() => !existsInAssets && handleToggleGalleryImage(img.id)}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                          existsInAssets 
                            ? 'opacity-50 cursor-not-allowed ring-2 ring-gray-300' 
                            : isSelected 
                              ? 'ring-2 ring-indigo-500 shadow-lg' 
                              : 'hover:ring-2 hover:ring-indigo-300'
                        }`}
                      >
                        <img 
                          src={displayUrl} 
                          alt={img.title} 
                          className="w-full h-full object-cover"
                        />
                        
                        {existsInAssets && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                            <span className="text-white text-xs font-medium bg-gray-700 px-2 py-1 rounded">
                              추가됨
                            </span>
                          </div>
                        )}
                        
                        {isSelected && !existsInAssets && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between p-4 border-t bg-gray-50">
              <span className="text-sm text-gray-600">
                {selectedGalleryIds.size}개 선택됨
              </span>
              <div className="flex space-x-3">
                <button 
                  onClick={() => setShowGalleryModal(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors font-medium text-sm"
                >
                  취소
                </button>
                <button 
                  onClick={handleAddGalleryImages}
                  disabled={selectedGalleryIds.size === 0}
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors font-medium text-sm shadow-sm"
                >
                  추가하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ProductLoadModal
        isOpen={showLoadModal}
        productTypeName="포토북"
        projects={(projects?.data || []).map(p => ({
          id: p.id,
          title: p.title,
          status: p.status,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt
        }))}
        isLoading={projectsLoading}
        currentProjectId={projectId}
        loadingProjectId={loadingProjectId}
        downloadingProjectId={downloadManager.loadingProjectId}
        onClose={() => setShowLoadModal(false)}
        onLoad={handleLoadProject}
        onCreate={handleStartNew}
        onRename={handleRenameProject}
        onDelete={(project) => setDeletingProject({ 
          id: project.id, 
          title: project.title, 
          status: project.status,
          pagesData: null,
          createdAt: project.createdAt, 
          updatedAt: project.updatedAt 
        })}
        onDownload={(id) => downloadManager.initiateDownload(id, 'photobook')}
      />

      <DeleteConfirmModal
        isOpen={!!deletingProject}
        productTypeName="포토북"
        projectTitle={deletingProject?.title || ''}
        isDeleting={deleteProjectMutation.isPending}
        onClose={() => setDeletingProject(null)}
        onConfirm={() => {
          if (deletingProject) {
            deleteProjectMutation.mutate(deletingProject.id);
            setDeletingProject(null);
          }
        }}
      />

      <ProductStartupModal
        isOpen={showStartupModal}
        productTypeName="포토북"
        ProductIcon={Layers}
        projectCount={projects?.data?.length || 0}
        onCreate={handleStartNew}
        onLoad={handleStartFromLoad}
        onGoHome={() => { setShowStartupModal(false); navigate('/'); }}
      />

      {extractingAsset && (
        <ImageExtractorModal
          isOpen={!!extractingAsset}
          onClose={() => setExtractingAsset(null)}
          imageUrl={extractingAsset.url}
          onExtract={handleExtractComplete}
        />
      )}

      <MaterialPickerModal
        isOpen={showBackgroundPicker}
        onClose={() => setShowBackgroundPicker(false)}
        type="background"
        onSelect={handleSelectBackground}
        multiSelect={true}
        onMultiSelect={(materials) => {
          materials.forEach(bg => handleSelectBackground(bg));
        }}
      />

      <MaterialPickerModal
        isOpen={showIconPicker}
        onClose={() => setShowIconPicker(false)}
        type="icon"
        onSelect={handleSelectIcon}
        multiSelect={false}
      />

      <ImagePreviewDialog
        image={previewImage}
        open={!!previewImage}
        onOpenChange={(open) => !open && setPreviewImage(null)}
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
        initialPageIndex={state.currentSpreadIndex}
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
