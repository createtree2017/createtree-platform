import React from "react";
import { useModalContext } from "@/contexts/ModalContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function CancelApplicationConfirmModal({
    isOpen,
    onClose,
    onConfirm
}: {
    isOpen?: boolean;
    onClose?: () => void;
    onConfirm: () => void;
}) {
    const modal = useModalContext();

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            if (modal.closeTopModal) modal.closeTopModal();
            else if (onClose) onClose();
        }
    };

    return (
        <AlertDialog open={isOpen} onOpenChange={handleOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>신청을 취소하시겠습니까?</AlertDialogTitle>
                    <AlertDialogDescription>
                        신청을 취소하면 현재 신청 내역이 취소됩니다. 다시 신청하실 수 있습니다.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => handleOpenChange(false)}>취소</AlertDialogCancel>
                    <AlertDialogAction
                        className="bg-red-500 hover:bg-red-600"
                        onClick={() => {
                            onConfirm();
                            handleOpenChange(false);
                        }}
                    >
                        신청 취소
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
