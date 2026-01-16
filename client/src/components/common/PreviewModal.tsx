import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";

interface PreviewPage {
  id: string;
  imageUrl: string;
  thumbnailUrl?: string;
  label?: string;
}

interface PreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  pages: PreviewPage[];
  initialPageIndex?: number;
  title?: string;
}

const SWIPE_THRESHOLD = 50;

export const PreviewModal: React.FC<PreviewModalProps> = ({
  isOpen,
  onClose,
  pages,
  initialPageIndex = 0,
  title,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialPageIndex);
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [isImageLoading, setIsImageLoading] = useState(true);
  
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialPageIndex);
    }
  }, [isOpen, initialPageIndex]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          goToPrevious();
          break;
        case "ArrowRight":
          goToNext();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, currentIndex, pages.length]);

  useEffect(() => {
    if (!isOpen || pages.length === 0) return;

    const indicesToPreload = [
      currentIndex,
      currentIndex - 1,
      currentIndex + 1,
    ].filter((i) => i >= 0 && i < pages.length);

    indicesToPreload.forEach((index) => {
      const page = pages[index];
      if (page && !loadedImages.has(page.imageUrl)) {
        const img = new Image();
        img.onload = () => {
          setLoadedImages((prev) => new Set(prev).add(page.imageUrl));
        };
        img.src = page.imageUrl;
      }
    });
  }, [isOpen, currentIndex, pages, loadedImages]);

  useEffect(() => {
    if (thumbnailContainerRef.current && pages.length > 0) {
      const container = thumbnailContainerRef.current;
      const thumbnailWidth = 80;
      const gap = 8;
      const scrollPosition = currentIndex * (thumbnailWidth + gap) - container.clientWidth / 2 + thumbnailWidth / 2;
      container.scrollTo({ left: scrollPosition, behavior: "smooth" });
    }
  }, [currentIndex, pages.length]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      setIsImageLoading(true);
      setCurrentIndex((prev) => prev - 1);
    }
  }, [currentIndex]);

  const goToNext = useCallback(() => {
    if (currentIndex < pages.length - 1) {
      setIsImageLoading(true);
      setCurrentIndex((prev) => prev + 1);
    }
  }, [currentIndex, pages.length]);

  const goToPage = useCallback((index: number) => {
    if (index >= 0 && index < pages.length && index !== currentIndex) {
      setIsImageLoading(true);
      setCurrentIndex(index);
    }
  }, [pages.length, currentIndex]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;
    
    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;
    
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      isDraggingRef.current = true;
    }
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!pointerStartRef.current) return;

    const dx = e.clientX - pointerStartRef.current.x;
    const dy = e.clientY - pointerStartRef.current.y;

    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        goToPrevious();
      } else {
        goToNext();
      }
    }

    pointerStartRef.current = null;
    isDraggingRef.current = false;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, [goToPrevious, goToNext]);

  const handlePointerCancel = useCallback((e: React.PointerEvent) => {
    pointerStartRef.current = null;
    isDraggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, []);

  const handleImageLoad = useCallback(() => {
    setIsImageLoading(false);
    const currentPage = pages[currentIndex];
    if (currentPage) {
      setLoadedImages((prev) => new Set(prev).add(currentPage.imageUrl));
    }
  }, [currentIndex, pages]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !isDraggingRef.current) {
      onClose();
    }
  }, [onClose]);

  if (!isOpen || pages.length === 0) return null;

  const currentPage = pages[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === pages.length - 1;
  const isCurrentImageLoaded = loadedImages.has(currentPage.imageUrl);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex flex-col transition-opacity duration-300"
      onClick={handleOverlayClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex-1">
          {title && (
            <h2 className="text-white text-lg sm:text-xl font-semibold truncate">
              {title}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-white/80 text-sm sm:text-base font-medium">
            {currentIndex + 1} / {pages.length}
          </span>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Close preview"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div
        className="flex-1 flex items-center justify-center relative px-4 sm:px-16 touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        {/* Previous button */}
        {!isFirst && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToPrevious();
            }}
            className="absolute left-2 sm:left-4 z-10 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all opacity-70 hover:opacity-100"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}

        {/* Image container */}
        <div className="relative w-full h-full flex items-center justify-center">
          {(isImageLoading || !isCurrentImageLoaded) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-white animate-spin" />
            </div>
          )}
          <img
            key={currentPage.id}
            src={currentPage.imageUrl}
            alt={currentPage.label || `Page ${currentIndex + 1}`}
            className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${
              isImageLoading && !isCurrentImageLoaded ? "opacity-0" : "opacity-100"
            }`}
            onLoad={handleImageLoad}
            draggable={false}
          />
        </div>

        {/* Next button */}
        {!isLast && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              goToNext();
            }}
            className="absolute right-2 sm:right-4 z-10 p-2 sm:p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all opacity-70 hover:opacity-100"
            aria-label="Next page"
          >
            <ChevronRight className="w-6 h-6 sm:w-8 sm:h-8" />
          </button>
        )}
      </div>

      {/* Page label */}
      {currentPage.label && (
        <div className="text-center py-2">
          <span className="text-white/70 text-sm">{currentPage.label}</span>
        </div>
      )}

      {/* Thumbnail strip */}
      <div className="px-4 py-3 sm:py-4 bg-black/50">
        <div
          ref={thumbnailContainerRef}
          className="flex gap-2 overflow-x-auto scrollbar-hide pb-1"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {pages.map((page, index) => {
            const thumbnailSrc = page.thumbnailUrl || page.imageUrl;
            const isActive = index === currentIndex;
            
            return (
              <button
                key={page.id}
                onClick={() => goToPage(index)}
                className={`flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden transition-all duration-200 ${
                  isActive
                    ? "ring-2 ring-white ring-offset-2 ring-offset-black/50 scale-105"
                    : "opacity-60 hover:opacity-100"
                }`}
                aria-label={page.label || `Go to page ${index + 1}`}
              >
                <img
                  src={thumbnailSrc}
                  alt={page.label || `Thumbnail ${index + 1}`}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PreviewModal;
