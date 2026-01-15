import { jsPDF } from "jspdf";
import { getEffectiveDimensions as getEffectiveDimensionsBase } from "@/utils/dimensionUtils";

export type ExportFormat = "webp" | "jpeg" | "pdf";

export interface QualityOption {
  value: string;
  dpi: number;
  label: string;
}

export interface ExportCategoryConfig {
  categoryId: number;
  slug: string;
  name: string;
  exportFormats: ExportFormat[];
  defaultDpi: number;
  supportedOrientations: ("landscape" | "portrait")[];
  supportsBleed: boolean;
  qualityOptions: QualityOption[];
}

export interface VariantConfig {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  dpi: number;
}

export interface DesignObject {
  id: string;
  type: "image" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  zIndex: number;
  src?: string;
  fullSrc?: string;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  flipX?: boolean;
  flipY?: boolean;
  contentX?: number;
  contentY?: number;
  contentWidth?: number;
  contentHeight?: number;
}

export interface DesignData {
  id: string;
  objects: DesignObject[];
  background: string;
  quantity?: number;
  orientation: "landscape" | "portrait";
}

export interface ExportOptions {
  format: ExportFormat;
  qualityValue: string;
  dpi: number;
  includeBleed: boolean;
}

// 카테고리별 내보내기 설정 조회
export async function fetchExportConfig(categorySlug: string): Promise<ExportCategoryConfig> {
  const response = await fetch(`/api/export/config/${categorySlug}`);
  if (!response.ok) {
    throw new Error("내보내기 설정 조회 실패");
  }
  return response.json();
}

export function getEffectiveDimensions(
  variant: VariantConfig,
  orientation: "landscape" | "portrait"
): { widthMm: number; heightMm: number; widthPx: number; heightPx: number } {
  return getEffectiveDimensionsBase(variant, orientation);
}

// 이미지 로드 (GCS 프록시 사용)
async function loadImage(src: string): Promise<HTMLImageElement> {
  const isGcsUrl = src.includes("storage.googleapis.com") || src.includes("storage.cloud.google.com");
  const fetchUrl = isGcsUrl 
    ? `/api/export/proxy-image?url=${encodeURIComponent(src)}` 
    : src;
  
  try {
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(blobUrl);
        resolve(img);
      };
      img.onerror = (e) => {
        URL.revokeObjectURL(blobUrl);
        reject(e);
      };
      img.src = blobUrl;
    });
  } catch (fetchError) {
    console.warn("Fetch failed, trying direct load:", src, fetchError);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}

// 단일 디자인을 캔버스로 렌더링
export async function renderDesignToCanvas(
  design: DesignData,
  variantConfig: VariantConfig,
  options: ExportOptions
): Promise<HTMLCanvasElement> {
  const { dpi, includeBleed } = options;
  const editorDpi = variantConfig.dpi || 300;
  
  const effectiveDims = getEffectiveDimensions(variantConfig, design.orientation);
  
  const bleedMm = includeBleed ? variantConfig.bleedMm : 0;
  const bleedPxEditor = bleedMm * editorDpi / 25.4;
  
  const dpiRatio = dpi / editorDpi;
  
  const canvasWidthPx = Math.round((effectiveDims.widthPx + bleedPxEditor * 2) * dpiRatio);
  const canvasHeightPx = Math.round((effectiveDims.heightPx + bleedPxEditor * 2) * dpiRatio);
  const bleedOffsetPx = bleedPxEditor * dpiRatio;
  
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidthPx;
  canvas.height = canvasHeightPx;
  const ctx = canvas.getContext("2d")!;
  
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);
  
  if (design.background && design.background !== "transparent") {
    if (design.background.startsWith("#") || design.background.startsWith("rgb")) {
      ctx.fillStyle = design.background;
      ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);
    } else {
      try {
        const bgImg = await loadImage(design.background);
        ctx.drawImage(bgImg, 0, 0, canvasWidthPx, canvasHeightPx);
      } catch (e) {
        console.warn("Failed to load background image:", e);
      }
    }
  }
  
  const sortedObjects = [...design.objects].sort((a, b) => a.zIndex - b.zIndex);
  
  for (const obj of sortedObjects) {
    ctx.save();
    ctx.globalAlpha = obj.opacity;
    
    const objX = obj.x * dpiRatio + bleedOffsetPx;
    const objY = obj.y * dpiRatio + bleedOffsetPx;
    const objWidth = obj.width * dpiRatio;
    const objHeight = obj.height * dpiRatio;
    
    ctx.translate(objX, objY);
    
    const localCenterX = objWidth / 2;
    const localCenterY = objHeight / 2;
    
    if (obj.rotation) {
      ctx.translate(localCenterX, localCenterY);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.translate(-localCenterX, -localCenterY);
    }
    
    if (obj.type === "image" && obj.src) {
      try {
        const imageUrl = obj.fullSrc || obj.src;
        const isGcs = imageUrl.includes("storage.googleapis.com") || imageUrl.includes("storage.cloud.google.com");
        if (!isGcs) {
          console.warn("[Export] 비-GCS URL 감지, 내보내기 품질 저하 가능:", imageUrl);
        }
        const img = await loadImage(imageUrl);
        
        ctx.beginPath();
        ctx.rect(0, 0, objWidth, objHeight);
        ctx.clip();
        
        const contentOffsetX = (obj.contentX ?? 0) * dpiRatio;
        const contentOffsetY = (obj.contentY ?? 0) * dpiRatio;
        const contentWidth = (obj.contentWidth ?? obj.width) * dpiRatio;
        const contentHeight = (obj.contentHeight ?? obj.height) * dpiRatio;
        
        ctx.translate(localCenterX, localCenterY);
        
        const scaleX = obj.flipX ? -1 : 1;
        const scaleY = obj.flipY ? -1 : 1;
        ctx.scale(scaleX, scaleY);
        
        ctx.translate(-localCenterX, -localCenterY);
        
        const drawX = obj.flipX ? (objWidth - contentOffsetX - contentWidth) : contentOffsetX;
        const drawY = obj.flipY ? (objHeight - contentOffsetY - contentHeight) : contentOffsetY;
        
        ctx.drawImage(img, drawX, drawY, contentWidth, contentHeight);
      } catch (e) {
        console.warn("Failed to load image:", obj.src, e);
      }
    } else if (obj.type === "text" && obj.text) {
      const fontSize = (obj.fontSize || 24) * dpiRatio;
      ctx.font = `${fontSize}px ${obj.fontFamily || "sans-serif"}`;
      ctx.fillStyle = obj.color || "#000000";
      ctx.textBaseline = "top";
      ctx.fillText(obj.text, 0, 0);
    }
    
    ctx.restore();
  }
  
  return canvas;
}

