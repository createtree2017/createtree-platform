import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { sanitizeHtml } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface SubMission {
  id: number;
  title: string;
  description?: string;
  requireReview: boolean;
  submissionTypes?: string[];
  actionType?: {
    id: number;
    name: string;
  };
  submission?: {
    id: number;
    submissionData: any;
    status: string;
    isLocked: boolean;
    submittedAt: string;
    reviewNotes?: string;
  } | null;
}

interface SubMissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  subMission: SubMission | null;
  getSubMissionStatusBadge: (status: string) => React.ReactNode;
  getActionTypeBadgeStyle: (name?: string) => string;
  getActionTypeIcon: (name?: string) => any;
  children?: React.ReactNode;
}

import { useModalContext } from '@/contexts/ModalContext';

export function SubMissionDetailModal({
  isOpen,
  onClose,
  subMission,
  actionTypeBadgeStyle,
  ActionIcon,
  FormComponent,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  subMission: any;
  actionTypeBadgeStyle?: string;
  ActionIcon?: any;
  FormComponent?: React.ComponentType;
}) {
  const modal = useModalContext();

  if (!subMission) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      if (modal.closeTopModal) modal.closeTopModal();
      else if (onClose) onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {subMission.actionType?.name && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${actionTypeBadgeStyle}`}>
                {ActionIcon && <ActionIcon className="h-3 w-3" />}
                {subMission.actionType.name}
              </span>
            )}
            {subMission.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {subMission.description && (
            <div
              className="text-sm whitespace-pre-wrap p-3 bg-muted/30 rounded-lg"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(subMission.description) }}
            />
          )}

          {subMission.requireReview && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
              <AlertCircle className="h-4 w-4" />
              <span>이 미션은 관리자 검토가 필요합니다</span>
            </div>
          )}

          {subMission.submission?.status === 'rejected' && subMission.submission.reviewNotes && (
            <div className="bg-destructive/10 border border-destructive/20 p-3 rounded text-sm">
              <p className="font-medium text-destructive mb-1">보류 사유:</p>
              <p className="text-destructive/90">{subMission.submission.reviewNotes}</p>
            </div>
          )}

          {FormComponent && <FormComponent />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
