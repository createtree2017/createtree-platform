import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { UploadedImage, TransformedImage } from "@/components/ImageGenerationTemplate"; // We'll need to export these types

interface UseImageGenerationProps {
  apiEndpoint: string;
  categoryId: string;
  uploadMode: 'SERVER' | 'FIREBASE';
  isFirebaseReady: boolean;
  selectedModel: string;
  startGeneration: (id: string, metadata: any) => void;
  completeGeneration: (id: string) => void;
  setTransformedImage: (image: TransformedImage | null) => void;
}

export function useImageGeneration({
  apiEndpoint,
  categoryId,
  uploadMode,
  isFirebaseReady,
  selectedModel,
  startGeneration,
  completeGeneration,
  setTransformedImage
}: UseImageGenerationProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    completedFiles: number;
    totalFiles: number;
    currentFile: number;
    currentFileProgress: number;
    currentFileName: string;
  } | null>(null);

  // 이미지 생성 mutation
  const generateImageMutation = useMutation({
    mutationFn: async (data: {
      file?: File;
      style: string;
      aspectRatio?: string;
      variables?: { [key: string]: string };
      multiImages?: UploadedImage[];
    }) => {
      // 파일 크기 체크 로직
      if (data.file) {
        const maxSize = 10 * 1024 * 1024;
        if (data.file.size > maxSize) {
          throw new Error(`파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다. (현재: ${(data.file.size / 1024 / 1024).toFixed(1)}MB)`);
        }
      }

      if (data.multiImages) {
        for (const img of data.multiImages) {
          if (img.file) {
            const maxSize = 10 * 1024 * 1024;
            if (img.file.size > maxSize) {
              throw new Error(`파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다. (현재: ${(img.file.size / 1024 / 1024).toFixed(1)}MB)`);
            }
          }
        }
      }

      const taskId = `${data.style}_${Date.now()}`;
      const fileNameForDisplay = data.multiImages
        ? `${data.multiImages.filter(i => i.file).length}개 이미지`
        : (data.file?.name || '텍스트 전용 생성');
        
      startGeneration(taskId, {
        categoryId,
        fileName: fileNameForDisplay,
        style: data.style
      });

      if (data.file && (data.file.type === 'image/heic' || data.file.type === 'image/heif' || data.file.name.toLowerCase().endsWith('.heic'))) {
        console.warn('⚠️ HEIC/HEIF 파일 감지됨. 일부 브라우저에서 지원하지 않을 수 있습니다.')
      }

      let imageUrls: string[] = [];

      try {
        const canUseFirebase = uploadMode === 'FIREBASE' && isFirebaseReady;

        if (data.multiImages && data.multiImages.length > 0 && canUseFirebase) {
          const filesWithContent = data.multiImages.filter(img => img.file);
          const files = filesWithContent.map(img => img.file!);

          setIsUploading(true);
          const { uploadMultipleToFirebase } = await import('@/services/firebase-upload');
          imageUrls = await uploadMultipleToFirebase(files, (progress) => {
            setUploadProgress({
              completedFiles: progress.completedFiles,
              totalFiles: progress.totalFiles,
              currentFile: progress.currentFile,
              currentFileProgress: progress.currentFileProgress,
              currentFileName: progress.currentFileName
            });
          });
          setIsUploading(false);
        } else if (data.file && canUseFirebase) {
          setIsUploading(true);
          const { uploadToFirebase } = await import('@/services/firebase-upload');
          const result = await uploadToFirebase(data.file, (progress) => {
            setUploadProgress({
              completedFiles: 0,
              totalFiles: 1,
              currentFile: 1,
              currentFileProgress: progress.percentage,
              currentFileName: data.file!.name
            });
          });
          imageUrls = [result.url];
          setIsUploading(false);
        }
      } catch (uploadError) {
        setIsUploading(false);
        console.warn('⚠️ Firebase 업로드 실패, 서버 업로드로 자동 전환:', uploadError);
      }

      const formData = new FormData();

      if (imageUrls.length > 0) {
        formData.append('imageUrls', JSON.stringify(imageUrls));
      } else {
        if (data.multiImages && data.multiImages.length > 0) {
          const filesWithContent = data.multiImages.filter(img => img.file);
          filesWithContent.forEach((img) => {
            if (img.file) formData.append('images', img.file);
          });
        } else if (data.file) {
          formData.append('image', data.file);
        }
      }

      if (data.multiImages && data.multiImages.length > 0) {
        const filesWithContent = data.multiImages.filter(img => img.file);
        const textsArray = filesWithContent.map(img => img.text || '');

        if (textsArray.some(t => t.trim() !== '')) {
          formData.append('imageTexts', JSON.stringify(textsArray));
        }
        formData.append('imageCount', String(filesWithContent.length));
      }

      formData.append('style', data.style);
      formData.append('categoryId', categoryId);

      if (data.aspectRatio) {
        formData.append('aspectRatio', data.aspectRatio);
      }

      if (data.variables && Object.keys(data.variables).length > 0) {
        formData.append('variables', JSON.stringify(data.variables));
      }

      formData.append('model', selectedModel);

      try {
        const getAuthToken = () => {
          let token = localStorage.getItem('auth_token');
          if (token && token.trim()) return token.trim();

          const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('auth_token='))
            ?.split('=')[1];
          if (cookieToken && cookieToken.trim()) return decodeURIComponent(cookieToken.trim());

          const jwtCookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('jwt_token='))
            ?.split('=')[1];
          if (jwtCookieToken && jwtCookieToken.trim()) return decodeURIComponent(jwtCookieToken.trim());

          return null;
        };

        const token = getAuthToken();

        const isValidJWTFormat = (token: string) => {
          if (!token || typeof token !== 'string') return false;
          const parts = token.split('.');
          return parts.length === 3 && parts.every(part => part.length > 0);
        };

        if (!token) throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
        if (!isValidJWTFormat(token)) throw new Error('인증 토큰이 손상되었습니다. 다시 로그인해주세요.');

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData
        }).catch(error => {
          throw new Error(`네트워크 연결 실패: ${error.message || '알 수 없는 오류'}`);
        });

        if (!response.ok) {
          if (response.status === 401) {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('jwt_token');
            document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = 'jwt_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            window.location.reload();
            throw new Error('인증이 만료되었습니다. 페이지를 새로고침합니다.');
          }

          if (response.status === 403) {
            throw new Error('이 서비스는 유료회원만 사용할 수 있습니다.');
          }

          const responseText = await response.text();
          let errorMessage = '이미지 생성에 실패했습니다';
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {
            if (responseText && responseText.length < 200) {
              errorMessage = responseText;
            }
          }

          throw new Error(errorMessage);
        }

        const responseText = await response.text();
        const result = JSON.parse(responseText);

        completeGeneration(taskId);

        if (result && result.success && result.image) {
          setTransformedImage(result);

          queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
          queryClient.invalidateQueries({ queryKey: ['/api/gallery', categoryId] });

          const imageCreatedEvent = new CustomEvent('imageCreated', {
            detail: {
              imageId: result.image.id,
              categoryId: categoryId,
              image: result.image
            }
          });
          window.dispatchEvent(imageCreatedEvent);

          toast({
            title: "이미지 생성 완료!",
            description: "생성된 이미지를 확인해보세요.",
            duration: 3000,
          });

          setTimeout(() => {
            const galleryElement = document.querySelector('[data-gallery-section]');
            if (galleryElement) {
              galleryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 500);

          setTimeout(() => {
            const imageForGallery = {
              id: result.image.id,
              title: result.image.title,
              transformedUrl: result.image.transformedUrl,
              originalUrl: result.image.originalUrl,
              thumbnailUrl: result.image.thumbnailUrl || result.image.transformedUrl,
              url: result.image.transformedUrl,
              style: result.image.style,
              createdAt: result.image.createdAt,
              metadata: result.image.metadata
            };

            const galleryViewEvent = new CustomEvent('openImageInGallery', {
              detail: { image: imageForGallery }
            });
            window.dispatchEvent(galleryViewEvent);
          }, 1500);
        }

        return result;
      } catch (error) {
        completeGeneration(taskId);
        throw error;
      }
    },
    onSuccess: (response) => {
      const imageData = response.image || response;
      setTransformedImage(response);

      queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gallery', categoryId] });

      const imageCreatedEvent = new CustomEvent('imageCreated', {
        detail: {
          imageId: imageData.id,
          categoryId: categoryId,
          image: imageData
        }
      });
      window.dispatchEvent(imageCreatedEvent);

      toast({
        title: "이미지 생성 완료!",
        description: "생성된 이미지를 확인해보세요.",
        duration: 3000,
      });

      setTimeout(() => {
        const resultElement = document.querySelector('[data-result-section]');
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
    },
    onError: (error: Error) => {
      toast({
        title: "이미지 생성 실패",
        description: error.message || "이미지 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  return {
    generateImageMutation,
    isGenerating: generateImageMutation.isPending,
    isUploading,
    uploadProgress
  };
}
