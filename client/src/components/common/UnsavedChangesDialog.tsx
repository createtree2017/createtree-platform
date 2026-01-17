import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Loader2, Save, LogOut, X } from 'lucide-react';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  isSaving: boolean;
  title?: string;
  description?: string;
}

export function UnsavedChangesDialog({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  isSaving,
  title = '저장하지 않은 변경사항',
  description = '저장하지 않은 변경사항이 있습니다. 저장하지 않고 나가면 작업 내용이 모두 사라집니다.',
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent className="max-w-lg w-[95vw]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:gap-3">
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={onClose} disabled={isSaving} className="w-full sm:w-auto">
              <X className="w-4 h-4 mr-2 flex-shrink-0" />
              취소
            </Button>
          </AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={onDiscard}
            disabled={isSaving}
            className="w-full sm:w-auto"
          >
            <LogOut className="w-4 h-4 mr-2 flex-shrink-0" />
            저장하지 않고 나가기
          </Button>
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="bg-primary w-full sm:w-auto"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin flex-shrink-0" />
                저장 중...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2 flex-shrink-0" />
                저장하고 나가기
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
