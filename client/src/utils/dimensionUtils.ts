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
