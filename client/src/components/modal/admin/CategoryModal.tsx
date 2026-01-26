import { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const formSchema = z.object({
  categoryId: z.string().min(1, "ID를 입력하세요"),
  name: z.string().min(1, "이름을 입력하세요"),
  description: z.string().optional(),
  emoji: z.string().optional(),
  order: z.number().int().min(0),
});

type FormValues = z.infer<typeof formSchema>;

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingCategory?: { 
    id: number; 
    categoryId: string; 
    name: string; 
    description?: string; 
    emoji?: string; 
    order: number 
  } | null;
  onSave: (data: FormValues) => Promise<void>;
  isPending?: boolean;
  defaultOrder?: number;
}

export function CategoryModal({ 
  isOpen, 
  onClose, 
  editingCategory, 
  onSave, 
  isPending = false,
  defaultOrder = 0
}: CategoryModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoryId: "",
      name: "",
      description: "",
      emoji: "📋",
      order: defaultOrder,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (editingCategory) {
        form.reset({
          categoryId: editingCategory.categoryId,
          name: editingCategory.name,
          description: editingCategory.description || "",
          emoji: editingCategory.emoji || "📋",
          order: editingCategory.order,
        });
      } else {
        form.reset({
          categoryId: "",
          name: "",
          description: "",
          emoji: "📋",
          order: defaultOrder,
        });
      }
    }
  }, [editingCategory, isOpen, form, defaultOrder]);

  const handleSubmit = async (data: FormValues) => {
    await onSave(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingCategory ? '카테고리 수정' : '카테고리 추가'}
          </DialogTitle>
          <DialogDescription>
            미션 카테고리 정보를 입력하세요
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
                    <Input {...field} placeholder="daily_missions" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="일상 미션" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이모지</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="📋" />
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
                    <Textarea {...field} placeholder="일상 생활과 관련된 미션들" />
                  </FormControl>
                  <FormMessage />
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
                    <Input 
                      type="number" 
                      {...field} 
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={isPending}
              >
                {isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                저장
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
