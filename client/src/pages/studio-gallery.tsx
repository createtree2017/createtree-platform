import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Eye, Pencil, BookOpen, Mail, PartyPopper, FolderOpen, Loader2 } from 'lucide-react';
import { PreviewModal } from '@/components/common/PreviewModal';
import { usePreviewRenderer, PreviewDesign, PreviewConfig } from '@/hooks/usePreviewRenderer';
import { useModalHistory } from '@/hooks/useModalHistory';

type CategoryFilter = 'all' | 'photobook' | 'postcard' | 'party';

interface StudioProject {
  id: number;
  title: string;
  category: 'photobook' | 'postcard' | 'party';
  thumbnailUrl: string | null;
  updatedAt: string;
  editUrl: string;
}

interface StudioGalleryResponse {
  success: boolean;
  data: StudioProject[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

const CATEGORY_LABELS: Record<string, { label: string; icon: typeof BookOpen }> = {
  photobook: { label: '포토북', icon: BookOpen },
  postcard: { label: '엽서', icon: Mail },
  party: { label: '행사', icon: PartyPopper },
};

function getCategoryInfo(category: string) {
  return CATEGORY_LABELS[category] || { label: category, icon: FolderOpen };
}

export default function StudioGalleryPage() {
  const [, navigate] = useLocation();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [page] = useState(1);
  const [previewProject, setPreviewProject] = useState<StudioProject | null>(null);
  const [previewDesigns, setPreviewDesigns] = useState<PreviewDesign[]>([]);
  const [previewConfig, setPreviewConfig] = useState<PreviewConfig>({ widthMm: 210, heightMm: 297, dpi: 300 });
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const { data, isLoading, error } = useQuery<StudioGalleryResponse>({
    queryKey: ['/api/products/studio-gallery', category, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        category,
        page: String(page),
        limit: '50',
      });
      const response = await fetch(`/api/products/studio-gallery?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('조회 실패');
      return response.json();
    },
  });

  const projects = data?.data || [];

  const previewRenderer = usePreviewRenderer({
    designs: previewDesigns,
    config: previewConfig,
    getPageLabel: (index) => `${index + 1}페이지`,
  });

  const handleClosePreview = useCallback(() => {
    setShowPreviewModal(false);
    setPreviewProject(null);
    setPreviewDesigns([]);
    previewRenderer.clearCache();
  }, [previewRenderer]);

  const { closeWithHistory } = useModalHistory({
    isOpen: showPreviewModal,
    onClose: handleClosePreview,
    modalId: 'preview',
  });

  useEffect(() => {
    if (showPreviewModal && previewDesigns.length > 0) {
      previewRenderer.renderAllPages();
    }
  }, [showPreviewModal, previewDesigns.length]);

  const handleEdit = (project: StudioProject) => {
    const editorPath = project.category === 'photobook' ? '/photobook-v2' : `/${project.category}`;
    navigate(`${editorPath}?load=${project.id}`);
  };

  const handlePreview = useCallback(async (project: StudioProject) => {
    setIsLoadingPreview(true);
    setPreviewProject(project);
    
    try {
      let apiUrl = '';
      if (project.category === 'photobook') {
        apiUrl = `/api/photobook/projects/${project.id}`;
      } else {
        apiUrl = `/api/products/projects/${project.id}`;
      }
      
      const response = await fetch(apiUrl, { credentials: 'include' });
      if (!response.ok) throw new Error('프로젝트 조회 실패');
      
      const result = await response.json();
      const data = result.data || result;
      
      let designs: PreviewDesign[] = [];
      let config: PreviewConfig = { widthMm: 210, heightMm: 297, dpi: 300 };
      
      if (project.category === 'photobook') {
        const spreads = data.pagesData?.editorState?.spreads || [];
        designs = spreads.map((spread: any, i: number) => ({
          id: spread.id || `spread-${i}`,
          objects: spread.objects || [],
          background: spread.background || '#ffffff',
          backgroundLeft: spread.backgroundLeft,
          backgroundRight: spread.backgroundRight,
          orientation: 'landscape' as const,
        }));
        
        const editorState = data.pagesData?.editorState;
        if (editorState?.variantConfig) {
          config = {
            widthMm: (editorState.variantConfig.widthMm || 210) * 2,
            heightMm: editorState.variantConfig.heightMm || 297,
            dpi: editorState.variantConfig.dpi || 300,
          };
        }
      } else {
        const designsData = data.designsData?.designs || [];
        const variantConfig = data.designsData?.variantConfig || {};
        
        designs = designsData.map((design: any, i: number) => ({
          id: design.id || `design-${i}`,
          objects: design.objects || [],
          background: design.background || '#ffffff',
          orientation: design.orientation || 'portrait',
        }));
        
        config = {
          widthMm: variantConfig.widthMm || 210,
          heightMm: variantConfig.heightMm || 297,
          dpi: variantConfig.dpi || 300,
        };
      }
      
      if (designs.length > 0) {
        setPreviewDesigns(designs);
        setPreviewConfig(config);
        setShowPreviewModal(true);
      } else {
        const editorPath = project.category === 'photobook' ? '/photobook-v2' : `/${project.category}`;
        navigate(`${editorPath}?load=${project.id}`);
      }
    } catch (err) {
      console.error('Preview load error:', err);
      const editorPath = project.category === 'photobook' ? '/photobook-v2' : `/${project.category}`;
      navigate(`${editorPath}?load=${project.id}`);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [navigate]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <FolderOpen className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">제작소 갤러리</h1>
          <p className="text-sm text-muted-foreground">내가 만든 모든 작업물을 한눈에</p>
        </div>
      </div>

      <Tabs value={category} onValueChange={(v) => setCategory(v as CategoryFilter)} className="mb-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">전체</TabsTrigger>
          <TabsTrigger value="photobook">포토북</TabsTrigger>
          <TabsTrigger value="postcard">엽서</TabsTrigger>
          <TabsTrigger value="party">행사</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <CardContent className="p-3">
                <Skeleton className="h-4 w-3/4 mb-2" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground">
          데이터를 불러오는 데 실패했습니다.
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">저장된 프로젝트가 없습니다.</p>
          <p className="text-sm text-muted-foreground mt-1">포토북, 엽서, 행사 에디터에서 작업을 저장해보세요.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {projects.map((project) => {
            const categoryInfo = getCategoryInfo(project.category);
            const CategoryIcon = categoryInfo.icon;
            
            return (
              <Card key={`${project.category}-${project.id}`} className="overflow-hidden group hover:shadow-lg transition-shadow">
                <div className="aspect-[4/3] relative bg-muted overflow-hidden">
                  {project.thumbnailUrl ? (
                    <img
                      src={project.thumbnailUrl}
                      alt={project.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <CategoryIcon className="w-12 h-12" />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handlePreview(project)}
                      className="gap-1"
                    >
                      <Eye className="w-4 h-4" />
                      미리보기
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleEdit(project)}
                      className="gap-1"
                    >
                      <Pencil className="w-4 h-4" />
                      편집
                    </Button>
                  </div>
                  
                  <div className="absolute top-2 left-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-black/50 text-white text-xs rounded-full">
                      <CategoryIcon className="w-3 h-3" />
                      {categoryInfo.label}
                    </span>
                  </div>
                </div>
                
                <CardContent className="p-3">
                  <h3 className="font-medium text-sm truncate">{project.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(project.updatedAt), 'yyyy.MM.dd HH:mm', { locale: ko })}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {(isLoadingPreview || (showPreviewModal && previewRenderer.isRendering)) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>
              {isLoadingPreview 
                ? '미리보기 불러오는 중...' 
                : `렌더링 중... ${previewRenderer.renderProgress}%`
              }
            </span>
          </div>
        </div>
      )}

      <PreviewModal
        isOpen={showPreviewModal && !previewRenderer.isRendering && previewRenderer.pages.some(p => p.imageUrl)}
        onClose={closeWithHistory}
        pages={previewRenderer.pages}
        title={previewProject?.title}
      />
    </div>
  );
}
