import { Dialog, DialogContent } from '@/components/ui/dialog';
import { X } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
}

export function ImageViewerModal({ isOpen, onClose, imageUrl, alt = '이미지' }: ImageViewerModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-50 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex items-center justify-center min-h-[300px] bg-black/90">
          <img
            src={imageUrl}
            alt={alt}
            className="max-w-full max-h-[80vh] object-contain"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
