import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { formatDateTime } from '@/lib/dateUtils';
import { sanitizeHtml } from '@/lib/utils';

interface SubmissionDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  submission: any;
  themeMissionTitle?: string;
  subMissionTitle?: string;
  onApprove: (notes: string) => Promise<void>;
  onReject: (notes: string) => Promise<void>;
  isApprovePending?: boolean;
  isRejectPending?: boolean;
  renderSubmissionContent: (data: any) => JSX.Element;
}

export function SubmissionDetailModal({ 
  isOpen, 
  onClose, 
  submission,
  themeMissionTitle,
  subMissionTitle,
  onApprove,
  onReject,
  isApprovePending = false,
  isRejectPending = false,
  renderSubmissionContent
}: SubmissionDetailModalProps) {
  const [reviewNotes, setReviewNotes] = useState("");

  const handleApprove = async () => {
    await onApprove(reviewNotes);
    setReviewNotes("");
  };

  const handleReject = async () => {
    await onReject(reviewNotes);
    setReviewNotes("");
  };

  if (!submission) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>제출 내용 검수</DialogTitle>
          <DialogDescription>
            사용자가 제출한 내용을 확인하고 승인 또는 보류하세요
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 overflow-y-auto flex-1 pr-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <Label className="text-sm text-muted-foreground">사용자</Label>
              <p className="font-medium">
                <span>{submission.user?.fullName || '-'}</span>
                <span className="text-sm text-gray-500 ml-1">({submission.user?.username || submission.user?.email || '-'})</span>
              </p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">전화번호</Label>
              <p className="font-medium">{submission.user?.phoneNumber || '-'}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">제출일시</Label>
              <p className="font-medium">{formatDateTime(submission.submittedAt)}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">상태</Label>
              <p className="font-medium">
                {submission.status === 'approved' ? '승인' :
                 submission.status === 'rejected' ? '보류' : '검수 대기'}
              </p>
            </div>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">주제 미션</Label>
            <p className="font-medium">{themeMissionTitle || '-'}</p>
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">세부 미션</Label>
            <p className="font-medium">{subMissionTitle || '-'}</p>
            {submission.subMission?.description && (
              <div 
                className="text-sm text-muted-foreground mt-1"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(submission.subMission.description) }}
              />
            )}
          </div>
          <div>
            <Label className="text-sm text-muted-foreground">제출 내용</Label>
            <Card className="mt-2 p-4 bg-muted/50">
              {renderSubmissionContent(submission.submissionData)}
            </Card>
          </div>
          <div>
            <Label htmlFor="review-notes">검수 의견 (선택)</Label>
            <Textarea
              id="review-notes"
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="검수 의견을 입력하세요..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={handleReject}
            disabled={isRejectPending}
          >
            {isRejectPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            보류
          </Button>
          <Button
            onClick={handleApprove}
            disabled={isApprovePending}
          >
            {isApprovePending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            승인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