// 단일 디자인을 이미지로 내보내기
export async function exportDesignAsImage(
  design: DesignData,
  variantConfig: VariantConfig,
  options: ExportOptions,
  filename: string
): Promise<void> {
  const canvas = await renderDesignToCanvas(design, variantConfig, options);
  
  const mimeType = options.format === "webp" ? "image/webp" : "image/jpeg";
  const compression = options.dpi >= 300 ? 0.95 : 0.92;
  
  const dataUrl = canvas.toDataURL(mimeType, compression);
  
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${filename}.${options.format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 모든 디자인을 개별 이미지로 내보내기
export async function exportAllDesignsAsImages(
  designs: DesignData[],
  variantConfig: VariantConfig,
  options: ExportOptions,
  baseFilename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  for (let i = 0; i < designs.length; i++) {
    const design = designs[i];
    const filename = designs.length > 1 
      ? `${baseFilename}_${i + 1}` 
      : baseFilename;
    
    await exportDesignAsImage(design, variantConfig, options, filename);
    
    if (onProgress) {
      onProgress(i + 1, designs.length);
    }
    
    if (i < designs.length - 1) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
}

// 모든 디자인을 PDF로 내보내기
export async function exportAllDesignsAsPdf(
  designs: DesignData[],
  variantConfig: VariantConfig,
  options: ExportOptions,
  filename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const firstDesign = designs[0];
  const firstDims = getEffectiveDimensions(variantConfig, firstDesign.orientation);
  
  const bleedMm = options.includeBleed ? variantConfig.bleedMm : 0;
  const pageWidthMm = firstDims.widthMm + bleedMm * 2;
  const pageHeightMm = firstDims.heightMm + bleedMm * 2;
  
  const isLandscape = pageWidthMm > pageHeightMm;
  const pdf = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: [pageWidthMm, pageHeightMm]
  });
  
  for (let i = 0; i < designs.length; i++) {
    const design = designs[i];
    
    if (i > 0) {
      const dims = getEffectiveDimensions(variantConfig, design.orientation);
      const w = dims.widthMm + bleedMm * 2;
      const h = dims.heightMm + bleedMm * 2;
      const landscape = w > h;
      pdf.addPage([w, h], landscape ? "landscape" : "portrait");
    }
    
    const canvas = await renderDesignToCanvas(design, variantConfig, options);
    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    
    const dims = getEffectiveDimensions(variantConfig, design.orientation);
    const w = dims.widthMm + bleedMm * 2;
    const h = dims.heightMm + bleedMm * 2;
    
    pdf.addImage(imgData, "JPEG", 0, 0, w, h);
    
    if (onProgress) {
      onProgress(i + 1, designs.length);
    }
  }
  
  pdf.save(`${filename}.pdf`);
}

// 통합 내보내기 함수
export async function exportDesigns(
  designs: DesignData[],
  variantConfig: VariantConfig,
  options: ExportOptions,
  filename: string,
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  if (designs.length === 0) {
    throw new Error("내보낼 디자인이 없습니다");
  }
  
  if (options.format === "pdf") {
    await exportAllDesignsAsPdf(designs, variantConfig, options, filename, onProgress);
  } else {
    await exportAllDesignsAsImages(designs, variantConfig, options, filename, onProgress);
  }
}
