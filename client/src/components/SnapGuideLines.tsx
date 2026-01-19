/**
 * 스냅 가이드 라인 시각화 컴포넌트
 * 드래그 중 활성화된 스냅 라인을 캔버스 위에 표시
 */

import type { ActiveSnapLine } from '@/utils/snapGuide';

interface SnapGuideLinesProps {
  activeLines: ActiveSnapLine[];
  canvasWidth: number;
  canvasHeight: number;
  scale?: number;
  color?: string;
}

export function SnapGuideLines({
  activeLines,
  canvasWidth,
  canvasHeight,
  scale = 1,
  color = '#FF00FF',
}: SnapGuideLinesProps) {
  if (activeLines.length === 0) return null;

  const lineWidth = 1 / scale;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-50"
      style={{ width: canvasWidth, height: canvasHeight }}
      viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}
      preserveAspectRatio="none"
    >
      {activeLines.map((line, index) => {
        if (line.direction === 'vertical') {
          return (
            <line
              key={`v-${index}-${line.position}`}
              x1={line.position}
              y1={0}
              x2={line.position}
              y2={canvasHeight}
              stroke={color}
              strokeWidth={lineWidth}
              strokeDasharray={`${4 / scale} ${4 / scale}`}
            />
          );
        } else {
          return (
            <line
              key={`h-${index}-${line.position}`}
              x1={0}
              y1={line.position}
              x2={canvasWidth}
              y2={line.position}
              stroke={color}
              strokeWidth={lineWidth}
              strokeDasharray={`${4 / scale} ${4 / scale}`}
            />
          );
        }
      })}
    </svg>
  );
}
