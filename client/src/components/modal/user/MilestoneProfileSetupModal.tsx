import React from "react";
import { useModalContext } from "@/contexts/ModalContext";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export function MilestoneProfileSetupModal({
    isOpen,
    onClose,
    profile,
    onSave,
    ProfileSetupComponent,
}: {
    isOpen?: boolean;
    onClose?: () => void;
    profile?: any;
    onSave?: (data: any) => void;
    ProfileSetupComponent: React.ComponentType<any>;
}) {
    const modal = useModalContext();

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <ProfileSetupComponent onSave={(data: any) => {
                    if (onSave) onSave(data);
                    if (modal.closeTopModal) modal.closeTopModal();
                    else if (onClose) onClose();
                }} profile={profile} />
            </DialogContent>
        </Dialog>
    );
}
