import { renderDesignToCanvas, DesignData, VariantConfig, ExportOptions } from '@/services/exportService';
import { apiRequest } from '@/lib/queryClient';

export type ProjectType = 'photobook' | 'postcard' | 'party' | 'calendar' | 'sticker';

export interface ThumbnailGenerateOptions {
  design: {
    id: string;
    objects: any[];
    background: string;
    backgroundLeft?: string;
    backgroundRight?: string;
    orientation: 'landscape' | 'portrait';
  };
  variant: {
    widthMm: number;
    heightMm: number;
    bleedMm?: number;
    dpi?: number;
  };
  projectId: number;
  projectType: ProjectType;
}

export interface ThumbnailUploadResult {
  success: boolean;
  thumbnailUrl?: string;
  error?: string;
}

const THUMBNAIL_DPI = 72;
const THUMBNAIL_QUALITY = 0.85;

function convertToDesignData(design: ThumbnailGenerateOptions['design']): DesignData {
  return {
    id: design.id,
    objects: design.objects,
    background: design.background,
    backgroundLeft: design.backgroundLeft,
    backgroundRight: design.backgroundRight,
    orientation: design.orientation,
    quantity: 1,
  };
}

function createVariantConfig(variant: ThumbnailGenerateOptions['variant']): VariantConfig {
  return {
    widthMm: variant.widthMm,
    heightMm: variant.heightMm,
    bleedMm: variant.bleedMm ?? 0,
    dpi: THUMBNAIL_DPI,
  };
}

function createExportOptions(): ExportOptions {
  return {
    format: 'webp',
    qualityValue: 'preview',
    dpi: THUMBNAIL_DPI,
    includeBleed: false,
  };
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to convert canvas to blob'));
        }
      },
      'image/webp',
      THUMBNAIL_QUALITY
    );
  });
}

export async function generateAndUploadThumbnail(
  options: ThumbnailGenerateOptions
): Promise<ThumbnailUploadResult> {
  const { design, variant, projectId, projectType } = options;

  try {
    console.log(`[ThumbnailService] 썸네일 생성 시작: ${projectType}/${projectId}`);

    const designData = convertToDesignData(design);
    const variantConfig = createVariantConfig(variant);
    const exportOptions = createExportOptions();

    const canvas = await renderDesignToCanvas(designData, variantConfig, exportOptions);
    const blob = await canvasToBlob(canvas);

    console.log(`[ThumbnailService] 캔버스 렌더링 완료, 크기: ${blob.size} bytes`);

    const formData = new FormData();
    formData.append('file', blob, 'thumbnail.webp');
    formData.append('projectId', String(projectId));
    formData.append('projectType', projectType);

    const response = await fetch('/api/editor-upload/thumbnail', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (data.success && data.data?.thumbnailUrl) {
      console.log(`[ThumbnailService] 썸네일 업로드 성공: ${data.data.thumbnailUrl}`);
      return {
        success: true,
        thumbnailUrl: data.data.thumbnailUrl,
      };
    }

    throw new Error(data.error || 'Unknown error');
  } catch (error) {
    console.error('[ThumbnailService] 썸네일 생성/업로드 실패:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function updatePhotobookCoverImage(
  projectId: number,
  coverImageUrl: string
): Promise<boolean> {
  try {
    const response = await apiRequest(`/api/photobook/projects/${projectId}`, {
      method: 'PATCH',
      data: { coverImageUrl },
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[ThumbnailService] 포토북 커버 이미지 업데이트 실패:', error);
    return false;
  }
}

export async function updateProductThumbnail(
  projectId: number,
  thumbnailUrl: string
): Promise<boolean> {
  try {
    const response = await apiRequest(`/api/products/projects/${projectId}`, {
      method: 'PATCH',
      data: { thumbnailUrl },
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('[ThumbnailService] 프로덕트 썸네일 업데이트 실패:', error);
    return false;
  }
}
