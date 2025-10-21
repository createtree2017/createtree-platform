import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Concept } from "@shared/schema";

interface ConceptGalleryTemplateProps {
  categoryId: string;
  pageTitle: string;
  description: string;
  generationPageUrl: string;
}

export default function ConceptGalleryTemplate({
  categoryId,
  pageTitle,
  description,
  generationPageUrl,
}: ConceptGalleryTemplateProps) {
  const [, setLocation] = useLocation();

  // 컨셉 데이터 가져오기
  const { data: concepts, isLoading, error } = useQuery<Concept[]>({
    queryKey: ["/api/concepts", categoryId],
    queryFn: async () => {
      const response = await fetch("/api/concepts");
      if (!response.ok) {
        throw new Error("컨셉을 불러오는데 실패했습니다");
      }
      const data = await response.json();
      // 해당 카테고리의 활성화된 컨셉만 필터링
      return data.filter(
        (concept: Concept) =>
          concept.categoryId === categoryId && concept.isActive !== false
      );
    },
  });

  // 컨셉 클릭 핸들러
  const handleConceptClick = (conceptId: string) => {
    // 페이지 이동 (스크롤은 대상 페이지에서 처리)
    setLocation(`${generationPageUrl}?style=${conceptId}`);
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          {/* 헤더 스켈레톤 */}
          <div className="text-center mb-16">
            <Skeleton className="h-12 w-80 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>

          {/* 그리드 스켈레톤 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="relative aspect-square rounded-2xl overflow-hidden">
                <Skeleton className="w-full h-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 mb-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            컨셉을 불러오는데 실패했습니다
          </h2>
          <p className="text-muted-foreground">
            {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"}
          </p>
        </div>
      </div>
    );
  }

  // 데이터가 없는 경우
  if (!concepts || concepts.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center p-8">
          <Sparkles className="w-16 h-16 mx-auto text-purple-400 mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            아직 스타일이 없습니다
          </h2>
          <p className="text-muted-foreground">
            곧 다양한 스타일이 추가될 예정입니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* 헤더 섹션 */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Sparkles className="w-10 h-10 text-purple-500" />
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">
              {pageTitle}
            </h1>
          </div>
          <p className="text-muted-foreground text-lg md:text-xl">
            {description}
          </p>
        </div>

        {/* 컨셉 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {concepts.map((concept) => (
            <div
              key={concept.id}
              onClick={() => handleConceptClick(concept.conceptId)}
              className={cn(
                "group cursor-pointer relative aspect-square rounded-2xl overflow-hidden",
                "transition-all duration-300 ease-out",
                "hover:scale-105 hover:shadow-2xl"
              )}
            >
              {/* 썸네일 이미지 */}
              {concept.thumbnailUrl ? (
                <img
                  src={concept.thumbnailUrl}
                  alt={concept.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted">
                  <Sparkles className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
              
              {/* 병원 전용 배지 */}
              {concept.visibilityType === "hospital" && (
                <div className="absolute top-3 right-3 bg-green-500 text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-lg z-10">
                  전용
                </div>
              )}

              {/* 하단 텍스트 라벨 (항상 보이는 오버레이) */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent pt-12 pb-4 px-4">
                <h3 className="font-bold text-white text-center text-base md:text-lg line-clamp-2">
                  {concept.title}
                </h3>
              </div>

              {/* 호버 시 추가 정보 표시 */}
              {concept.description && (
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-6">
                  <p className="text-white text-sm text-center line-clamp-4">
                    {concept.description}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 총 개수 표시 */}
        <div className="text-center mt-12 text-sm text-muted-foreground">
          총 {concepts.length}개의 스타일
        </div>
      </div>
    </div>
  );
}
