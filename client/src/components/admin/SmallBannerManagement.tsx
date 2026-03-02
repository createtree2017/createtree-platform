import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";
import { useModal } from "@/hooks/useModal";

interface SmallBanner {
  id: number;
  title: string;
  description?: string;
  imageSrc: string;    // 기존 배너 스키마에 맞춤
  href?: string;       // 기존 배너 스키마에 맞춤
  isActive: boolean;
  order: number;
  createdAt: string;
}

export default function SmallBannerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const modal = useModal();

  // 작은 배너 목록 조회
  const { data: banners = [], isLoading } = useQuery<SmallBanner[]>({
    queryKey: ["/api/small-banners"],
    queryFn: async () => {
      const response = await fetch('/api/small-banners');
      if (!response.ok) throw new Error('Failed to fetch small banners');
      return response.json();
    }
  });

  // 작은 배너 생성 API 사용
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/admin/create-small-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create small banner');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/small-banners"] });
      toast({
        title: "성공",
        description: "배너가 성공적으로 생성되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "생성 실패",
        description: "배너 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 기존 배너 수정 API 사용
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/admin/small-banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update banner');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/small-banners"] });
      toast({
        title: "성공",
        description: "배너가 성공적으로 수정되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "수정 실패",
        description: "배너 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 기존 배너 삭제 API 사용
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/small-banners/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete banner');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/small-banners"] });
      toast({
        title: "성공",
        description: "배너가 성공적으로 삭제되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "배너 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    modal.open('smallBannerForm', {
      mode: 'create',
      banner: null,
      onSubmit: (data: any) => {
        createMutation.mutate(data);
      },
      isPending: createMutation.isPending
    });
  };

  const handleEdit = (banner: SmallBanner) => {
    modal.open('smallBannerForm', {
      mode: 'edit',
      banner: banner,
      onSubmit: (data: any) => {
        updateMutation.mutate({ id: banner.id, data });
      },
      isPending: updateMutation.isPending
    });
  };

  const handleDelete = (id: number) => {
    if (window.confirm("정말로 이 배너를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">배너를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">작은 배너 관리</h3>
          <p className="text-gray-600 mt-1">메인 페이지에 표시할 작은 배너를 관리합니다</p>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          새 배너 추가
        </Button>
      </div>

      {/* 배너 목록 */}
      <div className="grid gap-4">
        {banners.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            등록된 배너가 없습니다.
          </div>
        ) : (
          banners.map((banner: SmallBanner) => (
            <div key={banner.id} className="flex items-center space-x-4 p-4 border rounded-lg">
              <img
                src={banner.imageSrc}
                alt={banner.title}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <h4 className="font-medium">{banner.title}</h4>
                {banner.description && (
                  <p className="text-sm text-gray-600 mt-1">{banner.description}</p>
                )}
                {banner.href && (
                  <p className="text-xs text-blue-600 mt-1">링크: {banner.href}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  순서: {banner.order} | {banner.isActive ? '활성' : '비활성'}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(banner)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(banner.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}