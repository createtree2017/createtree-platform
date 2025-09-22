import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ImageIcon, 
  Download, 
  Plus, 
  Loader2, 
  Eye, 
  Share2, 
  Check,
  ChevronRight,
  PaintbrushVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import GalleryEmbed from "@/components/GalleryEmbedSimple";
import { useImageGenerationStore } from "@/stores/imageGenerationStore";

// 공통 API 함수들
const getConceptCategories = () => fetch('/api/admin/concept-categories').then(res => res.json());
const getConcepts = () => fetch('/api/admin/concepts').then(res => res.json());

interface Style {
  value: string;
  label: string;
  thumbnailUrl: string;
  categoryId: string;
  description: string;
}

interface TransformedImage {
  id: number;
  title: string;
  style: string;
  originalUrl: string;
  transformedUrl: string;
  createdAt: string;
  isTemporary?: boolean;
  aspectRatio?: string;
  categoryId?: string;
}

interface ImageGenerationTemplateProps {
  // 필수 props
  categoryId: string; // 'mansak_img', 'family_img', 'sticker_img' 등
  pageTitle: string; // '만삭사진 만들기', '가족사진 만들기' 등
  apiEndpoint: string; // '/api/generate-maternity', '/api/generate-family' 등
  
  // 선택적 props
  aspectRatioOptions?: Array<{ value: string; label: string; ratio: string }>;
  defaultAspectRatio?: string;
  supportedFileTypes?: string[];
  maxFileSize?: number;
  galleryTitle?: string;
  
  // 스타일 필터링 옵션 (특수 경우용)
  customStyleFilter?: (style: any) => boolean;
  
  // 추가 변수 입력 필드 지원
  variableFields?: boolean;
}

