import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export interface PhotobookTemplateFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'create' | 'edit';
    template: PhotobookTemplate | null;
    onSubmit: (values: TemplateFormValues) => void;
    isPending: boolean;
}

export function PhotobookTemplateFormModal({
    isOpen,
    onClose,
    mode,
    template,
    onSubmit,
    isPending,
}: PhotobookTemplateFormModalProps) {
    const form = useForm<TemplateFormValues>({
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

    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && template) {
                const tagsString = Array.isArray(template.tags) ? template.tags.join(", ") : "";
                form.reset({
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
            } else if (mode === 'create') {
                form.reset({
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
                });
            }
        }
    }, [isOpen, mode, template, form]);

    const handleSubmit = (values: TemplateFormValues) => {
        onSubmit(values);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{mode === 'edit' ? '템플릿 수정' : '새 템플릿 생성'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'edit' ? '템플릿 정보를 수정합니다.' : '새로운 포토북 템플릿을 생성합니다.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
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
