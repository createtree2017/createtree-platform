import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface SubMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubMissionModal({ isOpen, onClose }: SubMissionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>세부 미션</DialogTitle>
          <DialogDescription>세부 미션 모달 - 구현 예정</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
