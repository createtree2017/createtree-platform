export type Orientation = 'landscape' | 'portrait';

export interface VariantDimensions {
  widthMm: number;
  heightMm: number;
  dpi?: number;
}

export interface EffectiveDimensions {
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
}

export const getEffectiveDimensions = (
  variant: VariantDimensions,
  orientation: Orientation,
  overrideDpi?: number
): EffectiveDimensions => {
  const baseWidth = variant.widthMm;
  const baseHeight = variant.heightMm;
  const dpi = overrideDpi || variant.dpi || 300;
  
  const isLandscape = orientation === 'landscape';
  const widthMm = isLandscape ? Math.max(baseWidth, baseHeight) : Math.min(baseWidth, baseHeight);
  const heightMm = isLandscape ? Math.min(baseWidth, baseHeight) : Math.max(baseWidth, baseHeight);
  
  const widthPx = Math.round(widthMm * dpi / 25.4);
  const heightPx = Math.round(heightMm * dpi / 25.4);
  
  return { widthMm, heightMm, widthPx, heightPx };
};

export const LEGACY_DPI = 300;

export interface ScalableObject {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  contentX?: number;
  contentY?: number;
  contentWidth?: number;
  contentHeight?: number;
  fontSize?: number;
}

export function migrateObjectCoordinates<T extends ScalableObject>(
  obj: T,
  sourceDpi: number,
  targetDpi: number
): T {
  if (sourceDpi === targetDpi) return obj;
  const ratio = targetDpi / sourceDpi;
  
  const result = { ...obj } as T;
  
  if (typeof obj.x === 'number') result.x = obj.x * ratio;
  if (typeof obj.y === 'number') result.y = obj.y * ratio;
  if (typeof obj.width === 'number') result.width = obj.width * ratio;
  if (typeof obj.height === 'number') result.height = obj.height * ratio;
  if (typeof obj.contentX === 'number') result.contentX = obj.contentX * ratio;
  if (typeof obj.contentY === 'number') result.contentY = obj.contentY * ratio;
  if (typeof obj.contentWidth === 'number') result.contentWidth = obj.contentWidth * ratio;
  if (typeof obj.contentHeight === 'number') result.contentHeight = obj.contentHeight * ratio;
  if (typeof obj.fontSize === 'number') result.fontSize = obj.fontSize * ratio;
  
  return result;
}

export function migrateDesignCoordinates<T extends { objects?: ScalableObject[] }>(
  design: T,
  sourceDpi: number,
  targetDpi: number
): T {
  if (sourceDpi === targetDpi || !design.objects) return design;
  
  return {
    ...design,
    objects: design.objects.map(obj => migrateObjectCoordinates(obj, sourceDpi, targetDpi))
  };
}
