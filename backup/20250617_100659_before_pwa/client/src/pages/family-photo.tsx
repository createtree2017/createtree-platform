import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";

export default function FamilyPhotoPage() {
  return (
    <ImageGenerationTemplate
      categoryId="family_img"
      pageTitle="가족사진 만들기"
      apiEndpoint="/api/generate-family"
      variableFields={true}
      galleryTitle="가족사진 갤러리"
    />
  );
}