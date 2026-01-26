import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const categoryFormSchema = z.object({
  categoryId: z.string().min(1, "카테고리 ID는 필수입니다.").max(50),
  title: z.string().min(1, "카테고리 이름은 필수입니다.").max(100),
  icon: z.string().min(1, "아이콘 이름은 필수입니다.").max(50),
  isPublic: z.boolean().default(true),
  order: z.number().int().default(0),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

interface Category {
  id?: number;
  categoryId: string;
  title: string;
  icon: string;
  isPublic: boolean;
  order: number;
}

interface CategoryFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  category?: Category | null;
  onSubmit: (values: CategoryFormValues) => void;
  isPending?: boolean;
}

const defaultValues: CategoryFormValues = {
  categoryId: "",
  title: "",
  icon: "layout",
  isPublic: true,
  order: 0,
};

export function CategoryFormModal({ isOpen, onClose, mode, category, onSubmit, isPending }: CategoryFormModalProps) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: mode === 'edit' && category ? {
      categoryId: category.categoryId,
      title: category.title,
      icon: category.icon,
      isPublic: category.isPublic,
      order: category.order,
    } : defaultValues,
  });

  const handleSubmit = (values: CategoryFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '카테고리 수정' : '새 카테고리 생성'}</DialogTitle>
          <DialogDescription>
            서비스 카테고리 정보를 입력하세요. 이 카테고리는 사이드바 메뉴에 표시됩니다.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>카테고리 ID</FormLabel>
                  <FormControl>
                    <Input placeholder="image" {...field} disabled={mode === 'edit'} />
                  </FormControl>
                  <FormDescription>
                    고유한 카테고리 식별자입니다 (예: 'image', 'music', 'chat')
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
                  <FormLabel>카테고리 이름</FormLabel>
                  <FormControl>
                    <Input placeholder="AI 이미지 만들기" {...field} />
                  </FormControl>
                  <FormDescription>
                    사이드바에 표시될 카테고리 이름입니다.
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
                    lucide-react 아이콘 이름을 입력하세요 (image, music, message-square 등)
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
                      이 카테고리를 사이드바에 공개할지 여부를 설정합니다.
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
                    사이드바에 표시될 순서입니다. 낮은 숫자가 먼저 표시됩니다.
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