export default function ImageGenerationTemplate({
  categoryId,
  pageTitle,
  apiEndpoint,
  aspectRatioOptions = [
    { value: "1:1", label: "정방형 (1:1)", ratio: "1:1" },
    { value: "4:3", label: "가로형 (4:3)", ratio: "4:3" },
    { value: "3:4", label: "세로형 (3:4)", ratio: "3:4" },
    { value: "16:9", label: "와이드 (16:9)", ratio: "16:9" }
  ],
  defaultAspectRatio = "1:1",
  supportedFileTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  maxFileSize = 10,
  galleryTitle,
  customStyleFilter,
  variableFields = false
}: ImageGenerationTemplateProps) {
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transformedImage, setTransformedImage] = useState<TransformedImage | null>(null);
  const [styleDialogOpen, setStyleDialogOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [styleVariables, setStyleVariables] = useState<any[]>([]);
  const [variableInputs, setVariableInputs] = useState<{[key: string]: string}>({});
  const [selectedImageForModal, setSelectedImageForModal] = useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 전역 상태 관리
  const { 
    hasActiveGeneration, 
    isGeneratingForCategory,
    startGeneration, 
    completeGeneration, 
    clearAllGenerations,
    getActiveGeneration 
  } = useImageGenerationStore();
  
  // 현재 생성 중인지 확인 (전역 상태 + 로컬 상태)
  const isTransforming = hasActiveGeneration();
  const isCurrentCategoryGenerating = isGeneratingForCategory(categoryId);

  // 컴포넌트 마운트 시 로그만 출력 (상태 정리 제거)
  useEffect(() => {
    console.log('ImageGenerationTemplate 마운트 - 기존 생성 작업 유지');
    console.log('현재 활성 생성 작업:', hasActiveGeneration() ? '있음' : '없음');
  }, [hasActiveGeneration]);

  // 카테고리와 스타일 데이터 로드
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/admin/concept-categories'],
    queryFn: getConceptCategories
  });

  const { data: allStyles = [] } = useQuery({
    queryKey: ['/api/admin/concepts'],
    queryFn: getConcepts
  });

  // 스타일 필터링 - 커스텀 필터가 있으면 사용, 없으면 기본 카테고리 필터
  const filteredStyles: Style[] = allStyles
    .filter((style: any) => {
      if (customStyleFilter) {
        return customStyleFilter(style);
      }
      return style.categoryId === categoryId;
    })
    .map((style: any) => ({
      value: style.conceptId,
      label: style.title,
      thumbnailUrl: style.thumbnailUrl,
      categoryId: style.categoryId,
      description: style.description
    }));

  // 파일 선택 핸들러
  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  // 스타일 선택 핸들러
  const handleStyleSelect = async (styleValue: string) => {
    setSelectedStyle(styleValue);
    
    // 변수 초기화
    setStyleVariables([]);
    setVariableInputs({});
    
    if (variableFields) {
      // API에서 해당 컨셉의 변수 정보 로드
      try {
        console.log(`[변수 로드] ${styleValue} 컨셉의 변수 정보 조회 중...`);
        const response = await fetch(`/api/admin/concepts/${styleValue}/variables`);
        
        console.log(`[변수 로드] ${styleValue} API 응답 상태:`, response.status);
        
        if (response.ok) {
          const variables = await response.json();
          console.log(`[변수 로드] ${styleValue} 컨셉 API 응답:`, variables);
          
          if (Array.isArray(variables) && variables.length > 0) {
            setStyleVariables(variables);
            
            // 기본값 설정
            const defaultInputs: {[key: string]: string} = {};
            variables.forEach((variable: any) => {
              if (variable.name) {
                defaultInputs[variable.name] = variable.defaultValue || '';
              }
            });
            setVariableInputs(defaultInputs);
            console.log(`✅ [변수 로드] ${styleValue} 컨셉에 ${variables.length}개 변수 로드 성공!`);
          } else {
            console.log(`ℹ️ [변수 로드] ${styleValue} 컨셉에 변수 없음`);
            setStyleVariables([]);
            setVariableInputs({});
          }
        } else {
          console.log(`❌ [변수 로드] ${styleValue} 컨셉 변수 조회 실패:`, response.status);
          const errorText = await response.text();
          console.log(`❌ [변수 로드] 에러 내용:`, errorText);
        }
      } catch (error) {
        console.error('❌ [변수 로드] API 호출 실패:', error);
        setStyleVariables([]);
        setVariableInputs({});
      }
    }
    
    setStyleDialogOpen(false);
  };



  // 이미지 생성 mutation
  const generateImageMutation = useMutation({
    mutationFn: async (data: { file: File; style: string; aspectRatio?: string; variables?: {[key: string]: string} }) => {
      // 전역 상태에 생성 작업 등록
      const taskId = `${data.style}_${Date.now()}`;
      startGeneration(taskId, {
        categoryId,
        fileName: data.file.name,
        style: data.style
      });
      
      const formData = new FormData();
      formData.append('image', data.file);
      formData.append('style', data.style);
      
      if (data.aspectRatio) {
        formData.append('aspectRatio', data.aspectRatio);
      }
      
      if (data.variables && Object.keys(data.variables).length > 0) {
        formData.append('variables', JSON.stringify(data.variables));
      }

      try {
        console.log('🚀 [파일 업로드] 시작:', {
          file: data.file.name,
          fileSize: data.file.size,
          fileType: data.file.type,
          endpoint: apiEndpoint
        });
        
        // JWT 토큰을 쿠키에서 가져오기 (새로운 토큰 우선)
        const token = document.cookie
          .split('; ')
          .find(row => row.startsWith('auth_token='))
          ?.split('=')[1] || 
          document.cookie
          .split('; ')
          .find(row => row.startsWith('jwt_token='))
          ?.split('=')[1];

        console.log('🔑 [인증] 토큰 상태:', token ? '존재함' : '없음');

        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
          },
          body: formData,
          // keepalive를 사용하여 페이지 이동 시에도 요청 지속
          keepalive: true
        });

        console.log('📡 [응답] 상태:', response.status, response.statusText);
        
        // 응답 텍스트 확인
        const responseText = await response.text();
        console.log('📄 [응답 내용]:', responseText);

        if (!response.ok) {
          // 인증 실패 시 토큰 갱신 시도
          if (response.status === 401) {
            console.log('인증 실패, 토큰 갱신 시도');
            // 페이지 새로고침으로 토큰 갱신
            window.location.reload();
            throw new Error('인증이 만료되었습니다. 페이지를 새로고침합니다.');
          }
          
          const errorData = await response.json().catch(() => ({ message: '이미지 생성에 실패했습니다' }));
          throw new Error(errorData.message || '이미지 생성에 실패했습니다');
        }

        // 응답 텍스트를 JSON으로 파싱
        const result = JSON.parse(responseText);
        console.log('✅ 파싱된 결과:', result);
        
        // 전역 상태에서 작업 완료 처리
        completeGeneration(taskId);
        
        // 이미지 생성 성공 시 즉시 처리
        if (result && result.success && result.image) {
          console.log('🎯 이미지 생성 완료, 즉시 처리 시작');
          
          // 1. 상태 업데이트
          setTransformedImage(result);
          
          // 2. 갤러리 새로고침
          queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
          queryClient.invalidateQueries({ queryKey: ['/api/gallery', categoryId] });
          
          // 3. 커스텀 이벤트 발생
          const imageCreatedEvent = new CustomEvent('imageCreated', {
            detail: { 
              imageId: result.image.id, 
              categoryId: categoryId,
              image: result.image
            }
          });
          window.dispatchEvent(imageCreatedEvent);
          console.log('📢 갤러리 업데이트 이벤트 발생');
          
          // 4. 토스트 메시지
          toast({
            title: "이미지 생성 완료!",
            description: "생성된 이미지를 확인해보세요.",
            duration: 3000,
          });

          // 5. 갤러리 섹션으로 스크롤
          setTimeout(() => {
            const galleryElement = document.querySelector('[data-gallery-section]');
            if (galleryElement) {
              galleryElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
              console.log('📍 갤러리 섹션으로 스크롤 완료');
            }
          }, 500);
          
          // 6. 완성된 이미지 모달 자동 표시
          setTimeout(() => {
            console.log('🖼️ 완성된 이미지 모달 표시:', result.image);
            setSelectedImageForModal({
              id: result.image.id,
              title: result.image.title || '생성된 이미지',
              url: result.image.originalUrl || result.image.transformedUrl,
              transformedUrl: result.image.transformedUrl,
              originalUrl: result.image.originalUrl,
              style: result.image.style
            });
          }, 1500);
        }
        
        return result;
      } catch (error) {
        // 실패 시에도 전역 상태에서 제거
        completeGeneration(taskId);
        throw error;
      }
    },
    onSuccess: (response) => {
      console.log('🎯 이미지 생성 응답 수신:', response);
      
      // 응답 데이터 구조 확인
      const imageData = response.image || response;
      console.log('📸 이미지 데이터:', imageData);
      
      setTransformedImage(response);
      
      // 즉시 갤러리 새로고침
      console.log('🔄 갤러리 즉시 새로고침 시작');
      queryClient.invalidateQueries({ queryKey: ['/api/gallery'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gallery', categoryId] });
      
      // 커스텀 이벤트 발생
      const imageCreatedEvent = new CustomEvent('imageCreated', {
        detail: { 
          imageId: imageData.id, 
          categoryId: categoryId,
          image: imageData
        }
      });
      window.dispatchEvent(imageCreatedEvent);
      console.log('📢 갤러리 업데이트 이벤트 발생');
      
      toast({
        title: "이미지 생성 완료!",
        description: "생성된 이미지를 확인해보세요.",
        duration: 3000,
      });

      // 즉시 결과 섹션으로 스크롤
      setTimeout(() => {
        const resultElement = document.querySelector('[data-result-section]');
        if (resultElement) {
          resultElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          console.log('📍 결과 섹션으로 스크롤 완료');
        }
      }, 500);
      
      // 완성된 이미지 모달 자동 표시
      if (imageData && imageData.id) {
        setTimeout(() => {
          console.log('🖼️ 완성된 이미지 모달 표시:', imageData);
          setSelectedImageForModal({
            id: imageData.id,
            title: imageData.title || '생성된 이미지',
            url: imageData.originalUrl || imageData.transformedUrl,
            transformedUrl: imageData.transformedUrl,
            originalUrl: imageData.originalUrl,
            style: imageData.style
          });
        }, 1500);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "이미지 생성 실패",
        description: error.message || "이미지 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  // 이미지 생성 시작
  const handleGenerate = () => {
    if (!selectedFile || !selectedStyle) {
      toast({
        title: "입력 확인",
        description: "이미지와 스타일을 모두 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 진행 중인 작업이 있으면 중복 실행 방지
    if (isTransforming || generateImageMutation.isPending) {
      console.log('이미 이미지 생성이 진행 중입니다.');
      return;
    }

    console.log('이미지 생성 시작:', {
      file: selectedFile.name,
      style: selectedStyle,
      aspectRatio: aspectRatio,
      variables: variableFields ? variableInputs : undefined
    });

    generateImageMutation.mutate({
      file: selectedFile,
      style: selectedStyle,
      aspectRatio: aspectRatio,
      variables: variableFields ? variableInputs : undefined
    });
  };

  // 이미지 클릭 핸들러
  const handleImageClick = (image: TransformedImage) => {
    setSelectedImageForModal(image);
  };

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{pageTitle}</h1>
          <p className="text-gray-300">AI가 당신만의 특별한 이미지를 만들어드립니다</p>
          
          {/* 전역 이미지 생성 상태 표시 */}
          {hasActiveGeneration() && (
            <div className="mt-4 p-4 bg-blue-900/50 border border-blue-500 rounded-lg">
              <div className="flex items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                <span className="text-blue-200 font-medium">
                  {isGeneratingForCategory(categoryId) 
                    ? `현재 ${pageTitle} 이미지를 생성하고 있습니다...`
                    : (() => {
                        const activeGen = getActiveGeneration();
                        return activeGen 
                          ? `다른 카테고리에서 이미지 생성 중입니다... (${activeGen.fileName})`
                          : '이미지 생성 중입니다...';
                      })()
                  }
                </span>
              </div>
            </div>
          )}
        </div>

        {/* 이미지 생성 영역 */}
        <div className="space-y-6">
          {/* 파일 업로드 */}
          <div className="bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <ImageIcon className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">이미지 업로드</h2>
              </div>
              
              <FileUpload
                onFileSelect={handleFileSelected}
                accept={supportedFileTypes.join(',')}
                maxSize={maxFileSize * 1024 * 1024}
                className="border-2 border-dashed border-gray-600 hover:border-purple-400 transition-colors bg-gray-700"
              />

              {previewUrl && (
                <div className="mt-4">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full max-w-md mx-auto rounded-lg shadow-md"
                  />
                </div>
              )}
            </div>

            {/* 스타일 선택 */}
            <div className="bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <PaintbrushVertical className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-semibold text-white">스타일 선택</h2>
              </div>

              <Button
                onClick={() => setStyleDialogOpen(true)}
                variant="outline"
                className="w-full h-auto p-4 border-2 border-gray-600 hover:border-purple-400 bg-gray-700 text-white hover:bg-gray-600"
              >
                {selectedStyle ? (
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden">
                      {filteredStyles.find(s => s.value === selectedStyle)?.thumbnailUrl && (
                        <img 
                          src={filteredStyles.find(s => s.value === selectedStyle)?.thumbnailUrl}
                          alt="Selected style"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{filteredStyles.find(s => s.value === selectedStyle)?.label}</p>
                      <p className="text-sm text-gray-500">클릭하여 변경</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Plus className="w-6 h-6" />
                    <span>스타일을 선택해주세요</span>
                  </div>
                )}
              </Button>

              {/* 비율 선택 */}
              {aspectRatioOptions.length > 0 && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">이미지 비율</label>
                  <div className="grid grid-cols-2 gap-2">
                    {aspectRatioOptions.map((option) => (
                      <Button
                        key={option.value}
                        variant={aspectRatio === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setAspectRatio(option.value)}
                        className="text-xs"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* 변수 입력 필드 */}
              {variableFields && styleVariables.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h3 className="font-medium text-[#ffffff]">추가 옵션</h3>
                  {styleVariables.map((variable: any) => (
                    <div key={variable.name}>
                      <label className="block text-sm font-medium mb-1 text-[#f7fbff]">
                        {variable.label}
                      </label>
                      <input
                        type="text"
                        value={variableInputs[variable.name] || ''}
                        onChange={(e) => setVariableInputs(prev => ({
                          ...prev,
                          [variable.name]: e.target.value
                        }))}
                        placeholder={variable.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 text-black"
                      />
                      {variable.description && (
                        <p className="text-xs text-gray-500 mt-1">{variable.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 생성 버튼 */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <Button
                onClick={handleGenerate}
                disabled={!selectedFile || !selectedStyle || isTransforming}
                className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {isTransforming ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>이미지 생성 중...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <ImageIcon className="w-6 h-6" />
                    <span>이미지 생성하기</span>
                  </div>
                )}
              </Button>
            </div>


          </div>

        </div>

        {/* 갤러리 섹션 - 아래쪽에 배치 */}
        <div className="mt-12" data-gallery-section>
          <div className="bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-700">
            <h2 className="text-xl font-semibold text-white mb-6">
              {galleryTitle || `${pageTitle} 갤러리`}
            </h2>
            <GalleryEmbed 
              filter={categoryId as any}
              showFilters={false}
              maxItems={20}
            />
          </div>
        </div>

      {/* 스타일 선택 다이얼로그 */}
      <Dialog open={styleDialogOpen} onOpenChange={setStyleDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>스타일 선택</DialogTitle>
            <DialogDescription>
              원하는 스타일을 선택해주세요
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-4">
            {filteredStyles.map((style) => (
              <div
                key={style.value}
                onClick={() => handleStyleSelect(style.value)}
                className={cn(
                  "relative border-2 rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-105",
                  selectedStyle === style.value 
                    ? "border-purple-500 ring-2 ring-purple-200" 
                    : "border-gray-200 hover:border-purple-300"
                )}
              >
                {style.thumbnailUrl && (
                  <div className="relative w-full aspect-square">
                    <img 
                      src={style.thumbnailUrl}
                      alt={style.label}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-2">
                  <h3 className="font-medium text-sm text-center">{style.label}</h3>
                </div>
                {selectedStyle === style.value && (
                  <div className="absolute top-2 right-2 bg-purple-500 text-white rounded-full p-1">
                    <Check className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      {/* 이미지 상세보기 모달 */}
      {selectedImageForModal && (
        <Dialog open={!!selectedImageForModal} onOpenChange={() => setSelectedImageForModal(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>이미지 상세보기</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <img 
                src={selectedImageForModal.transformedUrl || selectedImageForModal.originalUrl}
                alt={selectedImageForModal.title}
                className="w-full rounded-lg"
              />
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">{selectedImageForModal.title}</h3>
                  <p className="text-sm text-gray-500">
                    {new Date(selectedImageForModal.createdAt).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    다운로드
                  </Button>
                  <Button size="sm" variant="outline">
                    <Share2 className="w-4 h-4 mr-2" />
                    공유
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}