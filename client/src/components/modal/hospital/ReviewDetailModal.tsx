import React from "react";
import { useModalContext } from "@/contexts/ModalContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface Review {
    id: number;
    reviewUrl: string;
    isSelected: boolean;
    createdAt: string;
    user: {
        id: number;
        username: string;
        email: string;
    };
}

export function ReviewDetailModal({
    isOpen,
    onClose,
    review,
}: {
    isOpen?: boolean;
    onClose?: () => void;
    review?: Review;
}) {
    const modal = useModalContext();

    if (!review) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>후기 내용</DialogTitle>
                    <DialogDescription>
                        {review.user.username}님의 후기
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4">
                    <iframe
                        src={review.reviewUrl}
                        className="w-full h-96 border rounded"
                        title="후기 내용"
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
