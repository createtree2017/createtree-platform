import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";
import { useQuery } from "@tanstack/react-query";
import { Concept } from "@shared/schema";

export default function StickersPage() {

  // 스티커는 특별한 필터링 규칙이 있음 (diz, sticker 컨셉 포함)
  const stickerStyleFilter = (style: Concept) => {
    return style.categoryId === "sticker_img" ||
           style.conceptId === "diz" ||
           style.conceptId === "sticker";
  };

  // 컨셉 데이터 가져오기
  const { data: concepts, isLoading: isConceptsLoading, error: conceptsError } = useQuery({
    queryKey: ["/api/concepts"],
    queryFn: async () => {
      const response = await fetch("/api/concepts");
      if (!response.ok) {
        throw new Error("컨셉을 불러오는데 실패했습니다");
      }
      const data = await response.json();
      // 클라이언트 측에서도 활성화된 컨셉만 필터링 (안전장치)
      return data.filter((concept: Concept) => concept.isActive !== false);
    },
  });

  return (
    <ImageGenerationTemplate
      categoryId="sticker_img"
      pageTitle="스티커 만들기"
      apiEndpoint="/api/generate-stickers"
      customStyleFilter={stickerStyleFilter}
      variableFields={true}
      galleryTitle="스티커 갤러리"
      concepts={concepts} // 필터링된 컨셉 전달
      isConceptsLoading={isConceptsLoading}
      conceptsError={conceptsError}
    />
  );
}