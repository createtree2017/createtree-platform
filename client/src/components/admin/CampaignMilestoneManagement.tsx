import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { formatDateForInput, formatSimpleDate, getPeriodStatus } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Edit, Plus, Trash2, Calendar, Trophy, Users } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { Badge } from "@/components/ui/badge";

// 참여형 마일스톤 유효성 검사 스키마
const campaignMilestoneFormSchema = z.object({
  milestoneId: z.string().min(3, "ID는 최소 3자 이상이어야 합니다"),
  title: z.string().min(2, "제목은 최소 2자 이상이어야 합니다"),
  description: z.string().min(10, "설명은 최소 10자 이상이어야 합니다"),
  content: z.string().min(20, "상세 내용은 최소 20자 이상이어야 합니다"),
  headerImageUrl: z.string().url("올바른 URL을 입력해주세요").optional().or(z.literal("")),
  
  // 필수 필드 추가
  badgeEmoji: z.string().min(1, "배지 이모지를 입력해주세요"),
  encouragementMessage: z.string().min(5, "응원 메시지는 최소 5자 이상이어야 합니다"),
  
  // 참여 기간
  campaignStartDate: z.string().min(1, "참여 시작일을 선택해주세요"),
  campaignEndDate: z.string().min(1, "참여 종료일을 선택해주세요"),
  
  // 선정 기간
  selectionStartDate: z.string().min(1, "선정 시작일을 선택해주세요"),
  selectionEndDate: z.string().min(1, "선정 종료일을 선택해주세요"),
  
  // 메타데이터
  categoryId: z.string().min(1, "카테고리를 선택해주세요"),
  hospitalId: z.coerce.number().min(0), // 0은 전체 선택을 의미
  order: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true),
}).refine((data) => {
  const campaignStart = new Date(data.campaignStartDate);
  const campaignEnd = new Date(data.campaignEndDate);
  const selectionStart = new Date(data.selectionStartDate);
  const selectionEnd = new Date(data.selectionEndDate);
  
  return campaignStart < campaignEnd && 
         campaignEnd < selectionStart && 
         selectionStart < selectionEnd;
}, {
  message: "날짜 순서: 참여 시작 < 참여 종료 < 선정 시작 < 선정 종료",
  path: ["campaignEndDate"]
});

type CampaignMilestoneFormValues = z.infer<typeof campaignMilestoneFormSchema>;

// 참여형 마일스톤 인터페이스
interface CampaignMilestone {
  id: number;
  milestoneId: string;
  title: string;
  description: string;
  content: string;
  type: 'campaign';
  headerImageUrl?: string;
  badgeEmoji?: string;
  encouragementMessage?: string;
  campaignStartDate: string;
  campaignEndDate: string;
  selectionStartDate: string;
  selectionEndDate: string;
  categoryId: string;
  hospitalId: number;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: {
    id: string;
    name: string;
  };
  hospital?: {
    id: number;
    name: string;
  };
}

