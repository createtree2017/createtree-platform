import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";

export default function BabyFacePage() {
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