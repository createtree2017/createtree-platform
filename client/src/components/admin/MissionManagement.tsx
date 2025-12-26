import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { 
  Plus, Edit, Trash2, Eye, EyeOff, GripVertical, 
  CheckCircle, XCircle, Clock, Loader2, AlertCircle, Settings,
  Globe, Building2, Calendar, ChevronUp, ChevronDown, Image, FileText, Heart,
  Download, Printer, X as CloseIcon, ImagePlus, Upload, Check, FolderTree, Users
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ThemeMission, MissionCategory } from "@shared/schema";

// 미션 카테고리 관리
function MissionCategoryManagement() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);

  // 카테고리 목록 조회
  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/mission-categories'],
  });

  // 카테고리 생성/수정 mutation
  const saveCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCategory) {
        return apiRequest(`/api/admin/mission-categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }
      return apiRequest('/api/admin/mission-categories', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mission-categories'] });
      toast({ title: "카테고리가 저장되었습니다" });
      setIsDialogOpen(false);
      setEditingCategory(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 카테고리 삭제 mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/admin/mission-categories/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mission-categories'] });
      toast({ title: "카테고리가 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const formSchema = z.object({
    categoryId: z.string().min(1, "ID를 입력하세요"),
    name: z.string().min(1, "이름을 입력하세요"),
    description: z.string().optional(),
    emoji: z.string().optional(),
    order: z.number().int().min(0),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoryId: "",
      name: "",
      description: "",
      emoji: "📋",
      order: 0,
    },
  });

  const handleOpenDialog = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      form.reset(category);
    } else {
      setEditingCategory(null);
      form.reset({
        categoryId: "",
        name: "",
        description: "",
        emoji: "📋",
        order: categories.length,
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: any) => {
    saveCategoryMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>미션 카테고리 관리</CardTitle>
            <CardDescription>미션을 분류할 카테고리를 관리합니다</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            카테고리 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이모지</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>설명</TableHead>
              <TableHead>순서</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="text-2xl">{category.emoji}</TableCell>
                <TableCell className="font-mono text-sm">{category.categoryId}</TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-sm text-gray-500">{category.description}</TableCell>
                <TableCell>{category.order}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(category)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => {
                        if (confirm('정말 삭제하시겠습니까?')) {
                          deleteCategoryMutation.mutate(category.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingCategory ? '카테고리 수정' : '카테고리 추가'}
              </DialogTitle>
              <DialogDescription>
                미션 카테고리 정보를 입력하세요
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>카테고리 ID</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="daily_missions" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="일상 미션" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emoji"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이모지</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="📋" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>설명</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="일상 생활과 관련된 미션들" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>순서</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={saveCategoryMutation.isPending}
                  >
                    {saveCategoryMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    저장
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// 세부 미션 빌더
interface SubMissionBuilderProps {
  themeMissionId: number;
  themeMissionTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

function SubMissionBuilder({ themeMissionId, themeMissionTitle, isOpen, onClose }: SubMissionBuilderProps) {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubMission, setEditingSubMission] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // themeMissionId로 미션 정보 조회
  const { data: missionData } = useQuery<any>({
    queryKey: ['/api/admin/missions', themeMissionId],
    enabled: isOpen && !!themeMissionId,
    select: (data) => {
      return Array.isArray(data) ? data.find((m: any) => m.id === themeMissionId) : data;
    }
  });

  const missionId = missionData?.missionId;

  const { data: subMissions = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/missions', missionId, 'sub-missions'],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/missions/${missionId}/sub-missions`);
      return await response.json();
    },
    enabled: isOpen && !!missionId,
  });

  const saveSubMissionMutation = useMutation({
    mutationFn: ({ data, subMissionId }: { data: any; subMissionId: number | null }) => {
      const url = subMissionId
        ? `/api/admin/missions/${missionId}/sub-missions/${subMissionId}`
        : `/api/admin/missions/${missionId}/sub-missions`;
      const method = subMissionId ? 'PUT' : 'POST';
      
      return apiRequest(url, { method, body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
      toast({ title: "세부 미션이 저장되었습니다" });
      setIsDialogOpen(false);
      setEditingSubMission(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteSubMissionMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/admin/missions/${missionId}/sub-missions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
      toast({ title: "세부 미션이 삭제되었습니다" });
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
      setDeleteId(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (newOrder: number[]) =>
      apiRequest(`/api/admin/missions/${missionId}/sub-missions/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ subMissionIds: newOrder })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest(`/api/admin/missions/${missionId}/sub-missions/${id}/toggle-active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
    },
  });

  const formSchema = z.object({
    title: z.string().min(1, "제목을 입력하세요"),
    description: z.string().optional(),
    submissionTypes: z.array(z.enum(["file", "image", "link", "text", "review"])).min(1, "최소 1개의 제출 타입이 필요합니다"),
    requireReview: z.boolean().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      submissionTypes: ["file"] as ("file" | "image" | "link" | "text" | "review")[],
      requireReview: false,
    },
  });

  const handleOpenDialog = (subMission?: any) => {
    console.log('[Dialog 열기] subMission:', subMission ? `ID=${subMission.id}` : 'null (신규 생성 모드)');
    
    if (subMission) {
      setEditingSubMission(subMission);
      const types = subMission.submissionTypes || (subMission.submissionType ? [subMission.submissionType] : ["file"]);
      form.reset({
        title: subMission.title,
        description: subMission.description || "",
        submissionTypes: types,
        requireReview: subMission.requireReview || false,
      });
    } else {
      setEditingSubMission(null);
      form.reset({
        title: "",
        description: "",
        submissionTypes: ["file"],
        requireReview: false,
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: any) => {
    const subMissionId = editingSubMission?.id || null;
    console.log('[세부미션 저장] 모드:', subMissionId ? '수정' : '생성', 'ID:', subMissionId);
    saveSubMissionMutation.mutate({ data, subMissionId });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = subMissions.map((sm: any) => sm.id);
    [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    reorderMutation.mutate(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === subMissions.length - 1) return;
    const newOrder = subMissions.map((sm: any) => sm.id);
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder);
  };

  const getSubmissionTypeIcon = (type: string) => {
    switch (type) {
      case "file": return <Image className="h-4 w-4" />;
      case "link": return <Globe className="h-4 w-4" />;
      case "text": return <FileText className="h-4 w-4" />;
      case "review": return <Eye className="h-4 w-4" />;
      default: return null;
    }
  };

  const getSubmissionTypeName = (type: string) => {
    switch (type) {
      case "file": return "파일 제출";
      case "link": return "링크 제출";
      case "text": return "텍스트 제출";
      case "review": return "검수 필요";
      default: return type;
    }
  };

  const handleSheetClose = (open: boolean) => {
    if (!open) {
      console.log('[Sheet 닫힘] editingSubMission 초기화');
      setEditingSubMission(null);
      setIsDialogOpen(false);
      onClose();
    }
  };

  const handleDialogClose = (open: boolean) => {
    console.log('[Dialog 상태 변경]', open ? '열림' : '닫힘', 'editingSubMission:', editingSubMission);
    if (!open) {
      setEditingSubMission(null);
    }
    setIsDialogOpen(open);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleSheetClose}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>세부 미션 관리</SheetTitle>
            <SheetDescription>
              {themeMissionTitle}의 세부 미션을 설정합니다
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground">
                총 {subMissions.length}개의 세부 미션
              </div>
              <Button onClick={() => handleOpenDialog()} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                세부 미션 추가
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : subMissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                세부 미션이 없습니다
              </div>
            ) : (
              <div className="space-y-2">
                {subMissions.map((subMission: any, index: number) => (
                  <Card key={subMission.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveUp(index)}
                            disabled={index === 0 || reorderMutation.isPending}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveDown(index)}
                            disabled={index === subMissions.length - 1 || reorderMutation.isPending}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {(subMission.submissionTypes || (subMission.submissionType ? [subMission.submissionType] : [])).map((type: string, idx: number) => (
                              <Badge key={idx} variant="outline">
                                {getSubmissionTypeIcon(type)}
                                <span className="ml-1">
                                  {getSubmissionTypeName(type)}
                                </span>
                              </Badge>
                            ))}
                            <span className="text-sm font-medium">{subMission.title}</span>
                            {subMission.requireReview && (
                              <Badge variant="secondary">
                                <Eye className="h-3 w-3 mr-1" />
                                검수 필요
                              </Badge>
                            )}
                          </div>
                          {subMission.description && (
                            <p className="text-sm text-muted-foreground">
                              {subMission.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={subMission.isActive}
                              onCheckedChange={(checked) =>
                                toggleActiveMutation.mutate({
                                  id: subMission.id,
                                  isActive: checked,
                                })
                              }
                            />
                            <Label className="text-sm">
                              {subMission.isActive ? "활성" : "비활성"}
                            </Label>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(subMission)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteId(subMission.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubMission ? "세부 미션 수정" : "세부 미션 추가"}
            </DialogTitle>
            <DialogDescription>
              세부 미션 정보를 입력하세요
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="파일을 업로드해주세요" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>설명 (선택)</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="세부 미션에 대한 설명을 입력하세요"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="submissionTypes"
                render={({ field }) => {
                  const submissionTypes = field.value || ["file"];
                  
                  const addType = () => {
                    field.onChange([...submissionTypes, "file"]);
                  };
                  
                  const removeType = (index: number) => {
                    if (submissionTypes.length > 1) {
                      const newTypes = submissionTypes.filter((_: string, i: number) => i !== index);
                      field.onChange(newTypes);
                    }
                  };
                  
                  const updateType = (index: number, newValue: string) => {
                    const newTypes = [...submissionTypes] as string[];
                    newTypes[index] = newValue;
                    field.onChange(newTypes);
                  };
                  
                  return (
                    <FormItem>
                      <FormLabel>제출 타입</FormLabel>
                      <div className="space-y-2">
                        {submissionTypes.map((type: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <Select 
                              value={type} 
                              onValueChange={(value) => updateType(index, value)}
                            >
                              <FormControl>
                                <SelectTrigger className="flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="file">
                                  <div className="flex items-center gap-2">
                                    <Upload className="h-4 w-4" />
                                    파일 제출
                                  </div>
                                </SelectItem>
                                <SelectItem value="image">
                                  <div className="flex items-center gap-2">
                                    <ImagePlus className="h-4 w-4" />
                                    이미지 제출
                                  </div>
                                </SelectItem>
                                <SelectItem value="link">
                                  <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4" />
                                    링크 제출
                                  </div>
                                </SelectItem>
                                <SelectItem value="text">
                                  <div className="flex items-center gap-2">
                                    <FileText className="h-4 w-4" />
                                    텍스트 제출
                                  </div>
                                </SelectItem>
                                <SelectItem value="review">
                                  <div className="flex items-center gap-2">
                                    <Eye className="h-4 w-4" />
                                    검수 필요
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeType(index)}
                              disabled={submissionTypes.length <= 1}
                              className="shrink-0"
                            >
                              <CloseIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addType}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          제출 타입 추가
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="requireReview"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        검수 필요
                      </FormLabel>
                      <FormDescription>
                        제출 후 관리자 검수가 필요한 미션입니다
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={saveSubMissionMutation.isPending}
                >
                  {saveSubMissionMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  저장
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>세부 미션 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 이 세부 미션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteSubMissionMutation.mutate(deleteId)}
              disabled={deleteSubMissionMutation.isPending}
            >
              {deleteSubMissionMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// 하부 미션 관리자 컴포넌트
function ChildMissionManager({ 
  parentId, 
  parentTitle, 
  isOpen, 
  onClose,
  onAddChildMission,
  onEditChildMission
}: { 
  parentId: number; 
  parentTitle: string; 
  isOpen: boolean; 
  onClose: () => void;
  onAddChildMission: (parentId: number) => void;
  onEditChildMission: (mission: any) => void;
}) {
  const queryClient = useQueryClient();
  const [approvedUsersDialogOpen, setApprovedUsersDialogOpen] = useState(false);

  // 하부미션 목록 조회
  const { data: childMissions = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/missions', parentId, 'child-missions'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/missions/${parentId}/child-missions`, { credentials: 'include' });
      if (!response.ok) throw new Error('하부미션 조회 실패');
      return response.json();
    },
    enabled: isOpen
  });

  // 승인된 사용자 목록 조회
  const { data: approvedUsersData } = useQuery<any>({
    queryKey: ['/api/admin/missions', parentId, 'approved-users'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/missions/${parentId}/approved-users`, { credentials: 'include' });
      if (!response.ok) throw new Error('승인된 사용자 조회 실패');
      return response.json();
    },
    enabled: approvedUsersDialogOpen
  });

  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery<MissionCategory[]>({
    queryKey: ['/api/admin/mission-categories'],
  });

  // 하부미션 삭제 mutation
  const deleteChildMissionMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/admin/missions/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', parentId, 'child-missions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
      toast({ title: "하부미션이 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            하부미션 관리
          </SheetTitle>
          <SheetDescription>
            "{parentTitle}" 미션의 하부미션을 관리합니다
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* 승인된 사용자 정보 */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700">
                승인된 사용자만 하부미션에 접근할 수 있습니다
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setApprovedUsersDialogOpen(true)}
            >
              사용자 보기
            </Button>
          </div>

          {/* 하부미션 추가 버튼 */}
          <div className="flex justify-between items-center">
            <h3 className="font-medium">하부미션 목록</h3>
            <Button size="sm" onClick={() => onAddChildMission(parentId)}>
              <Plus className="h-4 w-4 mr-1" />
              하부미션 추가
            </Button>
          </div>

          {/* 하부미션 목록 */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : childMissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              아직 하부미션이 없습니다
            </div>
          ) : (
            <div className="space-y-3">
              {childMissions.map((mission: any) => {
                const category = categories.find(c => c.categoryId === mission.categoryId);
                return (
                  <div
                    key={mission.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{mission.title}</span>
                        {category && (
                          <Badge variant="outline" className="text-xs">
                            {category.emoji} {category.name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        세부미션: {mission.subMissionCount || 0}개 | 
                        승인된 사용자: {mission.approvedUserCount || 0}명
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditChildMission(mission)}
                        title="수정"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('정말 삭제하시겠습니까?')) {
                            deleteChildMissionMutation.mutate(mission.id);
                          }
                        }}
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 승인된 사용자 목록 다이얼로그 */}
        <Dialog open={approvedUsersDialogOpen} onOpenChange={setApprovedUsersDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>승인된 사용자 목록</DialogTitle>
              <DialogDescription>
                이 사용자들만 하부미션에 접근할 수 있습니다
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              {!approvedUsersData ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : approvedUsersData.users?.length === 0 ? (
                <div className="text-center py-4 text-gray-500">
                  승인된 사용자가 없습니다
                </div>
              ) : (
                <div className="space-y-2">
                  {approvedUsersData.users?.map((user: any) => (
                    <div
                      key={user.userId}
                      className="p-3 border rounded flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      {user.approvedAt && (
                        <Badge variant="outline" className="text-xs">
                          {new Date(user.approvedAt).toLocaleDateString()} 승인
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

// 주제 미션 관리
function ThemeMissionManagement() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<ThemeMission | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<number | null>(null);
  const [subMissionBuilder, setSubMissionBuilder] = useState<{ themeMissionId: number; title: string } | null>(null);
  const [childMissionManager, setChildMissionManager] = useState<{ parentId: number; title: string } | null>(null);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const headerImageInputRef = useRef<HTMLInputElement>(null);

  // 기간 기반 상태 계산 함수
  const getMissionPeriodStatus = (startDate?: string, endDate?: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      
      if (now < start) return 'upcoming';
      if (now > end) return 'closed';
      return 'active';
    }
    
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (now < start) return 'upcoming';
      return 'active';
    }
    
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (now > end) return 'closed';
      return 'active';
    }
    
    return 'active';
  };

  // 상태 배지 렌더링
  const getMissionStatusBadge = (mission: ThemeMission) => {
    const startDateStr = mission.startDate ? (mission.startDate instanceof Date ? mission.startDate.toISOString() : String(mission.startDate)) : undefined;
    const endDateStr = mission.endDate ? (mission.endDate instanceof Date ? mission.endDate.toISOString() : String(mission.endDate)) : undefined;
    const periodStatus = getMissionPeriodStatus(startDateStr, endDateStr);
    
    if (periodStatus === 'upcoming') {
      return <Badge className="bg-red-500 text-white hover:bg-red-600">준비 중</Badge>;
    }
    if (periodStatus === 'closed') {
      return <Badge variant="destructive">마감</Badge>;
    }
    return <Badge className="bg-blue-500 text-white hover:bg-blue-600">진행 중</Badge>;
  };

  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery<MissionCategory[]>({
    queryKey: ['/api/admin/mission-categories'],
  });

  // 병원 목록 조회
  const { data: hospitals = [] } = useQuery<any[]>({
    queryKey: ['/api/hospitals'],
  });

  // 주제 미션 목록 조회
  const { data: missions = [], isLoading } = useQuery<ThemeMission[]>({
    queryKey: ['/api/admin/missions'],
  });

  // 미션을 부모-자식 계층 구조로 평탄화 (depth 포함)
  const flattenMissionsWithDepth = (missionList: any[], depth = 0): Array<{ mission: any; depth: number }> => {
    const result: Array<{ mission: any; depth: number }> = [];
    for (const mission of missionList) {
      result.push({ mission, depth });
      if (mission.childMissions && mission.childMissions.length > 0) {
        result.push(...flattenMissionsWithDepth(mission.childMissions, depth + 1));
      }
    }
    return result;
  };

  const flattenedMissions = flattenMissionsWithDepth(missions);

  // 주제 미션 생성/수정 mutation
  const saveMissionMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMission) {
        return apiRequest(`/api/admin/missions/${editingMission.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }
      return apiRequest('/api/admin/missions', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
      toast({ title: "미션이 저장되었습니다" });
      setIsDialogOpen(false);
      setEditingMission(null);
      setCreatingParentId(null);
      setChildMissionManager(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 주제 미션 삭제 mutation
  const deleteMissionMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/admin/missions/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
      toast({ title: "미션이 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 활성화 토글 mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest(`/api/admin/missions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
    },
  });

  const formSchema = z.object({
    missionId: z.string().min(1, "미션 ID를 입력하세요"),
    title: z.string().min(1, "제목을 입력하세요"),
    description: z.string().min(1, "설명을 입력하세요"),
    categoryId: z.string().optional(),
    headerImageUrl: z.string().url("올바른 URL을 입력하세요").optional().or(z.literal("")),
    visibilityType: z.enum(["public", "hospital"]),
    hospitalId: z.number().optional().nullable(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    order: z.number().int().min(0),
  }).refine(
    (data) => {
      if (data.visibilityType === "hospital") {
        return data.hospitalId !== null && data.hospitalId !== undefined;
      }
      return true;
    },
    {
      message: "병원 전용 미션은 병원을 선택해야 합니다",
      path: ["hospitalId"]
    }
  );

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      missionId: "",
      title: "",
      description: "",
      categoryId: "none",
      headerImageUrl: "",
      visibilityType: "public" as "public" | "hospital",
      hospitalId: null as number | null,
      startDate: "",
      endDate: "",
      order: 0,
    },
  });

  const visibilityType = form.watch("visibilityType");

  const handleOpenDialog = (mission?: ThemeMission, parentId?: number) => {
    if (mission) {
      setEditingMission(mission);
      setCreatingParentId(null);
      form.reset({
        missionId: mission.missionId,
        title: mission.title,
        description: mission.description,
        categoryId: mission.categoryId || "none",
        headerImageUrl: mission.headerImageUrl || "",
        visibilityType: (mission.visibilityType || "public") as "public" | "hospital",
        hospitalId: mission.hospitalId,
        startDate: mission.startDate ? new Date(mission.startDate).toISOString().split('T')[0] : "",
        endDate: mission.endDate ? new Date(mission.endDate).toISOString().split('T')[0] : "",
        order: mission.order || 0,
      });
    } else {
      setEditingMission(null);
      setCreatingParentId(parentId || null);
      
      // 부모 미션이 있으면 부모의 설정을 기본값으로
      const parentMission = parentId ? flattenedMissions.find(m => m.mission.id === parentId)?.mission : null;
      
      form.reset({
        missionId: "",
        title: "",
        description: "",
        categoryId: parentMission?.categoryId || "none",
        headerImageUrl: "",
        visibilityType: (parentMission?.visibilityType || "public") as "public" | "hospital",
        hospitalId: parentMission?.hospitalId || null,
        startDate: "",
        endDate: "",
        order: parentMission?.childMissions?.length || missions.length,
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      headerImageUrl: data.headerImageUrl || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      categoryId: data.categoryId === "none" ? null : data.categoryId,
      hospitalId: data.visibilityType === "hospital" ? data.hospitalId : null,
      parentMissionId: creatingParentId || null,
    };
    saveMissionMutation.mutate(payload);
  };

  const handleHeaderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingHeader(true);
    const formData = new FormData();
    formData.append('headerImage', file);
    
    try {
      const response = await fetch('/api/admin/missions/upload-header', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        form.setValue('headerImageUrl', data.imageUrl);
        toast({ title: "이미지가 업로드되었습니다" });
      } else {
        toast({ title: "업로드 실패", description: data.error, variant: "destructive" });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast({ title: "업로드 실패", description: "이미지 업로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setUploadingHeader(false);
      if (headerImageInputRef.current) {
        headerImageInputRef.current.value = '';
      }
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>주제 미션 관리</CardTitle>
            <CardDescription>미션을 생성하고 세부 미션을 설정합니다</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            미션 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>상태</TableHead>
              <TableHead>제목</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>세부미션</TableHead>
              <TableHead>하부미션</TableHead>
              <TableHead>공개 범위</TableHead>
              <TableHead>기간</TableHead>
              <TableHead>활성화</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {flattenedMissions.map(({ mission, depth }) => {
              const category = categories.find(c => c.categoryId === mission.categoryId);
              const hospital = hospitals.find(h => h.id === mission.hospitalId);
              const childCount = mission.childMissions?.length || mission.childMissionCount || 0;
              const subCount = mission.subMissions?.length || mission.subMissionCount || 0;
              
              return (
                <TableRow 
                  key={mission.id}
                  className={depth > 0 ? "bg-muted/30" : ""}
                >
                  <TableCell>{getMissionStatusBadge(mission)}</TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 24}px` }}>
                      {depth > 0 && (
                        <span className="text-muted-foreground mr-1">└</span>
                      )}
                      {mission.title}
                      {depth > 0 && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {depth}차
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {category ? (
                      <Badge variant="outline">
                        {category.emoji} {category.name}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">미분류</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {subCount}개
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium text-gray-700">
                      {childCount}개
                    </span>
                  </TableCell>
                  <TableCell>
                    {mission.visibilityType === "public" ? (
                      <Badge variant="secondary">
                        <Globe className="h-3 w-3 mr-1" />
                        전체 공개
                      </Badge>
                    ) : (
                      <Badge variant="default">
                        <Building2 className="h-3 w-3 mr-1" />
                        {hospital?.name || "병원 전용"}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {mission.startDate && mission.endDate ? (
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="h-3 w-3" />
                        {new Date(mission.startDate).toLocaleDateString()} ~ {new Date(mission.endDate).toLocaleDateString()}
                      </div>
                    ) : (
                      <span className="text-gray-400">기간 없음</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={mission.isActive}
                      onCheckedChange={(checked) => {
                        toggleActiveMutation.mutate({ id: mission.id, isActive: checked });
                      }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubMissionBuilder({ themeMissionId: mission.id, title: mission.title })}
                        title="세부미션 관리"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setChildMissionManager({ parentId: mission.id, title: mission.title })}
                        title="하부미션 관리"
                      >
                        <FolderTree className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(mission)}
                        title="수정"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('정말 삭제하시겠습니까? 모든 세부 미션 및 하부 미션도 함께 삭제됩니다.')) {
                            deleteMissionMutation.mutate(mission.id);
                          }
                        }}
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMission ? '미션 수정' : '미션 추가'}
              </DialogTitle>
              <DialogDescription>
                주제 미션 정보를 입력하세요. 세부 미션은 생성 후 관리할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="missionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>미션 ID</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="daily_mission_1" disabled={!!editingMission} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>카테고리</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="선택하세요" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">카테고리 없음</SelectItem>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.categoryId}>
                                {cat.emoji} {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>미션 제목</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="첫 태교 일기 작성하기" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>미션 설명</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="아기에게 첫 편지를 써보세요" rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="headerImageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>헤더 이미지 (선택)</FormLabel>
                      <div className="space-y-3">
                        {field.value && (
                          <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                            <img 
                              src={field.value} 
                              alt="헤더 이미지 미리보기"
                              className="w-full h-full object-cover"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => field.onChange('')}
                            >
                              <CloseIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2 items-center">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={handleHeaderImageUpload}
                            hidden
                            ref={headerImageInputRef}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => headerImageInputRef.current?.click()}
                            disabled={uploadingHeader}
                          >
                            {uploadingHeader ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                업로드 중...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                이미지 업로드
                              </>
                            )}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            JPG, PNG, GIF, WebP (최대 5MB)
                          </span>
                        </div>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="또는 이미지 URL 직접 입력" 
                            className="text-sm"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="visibilityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>공개 범위</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // visibilityType이 public으로 변경되면 hospitalId 초기화
                            if (value === "public") {
                              form.setValue("hospitalId", null);
                            }
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="public">
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                전체 공개
                              </div>
                            </SelectItem>
                            <SelectItem value="hospital">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                병원 전용
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {visibilityType === "hospital" && (
                    <FormField
                      control={form.control}
                      name="hospitalId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>병원 선택</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(Number(value))} 
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="병원을 선택하세요" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {hospitals.map(hospital => (
                                <SelectItem key={hospital.id} value={hospital.id.toString()}>
                                  {hospital.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>시작일 (선택)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>종료일 (선택)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>정렬 순서</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>낮은 숫자가 먼저 표시됩니다</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={saveMissionMutation.isPending}
                  >
                    {saveMissionMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    저장
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* 세부 미션 빌더 */}
        {subMissionBuilder && (
          <SubMissionBuilder
            themeMissionId={subMissionBuilder.themeMissionId}
            themeMissionTitle={subMissionBuilder.title}
            isOpen={true}
            onClose={() => setSubMissionBuilder(null)}
          />
        )}

        {/* 하부 미션 관리자 */}
        {childMissionManager && (
          <ChildMissionManager
            parentId={childMissionManager.parentId}
            parentTitle={childMissionManager.title}
            isOpen={true}
            onClose={() => setChildMissionManager(null)}
            onAddChildMission={(parentId) => handleOpenDialog(undefined, parentId)}
            onEditChildMission={(mission) => handleOpenDialog(mission)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// 검수 대시보드
function ReviewDashboard() {
  const queryClient = useQueryClient();
  
  const [currentView, setCurrentView] = useState<'theme-missions' | 'sub-missions' | 'submissions'>('theme-missions');
  const [selectedThemeMission, setSelectedThemeMission] = useState<{id: number, missionId: string, title: string} | null>(null);
  const [selectedSubMission, setSelectedSubMission] = useState<{id: number, title: string} | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('all');
  
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // ⚠️ CRITICAL: 별도의 캐시 키 사용하여 useAuth 캐시 오염 방지
  const { data: authResponse } = useQuery<any>({ 
    queryKey: ['/api/admin/auth-check'],  // 다른 키 사용!
    queryFn: async () => {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (!response.ok) return null;
      return response.json();
    }
  });
  const user = authResponse?.user || authResponse;
  const { data: hospitals = [] } = useQuery<any[]>({ queryKey: ['/api/hospitals'] });
  const isSuperAdmin = user?.memberType === 'superadmin';
  
  const hospitalFilter = isSuperAdmin ? "all" : (user?.hospitalId?.toString() || "all");
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>("all");
  const effectiveHospitalFilter = isSuperAdmin ? selectedHospitalFilter : hospitalFilter;

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['/api/admin/review/stats', effectiveHospitalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveHospitalFilter !== 'all') {
        params.set('hospitalId', effectiveHospitalFilter);
      }
      const response = await fetch(`/api/admin/review/stats?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('통계 조회 실패');
      return response.json();
    },
    enabled: !!user,
  });

  const { data: themeMissions = [], isLoading: themeMissionsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/review/theme-missions', effectiveHospitalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveHospitalFilter !== 'all') {
        params.set('hospitalId', effectiveHospitalFilter);
      }
      const response = await fetch(`/api/admin/review/theme-missions?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('주제 미션 조회 실패');
      return response.json();
    },
    enabled: currentView === 'theme-missions' && !!user,
  });

  const { data: subMissions = [], isLoading: subMissionsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/review/theme-missions', selectedThemeMission?.missionId, 'sub-missions'],
    queryFn: async () => {
      if (!selectedThemeMission?.missionId) return [];
      const response = await apiRequest(`/api/admin/review/theme-missions/${selectedThemeMission.missionId}/sub-missions`);
      return await response.json();
    },
    enabled: currentView === 'sub-missions' && !!selectedThemeMission,
  });

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/review/submissions', selectedSubMission?.id, statusFilter],
    queryFn: async () => {
      if (!selectedSubMission) return [];
      const params = new URLSearchParams({
        subMissionId: selectedSubMission.id.toString(),
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const response = await fetch(`/api/admin/review/submissions?${params}`);
      if (!response.ok) throw new Error('제출 내역 조회 실패');
      return response.json();
    },
    enabled: currentView === 'submissions' && !!selectedSubMission,
  });

  const approveMutation = useMutation({
    mutationFn: (submissionId: number) =>
      apiRequest(`/api/admin/review/submissions/${submissionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewerNote: reviewNotes })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/theme-missions'] });
      toast({ title: "승인되었습니다" });
      setSelectedSubmission(null);
      setReviewNotes("");
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (submissionId: number) =>
      apiRequest(`/api/admin/review/submissions/${submissionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewerNote: reviewNotes })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/theme-missions'] });
      toast({ title: "거절되었습니다" });
      setSelectedSubmission(null);
      setReviewNotes("");
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const handleApprove = () => {
    if (selectedSubmission) {
      approveMutation.mutate(selectedSubmission.id);
    }
  };

  const handleReject = () => {
    if (!reviewNotes.trim()) {
      toast({ title: "거절 사유를 입력하세요", variant: "destructive" });
      return;
    }
    if (selectedSubmission) {
      rejectMutation.mutate(selectedSubmission.id);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ko-KR');
  };

  const getSubmissionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      file: '파일',
      link: '링크',
      text: '텍스트',
      review: '검수',
      image: '이미지'
    };
    return types[type] || type;
  };

  const isImageMimeType = (mimeType: string) => {
    if (!mimeType) return false;
    return mimeType.startsWith('image/');
  };

  const handleDownloadImage = async (url: string) => {
    try {
      // fetch로 이미지를 blob으로 받아옴
      const response = await fetch(url);
      const blob = await response.blob();
      
      // blob URL 생성
      const blobUrl = window.URL.createObjectURL(blob);
      
      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = url.split('/').pop()?.split('?')[0] || 'image.webp';
      document.body.appendChild(link);
      link.click();
      
      // 정리
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('다운로드 실패:', error);
      // 실패 시 새 탭으로 열기 (백업)
      window.open(url, '_blank');
    }
  };

  const handlePrintImage = (url: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>인쇄</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;">
            <img src="${url}" style="max-width:100%;height:auto;" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const renderSubmissionContent = (submissionData: any) => {
    if (!submissionData) {
      return <p className="text-muted-foreground">제출 내용이 없습니다</p>;
    }

    // 슬롯 배열이 있으면 슬롯별로 표시
    if (submissionData.slots && Array.isArray(submissionData.slots) && submissionData.slots.length > 0) {
      const slots = submissionData.slots;
      const submissionTypes = submissionData.submissionTypes || [];
      const filledCount = submissionData.filledSlotsCount || slots.filter((s: any) => 
        s.fileUrl || s.imageUrl || s.linkUrl || s.textContent || s.rating
      ).length;
      const totalCount = submissionData.totalSlotsCount || slots.length;

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">제출 현황</Label>
            <Badge variant={filledCount === totalCount ? "default" : "secondary"}>
              {filledCount}/{totalCount} 완료
            </Badge>
          </div>
          
          <div className="grid gap-4">
            {slots.map((slot: any, index: number) => {
              const slotType = submissionTypes[index] || 'unknown';
              const displayUrl = slot.imageUrl || slot.fileUrl;
              const isImage = slotType === 'image' || (slot.mimeType ? isImageMimeType(slot.mimeType) : false);
              const hasContent = displayUrl || slot.linkUrl || slot.textContent || slot.rating;
              
              const typeLabels: Record<string, string> = {
                file: '파일',
                image: '이미지',
                link: '링크',
                text: '텍스트',
                review: '리뷰'
              };

              return (
                <Card key={index} className={`p-3 ${hasContent ? 'bg-muted/30' : 'bg-muted/10 border-dashed'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">
                      {typeLabels[slotType] || slotType} {slots.length > 1 ? `#${index + 1}` : ''}
                    </Label>
                    {hasContent ? (
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                        <Check className="h-3 w-3 mr-1" />
                        제출됨
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        미제출
                      </Badge>
                    )}
                  </div>
                  
                  {displayUrl && isImage && (
                    <div 
                      className="relative w-full aspect-video rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setViewingImage(displayUrl)}
                    >
                      <img 
                        src={displayUrl} 
                        alt={`제출 이미지 ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-muted');
                          const errorText = document.createElement('span');
                          errorText.className = 'text-sm text-muted-foreground';
                          errorText.textContent = '이미지 로드 실패';
                          target.parentElement?.appendChild(errorText);
                        }}
                      />
                    </div>
                  )}
                  
                  {displayUrl && !isImage && (
                    <a 
                      href={displayUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:underline break-all"
                    >
                      {slot.fileName || displayUrl}
                    </a>
                  )}
                  
                  {slot.linkUrl && (
                    <a 
                      href={slot.linkUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:underline break-all"
                    >
                      {slot.linkUrl}
                    </a>
                  )}
                  
                  {slot.textContent && (
                    <p className="text-sm whitespace-pre-wrap bg-background/50 p-2 rounded">
                      {slot.textContent}
                    </p>
                  )}
                  
                  {slot.rating !== undefined && slot.rating !== null && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Heart
                          key={i}
                          className={`h-4 w-4 ${
                            i < slot.rating
                              ? 'fill-pink-500 text-pink-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">{slot.rating}/5</span>
                    </div>
                  )}
                  
                  {slot.memo && (
                    <p className="text-xs text-muted-foreground mt-1">{slot.memo}</p>
                  )}
                  
                  {!hasContent && (
                    <p className="text-sm text-muted-foreground italic">내용 없음</p>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      );
    }

    // 레거시 단일 데이터 처리
    const { submissionType, fileUrl, linkUrl, textContent, rating, memo, imageUrl, mimeType } = submissionData;
    const displayUrl = fileUrl || imageUrl;
    const isImage = submissionType === 'image' || (mimeType ? isImageMimeType(mimeType) : false);

    return (
      <div className="space-y-3">
        {displayUrl && isImage && (
          <div>
            <Label className="text-xs text-muted-foreground">
              {submissionType === 'image' ? '이미지' : '파일 (이미지)'}
            </Label>
            <div 
              className="relative w-full aspect-video rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity mt-2"
              onClick={() => setViewingImage(displayUrl)}
            >
              <img 
                src={displayUrl} 
                alt="제출 이미지"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-muted');
                  const errorText = document.createElement('span');
                  errorText.className = 'text-sm text-muted-foreground';
                  errorText.textContent = '이미지 로드 실패';
                  target.parentElement?.appendChild(errorText);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              클릭하여 크게 보기
            </p>
          </div>
        )}
        
        {displayUrl && !isImage && (
          <div>
            <Label className="text-xs text-muted-foreground">파일</Label>
            <a 
              href={displayUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-sm text-blue-600 hover:underline break-all mt-1"
            >
              {displayUrl}
            </a>
            <p className="text-xs text-muted-foreground mt-1">
              파일을 다운로드하려면 링크를 클릭하세요
            </p>
          </div>
        )}
        
        {linkUrl && (
          <div>
            <Label className="text-xs text-muted-foreground">링크 URL</Label>
            <a 
              href={linkUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-sm text-blue-600 hover:underline break-all mt-1"
            >
              {linkUrl}
            </a>
          </div>
        )}
        
        {textContent && (
          <div>
            <Label className="text-xs text-muted-foreground">텍스트 내용</Label>
            <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md mt-1">
              {textContent}
            </p>
          </div>
        )}
        
        {rating !== undefined && rating !== null && (
          <div>
            <Label className="text-xs text-muted-foreground">별점</Label>
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Heart
                  key={i}
                  className={`h-5 w-5 ${
                    i < rating
                      ? 'fill-pink-500 text-pink-500'
                      : 'text-gray-300'
                  }`}
                />
              ))}
              <span className="ml-2 text-sm font-medium">{rating}/5</span>
            </div>
          </div>
        )}
        
        {memo && (
          <div>
            <Label className="text-xs text-muted-foreground">메모</Label>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
              {memo}
            </p>
          </div>
        )}
      </div>
    );
  };

  const navigateToThemeMissions = () => {
    setCurrentView('theme-missions');
    setSelectedThemeMission(null);
    setSelectedSubMission(null);
  };

  const navigateToSubMissions = (themeMission?: {id: number, missionId: string, title: string}) => {
    if (themeMission) {
      setSelectedThemeMission(themeMission);
    }
    setCurrentView('sub-missions');
    setSelectedSubMission(null);
  };

  const navigateToSubmissions = (subMission: {id: number, title: string}) => {
    setSelectedSubMission(subMission);
    setCurrentView('submissions');
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle>검수 대시보드</CardTitle>
            <CardDescription>사용자가 제출한 미션을 검수하세요</CardDescription>
          </div>
          {isSuperAdmin && (
            <Select value={selectedHospitalFilter} onValueChange={setSelectedHospitalFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 병원</SelectItem>
                {hospitals.map((hospital: any) => (
                  <SelectItem key={hospital.id} value={hospital.id.toString()}>
                    {hospital.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <button
              onClick={navigateToThemeMissions}
              className={`hover:underline ${currentView === 'theme-missions' ? 'font-semibold' : 'text-muted-foreground'}`}
            >
              검수 대시보드
            </button>
            {selectedThemeMission && (
              <>
                <span className="text-muted-foreground">/</span>
                <button
                  onClick={() => navigateToSubMissions()}
                  className={`hover:underline ${currentView === 'sub-missions' ? 'font-semibold' : 'text-muted-foreground'}`}
                >
                  {selectedThemeMission.title}
                </button>
              </>
            )}
            {selectedSubMission && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-semibold">{selectedSubMission.title}</span>
              </>
            )}
          </nav>

          {currentView === 'submissions' && (
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="submitted">검수 대기</SelectItem>
                <SelectItem value="approved">승인</SelectItem>
                <SelectItem value="rejected">거절</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {statsLoading ? (
          <div className="text-center py-4">통계 로딩 중...</div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>검수 대기</CardDescription>
                <CardTitle className="text-3xl text-orange-500">
                  {stats?.pending || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>승인</CardDescription>
                <CardTitle className="text-3xl text-green-500">
                  {stats?.approved || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>거절</CardDescription>
                <CardTitle className="text-3xl text-red-500">
                  {stats?.rejected || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>전체</CardDescription>
                <CardTitle className="text-3xl">
                  {stats?.total || 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {currentView === 'theme-missions' && (
          <>
            {themeMissionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : themeMissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                주제 미션이 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상태</TableHead>
                    <TableHead>주제미션명</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-center">세부미션</TableHead>
                    <TableHead>기간</TableHead>
                    <TableHead className="text-center">검수 대기</TableHead>
                    <TableHead className="text-center">승인</TableHead>
                    <TableHead className="text-center">거절</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const renderReviewMissionRow = (mission: any, depth: number = 0): JSX.Element[] => {
                      const periodStatus = (() => {
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        if (mission.startDate && mission.endDate) {
                          const start = new Date(mission.startDate);
                          const end = new Date(mission.endDate);
                          start.setHours(0, 0, 0, 0);
                          end.setHours(23, 59, 59, 999);
                          if (now < start) return 'upcoming';
                          if (now > end) return 'closed';
                          return 'active';
                        }
                        if (mission.startDate) {
                          const start = new Date(mission.startDate);
                          start.setHours(0, 0, 0, 0);
                          if (now < start) return 'upcoming';
                          return 'active';
                        }
                        if (mission.endDate) {
                          const end = new Date(mission.endDate);
                          end.setHours(23, 59, 59, 999);
                          if (now > end) return 'closed';
                          return 'active';
                        }
                        return 'active';
                      })();
                      
                      const statusBadge = periodStatus === 'upcoming' 
                        ? <Badge className="bg-red-500 text-white hover:bg-red-600">준비 중</Badge>
                        : periodStatus === 'closed'
                        ? <Badge variant="destructive">마감</Badge>
                        : <Badge className="bg-blue-500 text-white hover:bg-blue-600">진행 중</Badge>;
                      
                      const rows: JSX.Element[] = [
                        <TableRow 
                          key={mission.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigateToSubMissions({
                            id: mission.id,
                            missionId: mission.missionId,
                            title: mission.title
                          })}
                        >
                          <TableCell>{statusBadge}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
                              {depth > 0 && <span className="text-muted-foreground">└</span>}
                              {mission.title}
                            </div>
                          </TableCell>
                          <TableCell>
                            {mission.category ? (
                              <Badge variant="outline">{mission.category.name}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {mission.subMissions?.length || 0}개
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {mission.startDate && mission.endDate ? (
                              <>
                                {new Date(mission.startDate).toLocaleDateString('ko-KR')}
                                {' ~ '}
                                {new Date(mission.endDate).toLocaleDateString('ko-KR')}
                              </>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                              {mission.stats?.pending || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              {mission.stats?.approved || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-red-100 text-red-700">
                              {mission.stats?.rejected || 0}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ];

                      if (mission.childMissions && mission.childMissions.length > 0) {
                        for (const child of mission.childMissions) {
                          rows.push(...renderReviewMissionRow(child, depth + 1));
                        }
                      }

                      return rows;
                    };

                    return themeMissions.flatMap((mission: any) => renderReviewMissionRow(mission, 0));
                  })()}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {currentView === 'sub-missions' && (
          <>
            {subMissionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : subMissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                세부 미션이 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>세부미션명</TableHead>
                    <TableHead>제출 타입</TableHead>
                    <TableHead className="text-center">검수 대기</TableHead>
                    <TableHead className="text-center">승인</TableHead>
                    <TableHead className="text-center">거절</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subMissions.map((subMission: any) => (
                    <TableRow 
                      key={subMission.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigateToSubmissions({
                        id: subMission.id,
                        title: subMission.title
                      })}
                    >
                      <TableCell className="font-medium">{subMission.title}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(subMission.submissionTypes || (subMission.submissionType ? [subMission.submissionType] : [])).map((type: string, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {getSubmissionTypeLabel(type)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          {subMission.stats?.pending || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {subMission.stats?.approved || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          {subMission.stats?.rejected || 0}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {currentView === 'submissions' && (
          <>
            {submissionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                제출 내역이 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>사용자</TableHead>
                    <TableHead>제출일시</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission: any) => (
                    <TableRow key={submission.id}>
                      <TableCell>{submission.user?.username || submission.user?.fullName || submission.user?.email || '-'}</TableCell>
                      <TableCell>{formatDate(submission.submittedAt)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            submission.status === 'approved' ? 'default' :
                            submission.status === 'rejected' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {submission.status === 'approved' ? '승인' :
                           submission.status === 'rejected' ? '거절' :
                           '검수 대기'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSubmission(submission)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          검수
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>제출 내용 검수</DialogTitle>
              <DialogDescription>
                사용자가 제출한 내용을 확인하고 승인 또는 거절하세요
              </DialogDescription>
            </DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">사용자</Label>
                    <p className="font-medium">{selectedSubmission.user?.username || selectedSubmission.user?.fullName || selectedSubmission.user?.email || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">제출일시</Label>
                    <p className="font-medium">{formatDate(selectedSubmission.submittedAt)}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">주제 미션</Label>
                  <p className="font-medium">{selectedThemeMission?.title || '-'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">세부 미션</Label>
                  <p className="font-medium">{selectedSubMission?.title || '-'}</p>
                  {selectedSubmission.subMission?.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {selectedSubmission.subMission.description}
                    </p>
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">제출 내용</Label>
                  <Card className="mt-2 p-4 bg-muted/50">
                    {renderSubmissionContent(selectedSubmission.submissionData)}
                  </Card>
                </div>
                <div>
                  <Label htmlFor="review-notes">검수 의견 (선택)</Label>
                  <Textarea
                    id="review-notes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="검수 의견을 입력하세요..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                거절
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                승인
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 이미지 뷰어 Dialog */}
        <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>이미지 보기</DialogTitle>
            </DialogHeader>
            {viewingImage && (
              <div className="space-y-4">
                <div className="relative w-full flex justify-center">
                  <img 
                    src={viewingImage} 
                    alt="제출 이미지 전체보기"
                    className="max-h-[70vh] w-auto object-contain rounded-lg"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleDownloadImage(viewingImage)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    다운로드
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handlePrintImage(viewingImage)}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    인쇄
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// 메인 컴포넌트
export default function MissionManagement() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">미션 시스템 관리</h2>
      
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories">카테고리</TabsTrigger>
          <TabsTrigger value="missions">주제 미션</TabsTrigger>
          <TabsTrigger value="review">검수 대기</TabsTrigger>
        </TabsList>
        
        <TabsContent value="categories" className="mt-6">
          <MissionCategoryManagement />
        </TabsContent>
        
        <TabsContent value="missions" className="mt-6">
          <ThemeMissionManagement />
        </TabsContent>
        
        <TabsContent value="review" className="mt-6">
          <ReviewDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
