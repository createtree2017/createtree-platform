import { useState, useEffect, useRef } from "react";
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
  PaintbrushVertical,
  Building2,
  X,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { useModal } from "@/hooks/useModal";
import { cn } from "@/lib/utils";
import { useAuthContext } from "@/lib/AuthProvider";
import { Link } from "wouter";
import GalleryEmbed from "@/components/GalleryEmbedSimple";
import { useImageGenerationStore } from "@/stores/imageGenerationStore";
import { useModelCapabilities, getEffectiveAspectRatios } from "@/hooks/useModelCapabilities";
import { useSystemSettings, getAvailableModelsForConcept, getDefaultModel } from "@/hooks/useSystemSettings";
import { AiModel } from "@shared/schema";
import { useImageGeneration } from "@/hooks/useImageGeneration";
import { useImageState } from "@/hooks/useImageState";

// 공통 API 함수들
const getConceptCategories = () => fetch('/api/concept-categories').then(res => res.json());
const getConcepts = () => fetch('/api/concepts').then(res => res.json());

interface Style {
  value: string;
  label: string;
  thumbnailUrl: string;
  categoryId: string;
  description: string;
  visibilityType?: string;
  hospitalId?: number;
  generationType?: string;
  availableModels?: string[];
  minImageCount?: number;
  maxImageCount?: number;
  enableImageText?: boolean;
}

export interface UploadedImage {
  file: File | null;
  previewUrl: string;
  text: string;
}

export interface TransformedImage {
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
  defaultAspectRatio?: string;
  supportedFileTypes?: string[];
  maxFileSize?: number;
  galleryTitle?: string;

  // 스타일 필터링 옵션 (특수 경우용)
  customStyleFilter?: (style: any) => boolean;

  // 추가 변수 입력 필드 지원
  variableFields?: boolean;

  // 이미지 비율 선택기 표시 여부 (기본값: true)
  showAspectRatioSelector?: boolean;

  // 컨셉 데이터 (스티커 페이지용)
  concepts?: any[];
  isConceptsLoading?: boolean;
  conceptsError?: Error | null;

  // 초기 컨셉 ID (URL 파라미터로 전달받은 경우)
  initialConceptId?: string;
}

