/**
 * Masonry 레이아웃 자동 정렬 유틸리티
 * 캔버스에 배치된 이미지들을 균일한 그리드로 자동 정렬
 * 
 * 핵심 원칙:
 * - 모든 이미지가 동일한 가로 크기 (컬럼 너비)
 * - 컬럼 수(1~8)만 최적화
 * - 캔버스를 최대한 채우되, 남는 여백은 허용
 * - 단순하고 예측 가능한 레이아웃
 */

export interface MasonryImage {
  id: string;
  aspectRatio: number;
}

export interface MasonryPlacement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MasonryLayoutInput {
  canvasWidth: number;
  canvasHeight: number;
  images: MasonryImage[];
  gap?: number;
  padding?: number;
  columnCount?: number;
}

export interface MasonryLayoutResult {
  placements: MasonryPlacement[];
  actualColumnCount: number;
  totalHeight: number;
  fillRate: number;
}

const MAX_COLUMN_COUNT = 8;
const MIN_COLUMN_COUNT = 1;

/**
 * 컬럼 높이 배열에서 가장 짧은 컬럼 인덱스 반환
 */
function getShortestColumnIndex(columnHeights: number[]): number {
  let minIndex = 0;
  let minHeight = columnHeights[0];
  for (let i = 1; i < columnHeights.length; i++) {
    if (columnHeights[i] < minHeight) {
      minHeight = columnHeights[i];
      minIndex = i;
    }
  }
  return minIndex;
}

/**
 * 특정 컬럼 수로 균일 그리드 레이아웃 계산
 * 모든 이미지가 동일한 가로 크기를 가짐
 */
function calculateUniformGridLayout(
  canvasWidth: number,
  canvasHeight: number,
  images: MasonryImage[],
  columnCount: number,
  gap: number,
  padding: number
): MasonryLayoutResult {
  if (images.length === 0) {
    return { placements: [], actualColumnCount: 0, totalHeight: 0, fillRate: 0 };
  }

  const availableWidth = canvasWidth - (padding * 2);
  const columnWidth = (availableWidth - (gap * (columnCount - 1))) / columnCount;
  
  const columnHeights: number[] = new Array(columnCount).fill(padding);
  
  const placements: MasonryPlacement[] = images.map((image) => {
    const shortestColumn = getShortestColumnIndex(columnHeights);
    
    const x = padding + (shortestColumn * (columnWidth + gap));
    const y = columnHeights[shortestColumn];
    const width = columnWidth;
    const height = columnWidth / image.aspectRatio;
    
    columnHeights[shortestColumn] = y + height + gap;
    
    return { id: image.id, x, y, width, height };
  });

  const maxColumnHeight = Math.max(...columnHeights);
  const totalHeight = maxColumnHeight - gap + padding;
  
  const totalImageArea = placements.reduce((sum, p) => sum + (p.width * p.height), 0);
  const canvasArea = canvasWidth * canvasHeight;
  const fillRate = totalImageArea / canvasArea;

  return { placements, actualColumnCount: columnCount, totalHeight, fillRate };
}

/**
 * 레이아웃을 캔버스에 맞게 균일하게 스케일 조정
 * 높이/너비 모두 고려하여 스케일 다운 또는 업
 * 스케일 후 왼쪽 정렬 보장
 */
