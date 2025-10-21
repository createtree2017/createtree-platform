import { useEffect } from "react";
import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";

export default function MaternityPhotoPage() {
  useEffect(() => {
    // 즉시 스크롤 + 약간의 지연 후 다시 스크롤 (확실성 보장)
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo({ top: 0, behavior: "auto" }), 0);
  }, []);

  return (
    <ImageGenerationTemplate
      categoryId="mansak_img"
      pageTitle="만삭사진 만들기"
      apiEndpoint="/api/generate-image"
      variableFields={true}
      galleryTitle="만삭사진 갤러리"
      defaultAspectRatio="1:1"
    />
  );
}