export default function CampaignMilestoneManagement() {
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<CampaignMilestone | null>(null);
  const [uploadingHeader, setUploadingHeader] = useState(false);

  // 참여형 마일스톤 목록 조회
  const { data: milestones = [], isLoading } = useQuery({
    queryKey: ['/api/milestones', { type: 'campaign' }],
    queryFn: async () => {
      const response = await fetch('/api/milestones?type=campaign');
      if (!response.ok) throw new Error('Failed to fetch campaign milestones');
      return response.json();
    }
  });

  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery({
    queryKey: ['/api/milestone-categories'],
  });

  // 병원 목록 조회
  const { data: hospitals = [] } = useQuery({
    queryKey: ['/api/hospitals'],
  });

  // 생성 폼 설정
  const createForm = useForm<CampaignMilestoneFormValues>({
    resolver: zodResolver(campaignMilestoneFormSchema),
    defaultValues: {
      milestoneId: "",
      title: "",
      description: "",
      content: "",
      headerImageUrl: "",
      badgeEmoji: "🎯",
      encouragementMessage: "참여해주셔서 감사합니다!",
      campaignStartDate: "",
      campaignEndDate: "",
      selectionStartDate: "",
      selectionEndDate: "",
      categoryId: "",
      hospitalId: 0,
      order: 0,
      isActive: true,
    },
  });

  // 수정 폼 설정
  const editForm = useForm<CampaignMilestoneFormValues>({
    resolver: zodResolver(campaignMilestoneFormSchema),
  });

  // 참여형 마일스톤 생성
  const createMutation = useMutation({
    mutationFn: async (data: CampaignMilestoneFormValues) => {
      const payload = {
        ...data,
        type: 'campaign',
        campaignStartDate: new Date(data.campaignStartDate).toISOString(),
        campaignEndDate: new Date(data.campaignEndDate).toISOString(),
        selectionStartDate: new Date(data.selectionStartDate).toISOString(),
        selectionEndDate: new Date(data.selectionEndDate).toISOString(),
      };
      
      return apiRequest("/api/admin/milestones", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/milestones'] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "성공",
        description: "참여형 마일스톤이 생성되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "참여형 마일스톤 생성에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // 참여형 마일스톤 수정
  const updateMutation = useMutation({
    mutationFn: async (data: CampaignMilestoneFormValues) => {
      if (!selectedMilestone) throw new Error("선택된 마일스톤이 없습니다.");
      
      console.log('수정 요청 데이터:', data);
      console.log('선택된 마일스톤:', selectedMilestone);
      
      const payload = {
        ...data,
        type: 'campaign',
        campaignStartDate: new Date(data.campaignStartDate).toISOString(),
        campaignEndDate: new Date(data.campaignEndDate).toISOString(),
        selectionStartDate: new Date(data.selectionStartDate).toISOString(),
        selectionEndDate: new Date(data.selectionEndDate).toISOString(),
      };
      
      console.log('전송할 페이로드:', payload);
      
      const response = await fetch(`/api/admin/milestones/${selectedMilestone.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API 오류 응답:', errorText);
        throw new Error(`API 오류: ${response.status} - ${errorText}`);
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/milestones'] });
      setIsEditDialogOpen(false);
      setSelectedMilestone(null);
      toast({
        title: "성공",
        description: "참여형 마일스톤이 수정되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "참여형 마일스톤 수정에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // 참여형 마일스톤 삭제
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/admin/milestones/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/milestones'] });
      setIsDeleteDialogOpen(false);
      setSelectedMilestone(null);
      toast({
        title: "성공",
        description: "참여형 마일스톤이 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "참여형 마일스톤 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // 수정 다이얼로그 열기
  const handleEdit = (milestone: CampaignMilestone) => {
    console.log('수정할 마일스톤 데이터:', milestone);
    setSelectedMilestone(milestone);

    editForm.reset({
      milestoneId: milestone.milestoneId || "",
      title: milestone.title || "",
      description: milestone.description || "",
      content: milestone.content || "",
      headerImageUrl: milestone.headerImageUrl || "",
      badgeEmoji: (milestone as any).badgeEmoji || "🎯",
      encouragementMessage: (milestone as any).encouragementMessage || "참여해주셔서 감사합니다!",
      campaignStartDate: formatDateForInput(milestone.campaignStartDate),
      campaignEndDate: formatDateForInput(milestone.campaignEndDate),
      selectionStartDate: formatDateForInput(milestone.selectionStartDate),
      selectionEndDate: formatDateForInput(milestone.selectionEndDate),
      categoryId: milestone.categoryId || "",
      hospitalId: milestone.hospitalId || 0,
      order: milestone.order || 0,
      isActive: milestone.isActive !== undefined ? milestone.isActive : true,
    });
    setIsEditDialogOpen(true);
  };

  // 삭제 다이얼로그 열기
  const handleDelete = (milestone: CampaignMilestone) => {
    setSelectedMilestone(milestone);
    setIsDeleteDialogOpen(true);
  };

  // 헤더 이미지 업로드 함수
  const uploadHeaderImage = async (file: File): Promise<string> => {
    setUploadingHeader(true);
    try {
      const formData = new FormData();
      formData.append('headerImage', file);
      
      const response = await fetch('/api/admin/milestones/upload-header', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('이미지 업로드에 실패했습니다');
      }
      
      const data = await response.json();
      return data.url;
    } catch (error) {
      console.error('헤더 이미지 업로드 오류:', error);
      toast({
        title: "업로드 실패",
        description: "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setUploadingHeader(false);
    }
  };

  // 날짜 형식화 - 중앙 dateUtils 사용
  const formatDate = (dateString: string) => formatSimpleDate(dateString);

  // 상태 배지 색상
  const getStatusBadge = (milestone: CampaignMilestone) => {
    const now = new Date();
    const campaignStart = new Date(milestone.campaignStartDate);
    const campaignEnd = new Date(milestone.campaignEndDate);
    const selectionStart = new Date(milestone.selectionStartDate);
    const selectionEnd = new Date(milestone.selectionEndDate);

    if (!milestone.isActive) {
      return <Badge variant="secondary">비활성</Badge>;
    }
    
    if (now < campaignStart) {
      return <Badge variant="outline">예정</Badge>;
    } else if (now >= campaignStart && now <= campaignEnd) {
      return <Badge variant="default">참여 진행중</Badge>;
    } else if (now >= selectionStart && now <= selectionEnd) {
      return <Badge variant="secondary">선정 진행중</Badge>;
    } else if (now > selectionEnd) {
      return <Badge variant="destructive">종료</Badge>;
    }
    
    return <Badge variant="outline">대기</Badge>;
  };

  if (isLoading) {
    return <div className="flex justify-center p-4">로딩 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            참여형 마일스톤 관리
          </h2>
          <p className="text-muted-foreground">
            병원별 캠페인 및 이벤트 마일스톤을 관리합니다
          </p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          새 캠페인 생성
        </Button>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">전체 캠페인</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{milestones.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">활성 캠페인</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {milestones.filter((m: CampaignMilestone) => m.isActive).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">진행중 캠페인</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {milestones.filter((m: CampaignMilestone) => {
                const now = new Date();
                const start = new Date(m.campaignStartDate);
                const end = new Date(m.campaignEndDate);
                return m.isActive && now >= start && now <= end;
              }).length}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">참여 병원</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(milestones.map((m: CampaignMilestone) => m.hospitalId)).size}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 마일스톤 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>참여형 마일스톤 목록</CardTitle>
          <CardDescription>
            병원별 캠페인 마일스톤을 관리하고 참여 기간을 설정할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>제목</TableHead>
                <TableHead>병원</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>참여 기간</TableHead>
                <TableHead>선정 기간</TableHead>
                <TableHead>상태</TableHead>
                <TableHead>순서</TableHead>
                <TableHead className="text-right">작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {milestones.map((milestone: CampaignMilestone) => (
                <TableRow key={milestone.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-semibold">{milestone.title}</div>
                      <div className="text-sm text-muted-foreground">
                        {milestone.milestoneId}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {milestone.hospitalId === 0 || milestone.hospitalId === null ? "전체" : (milestone.hospital?.name || `병원 ID: ${milestone.hospitalId}`)}
                  </TableCell>
                  <TableCell>
                    {milestone.category?.name || milestone.categoryId}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatDate(milestone.campaignStartDate)}</div>
                      <div className="text-muted-foreground">
                        ~ {formatDate(milestone.campaignEndDate)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatDate(milestone.selectionStartDate)}</div>
                      <div className="text-muted-foreground">
                        ~ {formatDate(milestone.selectionEndDate)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(milestone)}
                  </TableCell>
                  <TableCell>{milestone.order}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(milestone)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(milestone)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {milestones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    참여형 마일스톤이 없습니다. 새 캠페인을 생성해보세요.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 생성 다이얼로그 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 참여형 마일스톤 생성</DialogTitle>
            <DialogDescription>
              병원별 캠페인 마일스톤을 생성합니다. 참여 기간과 선정 기간을 정확히 설정해주세요.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="milestoneId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>마일스톤 ID</FormLabel>
                      <FormControl>
                        <Input placeholder="campaign-photo-contest" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>제목</FormLabel>
                      <FormControl>
                        <Input placeholder="태교 사진 콘테스트" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={createForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>간단 설명</FormLabel>
                    <FormControl>
                      <Textarea placeholder="캠페인의 간단한 설명을 입력하세요" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>상세 내용</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="캠페인의 상세 내용, 참여 방법, 혜택 등을 입력하세요" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
                name="headerImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>헤더 이미지 URL (선택사항)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com/header-image.jpg" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>카테고리</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="카테고리 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(categories) && categories.map((category: any) => (
                            <SelectItem key={category.id} value={category.categoryId}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="hospitalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>병원</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="병원 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">전체</SelectItem>
                          {Array.isArray(hospitals) && hospitals.map((hospital: any) => (
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="badgeEmoji"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>배지 이모지</FormLabel>
                      <FormControl>
                        <Input placeholder="🎯" {...field} />
                      </FormControl>
                      <FormDescription>
                        마일스톤 달성 시 표시될 이모지
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="encouragementMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>응원 메시지</FormLabel>
                      <FormControl>
                        <Input placeholder="참여해주셔서 감사합니다!" {...field} />
                      </FormControl>
                      <FormDescription>
                        참여자에게 표시될 응원 메시지
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 헤더 이미지 업로드 */}
              <FormField
                control={createForm.control}
                name="headerImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>헤더 이미지</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const imageUrl = await uploadHeaderImage(file);
                                field.onChange(imageUrl);
                                toast({
                                  title: "업로드 완료",
                                  description: "헤더 이미지가 성공적으로 업로드되었습니다.",
                                });
                              } catch (error) {
                                // 에러는 uploadHeaderImage에서 처리됨
                              }
                            }
                          }}
                          disabled={uploadingHeader}
                        />
                        {uploadingHeader && (
                          <p className="text-sm text-muted-foreground">이미지 업로드 중...</p>
                        )}
                        {field.value && (
                          <div className="mt-2">
                            <img 
                              src={field.value} 
                              alt="헤더 이미지 미리보기" 
                              className="w-full h-32 object-cover rounded-lg border"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              미리보기 - 실제 마일스톤 페이지에서 표시됩니다
                            </p>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      참여형 마일스톤 상단에 표시될 헤더 이미지 (권장: 1200x400px)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="campaignStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>참여 시작일</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="campaignEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>참여 종료일</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="selectionStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>선정 시작일</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="selectionEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>선정 종료일</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>표시 순서</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-8">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>활성화</FormLabel>
                        <FormDescription>
                          체크하면 사용자에게 표시됩니다
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "생성 중..." : "생성하기"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>참여형 마일스톤 수정</DialogTitle>
            <DialogDescription>
              선택된 참여형 마일스톤의 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              {/* 수정 폼 필드들 (생성 폼과 동일) */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="milestoneId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>마일스톤 ID</FormLabel>
                      <FormControl>
                        <Input placeholder="campaign-photo-contest" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>제목</FormLabel>
                      <FormControl>
                        <Input placeholder="태교 사진 콘테스트" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>간단 설명</FormLabel>
                    <FormControl>
                      <Textarea placeholder="캠페인의 간단한 설명을 입력하세요" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>상세 내용</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="캠페인의 상세 내용, 참여 방법, 혜택 등을 입력하세요" 
                        className="min-h-[100px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>카테고리</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="카테고리 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.isArray(categories) && categories.map((category: any) => (
                            <SelectItem key={category.id} value={category.categoryId}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="hospitalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>병원</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="병원 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">전체</SelectItem>
                          {Array.isArray(hospitals) && hospitals.map((hospital: any) => (
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="badgeEmoji"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>배지 이모지</FormLabel>
                      <FormControl>
                        <Input placeholder="🎯" {...field} />
                      </FormControl>
                      <FormDescription>
                        마일스톤 달성 시 표시될 이모지
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="encouragementMessage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>응원 메시지</FormLabel>
                      <FormControl>
                        <Input placeholder="참여해주셔서 감사합니다!" {...field} />
                      </FormControl>
                      <FormDescription>
                        참여자에게 표시될 응원 메시지
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* 헤더 이미지 업로드 */}
              <FormField
                control={editForm.control}
                name="headerImageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>헤더 이미지</FormLabel>
                    <FormControl>
                      <div className="space-y-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const imageUrl = await uploadHeaderImage(file);
                                field.onChange(imageUrl);
                                toast({
                                  title: "업로드 완료",
                                  description: "헤더 이미지가 성공적으로 업로드되었습니다.",
                                });
                              } catch (error) {
                                // 에러는 uploadHeaderImage에서 처리됨
                              }
                            }
                          }}
                          disabled={uploadingHeader}
                        />
                        {uploadingHeader && (
                          <p className="text-sm text-muted-foreground">이미지 업로드 중...</p>
                        )}
                        {field.value && (
                          <div className="mt-2">
                            <img 
                              src={field.value} 
                              alt="헤더 이미지 미리보기" 
                              className="w-full h-32 object-cover rounded-lg border"
                            />
                            <p className="text-sm text-muted-foreground mt-1">
                              미리보기 - 실제 마일스톤 페이지에서 표시됩니다
                            </p>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      참여형 마일스톤 상단에 표시될 헤더 이미지 (권장: 1200x400px)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="campaignStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>참여 시작일</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="campaignEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>참여 종료일</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="selectionStartDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>선정 시작일</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="selectionEndDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>선정 종료일</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>표시 순서</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-8">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>활성화</FormLabel>
                        <FormDescription>
                          체크하면 사용자에게 표시됩니다
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "수정 중..." : "수정하기"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>참여형 마일스톤 삭제</DialogTitle>
            <DialogDescription>
              정말로 "{selectedMilestone?.title}" 마일스톤을 삭제하시겠습니까?
              이 작업은 되돌릴 수 없습니다.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedMilestone && deleteMutation.mutate(selectedMilestone.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제하기"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}