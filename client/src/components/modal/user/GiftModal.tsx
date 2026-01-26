import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { sanitizeHtml } from '@/lib/utils';
import { Gift } from 'lucide-react';

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  giftImageUrl?: string;
  giftDescription?: string;
}

export function GiftModal({ 
  isOpen, 
  onClose, 
  giftImageUrl,
  giftDescription
}: GiftModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-600" />
            완료 선물
          </DialogTitle>
          <DialogDescription>
            미션 완료 시 받을 수 있는 선물입니다
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 mt-4">
          {giftImageUrl && (
            <div className="rounded-lg overflow-hidden">
              <img
                src={giftImageUrl}
                alt="선물 이미지"
                className="w-full h-48 object-cover"
              />
            </div>
          )}
          
          {giftDescription && (
            <div 
              className="text-sm whitespace-pre-wrap p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(giftDescription) }}
            />
          )}
          
          {!giftImageUrl && !giftDescription && (
            <div className="text-center py-8 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>선물 정보가 등록되지 않았습니다</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
