import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { GALLERY_FILTERS, GalleryFilterKey } from '@shared/constants';

import { Sidebar, BackgroundTarget } from '@/components/photobook-v2/Sidebar';
import { EditorCanvas } from '@/components/photobook-v2/EditorCanvas';
import { PageStrip } from '@/components/photobook-v2/PageStrip';
import { TopBar } from '@/components/photobook-v2/TopBar';
import { INITIAL_ALBUM, DPI } from '@/components/photobook-v2/constants';
import { 
  EditorState, 
  Spread, 
  AssetItem, 
  CanvasObject,
  AlbumConfig
} from '@/components/photobook-v2/types';
import { generateId } from '@/components/photobook-v2/utils';
import { Loader2, X, Check, Layers, Plus, Pencil, Trash2 } from 'lucide-react';
import { ImageExtractorModal } from '@/components/ImageExtractor';
import { MaterialPickerModal } from '@/components/photobook-v2/MaterialPickerModal';

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
  showGrid: false,
});

interface PhotobookProject {
  id: number;
  title: string;
  pagesData: any;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface MaterialItem {
  id: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  categoryId?: number;
  keywords?: string;
  colorHex?: string;
}

export default function PhotobookV2Page() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState('새 포토북');
  const [state, setState] = useState<EditorState>(createInitialState);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<string | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [selectedGalleryImages, setSelectedGalleryImages] = useState<Set<string>>(new Set());
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showStartupModal, setShowStartupModal] = useState(true);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProjectTitle, setEditingProjectTitle] = useState('');
  const [deletingProject, setDeletingProject] = useState<PhotobookProject | null>(null);
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

  const { data: projects, isLoading: projectsLoading } = useQuery<{ data: PhotobookProject[] }>({
    queryKey: ['/api/photobook/projects'],
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
            version: 2
          },
          title: projectTitle
        }
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['/api/photobook/projects'] });
        toast({ title: '저장되었습니다' });
      }
    },
    onError: () => {
      toast({ title: '저장 실패', variant: 'destructive' });
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/photobook/images', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        const img = new Image();
        img.onload = () => {
          setState(prev => ({
            ...prev,
            assets: [...prev.assets, {
              id: generateId(),
              url: data.data.url,
              name: data.data.filename,
              width: img.width,
              height: img.height
            }]
          }));
        };
        img.src = data.data.url;
      }
    },
    onError: () => {
      toast({ title: '이미지 업로드 실패', variant: 'destructive' });
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

  const handleExtractImage = (asset: AssetItem) => {
    setExtractingAsset(asset);
  };

  const handleExtractComplete = async (blob: Blob) => {
    const formData = new FormData();
    formData.append('image', blob, 'extracted.png');
    
    try {
      const response = await fetch('/api/image-extractor', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      const data = await response.json();
      
      if (data.success && data.data) {
        const img = new Image();
        img.onload = () => {
          setState(prev => ({
            ...prev,
            assets: [...prev.assets, {
              id: generateId(),
              url: data.data.url,
              name: data.data.title || '추출 이미지',
              width: img.width,
              height: img.height
            }]
          }));
          toast({ title: '이미지가 추출되었습니다' });
        };
        img.src = data.data.url;
      }
    } catch (error) {
      toast({ title: '이미지 추출 실패', variant: 'destructive' });
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

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((file: File) => {
        uploadImageMutation.mutate(file);
      });
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    if (usedAssetIds.has(assetId)) {
      return;
    }
    setAssetToDelete(assetId);
  };

  const confirmDeleteAsset = () => {
    if (assetToDelete) {
      setState(prev => ({
        ...prev,
        assets: prev.assets.filter(a => a.id !== assetToDelete)
      }));
      setAssetToDelete(null);
    }
  };

  const handleOpenGallery = () => {
    setSelectedGalleryImages(new Set());
    setActiveGalleryFilter('all');
    setShowGalleryModal(true);
  };

  const handleToggleGalleryImage = (imageUrl: string) => {
    setSelectedGalleryImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageUrl)) {
        newSet.delete(imageUrl);
      } else {
        newSet.add(imageUrl);
      }
      return newSet;
    });
  };

  const handleAddGalleryImages = () => {
    if (selectedGalleryImages.size === 0) return;
    
    const existingUrls = new Set(state.assets.map(a => a.url));
    const imagesToAdd: GalleryImage[] = [];
    
    if (galleryImages) {
      galleryImages.forEach(img => {
        const url = img.transformedUrl || img.url;
        if (selectedGalleryImages.has(url) && !existingUrls.has(url)) {
          imagesToAdd.push(img);
        }
      });
    }
    
    if (imagesToAdd.length === 0) {
      toast({ title: '이미 추가된 이미지입니다' });
      setShowGalleryModal(false);
      return;
    }
    
    const loadImages = imagesToAdd.map(img => {
      const thumbnailUrl = img.thumbnailUrl || img.transformedUrl || img.url;
      const fullUrl = img.fullUrl || img.originalUrl || img.transformedUrl || img.url;
      return new Promise<AssetItem>((resolve) => {
        const imgEl = new Image();
        imgEl.onload = () => {
          resolve({
            id: generateId(),
            url: thumbnailUrl,
            fullUrl: fullUrl,
            name: img.title || '갤러리 이미지',
            width: imgEl.width || 800,
            height: imgEl.height || 600
          });
        };
        imgEl.onerror = () => {
          resolve({
            id: generateId(),
            url: thumbnailUrl,
            fullUrl: fullUrl,
            name: img.title || '갤러리 이미지',
            width: 800,
            height: 600
          });
        };
        imgEl.src = fullUrl;
      });
    });
    
    Promise.all(loadImages).then(newAssets => {
      setState(prev => ({
        ...prev,
        assets: [...prev.assets, ...newAssets]
      }));
      toast({ title: `${newAssets.length}개 이미지가 추가되었습니다` });
      setShowGalleryModal(false);
    });
  };

  const handleDragStart = (e: React.DragEvent, asset: AssetItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAssetClick = (asset: AssetItem) => {
    const { albumSize, currentSpreadIndex, spreads } = state;
    const currentSpread = spreads[currentSpreadIndex];
    
    const pageWidthPx = albumSize.widthInches * DPI;
    const spreadWidthPx = pageWidthPx * 2;
    const pageHeightPx = albumSize.heightInches * DPI;

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
    setState(createInitialState());
    setShowStartupModal(false);
  };

  const handleStartFromLoad = () => {
    setShowStartupModal(false);
    handleLoad();
  };

  const loadProject = (project: PhotobookProject) => {
    if (project.pagesData?.editorState) {
      setState(project.pagesData.editorState);
      setProjectId(project.id);
      setProjectTitle(project.title);
      toast({ title: `"${project.title}" 프로젝트를 불러왔습니다` });
    } else {
      toast({ title: '프로젝트 데이터가 없습니다', variant: 'destructive' });
    }
    setShowLoadModal(false);
  };

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
    const sidebarWidth = 320;
    const topBarHeight = 64;
    const pageStripHeight = 160;
    const padding = 60;

    const viewportWidth = window.innerWidth - sidebarWidth - padding;
    const viewportHeight = window.innerHeight - topBarHeight - pageStripHeight - padding;

    const albumPixelWidth = state.albumSize.widthInches * 2 * DPI;
    const albumPixelHeight = state.albumSize.heightInches * DPI;

    const scaleW = viewportWidth / albumPixelWidth;
    const scaleH = viewportHeight / albumPixelHeight;

    const newScale = Math.min(scaleW, scaleH);

    setState(prev => ({ 
      ...prev, 
      scale: Math.min(newScale, 0.8),
      panOffset: { x: 0, y: 0 }
    })); 
  }, [state.albumSize]);

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

  const handleSelectBackground = useCallback((bg: MaterialItem) => {
    setSelectedBackgrounds(prev => {
      if (prev.find(b => b.id === bg.id)) return prev;
      return [...prev, bg];
    });
  }, []);

  const handleSelectIcon = useCallback((icon: MaterialItem) => {
    setSelectedIcons(prev => {
      if (prev.find(i => i.id === icon.id)) return prev;
      return [...prev, icon];
    });
  }, []);

  const handleRemoveBackground = useCallback((id: number) => {
    setSelectedBackgrounds(prev => prev.filter(b => b.id !== id));
  }, []);

  const handleRemoveIcon = useCallback((id: number) => {
    setSelectedIcons(prev => prev.filter(i => i.id !== id));
  }, []);

  const handleApplyBackground = useCallback((bg: MaterialItem, target: BackgroundTarget = 'both') => {
    const isClearBackground = bg.id === 0;
    
    setState(s => {
      const newSpreads = [...s.spreads];
      const currentSpread = newSpreads[s.currentSpreadIndex];
      const bgValue = isClearBackground ? undefined : (bg.colorHex || bg.imageUrl);
      
      if (target === 'left') {
        newSpreads[s.currentSpreadIndex] = {
          ...currentSpread,
          backgroundLeft: bgValue
        };
      } else if (target === 'right') {
        newSpreads[s.currentSpreadIndex] = {
          ...currentSpread,
          backgroundRight: bgValue
        };
      } else {
        newSpreads[s.currentSpreadIndex] = {
          ...currentSpread,
          background: bgValue,
          backgroundLeft: undefined,
          backgroundRight: undefined
        };
      }
      return { ...s, spreads: newSpreads };
    });
    const targetLabel = target === 'left' ? '왼쪽 페이지' : target === 'right' ? '오른쪽 페이지' : '양면';
    if (isClearBackground) {
      toast({ title: `${targetLabel}의 배경이 제거되었습니다` });
    } else {
      toast({ title: `${targetLabel}에 배경이 적용되었습니다` });
    }
  }, [toast]);

  const handleApplyIcon = useCallback((icon: MaterialItem) => {
    const newObject: CanvasObject = {
      id: generateId(),
      type: 'image',
      x: 200,
      y: 200,
      width: 150,
      height: 150,
      rotation: 0,
      zIndex: state.spreads[state.currentSpreadIndex].objects.length,
      src: icon.imageUrl,
      opacity: 1
    };
    addObject(newObject);
    toast({ title: '아이콘이 추가되었습니다' });
  }, [state.currentSpreadIndex, state.spreads, addObject, toast]);

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
      <TopBar 
        state={state}
        projectTitle={projectTitle}
        isSaving={saveProjectMutation.isPending}
        onSave={handleSave}
        onLoad={handleLoad}
        onTitleChange={handleTitleChange}
        onAddSpread={addSpread}
        onDeleteSpread={requestDeleteSpread}
        onToggleGrid={() => setState(s => ({ ...s, showGrid: !s.showGrid }))}
        onToggleBleed={() => setState(s => ({ ...s, showBleed: !s.showBleed }))}
        onZoomIn={() => setState(s => ({ ...s, scale: s.scale * 1.1 }))}
        onZoomOut={() => setState(s => ({ ...s, scale: s.scale * 0.9 }))}
        onFitView={handleFitView}
        onSetScale={(newScale) => setState(s => ({ ...s, scale: newScale }))}
        onChangeAlbumSize={(size) => setState(s => ({ ...s, albumSize: size }))}
        onDeleteSelected={handleDeleteSelected}
        onBack={() => navigate('/')}
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
          isLoadingGallery={uploadImageMutation.isPending || galleryLoading}
          onOpenBackgroundPicker={() => setShowBackgroundPicker(true)}
          onOpenIconPicker={() => setShowIconPicker(true)}
          onSelectBackground={handleApplyBackground}
          onSelectIcon={handleApplyIcon}
          onRemoveBackground={handleRemoveBackground}
          onRemoveIcon={handleRemoveIcon}
          selectedBackgrounds={selectedBackgrounds}
          selectedIcons={selectedIcons}
        />
        
        <EditorCanvas 
          state={state}
          isPanningMode={isSpacePressed}
          onUpdateObject={updateObject}
          onSelectObject={(id) => setState(s => ({ ...s, selectedObjectId: id }))}
          onAddObject={addObject}
          onDeleteObject={deleteObject}
          onDuplicateObject={duplicateObject}
          onChangeOrder={changeOrder}
          onUpdatePanOffset={(offset) => setState(s => ({ ...s, panOffset: offset }))}
        />
      </div>

      <PageStrip 
        state={state}
        onSelectSpread={handleSelectSpread}
        onAddSpread={addSpread}
        onReorderSpread={handleReorderSpread}
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
                    const url = img.transformedUrl || img.url;
                    const isSelected = selectedGalleryImages.has(url);
                    const existsInAssets = state.assets.some(a => a.url === url);
                    
                    return (
                      <div 
                        key={img.id}
                        onClick={() => !existsInAssets && handleToggleGalleryImage(url)}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer transition-all ${
                          existsInAssets 
                            ? 'opacity-50 cursor-not-allowed ring-2 ring-gray-300' 
                            : isSelected 
                              ? 'ring-2 ring-indigo-500 shadow-lg' 
                              : 'hover:ring-2 hover:ring-indigo-300'
                        }`}
                      >
                        <img 
                          src={img.thumbnailUrl || url} 
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
                {selectedGalleryImages.size}개 선택됨
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
                  disabled={selectedGalleryImages.size === 0}
                  className="px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-md transition-colors font-medium text-sm shadow-sm"
                >
                  추가하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLoadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => { setShowLoadModal(false); setEditingProjectId(null); }}
          ></div>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] z-10 overflow-hidden flex flex-col animate-in fade-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-bold text-gray-900">저장된 포토북 불러오기</h2>
              <button 
                onClick={() => { setShowLoadModal(false); setEditingProjectId(null); }}
                className="p-1 rounded-md hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
              <button
                onClick={() => {
                  setShowLoadModal(false);
                  setEditingProjectId(null);
                  handleStartNew();
                }}
                className="w-full mb-4 p-4 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center justify-center space-x-2 text-indigo-700 font-medium"
              >
                <Plus className="w-5 h-5" />
                <span>새 앨범 만들기</span>
              </button>
              
              {projectsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                </div>
              ) : !projects?.data || projects.data.length === 0 ? (
                <div className="text-center text-gray-500 py-12">
                  <p>저장된 포토북이 없습니다.</p>
                  <p className="text-sm mt-2">위 버튼을 눌러 새 포토북을 만들어 보세요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {projects.data.map((project) => {
                    const isCurrentProject = project.id === projectId;
                    const isEditing = editingProjectId === project.id;
                    const updatedDate = new Date(project.updatedAt).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    });
                    
                    return (
                      <div 
                        key={project.id}
                        onClick={() => !isCurrentProject && !isEditing && loadProject(project)}
                        className={`p-4 rounded-lg border transition-all ${
                          isCurrentProject 
                            ? 'border-indigo-300 bg-indigo-50 cursor-default' 
                            : isEditing
                              ? 'border-indigo-300 bg-white cursor-default'
                              : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="flex items-center space-x-2">
                                <input
                                  type="text"
                                  value={editingProjectTitle}
                                  onChange={(e) => setEditingProjectTitle(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (editingProjectTitle.trim()) {
                                        renameProjectMutation.mutate({ id: project.id, title: editingProjectTitle.trim() });
                                        setEditingProjectId(null);
                                      }
                                    } else if (e.key === 'Escape') {
                                      setEditingProjectId(null);
                                    }
                                  }}
                                  className="flex-1 px-2 py-1 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                  autoFocus
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (editingProjectTitle.trim()) {
                                      renameProjectMutation.mutate({ id: project.id, title: editingProjectTitle.trim() });
                                      setEditingProjectId(null);
                                    }
                                  }}
                                  disabled={renameProjectMutation.isPending}
                                  className="p-1 text-green-600 hover:bg-green-100 rounded-md transition-colors"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProjectId(null);
                                  }}
                                  className="p-1 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <h3 className="font-medium text-gray-900 truncate">{project.title}</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                  수정: {updatedDate}
                                </p>
                              </>
                            )}
                          </div>
                          <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                            {!isEditing && (
                              <>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingProjectId(project.id);
                                    setEditingProjectTitle(project.title);
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                                  title="이름 변경"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletingProject(project);
                                  }}
                                  className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {isCurrentProject && (
                              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
                                현재 편집 중
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              project.status === 'completed' 
                                ? 'bg-green-100 text-green-700' 
                                : project.status === 'in_progress'
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-gray-100 text-gray-600'
                            }`}>
                              {project.status === 'completed' ? '완료' : project.status === 'in_progress' ? '작업 중' : '초안'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-end p-4 border-t bg-gray-50">
              <button 
                onClick={() => { setShowLoadModal(false); setEditingProjectId(null); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors font-medium text-sm"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingProject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => setDeletingProject(null)}
          ></div>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full z-10 overflow-hidden animate-in fade-in duration-200">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">포토북 삭제</h3>
              </div>
              <p className="text-gray-600 mb-2">
                <span className="font-medium">"{deletingProject.title}"</span>을(를) 삭제하시겠습니까?
              </p>
              <p className="text-sm text-gray-500 mb-6">
                이 작업은 되돌릴 수 없으며, 모든 페이지와 데이터가 영구적으로 삭제됩니다.
              </p>
              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => setDeletingProject(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors font-medium text-sm"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    deleteProjectMutation.mutate(deletingProject.id);
                    setDeletingProject(null);
                  }}
                  disabled={deleteProjectMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors font-medium text-sm disabled:opacity-50"
                >
                  {deleteProjectMutation.isPending ? '삭제 중...' : '삭제'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStartupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"></div>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full z-10 overflow-hidden animate-in fade-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Layers className="w-8 h-8 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">포토북 에디터</h2>
              <p className="text-gray-600 mb-6">새 포토북을 만들거나 저장된 포토북을 불러오세요</p>
              
              <div className="space-y-3">
                <button 
                  onClick={handleStartNew}
                  className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
                >
                  새 포토북 만들기
                </button>
                <button 
                  onClick={handleStartFromLoad}
                  className="w-full px-4 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  저장된 포토북 불러오기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
    </div>
  );
}
