import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";

export default function FamilyPhotoPage() {
  const params = new URLSearchParams(window.location.search);
  const conceptId = params.get('conceptId');

  return (
    <ImageGenerationTemplate
      categoryId="family_img"
      pageTitle="사진스타일 바꾸기"
      apiEndpoint="/api/generate-family"
      variableFields={true}
      galleryTitle="가족사진 갤러리"
      initialConceptId={conceptId || undefined}
    />
  );
}