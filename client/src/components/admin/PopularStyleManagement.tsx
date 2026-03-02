import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, GripVertical } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useModal } from "@/hooks/useModal";
import ConceptPickerModal from "./ConceptPickerModal";

interface PopularStyle {
  id: number;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export default function PopularStyleManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const modal = useModal();
  const [isConceptPickerOpen, setIsConceptPickerOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const { data: styles = [], isLoading } = useQuery<PopularStyle[]>({
    queryKey: ["/api/admin/popular-styles"],
    queryFn: async () => {
      const response = await fetch('/api/admin/popular-styles');
      if (!response.ok) throw new Error('Failed to fetch popular styles');
      return response.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/admin/popular-styles', {
        method: 'POST',
        data: {
          ...data,
          sortOrder: Number(data.sortOrder) || 0
        }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/popular-styles"] });
      toast({ title: "성공", description: "인기스타일이 성공적으로 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "생성 실패", description: error.message || "인기스타일 생성 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest(`/api/admin/popular-styles/${id}`, {
        method: 'PUT',
        data: {
          ...data,
          sortOrder: Number(data.sortOrder) || 0
        }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/popular-styles"] });
      toast({ title: "성공", description: "인기스타일이 성공적으로 수정되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "수정 실패", description: error.message || "인기스타일 수정 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/admin/popular-styles/${id}`, {
        method: 'DELETE'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/popular-styles"] });
      toast({ title: "성공", description: "인기스타일이 성공적으로 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message || "인기스타일 삭제 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (items: { id: number }[]) => {
      const response = await apiRequest('/api/admin/popular-styles/reorder', {
        method: 'PUT',
        data: { items }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/popular-styles"] });
      toast({ title: "성공", description: "순서가 변경되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "순서 변경 실패", description: error.message || "순서 변경 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    modal.open('popularStyleForm', {
      styleCard: null,
      onSubmit: (data: any) => {
        createMutation.mutate(data);
      },
      isPending: createMutation.isPending
    });
  };

  const handleEdit = (style: PopularStyle) => {
    modal.open('popularStyleForm', {
      styleCard: style,
      onSubmit: (data: any) => {
        updateMutation.mutate({ id: style.id, data });
      },
      isPending: updateMutation.isPending
    });
  };


  const handleDelete = (id: number) => {
    if (window.confirm("정말로 이 인기스타일을 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  // Form state is now inside Modal, but Concept Picker callback requires extra attention
  // To avoid complexity, we rely on the direct image link for now, or you'd need global state/modal context update.
  const handleConceptSelect = (concept: { title: string; imageUrl: string; linkUrl: string; conceptId: string }) => {
    /* TODO: ConceptPicker needs to be integrated inside the modal if it's meant to be used while creating/editing */
    setIsConceptPickerOpen(false);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newStyles = [...styles];
    const draggedItem = newStyles[draggedIndex];
    newStyles.splice(draggedIndex, 1);
    newStyles.splice(index, 0, draggedItem);

    queryClient.setQueryData(["/api/admin/popular-styles"], newStyles);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null) {
      const reorderedItems = styles.map(style => ({ id: style.id }));
      reorderMutation.mutate(reorderedItems);
    }
    setDraggedIndex(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">인기스타일을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">인기스타일 관리</h3>
          <p className="text-gray-600 mt-1">메인 페이지에 표시할 인기스타일을 관리합니다</p>
        </div>

        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          새 인기스타일 추가
        </Button>
      </div>

      <div className="grid gap-4">
        {styles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            등록된 인기스타일이 없습니다.
          </div>
        ) : (
          styles.map((style: PopularStyle, index: number) => (
            <div
              key={style.id}
              className={`flex items-center space-x-4 p-4 border rounded-lg transition-opacity ${draggedIndex === index ? 'opacity-50 bg-blue-50' : ''}`}
              draggable="true"
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
            >
              <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                <GripVertical className="w-5 h-5" />
              </div>
              <img
                src={style.imageUrl}
                alt={style.title}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <h4 className="font-medium">{style.title}</h4>
                {style.linkUrl && (
                  <p className="text-xs text-blue-600 mt-1">링크: {style.linkUrl}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  순서: {style.sortOrder} | {style.isActive ? '활성' : '비활성'}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(style)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(style.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConceptPickerModal
        open={isConceptPickerOpen}
        onOpenChange={setIsConceptPickerOpen}
        onSelect={handleConceptSelect}
      />
    </div>
  );
}
