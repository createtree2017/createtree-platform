import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const formSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요"),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface ActionTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingActionType?: { id: number; name: string; isActive: boolean } | null;
  onSave: (data: FormValues) => Promise<void>;
  isPending?: boolean;
}

export function ActionTypeModal({ isOpen, onClose, editingActionType, onSave, isPending = false }: ActionTypeModalProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (editingActionType) {
        form.reset({
          name: editingActionType.name,
          isActive: editingActionType.isActive,
        });
      } else {
        form.reset({
          name: "",
          isActive: true,
        });
      }
    }
  }, [editingActionType, isOpen, form]);

  const handleSubmit = async (data: FormValues) => {
    await onSave(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingActionType ? '액션 타입 수정' : '액션 타입 추가'}
          </DialogTitle>
          <DialogDescription>
            세부 미션에 사용할 액션 타입 정보를 입력하세요
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="예: 참석확인, 사진제출" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">활성화</FormLabel>
                    <FormDescription>
                      비활성화하면 새 세부 미션에서 선택할 수 없습니다
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
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
