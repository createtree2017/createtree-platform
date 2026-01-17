/**
 * 캔버스 이미지 배치 공통 유틸리티
 * 모든 에디터(포토북, 엽서, 파티)에서 공통으로 사용
 */

export interface ImagePlacementInput {
  assetWidth: number;
  assetHeight: number;
  canvasWidthPx: number;
  canvasHeightPx: number;
  mode?: 'cover' | 'contain' | 'center';
}

export interface ImagePlacementResult {
  x: number;
  y: number;
  width: number;
  height: number;
  contentX: number;
  contentY: number;
  contentWidth: number;
  contentHeight: number;
}

/**
 * 이미지를 캔버스에 배치할 때 크기와 위치를 계산
 * 
 * @param input - 이미지 및 캔버스 정보
 * @returns 배치 정보 (x, y, width, height, content* 값)
 * 
 * mode 설명:
 * - 'cover': 캔버스를 완전히 채움 (이미지 일부가 잘릴 수 있음) - 기본값
 * - 'contain': 이미지 전체가 보이도록 맞춤 (캔버스에 여백 생길 수 있음)
 * - 'center': 원본 크기로 중앙 배치 (캔버스 40% 크기 제한)
 */
export function computeDefaultImagePlacement(input: ImagePlacementInput): ImagePlacementResult {
  const { assetWidth, assetHeight, canvasWidthPx, canvasHeightPx, mode = 'cover' } = input;

  const assetRatio = assetWidth / assetHeight;
  const canvasRatio = canvasWidthPx / canvasHeightPx;

  let width: number;
  let height: number;

  if (mode === 'cover') {
    if (assetRatio > canvasRatio) {
      height = canvasHeightPx;
      width = height * assetRatio;
    } else {
      width = canvasWidthPx;
      height = width / assetRatio;
    }
  } else if (mode === 'contain') {
    if (assetRatio > canvasRatio) {
      width = canvasWidthPx;
      height = width / assetRatio;
    } else {
      height = canvasHeightPx;
      width = height * assetRatio;
    }
  } else {
    const maxWidth = canvasWidthPx * 0.4;
    width = Math.min(assetWidth, maxWidth);
    height = width / assetRatio;
  }

  const x = (canvasWidthPx - width) / 2;
  const y = (canvasHeightPx - height) / 2;

  return {
    x,
    y,
    width,
    height,
    contentX: 0,
    contentY: 0,
    contentWidth: width,
    contentHeight: height,
  };
}

/**
 * 포토북 스프레드용 이미지 배치 계산
 * 스프레드는 2페이지이므로 한 페이지 영역에 맞춤
 */
export function computeSpreadImagePlacement(input: {
  assetWidth: number;
  assetHeight: number;
  pageWidthPx: number;
  pageHeightPx: number;
  spreadWidthPx: number;
  mode?: 'cover' | 'contain' | 'center';
}): ImagePlacementResult {
  const { assetWidth, assetHeight, pageWidthPx, pageHeightPx, spreadWidthPx, mode = 'cover' } = input;

  const result = computeDefaultImagePlacement({
    assetWidth,
    assetHeight,
    canvasWidthPx: pageWidthPx,
    canvasHeightPx: pageHeightPx,
    mode,
  });

  result.x = (spreadWidthPx - result.width) / 2;

  return result;
}
