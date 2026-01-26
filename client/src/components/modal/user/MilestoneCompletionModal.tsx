import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface Milestone {
  id: number;
  milestoneId: string;
  title: string;
  description: string;
  encouragementMessage: string;
}

interface MilestoneCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: Milestone | null;
  onComplete: (milestoneId: string, notes?: string) => void;
}

export function MilestoneCompletionModal({ 
  isOpen, 
  onClose, 
  milestone,
  onComplete
}: MilestoneCompletionModalProps) {
  const [notes, setNotes] = useState("");

  if (!milestone) return null;

  const handleComplete = () => {
    onComplete(milestone.milestoneId, notes);
    setNotes("");
    onClose();
  };

  const handleClose = () => {
    setNotes("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>마일스톤 완료: {milestone.title}</DialogTitle>
          <DialogDescription>
            {milestone.encouragementMessage}
          </DialogDescription>
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
          <Button variant="outline" onClick={handleClose}>취소</Button>
          <Button onClick={handleComplete}>마일스톤 완료</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
