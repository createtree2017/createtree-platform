import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { sanitizeHtml } from '@/lib/utils';
import { Gift } from 'lucide-react';

interface GiftItem {
  imageUrl?: string;
  description?: string;
}

interface GiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  giftImageUrl?: string;
  giftDescription?: string;
  giftItems?: GiftItem[];
}

export function GiftModal({
  isOpen,
  onClose,
  giftImageUrl,
  giftDescription,
  giftItems
}: GiftModalProps) {
  const hasMultipleItems = giftItems && giftItems.length > 0;
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
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
          {hasMultipleItems ? (
            <div className="space-y-4">
              {giftItems.map((item, idx) => (
                <div key={idx} className="flex flex-col gap-3 p-4 bg-muted/30 rounded-lg border">
                  {item.imageUrl && (
                    <div className="aspect-video w-full rounded-md overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center">
                      <img
                        src={item.imageUrl}
                        alt={`보상 ${idx + 1}`}
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                  {item.description && (
                    <div
                      className="text-sm text-center font-medium bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-md"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.description) }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            // 다중 아이템이 없는 경우 (레거시 단일 보상 표시)
            <div className="flex flex-col gap-3 p-4 bg-muted/30 rounded-lg border">
              {giftImageUrl && (
                <div className="aspect-video w-full rounded-md overflow-hidden bg-black/5 dark:bg-white/5 flex items-center justify-center">
                  <img
                    src={giftImageUrl}
                    alt="보상 이미지"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              )}
              {giftDescription && (
                <div
                  className="text-sm text-center font-medium bg-purple-50 dark:bg-purple-900/20 px-3 py-2 rounded-md"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(giftDescription) }}
                />
              )}
            </div>
          )}

          {!hasMultipleItems && !giftImageUrl && !giftDescription && (
            <div className="text-center py-8 text-muted-foreground border rounded-lg bg-muted/20">
              <Gift className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>선물 정보가 등록되지 않았습니다</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
