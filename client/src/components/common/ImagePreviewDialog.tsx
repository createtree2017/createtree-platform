import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2, ZoomIn, ZoomOut } from "lucide-react";

export interface PreviewImage {
  src: string;
  fullSrc?: string;
  title?: string;
}

interface ImagePreviewDialogProps {
  image: PreviewImage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: (imageUrl: string) => void;
  showDownloadButton?: boolean;
}

export function ImagePreviewDialog({
  image,
  open,
  onOpenChange,
  onDownload,
  showDownloadButton = false,
}: ImagePreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [loadError, setLoadError] = useState(false);

  const displayUrl = image?.fullSrc || image?.src || "";

  useEffect(() => {
    if (open && image) {
      setIsLoading(true);
      setLoadError(false);
      setZoom(1);
    }
  }, [open, image]);

  const handleImageLoad = () => {
    setIsLoading(false);
  };

  const handleImageError = () => {
    setIsLoading(false);
    setLoadError(true);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  };

  const handleDownload = () => {
    if (onDownload && displayUrl) {
      onDownload(displayUrl);
    }
  };

  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-gray-900 border-gray-700">
        <DialogHeader className="p-4 pb-2 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-white truncate pr-4">
              {image.title || "이미지 미리보기"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="text-gray-300 hover:text-white"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-400 min-w-[4rem] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoom >= 3}
                className="text-gray-300 hover:text-white"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              {showDownloadButton && onDownload && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  className="text-gray-300 hover:text-white"
                >
                  <Download className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[400px] max-h-[calc(90vh-80px)]">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
          )}
          
          {loadError ? (
            <div className="text-center text-gray-400">
              <p>이미지를 불러올 수 없습니다</p>
              <p className="text-sm mt-2 text-gray-500 break-all max-w-md">
                {displayUrl}
              </p>
            </div>
          ) : (
            <img
              src={displayUrl}
              alt={image.title || "Preview"}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{
                transform: `scale(${zoom})`,
                transition: "transform 0.2s ease",
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
              className="rounded-lg shadow-lg"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
