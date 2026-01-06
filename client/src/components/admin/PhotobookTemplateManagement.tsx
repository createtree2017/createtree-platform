import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

const getCategoryLabel = (category: string) => {
  const found = CATEGORY_OPTIONS.find(opt => opt.value === category);
  return found ? found.label : category;
};

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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<PhotobookTemplate | null>(null);
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

  const createForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    defaultValues: {
      name: "",
      description: "",
      thumbnailUrl: "",
      pageCount: 1,
      canvasWidth: 800,
      canvasHeight: 600,
      category: "general",
      tags: "",
      isPublic: true,
      sortOrder: 0,
      isActive: true,
    },
  });

  const editForm = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
  });

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
      setIsCreateDialogOpen(false);
      createForm.reset();
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
    mutationFn: async (data: TemplateFormValues) => {
      if (!selectedTemplate) throw new Error("선택된 템플릿이 없습니다.");

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

      const response = await apiRequest(`/api/admin/photobook/templates/${selectedTemplate.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClientInstance.invalidateQueries({ queryKey: ['/api/admin/photobook/templates'] });
      setIsEditDialogOpen(false);
      setSelectedTemplate(null);
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
      setIsDeleteDialogOpen(false);
      setSelectedTemplate(null);
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

  const handleEdit = (template: PhotobookTemplate) => {
    setSelectedTemplate(template);
    const tagsString = Array.isArray(template.tags) ? template.tags.join(", ") : "";
    editForm.reset({
      name: template.name || "",
      description: template.description || "",
      thumbnailUrl: template.thumbnailUrl || "",
      pageCount: template.pageCount || 1,
      canvasWidth: template.canvasWidth || 800,
      canvasHeight: template.canvasHeight || 600,
      category: template.category || "general",
      tags: tagsString,
      isPublic: template.isPublic ?? true,
      sortOrder: template.sortOrder || 0,
      isActive: template.isActive ?? true,
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (template: PhotobookTemplate) => {
    setSelectedTemplate(template);
    setIsDeleteDialogOpen(true);
  };

  const onCreateSubmit = (data: TemplateFormValues) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: TemplateFormValues) => {
    updateMutation.mutate(data);
  };

  const TemplateFormFields = ({ form }: { form: ReturnType<typeof useForm<TemplateFormValues>> }) => (
    <div className="grid gap-4 py-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>이름 *</FormLabel>
            <FormControl>
              <Input placeholder="템플릿 이름" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>설명</FormLabel>
            <FormControl>
              <Textarea placeholder="템플릿 설명" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="thumbnailUrl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>썸네일 URL</FormLabel>
            <FormControl>
              <Input placeholder="https://..." {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="category"
        render={({ field }) => (
          <FormItem>
            <FormLabel>카테고리</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-3 gap-4">
        <FormField
          control={form.control}
          name="pageCount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>페이지 수</FormLabel>
              <FormControl>
                <Input type="number" min="1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="canvasWidth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>캔버스 너비</FormLabel>
              <FormControl>
                <Input type="number" min="100" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="canvasHeight"
          render={({ field }) => (
            <FormItem>
              <FormLabel>캔버스 높이</FormLabel>
              <FormControl>
                <Input type="number" min="100" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="tags"
        render={({ field }) => (
          <FormItem>
            <FormLabel>태그</FormLabel>
            <FormControl>
              <Input placeholder="태그1, 태그2, 태그3 (쉼표로 구분)" {...field} />
            </FormControl>
            <FormDescription>쉼표로 구분하여 여러 태그 입력</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="sortOrder"
        render={({ field }) => (
          <FormItem>
            <FormLabel>정렬 순서</FormLabel>
            <FormControl>
              <Input type="number" min="0" {...field} />
            </FormControl>
            <FormDescription>낮은 숫자가 먼저 표시됩니다</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="flex gap-6">
        <FormField
          control={form.control}
          name="isPublic"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0">공개</FormLabel>
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2">
              <FormControl>
                <Switch checked={field.value} onCheckedChange={field.onChange} />
              </FormControl>
              <FormLabel className="!mt-0">활성화</FormLabel>
            </FormItem>
          )}
        />
      </div>
    </div>
  );

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
          <Button onClick={() => setIsCreateDialogOpen(true)}>
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 템플릿 생성</DialogTitle>
            <DialogDescription>
              새로운 포토북 템플릿을 생성합니다.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
              <TemplateFormFields form={createForm} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "생성 중..." : "생성"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>템플릿 수정</DialogTitle>
            <DialogDescription>
              템플릿 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
              <TemplateFormFields form={editForm} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "수정 중..." : "수정"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>템플릿 삭제</DialogTitle>
            <DialogDescription>
              "{selectedTemplate?.name}" 템플릿을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedTemplate && deleteMutation.mutate(selectedTemplate.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
