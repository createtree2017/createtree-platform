import ImageGenerationTemplate from "@/components/ImageGenerationTemplate";

export default function StickersPage() {
  // 스티커는 특별한 필터링 규칙이 있음 (diz, sticker 컨셉 포함)
  const stickerStyleFilter = (style: any) => {
    return style.categoryId === "sticker_img" || 
           style.conceptId === "diz" || 
           style.conceptId === "sticker";
  };

  return (
    <ImageGenerationTemplate
      categoryId="sticker_img"
      pageTitle="스티커 만들기"
      apiEndpoint="/api/generate-stickers"
      customStyleFilter={stickerStyleFilter}
      variableFields={false}
      galleryTitle="스티커 갤러리"
    />
  );
}