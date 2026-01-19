/**
 * Masonry 레이아웃 자동 정렬 유틸리티
 * 캔버스에 배치된 이미지들을 Pinterest 스타일로 자동 정렬
 * 
 * 모든 에디터(포토북, 엽서, 행사)에서 공통으로 사용
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
}

/**
 * 이미지 개수에 따른 최적 컬럼 수 계산
 * @param imageCount 이미지 개수
 * @returns 최적 컬럼 수 (1~4)
 */
export function calculateOptimalColumnCount(imageCount: number): number {
  if (imageCount <= 1) return 1;
  if (imageCount <= 2) return 2;
  if (imageCount <= 4) return 2;
  if (imageCount <= 9) return 3;
  return Math.min(4, Math.ceil(Math.sqrt(imageCount)));
}

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
 * Masonry 레이아웃 계산
 * 
 * 알고리즘:
 * 1. 컬럼 수 결정 (자동 또는 지정)
 * 2. 각 컬럼의 현재 높이 추적
 * 3. 각 이미지를 "가장 짧은 컬럼"에 배치
 * 4. 이미지 가로 크기는 동일, 세로 크기는 비율에 따라 결정
 * 
 * @param input 레이아웃 입력값
 * @returns 배치 결과
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
    return { placements: [], actualColumnCount: 0, totalHeight: 0 };
  }

  const columnCount = specifiedColumnCount ?? calculateOptimalColumnCount(images.length);
  
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
    
    return {
      id: image.id,
      x,
      y,
      width,
      height,
    };
  });

  const totalHeight = Math.max(...columnHeights) - gap + padding;
  
  const overflowRatio = totalHeight / canvasHeight;
  
  if (overflowRatio > 1) {
    const scaleFactor = 1 / overflowRatio;
    const scaledGap = gap * scaleFactor;
    const scaledPadding = padding * scaleFactor;
    
    const scaledAvailableWidth = canvasWidth - (scaledPadding * 2);
    const scaledColumnWidth = (scaledAvailableWidth - (scaledGap * (columnCount - 1))) / columnCount;
    
    const scaledColumnHeights: number[] = new Array(columnCount).fill(scaledPadding);
    
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const shortestColumn = getShortestColumnIndex(scaledColumnHeights);
      
      placements[i].x = scaledPadding + (shortestColumn * (scaledColumnWidth + scaledGap));
      placements[i].y = scaledColumnHeights[shortestColumn];
      placements[i].width = scaledColumnWidth;
      placements[i].height = scaledColumnWidth / image.aspectRatio;
      
      scaledColumnHeights[shortestColumn] = placements[i].y + placements[i].height + scaledGap;
    }
    
    return {
      placements,
      actualColumnCount: columnCount,
      totalHeight: Math.max(...scaledColumnHeights) - scaledGap + scaledPadding,
    };
  }

  return {
    placements,
    actualColumnCount: columnCount,
    totalHeight,
  };
}

/**
 * 밀착 모드용 레이아웃 계산 (gap=0, padding=0)
 */
export function calculateTightMasonryLayout(
  input: Omit<MasonryLayoutInput, 'gap' | 'padding'>
): MasonryLayoutResult {
  return calculateMasonryLayout({
    ...input,
    gap: 0,
    padding: 0,
  });
}

/**
 * 기본 모드용 레이아웃 계산 (gap=5, padding=5)
 */
export function calculateSpacedMasonryLayout(
  input: Omit<MasonryLayoutInput, 'gap' | 'padding'>
): MasonryLayoutResult {
  return calculateMasonryLayout({
    ...input,
    gap: 5,
    padding: 5,
  });
}

/**
 * 포토북 페이지 영역 정의
 */
export type PhotobookPageTarget = 'left' | 'right' | 'both';

/**
 * 포토북 스프레드에서 페이지 영역 계산
 * 
 * @param spreadWidth 스프레드 전체 너비
 * @param spreadHeight 스프레드 높이
 * @param target 타겟 페이지
 * @returns 정렬 영역 bounds
 */
export function getPhotobookPageBounds(
  spreadWidth: number,
  spreadHeight: number,
  target: PhotobookPageTarget
): { x: number; y: number; width: number; height: number } {
  const pageWidth = spreadWidth / 2;
  
  switch (target) {
    case 'left':
      return { x: 0, y: 0, width: pageWidth, height: spreadHeight };
    case 'right':
      return { x: pageWidth, y: 0, width: pageWidth, height: spreadHeight };
    case 'both':
    default:
      return { x: 0, y: 0, width: spreadWidth, height: spreadHeight };
  }
}

/**
 * 이미지 객체가 특정 페이지 영역에 있는지 확인
 * 이미지 중심점 기준
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
    case 'left':
      return centerX < pageWidth;
    case 'right':
      return centerX >= pageWidth;
    case 'both':
    default:
      return true;
  }
}
