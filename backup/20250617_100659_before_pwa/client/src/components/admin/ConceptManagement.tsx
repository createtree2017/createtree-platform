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
import { Concept, ConceptCategory } from "@shared/schema";
import { Loader2, Plus, Trash, Edit, Image, ArrowUpCircle } from "lucide-react";

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
    variables: [] as Array<{name: string, label: string, placeholder: string}>
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
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 컨셉 카테고리 조회
  const { data: categories = [], isLoading: isCategoriesLoading } = useQuery<ConceptCategory[]>({
    queryKey: ['/api/admin/concept-categories'],
    queryFn: getQueryFn(),
    enabled: true
  });

  // 컨셉 목록 조회
  const { data: concepts = [], isLoading: isConceptsLoading } = useQuery({
    queryKey: ['/api/admin/concepts'],
    queryFn: getQueryFn(),
    enabled: true
  });

  // 컨셉 추가/수정 뮤테이션
  const saveConceptMutation = useMutation({
    mutationFn: async (concept: any) => {
      // 새 컨셉 또는 기존 컨셉 업데이트 여부 확인
      const isNew = !editingConcept;
      let url = '/api/admin/concepts';
      let method = 'POST';
      
      if (!isNew) {
        url = `/api/admin/concepts/${concept.conceptId}`;
        method = 'PUT';
      }
      
      // 썸네일 이미지 업로드
      if (thumbnailFile) {
        const thumbnailUrl = await uploadImage(thumbnailFile, 'thumbnail');
        concept.thumbnailUrl = thumbnailUrl;
      }
      
      // 레퍼런스 이미지 업로드 (PhotoMaker 모드용)
      if (referenceFile) {
        const referenceUrl = await uploadImage(referenceFile, 'reference');
        concept.referenceImageUrl = referenceUrl;
      }
      
      return apiRequest(url, { method, data: concept });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/concepts'] });
      toast({
        title: editingConcept ? "컨셉 업데이트 완료" : "새 컨셉 추가 완료",
        description: "컨셉이 성공적으로 저장되었습니다."
      });
      setConceptDialogOpen(false);
      resetForm();
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

  // 이미지 업로드 함수 (썸네일 및 레퍼런스 이미지용)
  const uploadImage = async (file: File, type: 'thumbnail' | 'reference') => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append(type, file);
      
      const response = await fetch(`/api/admin/upload/${type}`, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`이미지 업로드 실패: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error(`${type} 이미지 업로드 중 오류:`, error);
      toast({
        title: "이미지 업로드 실패",
        description: "이미지를 업로드하는 중에 오류가 발생했습니다.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsUploading(false);
    }
  };

  // 컨셉 수정 시작
  const handleEditConcept = (concept: Concept) => {
    setEditingConcept(concept);
    setNewConcept({
      conceptId: concept.conceptId,
      title: concept.title,
      description: concept.description || "",
      promptTemplate: concept.promptTemplate,
      systemPrompt: concept.systemPrompt || "",
      thumbnailUrl: concept.thumbnailUrl || "",
      categoryId: concept.categoryId || "",
      referenceImageUrl: concept.thumbnailUrl || "",
      variables: concept.variables || []
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
      // 이미지 업로드 처리
      let finalConcept = { ...newConcept };
      
      if (thumbnailFile) {
        const thumbnailUrl = await uploadImage(thumbnailFile, 'thumbnail');
        finalConcept.thumbnailUrl = thumbnailUrl;
      }
      
      if (referenceFile) {
        const referenceUrl = await uploadImage(referenceFile, 'reference');
        finalConcept.referenceImageUrl = referenceUrl;
      }
      
      saveConceptMutation.mutate(finalConcept);
    } catch (error) {
      console.error("컨셉 저장 중 오류:", error);
    }
  };

  // 입력 폼 초기화
  const resetForm = () => {
    setNewConcept({
      conceptId: "",
      title: "",
      description: "",
      promptTemplate: "",
      systemPrompt: "",
      thumbnailUrl: "",
      categoryId: "",
      referenceImageUrl: "",
      variables: []
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
    : concepts.filter(concept => concept.categoryId === selectedCategoryFilter);

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
          
          {/* 새 컨셉 추가 버튼 */}
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
        </div>
      </div>

      <Separator />

      {isConceptsLoading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin" />
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
                    {concept.referenceImageUrl && (
                      <span className="text-xs bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded flex items-center">
                        <Image className="h-3 w-3 mr-1" />
                        레퍼런스 이미지
                      </span>
                    )}

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