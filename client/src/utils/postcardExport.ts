import { jsPDF } from 'jspdf';
import { CanvasObject } from '../components/photobook-v2/types';
import { PostcardDesign, VariantConfig, getEffectiveDimensions } from '../components/postcard/types';

export type ExportFormat = 'webp' | 'jpeg' | 'pdf';
export type ExportQuality = 'high' | 'print';

export interface ExportOptions {
  format: ExportFormat;
  quality: ExportQuality;
  includeBleed: boolean;
}

const QUALITY_SETTINGS = {
  high: { dpi: 150, compression: 0.92 },
  print: { dpi: 300, compression: 0.95 }
};

async function loadImage(src: string): Promise<HTMLImageElement> {
  // GCS URL인 경우 프록시를 통해 가져오기 (CORS 우회)
  const isGcsUrl = src.includes('storage.googleapis.com') || src.includes('storage.cloud.google.com');
  const fetchUrl = isGcsUrl 
    ? `/api/proxy-image?url=${encodeURIComponent(src)}` 
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
    console.warn('Fetch failed, trying direct load:', src, fetchError);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
}

export async function renderDesignToCanvas(
  design: PostcardDesign,
  variantConfig: VariantConfig,
  options: ExportOptions
): Promise<HTMLCanvasElement> {
  const { quality, includeBleed } = options;
  const exportDpi = QUALITY_SETTINGS[quality].dpi;
  const editorDpi = variantConfig.dpi || 300;
  
  const effectiveDims = getEffectiveDimensions(variantConfig, design.orientation);
  
  const bleedMm = includeBleed ? variantConfig.bleedMm : 0;
  const bleedPxEditor = bleedMm * editorDpi / 25.4;
  
  const dpiRatio = exportDpi / editorDpi;
  
  const canvasWidthPx = Math.round((effectiveDims.widthPx + bleedPxEditor * 2) * dpiRatio);
  const canvasHeightPx = Math.round((effectiveDims.heightPx + bleedPxEditor * 2) * dpiRatio);
  const bleedOffsetPx = bleedPxEditor * dpiRatio;
  
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidthPx;
  canvas.height = canvasHeightPx;
  const ctx = canvas.getContext('2d')!;
  
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);
  
  if (design.background && design.background !== 'transparent') {
    if (design.background.startsWith('#') || design.background.startsWith('rgb')) {
      ctx.fillStyle = design.background;
      ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx);
    } else {
      try {
        const bgImg = await loadImage(design.background);
        ctx.drawImage(bgImg, 0, 0, canvasWidthPx, canvasHeightPx);
      } catch (e) {
        console.warn('Failed to load background image:', e);
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
    
    if (obj.type === 'image' && obj.src) {
      try {
        const img = await loadImage(obj.src);
        
        ctx.beginPath();
        ctx.rect(0, 0, objWidth, objHeight);
        ctx.clip();
        
        const contentOffsetX = (obj.contentX ?? 0) * dpiRatio;
        const contentOffsetY = (obj.contentY ?? 0) * dpiRatio;
        const contentWidth = (obj.contentWidth ?? obj.width) * dpiRatio;
        const contentHeight = (obj.contentHeight ?? obj.height) * dpiRatio;
        
        if (obj.isFlippedX) {
          ctx.translate(localCenterX, localCenterY);
          ctx.scale(-1, 1);
          ctx.translate(-localCenterX, -localCenterY);
        }
        
        ctx.drawImage(
          img,
          contentOffsetX,
          contentOffsetY,
          contentWidth,
          contentHeight
        );
      } catch (e) {
        console.warn('Failed to load image:', obj.src, e);
      }
    } else if (obj.type === 'text' && obj.text) {
      const fontSize = Math.min(objHeight * 0.8, objWidth / obj.text.length * 1.5);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(obj.text, localCenterX, localCenterY);
    }
    
    ctx.restore();
  }
  
  return canvas;
}

export async function exportDesignAsImage(
  design: PostcardDesign,
  variantConfig: VariantConfig,
  options: ExportOptions,
  filename: string
): Promise<void> {
  const canvas = await renderDesignToCanvas(design, variantConfig, options);
  const quality = QUALITY_SETTINGS[options.quality].compression;
  
  const mimeType = options.format === 'webp' ? 'image/webp' : 'image/jpeg';
  const extension = options.format === 'webp' ? 'webp' : 'jpg';
  
  const dataUrl = canvas.toDataURL(mimeType, quality);
  
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${filename}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function exportDesignsAsPdf(
  designs: PostcardDesign[],
  variantConfig: VariantConfig,
  options: Omit<ExportOptions, 'format'>,
  filename: string
): Promise<void> {
  if (designs.length === 0) return;
  
  const firstDesign = designs[0];
  const effectiveDims = getEffectiveDimensions(variantConfig, firstDesign.orientation);
  
  const bleedMm = options.includeBleed ? variantConfig.bleedMm : 0;
  const totalWidthMm = effectiveDims.widthMm + bleedMm * 2;
  const totalHeightMm = effectiveDims.heightMm + bleedMm * 2;
  
  const orientation = totalWidthMm > totalHeightMm ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation,
    unit: 'mm',
    format: [totalWidthMm, totalHeightMm]
  });
  
  for (let i = 0; i < designs.length; i++) {
    const design = designs[i];
    
    if (i > 0) {
      const dims = getEffectiveDimensions(variantConfig, design.orientation);
      const w = dims.widthMm + bleedMm * 2;
      const h = dims.heightMm + bleedMm * 2;
      const orient = w > h ? 'landscape' : 'portrait';
      pdf.addPage([w, h], orient);
    }
    
    const canvas = await renderDesignToCanvas(design, variantConfig, { ...options, format: 'jpeg' });
    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    const dims = getEffectiveDimensions(variantConfig, design.orientation);
    const w = dims.widthMm + bleedMm * 2;
    const h = dims.heightMm + bleedMm * 2;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
  }
  
  pdf.save(`${filename}.pdf`);
}

export async function exportAllDesigns(
  designs: PostcardDesign[],
  variantConfig: VariantConfig,
  options: ExportOptions,
  baseFilename: string
): Promise<void> {
  if (options.format === 'pdf') {
    await exportDesignsAsPdf(designs, variantConfig, options, baseFilename);
  } else {
    for (let i = 0; i < designs.length; i++) {
      const filename = designs.length === 1 
        ? baseFilename 
        : `${baseFilename}_${i + 1}`;
      await exportDesignAsImage(designs[i], variantConfig, options, filename);
    }
  }
}
