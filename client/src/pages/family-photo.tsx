import { useEffect } from "react";
import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";

export default function FamilyPhotoPage() {
  useEffect(() => {
    // 즉시 스크롤 + 약간의 지연 후 다시 스크롤 (확실성 보장)
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 0);
  }, []);

  return (
    <ImageGenerationTemplate
      categoryId="family_img"
      pageTitle="사진스타일 바꾸기"
      apiEndpoint="/api/generate-family"
      variableFields={true}
      galleryTitle="가족사진 갤러리"
    />
  );
}