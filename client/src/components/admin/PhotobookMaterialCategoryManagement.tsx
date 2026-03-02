import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FolderOpen, Plus, Edit, Trash2 } from "lucide-react";
import type { PhotobookMaterialCategory } from "@shared/schema";

const TYPE_OPTIONS = [
  { value: "background", label: "배경" },
  { value: "icon", label: "아이콘" },
] as const;


interface CategoriesResponse {
  success: boolean;
  data: PhotobookMaterialCategory[];
}

export default function PhotobookMaterialCategoryManagement() {
  const { toast } = useToast();
  const queryClientInstance = useQueryClient();
  const modal = useModal();

  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery<CategoriesResponse>({
    queryKey: ["/api/admin/photobook/materials/categories"],
    queryFn: async () => {
      const response = await fetch("/api/admin/photobook/materials/categories", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("카테고리 목록을 불러올 수 없습니다");
      return response.json();
    },
  });


  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/admin/photobook/materials/categories", {
        method: "POST",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ["/api/admin/photobook/materials/categories"] });
      toast({ title: "성공", description: "카테고리가 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "카테고리 생성에 실패했습니다.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest(`/api/admin/photobook/materials/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(data),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ["/api/admin/photobook/materials/categories"] });
      toast({ title: "성공", description: "카테고리가 수정되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "카테고리 수정에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/admin/photobook/materials/categories/${id}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ["/api/admin/photobook/materials/categories"] });
      toast({ title: "성공", description: "카테고리가 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "카테고리 삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleCreate = () => {
    modal.open('photobookMaterialCategoryForm', {
      mode: 'create',
      category: null,
      onSubmit: (data: any) => {
        createMutation.mutate(data, {
          onSuccess: () => modal.close()
        });
      },
      isPending: createMutation.isPending
    });
  };

  const handleEdit = (category: PhotobookMaterialCategory) => {
    modal.open('photobookMaterialCategoryForm', {
      mode: 'edit',
      category: category,
      onSubmit: (data: any) => {
        updateMutation.mutate({ id: category.id, data }, {
          onSuccess: () => modal.close()
        });
      },
      isPending: updateMutation.isPending
    });
  };

  const handleDelete = (category: PhotobookMaterialCategory) => {
    modal.open('deleteConfirm', {
      title: '카테고리 삭제',
      description: `"${category.name}" 카테고리를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      onConfirm: () => {
        deleteMutation.mutate(category.id);
      },
      isPending: deleteMutation.isPending
    });
  };

  const getTypeLabel = (type: string) => {
    return TYPE_OPTIONS.find(t => t.value === type)?.label || type;
  };

  const filteredData = data?.data?.filter(cat =>
    typeFilter === "all" || cat.type === typeFilter
  ) || [];


  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-6 w-6" />
            <div>
              <CardTitle>카테고리 관리</CardTitle>
              <CardDescription>배경 및 아이콘 카테고리를 관리합니다</CardDescription>
            </div>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            새 카테고리
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="유형 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            카테고리를 불러오는 중 오류가 발생했습니다.
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>등록된 카테고리가 없습니다.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>아이콘</TableHead>
                <TableHead>이름</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>정렬 순서</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="text-xl">{category.icon || "📁"}</TableCell>
                  <TableCell className="font-medium">{category.name}</TableCell>
                  <TableCell>
                    <Badge variant={category.type === "background" ? "default" : "secondary"}>
                      {getTypeLabel(category.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{category.sortOrder}</TableCell>
                  <TableCell>
                    <Badge variant={category.isActive ? "outline" : "secondary"}>
                      {category.isActive ? "활성" : "비활성"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleDelete(category)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
