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
import { useModal } from "@/hooks/useModal";

export default function ConceptManagement() {
  const modal = useModal();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conceptToDelete, setConceptToDelete] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

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


  // 컨셉 카테고리 조회
  const { data: categoriesData = [], isLoading: isCategoriesLoading } = useQuery<ConceptCategory[]>({
    queryKey: ['/api/admin/concept-categories'],
    queryFn: async () => {
      const response = await fetch('/api/admin/concept-categories', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('카테고리 목록을 가져오는데 실패했습니다');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: true
  });
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  // 컨셉 목록 조회
  const { data: conceptsData, isLoading: isConceptsLoading } = useQuery<Concept[]>({
    queryKey: ['/api/admin/concepts'],
    queryFn: async () => {
      const response = await fetch('/api/admin/concepts', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('컨셉 목록을 가져오는데 실패했습니다');
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: true
  });
  const concepts = Array.isArray(conceptsData) ? conceptsData : [];

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
      const isNew = !concepts?.some(c => c.conceptId === concept.conceptId);
      let url = '/api/admin/concepts';
      let method = 'POST';

      if (!isNew) {
        url = `/api/admin/concepts/${concept.conceptId}`;
        method = 'PUT';
      }

      return apiRequest(url, { method, data: concept });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/concepts'] });
      toast({
        title: "저장 완료",
        description: "컨셉이 성공적으로 저장되었습니다."
      });
      modal.close();
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

      // JWT 토큰 포함 인증 헤더 설정 (httpOnly 쿠키는 credentials: 'include'로 자동 전송)
      const headers: Record<string, string> = {};
      const jwtToken = localStorage.getItem('auth_token');
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
    modal.open('conceptForm', {
      mode: "edit",
      concept,
      categories,
      hospitals,
      isHospitalsLoading,
      onSubmit: async (formConcept: any, thumbnail: File | null, reference: File | null) => {
        let finalConcept = { ...formConcept };

        if (thumbnail) {
          const thumbnailUrl = await uploadImage(thumbnail, 'thumbnail');
          finalConcept.thumbnailUrl = thumbnailUrl;
        }

        if (reference) {
          const referenceUrl = await uploadImage(reference, 'reference');
          finalConcept.referenceImageUrl = referenceUrl;
        }

        await saveConceptMutation.mutateAsync(finalConcept);
      },
      isPending: saveConceptMutation.isPending || isUploading
    });
  };

  // 새 컨셉 추가
  const handleCreateConcept = () => {
    modal.open('conceptForm', {
      mode: "create",
      categories,
      hospitals,
      isHospitalsLoading,
      onSubmit: async (formConcept: any, thumbnail: File | null, reference: File | null) => {
        let finalConcept = { ...formConcept };

        if (thumbnail) {
          const thumbnailUrl = await uploadImage(thumbnail, 'thumbnail');
          finalConcept.thumbnailUrl = thumbnailUrl;
        }

        if (reference) {
          const referenceUrl = await uploadImage(reference, 'reference');
          finalConcept.referenceImageUrl = referenceUrl;
        }

        await saveConceptMutation.mutateAsync(finalConcept);
      },
      isPending: saveConceptMutation.isPending || isUploading
    });
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
            <Button onClick={handleCreateConcept}>
              <Plus className="mr-2 h-4 w-4" />
              새 컨셉 추가
            </Button>
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
          <Button className="mt-4" variant="outline" onClick={handleCreateConcept}>
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