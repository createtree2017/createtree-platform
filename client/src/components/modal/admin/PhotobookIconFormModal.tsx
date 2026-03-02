import { useEffect, useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload } from "lucide-react";
import type { PhotobookIcon, PhotobookMaterialCategory } from "@shared/schema";

const iconFormSchema = z.object({
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

type IconFormValues = z.infer<typeof iconFormSchema>;

export interface PhotobookIconFormModalProps {
    mode: 'create' | 'edit';
    icon: PhotobookIcon | null;
    categories: PhotobookMaterialCategory[];
    onSubmit: (data: FormData) => void;
    isPending: boolean;
}

export function PhotobookIconFormModal({
    isOpen,
    onClose,
    mode,
    icon,
    categories,
    onSubmit,
    isPending,
}: PhotobookIconFormModalProps & { isOpen: boolean; onClose: () => void }) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<IconFormValues>({
        resolver: zodResolver(iconFormSchema),
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

    useEffect(() => {
        if (isOpen) {
            if (mode === 'edit' && icon) {
                form.reset({
                    name: icon.name,
                    category: icon.category || "general",
                    categoryId: icon.categoryId || null,
                    keywords: icon.keywords || "",
                    tagsInput: "",
                    isPublic: icon.isPublic,
                    hospitalId: icon.hospitalId || null,
                    sortOrder: icon.sortOrder,
                    isActive: icon.isActive,
                });
                setFilePreview(icon.imageUrl);
                setSelectedFile(null);
            } else if (mode === 'create') {
                form.reset({
                    name: "",
                    category: "general",
                    categoryId: null,
                    keywords: "",
                    tagsInput: "",
                    isPublic: true,
                    hospitalId: null,
                    sortOrder: 0,
                    isActive: true,
                });
                resetFileState();
            }
        }
    }, [isOpen, mode, icon, form]);

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

    const handleSubmit = (data: IconFormValues) => {
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

        onSubmit(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{mode === 'edit' ? '아이콘 수정' : '새 아이콘 추가'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'edit' ? '아이콘 정보를 수정합니다.' : '포토북에 사용할 새 아이콘을 추가합니다.'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>이름 *</FormLabel>
                                    <FormControl>
                                        <Input placeholder="아이콘 이름" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="space-y-2">
                            <Label>{mode === 'edit' ? "이미지 변경 (선택)" : "이미지 *"}</Label>
                            <div className="flex items-center gap-4">
                                <div
                                    className="relative w-20 h-20 bg-muted rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    {filePreview ? (
                                        <img src={filePreview} alt="미리보기" className="w-full h-full object-contain p-1" />
                                    ) : (
                                        <div className="flex flex-col items-center text-muted-foreground">
                                            <Upload className="h-5 w-5" />
                                            <span className="text-[10px] mt-1">업로드</span>
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
                            {mode === 'create' && !selectedFile && (
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
                                        <Input placeholder="아기, 하트, 축하" {...field} />
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
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>
                                취소
                            </Button>
                            <Button type="submit" disabled={isPending || (mode === 'create' && !selectedFile)}>
                                {isPending ? (mode === 'edit' ? "수정 중..." : "생성 중...") : (mode === 'edit' ? "수정" : "생성")}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
