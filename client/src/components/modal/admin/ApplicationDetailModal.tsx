import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2, Download, Eye } from 'lucide-react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';

interface ApplicationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  application?: any;
  onSuccess?: () => void;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'approved': return 'bg-green-100 text-green-800';
    case 'rejected': return 'bg-red-100 text-red-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'cancelled': return 'bg-gray-100 text-gray-800';
    case 'expired': return 'bg-orange-100 text-orange-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'approved': return '승인됨';
    case 'rejected': return '보류됨';
    case 'pending': return '대기 중';
    case 'cancelled': return '취소됨';
    case 'expired': return '만료됨';
    default: return status;
  }
}

export function ApplicationDetailModal({ 
  isOpen, 
  onClose, 
  application,
  onSuccess 
}: ApplicationDetailModalProps) {
  const queryClient = useQueryClient();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleApproval = async (status: 'approved' | 'rejected' | 'cancelled') => {
    if (!application) return;
    
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/milestone-applications/${application.id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(`신청 ${status === 'approved' ? '승인' : status === 'rejected' ? '보류' : '취소'}에 실패했습니다.`);
      }

      const statusMessage = status === 'approved' ? '승인' : status === 'rejected' ? '보류' : '취소';
      toast({
        title: "처리 완료",
        description: `신청이 ${statusMessage}되었습니다.`,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/admin/milestone-applications"] });
      onSuccess?.();
      onClose();

    } catch (error) {
      console.error("신청 처리 오류:", error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "신청 처리에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!application) return null;

  const isPending = application.status === 'pending';
  const isApproved = application.status === 'approved';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>신청 상세 정보</DialogTitle>
          <DialogDescription>
            신청 ID: #{application.id}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">신청자</Label>
              <div className="mt-1">
                <div className="font-medium">{application.user?.username}</div>
                <div className="text-sm text-gray-500">{application.user?.email}</div>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">상태</Label>
              <div className="mt-1">
                <Badge className={getStatusColor(application.status)}>
                  {getStatusLabel(application.status)}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">신청일시</Label>
              <div className="mt-1 text-sm">
                {new Date(application.appliedAt).toLocaleString()}
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">처리일시</Label>
              <div className="mt-1 text-sm">
                {application.processedAt 
                  ? new Date(application.processedAt).toLocaleString() 
                  : '미처리'}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">마일스톤 정보</Label>
            <Card className="mt-2 p-4">
              <div className="space-y-2">
                <div className="font-medium">{application.milestone?.title}</div>
                <div className="text-sm text-gray-600">{application.milestone?.description}</div>
                <div className="text-xs text-gray-500">
                  카테고리: {application.milestone?.category?.name}
                </div>
              </div>
            </Card>
          </div>

          {application.applicationData && (
            <div>
              <Label className="text-sm font-medium">신청 내용</Label>
              <Card className="mt-2 p-4">
                <pre className="text-sm whitespace-pre-wrap">
                  {typeof application.applicationData === 'string' 
                    ? application.applicationData 
                    : JSON.stringify(application.applicationData, null, 2)}
                </pre>
              </Card>
            </div>
          )}

          {application.files && application.files.length > 0 && (
            <div>
              <Label className="text-sm font-medium">첨부 파일 ({application.files.length}개)</Label>
              <div className="mt-2 space-y-2">
                {application.files.map((file: any) => (
                  <Card key={file.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{file.fileName}</div>
                        <div className="text-xs text-gray-500">
                          {file.fileType} • {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={file.fileUrl} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-4 w-4 mr-1" />
                            보기
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <a href={file.fileUrl} download={file.fileName}>
                            <Download className="h-4 w-4 mr-1" />
                            다운로드
                          </a>
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {application.adminNote && (
            <div>
              <Label className="text-sm font-medium">관리자 메모</Label>
              <Card className="mt-2 p-4">
                <p className="text-sm">{application.adminNote}</p>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          {isPending && (
            <>
              <Button 
                variant="destructive" 
                onClick={() => handleApproval('rejected')}
                disabled={isProcessing}
              >
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                보류
              </Button>
              <Button 
                onClick={() => handleApproval('approved')}
                disabled={isProcessing}
                className="bg-green-600 hover:bg-green-700"
              >
                {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                승인
              </Button>
            </>
          )}
          {isApproved && (
            <Button 
              variant="outline"
              onClick={() => handleApproval('cancelled')}
              disabled={isProcessing}
              className="border-orange-300 text-orange-700 hover:bg-orange-50"
            >
              {isProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              승인 취소
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
