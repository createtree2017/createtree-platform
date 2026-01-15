import { Router, Request, Response } from "express";
import { db } from "@db";
import { productCategories, productVariants, productProjects } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { extractGCSPathFromUrl, downloadFromGCS } from "../utils/gcs";

const router = Router();

// 공통 타입 정의
export interface ExportConfig {
  format: "webp" | "jpeg" | "pdf";
  quality: string;
  dpi: number;
  includeBleed: boolean;
  orientation: "landscape" | "portrait";
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
  quantity: number;
  orientation: "landscape" | "portrait";
}

export interface VariantConfig {
  widthMm: number;
  heightMm: number;
  bleedMm: number;
  dpi: number;
}

// 카테고리별 내보내기 설정 조회
router.get("/config/:categorySlug", async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    
    const category = await db.query.productCategories.findFirst({
      where: eq(productCategories.slug, categorySlug)
    });
    
    if (!category) {
      return res.status(404).json({ error: "카테고리를 찾을 수 없습니다" });
    }
    
    return res.json({
      categoryId: category.id,
      slug: category.slug,
      name: category.name,
      exportFormats: category.exportFormats || ["webp", "jpeg", "pdf"],
      defaultDpi: category.defaultDpi || 300,
      supportedOrientations: category.supportedOrientations || ["landscape", "portrait"],
      supportsBleed: category.supportsBleed ?? true,
      qualityOptions: category.exportQualityOptions || [
        { value: "high", dpi: 150, label: "고화질 (150 DPI)" },
        { value: "print", dpi: 300, label: "인쇄용 (300 DPI)" }
      ]
    });
  } catch (error) {
    console.error("[Export Config] Error:", error);
    return res.status(500).json({ error: "설정 조회 실패" });
  }
});

// 이미지 프록시 (CORS 우회) - GCS SDK 인증 방식
router.get("/proxy-image", async (req: Request, res: Response) => {
  try {
    const { url } = req.query;
    
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL parameter is required" });
    }
    
    const allowedDomains = ["storage.googleapis.com", "storage.cloud.google.com"];
    const parsedUrl = new URL(url);
    
    if (!allowedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
      return res.status(403).json({ error: "Domain not allowed" });
    }
    
    // GCS URL에서 파일 경로 추출
    const gcsPath = extractGCSPathFromUrl(url);
    
    if (gcsPath) {
      // GCS SDK를 사용한 인증된 다운로드
      try {
        const { buffer, contentType } = await downloadFromGCS(gcsPath);
        
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.setHeader("Access-Control-Allow-Origin", "*");
        
        return res.send(buffer);
      } catch (gcsError) {
        console.error("[Image Proxy] GCS 다운로드 실패:", gcsError);
        // GCS 실패 시 직접 fetch 시도 (fallback)
      }
    }
    
    // Fallback: 직접 fetch (public 파일인 경우)
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("[Image Proxy] Fetch 실패:", url, response.status);
      return res.status(response.status).json({ error: "Failed to fetch image" });
    }
    
    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = Buffer.from(await response.arrayBuffer());
    
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    return res.send(buffer);
  } catch (error) {
    console.error("[Image Proxy] Error:", error);
    return res.status(500).json({ error: "Proxy failed" });
  }
});

// 프로젝트 내보내기 설정 조회 (프로젝트 ID로)
router.get("/project/:projectId", requireAuth, async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const userId = (req as any).userId;
    
    if (isNaN(projectId)) {
      return res.status(400).json({ error: "유효하지 않은 프로젝트 ID" });
    }
    
    const project = await db.query.productProjects.findFirst({
      where: eq(productProjects.id, projectId),
      with: {
        category: true,
        variant: true
      }
    });
    
    if (!project) {
      return res.status(404).json({ error: "프로젝트를 찾을 수 없습니다" });
    }
    
    if (project.userId !== userId) {
      return res.status(403).json({ error: "접근 권한이 없습니다" });
    }
    
    const category = project.category;
    const variant = project.variant;
    
    return res.json({
      project: {
        id: project.id,
        title: project.title,
        designsData: project.designsData
      },
      category: {
        id: category.id,
        slug: category.slug,
        name: category.name,
        exportFormats: category.exportFormats || ["webp", "jpeg", "pdf"],
        defaultDpi: category.defaultDpi || 300,
        supportedOrientations: category.supportedOrientations || ["landscape", "portrait"],
        supportsBleed: category.supportsBleed ?? true,
        qualityOptions: category.exportQualityOptions || [
          { value: "high", dpi: 150, label: "고화질 (150 DPI)" },
          { value: "print", dpi: 300, label: "인쇄용 (300 DPI)" }
        ]
      },
      variant: variant ? {
        id: variant.id,
        name: variant.name,
        widthMm: variant.widthMm,
        heightMm: variant.heightMm,
        bleedMm: variant.bleedMm,
        dpi: variant.dpi
      } : null
    });
  } catch (error) {
    console.error("[Export Project] Error:", error);
    return res.status(500).json({ error: "프로젝트 조회 실패" });
  }
});

// 유틸리티 함수: 방향에 따른 실제 치수 계산
export function getEffectiveDimensions(
  variant: { widthMm: number; heightMm: number; dpi: number },
  orientation: "landscape" | "portrait"
): { widthMm: number; heightMm: number; widthPx: number; heightPx: number } {
  const { widthMm, heightMm, dpi } = variant;
  
  // 기본값은 variant 크기 그대로 사용
  // landscape: 가로가 더 긴 방향
  // portrait: 세로가 더 긴 방향
  const maxDim = Math.max(widthMm, heightMm);
  const minDim = Math.min(widthMm, heightMm);
  
  const finalWidth = orientation === "landscape" ? maxDim : minDim;
  const finalHeight = orientation === "landscape" ? minDim : maxDim;
  
  return {
    widthMm: finalWidth,
    heightMm: finalHeight,
    widthPx: Math.round(finalWidth * dpi / 25.4),
    heightPx: Math.round(finalHeight * dpi / 25.4)
  };
}

export default router;
