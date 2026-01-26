import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  alt?: string;
  onDownload?: (url: string) => void;
  onPrint?: (url: string) => void;
}

export function ImageViewerModal({ 
  isOpen, 
  onClose, 
  imageUrl, 
  alt = '이미지',
  onDownload,
  onPrint 
}: ImageViewerModalProps) {
  const handleDownload = () => {
    if (onDownload) {
      onDownload(imageUrl);
    } else {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `image_${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint(imageUrl);
    } else {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head><title>이미지 인쇄</title></head>
            <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
              <img src="${imageUrl}" style="max-width:100%;max-height:100vh;" onload="window.print();window.close();" />
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>이미지 보기</DialogTitle>
        </DialogHeader>
        {imageUrl && (
          <div className="space-y-4">
            <div className="relative w-full flex justify-center">
              <img 
                src={imageUrl} 
                alt={alt}
                className="max-h-[70vh] w-auto object-contain rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleDownload}
              >
                <Download className="h-4 w-4 mr-2" />
                다운로드
              </Button>
              <Button
                variant="outline"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4 mr-2" />
                인쇄
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