export default function ImageGenerationTemplate({
  categoryId,
  pageTitle,
  apiEndpoint,
  defaultAspectRatio = "1:1",
  supportedFileTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"],
  maxFileSize = 10,
  galleryTitle,
  customStyleFilter,
  variableFields = false,
  showAspectRatioSelector = true,
  concepts,
  isConceptsLoading,
  conceptsError,
  initialConceptId
}: ImageGenerationTemplateProps) {
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const hasAutoSelectedRef = useRef<boolean>(false); // 초기 자동 선택 완료 여부 추적
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [styleVariables, setStyleVariables] = useState<any[]>([]);

  const [transformedImage, setTransformedImage] = useState<TransformedImage | null>(null);
  const [selectedModel, setSelectedModel] = useState<AiModel>("openai"); // 초기값은 시스템 설정 로드 후 업데이트됨
  const [variableInputs, setVariableInputs] = useState<{ [key: string]: string }>({});
  
  // 기존 모달 관련 상태 제거 (갤러리 방식 사용)
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const modal = useModal();

  // 전역 상태 관리
  const {
    hasActiveGeneration,
    isGeneratingForCategory,
    startGeneration,
    completeGeneration,
    clearAllGenerations,
    getActiveGeneration
  } = useImageGenerationStore();

  // 🔥 Firebase Direct Upload: AuthContext에서 업로드 모드 가져오기
  const { uploadMode, isFirebaseReady } = useAuthContext();

  // 모델 capabilities 조회
  const { data: modelCapabilities, isLoading: isCapabilitiesLoading, error: capabilitiesError } = useModelCapabilities();

  // 시스템 설정 조회
  const { data: systemSettings, isLoading: isSystemSettingsLoading } = useSystemSettings();

  // 현재 생성 중인지 확인 (전역 상태 + 로컬 상태)
  const isTransforming = hasActiveGeneration();
  const isCurrentCategoryGenerating = isGeneratingForCategory(categoryId);

  // 컴포넌트 마운트 시 스크롤 최상단으로 이동
  useEffect(() => {
    console.log('🚀 ImageGenerationTemplate 마운트 - 스크롤 시작');

    // 즉시 모든 스크롤 컨테이너 초기화
    const scrollToTop = () => {
      // 1. 모든 overflow-y-auto 요소 찾기
      const scrollContainers = document.querySelectorAll('.overflow-y-auto');
      console.log(`📦 스크롤 컨테이너 ${scrollContainers.length}개 발견`);

      scrollContainers.forEach((container, index) => {
        container.scrollTop = 0;
        console.log(`✅ 컨테이너 ${index + 1} 스크롤 완료`);
      });

      // 2. window도 스크롤
      window.scrollTo(0, 0);

      // 3. document.body도 스크롤
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    };

    // 즉시 실행
    scrollToTop();

    // DOM 렌더링 후 다시 실행 (확실성 보장)
    setTimeout(scrollToTop, 0);
    setTimeout(scrollToTop, 100);

    console.log('✅ 스크롤 초기화 완료');
  }, []);

  // 카테고리와 스타일 데이터 로드
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/admin/concept-categories'],
    queryFn: getConceptCategories
  });

  // 전달받은 concepts가 있으면 사용, 없으면 API에서 조회
  const { data: allStyles = [], isLoading: isStylesLoading } = useQuery({
    queryKey: ['/api/concepts'],
    queryFn: getConcepts,
    enabled: !concepts // concepts prop이 없을 때만 조회
  });

  // 실제 사용할 스타일 데이터 결정 (항상 배열 보장)
  const styleData = concepts || allStyles || [];

  // 스타일 데이터 로딩 상태 (props로 받은 경우는 항상 로드됨으로 간주)
  const isStyleDataLoading = concepts ? false : isStylesLoading;

  // 스타일 필터링 - 커스텀 필터가 있으면 사용, 없으면 기본 카테고리 필터
  const filteredStyles: Style[] = (styleData || [])
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
      description: style.description,
      visibilityType: style.visibilityType,
      hospitalId: style.hospitalId,
      generationType: style.generationType || "image_upload",
      availableModels: style.availableModels || ["openai", "gemini_3_1"],
      availableAspectRatios: style.availableAspectRatios, // 컨셉별 aspect ratio 정보 추가
      minImageCount: style.minImageCount || 1,
      maxImageCount: style.maxImageCount || 1,
      enableImageText: style.enableImageText || false
    }));

  // 선택된 스타일의 정보 가져오기 (안전한 접근)
  const selectedStyleData = filteredStyles?.find(style => style.value === selectedStyle);
  const requiresImageUpload = selectedStyleData?.generationType === "image_upload" || !selectedStyleData?.generationType;

  // 다중 이미지 관련 설정
  const maxImageCount = selectedStyleData?.maxImageCount || 1;
  const minImageCount = selectedStyleData?.minImageCount || 1;
  const enableImageText = selectedStyleData?.enableImageText || false;
  const isMultiImageMode = maxImageCount > 1;

  // 선택된 컨셉의 사용 가능한 모델 (시스템 설정과 컨셉 제한의 교집합)
  const availableModels = getAvailableModelsForConcept(systemSettings, selectedStyleData?.availableModels) || [];
  const shouldShowModelSelection = selectedStyle && availableModels.length > 1;

  // --- 🆕 Phase 2: 추출된 상태 관리 훅 적용 ---
  const {
    selectedFile,
    previewUrl,
    setPreviewUrl,
    setSelectedFile,
    handleFileSelected,
    uploadedImages,
    handleMultiImageFileSelect,
    handleMultiImageTextChange,
    handleAddImageSlot,
    handleRemoveImageSlot,
    variableInputs: hookVariableInputs, // Rename to avoid conflict if any
    setVariableInputs: hookSetVariableInputs,
    handleVariableChange
  } = useImageState({
    isMultiImageMode,
    selectedStyle,
    maxImageCount,
  });

  // 상태 통합
  useEffect(() => {
    setVariableInputs(hookVariableInputs);
  }, [hookVariableInputs]);

  // --- 🆕 Phase 2: 추출된 생성/네트워크 훅 적용 ---
  const {
    generateImageMutation,
    isGenerating,
    isUploading,
    uploadProgress
  } = useImageGeneration({
    apiEndpoint,
    categoryId,
    uploadMode,
    isFirebaseReady,
    selectedModel,
    startGeneration,
    completeGeneration,
    setTransformedImage
  });

  // 동적 aspect ratio 옵션 생성
  const getAspectRatioOptions = () => {
    if (!selectedStyle || !modelCapabilities) {
      return [];
    }

    const concept = styleData.find((s: any) => s.conceptId === selectedStyle);
    const effectiveRatios = getEffectiveAspectRatios(selectedModel, concept, modelCapabilities);

    return effectiveRatios.map(ratio => {
      const labels: Record<string, string> = {
        "1:1": "정사각형 (1:1)",
        "2:3": "세로형 (2:3)",
        "3:2": "가로형 (3:2)",
        "9:16": "세로형 (9:16)",
        "16:9": "가로형 (16:9)",
        "4:3": "가로형 (4:3)",
        "3:4": "세로형 (3:4)"
      };

      return {
        value: ratio,
        label: labels[ratio] || `${ratio} (비율)`,
        ratio: ratio
      };
    });
  };

  const aspectRatioOptions = getAspectRatioOptions();

  // 컨셉 변경 시 모델 선택 및 aspect ratio 자동 조정
  useEffect(() => {
    // 시스템 설정이 로드되지 않았으면 대기
    if (!systemSettings || isSystemSettingsLoading) {
      return;
    }

    // availableModels가 없거나 빈 배열이면 대기
    if (!availableModels || availableModels.length === 0) {
      return;
    }

    if (availableModels.length === 1) {
      // 사용 가능한 모델이 1개면 자동 선택
      setSelectedModel(availableModels[0] as AiModel);
    } else if (availableModels.length > 1 && !availableModels.includes(selectedModel)) {
      // 현재 선택된 모델이 사용 불가능하면 시스템 설정 기본값 또는 첫 번째 모델로 변경
      const defaultModel = getDefaultModel(systemSettings, availableModels);
      setSelectedModel(defaultModel as AiModel);
    }

    // 스타일이나 모델이 변경될 때 aspect ratio 유효성 검사 및 조정
    if (selectedStyle && modelCapabilities) {
      const concept = styleData.find((s: any) => s.conceptId === selectedStyle);
      const effectiveRatios = getEffectiveAspectRatios(selectedModel, concept, modelCapabilities);

      // 현재 선택된 aspect ratio가 유효하지 않으면 첫 번째 유효한 것으로 변경
      if (effectiveRatios.length > 0 && !effectiveRatios.includes(aspectRatio)) {
        setAspectRatio(effectiveRatios[0]);
      }
    }
  }, [selectedStyle, availableModels, selectedModel, modelCapabilities, aspectRatio, styleData, systemSettings, isSystemSettingsLoading]);

  // URL 파라미터 또는 initialConceptId prop에서 스타일 읽기 및 자동 선택 (최초 1회만)
  useEffect(() => {
    // 이미 자동 선택이 완료되었으면 무시 (사용자 수동 선택 우선)
    if (hasAutoSelectedRef.current) {
      return;
    }

    // 스타일 데이터가 로딩 중이면 대기
    if (isStyleDataLoading) {
      console.log('⏳ 스타일 데이터 로딩 중, URL 파라미터 처리 대기...');
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const styleParam = params.get('style');
    const conceptIdParam = params.get('conceptId');

    // 우선순위: conceptId URL param > style URL param > initialConceptId prop
    // URL 파라미터가 있으면 현재 URL 상태를 우선시 (동적 연동)
    const targetStyle = conceptIdParam || styleParam || initialConceptId;

    if (targetStyle && filteredStyles.length > 0) {
      // 해당 스타일이 존재하면 자동 선택
      const styleExists = filteredStyles.some(style => style.value === targetStyle);
      if (styleExists && selectedStyle !== targetStyle) {
        console.log(`🎨 스타일 자동 선택: ${targetStyle} (source: ${conceptIdParam ? 'conceptId URL' : styleParam ? 'style URL' : 'prop'})`);

        // 모든 스크롤 컨테이너 초기화
        const scrollContainers = document.querySelectorAll('.overflow-y-auto');
        scrollContainers.forEach(container => {
          container.scrollTop = 0;
        });
        window.scrollTo(0, 0);
        document.body.scrollTop = 0;
        document.documentElement.scrollTop = 0;

        console.log('✅ 스타일 선택 시 스크롤 초기화 완료');

        setSelectedStyle(targetStyle);
        hasAutoSelectedRef.current = true; // 자동 선택 완료 표시

        // 변수 로드 (스타일 선택 페이지에서 넘어온 경우 변수 표시를 위해)
        loadStyleVariables(targetStyle).catch(err => {
          console.error('❌ URL 파라미터 스타일 변수 로드 실패:', err);
        });
      }
    }
  }, [isStyleDataLoading, filteredStyles, initialConceptId]);

  // 시스템 설정 로드 시 초기 기본 모델 설정
  useEffect(() => {
    if (!systemSettings || isSystemSettingsLoading) {
      return;
    }

    // 첫 로드 시 시스템 기본 모델로 초기화 (아무 스타일도 선택되지 않은 경우)
    if (!selectedStyle && selectedModel === "openai") {
      const defaultModel = getDefaultModel(systemSettings, systemSettings.supportedAiModels);
      setSelectedModel(defaultModel as AiModel);
    }
  }, [systemSettings, isSystemSettingsLoading, selectedStyle, selectedModel]);

  // 스타일 변수 로드 함수 (공통 로직)
  const loadStyleVariables = async (styleValue: string) => {
    // 변수 초기화
    setStyleVariables([]);
    setVariableInputs({});

    if (variableFields) {
      // API에서 해당 컨셉의 변수 정보 로드
      try {
        console.log(`[변수 로드] ${styleValue} 컨셉의 변수 정보 조회 중...`);
        const response = await fetch(`/api/concepts/${styleValue}/variables`);

        console.log(`[변수 로드] ${styleValue} API 응답 상태:`, response.status);

        if (response.ok) {
          const variables = await response.json();
          console.log(`[변수 로드] ${styleValue} 컨셉 API 응답:`, variables);

          if (Array.isArray(variables) && variables.length > 0) {
            setStyleVariables(variables);

            // 기본값 설정
            const defaultInputs: { [key: string]: string } = {};
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
  };

  // 스타일 선택 핸들러
  const handleStyleSelect = async (styleValue: string) => {
    setSelectedStyle(styleValue);

    // URL 동기화 - 사용자가 스타일을 변경하면 URL도 업데이트
    const newUrl = `${window.location.pathname}?conceptId=${styleValue}`;
    window.history.replaceState({}, '', newUrl);
    console.log(`🔄 URL 동기화: ${newUrl}`);

    await loadStyleVariables(styleValue);
    modal.close();
  };



  // 이미지 생성 시작
  const handleGenerate = () => {
    // 스타일 선택 확인
    if (!selectedStyle) {
      toast({
        title: "입력 확인",
        description: "스타일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 다중 이미지 모드 검증
    if (requiresImageUpload && isMultiImageMode) {
      const uploadedCount = uploadedImages.filter(img => img.file).length;
      if (uploadedCount < minImageCount) {
        toast({
          title: "입력 확인",
          description: `최소 ${minImageCount}개 이상의 이미지를 업로드해주세요.`,
          variant: "destructive",
        });
        return;
      }
    }

    // 단일 이미지 모드 검증 (기존 방식)
    if (requiresImageUpload && !isMultiImageMode && !selectedFile) {
      toast({
        title: "입력 확인",
        description: "이미지를 선택해주세요.",
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
      file: selectedFile?.name || '파일 없음 (텍스트 전용)',
      style: selectedStyle,
      aspectRatio: aspectRatio,
      variables: variableFields ? variableInputs : undefined,
      requiresImageUpload: requiresImageUpload,
      isMultiImageMode: isMultiImageMode,
      uploadedImagesCount: uploadedImages.filter(img => img.file).length
    });

    const requestData: any = {
      style: selectedStyle,
      aspectRatio: aspectRatio,
      variables: variableFields ? variableInputs : undefined
    };

    // 다중 이미지 모드
    if (requiresImageUpload && isMultiImageMode) {
      requestData.multiImages = uploadedImages;
    } else if (requiresImageUpload && selectedFile) {
      // 단일 이미지 모드 (기존 방식)
      requestData.file = selectedFile;
    }

    generateImageMutation.mutate(requestData);
  };

  // 이미지 클릭 핸들러 (현재 사용하지 않음 - 갤러리에서 직접 처리)
  const handleImageClick = (image: TransformedImage) => {
    // 갤러리 컴포넌트에서 직접 모달 처리
    console.log('이미지 클릭:', image);
  };

  return (
    <div className="min-h-[var(--dvh)] p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <span className="text-purple-500 text-4xl">✦</span>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">{categoryId === 'family_img' ? '사진스타일 바꾸기' : pageTitle}</h1>
          </div>
          <p className="text-muted-foreground text-lg md:text-xl">AI가 당신만의 특별한 이미지를 만들어드립니다</p>

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

          {/* 🔥 Firebase 업로드 진행률 표시 (Phase 2) */}
          {isUploading && uploadProgress && (
            <div className="mt-4 p-4 bg-purple-900/30 border border-purple-500/30 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-purple-200 font-medium">
                  Firebase 업로드 중... {uploadProgress.completedFiles}/{uploadProgress.totalFiles}
                </span>
                <span className="text-purple-300 text-sm font-mono">
                  {Math.round((uploadProgress.completedFiles / uploadProgress.totalFiles) * 100)}%
                </span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(uploadProgress.completedFiles / uploadProgress.totalFiles) * 100}%`
                  }}
                />
              </div>
              {uploadProgress.currentFile > 0 && (
                <div className="flex items-center justify-between text-xs text-purple-300">
                  <span className="truncate max-w-xs">
                    파일 {uploadProgress.currentFile}: {uploadProgress.currentFileName}
                  </span>
                  <span className="ml-2 text-purple-400 font-mono">
                    {uploadProgress.currentFileProgress.toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 이미지 생성 영역 */}
        <div className="space-y-6">
          {/* 파일 업로드 - 조건부 표시 */}
          {requiresImageUpload ? (
            <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
              <div className="flex items-center gap-3 mb-4">
                <ImageIcon className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-semibold text-foreground">
                  이미지 업로드
                  {isMultiImageMode && (
                    <span className="text-sm font-normal text-gray-400 ml-2">
                      ({minImageCount}~{maxImageCount}개 업로드 가능)
                    </span>
                  )}
                </h2>
              </div>

              {/* 아기얼굴 전용 안내문구 */}
              {categoryId === "baby_face_img" && (
                <div className="mb-4 p-3 bg-purple-900/30 border border-purple-500/30 rounded-lg">
                  <p className="text-purple-200 text-sm">
                    <span className="text-purple-300 font-medium">* 3D 초음파 사진을 넣어주세요.</span>
                    <br />
                    <span className="text-purple-200">(선명한 사진일수록 우리아기의 얼굴이 정확히 나타납니다.)</span>
                  </p>
                </div>
              )}

              {/* 다중 이미지 모드 */}
              {isMultiImageMode ? (
                <div className="space-y-4">
                  {uploadedImages.map((uploadedImage, index) => (
                    <div key={index} className="flex flex-col md:flex-row gap-4 p-4 bg-muted/50 rounded-lg border border-border">
                      {/* 이미지 슬롯 번호 및 삭제 버튼 */}
                      <div className="flex items-center justify-between md:hidden">
                        <span className="text-sm text-gray-300 font-medium">{index + 1}번 이미지</span>
                        {uploadedImages.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveImageSlot(index)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-1 h-auto"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {/* 이미지 업로드/미리보기 영역 */}
                      <div className="flex-shrink-0 w-full md:w-32">
                        <div className="hidden md:flex items-center justify-between mb-2">
                          <span className="text-xs text-gray-400">{index + 1}번</span>
                          {uploadedImages.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveImageSlot(index)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/30 p-0.5 h-auto"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </div>

                        {uploadedImage.previewUrl ? (
                          <div className="relative">
                            <img
                              src={uploadedImage.previewUrl}
                              alt={`이미지 ${index + 1}`}
                              className="w-full h-24 md:h-28 object-cover rounded-lg"
                            />
                            <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg cursor-pointer">
                              <span className="text-white text-xs">변경</span>
                              <input
                                type="file"
                                accept={supportedFileTypes.join(',')}
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleMultiImageFileSelect(index, file);
                                }}
                              />
                            </label>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-24 md:h-28 border-2 border-dashed border-muted-foreground/40 hover:border-purple-400 rounded-lg cursor-pointer bg-muted transition-colors">
                            <Upload className="w-6 h-6 text-gray-400 mb-1" />
                            <span className="text-xs text-gray-400">업로드</span>
                            <input
                              type="file"
                              accept={supportedFileTypes.join(',')}
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleMultiImageFileSelect(index, file);
                              }}
                            />
                          </label>
                        )}
                      </div>

                      {/* 텍스트 입력 영역 (enableImageText가 true일 때만) */}
                      {enableImageText && (
                        <div className="flex-grow">
                          <label className="block text-xs text-gray-400 mb-1">
                            텍스트 입력 (선택)
                          </label>
                          <textarea
                            value={uploadedImage.text}
                            onChange={(e) => handleMultiImageTextChange(index, e.target.value)}
                            placeholder="이 이미지에 대한 설명을 입력하세요..."
                            className="w-full h-20 md:h-24 px-3 py-2 bg-gray-600 border border-gray-500 rounded-lg text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {/* 이미지 추가 버튼 */}
                  {uploadedImages.length < maxImageCount && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddImageSlot}
                      className="w-full border-2 border-dashed border-gray-500 hover:border-purple-400 bg-transparent text-gray-300 hover:text-purple-300"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      이미지 추가 ({uploadedImages.length}/{maxImageCount})
                    </Button>
                  )}
                </div>
              ) : (
                /* 단일 이미지 모드 (기존 방식) */
                <>
                  <FileUpload
                    onFileSelect={handleFileSelected}
                    accept={supportedFileTypes.join(',')}
                    maxSize={maxFileSize * 1024 * 1024}
                    className="border-2 border-dashed border-muted-foreground/40 hover:border-purple-400 transition-colors bg-muted"
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
                </>
              )}
            </div>
          ) : (
            <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
              <div className="flex items-center gap-3 mb-4">
                <PaintbrushVertical className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-semibold text-foreground">텍스트로 이미지 생성</h2>
              </div>
              <div className="text-center p-6 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted">
                <PaintbrushVertical className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                <p className="text-foreground font-medium">이 스타일은 텍스트만으로 이미지를 생성합니다</p>
                <p className="text-muted-foreground text-sm mt-1">스타일과 변수를 선택한 후 생성 버튼을 눌러주세요</p>
              </div>
            </div>
          )}

          {/* 스타일 선택 */}
          <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
            <div className="flex items-center gap-3 mb-4">
              <PaintbrushVertical className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-semibold text-foreground">스타일 선택</h2>
            </div>

            <Button
              onClick={() => modal.open('styleDialog', {
                styles: filteredStyles,
                selectedStyle,
                onSelect: handleStyleSelect
              })}
              variant="outline"
              className="w-full h-auto p-4 border-2 border-border hover:border-purple-400 bg-muted hover:bg-muted/80"
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

            {/* 비율 선택 - 동적 로딩 */}
            {showAspectRatioSelector && (
              <div className="mt-4 hidden">
                <label className="block text-sm font-medium text-muted-foreground mb-2">이미지 비율</label>
                {isCapabilitiesLoading ? (
                  <div className="flex items-center justify-center p-4 border border-border rounded-lg bg-muted">
                    <Loader2 className="w-4 h-4 animate-spin mr-2 text-purple-400" />
                    <span className="text-muted-foreground text-sm">비율 옵션 로딩 중...</span>
                  </div>
                ) : capabilitiesError ? (
                  <div className="p-4 border border-red-500 rounded-lg bg-red-900/20">
                    <span className="text-red-300 text-sm">비율 옵션을 불러오지 못했습니다.</span>
                  </div>
                ) : aspectRatioOptions.length === 0 ? (
                  selectedStyle ? (
                    <div className="p-4 border border-border rounded-lg bg-muted">
                      <span className="text-muted-foreground text-sm">선택한 스타일에 사용 가능한 비율이 없습니다.</span>
                    </div>
                  ) : (
                    <div className="p-4 border border-border rounded-lg bg-muted">
                      <span className="text-muted-foreground text-sm">스타일을 먼저 선택해주세요.</span>
                    </div>
                  )
                ) : (
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
                )}
              </div>
            )}

            {/* AI 모델 선택 - 컨셉별 사용 가능한 모델이 여러 개일 때만 표시 */}
            {shouldShowModelSelection && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-muted-foreground mb-2">AI 모델 선택</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableModels.includes("openai") && (
                    <Button
                      variant={selectedModel === "openai" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedModel("openai")}
                      className="text-xs"
                    >
                      <div className="text-center">
                        <div className="font-medium">GPT-Image-1</div>
                        <div className="text-[10px] opacity-70">고품질, 감성적</div>
                      </div>
                    </Button>
                  )}

                  {availableModels.includes("gemini_3_1") && (
                    <Button
                      variant={selectedModel === "gemini_3_1" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedModel("gemini_3_1")}
                      className="text-xs"
                    >
                      <div className="text-center">
                        <div className="font-medium">Gemini 3.1 Flash</div>
                        <div className="text-[10px] opacity-70">표준, 균형잡힌</div>
                      </div>
                    </Button>
                  )}
                  {availableModels.includes("gemini_3") && (
                    <Button
                      variant={selectedModel === "gemini_3" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedModel("gemini_3")}
                      className="text-xs col-span-2"
                    >
                      <div className="text-center">
                        <div className="font-medium">Gemini 3.0 Pro</div>
                        <div className="text-[10px] opacity-70">프로, 최고 품질</div>
                      </div>
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* 변수 입력 필드 */}
            {variableFields && styleVariables.length > 0 && (
              <div className="mt-4 space-y-3">
                <h3 className="font-medium text-foreground">추가 옵션</h3>
                {styleVariables.map((variable: any) => (
                  <div key={variable.name}>
                    <label className="block text-sm font-medium mb-1 text-foreground">
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
                      className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {variable.description && (
                      <p className="text-xs text-muted-foreground mt-1">{variable.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 생성 버튼 */}
          <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
            <Button
              onClick={handleGenerate}
              disabled={
                (requiresImageUpload && !isMultiImageMode && !selectedFile) ||
                (requiresImageUpload && isMultiImageMode && uploadedImages.filter(img => img.file).length < minImageCount) ||
                !selectedStyle ||
                isTransforming
              }
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

            {/* 안내문구 */}
            <p className="text-sm text-muted-foreground text-center mt-3">
              인쇄품질의 고화질 이미지생성을 지향하기에 2~3분정도 시간이 걸릴 수 있습니다.
            </p>
          </div>


        </div>

      </div>

      {/* 갤러리 섹션 - 아래쪽에 배치 */}
      <div className="mt-12" data-gallery-section>
        <div className="bg-card rounded-2xl p-6 shadow-lg border border-border">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {galleryTitle || `${pageTitle} 갤러리`}
          </h2>
          <GalleryEmbed
            filter={categoryId as any}
            showFilters={false}
            maxItems={20}
          />
        </div>
      </div>

    </div>
  );
}