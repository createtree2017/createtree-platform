import { useEffect } from "react";
import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";

export default function MaternityPhotoPage() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
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