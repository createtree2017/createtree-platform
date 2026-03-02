import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';

// Validation schema
export const snapshotPromptSchema = z.object({
    category: z.enum(['individual', 'couple', 'family'], {
        required_error: 'Category is required',
    }),
    type: z.enum(['daily', 'travel', 'film'], {
        required_error: 'Type is required',
    }),
    gender: z.enum(['male', 'female', 'all']).optional(),
    region: z.enum(['domestic', 'international', 'all']).optional(),
    season: z.enum(['spring', 'summer', 'fall', 'winter', 'all']).optional(),
    prompt: z.string().min(10, 'Prompt must be at least 10 characters'),
    isActive: z.boolean().default(true),
});

export type SnapshotPromptFormData = z.infer<typeof snapshotPromptSchema>;

export interface SnapshotPrompt {
    id: number;
    category: string;
    type: string;
    gender?: string | null;
    region?: string | null;
    season?: string | null;
    prompt: string;
    isActive: boolean;
    usageCount: number;
    createdAt: string;
    updatedAt: string;
}

export interface SnapshotPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    prompt?: SnapshotPrompt | null;
    onSave: (data: SnapshotPromptFormData & { id?: number }) => void;
    isPending: boolean;
}

export default function SnapshotPromptModal({
    isOpen,
    onClose,
    prompt,
    onSave,
    isPending,
}: SnapshotPromptModalProps) {
    const isEditing = !!prompt;

    const form = useForm<SnapshotPromptFormData>({
        resolver: zodResolver(snapshotPromptSchema),
        defaultValues: {
            category: 'individual',
            type: 'daily',
            gender: 'all',
            region: 'all',
            season: 'all',
            prompt: '',
            isActive: true,
        },
    });

    useEffect(() => {
        if (isOpen) {
            if (prompt) {
                form.reset({
                    category: prompt.category as any,
                    type: prompt.type as any,
                    gender: (prompt.gender || 'all') as any,
                    region: (prompt.region || 'all') as any,
                    season: (prompt.season || 'all') as any,
                    prompt: prompt.prompt,
                    isActive: prompt.isActive,
                });
            } else {
                form.reset({
                    category: 'individual',
                    type: 'daily',
                    gender: 'all',
                    region: 'all',
                    season: 'all',
                    prompt: '',
                    isActive: true,
                });
            }
        }
    }, [isOpen, prompt, form]);

    const onSubmit = (data: SnapshotPromptFormData) => {
        if (isEditing) {
            onSave({ ...data, id: prompt.id });
        } else {
            onSave(data);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? '프롬프트 수정' : '새 프롬프트 추가'}</DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? `프롬프트 정보를 수정합니다 (ID: ${prompt.id})`
                            : '스냅샷 생성에 사용될 새 프롬프트를 추가합니다'}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>카테고리 *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="선택하세요" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="individual">Individual (개인)</SelectItem>
                                                <SelectItem value="couple">Couple (커플)</SelectItem>
                                                <SelectItem value="family">Family (가족)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>스타일 *</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="선택하세요" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="daily">Daily (일상)</SelectItem>
                                                <SelectItem value="travel">Travel (여행)</SelectItem>
                                                <SelectItem value="film">Film (필름)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription className="text-xs text-muted-foreground">
                                            Mix는 사용자 UI에서만 선택 가능합니다
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="gender"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>성별 (선택)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="모두" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="all">모두</SelectItem>
                                                <SelectItem value="male">Male (남성)</SelectItem>
                                                <SelectItem value="female">Female (여성)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="region"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>지역 (선택)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="모두" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="all">모두</SelectItem>
                                                <SelectItem value="domestic">Domestic (국내)</SelectItem>
                                                <SelectItem value="international">International (해외)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="season"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>계절 (선택)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="모두" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="all">모두</SelectItem>
                                                <SelectItem value="spring">Spring (봄)</SelectItem>
                                                <SelectItem value="summer">Summer (여름)</SelectItem>
                                                <SelectItem value="fall">Fall (가을)</SelectItem>
                                                <SelectItem value="winter">Winter (겨울)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="prompt"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>프롬프트 *</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="AI 이미지 생성에 사용될 프롬프트를 입력하세요..."
                                            className="min-h-[150px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        최소 10자 이상 입력해주세요
                                    </FormDescription>
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
                                            비활성화하면 프롬프트 선택에서 제외됩니다
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
                                type="button"
                                variant="outline"
                                onClick={onClose}
                            >
                                취소
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                {isEditing ? '수정' : '추가'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
