import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { MODE_OPTIONS, STYLE_OPTIONS, type SnapshotMode, type SnapshotStyle } from '@/constants/snapshot';
import { useModalContext } from '@/contexts/ModalContext';

interface GeneratedImage {
    id: number;
    url: string;
    thumbnailUrl: string;
    promptId: number;
    createdAt: string;
}

interface Generation {
    timestamp: number;
    mode: SnapshotMode;
    style: SnapshotStyle;
    createdAt: string;
    images: GeneratedImage[];
}

interface SnapshotGenerationModalProps {
    generation: Generation;
}

export function SnapshotGenerationModal({ generation }: SnapshotGenerationModalProps) {
    const modal = useModalContext();

    const getModeLabel = (mode: SnapshotMode) => {
        return MODE_OPTIONS.find(opt => opt.value === mode)?.label || mode;
    };

    const getStyleLabel = (style: SnapshotStyle) => {
        return STYLE_OPTIONS.find(opt => opt.value === style)?.label || style;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && modal.closeTopModal()}>
            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {getModeLabel(generation.mode)} - {getStyleLabel(generation.style)}
                    </DialogTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                        {formatDate(generation.createdAt)}
                    </p>
                </DialogHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                    {generation.images.map((image) => (
                        <div key={image.id} className="relative group">
                            <div className="relative w-full h-48 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                                <img
                                    src={image.url}
                                    alt="Generated snapshot"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                    onLoad={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.parentElement?.classList.remove('bg-gray-200', 'dark:bg-gray-700');
                                    }}
                                    onError={(e) => {
                                        console.error('대화상자 이미지 로드 실패:', image.id, image.url);
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent && !parent.querySelector('.error-msg')) {
                                            const errorDiv = document.createElement('div');
                                            errorDiv.className = 'error-msg absolute inset-0 flex items-center justify-center text-sm text-gray-500';
                                            errorDiv.textContent = '이미지 로드 실패';
                                            parent.appendChild(errorDiv);
                                        }
                                    }}
                                />
                            </div>
                            <a
                                href={image.url}
                                download
                                className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                                <Button size="sm" variant="secondary">
                                    <Download className="w-4 h-4" />
                                </Button>
                            </a>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
