import React, { useState } from 'react';
import type { GeneratedImage } from '../types';
import { XIcon, PlusCircleIcon, ClipboardIcon, CheckIcon, VideoIcon } from './Icons';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: GeneratedImage | null;
  onCreateMore: (image: GeneratedImage) => void;
  isGeneratingMore: boolean;
  onCreateVideo: () => void;
  isGeneratingVideo: boolean;
  generatedVideoUrl: string | null;
  t: (key: string, params?: Record<string, any>) => string;
}

const Modal: React.FC<ModalProps> = ({ 
    isOpen, 
    onClose, 
    image, 
    onCreateMore, 
    isGeneratingMore,
    onCreateVideo,
    isGeneratingVideo,
    generatedVideoUrl,
    t
}) => {
  const [copySuccess, setCopySuccess] = useState(false);

  if (!isOpen || !image) return null;

  const handleCreateMore = () => {
    if (image) {
      onCreateMore(image);
    }
  };
  
  const handleCreateVideo = () => {
      if(image) {
          onCreateVideo();
      }
  }

  const handleCopyPrompt = () => {
    if (image?.prompt) {
      navigator.clipboard.writeText(image.prompt).then(() => {
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
      }, (err) => {
        console.error(t('logCopyPromptFail'), err);
      });
    }
  };

  const getCategoryName = (category: GeneratedImage['category']) => {
    switch(category) {
        case 'daily': return t('categoryDaily');
        case 'travel': return t('categoryTravel');
        case 'film': return t('categoryFilm');
    }
  }


  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="relative bg-gray-900 p-4 sm:p-6 rounded-xl max-w-4xl w-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{maxHeight: '90vh'}}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-white transition-colors z-10"
          aria-label={t('modalClose')}
        >
          <XIcon className="w-8 h-8" />
        </button>
        
        <div className="flex-grow flex items-center justify-center min-h-0 overflow-hidden">
             {generatedVideoUrl ? (
                <video
                    src={generatedVideoUrl}
                    controls
                    autoPlay
                    loop
                    className="max-w-full max-h-full object-contain rounded-lg"
                >
                    Your browser does not support the video tag.
                </video>
            ) : (
                <img 
                    src={image.src ?? ''} 
                    alt={t('modalImageAlt')} 
                    className="max-w-full max-h-full object-contain rounded-lg" 
                />
            )}
        </div>
        
        <div className="flex-shrink-0 mt-4 space-y-4">
            <div className="flex justify-between items-center">
                <h4 id="modal-title" className="text-sm font-semibold text-gray-300">{t('modalUsedPrompt')}</h4>
                <span className="text-xs font-semibold px-2 py-1 bg-gray-700 text-gray-200 rounded-full capitalize">
                  {getCategoryName(image.category)}
                </span>
            </div>
            <div className="relative bg-black/30 p-3 sm:p-4 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-200 font-mono leading-relaxed overflow-y-auto max-h-16 sm:max-h-24 pr-10">{image.prompt}</p>
                 <button
                    onClick={handleCopyPrompt}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                    aria-label={t('modalCopyPrompt')}
                >
                    {copySuccess ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
                </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                    onClick={handleCreateVideo}
                    disabled={isGeneratingVideo || isGeneratingMore || !!generatedVideoUrl}
                    className="w-full flex items-center justify-center space-x-2 bg-purple-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-purple-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
                >
                    {isGeneratingVideo ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/50 border-t-white"></div>
                            <span>{t('modalGeneratingVideo')}</span>
                        </>
                    ) : (
                        <>
                            <VideoIcon />
                            <span>{t('modalCreateVideo')}</span>
                        </>
                    )}
                </button>
                <button
                    onClick={handleCreateMore}
                    disabled={isGeneratingMore || isGeneratingVideo}
                    className="w-full flex items-center justify-center space-x-2 bg-indigo-600 text-white font-semibold py-3 px-4 rounded-md hover:bg-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all"
                >
                    {isGeneratingMore ? (
                        <>
                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/50 border-t-white"></div>
                            <span>{t('modalGeneratingMore')}</span>
                        </>
                    ) : (
                        <>
                            <PlusCircleIcon />
                            <span>{t('modalCreateMore')}</span>
                        </>
                    )}
                </button>
            </div>
             {isGeneratingVideo && (
                <div className="text-center text-sm text-purple-300">
                    <p>{t('modalVideoWait')}</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Modal;