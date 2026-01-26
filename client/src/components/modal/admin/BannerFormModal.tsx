import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const bannerFormSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  description: z.string().min(1, "설명을 입력해주세요"),
  imageSrc: z.string().min(1, "이미지 URL을 입력해주세요"),
  href: z.string().min(1, "링크 URL을 입력해주세요"),
  isNew: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  slideInterval: z.coerce.number().int().min(1000).max(30000).default(5000),
  transitionEffect: z.enum(["fade", "slide", "zoom", "cube", "flip"]).default("fade"),
});

type BannerFormValues = z.infer<typeof bannerFormSchema>;

interface Banner {
  id: number;
  title: string;
  description: string;
  imageSrc: string;
  href: string;
  isNew?: boolean;
  isActive: boolean;
  sortOrder: number;
  slideInterval: number;
  transitionEffect: string;
}

interface BannerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  banner?: Banner | null;
  onSubmit: (values: BannerFormValues) => void;
  isPending?: boolean;
}

const defaultValues: Partial<BannerFormValues> = {
  title: "",
  description: "",
  imageSrc: "",
  href: "",
  isNew: false,
  isActive: true,
  sortOrder: 0,
  slideInterval: 5000,
  transitionEffect: "fade",
};

export function BannerFormModal({ isOpen, onClose, mode, banner, onSubmit, isPending }: BannerFormModalProps) {
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<BannerFormValues>({
    resolver: zodResolver(bannerFormSchema),
    defaultValues: mode === 'edit' && banner ? {
      title: banner.title,
      description: banner.description,
      imageSrc: banner.imageSrc,
      href: banner.href,
      isNew: banner.isNew || false,
      isActive: banner.isActive,
      sortOrder: banner.sortOrder,
      slideInterval: banner.slideInterval || 5000,
      transitionEffect: (banner.transitionEffect as "fade" | "slide" | "zoom" | "cube" | "flip") || "fade",
    } : defaultValues,
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
      
      const formData = new FormData();
      formData.append('banner', file);
      formData.append('bannerType', 'slide');
      
      const response = await fetch('/api/admin/upload/banner', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('이미지 업로드에 실패했습니다');
      }
      
      const data = await response.json();
      const imageUrl = data.url || data.imageSrc;
      form.setValue('imageSrc', imageUrl);
      
      toast({
        title: "이미지 업로드 성공",
        description: "이미지가 성공적으로 업로드되었습니다",
      });
    } catch (error) {
      toast({
        title: "이미지 업로드 실패",
        description: error instanceof Error ? error.message : "이미지 업로드 중 오류가 발생했습니다",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    form.setValue('imageSrc', '');
  };

  const handleSubmit = (values: BannerFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '배너 수정' : '새 배너 추가'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? '배너 정보를 수정합니다.' : '홈페이지에 표시될 새로운 배너를 추가합니다.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>제목</FormLabel>
                  <FormControl>
                    <Input placeholder="배너 제목" {...field} />
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
                    <Textarea placeholder="배너 설명" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageSrc"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이미지</FormLabel>
                  <Tabs defaultValue="url" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="url">URL 입력</TabsTrigger>
                      <TabsTrigger value="upload">파일 업로드</TabsTrigger>
                    </TabsList>
                    <TabsContent value="url" className="pt-2">
                      <FormControl>
                        <Input placeholder="https://example.com/image.jpg" {...field} />
                      </FormControl>
                      <FormDescription>외부 이미지 URL을 입력하세요</FormDescription>
                    </TabsContent>
                    <TabsContent value="upload" className="pt-2">
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-center h-32 border border-dashed border-neutral-600 rounded-md overflow-hidden relative">
                          <input 
                            type="file" 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                            onChange={handleImageUpload}
                            accept="image/*"
                            ref={fileInputRef}
                          />
                          <div className="flex flex-col items-center justify-center text-center p-4">
                            <Upload className="h-6 w-6 mb-2 text-neutral-400" />
                            <p className="text-sm text-neutral-400">
                              {selectedImage ? '다른 이미지 선택하기' : '이미지 파일을 업로드하세요'}
                            </p>
                          </div>
                        </div>
                        {selectedImage && (
                          <div className="relative w-full h-32 mt-2 rounded-md overflow-hidden">
                            <img src={selectedImage} alt="미리보기" className="w-full h-full object-cover" />
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={handleClearImage}
                              className="absolute top-1 right-1 w-6 h-6 p-0 rounded-full"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {isUploading && (
                          <div className="flex items-center justify-center mt-2">
                            <span className="text-sm text-neutral-300">업로드 중...</span>
                          </div>
                        )}
                      </div>
                    </TabsContent>
                  </Tabs>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="href"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>링크 URL</FormLabel>
                  <FormControl>
                    <Input placeholder="/page-url 또는 https://..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="isNew"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>NEW 표시</FormLabel>
                      <FormDescription>배너에 NEW 배지를 표시합니다</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <FormLabel>활성화</FormLabel>
                      <FormDescription>배너 표시 여부</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sortOrder"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>정렬 순서</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormDescription>낮은 숫자가 먼저 표시됩니다</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slideInterval"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>슬라이드 시간</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="5000" {...field} onChange={(e) => field.onChange(Number(e.target.value))} />
                    </FormControl>
                    <FormDescription>밀리초 단위 (5000 = 5초)</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="transitionEffect"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>전환 효과</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="전환 효과를 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="fade">페이드 (Fade)</SelectItem>
                      <SelectItem value="slide">슬라이드 (Slide)</SelectItem>
                      <SelectItem value="zoom">줌 (Zoom)</SelectItem>
                      <SelectItem value="cube">큐브 (Cube)</SelectItem>
                      <SelectItem value="flip">플립 (Flip)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>이미지 전환 시 사용할 애니메이션 효과</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>취소</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "저장 중..." : "저장하기"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
