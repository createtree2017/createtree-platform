import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface ApprovedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApprovedUsersModal({ isOpen, onClose }: ApprovedUsersModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>승인된 사용자</DialogTitle>
          <DialogDescription>승인된 사용자 모달 - 구현 예정</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
