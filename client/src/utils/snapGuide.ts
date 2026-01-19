/**
 * 스냅 가이드 유틸리티
 * 캔버스 에디터에서 오브젝트 정렬을 위한 자석(스냅) 기능 제공
 * 모든 에디터(photobook, postcard, party)에서 공통으로 사용
 */

import type { CanvasObject } from '@/types/editor';

export interface SnapConfig {
  threshold: number;
  enabled: boolean;
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  threshold: 8,
  enabled: true,
};

export type SnapLineType = 'canvas' | 'object';
export type SnapDirection = 'horizontal' | 'vertical';

export interface SnapLine {
  type: SnapLineType;
  direction: SnapDirection;
  position: number;
  sourceObjectId?: string;
}

export interface ActiveSnapLine extends SnapLine {
  start: number;
  end: number;
}

export interface SnapResult {
  x: number;
  y: number;
  snappedX: boolean;
  snappedY: boolean;
  activeLines: ActiveSnapLine[];
}

export interface CanvasBounds {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
}

export interface ObjectBounds {
  id: string;
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

function getObjectBounds(obj: CanvasObject): ObjectBounds {
  return {
    id: obj.id,
    left: obj.x,
    top: obj.y,
    right: obj.x + obj.width,
    bottom: obj.y + obj.height,
    centerX: obj.x + obj.width / 2,
    centerY: obj.y + obj.height / 2,
  };
}

export function calculateSnapLines(
  canvas: CanvasBounds,
  objects: CanvasObject[],
  excludeObjectId?: string
): SnapLine[] {
  const lines: SnapLine[] = [];
  const offsetX = canvas.offsetX || 0;
  const offsetY = canvas.offsetY || 0;

  lines.push(
    { type: 'canvas', direction: 'vertical', position: offsetX },
    { type: 'canvas', direction: 'vertical', position: offsetX + canvas.width / 2 },
    { type: 'canvas', direction: 'vertical', position: offsetX + canvas.width },
    { type: 'canvas', direction: 'horizontal', position: offsetY },
    { type: 'canvas', direction: 'horizontal', position: offsetY + canvas.height / 2 },
    { type: 'canvas', direction: 'horizontal', position: offsetY + canvas.height }
  );

  for (const obj of objects) {
    if (obj.id === excludeObjectId) continue;

    const bounds = getObjectBounds(obj);

    lines.push(
      { type: 'object', direction: 'vertical', position: bounds.left, sourceObjectId: obj.id },
      { type: 'object', direction: 'vertical', position: bounds.centerX, sourceObjectId: obj.id },
      { type: 'object', direction: 'vertical', position: bounds.right, sourceObjectId: obj.id },
      { type: 'object', direction: 'horizontal', position: bounds.top, sourceObjectId: obj.id },
      { type: 'object', direction: 'horizontal', position: bounds.centerY, sourceObjectId: obj.id },
      { type: 'object', direction: 'horizontal', position: bounds.bottom, sourceObjectId: obj.id }
    );
  }

  return lines;
}

interface SnapCandidate {
  line: SnapLine;
  distance: number;
  snappedValue: number;
  objectEdge: 'left' | 'center' | 'right' | 'top' | 'bottom';
}

export function findNearestSnap(
  objectX: number,
  objectY: number,
  objectWidth: number,
  objectHeight: number,
  snapLines: SnapLine[],
  config: SnapConfig = DEFAULT_SNAP_CONFIG
): SnapResult {
  if (!config.enabled) {
    return {
      x: objectX,
      y: objectY,
      snappedX: false,
      snappedY: false,
      activeLines: [],
    };
  }

  const objectLeft = objectX;
  const objectRight = objectX + objectWidth;
  const objectCenterX = objectX + objectWidth / 2;
  const objectTop = objectY;
  const objectBottom = objectY + objectHeight;
  const objectCenterY = objectY + objectHeight / 2;

  const verticalCandidates: SnapCandidate[] = [];
  const horizontalCandidates: SnapCandidate[] = [];

  for (const line of snapLines) {
    if (line.direction === 'vertical') {
      const edges: { value: number; edge: 'left' | 'center' | 'right' }[] = [
        { value: objectLeft, edge: 'left' },
        { value: objectCenterX, edge: 'center' },
        { value: objectRight, edge: 'right' },
      ];

      for (const { value, edge } of edges) {
        const distance = Math.abs(value - line.position);
        if (distance <= config.threshold) {
          let snappedValue: number;
          if (edge === 'left') snappedValue = line.position;
          else if (edge === 'center') snappedValue = line.position - objectWidth / 2;
          else snappedValue = line.position - objectWidth;

          verticalCandidates.push({ line, distance, snappedValue, objectEdge: edge });
        }
      }
    } else {
      const edges: { value: number; edge: 'top' | 'center' | 'bottom' }[] = [
        { value: objectTop, edge: 'top' },
        { value: objectCenterY, edge: 'center' },
        { value: objectBottom, edge: 'bottom' },
      ];

      for (const { value, edge } of edges) {
        const distance = Math.abs(value - line.position);
        if (distance <= config.threshold) {
          let snappedValue: number;
          if (edge === 'top') snappedValue = line.position;
          else if (edge === 'center') snappedValue = line.position - objectHeight / 2;
          else snappedValue = line.position - objectHeight;

          horizontalCandidates.push({ line, distance, snappedValue, objectEdge: edge });
        }
      }
    }
  }

  let resultX = objectX;
  let resultY = objectY;
  let snappedX = false;
  let snappedY = false;
  const activeLines: ActiveSnapLine[] = [];

  if (verticalCandidates.length > 0) {
    verticalCandidates.sort((a, b) => a.distance - b.distance);
    const best = verticalCandidates[0];
    resultX = best.snappedValue;
    snappedX = true;

    activeLines.push({
      ...best.line,
      start: 0,
      end: 99999,
    });
  }

  if (horizontalCandidates.length > 0) {
    horizontalCandidates.sort((a, b) => a.distance - b.distance);
    const best = horizontalCandidates[0];
    resultY = best.snappedValue;
    snappedY = true;

    activeLines.push({
      ...best.line,
      start: 0,
      end: 99999,
    });
  }

  return {
    x: Math.round(resultX),
    y: Math.round(resultY),
    snappedX,
    snappedY,
    activeLines,
  };
}

export function applySnap(
  objectX: number,
  objectY: number,
  objectWidth: number,
  objectHeight: number,
  canvas: CanvasBounds,
  objects: CanvasObject[],
  excludeObjectId: string,
  config: SnapConfig = DEFAULT_SNAP_CONFIG
): SnapResult {
  const snapLines = calculateSnapLines(canvas, objects, excludeObjectId);
  return findNearestSnap(objectX, objectY, objectWidth, objectHeight, snapLines, config);
}
