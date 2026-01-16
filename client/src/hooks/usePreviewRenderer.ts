import { useState, useCallback, useRef, useEffect } from 'react';
import { renderDesignToCanvas, DesignData, VariantConfig, ExportOptions } from '@/services/exportService';

export interface PreviewDesign {
  id: string;
  objects: any[];
  background: string;
  backgroundLeft?: string;
  backgroundRight?: string;
  orientation: 'landscape' | 'portrait';
}

export interface PreviewConfig {
  widthMm: number;
  heightMm: number;
  dpi: number;
}

export interface PreviewPage {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  label?: string;
}

export interface UsePreviewRendererOptions {
  designs: PreviewDesign[];
  config: PreviewConfig;
  getPageLabel?: (index: number) => string;
}

export interface UsePreviewRendererResult {
  pages: PreviewPage[];
  isRendering: boolean;
  renderProgress: number;
  renderAllPages: () => Promise<void>;
  clearCache: () => void;
}

const PREVIEW_DPI = 96;

function convertToDesignData(design: PreviewDesign): DesignData {
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

function createVariantConfig(config: PreviewConfig): VariantConfig {
  return {
    widthMm: config.widthMm,
    heightMm: config.heightMm,
    bleedMm: 0,
    dpi: config.dpi,
  };
}

function createExportOptions(): ExportOptions {
  return {
    format: 'webp',
    qualityValue: 'preview',
    dpi: PREVIEW_DPI,
    includeBleed: false,
  };
}

async function renderDesignToDataUrl(
  design: PreviewDesign,
  config: PreviewConfig
): Promise<string> {
  const designData = convertToDesignData(design);
  const variantConfig = createVariantConfig(config);
  const exportOptions = createExportOptions();

  const canvas = await renderDesignToCanvas(designData, variantConfig, exportOptions);
  return canvas.toDataURL('image/webp', 0.85);
}

export function usePreviewRenderer(options: UsePreviewRendererOptions): UsePreviewRendererResult {
  const { designs, config, getPageLabel } = options;

  const [pages, setPages] = useState<PreviewPage[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);

  const cacheRef = useRef<Map<string, string>>(new Map());
  const renderingRef = useRef<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  const initializePages = useCallback(() => {
    const initialPages: PreviewPage[] = designs.map((design, index) => {
      const cachedUrl = cacheRef.current.get(design.id);
      return {
        id: design.id,
        imageUrl: cachedUrl || '',
        thumbnailUrl: cachedUrl || '',
        label: getPageLabel ? getPageLabel(index) : undefined,
      };
    });
    setPages(initialPages);
  }, [designs, getPageLabel]);

  useEffect(() => {
    initializePages();
  }, [initializePages]);

  const renderPage = useCallback(async (index: number): Promise<void> => {
    if (index < 0 || index >= designs.length) return;

    const design = designs[index];
    if (!design) return;

    if (cacheRef.current.has(design.id)) return;
    if (renderingRef.current.has(design.id)) return;

    renderingRef.current.add(design.id);

    try {
      const dataUrl = await renderDesignToDataUrl(design, config);
      cacheRef.current.set(design.id, dataUrl);

      setPages((prev) =>
        prev.map((page) =>
          page.id === design.id
            ? { ...page, imageUrl: dataUrl, thumbnailUrl: dataUrl }
            : page
        )
      );
    } catch (error) {
      console.warn(`Failed to render page ${design.id}:`, error);
    } finally {
      renderingRef.current.delete(design.id);
    }
  }, [designs, config]);

  const renderAdjacentPages = useCallback(async (currentIndex: number): Promise<void> => {
    const indicesToRender = [
      currentIndex,
      currentIndex - 1,
      currentIndex + 1,
    ].filter((i) => i >= 0 && i < designs.length);

    await Promise.all(indicesToRender.map((i) => renderPage(i)));
  }, [designs.length, renderPage]);

  const renderAllPages = useCallback(async (): Promise<void> => {
    if (designs.length === 0) return;

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    setIsRendering(true);
    setRenderProgress(0);

    let completed = 0;

    try {
      for (let i = 0; i < designs.length; i++) {
        if (signal.aborted) break;

        await renderPage(i);
        completed++;
        setRenderProgress(Math.round((completed / designs.length) * 100));
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error rendering pages:', error);
      }
    } finally {
      setIsRendering(false);
    }
  }, [designs.length, renderPage]);

  const clearCache = useCallback(() => {
    cacheRef.current.forEach((dataUrl) => {
      if (dataUrl.startsWith('blob:')) {
        URL.revokeObjectURL(dataUrl);
      }
    });
    cacheRef.current.clear();
    renderingRef.current.clear();
    abortControllerRef.current?.abort();
    setRenderProgress(0);
    initializePages();
  }, [initializePages]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    pages,
    isRendering,
    renderProgress,
    renderAllPages,
    clearCache,
  };
}

export default usePreviewRenderer;
