import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const milestoneFormSchema = z.object({
  milestoneId: z.string().min(3, "ID는 최소 3자 이상이어야 합니다"),
  title: z.string().min(2, "제목은 최소 2자 이상이어야 합니다"),
  description: z.string().min(10, "설명은 최소 10자 이상이어야 합니다"),
  weekStart: z.coerce.number().min(1).max(42),
  weekEnd: z.coerce.number().min(1).max(42),
  badgeEmoji: z.string().min(1, "배지 이모지를 입력해주세요"),
  badgeImageUrl: z.string().optional(),
  encouragementMessage: z.string().min(5, "응원 메시지는 최소 5자 이상이어야 합니다"),
  categoryId: z.string().min(1, "카테고리를 선택해주세요"),
  order: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true),
});

type MilestoneFormValues = z.infer<typeof milestoneFormSchema>;

interface Milestone {
  id?: number;
  milestoneId: string;
  title: string;
  description: string;
  weekStart: number;
  weekEnd: number;
  badgeEmoji: string;
  badgeImageUrl?: string;
  encouragementMessage: string;
  categoryId: string;
  order: number;
  isActive: boolean;
}

interface Category {
  categoryId: string;
  name: string;
}

interface MilestoneFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  milestone?: Milestone | null;
  categories: Category[];
  onSubmit: (values: MilestoneFormValues) => void;
  isPending?: boolean;
}

const defaultValues: MilestoneFormValues = {
  milestoneId: "",
  title: "",
  description: "",
  weekStart: 1,
  weekEnd: 40,
  badgeEmoji: "🎯",
  badgeImageUrl: "",
  encouragementMessage: "",
  categoryId: "",
  order: 0,
  isActive: true,
};

export function MilestoneFormModal({ isOpen, onClose, mode, milestone, categories, onSubmit, isPending }: MilestoneFormModalProps) {
  const form = useForm<MilestoneFormValues>({
    resolver: zodResolver(milestoneFormSchema),
    defaultValues: mode === 'edit' && milestone ? {
      milestoneId: milestone.milestoneId,
      title: milestone.title,
      description: milestone.description,
      weekStart: milestone.weekStart,
      weekEnd: milestone.weekEnd,
      badgeEmoji: milestone.badgeEmoji,
      badgeImageUrl: milestone.badgeImageUrl || "",
      encouragementMessage: milestone.encouragementMessage,
      categoryId: milestone.categoryId,
      order: milestone.order,
      isActive: milestone.isActive,
    } : defaultValues,
  });

  const handleSubmit = (values: MilestoneFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '마일스톤 수정' : '새 마일스톤 추가'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? '마일스톤 정보를 수정합니다.' : '임신 및 출산 과정을 추적하기 위한 새로운 마일스톤을 추가합니다.'}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="milestoneId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>마일스톤 ID</FormLabel>
                    <FormControl>
                      <Input placeholder="milestone-id-format" {...field} disabled={mode === 'edit'} />
                    </FormControl>
                    <FormDescription>고유한 영문 ID (예: first-ultrasound)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목</FormLabel>
                    <FormControl>
                      <Input placeholder="마일스톤 제목" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>설명</FormLabel>
                  <FormControl>
                    <Textarea placeholder="마일스톤에 대한 자세한 설명" className="min-h-[100px]" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="weekStart"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>시작 주차</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={42} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="weekEnd"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>종료 주차</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={42} {...field} />
                    </FormControl>
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
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="카테고리 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.categoryId} value={category.categoryId}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="badgeEmoji"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>배지 이모지</FormLabel>
                    <FormControl>
                      <Input placeholder="🎯" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="badgeImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>배지 이미지 URL (선택사항)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="encouragementMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>응원 메시지</FormLabel>
                  <FormControl>
                    <Input placeholder="마일스톤 달성 시 표시될 응원 메시지" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>순서</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>활성화</FormLabel>
                      <FormDescription>마일스톤 표시 여부</FormDescription>
                    </div>
                  </FormItem>
                )}
              />
            </div>

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
