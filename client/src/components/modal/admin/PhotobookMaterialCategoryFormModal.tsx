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
import type { PhotobookMaterialCategory } from "@shared/schema";

const TYPE_OPTIONS = [
    { value: "background", label: "배경" },
    { value: "icon", label: "아이콘" },
] as const;

const categoryFormSchema = z.object({
    name: z.string().min(1, "카테고리 이름을 입력해주세요"),
    type: z.enum(["background", "icon"]),
    icon: z.string().optional(),
    sortOrder: z.coerce.number().int().default(0),
    isActive: z.boolean().default(true),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export interface PhotobookMaterialCategoryFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    category: PhotobookMaterialCategory | null;
    onSubmit: (values: CategoryFormValues) => void;
    isPending: boolean;
}

export function PhotobookMaterialCategoryFormModal({
    isOpen,
    onClose,
    mode,
    category,
    onSubmit,
    isPending,
}: PhotobookMaterialCategoryFormModalProps) {
    const form = useForm<CategoryFormValues>({
        resolver: zodResolver(categoryFormSchema),
        defaultValues: {
            name: "",
            type: "background",
            icon: "",
            sortOrder: 0,
            isActive: true,
        },
    });

    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && category) {
                form.reset({
                    name: category.name,
                    type: category.type as "background" | "icon",
                    icon: category.icon || "",
                    sortOrder: category.sortOrder,
                    isActive: category.isActive,
                });
            } else if (mode === 'create') {
                form.reset({
                    name: "",
                    type: "background",
                    icon: "",
                    sortOrder: 0,
                    isActive: true,
                });
            }
        }
    }, [isOpen, mode, category, form]);

    const handleSubmit = (values: CategoryFormValues) => {
        onSubmit(values);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{mode === 'edit' ? '카테고리 수정' : '새 카테고리 추가'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'edit' ? '카테고리 정보를 수정합니다.' : '배경 또는 아이콘의 새 카테고리를 추가합니다.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>카테고리 이름 *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="카테고리 이름" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="type"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>유형 *</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value} disabled={mode === 'edit'}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="유형 선택" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {TYPE_OPTIONS.map(opt => (
                                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>배경 또는 아이콘 카테고리</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="icon"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>아이콘 (이모지)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="📁" {...field} />
                                    </FormControl>
                                    <FormDescription>카테고리를 나타내는 이모지 (선택사항)</FormDescription>
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
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                취소
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? (mode === 'edit' ? "수정 중..." : "생성 중...") : (mode === 'edit' ? "수정" : "생성")}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
