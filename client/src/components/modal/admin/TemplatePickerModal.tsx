import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TemplatePickerModal({ isOpen, onClose }: TemplatePickerModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>템플릿 선택</DialogTitle>
          <DialogDescription>템플릿 선택 모달 - 구현 예정</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
