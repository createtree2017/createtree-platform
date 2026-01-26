import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface SubmissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SubmissionDetailModal({ isOpen, onClose }: SubmissionDetailModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>제출 상세</DialogTitle>
          <DialogDescription>제출 상세 모달 - 구현 예정</DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
