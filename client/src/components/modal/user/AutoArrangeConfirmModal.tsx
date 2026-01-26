import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface AutoArrangeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  isTight: boolean;
  onTightChange: (checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function AutoArrangeConfirmModal({ 
  isOpen, 
  onClose, 
  message,
  isTight,
  onTightChange,
  onConfirm,
  onCancel
}: AutoArrangeConfirmModalProps) {
  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>자동 정렬</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>{message}</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTight}
                  onChange={(e) => onTightChange(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">밀착 (이미지 사이 여백 없음)</span>
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>취소</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>확인</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
