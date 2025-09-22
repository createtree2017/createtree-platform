import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";

export default function MaternityPhotoPage() {
  return (
    <ImageGenerationTemplate
      categoryId="mansak_img"
      pageTitle="만삭사진 만들기"
      apiEndpoint="/api/generate-image"
      variableFields={true}
      galleryTitle="만삭사진 갤러리"
      aspectRatioOptions={[]} // 비율 선택 숨기기 (1:1 고정)
      defaultAspectRatio="1:1"
    />
  );
}