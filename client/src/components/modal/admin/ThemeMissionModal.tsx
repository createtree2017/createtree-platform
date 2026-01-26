import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface ThemeMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ThemeMissionModal({ isOpen, onClose }: ThemeMissionModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>주제 미션</DialogTitle>
          <DialogDescription>주제 미션 모달 - 구현 예정</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
