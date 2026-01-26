import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const serviceItemFormSchema = z.object({
  itemId: z.string().min(1, "서비스 항목 ID는 필수입니다.").max(50),
  categoryId: z.number().int().positive(),
  title: z.string().min(1, "서비스 항목 이름은 필수입니다.").max(100),
  description: z.string().max(500).optional().or(z.literal("")),
  path: z.string().max(200).optional().or(z.literal("")),
  icon: z.string().min(1, "아이콘 이름은 필수입니다.").max(50),
  isPublic: z.boolean().default(true),
  order: z.number().int().default(0),
});

type ServiceItemFormValues = z.infer<typeof serviceItemFormSchema>;

interface ServiceItem {
  id?: number;
  itemId: string;
  categoryId: number;
  title: string;
  description?: string;
  path?: string;
  icon: string;
  isPublic: boolean;
  order: number;
}

interface Category {
  id: number;
  title: string;
}

interface ServiceItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  serviceItem?: ServiceItem | null;
  categories: Category[];
  onSubmit: (values: ServiceItemFormValues) => void;
  isPending?: boolean;
}

export function ServiceItemFormModal({ isOpen, onClose, mode, serviceItem, categories, onSubmit, isPending }: ServiceItemFormModalProps) {
  const form = useForm<ServiceItemFormValues>({
    resolver: zodResolver(serviceItemFormSchema),
    defaultValues: mode === 'edit' && serviceItem ? {
      itemId: serviceItem.itemId,
      categoryId: serviceItem.categoryId,
      title: serviceItem.title,
      description: serviceItem.description || "",
      path: serviceItem.path || "",
      icon: serviceItem.icon,
      isPublic: serviceItem.isPublic,
      order: serviceItem.order,
    } : {
      itemId: "",
      categoryId: categories.length > 0 ? categories[0].id : 0,
      title: "",
      description: "",
      path: "",
      icon: "layout",
      isPublic: true,
      order: 0,
    },
  });

  useEffect(() => {
    if (mode === 'create' && categories.length > 0 && form.getValues("categoryId") === 0) {
      form.setValue("categoryId", categories[0].id);
    }
  }, [categories, mode, form]);

  const handleSubmit = (values: ServiceItemFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '서비스 항목 수정' : '새 서비스 항목 생성'}</DialogTitle>
          <DialogDescription>
            서비스 항목 정보를 입력하세요. 이 항목은 카테고리 내의 하위 메뉴로 표시됩니다.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>서비스 항목 ID</FormLabel>
                  <FormControl>
                    <Input placeholder="maternity-photo" {...field} disabled={mode === 'edit'} />
                  </FormControl>
                  <FormDescription>
                    고유한 서비스 항목 식별자입니다 (예: 'maternity-photo', 'family-photo')
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>카테고리</FormLabel>
                  <Select onValueChange={(value) => field.onChange(parseInt(value))} value={String(field.value)}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                          {category.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    이 서비스 항목이 속할 상위 카테고리를 선택하세요.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>서비스 항목 이름</FormLabel>
                  <FormControl>
                    <Input placeholder="만삭사진 만들기" {...field} />
                  </FormControl>
                  <FormDescription>
                    사용자에게 표시될 서비스 항목 이름입니다.
                  </FormDescription>
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
                    <Input placeholder="서비스 항목에 대한 간단한 설명" {...field} />
                  </FormControl>
                  <FormDescription>
                    서비스 항목에 대한 짧은 설명입니다.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>경로 (Path)</FormLabel>
                  <FormControl>
                    <Input placeholder="/maternity-styles" {...field} />
                  </FormControl>
                  <FormDescription>
                    라우팅 경로를 입력하세요 (예: /maternity-styles, /baby-face)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>아이콘</FormLabel>
                  <FormControl>
                    <Input placeholder="image" {...field} />
                  </FormControl>
                  <FormDescription>
                    lucide-react 아이콘 이름을 입력하세요 (image, camera, family 등)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="isPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">공개 상태</FormLabel>
                    <FormDescription>
                      이 서비스 항목을 메뉴에 공개할지 여부를 설정합니다.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>순서</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                  </FormControl>
                  <FormDescription>
                    같은 카테고리 내에서 표시될 순서입니다. 낮은 숫자가 먼저 표시됩니다.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>취소</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "저장 중..." : mode === 'edit' ? "수정" : "생성"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
