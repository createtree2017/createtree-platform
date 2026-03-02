import React from "react";
import { format } from "date-fns";
import { useModalContext } from "@/contexts/ModalContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export function MilestoneNoteDetailModal({
    isOpen,
    onClose,
    userMilestone,
}: {
    isOpen?: boolean;
    onClose?: () => void;
    userMilestone?: any;
}) {
    const modal = useModalContext();

    if (!userMilestone) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{userMilestone.milestone.title}</DialogTitle>
                    <DialogDescription>
                        {format(new Date(userMilestone.completedAt), "PPP")}에 완료됨
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>내 메모</Label>
                        <div className="p-4 bg-muted rounded-md">{userMilestone.notes}</div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
