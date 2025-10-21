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
  PaintbrushVertical,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { useModalHistory } from "@/hooks/useModalHistory";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import GalleryEmbed from "@/components/GalleryEmbedSimple";
import { useImageGenerationStore } from "@/stores/imageGenerationStore";
import { useModelCapabilities, getEffectiveAspectRatios } from "@/hooks/useModelCapabilities";
import { useSystemSettings, getAvailableModelsForConcept, getDefaultModel } from "@/hooks/useSystemSettings";

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
  conceptsError
}: ImageGenerationTemplateProps) {
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [transformedImage, setTransformedImage] = useState<TransformedImage | null>(null);
  const [styleDialogOpen, setStyleDialogOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
  const [styleVariables, setStyleVariables] = useState<any[]>([]);
  const [variableInputs, setVariableInputs] = useState<{[key: string]: string}>({});
  const [selectedModel, setSelectedModel] = useState<"openai" | "gemini">("openai"); // 초기값은 시스템 설정 로드 후 업데이트됨
  // 기존 모달 관련 상태 제거 (갤러리 방식 사용)
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 모달 히스토리 관리
  const { closeWithHistory } = useModalHistory({
    isOpen: styleDialogOpen,
    onClose: () => setStyleDialogOpen(false),
    modalId: 'style-picker'
  });
  
  // 전역 상태 관리
  const { 
    hasActiveGeneration, 
    isGeneratingForCategory,
    startGeneration, 
    completeGeneration, 
    clearAllGenerations,
    getActiveGeneration 
  } = useImageGenerationStore();
  
  // 모델 capabilities 조회
  const { data: modelCapabilities, isLoading: isCapabilitiesLoading, error: capabilitiesError } = useModelCapabilities();
  
  // 시스템 설정 조회
  const { data: systemSettings, isLoading: isSystemSettingsLoading } = useSystemSettings();
  
  // 현재 생성 중인지 확인 (전역 상태 + 로컬 상태)
  const isTransforming = hasActiveGeneration();
  const isCurrentCategoryGenerating = isGeneratingForCategory(categoryId);

  // 컴포넌트 마운트 시 스크롤 최상단으로 이동
  useEffect(() => {
    // 실제 스크롤 컨테이너 찾아서 스크롤 (App.tsx의 overflow-y-auto 컨테이너)
    const scrollContainer = document.querySelector('.overflow-y-auto');
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
      console.log('✅ 스크롤 컨테이너 최상단 이동 완료');
    }
    
    // 브라우저 window도 시도 (일부 환경 대응)
    window.scrollTo(0, 0);
    
    console.log('ImageGenerationTemplate 마운트');
    console.log('현재 활성 생성 작업:', hasActiveGeneration() ? '있음' : '없음');
  }, []);

  // 카테고리와 스타일 데이터 로드
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/admin/concept-categories'],
    queryFn: getConceptCategories
  });

  // 전달받은 concepts가 있으면 사용, 없으면 API에서 조회
  const { data: allStyles = [] } = useQuery({
    queryKey: ['/api/concepts'],
    queryFn: getConcepts,
    enabled: !concepts // concepts prop이 없을 때만 조회
  });
  
  // 실제 사용할 스타일 데이터 결정
  const styleData = concepts || allStyles;

  // 스타일 필터링 - 커스텀 필터가 있으면 사용, 없으면 기본 카테고리 필터
  const filteredStyles: Style[] = styleData
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
      availableModels: style.availableModels || ["openai", "gemini"],
      availableAspectRatios: style.availableAspectRatios // 컨셉별 aspect ratio 정보 추가
    }));

  // 선택된 스타일의 정보 가져오기 (안전한 접근)
  const selectedStyleData = filteredStyles?.find(style => style.value === selectedStyle);
  const requiresImageUpload = selectedStyleData?.generationType === "image_upload" || !selectedStyleData?.generationType;
  
  // 선택된 컨셉의 사용 가능한 모델 (시스템 설정과 컨셉 제한의 교집합)
  const availableModels = getAvailableModelsForConcept(systemSettings, selectedStyleData?.availableModels);
  const shouldShowModelSelection = selectedStyle && availableModels.length > 1;
  
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

    if (availableModels.length === 1) {
      // 사용 가능한 모델이 1개면 자동 선택
      setSelectedModel(availableModels[0] as "openai" | "gemini");
    } else if (availableModels.length > 1 && !availableModels.includes(selectedModel)) {
      // 현재 선택된 모델이 사용 불가능하면 시스템 설정 기본값 또는 첫 번째 모델로 변경
      const defaultModel = getDefaultModel(systemSettings, availableModels);
      setSelectedModel(defaultModel as "openai" | "gemini");
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

  // URL 파라미터에서 스타일 읽기 및 자동 선택
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const styleParam = params.get('style');
    
    if (styleParam && filteredStyles.length > 0) {
      // URL에 style 파라미터가 있고, 해당 스타일이 존재하면 자동 선택
      const styleExists = filteredStyles.some(style => style.value === styleParam);
      if (styleExists && selectedStyle !== styleParam) {
        console.log(`🎨 URL 파라미터에서 스타일 자동 선택: ${styleParam}`);
        
        // 실제 스크롤 컨테이너 찾아서 스크롤
        const scrollContainer = document.querySelector('.overflow-y-auto');
        if (scrollContainer) {
          scrollContainer.scrollTop = 0;
          console.log('✅ 스크롤 컨테이너 최상단 이동 (스타일 선택)');
        }
        window.scrollTo(0, 0);
        
        setSelectedStyle(styleParam);
        
        // URL에서 파라미터 제거 (깔끔한 URL 유지)
        const newUrl = window.location.pathname;
        window.history.replaceState({}, '', newUrl);
      }
    }
  }, [filteredStyles, selectedStyle]);

  // 시스템 설정 로드 시 초기 기본 모델 설정
  useEffect(() => {
    if (!systemSettings || isSystemSettingsLoading) {
      return;
    }

    // 첫 로드 시 시스템 기본 모델로 초기화 (아무 스타일도 선택되지 않은 경우)
    if (!selectedStyle && selectedModel === "openai") {
      const defaultModel = getDefaultModel(systemSettings, systemSettings.supportedAiModels);
      setSelectedModel(defaultModel as "openai" | "gemini");
    }
  }, [systemSettings, isSystemSettingsLoading, selectedStyle, selectedModel]);

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
        const response = await fetch(`/api/concepts/${styleValue}/variables`);
        
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
    mutationFn: async (data: { file?: File; style: string; aspectRatio?: string; variables?: {[key: string]: string} }) => {
      // 파일이 있는 경우에만 파일 크기 체크 (10MB)
      if (data.file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (data.file.size > maxSize) {
          throw new Error(`파일 크기가 너무 큽니다. 최대 10MB까지 업로드 가능합니다. (현재: ${(data.file.size / 1024 / 1024).toFixed(1)}MB)`);
        }
      }
      
      // 전역 상태에 생성 작업 등록
      const taskId = `${data.style}_${Date.now()}`;
      startGeneration(taskId, {
        categoryId,
        fileName: data.file?.name || '텍스트 전용 생성',
        style: data.style
      });
      
      // 파일이 있는 경우에만 HEIC 파일 타입 체크 및 경고
      if (data.file && (data.file.type === 'image/heic' || data.file.type === 'image/heif' || data.file.name.toLowerCase().endsWith('.heic'))) {
        console.warn('⚠️ HEIC/HEIF 파일 감지됨. 일부 브라우저에서 지원하지 않을 수 있습니다.');
      }
      
      const formData = new FormData();
      if (data.file) {
        formData.append('image', data.file);
      }
      formData.append('style', data.style);
      formData.append('categoryId', categoryId); // 카테고리 ID 추가
      
      if (data.aspectRatio) {
        formData.append('aspectRatio', data.aspectRatio);
      }
      
      if (data.variables && Object.keys(data.variables).length > 0) {
        formData.append('variables', JSON.stringify(data.variables));
      }
      
      // 모델 선택 추가
      formData.append('model', selectedModel);

      try {
        console.log('🚀 [이미지 생성] 시작:', {
          file: data.file?.name || '파일 없음 (텍스트 전용)',
          fileSize: data.file?.size || 0,
          fileType: data.file?.type || '없음',
          endpoint: apiEndpoint,
          userAgent: navigator.userAgent
        });
        
        // 아이폰 감지
        const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent);
        if (isIPhone) {
          console.log('📱 아이폰 디바이스 감지됨');
        }
        
        // JWT 토큰을 localStorage에서 가져오기 (쿠키 백업)
        const getAuthToken = () => {
          // 1순위: localStorage에서 auth_token
          let token = localStorage.getItem('auth_token');
          
          if (token && token.trim()) {
            console.log('🔑 [인증] localStorage에서 auth_token 발견');
            return token.trim();
          }
          
          // 2순위: 쿠키에서 auth_token
          const cookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('auth_token='))
            ?.split('=')[1];
            
          if (cookieToken && cookieToken.trim()) {
            const decodedToken = decodeURIComponent(cookieToken.trim());
            console.log('🔑 [인증] 쿠키에서 auth_token 발견');
            return decodedToken;
          }
          
          // 3순위: 쿠키에서 jwt_token (하위 호환성)
          const jwtCookieToken = document.cookie
            .split('; ')
            .find(row => row.startsWith('jwt_token='))
            ?.split('=')[1];
            
          if (jwtCookieToken && jwtCookieToken.trim()) {
            const decodedJwtToken = decodeURIComponent(jwtCookieToken.trim());
            console.log('🔑 [인증] 쿠키에서 jwt_token 발견 (하위 호환성)');
            return decodedJwtToken;
          }
          
          console.warn('⚠️ [인증] 어디서도 유효한 토큰을 찾을 수 없습니다');
          return null;
        };
        
        const token = getAuthToken();

        // JWT 토큰 기본 형식 검증
        const isValidJWTFormat = (token: string) => {
          if (!token || typeof token !== 'string') return false;
          const parts = token.split('.');
          return parts.length === 3 && parts.every(part => part.length > 0);
        };
        
        if (token && !isValidJWTFormat(token)) {
          console.error('❌ [인증] 잘못된 JWT 토큰 형식:', token.substring(0, 50) + '...');
        }
        
        console.log('🔑 [인증] 토큰 상태:', {
          exists: !!token,
          length: token?.length || 0,
          validFormat: token ? isValidJWTFormat(token) : false,
          preview: token ? token.substring(0, 20) + '...' : 'null'
        });

        // 토큰이 없거나 유효하지 않으면 즉시 에러
        if (!token) {
          throw new Error('로그인이 필요합니다. 다시 로그인해주세요.');
        }
        
        if (!isValidJWTFormat(token)) {
          throw new Error('인증 토큰이 손상되었습니다. 다시 로그인해주세요.');
        }
        
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            // Content-Type은 설정하지 않음 - 브라우저가 자동으로 multipart boundary 설정
          },
          body: formData
          // keepalive 제거 - 아이폰에서 FormData와 함께 사용 시 문제 발생
        }).catch(error => {
          console.error('❌ [네트워크 오류]:', error);
          throw new Error(`네트워크 연결 실패: ${error.message || '알 수 없는 오류'}`);
        });

        console.log('📡 [응답] 상태:', response.status, response.statusText);
        
        if (!response.ok) {
          // 인증 실패 시 토큰 정리 및 새로고침
          if (response.status === 401) {
            console.log('❌ [인증 실패] JWT 토큰 무효화 및 정리');
            
            // 손상된 토큰 정리
            localStorage.removeItem('auth_token');
            localStorage.removeItem('jwt_token');
            
            // 쿠키도 정리 시도
            document.cookie = 'auth_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = 'jwt_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            
            // 페이지 새로고침으로 재인증 유도
            window.location.reload();
            throw new Error('인증이 만료되었습니다. 페이지를 새로고침합니다.');
          }
          
          // 권한 부족 에러 (403)
          if (response.status === 403) {
            throw new Error('이 서비스는 유료회원만 사용할 수 있습니다.');
          }
          
          // 응답 텍스트 확인 (에러 상황)
          const responseText = await response.text();
          console.error('❌ [에러 응답 내용]:', responseText);
          
          let errorMessage = '이미지 생성에 실패했습니다';
          try {
            const errorData = JSON.parse(responseText);
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch (e) {
            // JSON 파싱 실패 시 텍스트 그대로 사용
            if (responseText && responseText.length < 200) {
              errorMessage = responseText;
            }
          }
          
          throw new Error(errorMessage);
        }
        
        // 응답 텍스트 확인 (성공 상황)
        const responseText = await response.text();
        console.log('📄 [응답 내용]:', responseText);

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
          
          // 6. 갤러리에서 방금 생성된 이미지 클릭한 것처럼 표시
          setTimeout(() => {
            console.log('🖼️ 완성된 이미지 모달 표시 (갤러리 방식):', result.image);
            // 갤러리의 setViewImage와 동일한 형태의 이미지 객체 생성
            const imageForGallery = {
              id: result.image.id,
              title: result.image.title,
              transformedUrl: result.image.transformedUrl,
              originalUrl: result.image.originalUrl,
              thumbnailUrl: result.image.thumbnailUrl || result.image.transformedUrl,
              url: result.image.transformedUrl, // 호환성을 위해 추가
              style: result.image.style,
              createdAt: result.image.createdAt,
              metadata: result.image.metadata
            };
            
            // 갤러리 모달 사용 (GalleryEmbedSimple의 setViewImage와 동일)
            const galleryViewEvent = new CustomEvent('openImageInGallery', {
              detail: { image: imageForGallery }
            });
            window.dispatchEvent(galleryViewEvent);
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
      
      // 모달 표시는 갤러리 이벤트로 처리됨
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
    // 스타일 선택 확인
    if (!selectedStyle) {
      toast({
        title: "입력 확인",
        description: "스타일을 선택해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 파일 업로드가 필요한 경우에만 파일 확인
    if (requiresImageUpload && !selectedFile) {
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
      requiresImageUpload: requiresImageUpload
    });

    const requestData: any = {
      style: selectedStyle,
      aspectRatio: aspectRatio,
      variables: variableFields ? variableInputs : undefined
    };

    // 파일이 필요한 경우에만 파일 추가
    if (requiresImageUpload && selectedFile) {
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
    <div className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{categoryId === 'family_img' ? '사진스타일 바꾸기' : pageTitle}</h1>
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
          {/* 파일 업로드 - 조건부 표시 */}
          {requiresImageUpload ? (
            <div className="bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <ImageIcon className="w-6 h-6 text-purple-400" />
                  <h2 className="text-xl font-semibold text-white">이미지 업로드</h2>
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
          ) : (
            <div className="bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-700">
                <div className="flex items-center gap-3 mb-4">
                  <PaintbrushVertical className="w-6 h-6 text-purple-400" />
                  <h2 className="text-xl font-semibold text-white">텍스트로 이미지 생성</h2>
                </div>
                <div className="text-center p-6 border-2 border-dashed border-gray-600 rounded-lg bg-gray-700">
                  <PaintbrushVertical className="w-12 h-12 text-purple-400 mx-auto mb-3" />
                  <p className="text-white font-medium">이 스타일은 텍스트만으로 이미지를 생성합니다</p>
                  <p className="text-gray-400 text-sm mt-1">스타일과 변수를 선택한 후 생성 버튼을 눌러주세요</p>
                </div>
            </div>
          )}

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

              {/* 비율 선택 - 동적 로딩 */}
              {showAspectRatioSelector && (
                <div className="mt-4 hidden">
                  <label className="block text-sm font-medium text-gray-300 mb-2">이미지 비율</label>
                  {isCapabilitiesLoading ? (
                    <div className="flex items-center justify-center p-4 border border-gray-600 rounded-lg bg-gray-700">
                      <Loader2 className="w-4 h-4 animate-spin mr-2 text-purple-400" />
                      <span className="text-gray-300 text-sm">비율 옵션 로딩 중...</span>
                    </div>
                  ) : capabilitiesError ? (
                    <div className="p-4 border border-red-500 rounded-lg bg-red-900/20">
                      <span className="text-red-300 text-sm">비율 옵션을 불러오지 못했습니다.</span>
                    </div>
                  ) : aspectRatioOptions.length === 0 ? (
                    selectedStyle ? (
                      <div className="p-4 border border-gray-600 rounded-lg bg-gray-700">
                        <span className="text-gray-300 text-sm">선택한 스타일에 사용 가능한 비율이 없습니다.</span>
                      </div>
                    ) : (
                      <div className="p-4 border border-gray-600 rounded-lg bg-gray-700">
                        <span className="text-gray-300 text-sm">스타일을 먼저 선택해주세요.</span>
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
                  <label className="block text-sm font-medium text-gray-300 mb-2">AI 모델 선택</label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableModels.includes("openai") && (
                      <Button
                        variant={selectedModel === "openai" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedModel("openai")}
                        className="text-xs"
                      >
                        <div className="text-center">
                          <div className="font-medium">OPEN AI(고품질, 감성적인)</div>
                        </div>
                      </Button>
                    )}
                    {availableModels.includes("gemini") && (
                      <Button
                        variant={selectedModel === "gemini" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setSelectedModel("gemini")}
                        className="text-xs"
                      >
                        <div className="text-center">
                          <div className="font-medium">GEMINI(고품질, 일관성)</div>
                        </div>
                      </Button>
                    )}
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
                disabled={(requiresImageUpload && !selectedFile) || !selectedStyle || isTransforming}
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
              <p className="text-sm text-gray-600 text-center mt-3">
                인쇄품질의 고화질 이미지생성을 지향하기에 2~3분정도 시간이 걸릴 수 있습니다.
              </p>
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
                onClick={() => {
                  handleStyleSelect(style.value); // 변수 로드를 위해 handleStyleSelect 호출
                  closeWithHistory(); // 히스토리 정리하면서 닫기
                }}
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
                    {style.visibilityType === "hospital" && (
                      <div className="absolute top-1 right-1 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full font-medium shadow-sm">
                        전용
                      </div>
                    )}
                  </div>
                )}
                <div className="p-2">
                  <div className="flex items-center justify-center gap-1">
                    <h3 className="font-medium text-sm text-center">{style.label}</h3>
                  </div>
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
      {/* 기존 모달 제거 - 갤러리에서 이벤트로 처리 */}
    </div>
  );
}