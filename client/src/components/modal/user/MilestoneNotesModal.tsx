import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';

interface Milestone {
  id: number;
  milestoneId: string;
  title: string;
}

interface UserMilestone {
  id: number;
  milestoneId: string;
  completedAt: string;
  notes?: string;
  milestone: Milestone;
}

interface MilestoneNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userMilestone: UserMilestone | null;
}

export function MilestoneNotesModal({ 
  isOpen, 
  onClose, 
  userMilestone
}: MilestoneNotesModalProps) {
  if (!userMilestone) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
            <div className="p-4 bg-muted rounded-md">
              {userMilestone.notes}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
