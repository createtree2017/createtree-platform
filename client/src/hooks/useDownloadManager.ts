import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { DISPLAY_DPI } from '@/components/photobook-v2/constants';

export interface DownloadableProject {
  id: number;
  title: string;
  categorySlug: string;
  designsData?: any;
  pagesData?: any;
  variantId?: number | null;
}

export interface VariantConfig {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  dpi: number;
}

export interface DesignData {
  id: string;
  objects: any[];
  background: string;
  quantity?: number;
  orientation: 'landscape' | 'portrait';
}

interface ParsedDownloadData {
  designs: DesignData[];
  variantConfig: VariantConfig;
  projectTitle: string;
  categorySlug: string;
}

const DEFAULT_VARIANT_CONFIG: VariantConfig = {
  widthMm: 150,
  heightMm: 100,
  bleedMm: 3,
  dpi: 300,
};

function parseProjectData(project: DownloadableProject): ParsedDownloadData | null {
  try {
    let designs: DesignData[] = [];
    let variantConfig = DEFAULT_VARIANT_CONFIG;

    if (project.categorySlug === 'photobook') {
      const pagesData = typeof project.pagesData === 'string' 
        ? JSON.parse(project.pagesData) 
        : project.pagesData;
      
      if (pagesData?.version === 2 && pagesData?.editorState) {
        const editorState = pagesData.editorState;
        const albumSize = editorState?.albumSize;
        const inchToMm = 25.4;
        const pageWidthMm = Math.round((albumSize?.widthInches || 8) * inchToMm);
        const pageHeightMm = Math.round((albumSize?.heightInches || 8) * inchToMm);
        // 편집기 좌표는 DISPLAY_DPI 기준으로 저장되므로 분리 시에도 동일한 DPI 사용
        const editorDpi = DISPLAY_DPI;
        const pageWidthPx = Math.round((pageWidthMm / 25.4) * editorDpi);
        const pageOrientation: 'landscape' | 'portrait' = pageWidthMm >= pageHeightMm ? 'landscape' : 'portrait';
        
        if (editorState?.spreads && editorState.spreads.length > 0) {
          editorState.spreads.forEach((spread: any, spreadIndex: number) => {
            const allObjects = spread.objects || [];
            
            // 객체의 실제 경계 계산 (width가 음수이거나 undefined인 경우 처리)
            const getObjectBounds = (obj: any) => {
              const x = obj.x || 0;
              const w = obj.width || 0;
              return {
                left: Math.min(x, x + w),
                right: Math.max(x, x + w)
              };
            };
            
            // 왼쪽 페이지: 객체가 왼쪽 페이지 영역(0 ~ pageWidthPx)과 겹치면 포함
            const leftObjects = allObjects.filter((obj: any) => {
              const bounds = getObjectBounds(obj);
              // 객체의 오른쪽 끝이 0보다 크고, 왼쪽 끝이 pageWidthPx보다 작으면 겹침
              return bounds.right > 0 && bounds.left < pageWidthPx;
            });
            
            // 오른쪽 페이지: 객체가 오른쪽 페이지 영역(pageWidthPx ~ pageWidthPx*2)과 겹치면 포함
            const rightObjects = allObjects
              .filter((obj: any) => {
                const bounds = getObjectBounds(obj);
                // 객체의 오른쪽 끝이 pageWidthPx보다 크고, 왼쪽 끝이 pageWidthPx*2보다 작으면 겹침
                return bounds.right > pageWidthPx && bounds.left < pageWidthPx * 2;
              })
              .map((obj: any) => ({ ...obj, x: obj.x - pageWidthPx }));
            
            designs.push({
              id: spread.pageLeftId || `spread-${spreadIndex}-left`,
              objects: leftObjects,
              background: spread.backgroundLeft || spread.background || '#ffffff',
              quantity: 1,
              orientation: pageOrientation,
            });
            
            designs.push({
              id: spread.pageRightId || `spread-${spreadIndex}-right`,
              objects: rightObjects,
              background: spread.backgroundRight || spread.background || '#ffffff',
              quantity: 1,
              orientation: pageOrientation,
            });
          });
        }
        
        variantConfig = {
          widthMm: pageWidthMm,
          heightMm: pageHeightMm,
          bleedMm: 3,
          dpi: editorDpi,
        };
      } else if (pagesData?.pages) {
        pagesData.pages.forEach((page: any, index: number) => {
          designs.push({
            id: page.id || `page-${index}`,
            objects: page.objects || [],
            background: page.backgroundColor || page.background || '#ffffff',
            quantity: 1,
            orientation: 'landscape',
          });
        });
      }
    } else {
      const designsData = typeof project.designsData === 'string' 
        ? JSON.parse(project.designsData) 
        : project.designsData;
      
      const defaultOrientation = project.categorySlug === 'party' ? 'portrait' : 'landscape';
      designs = (designsData?.designs || []).map((d: any) => ({
        ...d,
        background: d.background || '#ffffff',
        orientation: d.orientation || defaultOrientation,
      }));
      
      if (designsData?.variantConfig) {
        variantConfig = designsData.variantConfig;
      }
    }

    if (designs.length === 0) {
      return null;
    }

    return {
      designs,
      variantConfig,
      projectTitle: project.title,
      categorySlug: project.categorySlug,
    };
  } catch (error) {
    console.error('Failed to parse project data:', error);
    return null;
  }
}

export function useDownloadManager() {
  const { toast } = useToast();
  const [loadingProjectId, setLoadingProjectId] = useState<number | null>(null);
  const [downloadData, setDownloadData] = useState<ParsedDownloadData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const initiateDownload = useCallback(async (projectId: number, categorySlug: string) => {
    setLoadingProjectId(projectId);
    
    try {
      const apiEndpoint = categorySlug === 'photobook' 
        ? `/api/photobook/projects/${projectId}`
        : `/api/products/projects/${projectId}`;
      
      const response = await fetch(apiEndpoint, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch project');
      }
      
      const { data } = await response.json();
      const project: DownloadableProject = {
        ...data,
        categorySlug,
      };
      
      const parsed = parseProjectData(project);
      
      if (!parsed) {
        toast({
          title: '오류',
          description: '다운로드할 디자인이 없습니다',
          variant: 'destructive',
        });
        return;
      }
      
      setDownloadData(parsed);
      setIsModalOpen(true);
    } catch (error) {
      console.error('Error fetching project for download:', error);
      toast({
        title: '다운로드 실패',
        description: '프로젝트 데이터를 가져오는데 실패했습니다.',
        variant: 'destructive',
      });
    } finally {
      setLoadingProjectId(null);
    }
  }, [toast]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setDownloadData(null);
  }, []);

  return {
    loadingProjectId,
    isModalOpen,
    downloadData,
    initiateDownload,
    closeModal,
  };
}
