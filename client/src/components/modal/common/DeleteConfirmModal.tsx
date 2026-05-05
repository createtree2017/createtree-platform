import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  itemName?: string;
  itemDescription?: string;
  onConfirm: () => Promise<void> | void;
  isPending?: boolean;
  confirmText?: string;
  cancelText?: string;
}

export function DeleteConfirmModal({ 
  isOpen, 
  onClose, 
  title = '삭제 확인',
  description = '정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
  itemName,
  itemDescription,
  onConfirm,
  isPending = false,
  confirmText = '삭제',
  cancelText = '취소'
}: DeleteConfirmModalProps) {
  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description}
            {(itemName || itemDescription) && (
              <span className="mt-3 block rounded-md bg-muted p-3 text-sm">
                {itemName && <span className="block font-medium text-foreground">{itemName}</span>}
                {itemDescription && <span className="mt-1 block text-muted-foreground">{itemDescription}</span>}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onClose}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
