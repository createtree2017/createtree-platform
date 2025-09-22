import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Music, Filter, RefreshCw, AlertTriangle, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ModernMusicPlayer from "./ModernMusicPlayer";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/ui/pagination";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { useMusicGenerationStore } from "@/stores/musicGenerationStore";

type Music = {
  id: number;
  title: string;
  prompt: string;
  translatedPrompt?: string;
  tags: string[];
  url: string;
  instrumental: boolean;
  lyrics?: string;
  userId: number;
  duration: number;
  createdAt: string;
};

interface MusicGalleryProps {
  limit?: number;
  userId?: number;
  showFilters?: boolean;
  onMusicSelect?: (music: Music) => void;
  className?: string;
}

export default function MusicGallery({
  limit = 10,
  userId,
  showFilters = true,
  onMusicSelect,
  className = "",
}: MusicGalleryProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [selectedMusic, setSelectedMusic] = useState<Music | null>(null);
  // 상태 관리 제거됨
  
  // 통합 음악 엔진 스타일 데이터 가져오기
  const { data: musicStylesResponse } = useQuery({
    queryKey: ["/api/music-engine/styles"],
  });
  
  // 음악 스타일 데이터 처리
  const musicStyles = (musicStylesResponse as any)?.data || [];
  
  // 음악 목록 가져오기
  const { 
    data: serverMusicData, 
    isLoading: isServerLoading, 
    isError: isServerError, 
    error: serverError,
    refetch
  } = useQuery({
    queryKey: ["/api/music-engine/list", page, limit, activeTab, selectedStyle, userId],
    enabled: true,
    queryFn: async () => {
      // 쿼리 파라미터 구성
      const params = new URLSearchParams();
      params.append("page", page.toString());
      params.append("limit", limit.toString());
      
      if (activeTab === "instrumental") {
        params.append("instrumental", "true");
      } else if (activeTab === "vocal") {
        params.append("instrumental", "false");
      }
      
      if (selectedStyle) {
        params.append("style", selectedStyle);
      }
      
      if (userId) {
        params.append("userId", userId.toString());
      }
      
      console.log(`음악 목록 요청: /api/music-engine/list?${params.toString()}`);
      
      try {
        const res = await apiRequest(`/api/music-engine/list`, {
          params: Object.fromEntries(params.entries())
        });
        
        // Content-Type 헤더 확인
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          console.error(`음악 API가 JSON이 아닌 응답을 반환했습니다:`, contentType);
          throw new Error('서버가 유효하지 않은 응답 형식을 반환했습니다');
        }
        
        const response = await res.json();
        console.log('음악 API 응답 데이터:', response);
        
        // 통합 음악 엔진 API 응답 구조에 맞게 데이터 변환
        if (!response || !response.success || !response.data) {
          return { music: [], meta: { page: 1, totalPages: 0, totalItems: 0 } };
        }
        
        // API 응답을 MusicGallery 컴포넌트가 기대하는 형태로 변환
        return {
          music: response.data,
          meta: response.meta || { 
            page: page, 
            totalPages: Math.ceil((response.totalItems || response.data.length) / limit), 
            totalItems: response.totalItems || response.data.length 
          }
        };
      } catch (error) {
        console.error("통합 음악 목록 요청 오류:", error);
        throw error; // 오류를 상위로 전파하여 UI에 표시
      }
    }
  });
  
  // 음악 생성 상태 관리 기능 제거됨
  
  // 음악 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: async (musicId: number) => {
      const response = await apiRequest(`/api/music-engine/delete/${musicId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '음악 삭제에 실패했습니다');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "삭제 완료",
        description: "음악이 성공적으로 삭제되었습니다.",
      });
      
      // 음악 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ["/api/music-engine/list"] });
    },
    onError: (error: Error) => {
      toast({
        title: "삭제 실패",
        description: error.message || "음악 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  });
  
  // 서버 데이터 사용 - 더 엄격한 타입 체크와 기본값 적용
  const musicData = 
    serverMusicData && 
    typeof serverMusicData === 'object' && 
    Array.isArray(serverMusicData.music) ? 
    serverMusicData : 
    { 
      music: [], 
      meta: { 
        page: 1, 
        totalPages: 0, 
        totalItems: 0,
        itemsPerPage: limit
      } 
    };
  
  // 서버에서 데이터를 가져오는 중인지 여부
  const isLoading = isServerLoading;
  const isError = isServerError;
  const error = serverError;
  
  const handleRetry = () => {
    refetch();
  };
  
  const handleMusicClick = (music: Music) => {
    setSelectedMusic(music);
    if (onMusicSelect) {
      onMusicSelect(music);
    }
  };


  
  const handleAddToFavorites = (id: number) => {
    toast({
      title: "즐겨찾기에 추가됨",
      description: "선택한 음악이 즐겨찾기에 추가되었습니다.",
    });
  };
  
  const handleDelete = (musicId: number) => {
    if (window.confirm('정말로 이 음악을 삭제하시겠습니까?')) {
      deleteMutation.mutate(musicId);
    }
  };

  const handleShare = async (id: number) => {
    try {
      // 공유 API 호출
      const response = await apiRequest('/api/music/share', {
        method: 'POST',
        data: { musicId: id }
      });
      
      if (!response.ok) {
        throw new Error("음악 공유 설정 실패");
      }
      
      // 성공적으로 공유 상태로 설정됨
      const shareUrl = `${window.location.origin}/shared/music/${id}`;
      
      // Web Share API 지원 확인
      if (navigator.share) {
        navigator.share({
          title: "음악 공유",
          text: "창조트리 AI가 생성한 음악을 들어보세요!",
          url: shareUrl,
        }).catch(error => {
          console.error("공유 실패:", error);
        });
      } else {
        // 공유 API를 지원하지 않는 브라우저의 경우 클립보드에 복사
        navigator.clipboard.writeText(shareUrl).then(() => {
          toast({
            title: "링크가 복사되었습니다",
            description: "공유 링크가 클립보드에 복사되었습니다.",
          });
        }).catch(err => {
          console.error("클립보드 복사 실패:", err);
        });
      }
    } catch (error) {
      console.error("공유 기능 오류:", error);
      toast({
        title: "공유 실패",
        description: "음악을 공유할 수 없습니다. 다시 시도해주세요.",
        variant: "destructive"
      });
    }
  };
  
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };
  
  // 에러 표시
  if (isError) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>음악 목록을 불러오는데 실패했습니다</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "서버에 접속할 수 없습니다. 잠시 후 다시 시도해주세요."}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRetry} 
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  
  // 필터 및 탭 UI 렌더링
  const renderFilters = () => {
    if (!showFilters) return null;
    
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full sm:w-auto"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">전체</TabsTrigger>
            <TabsTrigger value="vocal">가사 있음</TabsTrigger>
            <TabsTrigger value="instrumental">반주만</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="flex items-center gap-2">
          <p className="text-sm whitespace-nowrap">스타일 필터:</p>
          <select 
            className="w-[180px] h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none"
            value={selectedStyle || ""}
            onChange={(e) => setSelectedStyle(e.target.value)}
          >
            <option value="">전체</option>
            {Array.isArray(musicStyles) && musicStyles.map((style) => (
              <option key={style.style_id} value={style.style_id}>
                {style.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    );
  };
  
  // 로딩 UI 렌더링
  const renderLoading = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array(limit).fill(0).map((_, i) => (
          <Card key={i} className="overflow-hidden">
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2 mt-2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full rounded-md" />
            </CardContent>
            <CardFooter>
              <Skeleton className="h-10 w-full" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  };
  
  // 현재 선택된 음악 렌더링
  const renderSelectedMusic = () => {
    if (!selectedMusic) return null;
    
    return (
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">현재 재생 중</h2>
        <ModernMusicPlayer
          music={selectedMusic}
          onAddToFavorites={handleAddToFavorites}
          onShare={handleShare}
          autoPlay
        />
      </div>
    );
  };
  
  // 음악 목록 렌더링
  const renderMusicList = () => {
    if (isLoading) {
      return renderLoading();
    }
    
    if (!musicData?.music || musicData.music.length === 0) {
      return (
        <div className="text-center p-8 bg-muted rounded-lg">
          <Music className="h-16 w-16 mx-auto text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium">음악이 없습니다</h3>
          <p className="text-muted-foreground mt-2">
            아직 생성된 음악이 없습니다. 음악을 생성해보세요!
          </p>
        </div>
      );
    }
    
    // 서버에서 중복 제거된 데이터를 받으므로 추가 필터링 불필요
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {musicData.music.map((music: Music) => (
            <Card 
              key={music.id} 
              className={`overflow-hidden cursor-pointer transition-all hover:shadow-md ${selectedMusic?.id === music.id ? 'ring-2 ring-primary' : ''}`}
              onClick={() => handleMusicClick(music)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg flex items-center gap-2 flex-1">
                    <Music className="h-4 w-4" />
                    {music.title || "제목 없음"}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(music.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-md"
                    title="음악 삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {music.prompt}
                </p>
              </CardHeader>
              
              <CardContent className="pb-2">
                <div className="flex flex-wrap gap-2 mb-4">
                  {music.tags?.slice(0, 3).map((tag, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                  {music.tags?.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{music.tags.length - 3}
                    </Badge>
                  )}
                </div>
                
                <div className="bg-muted h-1 w-full rounded-full">
                  <div className="bg-primary h-1 rounded-full w-0 animate-pulse"></div>
                </div>
              </CardContent>
              
              <CardFooter>
                <Button 
                  variant="default" 
                  size="sm" 
                  className="w-full"
                >
                  <Music className="h-4 w-4 mr-2" />
                  재생하기
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
        
        {/* 페이지네이션 */}
        {musicData?.meta && musicData.meta.totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <Pagination
              currentPage={page}
              totalPages={musicData.meta.totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </>
    );
  };
  
  return (
    <div className={className}>
      {renderSelectedMusic()}
      
      {/* 헤더 섹션 - 제목과 새로고침 버튼 */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">내 음악목록</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>
      
      {renderFilters()}
      {renderMusicList()}
    </div>
  );
}