import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel?: () => void;
  isPending?: boolean;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  children?: React.ReactNode;
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  title,
  description,
  onConfirm,
  onCancel,
  isPending = false,
  confirmText = '확인',
  cancelText = '취소',
  variant = 'default',
  children
}: ConfirmModalProps) {
  const handleCancel = () => {
    onCancel?.();
    onClose();
  };

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription asChild={!!children}>
            {children || description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            disabled={isPending}
            className={variant === 'destructive' ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
