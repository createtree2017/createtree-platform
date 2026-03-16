interface LayoutPickerProps {
  selectedLayout: '2' | '6' | '12' | '24' | null;
  onSelectLayout: (layout: '2' | '6' | '12' | '24') => void;
  selectedCount: number;
}

// 미니 그리드 프리뷰 컴포넌트
function GridPreview({ cols, rows }: { cols: number; rows: number }) {
  const cells = Array.from({ length: cols * rows });
  return (
    <div
      className="grid gap-[2px] w-8 h-8"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
    >
      {cells.map((_, i) => (
        <div key={i} className="rounded-[1px] bg-current opacity-70" />
      ))}
    </div>
  );
}

export default function CollageLayoutPicker({
  selectedLayout,
  onSelectLayout,
  selectedCount,
}: LayoutPickerProps) {
  const layouts = [
    { value: '2' as const,  label: '2분할',  cols: 1, rows: 2, required: 2 },
    { value: '6' as const,  label: '6분할',  cols: 2, rows: 3, required: 6 },
    { value: '12' as const, label: '12분할', cols: 3, rows: 4, required: 12 },
    { value: '24' as const, label: '24분할', cols: 4, rows: 6, required: 24 },
  ];

  return (
    <div className="flex gap-2">
      {layouts.map((layout) => {
        const isSelected = selectedLayout === layout.value;
        const hasCorrectCount = selectedCount === layout.required;

        return (
          <button
            key={layout.value}
            onClick={() => onSelectLayout(layout.value)}
            className={`
              flex-1 flex flex-col items-center justify-center gap-1.5
              py-3 px-1 rounded-xl border transition-all duration-200
              ${isSelected
                ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-500/20'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'}
            `}
          >
            <GridPreview cols={layout.cols} rows={layout.rows} />
            <span className="text-[11px] font-semibold tracking-tight leading-none">
              {layout.label}
            </span>
            {isSelected && (
              <span
                className={`text-[10px] leading-none font-medium ${
                  hasCorrectCount ? 'text-green-300' : 'text-yellow-300'
                }`}
              >
                {selectedCount}/{layout.required}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}