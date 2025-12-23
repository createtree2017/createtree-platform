export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 9);
};

export const screenToCanvasCoordinates = (
  screenX: number,
  screenY: number,
  canvasRect: DOMRect,
  scale: number
) => {
  return {
    x: (screenX - canvasRect.left) / scale,
    y: (screenY - canvasRect.top) / scale,
  };
};

export const snapToGrid = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
};
