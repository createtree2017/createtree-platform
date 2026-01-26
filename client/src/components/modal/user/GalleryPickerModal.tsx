import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface GalleryImage {
  id: number;
  title: string;
  url: string;
  transformedUrl?: string;
  originalUrl?: string;
  thumbnailUrl?: string;
  type: string;
}

interface GalleryPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  images: GalleryImage[];
  isLoading: boolean;
  currentSubMissionId: number | null;
  onImageSelect?: (imageUrl: string, subMissionId: number | null) => void;
}

export function GalleryPickerModal({ 
  isOpen, 
  onClose, 
  images,
  isLoading,
  currentSubMissionId,
  onImageSelect
}: GalleryPickerModalProps) {
  const { toast } = useToast();

  const handleImageSelect = (image: GalleryImage) => {
    const imageUrl = image.transformedUrl || image.originalUrl || image.url;
    
    if (onImageSelect) {
      onImageSelect(imageUrl, currentSubMissionId);
    } else {
      const event = new CustomEvent('gallery-image-selected', {
        detail: { imageUrl, subMissionId: currentSubMissionId }
      });
      window.dispatchEvent(event);
    }
    
    onClose();
    toast({
      title: "이미지 선택됨",
      description: "선택한 이미지가 적용되었습니다"
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>갤러리에서 이미지 선택</DialogTitle>
          <DialogDescription>
            갤러리에 저장된 이미지 중 하나를 선택하세요
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 py-4">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="aspect-square rounded-lg" />
            ))}
          </div>
        ) : images.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-muted-foreground">갤러리에 이미지가 없습니다</p>
            <p className="text-sm text-muted-foreground mt-1">먼저 이미지를 생성해주세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 py-4">
            {images.map((image) => (
              <button
                key={image.id}
                onClick={() => handleImageSelect(image)}
                className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-purple-500 hover:scale-105 transition-all group"
              >
                <img
                  src={image.thumbnailUrl || image.url}
                  alt={image.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <CheckCircle className="h-8 w-8 text-white bg-purple-600 rounded-full p-1" />
                </div>
                <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                  {image.type.replace('_img', '')}
                </div>
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
