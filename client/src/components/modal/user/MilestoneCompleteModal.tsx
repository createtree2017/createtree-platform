import React, { useState } from "react";
import { useModalContext } from "@/contexts/ModalContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MilestoneCompleteModal({
    isOpen,
    onClose,
    milestone,
    onComplete,
}: {
    isOpen?: boolean;
    onClose?: () => void;
    milestone?: any;
    onComplete?: (milestoneId: string, notes?: string) => void;
}) {
    const modal = useModalContext();
    const [notes, setNotes] = useState("");

    if (!milestone) return null;

    const handleComplete = () => {
        if (onComplete) {
            onComplete(milestone.milestoneId, notes);
        }
        if (modal.closeTopModal) modal.closeTopModal();
        else if (onClose) onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>마일스톤 완료: {milestone.title}</DialogTitle>
                    <DialogDescription>{milestone.encouragementMessage}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="notes">개인 메모 추가 (선택사항)</Label>
                        <Textarea
                            id="notes"
                            placeholder="이 마일스톤을 달성했을 때 어떤 느낌이었나요?"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
                        취소
                    </Button>
                    <Button onClick={handleComplete}>마일스톤 완료</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
