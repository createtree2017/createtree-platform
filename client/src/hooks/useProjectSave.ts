import { useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/useToast';

export interface ProjectSavePayload {
  title: string;
  variantId: number | null;
  designsData: any;
  status?: 'draft' | 'completed' | 'ordered';
  subMissionId?: number | null;
}

export interface UseProjectSaveOptions {
  categorySlug: string;
  projectId: number | null;
  setProjectId: (id: number | null) => void;
  getPayload: () => ProjectSavePayload;
  onSaveSuccess?: (projectId: number) => void;
  onSaveError?: (error: Error) => void;
}

export function useProjectSave({
  categorySlug,
  projectId,
  setProjectId,
  getPayload,
  onSaveSuccess,
  onSaveError,
}: UseProjectSaveOptions) {
  const { toast } = useToast();
  
  const projectIdRef = useRef<number | null>(projectId);
  
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = getPayload();
      const currentProjectId = projectIdRef.current;
      
      if (currentProjectId) {
        console.log('[useProjectSave] PATCH 요청, projectId:', currentProjectId);
        const response = await apiRequest(`/api/products/projects/${currentProjectId}`, {
          method: 'PATCH',
          data: {
            title: payload.title,
            variantId: payload.variantId,
            designsData: payload.designsData,
            status: payload.status || 'draft',
            subMissionId: payload.subMissionId
          }
        });
        return response.json();
      } else {
        console.log('[useProjectSave] POST 요청 (새 프로젝트 생성)');
        const response = await apiRequest('/api/products/projects', {
          method: 'POST',
          data: {
            categorySlug,
            variantId: payload.variantId,
            title: payload.title,
            designsData: payload.designsData,
            status: payload.status || 'draft',
            subMissionId: payload.subMissionId
          }
        });
        const data = await response.json();
        
        // 서버 응답에서 projectId 추출 (success 필드 의존성 제거)
        const newProjectId = data?.data?.id || data?.id;
        if (newProjectId) {
          console.log('[useProjectSave] POST 성공, projectId 업데이트:', newProjectId);
          projectIdRef.current = newProjectId;
          setProjectId(newProjectId);
        }
        
        return data;
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
      toast({ title: '저장 완료', description: '프로젝트가 저장되었습니다.' });
      
      const projectId = data?.data?.id || data?.id;
      if (onSaveSuccess && projectId) {
        onSaveSuccess(projectId);
      }
    },
    onError: (error: Error) => {
      console.error('Save error:', error);
      toast({ title: '저장 실패', description: '프로젝트 저장에 실패했습니다.', variant: 'destructive' });
      
      if (onSaveError) {
        onSaveError(error);
      }
    }
  });

  const save = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);

  const resetProjectId = useCallback(() => {
    projectIdRef.current = null;
    setProjectId(null);
  }, [setProjectId]);

  return {
    save,
    isSaving: saveMutation.isPending,
    resetProjectId,
    currentProjectId: projectIdRef.current,
  };
}
