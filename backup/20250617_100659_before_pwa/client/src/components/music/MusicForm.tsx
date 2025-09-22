import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMusicGenerationStore } from "@/stores/musicGenerationStore";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Music, MusicIcon, Settings } from "lucide-react";

// 통합 음악 엔진 폼 검증 스키마
const musicFormSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  prompt: z.string().min(3, "최소 3글자 이상의 내용을 입력해주세요"),
  style: z.string().min(1, "음악 스타일을 선택해주세요"),
  gender: z.string().min(1, "성별을 선택해주세요"),
  duration: z.number().optional().default(180),
  instrumental: z.boolean().default(false),
  generateLyrics: z.boolean().default(true),
  preferredEngine: z.enum(["topmedia"]).default("topmedia")
});

type MusicFormValues = z.infer<typeof musicFormSchema>;

interface MusicFormProps {
  onMusicGenerated?: (music: any) => void;
}

export default function MusicForm({ onMusicGenerated }: MusicFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAdvancedMode, setIsAdvancedMode] = useState(false);
  const { setGenerating, isGenerating } = useMusicGenerationStore();
  const [generatingMusicId, setGeneratingMusicId] = useState<number | null>(null);
  
  // 음악 목록 쿼리 - 생성 완료 감지용
  const { data: musicListResponse } = useQuery({
    queryKey: ["/api/music-engine/list"],
    refetchInterval: isGenerating ? 5000 : false, // 생성 중일 때만 5초마다 체크
  });

  // 음악 생성 완료 감지
  useEffect(() => {
    if (generatingMusicId && (musicListResponse as any)?.data) {
      const completedMusic = (musicListResponse as any).data.find((music: any) => 
        music.id === generatingMusicId && music.status === 'completed' && music.url
      );
      
      if (completedMusic) {
        console.log('🎵 음악 생성 완료 감지:', completedMusic.id);
        setGenerating(false);
        setGeneratingMusicId(null);
        
        toast({
          title: "음악 생성 완료",
          description: `"${completedMusic.title}" 음악이 생성되었습니다!`,
        });
      }
    }
  }, [musicListResponse, generatingMusicId, setGenerating, toast]);

  // 안전장치: 3분 후 강제 상태 제거
  useEffect(() => {
    if (generatingMusicId) {
      const timer = setTimeout(() => {
        setGenerating(false);
        setGeneratingMusicId(null);
        console.log('🎵 음악 생성 상태 강제 제거 (3분 타임아웃)');
      }, 180000); // 3분 후 강제 상태 제거

      return () => clearTimeout(timer);
    }
  }, [generatingMusicId, setGenerating]);
  
  // 통합 음악 엔진 스타일 데이터 가져오기
  const { data: musicStylesResponse } = useQuery({
    queryKey: ["/api/music-engine/styles"],
  });
  
  // 음악 스타일 데이터 처리
  const musicStyles = (musicStylesResponse as any)?.data || [];

  // 폼 설정
  const form = useForm<MusicFormValues>({
    resolver: zodResolver(musicFormSchema),
    defaultValues: {
      title: "",
      prompt: "",
      style: musicStyles[0]?.styleId || "lullaby",
      gender: "auto",
      duration: 180,
      instrumental: false,
      generateLyrics: true,
      preferredEngine: "topmedia"
    }
  });

  // 통합 음악 엔진 생성 뮤테이션
  const createMusicMutation = useMutation({
    mutationFn: async (values: MusicFormValues) => {
      // 사용자 ID를 포함한 요청 데이터 구성
      const requestData = {
        ...values,
        userId: user?.id?.toString() || "10" // 기본값으로 현재 사용자 ID 사용
      };
      
      console.log('🎵 API 요청 데이터:', requestData);
      
      const res = await apiRequest("/api/music-engine/generate", {
        method: "POST",
        data: requestData
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "음악 생성에 실패했습니다.");
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      console.log("통합 음악 엔진 응답:", data);
      
      try {
        // 음악 생성 완료 즉시 목록 새로고침
        queryClient.invalidateQueries({ queryKey: ["/api/music-engine/list"] });
        
        if (data.success && data.data?.musicId) {
          // 음악 생성 상태 추적 시작
          const formValues = form.getValues();
          setGeneratingMusicId(data.data.musicId); // 생성 중인 음악 ID 추적
          
          // 음악 생성 시작 성공
          const engineName = 'TopMediai';
          const fallbackMessage = data.data.fallbackUsed ? ' (대체 엔진 사용)' : '';
          
          toast({
            title: "음악 생성 시작",
            description: `${engineName}를 사용하여 음악 생성이 시작되었습니다${fallbackMessage}. 완료될 때까지 기다려주세요.`,
          });
          
          // 생성 중인 음악을 즉시 플레이어로 전달
          if (onMusicGenerated) {
            const generatingMusic = {
              id: data.data.musicId,
              title: form.getValues("title") || "생성 중...",
              status: "generating",
              engine: data.data.engine,
              url: null,
              lyrics: null
            };
            onMusicGenerated(generatingMusic);
          }
          
          // 폼 리셋
          form.reset();
          
          // 음악 생성 요청 성공 - 2초 후 버튼 상태 해제하여 즉시 반응성 확보
          setTimeout(() => {
            setGenerating(false);
            console.log('🎵 음악 생성 요청 완료 - 버튼 상태 해제');
          }, 2000);
        } else {
          // 실패시 상태 제거
          setGenerating(false);
          toast({
            title: "음악 생성 실패",
            description: data.error || "음악 생성에 실패했습니다.",
            variant: "destructive"
          });
        }
      } catch (unexpectedError) {
        console.error('🎵 예상치 못한 오류:', unexpectedError);
        setGenerating(false);
      }
    },
    onError: (error: Error) => {
      console.error("음악 생성 오류:", error);
      toast({
        title: "음악 생성 오류",
        description: error.message || "음악 생성 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      setGenerating(false); // 에러 시 상태 제거
    },
    onSettled: () => {
      // 성공/실패와 관계없이 항상 실행되어 상태 정리
      console.log('🎵 MusicForm - onSettled 호출, 상태 해제');
      // 즉시 상태 해제 (요청 완료)
      setTimeout(() => {
        setGenerating(false);
        console.log('🎵 MusicForm - 상태 강제 해제 완료');
      }, 100);
    }
  });

  // 폼 제출 핸들러 - 중복 요청 방지
  const onSubmit = (values: MusicFormValues) => {
    console.log('🎵 폼 제출 시작 - 입력값:', values);
    console.log('🎵 뮤테이션 상태:', { isPending: createMusicMutation.isPending });
    
    // 이미 생성 중인 경우 중복 요청 방지
    if (createMusicMutation.isPending) {
      console.log('⚠️ 이미 생성 중 - 중복 요청 차단');
      toast({
        title: "음악 생성 중",
        description: "음악이 이미 생성 중입니다. 잠시만 기다려주세요.",
        variant: "destructive"
      });
      return;
    }
    
    // 음악 생성 상태 설정
    console.log('🎵 MusicForm - setGenerating(true) 호출 전');
    setGenerating(true);
    console.log('🎵 MusicForm - setGenerating(true) 호출 후');
    
    // 강제 UI 업데이트를 위한 추가 시도
    setTimeout(() => {
      setGenerating(true);
      console.log('🎵 강제 재설정 완료');
    }, 100);
    
    console.log('✅ 통합 음악 엔진 생성 요청 전송:', values);
    createMusicMutation.mutate(values);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MusicIcon className="h-6 w-6" />
          통합 음악 생성기
        </CardTitle>
        <CardDescription>
          Suno AI와 TopMediai를 통합한 고품질 음악 생성 시스템입니다.
        </CardDescription>
        <div className="flex items-center justify-between mt-2">
          <div className="text-sm text-muted-foreground">
            기본: Suno AI → 실패 시 TopMediai 자동 전환
          </div>
          <div className="flex items-center space-x-2">
            <Settings className="h-4 w-4" />
            <Label htmlFor="advanced-mode" className="text-sm">고급 설정</Label>
            <Switch
              id="advanced-mode"
              checked={isAdvancedMode}
              onCheckedChange={setIsAdvancedMode}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
            console.error('🚨 폼 검증 오류:', errors);
            toast({
              title: "입력 오류",
              description: "필수 입력 항목을 확인해주세요.",
              variant: "destructive"
            });
          })} className="space-y-4">
            {/* 제목 */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>제목</FormLabel>
                  <FormControl>
                    <Input placeholder="음악 제목을 입력하세요" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 프롬프트 */}
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>음악 설명</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="어떤 음악을 만들고 싶은지 자세히 설명해주세요..."
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    예: "태교를 위한 부드러운 자장가", "아기가 잠들 수 있는 평화로운 음악"
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 스타일 프롬프트 */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">스타일 프롬프트</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Cheerful', 'Sad', 'Passionate', 'Calm', 'Excited', 'Warm', 
                  'Serene', 'Vulnerable', 'Bewildered', 'Confident', 'Simple',
                  'Piano', 'Guitar', 'Jazz', 'Classical', 'Folk', 'Lullaby',
                  'Orchestral', 'Bright', 'Soft', 'Energetic', 'Peaceful'
                ].map((style) => (
                  <button 
                    key={style}
                    type="button" 
                    onClick={() => {
                      const currentPrompt = form.getValues('prompt') || '';
                      const newPrompt = currentPrompt ? `${currentPrompt}, ${style}` : style;
                      form.setValue('prompt', newPrompt);
                    }}
                    className="px-3 py-1 text-sm bg-muted text-muted-foreground rounded-full hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    {style}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">클릭하여 음악 설명란에 스타일 키워드를 추가할 수 있습니다</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 성별 */}
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>성별</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="성별을 선택하세요" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="male">남성</SelectItem>
                        <SelectItem value="female">여성</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>



            {isAdvancedMode && (
              <div className="space-y-4 border-t pt-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  고급 설정
                </h4>
                
                {/* 음악 길이 */}
                <FormField
                  control={form.control}
                  name="duration"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>음악 길이 (초)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="30" 
                          max="300" 
                          placeholder="180"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 180)}
                        />
                      </FormControl>
                      <FormDescription>
                        30초 ~ 300초 (5분)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* 반주만 생성 옵션 */}
                <FormField
                  control={form.control}
                  name="instrumental"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>반주만 생성 (보컬 없음)</FormLabel>
                        <FormDescription>
                          체크 시 가사 없이 반주만 생성됩니다
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}

            <CardFooter className="px-0 pt-4">
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isGenerating || createMusicMutation.isPending}
              >
                {(isGenerating || createMusicMutation.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    🎵 음악 생성 중...
                  </>
                ) : (
                  <>
                    <Music className="mr-2 h-4 w-4" />
                    🎵 음악 생성하기
                  </>
                )}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}