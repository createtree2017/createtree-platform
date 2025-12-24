import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Concept, ConceptCategory, InsertConcept, Hospital, AiModel } from "@shared/schema";
import { Loader2, Plus, Trash, Edit, Image, ArrowUpCircle, GripVertical, ArrowUp, ArrowDown } from "lucide-react";
import { useModelCapabilities, getEffectiveAspectRatios, getAspectRatioOptions, ModelCapabilities } from "@/hooks/useModelCapabilities";
import { useSystemSettings, getAvailableModelsForConcept, getDefaultModel } from "@/hooks/useSystemSettings";
import { resolveImageUrlSync, createImageErrorHandler } from "@/utils/image-url-resolver";

export default function ConceptManagement() {
  const [newConcept, setNewConcept] = useState({
    conceptId: "",
    title: "",
    description: "",
    promptTemplate: "",
    systemPrompt: "",
    thumbnailUrl: "",
    categoryId: "",
    referenceImageUrl: "",
    visibilityType: "public" as "public" | "hospital",
    hospitalId: null as number | null,
    generationType: "image_upload" as "image_upload" | "text_only",
    availableModels: [] as AiModel[], // 동적으로 설정됨
    availableAspectRatios: {} as Record<string, string[]>, // 모델별 이용 가능한 비율
    gemini3ImageSize: "1K" as "1K" | "2K" | "4K", // Gemini 3.0 Pro 해상도 옵션
    variables: [] as Array<{name: string, label: string, placeholder: string}>,
    isActive: true, // 기본값 true
    isFeatured: false, // 기본값 false
    bgRemovalEnabled: false, // 배경제거 사용 여부
    bgRemovalType: "foreground" as "foreground" | "background", // 배경제거 결과 타입
  });

  const [editingConcept, setEditingConcept] = useState<Concept | null>(null);
  const [conceptDialogOpen, setConceptDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conceptToDelete, setConceptToDelete] = useState<string | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // 🔥 양식 검증 상태 추가
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showValidation, setShowValidation] = useState(false);

  // 🎯 순서 변경 관련 상태
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [reorderingConcepts, setReorderingConcepts] = useState<Concept[]>([]);
  const [isReordering, setIsReordering] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 모델 capabilities 조회
  const { data: modelCapabilities, isLoading: isCapabilitiesLoading } = useModelCapabilities();
  
  // 시스템 설정 조회
  const { data: systemSettings, isLoading: isSystemSettingsLoading } = useSystemSettings();

  // 디버깅을 위한 로그
  useEffect(() => {
    console.log('[ConceptManagement] modelCapabilities:', modelCapabilities);
    console.log('[ConceptManagement] isCapabilitiesLoading:', isCapabilitiesLoading);
    if (modelCapabilities) {
      Object.keys(modelCapabilities).forEach(model => {
        const options = getAspectRatioOptions(model, modelCapabilities);
        console.log(`[ConceptManagement] ${model} options:`, options);
      });
    }
  }, [modelCapabilities, isCapabilitiesLoading]);

  // 🔥 systemSettings과 modelCapabilities 로딩 완료 후 기본값 초기화
  useEffect(() => {
    if (systemSettings && modelCapabilities && !editingConcept && newConcept.availableModels.length === 0) {
      // 시스템에서 지원하는 모델만 사용
      const settingsData = systemSettings as any;
      const supportedModels = settingsData?.supportedAiModels || [];
      const defaultAspectRatios: Record<string, string[]> = {};
      
      supportedModels.forEach((model: string) => {
        const capabilities = modelCapabilities as ModelCapabilities;
        const ratios = capabilities?.[model];
        if (ratios && ratios.length > 0) {
          defaultAspectRatios[model] = [ratios[0]];
        }
      });

      setNewConcept(prev => ({
        ...prev,
        availableModels: supportedModels as AiModel[],
        availableAspectRatios: defaultAspectRatios
      }));
    }
  }, [systemSettings, modelCapabilities, editingConcept, newConcept.availableModels.length]);

  // 컨셉 카테고리 조회
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<ConceptCategory[]>({
    queryKey: ['/api/admin/concept-categories'],
    queryFn: async () => {
      const response = await fetch('/api/admin/concept-categories');
      return response.json();
    },
    enabled: true
  });

  // 컨셉 목록 조회
  const { data: concepts, isLoading: isConceptsLoading } = useQuery<Concept[]>({
    queryKey: ['/api/admin/concepts'],
    queryFn: async () => {
      const response = await fetch('/api/admin/concepts');
      return response.json();
    },
    enabled: true
  });

  // 병원 목록 조회
  const { data: hospitalsResponse, isLoading: isHospitalsLoading } = useQuery({
    queryKey: ['/api/admin/hospitals'],
    queryFn: async () => {
      const response = await fetch('/api/admin/hospitals', {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error('병원 목록을 가져오는데 실패했습니다');
      }
      const data = await response.json();
      return data;
    },
    enabled: true
  });
  const hospitals = hospitalsResponse?.data || [];

  // 디버깅: 병원 데이터 출력 (운영 시 제거 예정)
  if (Array.isArray(hospitals) && hospitals.length > 0) {
    console.log('병원 목록 로드 완료:', hospitals.length, '개 병원');
  }

  // 컨셉 추가/수정 뮤테이션
  const saveConceptMutation = useMutation({
    mutationFn: async (concept: Partial<InsertConcept> & { conceptId: string }) => {
      // 새 컨셉 또는 기존 컨셉 업데이트 여부 확인
      const isNew = !editingConcept;
      let url = '/api/admin/concepts';
      let method = 'POST';

      if (!isNew) {
        url = `/api/admin/concepts/${concept.conceptId}`;
        method = 'PUT';
      }

      // 🔥 중복 업로드 제거: handleSaveConcept에서 이미 업로드 완료됨
      // thumbnailFile과 referenceFile은 handleSaveConcept에서 처리

      return apiRequest(url, { method, data: concept });
    },
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/concepts'] });
      toast({
        title: editingConcept ? "컨셉 업데이트 완료" : "새 컨셉 추가 완료",
        description: "컨셉이 성공적으로 저장되었습니다."
      });
      
      // 🔥 썸네일 업로드 성공 후 폼 상태 업데이트
      if (variables.thumbnailUrl) {
        setNewConcept(prev => ({ ...prev, thumbnailUrl: variables.thumbnailUrl || "" }));
      }
      
      setConceptDialogOpen(false);
      resetForm();
      
      // 파일 상태 초기화
      setThumbnailFile(null);
      setReferenceFile(null);
    },
    onError: (error) => {
      console.error("컨셉 저장 중 오류 발생:", error);
      toast({
        title: "오류 발생",
        description: "컨셉을 저장하는 중에 문제가 발생했습니다. 다시 시도해 주세요.",
        variant: "destructive"
      });
    }
  });

  // 컨셉 삭제 뮤테이션
  const deleteConceptMutation = useMutation({
    mutationFn: (conceptId: string) => {
      return apiRequest(`/api/admin/concepts/${conceptId}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/concepts'] });
      toast({
        title: "컨셉 삭제 완료",
        description: "컨셉이 성공적으로 삭제되었습니다."
      });
      setDeleteDialogOpen(false);
      setConceptToDelete(null);
    },
    onError: (error) => {
      console.error("컨셉 삭제 중 오류 발생:", error);
      toast({
        title: "오류 발생",
        description: "컨셉을 삭제하는 중에 문제가 발생했습니다. 다시 시도해 주세요.",
        variant: "destructive"
      });
    }
  });

  // 🎯 순서 변경 뮤테이션
  const reorderConceptsMutation = useMutation({
    mutationFn: async (conceptOrders: { conceptId: string; order: number }[]) => {
      return apiRequest('/api/admin/reorder-concepts', {
        method: 'POST',
        data: { conceptOrders }
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/concepts'] });
      toast({
        title: "순서 변경 완료",
        description: "컨셉 순서가 성공적으로 변경되었습니다."
      });
      setIsReorderMode(false);
      setIsReordering(false);
    },
    onError: (error) => {
      console.error("순서 변경 중 오류 발생:", error);
      toast({
        title: "순서 변경 실패",
        description: "순서를 변경하는 중에 문제가 발생했습니다. 다시 시도해 주세요.",
        variant: "destructive"
      });
      setIsReordering(false);
    }
  });

  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ conceptId, isActive }: { conceptId: string; isActive: boolean }) => {
      const concept = concepts?.find((c: Concept) => c.conceptId === conceptId);

      if (!concept) {
        throw new Error("Concept not found");
      }

      console.log(`Toggling concept ${conceptId} active status: ${concept.isActive} -> ${isActive}`);

      // 날짜 필드를 제거한 데이터 전송
      const { createdAt, updatedAt, ...conceptDataWithoutDates } = concept;

      return apiRequest(`/api/admin/concepts/${conceptId}`, {
        method: "PUT",
        data: {
          ...conceptDataWithoutDates,
          isActive,
        },
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/concepts'] });
      toast({
        title: "컨셉 상태 변경 완료",
        description: `컨셉이 ${variables.isActive ? '활성화' : '비활성화'}되었습니다.`,
      });
    },
    onError: (error) => {
      toast({
        title: "오류 발생",
        description: "컨셉 상태를 변경하는 중에 문제가 발생했습니다. 다시 시도해 주세요.",
        variant: "destructive",
      });
      console.error("Error toggling concept status:", error);
    },
  });

  // 이미지 업로드 함수 (썸네일 및 레퍼런스 이미지용)
  const uploadImage = async (file: File, type: 'thumbnail' | 'reference') => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // JWT 토큰 포함 인증 헤더 설정
      const getCookieValue = (name: string) => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return null;
      };

      const headers: Record<string, string> = {};
      const jwtToken = getCookieValue('auth_token');
      if (jwtToken) {
        headers['Authorization'] = `Bearer ${jwtToken}`;
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`이미지 업로드 실패: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // GCS 업로드 API 응답 구조에서 URL 추출
      if (!data.url) {
        throw new Error('업로드 응답에서 URL을 찾을 수 없습니다.');
      }

      console.log(`✅ ${type} 이미지 업로드 성공:`, data.url);
      return data.url;
    } catch (error) {
      console.error(`❌ ${type} 이미지 업로드 중 오류:`, error);
      toast({
        title: "이미지 업로드 실패",
        description: error instanceof Error 
          ? `${type} 이미지를 업로드하는 중에 문제가 발생했습니다: ${error.message}`
          : `${type} 이미지를 업로드하는 중에 알 수 없는 오류가 발생했습니다.`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // 컨셉 수정 시작
  const handleEditConcept = (concept: Concept) => {
    setEditingConcept(concept);
    const existingAspectRatios = concept.availableAspectRatios || {};
    // 시스템 설정에서 지원하는 모델 또는 기존 컨셉 모델 사용
    const settingsData = systemSettings as any;
    const models = concept.availableModels || (settingsData?.supportedAiModels ?? ["openai", "gemini"]);
    
    // 기존 비율 설정이 없으면 기본값 설정
    const aspectRatios: Record<string, string[]> = {};
    models.forEach((model: string) => {
      const aspectRatioData = existingAspectRatios as Record<string, unknown>;
      if (aspectRatioData?.[model]) {
        aspectRatios[model] = aspectRatioData[model] as string[];
      } else {
        const capabilities = modelCapabilities as ModelCapabilities;
        aspectRatios[model] = getEffectiveAspectRatios(model, null, capabilities);
      }
    });

    setNewConcept({
      conceptId: concept.conceptId,
      title: concept.title,
      description: concept.description || "",
      promptTemplate: concept.promptTemplate,
      systemPrompt: concept.systemPrompt || "",
      thumbnailUrl: concept.thumbnailUrl || "",
      categoryId: concept.categoryId || "",
      referenceImageUrl: concept.thumbnailUrl || "",
      visibilityType: (concept.visibilityType as "public" | "hospital") || "public",
      hospitalId: concept.hospitalId || null,
      generationType: (concept.generationType as "image_upload" | "text_only") || "image_upload",
      availableModels: models,
      availableAspectRatios: aspectRatios,
      gemini3ImageSize: ((concept as any).gemini3ImageSize as "1K" | "2K" | "4K") || "1K",
      variables: Array.isArray(concept.variables) ? concept.variables : [],
      isActive: concept.isActive ?? true,
      isFeatured: concept.isFeatured ?? false,
      bgRemovalEnabled: concept.bgRemovalEnabled ?? false,
      bgRemovalType: (concept.bgRemovalType as "foreground" | "background") || "foreground",
    });
    setConceptDialogOpen(true);
  };

  // 컨셉 삭제 다이얼로그 표시
  const handleDeleteClick = (conceptId: string) => {
    setConceptToDelete(conceptId);
    setDeleteDialogOpen(true);
  };

  // 컨셉 삭제 확인
  const confirmDelete = () => {
    if (conceptToDelete) {
      deleteConceptMutation.mutate(conceptToDelete);
    }
  };

  // 🎯 순서 변경 관련 함수들
  const startReorderMode = () => {
    console.log("순서 변경 모드 시작 - concepts 데이터:", concepts);
    console.log("선택된 카테고리 필터:", selectedCategoryFilter);

    if (!concepts) {
      console.warn("concepts 데이터가 없습니다.");
      return;
    }

    // API 응답이 배열인지 확인하고 처리
    const conceptsArray = Array.isArray(concepts) ? concepts : [];
    console.log("처리된 concepts 배열:", conceptsArray);

    if (conceptsArray.length === 0) {
      console.warn("컨셉 데이터가 비어있습니다.");
      return;
    }

    // 🔥 카테고리 필터 적용 (순서 변경 모드에서도 필터링 유지)
    const filteredConceptsForReorder = selectedCategoryFilter === "all" 
      ? conceptsArray 
      : conceptsArray.filter(concept => concept.categoryId === selectedCategoryFilter);

    console.log(`카테고리 "${selectedCategoryFilter}" 필터 적용된 컨셉:`, filteredConceptsForReorder);

    if (filteredConceptsForReorder.length === 0) {
      console.warn(`선택된 카테고리 "${selectedCategoryFilter}"에 해당하는 컨셉이 없습니다.`);
      return;
    }

    // order 필드로 정렬
    const sortedConcepts = [...filteredConceptsForReorder].sort((a, b) => {
      const orderA = a.order || 0;
      const orderB = b.order || 0;
      return orderA - orderB;
    });

    console.log("필터링 및 정렬된 컨셉:", sortedConcepts);
    setReorderingConcepts(sortedConcepts);
    setIsReorderMode(true);
  };

  const exitReorderMode = () => {
    setIsReorderMode(false);
    setReorderingConcepts([]);
  };

  // 🔥 카테고리 필터 변경 시 순서 변경 모드 업데이트
  useEffect(() => {
    if (isReorderMode && concepts) {
      // 순서 변경 모드 중에 카테고리가 변경되면 다시 필터링
      const conceptsArray = Array.isArray(concepts) ? concepts : [];

      const filteredConceptsForReorder = selectedCategoryFilter === "all" 
        ? conceptsArray 
        : conceptsArray.filter(concept => concept.categoryId === selectedCategoryFilter);

      const sortedConcepts = [...filteredConceptsForReorder].sort((a, b) => {
        const orderA = a.order || 0;
        const orderB = b.order || 0;
        return orderA - orderB;
      });

      console.log(`카테고리 필터 변경됨: "${selectedCategoryFilter}", 재필터링된 컨셉:`, sortedConcepts);
      setReorderingConcepts(sortedConcepts);
    }
  }, [selectedCategoryFilter, concepts, isReorderMode]);

  const moveConceptUp = (index: number) => {
    if (index === 0) return;

    const newConcepts = [...reorderingConcepts];
    [newConcepts[index], newConcepts[index - 1]] = [newConcepts[index - 1], newConcepts[index]];
    setReorderingConcepts(newConcepts);
  };

  const moveConceptDown = (index: number) => {
    if (index === reorderingConcepts.length - 1) return;

    const newConcepts = [...reorderingConcepts];
    [newConcepts[index], newConcepts[index + 1]] = [newConcepts[index + 1], newConcepts[index]];
    setReorderingConcepts(newConcepts);
  };

  const saveReorder = async () => {
    setIsReordering(true);
    try {
      // 새로운 순서로 업데이트할 데이터 준비
      const reorderData = reorderingConcepts.map((concept, index) => ({
        conceptId: concept.conceptId,
        order: index + 1
      }));

      console.log('순서 변경 데이터:', reorderData);

      // 실제 API 호출 - 기존 백엔드 엔드포인트 사용
      const response = await apiRequest('/api/admin/reorder-concepts', {
        method: 'POST',
        data: { conceptOrders: reorderData }
      });

      const result = await response.json();
      console.log('API 응답:', result);

      if (result.success) {
        toast({
          title: "순서 변경 완료",
          description: result.message || `${reorderData.length}개 컨셉의 순서가 변경되었습니다.`,
        });

        // 순서 변경 모드 종료 및 데이터 새로고침
        exitReorderMode();
        queryClient.invalidateQueries({ queryKey: ['/api/admin/concepts'] });
      } else {
        console.error('API 응답에서 실패 상태:', result);
        throw new Error(`API 응답에서 실패 상태: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('순서 변경 실패:', error);
      toast({
        title: "순서 변경 실패",
        description: "순서 변경 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsReordering(false);
    }
  };

  // 🔥 양식 검증 함수
  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!newConcept.conceptId.trim()) {
      errors.conceptId = "컨셉 ID는 필수 입력 항목입니다.";
    }

    if (!newConcept.title.trim()) {
      errors.title = "컨셉 제목은 필수 입력 항목입니다.";
    }

    if (!newConcept.promptTemplate.trim()) {
      errors.promptTemplate = "프롬프트 템플릿은 필수 입력 항목입니다.";
    }

    if (!newConcept.categoryId) {
      errors.categoryId = "카테고리는 필수 선택 항목입니다.";
    }

    if (!newConcept.thumbnailUrl.trim() && !thumbnailFile) {
      errors.thumbnailUrl = "썸네일 이미지는 필수 항목입니다.";
    }

    // 병원전용 선택 시 병원 선택 필수 검증
    if (newConcept.visibilityType === "hospital" && !newConcept.hospitalId) {
      errors.hospitalId = "병원전용 선택 시 병원을 반드시 선택해야 합니다.";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 컨셉 저장
  const handleSaveConcept = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowValidation(true);

    // 🔥 양식 검증
    if (!validateForm()) {
      toast({
        title: "입력 정보를 확인해주세요",
        description: "필수 항목을 모두 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    try {
      // 🔥 이미지 업로드 처리 - 여기서 한 번만 수행
      let finalConcept = { ...newConcept };

      if (thumbnailFile) {
        console.log('[ConceptManagement] 썸네일 업로드 시작:', thumbnailFile.name);
        const thumbnailUrl = await uploadImage(thumbnailFile, 'thumbnail');
        console.log('[ConceptManagement] 썸네일 업로드 성공:', thumbnailUrl);
        finalConcept.thumbnailUrl = thumbnailUrl;
      }

      if (referenceFile) {
        console.log('[ConceptManagement] 레퍼런스 업로드 시작:', referenceFile.name);
        const referenceUrl = await uploadImage(referenceFile, 'reference');
        console.log('[ConceptManagement] 레퍼런스 업로드 성공:', referenceUrl);
        finalConcept.referenceImageUrl = referenceUrl;
      }

      console.log('[ConceptManagement] 최종 컨셉 데이터:', finalConcept);
      saveConceptMutation.mutate(finalConcept);
    } catch (error) {
      console.error("컨셉 저장 중 오류:", error);
      toast({
        title: "저장 실패",
        description: "컨셉 저장 중 오류가 발생했습니다. 다시 시도해 주세요.",
        variant: "destructive"
      });
    }
  };

  // AI 모델 체크박스 처리 함수
  const handleModelToggle = (model: string) => {
    const aiModel = model as AiModel;
    const currentModels = newConcept.availableModels;
    let newAspectRatios = { ...newConcept.availableAspectRatios };
    
    if (currentModels.includes(aiModel)) {
      // 모델 제거 (단, 최소 1개는 남겨야 함)
      if (currentModels.length > 1) {
        // 모델 제거시 해당 모델의 비율 설정도 제거
        delete newAspectRatios[model];
        setNewConcept({
          ...newConcept,
          availableModels: currentModels.filter(m => m !== aiModel),
          availableAspectRatios: newAspectRatios
        });
      }
    } else {
      // 모델 추가 - 기본 비율 설정
      const capabilities = modelCapabilities as ModelCapabilities;
      const defaultRatios = getEffectiveAspectRatios(model, null, capabilities);
      newAspectRatios[model] = defaultRatios;
      setNewConcept({
        ...newConcept,
        availableModels: [...currentModels, aiModel],
        availableAspectRatios: newAspectRatios
      });
    }
  };


  // 비율 선택 처리 함수
  const handleAspectRatioToggle = (model: string, ratio: string) => {
    const currentRatios = newConcept.availableAspectRatios[model] || [];
    let newRatios: string[];

    if (currentRatios.includes(ratio)) {
      // 비율 제거 (단, 최소 1개는 남겨야 함)
      if (currentRatios.length > 1) {
        newRatios = currentRatios.filter(r => r !== ratio);
      } else {
        return; // 마지막 비율은 제거할 수 없음
      }
    } else {
      // 비율 추가
      newRatios = [...currentRatios, ratio];
    }

    setNewConcept({
      ...newConcept,
      availableAspectRatios: {
        ...newConcept.availableAspectRatios,
        [model]: newRatios
      }
    });
  };

  // 입력 폼 초기화
  const resetForm = () => {
    // 시스템 설정과 modelCapabilities에서 기본값 가져오기
    const defaultAspectRatios: Record<string, string[]> = {};
    let defaultModels: string[] = [];

    // 시스템 설정에서 지원하는 모델만 사용
    if (systemSettings && modelCapabilities) {
      const settingsData = systemSettings as any;
      defaultModels = settingsData?.supportedAiModels || [];
      
      // 각 모델의 첫 번째 비율을 기본값으로 설정
      defaultModels.forEach(model => {
        const capabilities = modelCapabilities as ModelCapabilities;
        const ratios = capabilities?.[model];
        if (ratios && ratios.length > 0) {
          defaultAspectRatios[model] = [ratios[0]];
        }
      });
    }

    // 안전한 fallback (시스템 설정이나 capabilities 로딩 실패 시)
    const settingsData = systemSettings as any;
    const fallbackModels = defaultModels.length > 0 ? defaultModels : (settingsData?.supportedAiModels ?? ["openai", "gemini"]);
    const fallbackRatios = Object.keys(defaultAspectRatios).length > 0 
      ? defaultAspectRatios 
      : { "openai": ["1:1"], "gemini": ["1:1"] };

    setNewConcept({
      conceptId: "",
      title: "",
      description: "",
      promptTemplate: "",
      systemPrompt: "",
      thumbnailUrl: "",
      categoryId: "",
      referenceImageUrl: "",
      visibilityType: "public" as "public" | "hospital",
      hospitalId: null as number | null,
      generationType: "image_upload" as "image_upload" | "text_only",
      availableModels: fallbackModels as AiModel[],
      availableAspectRatios: fallbackRatios,
      gemini3ImageSize: "1K" as "1K" | "2K" | "4K",
      variables: [],
      isActive: true,
      isFeatured: false,
      bgRemovalEnabled: false,
      bgRemovalType: "foreground" as "foreground" | "background",
    });
    setEditingConcept(null);
    setThumbnailFile(null);
    setReferenceFile(null);
  };



  // 모달 닫기
  const handleCloseDialog = () => {
    setConceptDialogOpen(false);
    resetForm();
  };

  // 썸네일 이미지 파일 선택 시
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setThumbnailFile(e.target.files[0]);
    }
  };

  // 레퍼런스 이미지 파일 선택 시
  const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setReferenceFile(e.target.files[0]);
    }
  };

  // 필터링된 컨셉 목록
  const filteredConcepts = selectedCategoryFilter === "all" 
    ? concepts 
    : concepts?.filter(concept => concept.categoryId === selectedCategoryFilter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-medium">스타일 컨셉 관리</h3>
        <div className="flex items-center gap-3">
          {/* 카테고리 필터 */}
          <Select value={selectedCategoryFilter} onValueChange={setSelectedCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="카테고리 필터" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 보기</SelectItem>
              {categories?.map((category: ConceptCategory) => (
                <SelectItem key={category.categoryId} value={category.categoryId}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* 순서 변경 버튼 */}
          {!isReorderMode ? (
            <Button variant="outline" onClick={startReorderMode}>
              <GripVertical className="mr-2 h-4 w-4" />
              순서 변경
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={exitReorderMode}
                disabled={isReordering}
              >
                취소
              </Button>
              <Button 
                onClick={saveReorder}
                disabled={isReordering}
              >
                {isReordering ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    저장 중...
                  </>
                ) : (
                  '순서 저장'
                )}
              </Button>
            </div>
          )}

          {/* 새 컨셉 추가 버튼 */}
          {!isReorderMode && (
            <Dialog open={conceptDialogOpen} onOpenChange={setConceptDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => resetForm()}>
                  <Plus className="mr-2 h-4 w-4" />
                  새 컨셉 추가
                </Button>
              </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingConcept ? '컨셉 수정' : '새 컨셉 추가'}</DialogTitle>
              <DialogDescription>
                AI 이미지 변환 스타일 컨셉을 {editingConcept ? '수정' : '추가'}합니다.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveConcept} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="conceptId" className={validationErrors.conceptId ? "text-red-600" : ""}>
                    컨셉 ID {validationErrors.conceptId && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="conceptId"
                    placeholder="영문, 숫자, 언더스코어만 사용 (예: elegant_portrait)"
                    value={newConcept.conceptId}
                    onChange={(e) => {
                      setNewConcept({ ...newConcept, conceptId: e.target.value });
                      if (validationErrors.conceptId && e.target.value.trim()) {
                        setValidationErrors({ ...validationErrors, conceptId: "" });
                      }
                    }}
                    disabled={!!editingConcept}
                    className={`${validationErrors.conceptId ? "border-red-500 focus:border-red-500" : ""}`}
                    required
                  />
                  {validationErrors.conceptId && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.conceptId}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title" className={validationErrors.title ? "text-red-600" : ""}>
                    제목 {validationErrors.title && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="title"
                    placeholder="컨셉 제목"
                    value={newConcept.title}
                    onChange={(e) => {
                      setNewConcept({ ...newConcept, title: e.target.value });
                      if (validationErrors.title && e.target.value.trim()) {
                        setValidationErrors({ ...validationErrors, title: "" });
                      }
                    }}
                    className={`${validationErrors.title ? "border-red-500 focus:border-red-500" : ""}`}
                    required
                  />
                  {validationErrors.title && (
                    <p className="text-sm text-red-600 mt-1">{validationErrors.title}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">설명</Label>
                <Textarea
                  id="description"
                  placeholder="컨셉에 대한 간단한 설명"
                  value={newConcept.description}
                  onChange={(e) => setNewConcept({ ...newConcept, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoryId" className={validationErrors.categoryId ? "text-red-600" : ""}>
                  카테고리 {validationErrors.categoryId && <span className="text-red-500">*</span>}
                </Label>
                <Select 
                  value={newConcept.categoryId} 
                  onValueChange={(value) => {
                    setNewConcept({ ...newConcept, categoryId: value });
                    if (validationErrors.categoryId && value) {
                      setValidationErrors({ ...validationErrors, categoryId: "" });
                    }
                  }}
                >
                  <SelectTrigger className={`${validationErrors.categoryId ? "border-red-500 focus:border-red-500" : ""}`}>
                    <SelectValue placeholder="카테고리 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((category: ConceptCategory) => (
                      <SelectItem key={category.categoryId} value={category.categoryId}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {validationErrors.categoryId && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.categoryId}</p>
                )}
              </div>

              {/* 생성 방식 선택 섹션 */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <div className="space-y-3">
                  <Label className="text-base font-medium">생성 방식</Label>
                  <RadioGroup 
                    value={newConcept.generationType} 
                    onValueChange={(value) => setNewConcept({ 
                      ...newConcept, 
                      generationType: value as "image_upload" | "text_only" 
                    })}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="image_upload" id="image_upload" />
                        <Label htmlFor="image_upload" className="text-sm font-normal cursor-pointer">
                          이미지 첨부 생성 (기존 방식)
                        </Label>
                      </div>

                      {/* AI 모델 선택 체크박스 - 모든 생성 방식에서 표시 */}
                      <div className="ml-6 space-y-2 p-3 bg-background/50 rounded border border-dashed border-muted-foreground/30">
                        <Label className="text-sm font-medium text-muted-foreground">사용 가능한 AI 모델</Label>
                        <div className="flex flex-wrap gap-4">
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="model-openai"
                              checked={newConcept.availableModels.includes("openai")}
                              onCheckedChange={() => handleModelToggle("openai")}
                            />
                            <Label htmlFor="model-openai" className="text-sm cursor-pointer">
                              GPT-Image-1
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="model-gemini"
                              checked={newConcept.availableModels.includes("gemini")}
                              onCheckedChange={() => handleModelToggle("gemini")}
                            />
                            <Label htmlFor="model-gemini" className="text-sm cursor-pointer">
                              Gemini 2.5 Flash
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Checkbox 
                              id="model-gemini_3"
                              checked={newConcept.availableModels.includes("gemini_3")}
                              onCheckedChange={() => handleModelToggle("gemini_3")}
                            />
                            <Label htmlFor="model-gemini_3" className="text-sm cursor-pointer">
                              Gemini 3.0 Pro
                            </Label>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          최소 1개 이상의 모델을 선택해야 합니다. 사용자는 선택된 모델만 사용할 수 있습니다.
                        </p>
                      </div>

                      {/* 비율 선택 - 이미지 첨부 생성 선택 시에만 표시 */}
                      {newConcept.generationType === "image_upload" && newConcept.availableModels.length > 0 && (
                        <div className="ml-6 space-y-4 p-3 bg-background/30 rounded border border-dashed border-muted-foreground/20">
                          <Label className="text-sm font-medium text-muted-foreground">이미지 비율 설정</Label>
                          <div className="space-y-4">
                            {newConcept.availableModels.map((model) => (
                              <div key={model} className="space-y-2">
                                <Label className="text-xs font-medium text-muted-foreground">
                                  {model === "openai" ? "GPT-Image-1" : model === "gemini" ? "Gemini 2.5 Flash" : "Gemini 3.0 Pro"} 비율
                                </Label>
                                <div className="flex flex-wrap gap-3">
                                  {isCapabilitiesLoading ? (
                                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      <span>비율 옵션 로딩 중...</span>
                                    </div>
                                  ) : getAspectRatioOptions(model, modelCapabilities as ModelCapabilities).length === 0 ? (
                                    <div className="text-xs text-muted-foreground">
                                      사용 가능한 비율이 없습니다.
                                    </div>
                                  ) : (
                                    getAspectRatioOptions(model, modelCapabilities as ModelCapabilities).map((ratio) => (
                                      <div key={ratio.value} className="flex items-center space-x-2">
                                        <Checkbox 
                                          id={`ratio-${model}-${ratio.value}`}
                                          checked={(newConcept.availableAspectRatios[model] || []).includes(ratio.value)}
                                          onCheckedChange={() => handleAspectRatioToggle(model, ratio.value)}
                                        />
                                        <Label 
                                          htmlFor={`ratio-${model}-${ratio.value}`} 
                                          className="text-xs cursor-pointer"
                                        >
                                          {ratio.label}
                                        </Label>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            각 모델별로 최소 1개 이상의 비율을 선택해야 합니다. 사용자는 선택된 비율만 사용할 수 있습니다.
                          </p>

                          {/* Gemini 3.0 Pro 해상도 옵션 - Gemini 3.0 Pro 선택 시에만 표시 */}
                          {newConcept.availableModels.includes("gemini_3") && (
                            <div className="space-y-2 mt-4 pt-4 border-t border-dashed border-muted-foreground/20">
                              <Label className="text-sm font-medium text-muted-foreground">Gemini 3.0 Pro 해상도</Label>
                              <div className="flex flex-wrap gap-3">
                                {(["1K", "2K", "4K"] as const).map((size) => (
                                  <div key={size} className="flex items-center space-x-2">
                                    <input
                                      type="radio"
                                      id={`imageSize-${size}`}
                                      name="gemini3ImageSize"
                                      value={size}
                                      checked={newConcept.gemini3ImageSize === size}
                                      onChange={(e) => setNewConcept({ ...newConcept, gemini3ImageSize: e.target.value as "1K" | "2K" | "4K" })}
                                      className="h-4 w-4"
                                    />
                                    <Label htmlFor={`imageSize-${size}`} className="text-xs cursor-pointer">
                                      {size} {size === "1K" ? "(기본)" : size === "4K" ? "(최고)" : ""}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Gemini 3.0 Pro 모델의 이미지 해상도를 선택합니다. 해상도가 높을수록 생성 시간과 비용이 증가합니다.
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="text_only" id="text_only" />
                      <Label htmlFor="text_only" className="text-sm font-normal cursor-pointer">
                        프롬프트로 생성 (텍스트만)
                      </Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    "이미지 첨부 생성"은 기존처럼 이미지를 업로드해야 하고, "프롬프트로 생성"은 텍스트만으로 이미지를 생성합니다.
                  </p>
                </div>
              </div>

              {/* 공개설정 섹션 */}
              <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
                <div className="space-y-3">
                  <Label className="text-base font-medium">공개 설정</Label>
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="visibility-public"
                        name="visibilityType"
                        value="public"
                        checked={newConcept.visibilityType === "public"}
                        onChange={(e) => setNewConcept({ 
                          ...newConcept, 
                          visibilityType: e.target.value as "public" | "hospital",
                          hospitalId: e.target.value === "public" ? null : newConcept.hospitalId
                        })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="visibility-public" className="text-sm font-normal cursor-pointer">
                        전체 공개 (모든 사용자가 사용 가능)
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="radio"
                        id="visibility-hospital"
                        name="visibilityType"
                        value="hospital"
                        checked={newConcept.visibilityType === "hospital"}
                        onChange={(e) => setNewConcept({ 
                          ...newConcept, 
                          visibilityType: e.target.value as "public" | "hospital"
                        })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="visibility-hospital" className="text-sm font-normal cursor-pointer">
                        병원 전용 (특정 병원만 사용 가능)
                      </Label>
                    </div>
                  </div>

                  {/* 병원 선택 드롭다운 - 병원전용 선택 시에만 표시 */}
                  {newConcept.visibilityType === "hospital" && (
                    <div className="space-y-2 ml-6">
                      <Label htmlFor="hospitalId" className={`text-sm text-gray-200 ${validationErrors.hospitalId ? "text-red-400" : ""}`}>
                        병원 선택 <span className="text-red-400">*</span>
                      </Label>
                      <select
                        value={newConcept.hospitalId?.toString() || ""}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewConcept({ 
                            ...newConcept, 
                            hospitalId: value ? parseInt(value) : null 
                          });
                          // 병원 선택 시 유효성 오류 제거
                          if (validationErrors.hospitalId && value) {
                            setValidationErrors({ ...validationErrors, hospitalId: "" });
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md bg-gray-800 text-white text-sm ${
                          validationErrors.hospitalId 
                            ? "border-red-500 focus:border-red-400 focus:ring-red-400" 
                            : "border-gray-600 focus:border-blue-400 focus:ring-blue-400"
                        }`}
                      >
                        <option value="">병원을 선택하세요</option>
                        {isHospitalsLoading ? (
                          <option disabled>병원 목록을 불러오는 중...</option>
                        ) : Array.isArray(hospitals) && hospitals.length > 0 ? (
                          hospitals.map((hospital: Hospital) => (
                            <option key={hospital.id} value={hospital.id.toString()}>
                              {hospital.name}
                            </option>
                          ))
                        ) : (
                          <option disabled>병원 목록이 없습니다 ({hospitals?.length || 0}개)</option>
                        )}
                      </select>
                      {validationErrors.hospitalId && (
                        <p className="text-sm text-red-600 mt-1">{validationErrors.hospitalId}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <Tabs defaultValue="basic" className="w-full">
                <TabsList className="w-full mb-2 bg-muted-foreground/5">
                  <TabsTrigger value="basic" className="flex-1 font-semibold">기본 정보</TabsTrigger>
                  <TabsTrigger value="advanced" className="flex-1 font-semibold">고급 설정</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="promptTemplate" className={validationErrors.promptTemplate ? "text-red-600" : ""}>
                      기본 프롬프트 템플릿 {validationErrors.promptTemplate && <span className="text-red-500">*</span>}
                    </Label>
                    <Textarea
                      id="promptTemplate"
                      placeholder="A beautiful {{object}} in {{style}} style, high quality"
                      value={newConcept.promptTemplate}
                      onChange={(e) => {
                        setNewConcept({ ...newConcept, promptTemplate: e.target.value });
                        if (validationErrors.promptTemplate && e.target.value.trim()) {
                          setValidationErrors({ ...validationErrors, promptTemplate: "" });
                        }
                      }}
                      className={`${validationErrors.promptTemplate ? "border-red-500 focus:border-red-500" : ""}`}
                      rows={3}
                      required
                    />
                    {validationErrors.promptTemplate && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.promptTemplate}</p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {"{object}"}, {"{style}"}, {"{mood}"} 등의 변수를 사용할 수 있습니다.
                    </p>
                  </div>

                  {/* 변수 설정 섹션 */}
                  <div className="space-y-2">
                    <Label>사용자 입력 변수 설정</Label>
                    <p className="text-sm text-muted-foreground">
                      사용자가 직접 입력할 수 있는 변수를 설정합니다 (예: 아기 이름, 메시지 등)
                    </p>

                    {newConcept.variables.map((variable, index) => (
                      <div key={index} className="flex gap-2 items-center p-3 border rounded">
                        <Input
                          placeholder="변수명 (예: baby_name)"
                          value={variable.name}
                          onChange={(e) => {
                            const newVariables = [...newConcept.variables];
                            newVariables[index].name = e.target.value;
                            setNewConcept({ ...newConcept, variables: newVariables });
                          }}
                          className="flex-1"
                        />
                        <Input
                          placeholder="라벨 (예: 아기 이름)"
                          value={variable.label}
                          onChange={(e) => {
                            const newVariables = [...newConcept.variables];
                            newVariables[index].label = e.target.value;
                            setNewConcept({ ...newConcept, variables: newVariables });
                          }}
                          className="flex-1"
                        />
                        <Input
                          placeholder="안내문구 (예: 아기 이름을 입력하세요)"
                          value={variable.placeholder}
                          onChange={(e) => {
                            const newVariables = [...newConcept.variables];
                            newVariables[index].placeholder = e.target.value;
                            setNewConcept({ ...newConcept, variables: newVariables });
                          }}
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            const newVariables = newConcept.variables.filter((_, i) => i !== index);
                            setNewConcept({ ...newConcept, variables: newVariables });
                          }}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setNewConcept({
                          ...newConcept,
                          variables: [...newConcept.variables, { name: "", label: "", placeholder: "" }]
                        });
                      }}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      변수 추가
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="thumbnail" className={validationErrors.thumbnailUrl ? "text-red-600" : ""}>
                      썸네일 이미지 {validationErrors.thumbnailUrl && <span className="text-red-500">*</span>}
                    </Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="thumbnail"
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          handleThumbnailChange(e);
                          if (validationErrors.thumbnailUrl && e.target.files && e.target.files[0]) {
                            setValidationErrors({ ...validationErrors, thumbnailUrl: "" });
                          }
                        }}
                        className={`flex-1 ${validationErrors.thumbnailUrl ? "border-red-500 focus:border-red-500" : ""}`}
                      />
                      {(newConcept.thumbnailUrl || thumbnailFile) && (
                        <div className="w-16 h-16 rounded overflow-hidden border">
                          <img 
                            src={thumbnailFile ? URL.createObjectURL(thumbnailFile) : newConcept.thumbnailUrl} 
                            alt="썸네일 미리보기" 
                            className="w-full h-full object-cover"
                            onError={createImageErrorHandler("thumbnail")}
                          />
                        </div>
                      )}
                    </div>
                    {validationErrors.thumbnailUrl && (
                      <p className="text-sm text-red-600 mt-1">{validationErrors.thumbnailUrl}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="referenceImage">레퍼런스 이미지</Label>
                    <p className="text-sm text-muted-foreground">
                      스타일 참고용 이미지를 업로드합니다.
                    </p>
                    <div className="flex items-center gap-4">
                      <Input
                        id="referenceImage"
                        type="file"
                        accept="image/*"
                        onChange={handleReferenceImageChange}
                        className="flex-1"
                      />
                      {(newConcept.referenceImageUrl || referenceFile) && (
                        <div className="w-24 h-24 rounded overflow-hidden border">
                          <img 
                            src={referenceFile ? URL.createObjectURL(referenceFile) : newConcept.referenceImageUrl} 
                            alt="레퍼런스 이미지 미리보기" 
                            className="w-full h-full object-cover"
                            onError={createImageErrorHandler("reference")}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4">
                  <div className="space-y-2 mt-4">
                    <Label htmlFor="systemPrompt">시스템 프롬프트 (선택사항)</Label>
                    <Textarea
                      id="systemPrompt"
                      placeholder="이미지 분석과 변환을 위한 시스템 지침을 입력하세요."
                      value={newConcept.systemPrompt}
                      onChange={(e) => setNewConcept({ ...newConcept, systemPrompt: e.target.value })}
                      rows={6}
                    />
                    <p className="text-sm text-muted-foreground">
                      시스템 프롬프트는 AI 모델에게 이미지 처리 방법에 대한 상세한 지침을 제공합니다.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {/* 배경제거 설정 */}
              <div className="space-y-4 pt-4 border-t border-muted-foreground/20">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">배경제거 적용</Label>
                    <p className="text-sm text-muted-foreground">
                      이미지 생성 후 자동으로 배경을 제거합니다.
                    </p>
                  </div>
                  <Switch
                    checked={newConcept.bgRemovalEnabled}
                    onCheckedChange={(checked) => setNewConcept({
                      ...newConcept,
                      bgRemovalEnabled: checked
                    })}
                  />
                </div>

                {newConcept.bgRemovalEnabled && (
                  <div className="ml-6 p-3 bg-background/50 rounded border border-dashed border-muted-foreground/30">
                    <Label className="text-sm font-medium text-muted-foreground mb-3 block">배경제거 결과 타입</Label>
                    <RadioGroup 
                      value={newConcept.bgRemovalType} 
                      onValueChange={(value) => setNewConcept({ 
                        ...newConcept, 
                        bgRemovalType: value as "foreground" | "background"
                      })}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="foreground" id="bg-foreground" />
                        <Label htmlFor="bg-foreground" className="text-sm font-normal cursor-pointer">
                          전경만 (사람/객체) - 배경을 투명하게 제거
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="background" id="bg-background" />
                        <Label htmlFor="bg-background" className="text-sm font-normal cursor-pointer">
                          배경만 - 사람/객체를 제거하고 배경만 유지
                        </Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground mt-2">
                      품질과 모델 설정은 시스템 설정의 배경제거 설정에서 관리합니다.
                    </p>
                  </div>
                )}
              </div>

              {/* 활성화 설정 UI 추가 */}
              <div className="space-y-3 pt-4 border-t border-muted-foreground/20">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">컨셉 활성화</Label>
                    <p className="text-sm text-muted-foreground">
                      비활성화 시 사용자에게 표시되지 않습니다.
                    </p>
                  </div>
                  <Switch
                    checked={newConcept.isActive}
                    onCheckedChange={(checked) => setNewConcept({
                      ...newConcept,
                      isActive: checked
                    })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">추천 컨셉</Label>
                    <p className="text-sm text-muted-foreground">
                      추천 컨셉으로 설정하면 우선적으로 표시됩니다.
                    </p>
                  </div>
                  <Switch
                    checked={newConcept.isFeatured}
                    onCheckedChange={(checked) => setNewConcept({
                      ...newConcept,
                      isFeatured: checked
                    })}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleCloseDialog}>
                  취소
                </Button>
                <Button type="submit" disabled={isUploading || saveConceptMutation.isPending}>
                  {isUploading || saveConceptMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      저장 중...
                    </>
                  ) : (
                    '저장'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      <Separator />

      {isConceptsLoading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : isReorderMode ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            순서를 변경하려면 위/아래 버튼을 사용하세요. 완료 후 '순서 저장' 버튼을 클릭하세요.
          </div>
          <div className="space-y-2">
            {reorderingConcepts.map((concept, index) => (
              <div key={concept.conceptId} className="flex items-center p-3 border rounded-lg bg-card">
                <div className="flex items-center gap-2 mr-4">
                  <span className="text-sm font-mono w-8 text-center">{index + 1}</span>
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="font-medium">{concept.title}</div>
                  <div className="text-sm text-muted-foreground">{concept.conceptId}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moveConceptUp(index)}
                    disabled={index === 0 || isReordering}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => moveConceptDown(index)}
                    disabled={index === reorderingConcepts.length - 1 || isReordering}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filteredConcepts && filteredConcepts.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredConcepts.map((concept: Concept) => (
            <Card key={concept.conceptId} className="overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg flex items-center">
                      {concept.title}
                      {!concept.isActive && <span className="ml-2 text-sm font-normal text-red-500">(비활성)</span>}
                      {concept.isFeatured && <span className="ml-2 text-sm font-normal text-blue-500">(추천)</span>}
                    </CardTitle>
                    <CardDescription>{concept.conceptId}</CardDescription>
                  </div>
                  <div className="flex space-x-1">
                    <Button size="icon" variant="ghost" onClick={() => handleEditConcept(concept)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteClick(concept.conceptId)}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {concept.thumbnailUrl ? (
                  <div className="aspect-video w-full mb-2 bg-muted rounded-md overflow-hidden">
                    <img 
                      src={concept.thumbnailUrl} 
                      alt={concept.title} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="aspect-video w-full mb-2 bg-muted rounded-md flex items-center justify-center">
                    <Image className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}

                <div className="space-y-2">
                  {concept.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{concept.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {concept.categoryId && (
                      <span className="text-xs bg-secondary px-2 py-1 rounded">
                        {categories.find((c: ConceptCategory) => c.categoryId === concept.categoryId)?.name || concept.categoryId}
                      </span>
                    )}
                    {concept.thumbnailUrl && (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded flex items-center">
                        <Image className="h-3 w-3 mr-1" />
                        레퍼런스 이미지
                      </span>
                    )}
                    {concept.hospitalId && (
                      <span className="text-xs bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 px-2 py-1 rounded flex items-center">
                        🏥 {hospitals.find((h: Hospital) => h.id === concept.hospitalId)?.name || '병원'} 전용
                      </span>
                    )}

                    {/* 활성화 상태 토글 버튼 */}
                    <Button
                      size="sm"
                      variant={concept.isActive ? "secondary" : "outline"}
                      onClick={() => toggleActiveMutation.mutate({ conceptId: concept.conceptId, isActive: !concept.isActive })}
                      className="ml-auto"
                    >
                      {concept.isActive ? "비활성화" : "활성화"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-10">
          <p className="text-muted-foreground">컨셉이 없습니다. 새 컨셉을 추가해 보세요.</p>
          <Button className="mt-4" variant="outline" onClick={() => setConceptDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            새 컨셉 추가
          </Button>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>컨셉 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말 이 컨셉을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              {deleteConceptMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  삭제 중...
                </>
              ) : (
                '삭제'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}