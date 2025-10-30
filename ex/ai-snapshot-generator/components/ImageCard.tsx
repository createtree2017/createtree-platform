import React from 'react';
import type { GeneratedImage } from '../types';
import { ImageStatus } from '../types';
import { DownloadIcon, AlertTriangleIcon, RetryIcon, InfoIcon } from './Icons';

interface ImageCardProps {
  image: GeneratedImage;
  onView: (image: GeneratedImage) => void;
  onRetry: (id: number) => void;
  t: (key: string, params?: Record<string, any>) => string;
}

const ImageCard: React.FC<ImageCardProps> = ({ image, onView, onRetry, t }) => {

  const handleDownload = () => {
    if (image.src) {
      const link = document.createElement('a');
      link.href = image.src;
      link.download = `studio_portrait_${image.id}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderContent = () => {
    switch (image.status) {
      case ImageStatus.GENERATING:
        return (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-400 border-t-gray-100"></div>
          </div>
        );
      case ImageStatus.ERROR:
        return (
          <div className="flex flex-col items-center justify-center w-full h-full text-red-400 p-2">
            <AlertTriangleIcon className="w-10 h-10" />
            <p className="mt-2 text-sm font-semibold text-center">{t('generationFailed')}</p>
            <p className="mt-1 text-xs text-center text-gray-400 px-2">{t('generationFailedReason')}</p>
             <button
                onClick={(e) => { e.stopPropagation(); onRetry(image.id); }}
                className="mt-4 p-2 bg-gray-700/80 rounded-full text-white hover:bg-gray-600/80 transition-all"
                aria-label={t('retry')}
              >
                <RetryIcon className="w-5 h-5" />
              </button>
          </div>
        );
      case ImageStatus.SUCCESS:
        if (image.src) {
          return (
            <>
              <img
                src={image.src}
                alt={t('generatedPortraitAlt', { id: image.id })}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 cursor-pointer"
                onClick={() => onView(image)}
              />
              <div className="absolute bottom-0 left-0 right-0 p-2 bg-black/60 flex items-center justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <button
                  onClick={(e) => { e.stopPropagation(); onRetry(image.id); }}
                  className="p-1.5 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-all"
                  aria-label={t('retry')}
                >
                  <RetryIcon className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                  className="p-1.5 bg-gray-800/70 rounded-full text-white hover:bg-gray-700/90 transition-all"
                  aria-label={t('download')}
                >
                  <DownloadIcon className="w-4 h-4" />
                </button>
              </div>
            </>
          );
        }
        return null;
      case ImageStatus.PENDING:
      default:
        return (
          <div className="w-full h-full bg-gray-800/50"></div>
        );
    }
  };

  const handleClick = () => {
    if (image.status === ImageStatus.SUCCESS) {
      onView(image);
    }
  };

  return (
    <div 
      className="group relative aspect-square bg-gray-800 rounded-lg overflow-hidden shadow-lg"
      onClick={handleClick}
    >
      {renderContent()}
    </div>
  );
};

export default ImageCard;
