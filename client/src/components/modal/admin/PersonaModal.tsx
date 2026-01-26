import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription as FormDesc } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, X, PlusCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';

const personaFormSchema = z.object({
  personaId: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  avatarEmoji: z.string().min(1, "Avatar emoji is required"),
  description: z.string().min(1, "Description is required"),
  welcomeMessage: z.string().min(1, "Welcome message is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  primaryColor: z.string().min(1, "Primary color is required"),
  secondaryColor: z.string().min(1, "Secondary color is required"),
  personality: z.string().optional(),
  tone: z.string().optional(),
  usageContext: z.string().optional(),
  emotionalKeywords: z.array(z.string()).optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night", "all"]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  order: z.number().int().default(0),
  categories: z.array(z.string()).optional(),
});

type FormValues = z.infer<typeof personaFormSchema>;

interface PersonaModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
  categories?: Array<{ categoryId: string; name: string; emoji?: string }>;
  onSuccess?: () => void;
}

export function PersonaModal({ 
  isOpen, 
  onClose, 
  initialData,
  categories = [],
  onSuccess 
}: PersonaModalProps) {
  const queryClient = useQueryClient();
  const [emotionalKeyword, setEmotionalKeyword] = useState("");
  const isEditing = !!initialData;

  const form = useForm<FormValues>({
    resolver: zodResolver(personaFormSchema),
    defaultValues: {
      personaId: "",
      name: "",
      avatarEmoji: "🤖",
      description: "",
      welcomeMessage: "",
      systemPrompt: "",
      primaryColor: "#6366f1",
      secondaryColor: "#a5b4fc",
      personality: "",
      tone: "",
      usageContext: "",
      emotionalKeywords: [],
      timeOfDay: "all",
      isActive: true,
      isFeatured: false,
      order: 0,
      categories: [],
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset({
          personaId: initialData.personaId || "",
          name: initialData.name || "",
          avatarEmoji: initialData.avatarEmoji || "🤖",
          description: initialData.description || "",
          welcomeMessage: initialData.welcomeMessage || "",
          systemPrompt: initialData.systemPrompt || "",
          primaryColor: initialData.primaryColor || "#6366f1",
          secondaryColor: initialData.secondaryColor || "#a5b4fc",
          personality: initialData.personality || "",
          tone: initialData.tone || "",
          usageContext: initialData.usageContext || "",
          emotionalKeywords: initialData.emotionalKeywords || [],
          timeOfDay: initialData.timeOfDay || "all",
          isActive: initialData.isActive ?? true,
          isFeatured: initialData.isFeatured ?? false,
          order: initialData.order || 0,
          categories: initialData.categories || [],
        });
      } else {
        form.reset({
          personaId: "",
          name: "",
          avatarEmoji: "🤖",
          description: "",
          welcomeMessage: "",
          systemPrompt: "",
          primaryColor: "#6366f1",
          secondaryColor: "#a5b4fc",
          personality: "",
          tone: "",
          usageContext: "",
          emotionalKeywords: [],
          timeOfDay: "all",
          isActive: true,
          isFeatured: false,
          order: 0,
          categories: [],
        });
      }
    }
  }, [initialData, isOpen, form]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const url = isEditing 
        ? `/api/admin/personas/${initialData.personaId}`
        : '/api/admin/personas';
      return apiRequest(url, {
        method: isEditing ? "PUT" : "POST",
        body: JSON.stringify(values),
      });
    },
    onSuccess: () => {
      toast({
        title: isEditing ? "캐릭터 수정됨" : "캐릭터 생성됨",
        description: isEditing 
          ? "캐릭터가 성공적으로 수정되었습니다." 
          : "새 캐릭터가 성공적으로 생성되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast({
        title: "오류",
        description: `캐릭터 ${isEditing ? "수정" : "생성"} 중 오류가 발생했습니다.`,
        variant: "destructive",
      });
      console.error("Error saving persona:", error);
    },
  });

  const handleSubmit = (data: FormValues) => {
    mutation.mutate(data);
  };

  const addEmotionalKeyword = () => {
    if (emotionalKeyword.trim()) {
      const current = form.getValues("emotionalKeywords") || [];
      form.setValue("emotionalKeywords", [...current, emotionalKeyword.trim()]);
      setEmotionalKeyword("");
    }
  };

  const removeEmotionalKeyword = (index: number) => {
    const current = form.getValues("emotionalKeywords") || [];
    form.setValue("emotionalKeywords", current.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? '캐릭터 편집' : '새 캐릭터 만들기'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? '이 AI 채팅 캐릭터의 세부 정보를 수정합니다.'
              : '시스템에 새 AI 채팅 캐릭터를 추가합니다.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="personaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>캐릭터 ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="unique_id" disabled={isEditing} />
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
                      <Input {...field} placeholder="캐릭터 이름" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="avatarEmoji"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>아바타 이모지</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="🤖" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="primaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>기본 색상</FormLabel>
                    <FormControl>
                      <Input {...field} type="color" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="secondaryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>보조 색상</FormLabel>
                    <FormControl>
                      <Input {...field} type="color" />
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
                    <Textarea {...field} placeholder="캐릭터 설명" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="welcomeMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>환영 메시지</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="사용자에게 처음 보여줄 메시지" rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="systemPrompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>시스템 프롬프트</FormLabel>
                  <FormControl>
                    <Textarea {...field} placeholder="AI에게 주어지는 시스템 프롬프트" rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="personality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>성격</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="친절한" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>말투</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="캐주얼" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="usageContext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>사용 맥락</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="일상 대화" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="timeOfDay"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>활성 시간대</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="시간대 선택" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="all">전체</SelectItem>
                      <SelectItem value="morning">아침</SelectItem>
                      <SelectItem value="afternoon">오후</SelectItem>
                      <SelectItem value="evening">저녁</SelectItem>
                      <SelectItem value="night">밤</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <Label>감정 키워드</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={emotionalKeyword}
                  onChange={(e) => setEmotionalKeyword(e.target.value)}
                  placeholder="키워드 입력"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addEmotionalKeyword();
                    }
                  }}
                />
                <Button type="button" onClick={addEmotionalKeyword} size="icon">
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {(form.watch("emotionalKeywords") || []).map((keyword, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {keyword}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeEmotionalKeyword(index)} 
                    />
                  </Badge>
                ))}
              </div>
            </div>

            {categories.length > 0 && (
              <FormField
                control={form.control}
                name="categories"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>카테고리</FormLabel>
                    <div className="flex flex-wrap gap-2">
                      {categories.map((category) => (
                        <div key={category.categoryId} className="flex items-center space-x-2">
                          <Checkbox
                            id={`category-${category.categoryId}`}
                            checked={field.value?.includes(category.categoryId)}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, category.categoryId]);
                              } else {
                                field.onChange(current.filter((c) => c !== category.categoryId));
                              }
                            }}
                          />
                          <Label htmlFor={`category-${category.categoryId}`}>
                            {category.emoji} {category.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="flex items-center space-x-6">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">활성화</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isFeatured"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">추천</FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2">
                    <FormLabel className="!mt-0">순서</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        className="w-20"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                취소
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "수정" : "생성"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
