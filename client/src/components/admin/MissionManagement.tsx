import { useState } from "react";
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
  Globe, Building2, Calendar
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
          body: data
        });
      }
      return apiRequest('/api/admin/mission-categories', {
        method: 'POST',
        body: data
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

// 주제 미션 관리
function ThemeMissionManagement() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<ThemeMission | null>(null);

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

  // 주제 미션 생성/수정 mutation
  const saveMissionMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMission) {
        return apiRequest(`/api/admin/missions/${editingMission.id}`, {
          method: 'PUT',
          body: data
        });
      }
      return apiRequest('/api/admin/missions', {
        method: 'POST',
        body: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
      toast({ title: "미션이 저장되었습니다" });
      setIsDialogOpen(false);
      setEditingMission(null);
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
        body: { isActive }
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
      categoryId: "",
      headerImageUrl: "",
      visibilityType: "public" as const,
      hospitalId: null as number | null,
      startDate: "",
      endDate: "",
      order: 0,
    },
  });

  const visibilityType = form.watch("visibilityType");

  const handleOpenDialog = (mission?: ThemeMission) => {
    if (mission) {
      setEditingMission(mission);
      form.reset({
        missionId: mission.missionId,
        title: mission.title,
        description: mission.description,
        categoryId: mission.categoryId || "",
        headerImageUrl: mission.headerImageUrl || "",
        visibilityType: mission.visibilityType as "public" | "hospital",
        hospitalId: mission.hospitalId,
        startDate: mission.startDate ? new Date(mission.startDate).toISOString().split('T')[0] : "",
        endDate: mission.endDate ? new Date(mission.endDate).toISOString().split('T')[0] : "",
        order: mission.order || 0,
      });
    } else {
      setEditingMission(null);
      form.reset({
        missionId: "",
        title: "",
        description: "",
        categoryId: "",
        headerImageUrl: "",
        visibilityType: "public",
        hospitalId: null,
        startDate: "",
        endDate: "",
        order: missions.length,
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
      categoryId: data.categoryId || null,
      hospitalId: data.visibilityType === "hospital" ? data.hospitalId : null,
    };
    saveMissionMutation.mutate(payload);
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
              <TableHead>ID</TableHead>
              <TableHead>제목</TableHead>
              <TableHead>카테고리</TableHead>
              <TableHead>공개 범위</TableHead>
              <TableHead>기간</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {missions.map((mission) => {
              const category = categories.find(c => c.categoryId === mission.categoryId);
              const hospital = hospitals.find(h => h.id === mission.hospitalId);
              
              return (
                <TableRow key={mission.id}>
                  <TableCell className="font-mono text-sm">{mission.missionId}</TableCell>
                  <TableCell className="font-medium">{mission.title}</TableCell>
                  <TableCell>
                    {category ? (
                      <Badge variant="outline">
                        {category.emoji} {category.name}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">미분류</span>
                    )}
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
                        onClick={() => {
                          // TODO: 세부 미션 관리로 이동
                          toast({ title: "세부 미션 관리", description: "다음 단계에서 구현됩니다" });
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(mission)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('정말 삭제하시겠습니까? 모든 세부 미션도 함께 삭제됩니다.')) {
                            deleteMissionMutation.mutate(mission.id);
                          }
                        }}
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
                            <SelectItem value="">카테고리 없음</SelectItem>
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
                      <FormLabel>헤더 이미지 URL (선택)</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="https://example.com/image.jpg" />
                      </FormControl>
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
          <Card>
            <CardHeader>
              <CardTitle>검수 대기 목록</CardTitle>
              <CardDescription>곧 추가 예정...</CardDescription>
            </CardHeader>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
