export const EDITOR_DISPLAY_DPI = 150;
export const PRINT_DPI = 300;
export const LEGACY_EDITOR_DPI = 300;

export interface EditorDpiConfig {
  editorDpi?: number;
}

export function getEffectiveEditorDpi(savedEditorDpi?: number | null): number {
  if (typeof savedEditorDpi === 'number' && savedEditorDpi > 0) {
    return savedEditorDpi;
  }
  return EDITOR_DISPLAY_DPI;
}

export function shouldMigrateDpi(sourceDpi: number, targetDpi: number): boolean {
  return sourceDpi !== targetDpi && sourceDpi > 0 && targetDpi > 0;
}

export function calculateDpiRatio(sourceDpi: number, targetDpi: number): number {
  if (!shouldMigrateDpi(sourceDpi, targetDpi)) {
    return 1;
  }
  return targetDpi / sourceDpi;
}

export interface ScalableCoordinates {
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

export function migrateCoordinates<T extends ScalableCoordinates>(
  obj: T,
  sourceDpi: number,
  targetDpi: number
): T {
  if (!shouldMigrateDpi(sourceDpi, targetDpi)) {
    return obj;
  }
  
  const ratio = calculateDpiRatio(sourceDpi, targetDpi);
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

export function migrateObjectsArray<T extends ScalableCoordinates>(
  objects: T[],
  sourceDpi: number,
  targetDpi: number
): T[] {
  if (!shouldMigrateDpi(sourceDpi, targetDpi)) {
    return objects;
  }
  return objects.map(obj => migrateCoordinates(obj, sourceDpi, targetDpi));
}

export interface DesignWithObjects<T extends ScalableCoordinates = ScalableCoordinates> {
  objects?: T[];
}

export function migrateDesign<T extends DesignWithObjects>(
  design: T,
  sourceDpi: number,
  targetDpi: number
): T {
  if (!shouldMigrateDpi(sourceDpi, targetDpi) || !design.objects) {
    return design;
  }
  
  return {
    ...design,
    objects: migrateObjectsArray(design.objects, sourceDpi, targetDpi)
  };
}

export function migrateDesignsArray<T extends DesignWithObjects>(
  designs: T[],
  sourceDpi: number,
  targetDpi: number
): T[] {
  if (!shouldMigrateDpi(sourceDpi, targetDpi)) {
    return designs;
  }
  return designs.map(design => migrateDesign(design, sourceDpi, targetDpi));
}

export interface SpreadWithObjects<T extends ScalableCoordinates = ScalableCoordinates> {
  objects?: T[];
}

export function migrateSpreadsArray<T extends SpreadWithObjects>(
  spreads: T[],
  sourceDpi: number,
  targetDpi: number
): T[] {
  if (!shouldMigrateDpi(sourceDpi, targetDpi)) {
    return spreads;
  }
  return spreads.map(spread => ({
    ...spread,
    objects: spread.objects ? migrateObjectsArray(spread.objects, sourceDpi, targetDpi) : spread.objects
  }));
}

export function createEditorDpiPayload(): { editorDpi: number } {
  return {
    editorDpi: EDITOR_DISPLAY_DPI
  };
}
