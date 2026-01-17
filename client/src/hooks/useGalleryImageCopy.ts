import { useState, useCallback } from 'react';
import { copyFromGallery, GalleryImageItem, UploadResult } from '@/services/imageIngestionService';
import { NormalizedAsset } from '@/types/editor';
import { useToast } from '@/hooks/use-toast';

export interface PendingUpload {
  id: number;
  name: string;
}

export interface UseGalleryImageCopyOptions {
  onImageCopied?: (asset: NormalizedAsset) => void;
  onComplete?: (count: number) => void;
}

export interface UseGalleryImageCopyReturn {
  pendingUploads: PendingUpload[];
  isPending: boolean;
  copyGalleryImages: (
    galleryImages: GalleryImageItem[],
    selectedIds: number[]
  ) => Promise<NormalizedAsset[]>;
}

export function useGalleryImageCopy(
  options: UseGalleryImageCopyOptions = {}
): UseGalleryImageCopyReturn {
  const { onImageCopied, onComplete } = options;
  const { toast } = useToast();
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);

  const copyGalleryImages = useCallback(async (
    galleryImages: GalleryImageItem[],
    selectedIds: number[]
  ): Promise<NormalizedAsset[]> => {
    if (selectedIds.length === 0) return [];

    const pending = selectedIds.map(id => {
      const img = galleryImages.find(g => g.id === id) as GalleryImageItem & { title?: string; name?: string } | undefined;
      return { id, name: img?.title || img?.name || `이미지 ${id}` };
    }).filter(p => p !== null);

    setPendingUploads(pending);

    const copiedAssets: NormalizedAsset[] = [];
    let addedCount = 0;

    for (const id of selectedIds) {
      const galleryImg = galleryImages.find(g => g.id === id);
      if (!galleryImg) {
        setPendingUploads(prev => prev.filter(p => p.id !== id));
        continue;
      }

      try {
        const result: UploadResult = await copyFromGallery(galleryImg);

        setPendingUploads(prev => prev.filter(p => p.id !== id));

        if (result.success && result.asset) {
          copiedAssets.push(result.asset);
          onImageCopied?.(result.asset);
          addedCount++;
        } else {
          console.error('[useGalleryImageCopy] 갤러리 이미지 복사 실패:', result.error);
        }
      } catch (error) {
        console.error('[useGalleryImageCopy] 갤러리 이미지 처리 오류:', error);
        setPendingUploads(prev => prev.filter(p => p.id !== id));
      }
    }

    if (addedCount > 0) {
      toast({ title: `${addedCount}개 이미지가 추가되었습니다` });
      onComplete?.(addedCount);
    }

    return copiedAssets;
  }, [onImageCopied, onComplete, toast]);

  return {
    pendingUploads,
    isPending: pendingUploads.length > 0,
    copyGalleryImages,
  };
}
