import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Loader2, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    setLocation(`${generationPageUrl}?style=${conceptId}`);
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* 헤더 스켈레톤 */}
          <div className="text-center mb-12">
            <Skeleton className="h-10 w-64 mx-auto mb-4" />
            <Skeleton className="h-6 w-96 mx-auto" />
          </div>

          {/* 그리드 스켈레톤 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="aspect-square w-full" />
                <CardContent className="p-4">
                  <Skeleton className="h-5 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 mb-4">
            <Loader2 className="w-12 h-12 mx-auto animate-spin" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            컨셉을 불러오는데 실패했습니다
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            {error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다"}
          </p>
        </div>
      </div>
    );
  }

  // 데이터가 없는 경우
  if (!concepts || concepts.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center p-8">
          <Sparkles className="w-16 h-16 mx-auto text-purple-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            아직 스타일이 없습니다
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            곧 다양한 스타일이 추가될 예정입니다
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* 헤더 섹션 */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Sparkles className="w-8 h-8 text-purple-500" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              {pageTitle}
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            {description}
          </p>
        </div>

        {/* 컨셉 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {concepts.map((concept) => (
            <Card
              key={concept.id}
              onClick={() => handleConceptClick(concept.conceptId)}
              className={cn(
                "group cursor-pointer overflow-hidden transition-all duration-300",
                "hover:scale-105 hover:shadow-xl hover:shadow-purple-100 dark:hover:shadow-purple-900/20",
                "border-2 border-transparent hover:border-purple-300 dark:hover:border-purple-600"
              )}
            >
              {/* 썸네일 이미지 */}
              <div className="relative aspect-square overflow-hidden bg-gray-100 dark:bg-gray-800">
                {concept.thumbnailUrl ? (
                  <img
                    src={concept.thumbnailUrl}
                    alt={concept.title}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Sparkles className="w-12 h-12 text-gray-400 dark:text-gray-600" />
                  </div>
                )}
                
                {/* 병원 전용 배지 */}
                {concept.visibilityType === "hospital" && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium shadow-lg">
                    전용
                  </div>
                )}

                {/* 호버 오버레이 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>

              {/* 컨셉 정보 */}
              <CardContent className="p-4">
                <h3 className="font-semibold text-center text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-2">
                  {concept.title}
                </h3>
                {concept.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 line-clamp-1">
                    {concept.description}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 총 개수 표시 */}
        <div className="text-center mt-8 text-sm text-gray-500 dark:text-gray-400">
          총 {concepts.length}개의 스타일
        </div>
      </div>
    </div>
  );
}
