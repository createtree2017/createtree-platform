import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface CampaignMilestone {
  id: number;
  milestoneId: string;
  title: string;
  description: string;
  content: string;
  type: 'campaign';
  headerImageUrl?: string;
  campaignStartDate: string;
  campaignEndDate: string;
  selectionStartDate: string;
  selectionEndDate: string;
  categoryId: string;
  hospitalId: number;
  category?: {
    id: string;
    name: string;
  };
  hospital?: {
    id: number;
    name: string;
  };
}

interface MilestoneDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestone: CampaignMilestone | null;
  isDuringCampaign: boolean;
  hasApplication: boolean;
  onApply: () => void;
}

export function MilestoneDetailModal({ 
  isOpen, 
  onClose, 
  milestone,
  isDuringCampaign,
  hasApplication,
  onApply
}: MilestoneDetailModalProps) {
  if (!milestone) return null;

  const campaignStart = new Date(milestone.campaignStartDate);
  const campaignEnd = new Date(milestone.campaignEndDate);
  const selectionStart = new Date(milestone.selectionStartDate);
  const selectionEnd = new Date(milestone.selectionEndDate);

  const handleApply = () => {
    onApply();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
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
              <p className="text-sm">{format(campaignStart, "yyyy.MM.dd")} - {format(campaignEnd, "yyyy.MM.dd")}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">🏆 선정 기간</h4>
              <p className="text-sm">{format(selectionStart, "yyyy.MM.dd")} - {format(selectionEnd, "yyyy.MM.dd")}</p>
            </div>
          </div>

          <div>
            <h4 className="font-semibold mb-2">🏥 참여 대상</h4>
            <p className="text-sm">{milestone.hospital?.name} 이용자</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          {isDuringCampaign && !hasApplication && (
            <Button onClick={handleApply}>
              신청하기
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
