import { useRef, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/useToast';

export interface ProjectSavePayload {
  title: string;
  variantId: number | null;
  designsData: any;
  status?: 'draft' | 'completed' | 'ordered';
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
        return apiRequest(`/api/products/projects/${currentProjectId}`, {
          method: 'PATCH',
          data: {
            title: payload.title,
            variantId: payload.variantId,
            designsData: payload.designsData,
            status: payload.status || 'draft'
          }
        });
      } else {
        return apiRequest('/api/products/projects', {
          method: 'POST',
          data: {
            categorySlug,
            variantId: payload.variantId,
            title: payload.title,
            designsData: payload.designsData,
            status: payload.status || 'draft'
          }
        });
      }
    },
    onSuccess: (response: any) => {
      const project = response?.data || response;
      
      if (project?.id) {
        projectIdRef.current = project.id;
        setProjectId(project.id);
      }
      
      queryClient.invalidateQueries({ queryKey: ['/api/products/projects'] });
      toast({ title: '저장 완료', description: '프로젝트가 저장되었습니다.' });
      
      if (onSaveSuccess && project?.id) {
        onSaveSuccess(project.id);
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
