import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Image, Check } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Template {
  id: number;
  title: string;
  thumbnailUrl?: string;
}

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: Template[];
  selectedTemplateId?: number | null;
  onSelect: (template: Template) => void;
  isLoading?: boolean;
}

export function TemplatePickerModal({
  isOpen,
  onClose,
  templates,
  selectedTemplateId,
  onSelect,
  isLoading = false
}: TemplatePickerModalProps) {
  const [currentSelectedId, setCurrentSelectedId] = useState<number | null>(selectedTemplateId || null);

  useEffect(() => {
    if (isOpen) {
      setCurrentSelectedId(selectedTemplateId || null);
    }
  }, [isOpen, selectedTemplateId]);

  const handleSave = () => {
    if (currentSelectedId) {
      const template = templates.find(t => t.id === currentSelectedId);
      if (template) {
        onSelect(template);
        onClose();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>에디터 템플릿 선택</DialogTitle>
          <DialogDescription>
            사용자가 에디터를 열 때 적용할 템플릿을 선택하세요
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>등록된 행사 템플릿이 없습니다.</p>
              <p className="text-sm mt-2">먼저 행사 에디터에서 템플릿을 만들어주세요.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className={`relative cursor-pointer rounded-lg border-2 p-2 transition-all hover:shadow-md ${currentSelectedId === template.id
                    ? 'border-primary bg-primary/5'
                    : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  onClick={() => setCurrentSelectedId(template.id)}
                >
                  {template.thumbnailUrl ? (
                    <img
                      src={template.thumbnailUrl}
                      alt={template.title}
                      className="w-full aspect-[3/4] object-cover rounded"
                    />
                  ) : (
                    <div className="w-full aspect-[3/4] flex items-center justify-center bg-muted rounded">
                      <Image className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="mt-2">
                    <p className="text-sm font-medium truncate">{template.title}</p>
                    <p className="text-xs text-muted-foreground">ID: {template.id}</p>
                  </div>
                  {currentSelectedId === template.id && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="mr-2">
            취소
          </Button>
          <Button
            onClick={handleSave}
            disabled={!currentSelectedId || currentSelectedId === selectedTemplateId}
          >
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
