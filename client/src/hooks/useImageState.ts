import { useState, useCallback, useEffect } from "react";
import { UploadedImage } from "@/components/ImageGenerationTemplate";

interface UseImageStateProps {
  isMultiImageMode: boolean;
  selectedStyle: string;
  maxImageCount?: number;
}

export function useImageState({
  isMultiImageMode,
  selectedStyle,
  maxImageCount = 3
}: UseImageStateProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

  // 파일 관리: 단일 이미지 선택
  const handleFileSelected = useCallback((file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  // 파일 관리: 다중 이미지 파일 선택
  const handleMultiImageFileSelect = useCallback((index: number, file: File) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      if (newImages[index]?.previewUrl) {
        URL.revokeObjectURL(newImages[index].previewUrl);
      }
      newImages[index] = {
        ...newImages[index],
        file,
        previewUrl: URL.createObjectURL(file)
      };
      return newImages;
    });
  }, []);

  // 파일 관리: 다중 이미지 텍스트 변경
  const handleMultiImageTextChange = useCallback((index: number, text: string) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      newImages[index] = {
        ...newImages[index],
        text
      };
      return newImages;
    });
  }, []);

  // 파일 관리: 다중 이미지 슬롯 추가
  const handleAddImageSlot = useCallback(() => {
    setUploadedImages(prev => {
      if (prev.length < maxImageCount) {
        return [...prev, { file: null, previewUrl: '', text: '' }];
      }
      return prev;
    });
  }, [maxImageCount]);

  // 파일 관리: 다중 이미지 슬롯 제거
  const handleRemoveImageSlot = useCallback((index: number) => {
    setUploadedImages(prev => {
      const newImages = [...prev];
      if (newImages[index]?.previewUrl) {
        URL.revokeObjectURL(newImages[index].previewUrl);
      }
      newImages.splice(index, 1);
      return newImages;
    });
  }, []);

  // 클린업 및 모드 변경 시 초기화
  useEffect(() => {
    if (isMultiImageMode) {
      setUploadedImages([{ file: null, previewUrl: '', text: '' }]);
      setSelectedFile(null);
      setPreviewUrl('');
    } else {
      uploadedImages.forEach(img => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
      setUploadedImages([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStyle, isMultiImageMode]);

  // 컴포넌트 언마운트 시 URL 객체 해제
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      uploadedImages.forEach(img => {
        if (img.previewUrl) {
          URL.revokeObjectURL(img.previewUrl);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 변수 상태
  const [variableInputs, setVariableInputs] = useState<{ [key: string]: string }>({});

  const handleVariableChange = useCallback((key: string, value: string) => {
    setVariableInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  return {
    // 단일 이미지 상태
    selectedFile,
    previewUrl,
    setPreviewUrl,
    setSelectedFile,
    handleFileSelected,
    
    // 다중 이미지 상태
    uploadedImages,
    handleMultiImageFileSelect,
    handleMultiImageTextChange,
    handleAddImageSlot,
    handleRemoveImageSlot,
    
    // 변수 상태
    variableInputs,
    setVariableInputs,
    handleVariableChange,
  };
}
