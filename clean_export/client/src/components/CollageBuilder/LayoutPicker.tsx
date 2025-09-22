import { Grid2X2 } from 'lucide-react';

interface LayoutPickerProps {
  selectedLayout: '2' | '6' | '12' | '24' | null;
  onSelectLayout: (layout: '2' | '6' | '12' | '24') => void;
  selectedCount: number;
}

export default function CollageLayoutPicker({ 
  selectedLayout, 
  onSelectLayout, 
  selectedCount 
}: LayoutPickerProps) {
  const layouts = [
    {
      value: '2' as const,
      label: '2분할',
      grid: '1×2',
      description: '비교 이미지',
      preview: (
        <div className="grid grid-cols-1 gap-1">
          <div className="bg-gray-600 h-8 rounded"></div>
          <div className="bg-gray-600 h-8 rounded"></div>
        </div>
      )
    },
    {
      value: '6' as const,
      label: '6분할',
      grid: '2×3',
      description: '미니 앨범',
      preview: (
        <div className="grid grid-cols-2 gap-1">
          <div className="bg-gray-600 h-4 rounded"></div>
          <div className="bg-gray-600 h-4 rounded"></div>
          <div className="bg-gray-600 h-4 rounded"></div>
          <div className="bg-gray-600 h-4 rounded"></div>
          <div className="bg-gray-600 h-4 rounded"></div>
          <div className="bg-gray-600 h-4 rounded"></div>
        </div>
      )
    },
    {
      value: '12' as const,
      label: '12분할',
      grid: '3×4',
      description: '달력 형태',
      preview: (
        <div className="grid grid-cols-3 gap-0.5">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="bg-gray-600 h-3 rounded"></div>
          ))}
        </div>
      )
    },
    {
      value: '24' as const,
      label: '24분할',
      grid: '4×6',
      description: '스티커 시트',
      preview: (
        <div className="grid grid-cols-4 gap-0.5">
          {[...Array(24)].map((_, i) => (
            <div key={i} className="bg-gray-600 h-2 rounded"></div>
          ))}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-3">
      {layouts.map((layout) => {
        const isSelected = selectedLayout === layout.value;
        const requiredCount = parseInt(layout.value);
        const hasCorrectCount = selectedCount === requiredCount;
        
        return (
          <button
            key={layout.value}
            onClick={() => onSelectLayout(layout.value)}
            className={`w-full p-4 rounded-lg border transition-all ${
              isSelected 
                ? 'bg-purple-600 border-purple-500 text-white' 
                : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="w-16 h-16 bg-gray-800 rounded p-1 flex-shrink-0">
                {layout.preview}
              </div>
              <div className="text-left flex-1">
                <div className="font-semibold flex items-center gap-2">
                  {layout.label}
                  <span className="text-xs opacity-80">({layout.grid})</span>
                </div>
                <div className="text-xs opacity-80 mt-1">{layout.description}</div>
                {isSelected && (
                  <div className={`text-xs mt-2 ${hasCorrectCount ? 'text-green-400' : 'text-yellow-400'}`}>
                    {selectedCount} / {requiredCount} 개 선택됨
                  </div>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}