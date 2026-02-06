import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

interface ImageViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  downloadUrl?: string; // 별도 다운로드 URL (제작소 PDF 등)
  alt?: string;
  onDownload?: (url: string) => void;
  onPrint?: (url: string) => void;
}

export function ImageViewerModal({
  isOpen,
  onClose,
  imageUrl,
  downloadUrl,
  alt = '이미지',
  onDownload,
  onPrint
}: ImageViewerModalProps) {

  const handleDownload = () => {
    const urlToDownload = downloadUrl || imageUrl;

    if (onDownload) {
      onDownload(urlToDownload);
      return;
    }

    // 외부 GCS URL인지 확인
    const isExternalUrl = urlToDownload.includes('storage.googleapis.com') ||
      urlToDownload.includes('firebasestorage.googleapis.com');

    // 다운로드 URL 결정 (외부 URL은 프록시 사용)
    const downloadHref = isExternalUrl
      ? `/api/proxy-image?url=${encodeURIComponent(urlToDownload)}&download=true`
      : urlToDownload;

    // 파일명 추출
    const fileName = urlToDownload.split('/').pop()?.split('?')[0] || `download_${Date.now()}.webp`;

    // 갤러리 패턴: <a> 태그 클릭 방식
    const link = document.createElement('a');
    link.href = downloadHref;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
