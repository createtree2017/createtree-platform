import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface ActionTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActionTypeModal({ isOpen, onClose }: ActionTypeModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>액션 타입</DialogTitle>
          <DialogDescription>액션 타입 모달 - 구현 예정</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
