import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useModal } from "@/hooks/useModal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Book, Edit, Plus, Trash2, Image, ChevronLeft, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { PhotobookTemplate } from "@shared/schema";

const CATEGORY_OPTIONS = [
  { value: "general", label: "일반" },
  { value: "maternity", label: "산모" },
  { value: "baby", label: "아기" },
  { value: "family", label: "가족" },
] as const;

const templateFormSchema = z.object({
  name: z.string().min(1, "템플릿 이름을 입력해주세요"),
  description: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  pageCount: z.coerce.number().int().min(1, "페이지 수는 1 이상이어야 합니다").default(1),
  canvasWidth: z.coerce.number().int().min(100, "캔버스 너비는 100 이상이어야 합니다").default(800),
  canvasHeight: z.coerce.number().int().min(100, "캔버스 높이는 100 이상이어야 합니다").default(600),
  category: z.string().default("general"),
  tags: z.string().optional(),
  isPublic: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});

type TemplateFormValues = z.infer<typeof templateFormSchema>;

const getCategoryLabel = (category: string) => {
  const found = CATEGORY_OPTIONS.find(opt => opt.value === category);
  return found ? found.label : category;
};

interface TemplatesResponse {
  success: boolean;
  data: PhotobookTemplate[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function PhotobookTemplateManagement() {
  const queryClientInstance = useQueryClient();
  const modal = useModal();
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const limit = 10;

  const { data: templatesData, isLoading } = useQuery<TemplatesResponse>({
    queryKey: ['/api/admin/photobook/templates', { page, limit, category: categoryFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (categoryFilter && categoryFilter !== "all") {
        params.append("category", categoryFilter);
      }
      const response = await fetch(`/api/admin/photobook/templates?${params}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    }
  });

  const templates = templatesData?.data || [];
  const pagination = templatesData?.pagination;

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormValues) => {
      const tagsArray = data.tags
        ? data.tags.split(",").map(t => t.trim()).filter(Boolean)
        : [];

      const payload = {
        name: data.name,
        description: data.description || undefined,
        thumbnailUrl: data.thumbnailUrl || undefined,
        pageCount: data.pageCount,
        canvasWidth: data.canvasWidth,
        canvasHeight: data.canvasHeight,
        category: data.category,
        tags: tagsArray,
        isPublic: data.isPublic,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      };

      const response = await apiRequest("/api/admin/photobook/templates", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['/api/admin/photobook/templates'] });
      toast({
        title: "성공",
        description: "템플릿이 생성되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "템플릿 생성에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: TemplateFormValues }) => {
      const tagsArray = data.tags
        ? data.tags.split(",").map(t => t.trim()).filter(Boolean)
        : [];

      const payload = {
        name: data.name,
        description: data.description || undefined,
        thumbnailUrl: data.thumbnailUrl || undefined,
        pageCount: data.pageCount,
        canvasWidth: data.canvasWidth,
        canvasHeight: data.canvasHeight,
        category: data.category,
        tags: tagsArray,
        isPublic: data.isPublic,
        sortOrder: data.sortOrder,
        isActive: data.isActive,
      };

      const response = await apiRequest(`/api/admin/photobook/templates/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['/api/admin/photobook/templates'] });
      toast({
        title: "성공",
        description: "템플릿이 수정되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "템플릿 수정에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/admin/photobook/templates/${id}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['/api/admin/photobook/templates'] });
      toast({
        title: "성공",
        description: "템플릿이 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "템플릿 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleCreate = () => {
    modal.open('photobookTemplateForm', {
      mode: 'create',
      template: null,
      onSubmit: (data: any) => {
        createMutation.mutate(data);
      },
      isPending: createMutation.isPending
    });
  };

  const handleEdit = (template: PhotobookTemplate) => {
    modal.open('photobookTemplateForm', {
      mode: 'edit',
      template: template,
      onSubmit: (data: any) => {
        // Mock selectedTemplate using ID since updateMutation expects it
        // Or refactor updateMutation to accept {id, data} similar to other mutations
        // Since we removed selectedTemplate state we must refactor updateMutation.

        const payload = { ...data };
        const tagsArray = data.tags
          ? data.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          : [];

        apiRequest(`/api/admin/photobook/templates/${template.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            name: payload.name,
            description: payload.description || undefined,
            thumbnailUrl: payload.thumbnailUrl || undefined,
            pageCount: payload.pageCount,
            canvasWidth: payload.canvasWidth,
            canvasHeight: payload.canvasHeight,
            category: payload.category,
            tags: tagsArray,
            isPublic: payload.isPublic,
            sortOrder: payload.sortOrder,
            isActive: payload.isActive,
          }),
        }).then(() => {
          queryClientInstance.invalidateQueries({ queryKey: ['/api/admin/photobook/templates'] });
          toast({
            title: "성공",
            description: "템플릿이 수정되었습니다.",
          });
          modal.close();
        }).catch((error) => {
          toast({
            title: "오류",
            description: error.message || "템플릿 수정에 실패했습니다.",
            variant: "destructive",
          });
        });
      },
      isPending: false // We use direct apiRequest inside onSubmit avoiding updateMutation context issue
    });
  };

  const handleDelete = (template: PhotobookTemplate) => {
    modal.open('deleteConfirm', {
      title: '템플릿 삭제',
      description: `"${template.name}" 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`,
      onConfirm: () => {
        deleteMutation.mutate(template.id);
      },
      isPending: deleteMutation.isPending
    });
  };



  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Book className="h-6 w-6" />
            <div>
              <CardTitle>템플릿 관리</CardTitle>
              <CardDescription>포토북 템플릿을 관리합니다</CardDescription>
            </div>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            새 템플릿
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-4">
          <Select value={categoryFilter} onValueChange={(value) => { setCategoryFilter(value); setPage(1); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="카테고리 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 카테고리</SelectItem>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Book className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">템플릿이 없습니다</h3>
            <p className="text-sm text-muted-foreground mt-2">
              새 템플릿을 추가해 주세요.
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">썸네일</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead className="text-center">페이지 수</TableHead>
                  <TableHead className="text-center">상태</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      {template.thumbnailUrl ? (
                        <img
                          src={template.thumbnailUrl}
                          alt={template.name}
                          className="w-16 h-12 object-cover rounded"
                        />
                      ) : (
                        <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                          <Image className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{template.name}</div>
                        {template.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-xs">
                            {template.description}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{getCategoryLabel(template.category || "general")}</Badge>
                    </TableCell>
                    <TableCell className="text-center">{template.pageCount}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={template.isActive ? "default" : "secondary"}>
                        {template.isActive ? "활성" : "비활성"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDelete(template)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  전체 {pagination.total}개 중 {(page - 1) * limit + 1}-{Math.min(page * limit, pagination.total)}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {page} / {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={page >= pagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
