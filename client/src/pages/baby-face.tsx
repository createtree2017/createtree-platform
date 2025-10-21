import { useEffect } from "react";
import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";

export default function BabyFacePage() {
  useEffect(() => {
    // 즉시 스크롤 + 약간의 지연 후 다시 스크롤 (확실성 보장)
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 0);
  }, []);

  return (
    <ImageGenerationTemplate
      categoryId="baby_face_img"
      pageTitle="아기얼굴생성"
      apiEndpoint="/api/generate-image"
      variableFields={true}
      galleryTitle="아기얼굴 갤러리"
      defaultAspectRatio="1:1"
    />
  );
}