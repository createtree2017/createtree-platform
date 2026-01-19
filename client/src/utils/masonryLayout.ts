/**
 * Masonry 레이아웃 자동 정렬 유틸리티
 * 캔버스에 배치된 이미지들을 Pinterest 스타일로 자동 정렬
 * 
 * 모든 에디터(포토북, 엽서, 행사)에서 공통으로 사용
 * 
 * 핵심 목표: 이미지 평균 크기 최대화 + 캔버스 빈 공간 최소화
 * 
 * 알고리즘:
 * 1. 여러 레이아웃 패턴(그리드, Masonry) 시뮬레이션
 * 2. 비율별 이미지 정렬 시도
 * 3. 실제 빈 공간(캔버스 - 이미지 영역) 계산
 * 4. 평균 이미지 크기가 가장 큰 레이아웃 선택
 * 5. 왼쪽 정렬 보장
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
 * 레이아웃의 실제 빈 공간 계산 및 평균 이미지 크기 점수
 * 목표: 평균 이미지 크기 최대화
 */
function calculateLayoutScore(
  placements: MasonryPlacement[],
  canvasWidth: number,
  canvasHeight: number
): number {
  if (placements.length === 0) return 0;
  
  const totalImageArea = placements.reduce((sum, p) => sum + (p.width * p.height), 0);
  const avgImageArea = totalImageArea / placements.length;
  
  let maxRight = 0;
  let maxBottom = 0;
  for (const p of placements) {
    const right = p.x + p.width;
    const bottom = p.y + p.height;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  
  const boundingArea = maxRight * maxBottom;
  const emptyInBounding = boundingArea - totalImageArea;
  
  const rightSlack = canvasWidth - maxRight;
  const bottomSlack = canvasHeight - maxBottom;
  const outsideEmpty = (rightSlack * maxBottom) + (bottomSlack * canvasWidth) - (rightSlack * bottomSlack);
  
  const totalEmpty = emptyInBounding + Math.max(0, outsideEmpty);
  const canvasArea = canvasWidth * canvasHeight;
  const emptyRatio = totalEmpty / canvasArea;
  
  const avgSizeScore = avgImageArea / canvasArea;
  const fillScore = 1 - emptyRatio;
  
  return avgSizeScore * 0.7 + fillScore * 0.3;
}

/**
 * 특정 컬럼 수로 Masonry 레이아웃 계산
 */
function calculateMasonryForColumns(
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

  const totalHeight = Math.max(...columnHeights) - gap + padding;
  const fillRate = calculateLayoutScore(placements, canvasWidth, canvasHeight);

  return { placements, actualColumnCount: columnCount, totalHeight, fillRate };
}

/**
 * 레이아웃을 캔버스에 맞게 스케일링 및 왼쪽 정렬
 */
function fitAndAlignLayout(
  layout: MasonryLayoutResult,
  canvasWidth: number,
  canvasHeight: number,
  padding: number
): MasonryLayoutResult {
  if (layout.placements.length === 0) return layout;
  
  let maxRight = 0;
  let maxBottom = 0;
  let minLeft = Infinity;
  
  for (const p of layout.placements) {
    if (p.x < minLeft) minLeft = p.x;
    const right = p.x + p.width;
    const bottom = p.y + p.height;
    if (right > maxRight) maxRight = right;
    if (bottom > maxBottom) maxBottom = bottom;
  }
  
  const usedWidth = maxRight - minLeft;
  const usedHeight = maxBottom;
  
  const widthScale = (canvasWidth - padding * 2) / usedWidth;
  const heightScale = (canvasHeight - padding) / usedHeight;
  
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
  
  const newFillRate = calculateLayoutScore(scaledPlacements, canvasWidth, canvasHeight);
  
  return {
    placements: scaledPlacements,
    actualColumnCount: layout.actualColumnCount,
    totalHeight: newMaxBottom + padding,
    fillRate: newFillRate,
  };
}

/**
 * 비율별 이미지 정렬 (세로 → 정방형 → 가로 순)
 */
function sortImagesByAspectRatio(images: MasonryImage[]): MasonryImage[] {
  return [...images].sort((a, b) => a.aspectRatio - b.aspectRatio);
}

/**
 * 비율별 역순 정렬 (가로 → 정방형 → 세로 순)
 */
function sortImagesByAspectRatioReverse(images: MasonryImage[]): MasonryImage[] {
  return [...images].sort((a, b) => b.aspectRatio - a.aspectRatio);
}

/**
 * 그리드 패턴 시도 (저개수 이미지용)
 */
function tryGridPatterns(
  canvasWidth: number,
  canvasHeight: number,
  images: MasonryImage[],
  gap: number,
  padding: number
): MasonryLayoutResult | null {
  const n = images.length;
  if (n > 12) return null;
  
  const patterns: Array<number[]> = [];
  
  switch (n) {
    case 1: patterns.push([1]); break;
    case 2: patterns.push([2], [1, 1]); break;
    case 3: patterns.push([3], [2, 1], [1, 2]); break;
    case 4: patterns.push([2, 2], [4], [3, 1], [1, 3]); break;
    case 5: patterns.push([3, 2], [2, 3], [5], [2, 2, 1], [1, 2, 2]); break;
    case 6: patterns.push([3, 3], [2, 2, 2], [3, 2, 1], [2, 3, 1], [6]); break;
    case 7: patterns.push([4, 3], [3, 4], [3, 2, 2], [2, 3, 2], [2, 2, 3]); break;
    case 8: patterns.push([4, 4], [3, 3, 2], [2, 3, 3], [4, 2, 2], [2, 2, 4]); break;
    case 9: patterns.push([3, 3, 3], [4, 3, 2], [3, 4, 2], [5, 4]); break;
    case 10: patterns.push([4, 3, 3], [3, 4, 3], [3, 3, 4], [5, 5], [5, 3, 2]); break;
    case 11: patterns.push([4, 4, 3], [4, 3, 4], [3, 4, 4], [5, 4, 2], [6, 5]); break;
    case 12: patterns.push([4, 4, 4], [3, 3, 3, 3], [6, 6], [5, 4, 3]); break;
    default: return null;
  }
  
  const imageSets = [
    images,
    sortImagesByAspectRatio(images),
    sortImagesByAspectRatioReverse(images),
  ];
  
  let bestLayout: MasonryLayoutResult | null = null;
  let bestScore = 0;
  
  for (const imgSet of imageSets) {
    for (const pattern of patterns) {
      const layout = calculateRowPattern(canvasWidth, canvasHeight, imgSet, pattern, gap, padding);
      if (layout) {
        const fitted = fitAndAlignLayout(layout, canvasWidth, canvasHeight, padding);
        if (fitted.fillRate > bestScore) {
          bestScore = fitted.fillRate;
          bestLayout = fitted;
        }
      }
    }
  }
  
  return bestLayout;
}

/**
 * 행 패턴으로 레이아웃 계산
 */
function calculateRowPattern(
  canvasWidth: number,
  canvasHeight: number,
  images: MasonryImage[],
  pattern: number[],
  gap: number,
  padding: number
): MasonryLayoutResult | null {
  const totalImages = pattern.reduce((a, b) => a + b, 0);
  if (totalImages !== images.length) return null;
  
  const availableWidth = canvasWidth - (padding * 2);
  const availableHeight = canvasHeight - (padding * 2);
  const numRows = pattern.length;
  
  const rowData: Array<{
    images: MasonryImage[];
    cellWidth: number;
    maxHeight: number;
  }> = [];
  
  let imageIndex = 0;
  for (let row = 0; row < numRows; row++) {
    const imagesInRow = pattern[row];
    const rowImages = images.slice(imageIndex, imageIndex + imagesInRow);
    imageIndex += imagesInRow;
    
    const cellWidth = (availableWidth - (gap * (imagesInRow - 1))) / imagesInRow;
    
    let maxHeight = 0;
    for (const img of rowImages) {
      const h = cellWidth / img.aspectRatio;
      if (h > maxHeight) maxHeight = h;
    }
    
    rowData.push({ images: rowImages, cellWidth, maxHeight });
  }
  
  const totalContentHeight = rowData.reduce((sum, r) => sum + r.maxHeight, 0) + (gap * (numRows - 1));
  
  let scaleFactor = 1;
  if (totalContentHeight > availableHeight) {
    scaleFactor = availableHeight / totalContentHeight;
  }
  
  const placements: MasonryPlacement[] = [];
  let currentY = padding;
  
  for (let row = 0; row < numRows; row++) {
    const { images: rowImages, cellWidth, maxHeight } = rowData[row];
    const scaledCellWidth = cellWidth * scaleFactor;
    const scaledMaxHeight = maxHeight * scaleFactor;
    const scaledGap = gap * scaleFactor;
    
    let currentX = padding;
    
    for (const img of rowImages) {
      const width = scaledCellWidth;
      const height = scaledCellWidth / img.aspectRatio;
      const yOffset = (scaledMaxHeight - height) / 2;
      
      placements.push({
        id: img.id,
        x: currentX,
        y: currentY + yOffset,
        width,
        height,
      });
      
      currentX += width + scaledGap;
    }
    
    currentY += scaledMaxHeight + scaledGap;
  }
  
  const fillRate = calculateLayoutScore(placements, canvasWidth, canvasHeight);
  
  return {
    placements,
    actualColumnCount: Math.max(...pattern),
    totalHeight: currentY - (gap * scaleFactor) + padding,
    fillRate,
  };
}

/**
 * 최적 레이아웃 자동 탐색
 * 목표: 평균 이미지 크기 최대화 + 빈 공간 최소화
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
    let layout = calculateMasonryForColumns(canvasWidth, canvasHeight, images, specifiedColumnCount, gap, padding);
    return fitAndAlignLayout(layout, canvasWidth, canvasHeight, padding);
  }

  let bestLayout: MasonryLayoutResult | null = null;
  let bestScore = 0;

  const gridLayout = tryGridPatterns(canvasWidth, canvasHeight, images, gap, padding);
  if (gridLayout && gridLayout.fillRate > bestScore) {
    bestScore = gridLayout.fillRate;
    bestLayout = gridLayout;
  }

  const imageSets = [
    images,
    sortImagesByAspectRatio(images),
    sortImagesByAspectRatioReverse(images),
  ];
  
  const maxCols = Math.min(MAX_COLUMN_COUNT, images.length);
  
  for (const imgSet of imageSets) {
    for (let cols = MIN_COLUMN_COUNT; cols <= maxCols; cols++) {
      let layout = calculateMasonryForColumns(canvasWidth, canvasHeight, imgSet, cols, gap, padding);
      layout = fitAndAlignLayout(layout, canvasWidth, canvasHeight, padding);
      
      if (layout.fillRate > bestScore) {
        bestScore = layout.fillRate;
        bestLayout = layout;
      }
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
 * @deprecated calculateMasonryLayout이 자동으로 최적 레이아웃을 찾습니다
 */
export function calculateOptimalColumnCount(imageCount: number): number {
  if (imageCount <= 1) return 1;
  if (imageCount <= 2) return 2;
  if (imageCount <= 4) return 2;
  if (imageCount <= 9) return 3;
  return Math.min(MAX_COLUMN_COUNT, Math.ceil(Math.sqrt(imageCount)));
}
