import React from "react";
import { format } from "date-fns";
import { useModalContext } from "@/contexts/ModalContext";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// 복사해온 CampaignMilestone 타입 (또는 shared에서 import할  있으면 교체)
interface CampaignMilestone {
    milestoneId: string;
    title: string;
    content: string;
    campaignStartDate: string;
    campaignEndDate: string;
    selectionStartDate: string;
    selectionEndDate: string;
    category?: { name: string };
    hospital?: { name: string };
}

export function CampaignMilestoneDetailModal({
    isOpen,
    onClose,
    milestone,
    isDuringCampaign,
    userApplication,
    onApply,
}: {
    isOpen?: boolean;
    onClose?: () => void;
    milestone?: CampaignMilestone;
    isDuringCampaign?: boolean;
    userApplication?: any;
    onApply?: (milestoneId: string) => void;
}) {
    const modal = useModalContext();

    if (!milestone) return null;

    const campaignStart = new Date(milestone.campaignStartDate);
    const campaignEnd = new Date(milestone.campaignEndDate);
    const selectionStart = new Date(milestone.selectionStartDate);
    const selectionEnd = new Date(milestone.selectionEndDate);

    const handleApply = () => {
        if (onApply) {
            onApply(milestone.milestoneId);
        }
        if (modal.closeTopModal) modal.closeTopModal();
        else if (onClose) onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        🎯 {milestone.title}
                        <Badge variant="secondary">참여형</Badge>
                    </DialogTitle>
                    <DialogDescription>
                        {milestone.category?.name} • {milestone.hospital?.name}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <h4 className="font-semibold mb-2">참여 안내</h4>
                        <p className="text-sm text-muted-foreground">{milestone.content}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <h4 className="font-semibold mb-2">📅 참여 기간</h4>
                            <p className="text-sm">
                                {format(campaignStart, "yyyy.MM.dd")} - {format(campaignEnd, "yyyy.MM.dd")}
                            </p>
                        </div>
                        <div>
                            <h4 className="font-semibold mb-2">🏆 선정 기간</h4>
                            <p className="text-sm">
                                {format(selectionStart, "yyyy.MM.dd")} - {format(selectionEnd, "yyyy.MM.dd")}
                            </p>
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold mb-2">🏥 참여 대상</h4>
                        <p className="text-sm">{milestone.hospital?.name} 이용자</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
                        닫기
                    </Button>
                    {isDuringCampaign && !userApplication && (
                        <Button onClick={handleApply}>
                            신청하기
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
