import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Camera, Loader2, Download, History, X, ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useToast } from "@/hooks/use-toast";
import { SNAPSHOT_MODES, SNAPSHOT_STYLES, SNAPSHOT_GENDERS } from "@/constants/snapshot";

const snapshotFormSchema = z.object({
  mode: z.enum(['individual', 'couple', 'family'], {
    required_error: "모드를 선택해주세요"
  }),
  style: z.enum(['mix', 'daily', 'travel', 'film'], {
    required_error: "스타일을 선택해주세요"
  }),
  gender: z.enum(['female', 'male', 'unisex']).optional(),
  files: z.array(z.instanceof(File)).min(1, "최소 1개 이상 업로드").max(4, "최대 4개까지 업로드")
});

type SnapshotFormData = z.infer<typeof snapshotFormSchema>;

interface GeneratedImage {
  id: number;
  imageUrl: string;
  thumbnailUrl?: string;
}

export default function SnapshotPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [results, setResults] = useState<GeneratedImage[]>([]);

  const form = useForm<SnapshotFormData>({
    resolver: zodResolver(snapshotFormSchema),
    defaultValues: {
      mode: undefined,
      style: undefined,
      gender: undefined,
      files: []
    }
  });

  // 컴포넌트 마운트 시 스크롤 최상단으로 이동
  useEffect(() => {
    const scrollToTop = () => {
      const scrollContainers = document.querySelectorAll('.overflow-y-auto');
      scrollContainers.forEach(container => {
        container.scrollTop = 0;
      });
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    };
    scrollToTop();
    setTimeout(scrollToTop, 0);
    setTimeout(scrollToTop, 100);
  }, []);

  const generateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await fetch('/api/snapshot/generate', {
        method: 'POST',
        credentials: 'include',
        body: data,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: '생성 실패' }));
        throw new Error(errorData.message || '생성 실패');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setResults(data.images || []);
      toast({
        title: "생성 완료!",
        description: `${data.images?.length || 0}개의 스냅샷이 생성되었습니다.`
      });
      queryClient.invalidateQueries({ queryKey: ['/api/snapshot/history'] });
    },
    onError: (error: Error) => {
      toast({
        title: "생성 실패",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // 파일 개수 검증
    if (files.length > 4) {
      toast({
        title: "업로드 제한",
        description: "최대 4개까지 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    // 파일 타입 검증
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast({
        title: "파일 형식 오류",
        description: "JPG, PNG, WEBP 파일만 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    setSelectedFiles(files);
    form.setValue('files', files, { shouldValidate: true });

    // 미리보기 URL 생성
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);

    // 이전 미리보기 URL 정리
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    const newUrls = previewUrls.filter((_, i) => i !== index);
    
    URL.revokeObjectURL(previewUrls[index]);
    
    setSelectedFiles(newFiles);
    setPreviewUrls(newUrls);
    form.setValue('files', newFiles, { shouldValidate: true });
  };

  const onSubmit = (data: SnapshotFormData) => {
    const formData = new FormData();
    formData.append('mode', data.mode);
    formData.append('style', data.style);
    if (data.gender) {
      formData.append('gender', data.gender);
    }
    
    data.files.forEach((file, index) => {
      formData.append('images', file);
    });

    generateMutation.mutate(formData);
  };

  const downloadImage = async (url: string, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `snapshot-${Date.now()}-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: "다운로드 완료",
        description: "이미지가 다운로드되었습니다."
      });
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드에 실패했습니다.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-6 pb-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Camera className="h-8 w-8 text-primary" />
            AI 스냅샷
          </h1>
          <p className="text-muted-foreground">
            나만의 스냅샷을 AI로 생성해보세요
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/snapshot/history">
            <History className="h-4 w-4 mr-2" />
            히스토리
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 생성 폼 */}
        <Card>
          <CardHeader>
            <CardTitle>스냅샷 생성</CardTitle>
            <CardDescription>사진을 업로드하고 원하는 스타일을 선택하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* 파일 업로드 */}
                <FormField
                  control={form.control}
                  name="files"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>사진 업로드 (1-4장)</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          <label htmlFor="file-upload" className="cursor-pointer">
                            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors">
                              <ImagePlus className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                              <p className="text-sm font-medium mb-1">
                                클릭하여 사진 업로드
                              </p>
                              <p className="text-xs text-muted-foreground">
                                JPG, PNG, WEBP (최대 4장)
                              </p>
                            </div>
                          </label>
                          <input
                            id="file-upload"
                            type="file"
                            multiple
                            accept="image/jpeg,image/jpg,image/png,image/webp"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          
                          {/* 미리보기 */}
                          {previewUrls.length > 0 && (
                            <div className="grid grid-cols-2 gap-4">
                              {previewUrls.map((url, index) => (
                                <div key={index} className="relative group">
                                  <AspectRatio ratio={1}>
                                    <img
                                      src={url}
                                      alt={`Preview ${index + 1}`}
                                      className="rounded-lg object-cover w-full h-full"
                                    />
                                  </AspectRatio>
                                  <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => removeFile(index)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                  <Badge className="absolute bottom-2 left-2">
                                    {index + 1}
                                  </Badge>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 모드 선택 */}
                <FormField
                  control={form.control}
                  name="mode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>모드 선택</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid grid-cols-3 gap-2"
                        >
                          {SNAPSHOT_MODES.map((mode) => (
                            <ToggleGroupItem
                              key={mode.value}
                              value={mode.value}
                              className="flex flex-col items-center justify-center h-20 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                            >
                              <span className="font-semibold">{mode.label}</span>
                              <span className="text-xs opacity-80">{mode.description}</span>
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 스타일 선택 */}
                <FormField
                  control={form.control}
                  name="style"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>스타일 선택</FormLabel>
                      <FormControl>
                        <ToggleGroup
                          type="single"
                          value={field.value}
                          onValueChange={field.onChange}
                          className="grid grid-cols-2 gap-2"
                        >
                          {SNAPSHOT_STYLES.map((style) => (
                            <ToggleGroupItem
                              key={style.value}
                              value={style.value}
                              className="flex flex-col items-center justify-center h-20 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                            >
                              <span className="font-semibold">{style.label}</span>
                              <span className="text-xs opacity-80">{style.description}</span>
                            </ToggleGroupItem>
                          ))}
                        </ToggleGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 젠더 선택 (옵션) */}
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>젠더 (선택사항)</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="젠더 선택 (선택사항)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {SNAPSHOT_GENDERS.map((gender) => (
                            <SelectItem key={gender.value} value={gender.value}>
                              {gender.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        선택하지 않으면 자동으로 감지됩니다
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 생성 버튼 */}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={generateMutation.isPending}
                  size="lg"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 mr-2" />
                      스냅샷 생성
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* 결과 표시 */}
        <Card>
          <CardHeader>
            <CardTitle>생성 결과</CardTitle>
            <CardDescription>
              {results.length > 0
                ? `${results.length}개의 스냅샷이 생성되었습니다`
                : '생성된 스냅샷이 여기에 표시됩니다'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground">
                  스냅샷을 생성하면 여기에 결과가 표시됩니다
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {results.map((result, index) => (
                  <div key={result.id || index} className="relative group">
                    <AspectRatio ratio={16 / 9}>
                      <img
                        src={result.thumbnailUrl || result.imageUrl}
                        alt={`Generated ${index + 1}`}
                        className="rounded-lg object-cover w-full h-full"
                      />
                    </AspectRatio>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => downloadImage(result.imageUrl, index)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        다운로드
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
