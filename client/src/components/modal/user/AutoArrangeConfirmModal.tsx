import { useState, useEffect } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';

interface AutoArrangeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  initialIsTight?: boolean;
  onConfirm: (isTight: boolean) => void;
  onCancel: () => void;
}

export function AutoArrangeConfirmModal({ 
  isOpen, 
  onClose, 
  message,
  initialIsTight = false,
  onConfirm,
  onCancel
}: AutoArrangeConfirmModalProps) {
  const [isTight, setIsTight] = useState(initialIsTight);

  useEffect(() => {
    if (isOpen) {
      setIsTight(initialIsTight);
    }
  }, [isOpen, initialIsTight]);

  const handleCancel = () => {
    onCancel();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm(isTight);
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
                <Checkbox
                  id="tight-checkbox"
                  checked={isTight}
                  onCheckedChange={(checked) => setIsTight(checked === true)}
                />
                <span className="text-sm text-muted-foreground">밀착 (이미지 사이 여백 없음)</span>
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