function fitLayoutToCanvas(
  layout: MasonryLayoutResult,
  canvasWidth: number,
  canvasHeight: number,
  padding: number = 5
): MasonryLayoutResult {
  if (layout.placements.length === 0) return layout;
  
  let minLeft = Infinity;
  let maxRight = 0;
  let maxBottom = 0;
  
  for (const p of layout.placements) {
    if (p.x < minLeft) minLeft = p.x;
    const right = p.x + p.width;
    const bottom = p.y + p.height;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  
  const usedWidth = maxRight - minLeft;
  const usedHeight = maxBottom;
  
  const widthScale = (canvasWidth - padding) / usedWidth;
  const heightScale = canvasHeight / usedHeight;
  
  let scaleFactor = Math.min(widthScale, heightScale);
  
  if (scaleFactor > 1) {
    scaleFactor = Math.min(scaleFactor, 1.5);
  }
  
  const scaledPlacements = layout.placements.map(p => {
    const newX = padding + (p.x - minLeft) * scaleFactor;
    const newY = p.y * scaleFactor;
    const newWidth = p.width * scaleFactor;
    const newHeight = p.height * scaleFactor;
    return { id: p.id, x: newX, y: newY, width: newWidth, height: newHeight };
  });
  
  let newMaxBottom = 0;
  for (const p of scaledPlacements) {
    const bottom = p.y + p.height;
    if (bottom > newMaxBottom) newMaxBottom = bottom;
  }
  
  const totalImageArea = scaledPlacements.reduce((sum, p) => sum + (p.width * p.height), 0);
  const canvasArea = canvasWidth * canvasHeight;
  const fillRate = totalImageArea / canvasArea;
  
  return {
    placements: scaledPlacements,
    actualColumnCount: layout.actualColumnCount,
    totalHeight: newMaxBottom,
    fillRate,
  };
}

/**
 * 레이아웃의 미사용 면적(빈 공간) 계산
 */
function calculateUnusedArea(
  placements: MasonryPlacement[],
  canvasWidth: number,
  canvasHeight: number
): number {
  if (placements.length === 0) return canvasWidth * canvasHeight;
  
  const totalImageArea = placements.reduce((sum, p) => sum + (p.width * p.height), 0);
  const canvasArea = canvasWidth * canvasHeight;
  
  return canvasArea - totalImageArea;
}

/**
 * 최적 컬럼 수 탐색
 * 1차: 미사용 면적(빈 공간) 최소화 (캔버스 최대 채움)
 * 2차: 평균 이미지 면적 최대화
 */
export function calculateMasonryLayout(input: MasonryLayoutInput): MasonryLayoutResult {
  const {
    canvasWidth,
    canvasHeight,
    images,
    gap = 5,
    padding = 5,
    columnCount: specifiedColumnCount,
  } = input;

  if (images.length === 0) {
    return { placements: [], actualColumnCount: 0, totalHeight: 0, fillRate: 0 };
  }

  if (specifiedColumnCount !== undefined) {
    let layout = calculateUniformGridLayout(canvasWidth, canvasHeight, images, specifiedColumnCount, gap, padding);
    return fitLayoutToCanvas(layout, canvasWidth, canvasHeight, padding);
  }

  let bestLayout: MasonryLayoutResult | null = null;
  let bestUnusedArea = Infinity;
  let bestAvgArea = 0;
  
  const maxCols = Math.min(MAX_COLUMN_COUNT, images.length);
  
  for (let cols = MIN_COLUMN_COUNT; cols <= maxCols; cols++) {
    let layout = calculateUniformGridLayout(canvasWidth, canvasHeight, images, cols, gap, padding);
    layout = fitLayoutToCanvas(layout, canvasWidth, canvasHeight, padding);
    
    const unusedArea = calculateUnusedArea(layout.placements, canvasWidth, canvasHeight);
    
    const avgArea = layout.placements.length > 0
      ? layout.placements.reduce((sum, p) => sum + (p.width * p.height), 0) / layout.placements.length
      : 0;
    
    const isBetter = unusedArea < bestUnusedArea || 
      (Math.abs(unusedArea - bestUnusedArea) < 1 && avgArea > bestAvgArea);
    
    if (isBetter) {
      bestUnusedArea = unusedArea;
      bestAvgArea = avgArea;
      bestLayout = layout;
    }
  }

  return bestLayout ?? { placements: [], actualColumnCount: 0, totalHeight: 0, fillRate: 0 };
}

/**
 * 밀착 모드용 레이아웃 계산 (gap=0, padding=0)
 */
export function calculateTightMasonryLayout(
  input: Omit<MasonryLayoutInput, 'gap' | 'padding'>
): MasonryLayoutResult {
  return calculateMasonryLayout({ ...input, gap: 0, padding: 0 });
}

/**
 * 기본 모드용 레이아웃 계산 (gap=5, padding=5)
 */
export function calculateSpacedMasonryLayout(
  input: Omit<MasonryLayoutInput, 'gap' | 'padding'>
): MasonryLayoutResult {
  return calculateMasonryLayout({ ...input, gap: 5, padding: 5 });
}

/**
 * 포토북 페이지 영역 정의
 */
export type PhotobookPageTarget = 'left' | 'right' | 'both';

/**
 * 포토북 스프레드에서 페이지 영역 계산
 */
export function getPhotobookPageBounds(
  spreadWidth: number,
  spreadHeight: number,
  target: PhotobookPageTarget
): { x: number; y: number; width: number; height: number } {
  const pageWidth = spreadWidth / 2;
  switch (target) {
    case 'left': return { x: 0, y: 0, width: pageWidth, height: spreadHeight };
    case 'right': return { x: pageWidth, y: 0, width: pageWidth, height: spreadHeight };
    case 'both':
    default: return { x: 0, y: 0, width: spreadWidth, height: spreadHeight };
  }
}

/**
 * 이미지 객체가 특정 페이지 영역에 있는지 확인
 */
export function isImageInPageBounds(
  imageX: number,
  imageWidth: number,
  spreadWidth: number,
  target: PhotobookPageTarget
): boolean {
  const centerX = imageX + (imageWidth / 2);
  const pageWidth = spreadWidth / 2;
  switch (target) {
    case 'left': return centerX < pageWidth;
    case 'right': return centerX >= pageWidth;
    case 'both':
    default: return true;
  }
}

/**
 * 이미지 개수에 따른 최적 컬럼 수 계산 (레거시 호환용)
 * @deprecated calculateMasonryLayout이 자동으로 최적 컬럼 수를 찾습니다
 */
export function calculateOptimalColumnCount(imageCount: number): number {
  if (imageCount <= 1) return 1;
  if (imageCount <= 2) return 2;
  if (imageCount <= 4) return 2;
  if (imageCount <= 9) return 3;
  return Math.min(MAX_COLUMN_COUNT, Math.ceil(Math.sqrt(imageCount)));
}
