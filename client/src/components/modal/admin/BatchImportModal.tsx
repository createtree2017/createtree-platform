import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import BatchImportDialog from '@/components/BatchImportDialog';
import { useQueryClient } from '@tanstack/react-query';

interface BatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories?: Array<{ categoryId: string; name: string; emoji?: string }>;
  onSuccess?: () => void;
}

export function BatchImportModal({ 
  isOpen, 
  onClose, 
  categories = [],
  onSuccess 
}: BatchImportModalProps) {
  const queryClient = useQueryClient();

  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>캐릭터 일괄 가져오기</DialogTitle>
          <DialogDescription>
            JSON 형식에서 여러 캐릭터를 가져옵니다.
          </DialogDescription>
        </DialogHeader>
        
        {isOpen && (
          <BatchImportDialog 
            onSuccess={handleSuccess}
            categories={categories}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
