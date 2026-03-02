import React, { useState, useEffect, useCallback } from "react";
import { Calendar, Heart, Medal, Trophy, Clock, Milestone, Notebook, Users, Gift, Upload, File, X } from "lucide-react";
import { useModalContext } from "@/contexts/ModalContext";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Types for our milestone data models
interface Milestone {
  id: number;
  milestoneId: string;
  title: string;
  description: string;
  weekStart: number;
  weekEnd: number;
  badgeEmoji: string;
  badgeImageUrl?: string;
  encouragementMessage: string;
  categoryId: string;
  order: number;
  isActive: boolean;
  type?: 'info' | 'campaign';
  // 참여형 마일스톤 필드들
  hospitalId?: number;
  campaignStartDate?: string;
  campaignEndDate?: string;
  selectionStartDate?: string;
  selectionEndDate?: string;
}

// 참여형 마일스톤 전용 타입
interface CampaignMilestone {
  id: number;
  milestoneId: string;
  title: string;
  description: string;
  content: string;
  type: 'campaign';
  headerImageUrl?: string;
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

// 신청 내역 타입
interface MilestoneApplication {
  id: number;
  milestoneId: string;
  userId: number;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  applicationData?: any;
  appliedAt: string;
  processedAt?: string;
  processedBy?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  milestone?: CampaignMilestone;
}

interface UserMilestone {
  id: number;
  userId: number;
  milestoneId: string;
  completedAt: string;
  notes?: string;
  // photoUrl?: string; // 필드가 실제 데이터베이스에 존재하지 않아 제거
  milestone: Milestone;
}

interface PregnancyProfile {
  id: number;
  userId: number;
  dueDate: string | Date;
  currentWeek: number;
  lastUpdated: string;
  babyNickname?: string;
  babyGender?: string;
  isFirstPregnancy?: boolean;
}

interface AchievementStats {
  totalCompleted: number;
  totalAvailable: number;
  completionRate: number;
  categories: Record<string, { completed: number; total: number; percent: number }>;
  recentlyCompleted: UserMilestone[];
}

// Category translations & colors
const categoryInfo: Record<string, { name: string; icon: React.ElementType; color: string; description: string }> = {
  baby_development: {
    name: "아기 발달",
    icon: Heart,
    color: "bg-pink-100 text-pink-800 hover:bg-pink-200",
    description: "아기의 성장과 발달 마일스톤 추적하기"
  },
  maternal_health: {
    name: "산모 건강",
    icon: Heart,
    color: "bg-purple-100 text-purple-800 hover:bg-purple-200",
    description: "임신 기간 동안 건강과 웰빙 관리하기"
  },
  preparations: {
    name: "출산 준비",
    icon: Calendar,
    color: "bg-blue-100 text-blue-800 hover:bg-blue-200",
    description: "아기 맞이할 준비하기"
  }
};

// Helper function to calculate weeks remaining
const calculateWeeksRemaining = (dueDate: string | Date): number => {
  const today = new Date();
  const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
  const diffTime = Math.abs(due.getTime() - today.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.ceil(diffDays / 7);
};

// Profile setup component
export const ProfileSetup = ({
  onSave,
  profile
}: {
  onSave: (profile: Partial<PregnancyProfile>) => void;
  profile?: PregnancyProfile;
}) => {
  const [dueDate, setDueDate] = useState<Date | undefined>(profile?.dueDate ? new Date(profile.dueDate) : undefined);
  const [babyNickname, setBabyNickname] = useState<string>(profile?.babyNickname || "");
  const [babyGender, setBabyGender] = useState<string>(profile?.babyGender || "unknown");
  const [isFirstPregnancy, setIsFirstPregnancy] = useState<boolean>(profile?.isFirstPregnancy || false);

  const handleSave = () => {
    if (!dueDate) return;

    onSave({
      dueDate: dueDate.toISOString(),
      babyNickname: babyNickname || undefined,
      babyGender,
      isFirstPregnancy
    });
  };

  return (
    <div className="space-y-6 p-4">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">임신 프로필 설정</h2>
        <p className="text-muted-foreground">
          임신기간 동안 맞춤형 문화경험을 안내합니다
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="due-date">출산 예정일 <span className="text-red-500">*</span></Label>
          <DatePicker date={dueDate} setDate={setDueDate} />
          <p className="text-sm text-muted-foreground">
            이를 통해 가능한 마일스톤을 계산할 수 있습니다
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baby-nickname">아기 애칭 (선택사항)</Label>
          <Input
            id="baby-nickname"
            placeholder="콩이, 복이 등"
            value={babyNickname}
            onChange={(e) => setBabyNickname(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label>아기 성별 (선택사항)</Label>
          <div className="flex space-x-2">
            <Button
              variant={babyGender === "boy" ? "default" : "outline"}
              onClick={() => setBabyGender("boy")}
              type="button"
            >
              남자아이
            </Button>
            <Button
              variant={babyGender === "girl" ? "default" : "outline"}
              onClick={() => setBabyGender("girl")}
              type="button"
            >
              여자아이
            </Button>
            <Button
              variant={babyGender === "twins" ? "default" : "outline"}
              onClick={() => setBabyGender("twins")}
              type="button"
            >
              쌍둥이
            </Button>
            <Button
              variant={babyGender === "unknown" ? "default" : "outline"}
              onClick={() => setBabyGender("unknown")}
              type="button"
            >
              아직 모름
            </Button>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="first-pregnancy"
            checked={isFirstPregnancy}
            onChange={(e) => setIsFirstPregnancy(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          <Label htmlFor="first-pregnancy">첫 임신입니다</Label>
        </div>
      </div>

      <Button onClick={handleSave} disabled={!dueDate}>
        프로필 저장
      </Button>
    </div>
  );
};

// 데이터베이스의 실제 마일스톤 데이터만 사용 - 하드코딩 제거됨

// 참여형 마일스톤 카드 컴포넌트
const CampaignMilestoneCard = ({
  milestone,
  onApply,
  userApplication
}: {
  milestone: CampaignMilestone;
  onApply: (milestoneId: string) => void;
  userApplication?: MilestoneApplication;
}) => {
  const modal = useModalContext();
  const now = new Date();
  const campaignStart = new Date(milestone.campaignStartDate);
  const campaignEnd = new Date(milestone.campaignEndDate);
  const selectionStart = new Date(milestone.selectionStartDate);
  const selectionEnd = new Date(milestone.selectionEndDate);

  // 사용자의 해당 마일스톤 신청 상태는 props로 직접 받음
  // (이미 부모 컴포넌트에서 매칭되어 전달됨)

  // 참여 기간 상태 확인
  const isBeforeCampaign = now < campaignStart;
  const isDuringCampaign = now >= campaignStart && now <= campaignEnd;
  const isAfterCampaign = now > campaignEnd && now < selectionStart;
  const isDuringSelection = now >= selectionStart && now <= selectionEnd;
  const isAfterSelection = now > selectionEnd;

  // 상태에 따른 버튼 텍스트와 색상
  const getButtonInfo = (): { text: string; variant: "default" | "outline"; disabled: boolean; color?: string } => {
    // 이미 신청한 경우 - 기간별 상태 고려
    if (userApplication) {
      // 선정 기간 이후에는 결과에 따라 표시
      if (isAfterSelection) {
        if (userApplication.status === 'approved') {
          return { text: "선정 완료", variant: "default", disabled: true, color: "text-green-600" };
        } else if (userApplication.status === 'rejected') {
          return { text: "미선정", variant: "outline", disabled: true, color: "text-red-600" };
        } else {
          // pending 상태로 선정 기간이 끝난 경우 미선정으로 간주
          return { text: "미선정", variant: "outline", disabled: true, color: "text-red-600" };
        }
      }

      // 선정 기간 중일 때
      if (isDuringSelection) {
        return { text: "선정 중", variant: "outline", disabled: true, color: "text-blue-600" };
      }

      // 참여 기간 이후, 선정 기간 이전
      if (isAfterCampaign && !isDuringSelection) {
        return { text: "선정 대기", variant: "outline", disabled: true, color: "text-orange-600" };
      }

      // 참여 기간 중 - 신청 상태별 표시
      if (isDuringCampaign) {
        if (userApplication.status === 'pending') {
          return { text: "신청 중", variant: "outline", disabled: true, color: "text-blue-600" };
        }
        if (userApplication.status === 'approved') {
          return { text: "승인됨", variant: "default", disabled: true, color: "text-green-600" };
        }
        if (userApplication.status === 'rejected') {
          return { text: "보류됨", variant: "outline", disabled: true, color: "text-red-600" };
        }
        if (userApplication.status === 'cancelled') {
          return { text: "취소됨", variant: "outline", disabled: true, color: "text-gray-600" };
        }
      }
    }

    // 신청하지 않은 경우 기간에 따른 상태
    if (isBeforeCampaign) {
      return { text: "참여 대기", variant: "outline", disabled: true, color: "text-gray-600" };
    }
    if (isDuringCampaign) {
      return { text: "신청하기", variant: "default", disabled: false };
    }
    if (isAfterCampaign && !isDuringSelection) {
      return { text: "신청 마감", variant: "outline", disabled: true, color: "text-gray-600" };
    }
    if (isDuringSelection) {
      return { text: "선정 중", variant: "outline", disabled: true, color: "text-blue-600" };
    }
    if (isAfterSelection) {
      return { text: "마감됨", variant: "outline", disabled: true, color: "text-gray-600" };
    }
    return { text: "신청하기", variant: "default", disabled: false };
  };

  const buttonInfo = getButtonInfo();

  const handleButtonClick = () => {
    if (isDuringCampaign && !userApplication) {
      modal.openModal('campaignMilestoneDetail', { milestone, isDuringCampaign, userApplication, onApply });
    }
  };

  const handleApply = () => {
    if (isDuringCampaign && !userApplication) {
      onApply(milestone.milestoneId);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className={`${categoryInfo[milestone.categoryId]?.color || "bg-gray-100"}`}>
        <div className="flex justify-between items-center">
          <CardTitle>{milestone.title}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">참여형</Badge>
            <span className="text-3xl">🎯</span>
          </div>
        </div>
        <CardDescription>{categoryInfo[milestone.categoryId]?.name || milestone.categoryId}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="mb-2">{milestone.description}</p>
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>📅 참여기간: {format(campaignStart, "M.d")} - {format(campaignEnd, "M.d")}</p>
          <p>🏆 선정기간: {format(selectionStart, "M.d")} - {format(selectionEnd, "M.d")}</p>
          <p>🏥 대상병원: {milestone.hospital?.name || "전체"}</p>
        </div>
      </CardContent>
      <CardFooter className="space-x-2">
        <Button
          variant={buttonInfo.variant}
          disabled={buttonInfo.disabled}
          onClick={handleButtonClick}
          className={`flex-1 ${buttonInfo.color || ''}`}
        >
          {buttonInfo.text}
        </Button>
        <Button variant="outline" onClick={() => modal.openModal('campaignMilestoneDetail', { milestone, isDuringCampaign, userApplication, onApply })}>
          자세히
        </Button>
      </CardFooter>
    </Card>
  );
};

// Available milestone card component (정보형)
const MilestoneCard = ({
  milestone,
  onComplete
}: {
  milestone: Milestone;
  onComplete: (milestoneId: string, notes?: string) => void;
}) => {
  const modal = useModalContext();

  const handleDialogOpen = () => {
    modal.openModal('milestoneComplete', { milestone, onComplete });
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader className={`${categoryInfo[milestone.categoryId]?.color || "bg-gray-100"}`}>
        <div className="flex justify-between items-center">
          <CardTitle>{milestone.title}</CardTitle>
          <span className="text-3xl">{milestone.badgeEmoji}</span>
        </div>
        <CardDescription>{categoryInfo[milestone.categoryId]?.name || milestone.categoryId}</CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="mb-2">{milestone.description}</p>
        <p className="text-sm text-muted-foreground">
          {milestone.weekStart}-{milestone.weekEnd}주
        </p>
      </CardContent>
      <CardFooter>
        <Button className="w-full" onClick={handleDialogOpen}>완료 표시하기</Button>
      </CardFooter>
    </Card>
  );
};

// Completed milestone card component
const CompletedMilestoneCard = ({ userMilestone }: { userMilestone: UserMilestone }) => {
  const { milestone } = userMilestone;
  const modal = useModalContext();

  const handleDetailsOpen = () => {
    modal.openModal('milestoneNoteDetail', { userMilestone });
  };

  return (
    <Card>
      <CardHeader className={`${categoryInfo[milestone.categoryId]?.color || "bg-gray-100"}`}>
        <div className="flex justify-between items-center">
          <CardTitle>{milestone.title}</CardTitle>
          <span className="text-3xl">{milestone.badgeEmoji}</span>
        </div>
        <CardDescription>
          {format(new Date(userMilestone.completedAt), "PPP")}에 완료됨
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        <p>{milestone.encouragementMessage}</p>

        {userMilestone.notes && (
          <Button variant="link" className="pl-0 mt-2" onClick={handleDetailsOpen}>
            내 메모 보기
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

// Progress overview component
const ProgressOverview = ({ stats }: { stats: AchievementStats }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between items-end">
          <h3 className="text-xl font-semibold">전체 진행 상황</h3>
          <span className="text-muted-foreground">{Math.round(stats.completionRate)}% 완료</span>
        </div>
        <Progress value={stats.completionRate} className="h-2" />
        <p className="text-sm text-muted-foreground">
          {stats.totalAvailable}개 중 {stats.totalCompleted}개의 마일스톤 완료
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {Object.entries(stats.categories).map(([category, data]) => (
          <Card key={category}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                {categoryInfo[category]?.icon && React.createElement(categoryInfo[category].icon, { className: "h-4 w-4" })}
                {categoryInfo[category]?.name || category}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{data.total}개 중 {data.completed}개</span>
                  <span>{Math.round(data.percent)}%</span>
                </div>
                <Progress value={data.percent} className="h-1.5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

// 파일 업로드 컴포넌트
const FileUploadSection = ({
  files,
  onFilesChange
}: {
  files: File[];
  onFilesChange: (files: File[]) => void;
}) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter(file => {
      const maxSize = 10 * 1024 * 1024; // 10MB
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

      if (file.size > maxSize) {
        alert(`${file.name}: 파일 크기가 10MB를 초과합니다.`);
        return false;
      }

      if (!allowedTypes.includes(file.type)) {
        alert(`${file.name}: 지원하지 않는 파일 형식입니다.`);
        return false;
      }

      return true;
    });

    onFilesChange([...files, ...validFiles]);
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <Label htmlFor="file-upload">첨부파일 (선택사항)</Label>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <div className="space-y-2">
          <p className="text-sm text-gray-600">
            파일을 여기로 드래그하거나 클릭하여 선택하세요
          </p>
          <p className="text-xs text-gray-500">
            이미지(JPG, PNG, GIF), PDF, 텍스트, 워드 문서 지원 (최대 10MB)
          </p>
        </div>
        <Input
          id="file-upload"
          type="file"
          multiple
          onChange={handleFileChange}
          className="mt-4"
          accept="image/*,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        />
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          <Label>선택된 파일 ({files.length}개)</Label>
          {files.map((file, index) => (
            <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
              <File className="h-4 w-4 text-gray-500" />
              <span className="flex-1 text-sm truncate">{file.name}</span>
              <span className="text-xs text-gray-500">
                {(file.size / 1024).toFixed(1)}KB
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeFile(index)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};



// 참여형 마일스톤 탭 컴포넌트
const CampaignMilestonesTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 참여형 마일스톤 목록 조회
  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['/api/milestones/campaigns'],
    queryFn: async () => {
      const response = await fetch('/api/milestones/campaigns');
      if (!response.ok) throw new Error('참여형 마일스톤을 불러올 수 없습니다');
      return response.json();
    }
  });

  // 내 신청 내역 조회
  const { data: userApplications } = useQuery({
    queryKey: ['/api/milestones/applications'],
    queryFn: async () => {
      const response = await fetch('/api/milestones/applications');
      if (!response.ok) throw new Error('신청 내역을 불러올 수 없습니다');
      const data = await response.json();
      console.log('참여형 마일스톤 userApplications API 응답:', data);
      console.log('배열인가?', Array.isArray(data));
      return data;
    }
  });

  // 신청하기 mutation
  const applyMutation = useMutation({
    mutationFn: async ({ milestoneId, applicationData, files }: { milestoneId: string; applicationData?: string; files?: File[] }) => {
      // 먼저 마일스톤 신청을 생성
      const response = await fetch('/api/milestones/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId, applicationData })
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || '신청 중 오류가 발생했습니다');
      }

      const applicationResult = await response.json();

      // 파일이 있으면 순차적으로 업로드
      if (files && files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('description', `${file.name} - 마일스톤 신청 첨부`);

          const fileResponse = await fetch(`/api/milestone-applications/${applicationResult.id}/files`, {
            method: 'POST',
            body: formData
          });

          if (!fileResponse.ok) {
            console.warn(`파일 업로드 실패: ${file.name}`);
          }
        }
      }

      return applicationResult;
    },
    onSuccess: () => {
      toast({
        title: "신청 완료",
        description: "참여형 마일스톤 신청이 완료되었습니다. 관리자 승인을 기다려주세요.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/milestones/applications'] });
    },
    onError: (error: Error) => {
      toast({
        title: "신청 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleApply = (milestoneId: string, applicationData?: string, files?: File[]) => {
    applyMutation.mutate({ milestoneId, applicationData, files });
  };

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="mx-auto h-12 w-12 text-muted-foreground flex items-center justify-center rounded-full bg-muted">
          <Users className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">로딩 중...</h3>
        <p className="mt-1 text-muted-foreground">참여형 마일스톤을 불러오고 있습니다.</p>
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="mx-auto h-12 w-12 text-muted-foreground flex items-center justify-center rounded-full bg-muted">
          <Users className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">참여형 마일스톤 없음</h3>
        <p className="mt-1 text-muted-foreground">
          현재 참여 가능한 캠페인이 없습니다. 나중에 다시 확인해주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">참여형 마일스톤</h2>
          <p className="text-muted-foreground">병원에서 진행하는 특별한 캠페인에 참여하세요</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
        {campaigns.map((campaign: CampaignMilestone) => {
          // 이 마일스톤에 대한 사용자의 신청 내역 찾기
          const userApplication = userApplications?.find((app: any) =>
            String(app.milestoneId) === String(campaign.milestoneId)
          );



          return (
            <CampaignMilestoneCard
              key={campaign.id}
              milestone={campaign}
              onApply={handleApply}
              userApplication={userApplication}
            />
          );
        })}
      </div>
    </div>
  );
};

// 내 신청 현황 탭 컴포넌트
const MyApplicationsTab = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 내 신청 내역 조회
  const { data: applications, isLoading } = useQuery({
    queryKey: ['/api/milestones/applications'],
    queryFn: async () => {
      const response = await fetch('/api/milestones/applications');
      if (!response.ok) throw new Error('신청 내역을 불러올 수 없습니다');
      const data = await response.json();
      console.log('내 신청내역 탭 API 응답:', data);
      console.log('배열인가?', Array.isArray(data));
      return data;
    }
  });

  // 신청 취소 mutation
  const cancelMutation = useMutation({
    mutationFn: async (applicationId: number) => {
      const response = await fetch(`/api/milestones/applications/${applicationId}/cancel`, {
        method: 'PATCH'
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || '취소 중 오류가 발생했습니다');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "취소 완료",
        description: "신청이 취소되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/milestones/applications'] });
    },
    onError: (error: Error) => {
      toast({
        title: "취소 실패",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">심사 중</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-50 text-green-700">승인됨</Badge>;
      case "rejected":
        return <Badge variant="destructive">보류됨</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700">취소됨</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="text-center p-8">
        <div className="mx-auto h-12 w-12 text-muted-foreground flex items-center justify-center rounded-full bg-muted">
          <Gift className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">로딩 중...</h3>
        <p className="mt-1 text-muted-foreground">신청 내역을 불러오고 있습니다.</p>
      </div>
    );
  }

  if (!applications || !Array.isArray(applications) || applications.length === 0) {
    return (
      <div className="text-center p-8">
        <div className="mx-auto h-12 w-12 text-muted-foreground flex items-center justify-center rounded-full bg-muted">
          <Gift className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">신청 내역 없음</h3>
        <p className="mt-1 text-muted-foreground">
          아직 참여형 마일스톤에 신청한 내역이 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">내 신청 현황</h2>
          <p className="text-muted-foreground">참여형 마일스톤 신청 내역을 확인하세요</p>
        </div>
      </div>

      <div className="space-y-4">
        {applications.map((application: MilestoneApplication) => (
          <Card key={application.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {application.milestone?.title || `마일스톤 ID: ${application.milestoneId}`}
                  </CardTitle>
                  <CardDescription>
                    신청일: {format(new Date(application.appliedAt), 'yyyy.MM.dd HH:mm')}
                  </CardDescription>
                </div>
                {getStatusBadge(application.status)}
              </div>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                {application.milestone?.hospital?.name && (
                  <div className="text-sm text-muted-foreground">
                    🏥 {application.milestone.hospital.name}
                  </div>
                )}

                {application.applicationData && (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <h5 className="text-sm font-medium mb-1">신청 메시지</h5>
                    <p className="text-sm text-gray-600">
                      {typeof application.applicationData === 'string'
                        ? application.applicationData
                        : JSON.stringify(application.applicationData, null, 2)
                      }
                    </p>
                  </div>
                )}

                {application.notes && (
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <h5 className="text-sm font-medium mb-1">관리자 메모</h5>
                    <p className="text-sm text-blue-600">{application.notes}</p>
                  </div>
                )}

                {application.processedAt && (
                  <div className="text-sm text-muted-foreground">
                    검토 완료: {format(new Date(application.processedAt), 'yyyy.MM.dd HH:mm')}
                  </div>
                )}
              </div>
            </CardContent>

            {application.status === 'pending' && (
              <CardFooter>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={cancelMutation.isPending}
                    >
                      신청 취소
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>신청 취소 확인</AlertDialogTitle>
                      <AlertDialogDescription>
                        신청을 취소하시면 같은 캠페인에 다시 신청하실 수 없습니다.
                        <br />
                        정말로 신청을 취소하시겠습니까?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>아니오</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => cancelMutation.mutate(application.id)}
                        disabled={cancelMutation.isPending}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        {cancelMutation.isPending ? "취소 중..." : "네, 취소합니다"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
};

export default function MilestonesPage() {
  const { toast } = useToast();
  const modal = useModalContext();
  const [profile, setProfile] = useState<PregnancyProfile | null>(null);
  const [availableMilestones, setAvailableMilestones] = useState<Milestone[]>([]);
  const [completedMilestones, setCompletedMilestones] = useState<UserMilestone[]>([]);
  const [allMilestones, setAllMilestones] = useState<Record<string, Milestone[]>>({});
  const [stats, setStats] = useState<AchievementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("available");
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [userApplications, setUserApplications] = useState<any[]>([]);

  // Fetch user's pregnancy profile
  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/pregnancy-profile');
      const data = await response.json();

      if (data.error) {
        setShowProfileSetup(true);
        return null;
      }

      setProfile(data);
      return data;
    } catch (error) {
      console.error('Error fetching profile:', error);
      setShowProfileSetup(true);
      return null;
    }
  };

  // Save pregnancy profile
  const saveProfile = async (profileData: Partial<PregnancyProfile>) => {
    try {
      console.log("저장할 프로필 데이터:", profileData);
      const response = await fetch('/api/pregnancy-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(profileData),
        credentials: 'include'
      });

      const data = await response.json();
      console.log("서버 응답:", data, "상태 코드:", response.status);

      if (response.ok) {
        setProfile(data);
        setShowProfileSetup(false);
        toast({
          title: "프로필 업데이트됨",
          description: "임신 프로필이 성공적으로 저장되었습니다.",
        });

        // Refresh milestones
        fetchAvailableMilestones();
      } else {
        console.error("프로필 저장 오류:", data);
        toast({
          title: "오류",
          description: data.error || "프로필 저장에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast({
        title: "오류",
        description: "프로필 저장에 실패했습니다",
        variant: "destructive",
      });
    }
  };

  // Fetch available milestones
  const fetchAvailableMilestones = async () => {
    try {
      const response = await fetch('/api/milestones/available');
      const data = await response.json();
      setAvailableMilestones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching available milestones:', error);
      setAvailableMilestones([]);
    }
  };

  // Fetch completed milestones
  const fetchCompletedMilestones = async () => {
    try {
      const response = await fetch('/api/milestones/completed');
      const data = await response.json();
      setCompletedMilestones(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching completed milestones:', error);
      setCompletedMilestones([]);
    }
  };

  // Fetch all milestones
  const fetchAllMilestones = async () => {
    try {
      const response = await fetch('/api/milestones');
      const data = await response.json();

      // API가 배열을 반환하므로 카테고리별로 그룹화 처리
      if (Array.isArray(data)) {
        const groupedByCategory = data.reduce((acc, milestone) => {
          const categoryId = milestone.categoryId || 'uncategorized';
          if (!acc[categoryId]) {
            acc[categoryId] = [];
          }
          acc[categoryId].push(milestone);
          return acc;
        }, {} as Record<string, Milestone[]>);

        setAllMilestones(groupedByCategory);
      } else {
        console.error('Expected array but got:', typeof data);
        setAllMilestones({});
      }
    } catch (error) {
      console.error('Error fetching all milestones:', error);
      setAllMilestones({});
    }
  };

  // Fetch achievement stats
  const fetchStats = async () => {
    try {
      const response = await fetch('/api/milestones/stats');
      const data = await response.json();
      setStats(data && typeof data === 'object' ? data : null);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats(null);
    }
  };

  // Fetch user applications
  const fetchUserApplications = async () => {
    try {
      const response = await fetch('/api/milestones/applications');
      if (!response.ok) return;
      const data = await response.json();
      setUserApplications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching user applications:', error);
      setUserApplications([]);
    }
  };

  // Complete a milestone
  const completeMilestone = async (milestoneId: string, notes?: string) => {
    try {
      const response = await fetch(`/api/milestones/${milestoneId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ notes }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "마일스톤 완료!",
          description: "이 마일스톤에 도달한 것을 축하합니다!",
        });

        // Refresh milestones and stats
        fetchAvailableMilestones();
        fetchCompletedMilestones();
        fetchStats();
      } else {
        toast({
          title: "오류",
          description: data.error || "마일스톤 완료에 실패했습니다",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error completing milestone:', error);
      toast({
        title: "오류",
        description: "마일스톤 완료에 실패했습니다",
        variant: "destructive",
      });
    }
  };

  // Apply to campaign milestone
  const handleApply = async (milestoneId: string, applicationData?: string, files?: File[]) => {
    try {
      // 먼저 마일스톤 신청을 생성
      const response = await fetch('/api/milestones/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ milestoneId, applicationData })
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || '신청 중 오류가 발생했습니다');
      }

      const applicationResult = await response.json();

      // 파일이 있으면 순차적으로 업로드
      if (files && files.length > 0) {
        for (const file of files) {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('description', `${file.name} - 마일스톤 신청 첨부`);

          const fileResponse = await fetch(`/api/milestone-applications/${applicationResult.id}/files`, {
            method: 'POST',
            body: formData
          });

          if (!fileResponse.ok) {
            console.warn(`파일 업로드 실패: ${file.name}`);
          }
        }
      }

      toast({
        title: "신청 완료",
        description: "참여형 마일스톤 신청이 완료되었습니다. 관리자 승인을 기다려주세요.",
      });

      // Refresh data
      fetchUserApplications();
      fetchAvailableMilestones();

      return applicationResult;
    } catch (error: any) {
      toast({
        title: "신청 실패",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  };

  // Initialize data
  useEffect(() => {
    const initData = async () => {
      setLoading(true);

      const profile = await fetchProfile();

      if (profile) {
        await Promise.all([
          fetchAvailableMilestones(),
          fetchCompletedMilestones(),
          fetchAllMilestones(),
          fetchStats(),
          fetchUserApplications()
        ]);
      }

      setLoading(false);
    };

    initData();
  }, []);

  // If still loading or profile setup needed, show appropriate UI
  if (loading) {
    return (
      <div className="container mx-auto p-4 flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4">마일스톤 데이터 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (showProfileSetup || !profile) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <ProfileSetup onSave={saveProfile} profile={profile || undefined} />
      </div>
    );
  }

  // Render main milestones page
  return (
    <div className="container mx-auto p-4 py-8 space-y-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">임신 마일스톤</h1>
          <p className="text-muted-foreground">맞춤형 혜택과 문화경험을 제공합니다</p>
        </div>

        <Card className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="p-3 rounded-full bg-primary/10">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-medium">임신 {profile.currentWeek}주 / 40주</p>
            {profile.dueDate && (
              <p className="text-sm text-muted-foreground">
                출산 예정일까지 {calculateWeeksRemaining(profile.dueDate)}주 남음
              </p>
            )}
          </div>

          <Button variant="outline" size="sm" className="ml-auto" onClick={() => modal.openModal('milestoneProfileSetup', { profile, onSave: saveProfile, ProfileSetupComponent: ProfileSetup })}>
            업데이트
          </Button>
        </Card>
      </div>
      {stats && <ProgressOverview stats={stats} />}
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="available">
            가능한 마일스톤
          </TabsTrigger>
          <TabsTrigger value="completed">
            완료된 마일스톤
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <Users className="h-4 w-4 mr-2" />
            참여형 마일스톤
          </TabsTrigger>
          <TabsTrigger value="applications">
            <Gift className="h-4 w-4 mr-2" />
            내 신청 현황
          </TabsTrigger>
          <TabsTrigger value="all">
            모든 마일스톤
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-4">
          {availableMilestones.length === 0 ? (
            <div className="text-center p-8">
              <div className="mx-auto h-12 w-12 text-muted-foreground flex items-center justify-center rounded-full bg-muted">
                <Trophy className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">가능한 마일스톤 없음</h3>
              <p className="mt-1 text-muted-foreground">현재 신청 시스템 게빌 중입니다. 더 편리하고 더 풍성한 고객혜택을 준비하고 있습니다. 곧 찾아뵙겠습니다.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* 정보형 마일스톤 */}
              {availableMilestones.filter(m => !m.type || m.type === 'info').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">정보형 마일스톤</h3>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {availableMilestones
                      .filter(milestone => !milestone.type || milestone.type === 'info')
                      .map((milestone) => (
                        <MilestoneCard
                          key={milestone.milestoneId}
                          milestone={milestone}
                          onComplete={completeMilestone}
                        />
                      ))}
                  </div>
                </div>
              )}

              {/* 참여형 마일스톤 */}
              {availableMilestones.filter(m => m.type === 'campaign').length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-4">참여형 마일스톤</h3>
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-1">
                    {availableMilestones
                      .filter(milestone => milestone.type === 'campaign')
                      .map((milestone) => {
                        // 참여형 마일스톤을 CampaignMilestone 타입으로 변환
                        const campaignMilestone: CampaignMilestone = {
                          ...milestone,
                          content: milestone.description,
                          type: 'campaign',
                          headerImageUrl: milestone.badgeImageUrl,
                          campaignStartDate: milestone.campaignStartDate || new Date().toISOString(),
                          campaignEndDate: milestone.campaignEndDate || new Date().toISOString(),
                          selectionStartDate: milestone.selectionStartDate || new Date().toISOString(),
                          selectionEndDate: milestone.selectionEndDate || new Date().toISOString(),
                          hospitalId: milestone.hospitalId || 1,
                          createdAt: (milestone as any).createdAt || new Date().toISOString(),
                          updatedAt: (milestone as any).updatedAt || new Date().toISOString()
                        };

                        // 사용자 신청 내역 찾기
                        const userApplication = userApplications?.find((app: any) =>
                          String(app.milestoneId) === String(milestone.milestoneId)
                        );

                        return (
                          <CampaignMilestoneCard
                            key={milestone.milestoneId}
                            milestone={campaignMilestone}
                            onApply={handleApply}
                            userApplication={userApplication}
                          />
                        );
                      })}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedMilestones.length === 0 ? (
            <div className="text-center p-8">
              <div className="mx-auto h-12 w-12 text-muted-foreground flex items-center justify-center rounded-full bg-muted">
                <Medal className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">아직 완료된 마일스톤이 없습니다</h3>
              <p className="mt-1 text-muted-foreground">
                가능한 마일스톤을 완료하여 여기에서 확인하세요!
              </p>
              <Button
                className="mt-4"
                variant="outline"
                onClick={() => setActiveTab("available")}
              >
                가능한 마일스톤 보기
              </Button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {completedMilestones.map((userMilestone) => (
                <CompletedMilestoneCard
                  key={userMilestone.id}
                  userMilestone={userMilestone}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-6">
          <CampaignMilestonesTab />
        </TabsContent>

        <TabsContent value="applications" className="space-y-6">
          <MyApplicationsTab />
        </TabsContent>

        <TabsContent value="all" className="space-y-6">
          {Object.keys(allMilestones).length === 0 ? (
            <div className="text-center p-8">
              <div className="mx-auto h-12 w-12 text-muted-foreground flex items-center justify-center rounded-full bg-muted">
                <Milestone className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">사용 가능한 마일스톤 없음</h3>
              <p className="mt-1 text-muted-foreground">
                나중에 다시 확인하여 임신 마일스톤을 확인하세요.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(allMilestones).map(([category, milestones]) => (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-2">
                    {categoryInfo[category]?.icon && (
                      React.createElement(categoryInfo[category].icon, { className: "h-5 w-5" })
                    )}
                    <h3 className="text-xl font-semibold">
                      {categoryInfo[category]?.name || category}
                    </h3>
                  </div>
                  <p className="text-muted-foreground">
                    {categoryInfo[category]?.description || "임신 마일스톤 추적하기"}
                  </p>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {milestones.map((milestone) => {
                      const isCompleted = completedMilestones.some(
                        (cm) => cm.milestoneId === milestone.milestoneId
                      );
                      const userMilestone = completedMilestones.find(
                        (cm) => cm.milestoneId === milestone.milestoneId
                      );

                      if (isCompleted && userMilestone) {
                        return (
                          <CompletedMilestoneCard
                            key={milestone.milestoneId}
                            userMilestone={userMilestone}
                          />
                        );
                      }

                      return (
                        <Card key={milestone.milestoneId} className="overflow-hidden">
                          <CardHeader className={`${categoryInfo[milestone.categoryId]?.color || "bg-gray-100"}`}>
                            <div className="flex justify-between items-center">
                              <CardTitle>{milestone.title}</CardTitle>
                              <span className="text-3xl">{milestone.badgeEmoji}</span>
                            </div>
                            <CardDescription>
                              {milestone.weekStart}-{milestone.weekEnd}주
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="pt-4">
                            <p>{milestone.description}</p>

                            {profile && milestone.weekStart > profile.currentWeek && (
                              <Badge variant="outline" className="mt-2">
                                {milestone.weekStart > profile.currentWeek ?
                                  `${milestone.weekStart}주차에 잠금 해제` :
                                  "지금 가능"}
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}