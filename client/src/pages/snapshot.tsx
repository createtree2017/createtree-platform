import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, Upload, Loader2, X, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Link } from 'wouter';
import { useImageGenerationStore } from '@/stores/imageGenerationStore';
import {
  MODE_OPTIONS,
  STYLE_OPTIONS,
  GENDER_OPTIONS,
  SNAPSHOT_CONFIG,
  SNAPSHOT_MESSAGES,
  SNAPSHOT_STEPS,
  type SnapshotMode,
  type SnapshotStyle,
  type SnapshotGender
} from '@/constants/snapshot';

interface GeneratedImage {
  id: number;
  url: string;
  thumbnailUrl: string;
  promptId: number;
  createdAt: string;
}

interface GenerationResponse {
  success: boolean;
  images: GeneratedImage[];
  referenceImageUrls: string[];
}

export default function SnapshotPage() {
  const { toast } = useToast();
  const { startGeneration, completeGeneration } = useImageGenerationStore();
  
  // Form state
  const [photos, setPhotos] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [mode, setMode] = useState<SnapshotMode | null>(null);
  const [style, setStyle] = useState<SnapshotStyle | null>(null);
  const [gender, setGender] = useState<SnapshotGender | null>(null);
  
  // Result state
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [viewImage, setViewImage] = useState<GeneratedImage | null>(null);

  // Generate mutation
  const generateMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      
      photos.forEach((photo) => {
        formData.append('photos', photo);
      });
      
      formData.append('mode', mode!);
      formData.append('style', style!);
      if (gender) {
        formData.append('gender', gender);
      }

      const response = await fetch('/api/snapshot/generate', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || SNAPSHOT_MESSAGES.GENERATION_ERROR);
      }

      return response.json();
    },
    onMutate: () => {
      // 생성 시작 시 전역 상태 업데이트 (상단바에 표시됨)
      const generationId = `snapshot-${Date.now()}`;
      startGeneration(generationId, {
        categoryId: 'snapshot',
        fileName: 'AI스냅샷',
        style: style || 'mix'
      });
      return { generationId };
    },
    onSuccess: (data: GenerationResponse, _, context) => {
      // 생성 완료 시 전역 상태 업데이트
      if (context?.generationId) {
        completeGeneration(context.generationId);
      }
      
      setGeneratedImages(data.images);
      setCurrentStep(4);
      toast({
        title: '생성 완료!',
        description: SNAPSHOT_MESSAGES.GENERATION_COMPLETE
      });
      queryClient.invalidateQueries({ queryKey: ['/api/snapshot/history'] });
    },
    onError: (error: Error, _, context) => {
      // 생성 실패 시 전역 상태 업데이트
      if (context?.generationId) {
        completeGeneration(context.generationId);
      }
      
      toast({
        title: '생성 실패',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Handle photo upload
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length === 0) return;
    
    if (photos.length + files.length > SNAPSHOT_CONFIG.MAX_PHOTOS) {
      toast({
        title: '업로드 제한',
        description: SNAPSHOT_MESSAGES.TOO_MANY_PHOTOS,
        variant: 'destructive'
      });
      return;
    }

    // Validate files
    for (const file of files) {
      const acceptedFormats: string[] = [...SNAPSHOT_CONFIG.ACCEPTED_FORMATS];
      if (!acceptedFormats.includes(file.type)) {
        toast({
          title: '지원하지 않는 형식',
          description: SNAPSHOT_MESSAGES.INVALID_FORMAT,
          variant: 'destructive'
        });
        return;
      }
      
      if (file.size > SNAPSHOT_CONFIG.MAX_FILE_SIZE) {
        toast({
          title: '파일 크기 초과',
          description: SNAPSHOT_MESSAGES.FILE_TOO_LARGE,
          variant: 'destructive'
        });
        return;
      }
    }

    // Add files and create previews
    setPhotos(prev => [...prev, ...files]);
    
    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Remove photo
  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Validate and generate
  const handleGenerate = () => {
    if (photos.length === 0) {
      toast({
        title: '사진 필요',
        description: SNAPSHOT_MESSAGES.NO_PHOTOS,
        variant: 'destructive'
      });
      return;
    }
    
    if (!mode) {
      toast({
        title: '모드 선택 필요',
        description: SNAPSHOT_MESSAGES.SELECT_MODE,
        variant: 'destructive'
      });
      return;
    }
    
    if (!style) {
      toast({
        title: '스타일 선택 필요',
        description: SNAPSHOT_MESSAGES.SELECT_STYLE,
        variant: 'destructive'
      });
      return;
    }

    generateMutation.mutate();
  };

  // Reset
  const handleReset = () => {
    setPhotos([]);
    setPreviewUrls([]);
    setMode(null);
    setStyle(null);
    setGender(null);
    setGeneratedImages([]);
    setCurrentStep(1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-6">
      <div className="w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            AI 스냅샷 생성기
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            사진을 업로드하고 원하는 스타일을 선택하면 3장의 AI 스냅샷이 생성됩니다
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center items-center space-x-4">
          {SNAPSHOT_STEPS.map((step) => (
            <div key={step.step} className="flex items-center">
              <div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full font-semibold
                  ${currentStep >= step.step
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-200 text-gray-500'}
                `}
              >
                {step.step}
              </div>
              {step.step < SNAPSHOT_STEPS.length && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    currentStep > step.step ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Mode Selection */}
        {currentStep === 1 && (
          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">모드 선택</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {SNAPSHOT_MESSAGES.SELECT_MODE}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setMode(option.value)}
                    className={`
                      p-6 rounded-lg border-2 transition-all text-center
                      ${mode === option.value
                        ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                        : 'border-gray-200 hover:border-purple-300'}
                    `}
                  >
                    <div className="text-4xl mb-2">{option.icon}</div>
                    <h3 className="font-bold text-lg">{option.label}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={() => setCurrentStep(2)}
                  disabled={!mode}
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  다음 단계
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Photo Upload */}
        {currentStep === 2 && (
          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">사진 업로드</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {SNAPSHOT_MESSAGES.UPLOAD_PROMPT}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500">
                  {SNAPSHOT_MESSAGES.UPLOAD_HINT}
                </p>
              </div>

              {/* Upload Area */}
              <label
                htmlFor="photo-upload"
                className="block border-2 border-dashed border-purple-300 rounded-lg p-12 text-center cursor-pointer hover:border-purple-500 transition-colors"
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-purple-500" />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  클릭하여 사진 업로드
                </p>
                <p className="text-sm text-gray-500">
                  또는 파일을 여기로 드래그하세요
                </p>
                <input
                  id="photo-upload"
                  type="file"
                  multiple
                  accept={SNAPSHOT_CONFIG.ACCEPTED_EXTENSIONS.join(',')}
                  className="hidden"
                  onChange={handlePhotoChange}
                />
              </label>

              {/* Preview Grid */}
              {previewUrls.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => removePhoto(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  이전
                </Button>
                <Button
                  onClick={() => setCurrentStep(3)}
                  disabled={photos.length === 0}
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  다음 단계
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Style Selection */}
        {currentStep === 3 && (
          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">스타일 선택</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {SNAPSHOT_MESSAGES.SELECT_STYLE}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {STYLE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setStyle(option.value)}
                    className={`
                      p-6 rounded-lg border-2 transition-all text-center
                      ${style === option.value
                        ? 'border-purple-600 ring-2 ring-purple-300'
                        : 'border-gray-200 hover:border-purple-300'}
                    `}
                  >
                    <div className={`${option.bgColor} w-full h-24 rounded-lg mb-4`} />
                    <h3 className="font-bold text-lg">{option.label}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {option.description}
                    </p>
                  </button>
                ))}
              </div>

              {/* Gender Selection (Optional, for individual mode) */}
              {mode === 'individual' && (
                <div className="space-y-4">
                  <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                    {SNAPSHOT_MESSAGES.SELECT_GENDER}
                  </p>
                  <div className="flex justify-center space-x-4">
                    {GENDER_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setGender(option.value)}
                        className={`
                          px-6 py-3 rounded-lg border-2 transition-all
                          ${gender === option.value
                            ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-gray-200 hover:border-purple-300'}
                        `}
                      >
                        <span className="mr-2">{option.icon}</span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center space-x-4">
                <Button variant="outline" onClick={() => setCurrentStep(2)}>
                  이전
                </Button>
                <Button
                  onClick={handleGenerate}
                  disabled={!style || generateMutation.isPending}
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 mr-2" />
                      AI 스냅샷 생성
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 4: Results */}
        {currentStep === 4 && generatedImages.length > 0 && (
          <Card>
            <CardContent className="p-8 space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">생성 완료! 🎉</h2>
                <p className="text-gray-600 dark:text-gray-400">
                  총 {generatedImages.length}장의 AI 스냅샷이 생성되었습니다
                </p>
              </div>

              {/* Image Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {generatedImages.map((image, index) => (
                  <div 
                    key={image.id} 
                    className="group relative cursor-pointer transition-transform hover:scale-105"
                    onClick={() => setViewImage(image)}
                  >
                    <img
                      src={image.url}
                      alt={`Generated ${index + 1}`}
                      className="w-full h-64 object-cover rounded-lg shadow-lg"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <Eye className="w-8 h-8 text-white" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex justify-center space-x-4">
                <Button onClick={handleReset} variant="outline">
                  새로 생성하기
                </Button>
                <Link 
                  href="/gallery?filter=snapshot"
                  className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background h-10 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  갤러리이동
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Image Viewer Dialog */}
        <Dialog open={!!viewImage} onOpenChange={(open) => !open && setViewImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
            {viewImage && (
              <div className="relative">
                <img
                  src={viewImage.url}
                  alt="Generated snapshot"
                  className="w-full h-auto max-h-[85vh] object-contain"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => setViewImage(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
