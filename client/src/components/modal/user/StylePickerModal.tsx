import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Style {
  value: string;
  label: string;
  thumbnailUrl: string;
  visibilityType?: string;
}

interface StylePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  styles: Style[];
  selectedStyle: string;
  onSelect: (styleValue: string) => void;
}

export function StylePickerModal({ 
  isOpen, 
  onClose, 
  styles,
  selectedStyle,
  onSelect
}: StylePickerModalProps) {
  const handleSelect = (styleValue: string) => {
    onSelect(styleValue);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>스타일 선택</DialogTitle>
          <DialogDescription>
            원하는 스타일을 선택해주세요
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
          {styles.map((style) => (
            <div
              key={style.value}
              onClick={() => handleSelect(style.value)}
              className={cn(
                "relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105",
                selectedStyle === style.value 
                  ? "border-purple-500 ring-2 ring-purple-200" 
                  : "border-gray-200 hover:border-purple-300"
              )}
            >
              {style.thumbnailUrl && (
                <div className="relative w-full aspect-square">
                  <img 
                    src={style.thumbnailUrl}
                    alt={style.label}
                    className="w-full h-full object-cover"
                  />
                  {style.visibilityType === "hospital" && (
                    <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">
                      전용
                    </div>
                  )}
                </div>
              )}
              <div className="p-2">
                <div className="flex items-center justify-center gap-1">
                  <h3 className="font-medium text-sm text-center">{style.label}</h3>
                </div>
              </div>
              {selectedStyle === style.value && (
                <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1">
                  <Check className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
