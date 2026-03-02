import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useModal } from "@/hooks/useModal";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  TableHead,
  TableRow,
  TableHeader,
  TableCell,
  TableBody,
  Table,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  getServiceCategories,
  getServiceItems,
  createServiceItem,
  updateServiceItem,
  deleteServiceItem
} from "@/lib/api";

// Zod 스키마 정의
const serviceItemFormSchema = z.object({
  itemId: z.string()
    .min(1, "서비스 항목 ID는 필수입니다.")
    .max(50, "서비스 항목 ID는 50자 이내로 입력해주세요."),
  categoryId: z.number()
    .int("카테고리 ID는 정수여야 합니다.")
    .positive("카테고리 ID는 양수여야 합니다."),
  title: z.string()
    .min(1, "서비스 항목 이름은 필수입니다.")
    .max(100, "서비스 항목 이름은 100자 이내로 입력해주세요."),
  description: z.string()
    .max(500, "설명은 500자 이내로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  path: z.string()
    .max(200, "경로는 200자 이내로 입력해주세요.")
    .optional()
    .or(z.literal("")),
  icon: z.string()
    .min(1, "아이콘 이름은 필수입니다.")
    .max(50, "아이콘 이름은 50자 이내로 입력해주세요."),
  isPublic: z.boolean().default(true),
  order: z.number().int().default(0),
});

type ServiceItemFormValues = z.infer<typeof serviceItemFormSchema>;

export default function ServiceItemManagement() {
  const modal = useModal();
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 카테고리 목록 조회
  const { data: categories, isLoading: isCategoriesLoading } = useQuery({
    queryKey: ['/api/admin/service-categories'],
    queryFn: getServiceCategories,
  });

  // 서비스 항목 목록 조회
  const { data: serviceItems, isLoading: isItemsLoading } = useQuery({
    queryKey: ['/api/admin/service-items', selectedCategoryId],
    queryFn: () => getServiceItems(selectedCategoryId ? String(selectedCategoryId) : undefined),
    enabled: true, // 항상 조회
  });

  // 서비스 항목 생성 뮤테이션
  const createMutation = useMutation({
    mutationFn: (data: ServiceItemFormValues) => createServiceItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/service-items'] });
      queryClient.invalidateQueries({ queryKey: ['menu'] }); // 메뉴 캐시도 함께 무효화
      toast({
        title: "서비스 항목 생성 완료",
        description: "새로운 서비스 항목이 생성되었습니다.",
      });
    },
    onError: (error) => {
      console.error("Error creating service item:", error);
      toast({
        title: "서비스 항목 생성 실패",
        description: "서비스 항목을 생성하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  // 서비스 항목 수정 뮤테이션
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number, data: ServiceItemFormValues }) =>
      updateServiceItem(id, data),
    onSuccess: () => {
      // 모든 관련 쿼리 무효화 - 카테고리별, 전체 목록 모두 갱신
      queryClient.invalidateQueries({ queryKey: ['/api/admin/service-items'] });

      // 현재 선택된 카테고리가 있으면 해당 카테고리 쿼리도 명시적으로 무효화
      if (selectedCategoryId) {
        queryClient.invalidateQueries({
          queryKey: ['/api/admin/service-items', selectedCategoryId]
        });
      }

      // 메뉴 API도 함께 무효화 (사이드바 및 내부 화면 실시간 업데이트를 위함)
      queryClient.invalidateQueries({ queryKey: ['menu'] });

      toast({
        title: "서비스 항목 수정 완료",
        description: "서비스 항목이 업데이트되었습니다.",
      });
    },
    onError: (error) => {
      console.error("Error updating service item:", error);
      toast({
        title: "서비스 항목 수정 실패",
        description: "서비스 항목을 수정하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  // 서비스 항목 삭제 뮤테이션
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteServiceItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/service-items'] });
      toast({
        title: "서비스 항목 삭제 완료",
        description: "서비스 항목이 삭제되었습니다.",
      });
    },
    onError: (error) => {
      console.error("Error deleting service item:", error);
      toast({
        title: "서비스 항목 삭제 실패",
        description: "서비스 항목을 삭제하는 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  const handleCreateItem = () => {
    modal.open('serviceItemForm', {
      mode: 'create',
      serviceItem: null,
      categories: categories || [],
      onSubmit: (data: any) => {
        createMutation.mutate(data);
      },
      isPending: createMutation.isPending
    });
  };

  const handleEditItem = (item: any) => {
    modal.open('serviceItemForm', {
      mode: 'edit',
      serviceItem: item,
      categories: categories || [],
      onSubmit: (data: any) => {
        updateMutation.mutate({ id: item.id, data });
      },
      isPending: updateMutation.isPending
    });
  };

  const handleDeleteItem = (id: number) => {
    if (window.confirm("이 서비스 항목을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategoryId(parseInt(categoryId));
  };

  const renderServiceItems = () => {
    if (isItemsLoading) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="text-center py-6">
            로딩 중...
          </TableCell>
        </TableRow>
      );
    }

    if (!serviceItems || serviceItems.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={7} className="text-center py-6">
            서비스 항목이 없습니다. 새 항목을 생성해주세요.
          </TableCell>
        </TableRow>
      );
    }

    return serviceItems.map((item: any) => (
      <TableRow key={item.id}>
        <TableCell>{item.id}</TableCell>
        <TableCell className="font-medium">{item.itemId}</TableCell>
        <TableCell>{item.title}</TableCell>
        <TableCell>{item.description || "-"}</TableCell>
        <TableCell>{item.icon}</TableCell>
        <TableCell>{item.isPublic ? "공개" : "비공개"}</TableCell>
        <TableCell>{item.order}</TableCell>
        <TableCell>
          {item.category ? item.category.title : (
            categories?.find((c: any) => c.id === item.categoryId)?.title || `카테고리 ID: ${item.categoryId}`
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleEditItem(item)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteItem(item.id)}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    ));
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>서비스 하위 메뉴 관리</CardTitle>
          <CardDescription>
            AI 서비스의 하위 메뉴 항목을 관리합니다. 각 메인 카테고리에 속하는 세부 서비스를 설정할 수 있습니다.
          </CardDescription>
        </div>
        <div className="flex items-center gap-4">
          <div>
            <Label htmlFor="filter-category" className="mr-2">카테고리 필터:</Label>
            <Select onValueChange={handleCategoryChange}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="모든 카테고리" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">모든 카테고리</SelectItem>
                {categories?.map((category: any) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleCreateItem}>
            <Plus className="mr-2 h-4 w-4" />
            새 서비스 항목
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>항목 ID</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>설명</TableHead>
              <TableHead>아이콘</TableHead>
              <TableHead>공개 상태</TableHead>
              <TableHead>순서</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderServiceItems()}
          </TableBody>
        </Table>

      </CardContent>
    </Card>
  );
}