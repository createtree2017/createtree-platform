import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategoryModal({ isOpen, onClose }: CategoryModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>카테고리</DialogTitle>
          <DialogDescription>카테고리 모달 - 구현 예정</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
