import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

import { Sidebar } from '@/components/photobook-v2/Sidebar';
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
import { Loader2 } from 'lucide-react';

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

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const { data: projects, isLoading: projectsLoading } = useQuery<{ data: PhotobookProject[] }>({
    queryKey: ['/api/photobook/projects'],
    enabled: !!user,
  });

  const createProjectMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest('/api/photobook/projects', { 
        method: 'POST',
        data: {
          title,
          canvasWidth: state.albumSize.widthInches * DPI * 2,
          canvasHeight: state.albumSize.heightInches * DPI
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
            canvasWidth: state.albumSize.widthInches * DPI * 2,
            canvasHeight: state.albumSize.heightInches * DPI
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
      const newSpreads = [...prev.spreads];
      const spread = newSpreads[prev.currentSpreadIndex];
      spread.objects = spread.objects.map(obj => 
        obj.id === id ? { ...obj, ...updates } : obj
      );
      return { ...prev, spreads: newSpreads };
    });
  };

  const addObject = (obj: CanvasObject) => {
    setState(prev => {
      const newSpreads = [...prev.spreads];
      newSpreads[prev.currentSpreadIndex].objects.push(obj);
      return { ...prev, spreads: newSpreads, selectedObjectId: obj.id };
    });
  };

  const deleteObject = useCallback((id: string) => {
    setState(prev => {
      const newSpreads = [...prev.spreads];
      const spread = newSpreads[prev.currentSpreadIndex];
      spread.objects = spread.objects.filter(obj => obj.id !== id);
      return { ...prev, spreads: newSpreads, selectedObjectId: null };
    });
  }, []);

  const changeOrder = (id: string, direction: 'up' | 'down') => {
    setState(prev => {
      const newSpreads = [...prev.spreads];
      const spread = newSpreads[prev.currentSpreadIndex];
      const index = spread.objects.findIndex(o => o.id === id);
      if (index === -1) return prev;

      const newObjects = [...spread.objects];
      const obj = newObjects[index];
      
      newObjects.splice(index, 1);
      if (direction === 'up') {
        newObjects.splice(Math.min(newObjects.length, index + 1), 0, obj);
      } else {
        newObjects.splice(Math.max(0, index - 1), 0, obj);
      }

      newObjects.forEach((o, i) => o.zIndex = i + 1);
      
      spread.objects = newObjects;
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

  const handleDeleteSelected = useCallback(() => {
    setState(prev => {
      if (!prev.selectedObjectId) return prev;
      
      const newSpreads = [...prev.spreads];
      const spread = newSpreads[prev.currentSpreadIndex];
      spread.objects = spread.objects.filter(obj => obj.id !== prev.selectedObjectId);
      
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
          const newSpreads = [...prev.spreads];
          const spread = newSpreads[prev.currentSpreadIndex];
          const objIndex = spread.objects.findIndex(o => o.id === prev.selectedObjectId);
          if (objIndex === -1) return prev;

          const newObjects = [...spread.objects];
          const obj = { ...newObjects[objIndex] };
          switch (e.key) {
            case 'ArrowUp': obj.y -= step; break;
            case 'ArrowDown': obj.y += step; break;
            case 'ArrowLeft': obj.x -= step; break;
            case 'ArrowRight': obj.x += step; break;
          }
          newObjects[objIndex] = obj;
          spread.objects = newObjects;
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
          isLoadingGallery={uploadImageMutation.isPending}
        />
        
        <EditorCanvas 
          state={state}
          isPanningMode={isSpacePressed}
          onUpdateObject={updateObject}
          onSelectObject={(id) => setState(s => ({ ...s, selectedObjectId: id }))}
          onAddObject={addObject}
          onDeleteObject={deleteObject}
          onChangeOrder={changeOrder}
          onUpdatePanOffset={(offset) => setState(s => ({ ...s, panOffset: offset }))}
        />
      </div>

      <PageStrip 
        state={state}
        onSelectSpread={handleSelectSpread}
        onAddSpread={addSpread}
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
    </div>
  );
}
