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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Image, Plus, Edit, Trash2, ChevronLeft, ChevronRight, Upload } from "lucide-react";
import type { PhotobookBackground, PhotobookMaterialCategory } from "@shared/schema";

const backgroundFormSchema = z.object({
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

type BackgroundFormValues = z.infer<typeof backgroundFormSchema>;

interface PaginatedResponse {
  success: boolean;
  data: PhotobookBackground[];
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

export default function PhotobookBackgroundManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [page, setPage] = useState(1);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedBackground, setSelectedBackground] = useState<PhotobookBackground | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const limit = 12;

  const { data: categoriesData } = useQuery<CategoriesResponse>({
    queryKey: ["/api/admin/photobook/materials/categories", { type: "background" }],
    queryFn: async () => {
      const response = await fetch("/api/admin/photobook/materials/categories?type=background", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("카테고리 목록을 불러올 수 없습니다");
      return response.json();
    },
  });

  const categories = categoriesData?.data || [];

  const { data, isLoading, error } = useQuery<PaginatedResponse>({
    queryKey: ["/api/admin/photobook/materials/backgrounds", { page, limit }],
    queryFn: async () => {
      const response = await fetch(`/api/admin/photobook/materials/backgrounds?page=${page}&limit=${limit}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("배경 목록을 불러올 수 없습니다");
      return response.json();
    },
  });

  const createForm = useForm<BackgroundFormValues>({
    resolver: zodResolver(backgroundFormSchema),
    defaultValues: {
      name: "",
      category: "general",
      categoryId: null,
      keywords: "",
      tagsInput: "",
      isPublic: true,
      hospitalId: null,
      sortOrder: 0,
      isActive: true,
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const resetFileState = () => {
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const editForm = useForm<BackgroundFormValues>({
    resolver: zodResolver(backgroundFormSchema),
  });

  const createMutation = useMutation({
    mutationFn: async (data: BackgroundFormValues) => {
      if (!selectedFile) {
        throw new Error("이미지 파일을 선택해주세요");
      }
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("name", data.name);
      formData.append("category", data.category);
      if (data.categoryId) formData.append("categoryId", data.categoryId.toString());
      if (data.keywords) formData.append("keywords", data.keywords);
      if (data.tagsInput) {
        const tags = data.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        formData.append("tags", JSON.stringify(tags));
      }
      formData.append("isPublic", data.isPublic.toString());
      if (data.hospitalId) formData.append("hospitalId", data.hospitalId.toString());
      formData.append("sortOrder", data.sortOrder.toString());
      formData.append("isActive", data.isActive.toString());

      const response = await fetch("/api/admin/photobook/materials/backgrounds", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "배경 생성에 실패했습니다");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photobook/materials/backgrounds"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      resetFileState();
      toast({ title: "성공", description: "배경이 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "배경 생성에 실패했습니다.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: BackgroundFormValues }) => {
      const formData = new FormData();
      if (selectedFile) {
        formData.append("image", selectedFile);
      }
      formData.append("name", data.name);
      formData.append("category", data.category);
      if (data.categoryId) formData.append("categoryId", data.categoryId.toString());
      if (data.keywords) formData.append("keywords", data.keywords);
      if (data.tagsInput) {
        const tags = data.tagsInput.split(',').map(t => t.trim()).filter(Boolean);
        formData.append("tags", JSON.stringify(tags));
      }
      formData.append("isPublic", data.isPublic.toString());
      if (data.hospitalId) formData.append("hospitalId", data.hospitalId.toString());
      formData.append("sortOrder", data.sortOrder.toString());
      formData.append("isActive", data.isActive.toString());

      const response = await fetch(`/api/admin/photobook/materials/backgrounds/${id}`, {
        method: "PATCH",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "배경 수정에 실패했습니다");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photobook/materials/backgrounds"] });
      setIsEditDialogOpen(false);
      setSelectedBackground(null);
      resetFileState();
      toast({ title: "성공", description: "배경이 수정되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "배경 수정에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/admin/photobook/materials/backgrounds/${id}`, {
        method: "DELETE",
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/photobook/materials/backgrounds"] });
      setIsDeleteDialogOpen(false);
      setSelectedBackground(null);
      toast({ title: "성공", description: "배경이 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "배경 삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleEdit = (background: PhotobookBackground) => {
    setSelectedBackground(background);
    editForm.reset({
      name: background.name,
      category: background.category || "general",
      categoryId: background.categoryId || null,
      keywords: background.keywords || "",
      tagsInput: "",
      isPublic: background.isPublic,
      hospitalId: background.hospitalId || null,
      sortOrder: background.sortOrder,
      isActive: background.isActive,
    });
    setFilePreview(background.imageUrl);
    setSelectedFile(null);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (background: PhotobookBackground) => {
    setSelectedBackground(background);
    setIsDeleteDialogOpen(true);
  };

  const onCreateSubmit = (data: BackgroundFormValues) => {
    createMutation.mutate(data);
  };

  const onEditSubmit = (data: BackgroundFormValues) => {
    if (!selectedBackground) return;
    updateMutation.mutate({ id: selectedBackground.id, data });
  };

  const getCategoryLabel = (categoryId: number | null) => {
    if (!categoryId) return "미분류";
    return categories.find(c => c.id === categoryId)?.name || "미분류";
  };

  const filteredData = data?.data?.filter(bg => 
    categoryFilter === "all" || 
    (categoryFilter === "uncategorized" ? !bg.categoryId : bg.categoryId?.toString() === categoryFilter)
  ) || [];

  const pagination = data?.pagination;

  const renderFormFields = (form: typeof createForm | typeof editForm, isEdit: boolean = false) => (
    <>
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>이름 *</FormLabel>
            <FormControl>
              <Input placeholder="배경 이름" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="space-y-2">
        <Label>{isEdit ? "이미지 변경 (선택)" : "이미지 *"}</Label>
        <div className="flex items-center gap-4">
          <div
            className="relative w-32 h-20 bg-muted rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {filePreview ? (
              <img src={filePreview} alt="미리보기" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center text-muted-foreground">
                <Upload className="h-6 w-6" />
                <span className="text-xs mt-1">클릭하여 업로드</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          {filePreview && (
            <Button type="button" variant="outline" size="sm" onClick={resetFileState}>
              제거
            </Button>
          )}
        </div>
        {!isEdit && !selectedFile && (
          <p className="text-sm text-destructive">이미지를 선택해주세요</p>
        )}
      </div>
      <FormField
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>카테고리</FormLabel>
            <Select 
              onValueChange={(val) => field.onChange(val === "none" ? null : parseInt(val))} 
              value={field.value?.toString() || "none"}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="none">미분류</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id.toString()}>
                    {cat.icon ? `${cat.icon} ` : ""}{cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormDescription>동적 카테고리 선택</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="keywords"
        render={({ field }) => (
          <FormItem>
            <FormLabel>검색 키워드</FormLabel>
            <FormControl>
              <Input placeholder="파스텔, 따뜻한, 봄" {...field} />
            </FormControl>
            <FormDescription>검색에 사용될 키워드 (쉼표로 구분)</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="tagsInput"
        render={({ field }) => (
          <FormItem>
            <FormLabel>태그</FormLabel>
            <FormControl>
              <Input placeholder="태그1, 태그2, 태그3" {...field} />
            </FormControl>
            <FormDescription>쉼표(,)로 구분하여 입력</FormDescription>
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
              <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 0)} />
            </FormControl>
            <FormDescription>낮을수록 먼저 표시</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex gap-4">
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
    </>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image className="h-6 w-6" />
            <div>
              <CardTitle>배경 관리</CardTitle>
              <CardDescription>포토북 배경을 관리합니다</CardDescription>
            </div>
          </div>
          <Button onClick={() => {
            createForm.reset();
            resetFileState();
            setIsCreateDialogOpen(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            새 배경
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-video rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-muted-foreground">
            배경을 불러오는 중 오류가 발생했습니다.
          </div>
        ) : filteredData.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>등록된 배경이 없습니다.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredData.map((bg) => (
                <Card key={bg.id} className="overflow-hidden group relative">
                  <div className="aspect-video relative bg-muted">
                    <img
                      src={bg.thumbnailUrl || bg.imageUrl}
                      alt={bg.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/placeholder-image.png";
                      }}
                    />
                    {!bg.isActive && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Badge variant="secondary">비활성</Badge>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={() => handleEdit(bg)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(bg)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-medium text-sm truncate">{bg.name}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="text-xs">
                        {getCategoryLabel(bg.categoryId)}
                      </Badge>
                      {bg.isPublic && <Badge variant="secondary" className="text-xs">공개</Badge>}
                    </div>
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 배경 추가</DialogTitle>
            <DialogDescription>포토북에 사용할 새 배경을 추가합니다.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              {renderFormFields(createForm, false)}
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
            <DialogTitle>배경 수정</DialogTitle>
            <DialogDescription>배경 정보를 수정합니다.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              {renderFormFields(editForm, true)}
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

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>배경 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{selectedBackground?.name}" 배경을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedBackground && deleteMutation.mutate(selectedBackground.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
