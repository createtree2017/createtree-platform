import ConceptGalleryTemplate from "@/components/ConceptGalleryTemplate";
import { IMAGE_GENERATION_CATEGORIES } from "@shared/constants";

export default function StickerStylesPage() {
  const category = IMAGE_GENERATION_CATEGORIES.STICKER;

  return (
    <ConceptGalleryTemplate
      categoryId={category.ID}
      pageTitle={category.PAGE_TITLE}
      description={category.DESCRIPTION}
      generationPageUrl={category.GENERATION_PAGE}
    />
  );
}
