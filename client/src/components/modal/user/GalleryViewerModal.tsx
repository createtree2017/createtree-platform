import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface GalleryImage {
  id: number;
  title?: string;
  url: string;
  transformedUrl?: string;
  thumbnailUrl?: string;
  style?: string;
  createdAt?: string;
  type?: string;
}

interface GalleryViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: GalleryImage | null;
  onDownload?: (image: GalleryImage) => void;
  onDelete?: (image: GalleryImage) => void;
  showDelete?: boolean;
  variant?: 'default' | 'simple' | 'embed';
}

export function GalleryViewerModal({ 
  isOpen, 
  onClose, 
  image,
  onDownload,
  onDelete,
  showDelete = true,
  variant = 'default'
}: GalleryViewerModalProps) {
  if (!image) return null;

  const handleDownload = () => {
    if (onDownload) {
      onDownload(image);
    } else {
      const imageUrl = image.transformedUrl || image.url;
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `${image.title || 'image'}_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(image);
      onClose();
    }
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.target as HTMLImageElement;
    const currentSrc = target.src;
    const thumbnailUrl = image.thumbnailUrl;
    
    if (thumbnailUrl && currentSrc !== thumbnailUrl) {
      target.src = thumbnailUrl;
      target.setAttribute('data-using-thumbnail', 'true');
    } else {
      target.style.display = 'none';
      const parent = target.parentElement;
      if (parent && !parent.querySelector('.error-placeholder')) {
        const placeholder = document.createElement('div');
        placeholder.className = 'error-placeholder flex flex-col items-center justify-center p-8 text-gray-400';
        placeholder.innerHTML = `
          <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
          <p class="text-lg">원본 이미지를 불러올 수 없습니다</p>
          <p class="text-sm mt-1">파일이 삭제되었거나 접근할 수 없습니다</p>
        `;
        parent.appendChild(placeholder);
      }
    }
  };

  if (variant === 'embed') {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0 overflow-hidden bg-card">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle className="text-lg font-semibold text-card-foreground">
              {image.title || "이미지 뷰어"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex flex-col items-center p-4 pt-0">
            <div className="relative w-full max-w-3xl">
              <img 
                src={image.transformedUrl || image.url} 
                alt={image.title || '이미지'} 
                className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                onError={handleImageError}
              />
            </div>
            
            <div className="mt-4 flex gap-3 w-full max-w-3xl">
              <Button
                onClick={handleDownload}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Download className="mr-2 h-4 w-4" />
                다운로드
              </Button>
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1"
              >
                닫기
              </Button>
            </div>
            
            {(image.style || image.createdAt) && (
              <div className="mt-3 text-center text-sm text-muted-foreground">
                {image.style && <p>스타일: {image.style}</p>}
                {image.createdAt && <p>생성일: {new Date(image.createdAt).toLocaleDateString('ko-KR')}</p>}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{image.title || '이미지 보기'}</DialogTitle>
        </DialogHeader>
        
        <div className="flex justify-center relative">
          <img
            src={image.transformedUrl || image.url}
            alt={image.title || '이미지'}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
            onError={handleImageError}
          />
        </div>
        
        <div className="flex justify-center gap-3 mt-4 pb-2">
          <Button
            onClick={handleDownload}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            다운로드
          </Button>
          
          {showDelete && onDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  삭제
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>이미지 삭제</AlertDialogTitle>
                  <AlertDialogDescription>
                    이 이미지를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>취소</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    삭제
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
