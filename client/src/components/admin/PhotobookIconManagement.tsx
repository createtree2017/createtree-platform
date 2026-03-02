import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { useModal } from "@/hooks/useModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Sparkles, Plus, Edit, Trash2, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import type { PhotobookIcon, PhotobookMaterialCategory } from "@shared/schema";

const iconFormSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  category: z.string().default("general"),
  categoryId: z.number().int().positive().optional().nullable(),
  keywords: z.string().optional(),
  tagsInput: z.string().optional(),
  isPublic: z.boolean().default(true),
  hospitalId: z.number().int().positive().optional().nullable(),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

type IconFormValues = z.infer<typeof iconFormSchema>;

interface PaginatedResponse {
  success: boolean;
  data: PhotobookIcon[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface CategoriesResponse {
  success: boolean;
  data: PhotobookMaterialCategory[];
}

export default function PhotobookIconManagement() {
  const { toast } = useToast();
  const queryClientInstance = useQueryClient();
  const modal = useModal();

  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const limit = 16;

  const { data: categoriesData } = useQuery<CategoriesResponse>({
    queryKey: ["/api/admin/photobook/materials/categories", { type: "icon" }],
    queryFn: async () => {
      const response = await fetch("/api/admin/photobook/materials/categories?type=icon", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("카테고리 목록을 불러올 수 없습니다");
      return response.json();
    },
  });

  const categories = categoriesData?.data || [];

  const { data, isLoading, error } = useQuery<PaginatedResponse>({
    queryKey: ["/api/admin/photobook/materials/icons", { page, limit }],
    queryFn: async () => {
      const response = await fetch(`/api/admin/photobook/materials/icons?page=${page}&limit=${limit}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("아이콘 목록을 불러올 수 없습니다");
      return response.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch("/api/admin/photobook/materials/icons", {
        method: "POST",
        body: data,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "아이콘 생성에 실패했습니다");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ["/api/admin/photobook/materials/icons"] });
      toast({ title: "성공", description: "아이콘이 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "아이콘 생성에 실패했습니다.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const response = await fetch(`/api/admin/photobook/materials/icons/${id}`, {
        method: "PATCH",
        body: data,

        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "아이콘 수정에 실패했습니다");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ["/api/admin/photobook/materials/icons"] });
      toast({ title: "성공", description: "아이콘이 수정되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "아이콘 수정에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/admin/photobook/materials/icons/${id}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ["/api/admin/photobook/materials/icons"] });
      toast({ title: "성공", description: "아이콘이 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "아이콘 삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    modal.open('photobookIconForm', {
      mode: 'create',
      icon: null,
      categories: categories,
      onSubmit: (data: FormData) => {
        createMutation.mutate(data, {
          onSuccess: () => modal.close()
        });
      },
      isPending: createMutation.isPending
    });
  };

  const handleEdit = (icon: PhotobookIcon) => {
    modal.open('photobookIconForm', {
      mode: 'edit',
      icon: icon,
      categories: categories,
      onSubmit: (data: FormData) => {
        updateMutation.mutate({ id: icon.id, data }, {
          onSuccess: () => modal.close()
        });
      },
      isPending: updateMutation.isPending
    });
  };

  const handleDelete = (icon: PhotobookIcon) => {
    modal.open('deleteConfirm', {
      title: '아이콘 삭제',
      description: `"${icon.name}" 아이콘을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      onConfirm: () => {
        deleteMutation.mutate(icon.id);
      },
      isPending: deleteMutation.isPending
    });
  };

  const getCategoryLabel = (categoryId: number | null) => {
    if (!categoryId) return "미분류";
    return categories.find(c => c.id === categoryId)?.name || "미분류";
  };

  const filteredData = data?.data?.filter(icon =>
    categoryFilter === "all" ||
    (categoryFilter === "uncategorized" ? !icon.categoryId : icon.categoryId?.toString() === categoryFilter)
  ) || [];

  const pagination = data?.pagination;



  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-6 w-6" />
            <div>
              <CardTitle>아이콘 관리</CardTitle>
              <CardDescription>포토북 아이콘을 관리합니다</CardDescription>
            </div>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            새 아이콘
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="카테고리 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="uncategorized">미분류</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat.id} value={cat.id.toString()}>
                  {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {Array.from({ length: 16 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            아이콘을 불러오는 중 오류가 발생했습니다.
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>등록된 아이콘이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {filteredData.map((icon) => (
                <Card key={icon.id} className="overflow-hidden group relative">
                  <div className="aspect-square relative bg-muted flex items-center justify-center p-2">
                    <img
                      src={icon.thumbnailUrl || icon.imageUrl}
                      alt={icon.name}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder-image.png";
                      }}
                    />
                    {!icon.isActive && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="secondary" className="text-xs">비활성</Badge>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-1">
                        <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => handleEdit(icon)}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="destructive" className="h-7 w-7" onClick={() => handleDelete(icon)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-2">
                    <h4 className="font-medium text-xs truncate">{icon.name}</h4>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {getCategoryLabel(icon.categoryId)}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>


    </Card>
  );
}
