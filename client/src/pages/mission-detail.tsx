import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { canAccessHospitalPage } from "@/lib/auth-utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { sanitizeHtml } from "@/lib/utils";
import { generatePdfBlob, generateImageBlob, generateAllImagesBlobs } from "@/services/exportService";
import { formatShortDate, formatEventDate, formatDateTime, formatSimpleDate, getPeriodStatus, parseKoreanDate, getKoreanDateParts } from '@/lib/dateUtils';
import { MissionBadges } from '@/lib/missionUtils';
import { useModal } from '@/hooks/useModal';
import { useModalHistory } from '@/hooks/useModalHistory';
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Target,
  Calendar,
  Building2,
  ArrowLeft,
  Loader2,
  Upload,
  Link as LinkIcon,
  FileText,
  Star,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Image as ImageIcon,
  X,
  Lock,
  ChevronRight,
  FolderTree,
  Circle,
  Palette,
  Eye,
  EyeOff,
  Users,
  Gift,
  MapPin,
  Info,
  ClipboardCheck,
  Send,
  UserCheck,
  MessageSquare,
  Search,
  CheckSquare,
  MessageCircle,
} from "lucide-react";
import { useLocation } from "wouter";

interface SubMission {
  id: number;
  themeMissionId: number;
  title: string;
  description?: string;
  submissionType?: string;
  submissionTypes?: string[];
  requireReview: boolean;
  order: number;
  isActive: boolean;
  partyTemplateProjectId?: number;
  partyMaxPages?: number;
  actionTypeId?: number;
  actionType?: {
    id: number;
    name: string;
  };
  attendanceType?: string;
  attendancePassword?: string;
  unlockAfterPrevious?: boolean;
  sequentialLevel?: number;
  startDate?: string;
  endDate?: string;
  submission?: {
    id: number;
    submissionData: any;
    status: string;
    isLocked: boolean;
    submittedAt: string;
    reviewNotes?: string;
  } | null;
}

const getSubmissionTypes = (subMission: SubMission): string[] => {
  if (subMission.submissionTypes && subMission.submissionTypes.length > 0) {
    return subMission.submissionTypes;
  }
  if (subMission.submissionType) {
    return [subMission.submissionType];
  }
  return ['text'];
};

const getSubmissionTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    file: '파일 업로드',
    link: '링크',
    text: '텍스트',
    review: '리뷰',
    image: '이미지',
    studio_submit: '제작소 제출',
  };
  return labels[type] || type;
};

const getSubmissionTypeIcon = (type: string) => {
  const icons = {
    file: Upload,
    link: LinkIcon,
    text: FileText,
    review: Star,
    image: ImageIcon,
    studio_submit: Palette,
  };
  return icons[type as keyof typeof icons] || FileText;
};

const getActionTypeIcon = (actionTypeName?: string) => {
  const icons: Record<string, any> = {
    '신청': ClipboardCheck,
    '제출': Send,
    '출석': UserCheck,
    '리뷰': MessageSquare,
  };
  return icons[actionTypeName || ''] || null;
};

const getActionTypeBadgeStyle = (actionTypeName?: string) => {
  const styles: Record<string, string> = {
    '신청': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    '제출': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    '출석': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    '리뷰': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  };
  return styles[actionTypeName || ''] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
};

const getActionTypeTabIcon = (actionTypeName?: string) => {
  const icons: Record<string, any> = {
    '신청': MapPin,
    '제출': Search,
    '출석': CheckSquare,
    '리뷰': MessageCircle,
    'apply': MapPin,
    'submit': Search,
    'attendance': CheckSquare,
    'review': MessageCircle,
  };
  return icons[actionTypeName || ''] || Circle;
};

const getActionTypeTabLabel = (actionTypeName?: string) => {
  const labels: Record<string, string> = {
    '신청': '신청하기',
    '제출': '제출하기',
    '출석': '출석인증',
    '리뷰': '리뷰작성',
    'apply': '신청하기',
    'submit': '제출하기',
    'attendance': '출석인증',
    'review': '리뷰작성',
  };
  return labels[actionTypeName || ''] || actionTypeName || '미션';
};


interface ChildMission {
  id: number;
  missionId: string;
  title: string;
  order: number;
  depth: number; // 미션의 실제 깊이 (2차 = 2, 3차 = 3, ...)
  status: string;
  progressPercentage: number;
  completedSubMissions: number;
  totalSubMissions: number;
  isUnlocked: boolean;
  isApproved: boolean;
}

interface ParentMission {
  id: number;
  missionId: string;
  title: string;
}

interface MissionTreeNode {
  id: number;
  missionId: string;
  title: string;
  depth: number;
  status: string;
  isUnlocked: boolean;
  children: MissionTreeNode[];
}

interface NoticeItem {
  title: string;
  content: string;
}

interface MissionDetail {
  id: number;
  missionId: string;
  title: string;
  description: string;
  categoryId?: string;
  headerImageUrl?: string;
  visibilityType: string;
  hospitalId?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  category?: {
    categoryId: string;
    name: string;
  };
  hospital?: {
    id: number;
    name: string;
  };
  subMissions: SubMission[];
  progressPercentage: number;
  completedSubMissions: number;
  totalSubMissions: number;
  isApprovedForChildAccess?: boolean;
  childMissions?: ChildMission[];
  parentMission?: ParentMission | null;
  rootMission?: ParentMission | null;
  missionTree?: MissionTreeNode | null;
  totalMissionCount?: number;
  isRootMission?: boolean;
  eventDate?: string;
  eventEndTime?: string;
  capacity?: number;
  isFirstCome?: boolean;
  noticeItems?: NoticeItem[];
  giftImageUrl?: string;
  giftDescription?: string;
  venueImageUrl?: string;
  currentApplicants?: number;
  waitlistCount?: number;
}

export default function MissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const modal = useModal();
  const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);

  const [currentSubMissionId, setCurrentSubMissionId] = useState<number | null>(null);
  const [selectedSubMission, setSelectedSubMission] = useState<SubMission | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isLoadingGallery, setIsLoadingGallery] = useState(false);



  // 세부미션 모달에 히스토리 API 연동 (뒤로가기 시 모달만 닫힘)
  const closeSubMissionModal = useCallback(() => {
    // 모달 닫을 때 draft sessionStorage 정리
    if (selectedSubMission) {
      const draftKey = `submission_draft_${missionId}_${selectedSubMission.id}`;
      sessionStorage.removeItem(draftKey);
      console.log('[CLEANUP] 모달 닫힘 - draft 정리:', draftKey);
    }

    // URL 쿼리 파라미터 정리 (자동 재오픈 방지)
    const url = new URL(window.location.href);
    url.searchParams.delete('openSubMission');
    url.searchParams.delete('autoSelectProject');
    window.history.replaceState({}, '', url.toString());

    setSelectedSubMission(null);
  }, [selectedSubMission, missionId]);

  const { closeWithHistory: closeSubMissionWithHistory } = useModalHistory({
    isOpen: !!selectedSubMission,
    onClose: closeSubMissionModal,
    modalId: 'sub-mission-detail'
  });

  const { data: mission, isLoading, error } = useQuery<MissionDetail>({
    queryKey: ['/api/missions', missionId],
    queryFn: async () => {
      const response = await apiRequest(`/api/missions/${missionId}`);
      const data = await response.json();
      if (!response.ok) {
        throw { status: response.status, ...data };
      }
      return data;
    },
    enabled: !!missionId,
    retry: false
  });

  // URL 쿼리 파라미터 처리 (자동 모달 오픈)
  useEffect(() => {
    if (mission?.subMissions) {
      const params = new URLSearchParams(window.location.search);
      const openSubMissionId = params.get('openSubMission');

      if (openSubMissionId) {
        const subId = parseInt(openSubMissionId);
        const targetSubMission = mission.subMissions.find(s => s.id === subId);

        if (targetSubMission) {
          setSelectedSubMission(targetSubMission);
        }
      }
    }
  }, [mission?.subMissions]);




  const submitMutation = useMutation({
    mutationFn: async ({
      subMissionId,
      submissionData,
    }: {
      subMissionId: number;
      submissionData: any;
    }) => {
      return apiRequest(
        `/api/missions/${missionId}/sub-missions/${subMissionId}/submit`,
        {
          method: "POST",
          body: JSON.stringify(submissionData)
        }
      );
    },
    onSuccess: async () => {
      console.log('[SUBMIT] ===== 제출 성공 =====');
      console.log('[SUBMIT] 캐시 무효화 시작...');

      // 캐시 무효화 (썸네일 갱신을 위해)
      await queryClient.invalidateQueries({ queryKey: ['/api/missions', missionId] });
      await queryClient.invalidateQueries({ queryKey: ['/api/missions'] });

      console.log('[SUBMIT] 캐시 무효화 완료');

      // 새로 불러온 데이터 확인
      const newData = queryClient.getQueryData(['/api/missions', missionId]);
      console.log('[SUBMIT] 갱신된 미션 데이터:', newData);

      toast({
        title: "제출 완료",
        description: "세부 미션이 성공적으로 제출되었습니다.",
      });

      // 모달 닫기 (캐시 갱신 후)
      closeSubMissionWithHistory();

      setExpandedSubmission(null);
    },
    onError: (error: any) => {
      toast({
        title: "제출 실패",
        description: error.message || "세부 미션 제출 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const verifyAttendanceMutation = useMutation({
    mutationFn: async ({
      subMissionId,
      password,
    }: {
      subMissionId: number;
      password: string;
    }) => {
      const response = await apiRequest(
        `/api/sub-missions/${subMissionId}/verify-attendance`,
        {
          method: "POST",
          body: JSON.stringify({ password })
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "출석 인증 실패");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/missions', missionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/missions'] });
      toast({
        title: "출석 확인 완료",
        description: "출석이 확인되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "출석 인증 실패",
        description: error.message || "출석 인증 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const cancelApplicationMutation = useMutation({
    mutationFn: async ({ subMissionId }: { subMissionId: number }) => {
      return await apiRequest(`/api/missions/${missionId}/sub-missions/${subMissionId}/cancel-application`, {
        method: 'POST'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/missions', missionId] });
      toast({
        title: "신청 취소 완료",
        description: "신청이 취소되었습니다. 다시 신청하실 수 있습니다."
      });
      setShowCancelConfirm(false);
      closeSubMissionModal();
    },
    onError: (error: any) => {
      toast({
        title: "취소 실패",
        description: error?.message || "신청 취소에 실패했습니다",
        variant: "destructive"
      });
    }
  });

  // dynamicTabs 계산 (useMemo 제거됨)
  const dynamicTabs = (() => {
    if (!mission?.subMissions) return [];

    const actionTypeMap = new Map<number, {
      id: number;
      name: string;
      subMission: SubMission
    }>();

    mission.subMissions
      .filter(sub => sub.isActive && sub.actionType)
      .sort((a, b) => a.order - b.order)
      .forEach(sub => {
        if (sub.actionType && !actionTypeMap.has(sub.actionType.id)) {
          actionTypeMap.set(sub.actionType.id, {
            id: sub.actionType.id,
            name: sub.actionType.name,
            subMission: sub
          });
        }
      });

    return Array.from(actionTypeMap.values());
  })();

  // 신청 액션타입 세부미션 찾기 (모집일정 표시용)
  const applicationSubMission = (() => {
    if (!mission?.subMissions) return null;
    return mission.subMissions.find(sub =>
      sub.isActive && sub.actionType?.name === '신청'
    ) || null;
  })();


  const getMissionStatusBadge = () => {
    if (!mission) return null;

    const periodStatus = getPeriodStatus(mission.startDate, mission.endDate);
    const userStatus = (mission as any).userProgress?.status ||
      (mission.completedSubMissions > 0 ? 'in_progress' : 'not_started');

    if (periodStatus === 'upcoming') {
      return <Badge className="bg-red-500 text-white hover:bg-red-600">준비 중</Badge>;
    }

    if (periodStatus === 'closed') {
      return <Badge variant="destructive">마감</Badge>;
    }

    if (userStatus === 'in_progress') {
      return <Badge className="bg-blue-500 text-white hover:bg-blue-600">진행 중</Badge>;
    }

    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      not_started: { label: "형식 모집", variant: "default" },
      submitted: { label: "제출 완료", variant: "secondary" },
      approved: { label: "승인됨", variant: "default" },
      rejected: { label: "보류됨", variant: "destructive" }
    };

    const config = statusConfig[userStatus || 'not_started'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getSubMissionStatusBadge = (status?: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
      not_started: { label: "시작 전", variant: "outline", icon: Clock },
      in_progress: { label: "진행 중", variant: "default", icon: Clock },
      submitted: { label: "검토 중", variant: "secondary", icon: AlertCircle },
      approved: { label: "승인됨", variant: "default", icon: CheckCircle },
      rejected: { label: "보류됨", variant: "destructive", icon: XCircle },
      pending: { label: "검토 대기", variant: "secondary", icon: Clock },
      waitlist: { label: "대기 중", variant: "secondary", icon: Clock },
      cancelled: { label: "취소됨", variant: "outline", icon: XCircle },
    };

    const config = statusConfig[status || 'not_started'] || statusConfig.not_started;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };


  const getStatusIcon = (status: string, isUnlocked: boolean) => {
    if (!isUnlocked) return <Lock className="h-4 w-4 text-gray-400" />;
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'in_progress':
      case 'submitted':
        return <Circle className="h-4 w-4 text-blue-500 fill-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-300" />;
    }
  };

  const getStatusLabel = (status: string, isUnlocked: boolean, depth: number, hasSiblings: boolean) => {
    if (!isUnlocked) {
      return depth >= 3 && hasSiblings
        ? `모든 ${depth - 1}차 완료 후 열림`
        : '이전 미션 승인 후 열림';
    }
    switch (status) {
      case 'approved':
        return '승인완료';
      case 'submitted':
        return '검토중';
      case 'in_progress':
        return '진행중';
      default:
        return '미시작';
    }
  };

  const renderMissionTree = (node: MissionTreeNode, isLast: boolean = true, prefix: string = '') => {
    const hasSiblings = mission?.missionTree?.children && mission.missionTree.children.length > 1;

    return (
      <div key={node.id} className="text-sm">
        <div className="flex items-center gap-2 py-1">
          <span className="text-gray-400 font-mono whitespace-pre">{prefix}{isLast ? '└─' : '├─'}</span>
          {getStatusIcon(node.status, node.isUnlocked)}
          <button
            onClick={() => {
              if (node.isUnlocked) {
                navigate(`/missions/${node.missionId}`);
              } else {
                toast({
                  title: "접근 불가",
                  description: getStatusLabel(node.status, node.isUnlocked, node.depth, hasSiblings || false),
                  variant: "destructive",
                });
              }
            }}
            className={`truncate max-w-[200px] text-left ${node.isUnlocked
              ? 'hover:text-purple-600 cursor-pointer'
              : 'text-gray-400 cursor-not-allowed'
              }`}
            title={node.title}
          >
            {node.title}
          </button>
          <Badge variant="outline" className="text-xs shrink-0">
            {node.depth}차
          </Badge>
          <span className={`text-xs shrink-0 ${node.status === 'approved' ? 'text-green-600' :
            !node.isUnlocked ? 'text-gray-400' : 'text-muted-foreground'
            }`}>
            {getStatusLabel(node.status, node.isUnlocked, node.depth, hasSiblings || false)}
          </span>
        </div>
        {node.children.length > 0 && (
          <div className="ml-2">
            {node.children.map((child, index) =>
              renderMissionTree(child, index === node.children.length - 1, prefix + (isLast ? '   ' : '│  '))
            )}
          </div>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="w-full px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !mission) {
    const errorData = error as any;
    const isLocked = errorData?.status === 403;
    const errorMessage = errorData?.message || (error instanceof Error ? error.message : "미션 정보를 불러오는 중 오류가 발생했습니다.");
    const parentMissionId = errorData?.parentMissionId;
    const requiredMissionId = errorData?.requiredMissionId;

    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="w-full px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              {isLocked ? (
                <Lock className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              ) : (
                <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              )}
              <h2 className="text-xl font-semibold mb-2">
                {isLocked ? "미션 접근 불가" : "미션을 찾을 수 없습니다"}
              </h2>
              <p className="text-muted-foreground mb-4">
                {errorMessage}
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                <Link href="/missions">
                  <Button variant="default">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    미션 목록으로
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }


  const getTabUnlockStatus = (tabIndex: number) => {
    const currentTab = dynamicTabs[tabIndex];
    if (!currentTab) return true;

    const currentLevel = currentTab.subMission.sequentialLevel;

    // sequentialLevel이 0이거나 설정되지 않은 경우: 항상 열림
    if (currentLevel === undefined || currentLevel === null || currentLevel === 0) {
      return true;
    }

    // sequentialLevel >= 1인 경우: 이전 등급의 모든 미션이 승인되어야 열림
    const allSubMissions = mission?.subMissions?.filter(sub => sub.isActive) || [];

    // 1부터 currentLevel-1까지의 모든 레벨에서 미션이 모두 승인되었는지 확인
    for (let level = 1; level < currentLevel; level++) {
      const subMissionsAtLevel = allSubMissions.filter(
        sub => sub.sequentialLevel === level
      );

      // 해당 레벨의 모든 미션이 승인되어야 함
      for (const sub of subMissionsAtLevel) {
        if (sub.submission?.status !== 'approved') {
          return false;
        }
      }
    }

    return true;
  };

  const hasGifts = !!(mission.giftImageUrl || mission.giftDescription);

  const handleTabClick = (subMission: SubMission) => {
    setSelectedSubMission(subMission);
  };

  const handleOpenGift = () => {
    modal.open('giftModal', {
      giftImageUrl: mission.giftImageUrl,
      giftDescription: mission.giftDescription
    });
  };

  // 갤러리 이미지 수동 로드
  const loadGalleryImages = async () => {
    try {
      setIsLoadingGallery(true);
      const response = await fetch('/api/gallery');
      if (!response.ok) throw new Error('갤러리 조회 실패');
      return await response.json();
    } catch (error) {
      console.error('Failed to load gallery images:', error);
      toast({ title: "오류", description: "갤러리 이미지를 불러올 수 없습니다", variant: "destructive" });
      return [];
    } finally {
      setIsLoadingGallery(false);
    }
  };

  const handleOpenGallery = async (subMissionId: number) => {
    setCurrentSubMissionId(subMissionId);

    // 모달 열기 전 데이터 먼저 로드
    const images = await loadGalleryImages();

    modal.open('galleryPicker', {
      images,
      isLoading: false, // 이미 로드 완료됨
      currentSubMissionId: subMissionId,
    });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="w-full px-4 py-6">
        {/* Back Buttons - 주제미션으로 버튼만 유지 (미션 목록 버튼은 상단 헤더로 이동) */}
        {mission.rootMission && !mission.isRootMission && (
          <div className="flex items-center gap-2 mb-4">
            <Link href={`/missions/${mission.rootMission.missionId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                주제 미션으로
              </Button>
            </Link>
          </div>
        )}

        {/* Header Area */}
        <div className="mb-6">
          <MissionBadges
            startDate={mission.startDate}
            endDate={mission.endDate}
            hasGift={hasGifts}
            className="mb-3"
          />
          <h1 className="text-2xl font-bold mb-2">{mission.title}</h1>
          <div
            className="text-sm text-muted-foreground"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(mission.description || '') }}
          />
        </div>

        {/* Info List - Simple one-line format */}
        <div className="bg-card rounded-lg p-4 mb-6 shadow-sm border border-border">
          <div className="space-y-3 text-sm">
            {mission.capacity && (
              <div className="flex items-start gap-6">
                <span className="text-muted-foreground min-w-[80px] shrink-0">모집인원</span>
                <span className="font-medium">
                  {mission.isFirstCome ? '선착순 ' : ''}
                  {mission.currentApplicants || 0} / {mission.capacity}명
                  {mission.isFirstCome && mission.waitlistCount && mission.waitlistCount > 0 && (
                    <span className="text-orange-500 ml-2">(대기 {mission.waitlistCount}명)</span>
                  )}
                </span>
              </div>
            )}
            {applicationSubMission && (applicationSubMission.startDate || applicationSubMission.endDate) && (
              <div className="flex items-start gap-6">
                <span className="text-muted-foreground min-w-[80px] shrink-0">모집일정</span>
                <span className="font-medium">
                  {formatShortDate(applicationSubMission.startDate)} ~ {formatShortDate(applicationSubMission.endDate)}
                </span>
              </div>
            )}
            {mission.eventDate && (
              <div className="flex items-start gap-6">
                <span className="text-muted-foreground min-w-[80px] shrink-0">행사일시</span>
                <span className="font-medium">
                  {formatEventDate(mission.eventDate, mission.eventEndTime)}
                </span>
              </div>
            )}
            {mission.noticeItems && mission.noticeItems.map((item, index) => (
              <div key={index} className="flex items-start gap-6">
                <span className="text-muted-foreground min-w-[80px] shrink-0">{item.title}</span>
                <span className="font-medium whitespace-pre-wrap">{item.content}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 관리자 전용 - 미션 검수 바로가기 */}
        {user && canAccessHospitalPage(user.memberType as any) && (
          <div className="bg-gradient-to-r from-purple-500/10 to-indigo-500/10 rounded-lg p-4 mb-6 border border-purple-500/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-purple-500" />
                <div>
                  <span className="text-sm font-medium">미션 검수 관리</span>
                  <p className="text-xs text-muted-foreground">제출된 미션을 검수하세요</p>
                </div>
              </div>
              <Button size="sm" onClick={() => navigate(`/admin/review/${missionId}`)}>
                검수 대기 →
              </Button>
            </div>
          </div>
        )}

        {/* Mission Tree (1차 미션에서만 표시) */}
        {mission.isRootMission && mission.missionTree && (mission.totalMissionCount ?? 1) > 1 && (
          <div className="bg-card rounded-lg p-4 mb-6 shadow-sm border border-border">
            <div className="flex items-center gap-2 mb-3">
              <FolderTree className="h-4 w-4 text-purple-600" />
              <span className="text-sm font-medium">전체미션</span>
              <Badge variant="outline" className="text-xs">
                {mission.totalMissionCount}개
              </Badge>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 overflow-x-auto">
              <div className="flex items-center gap-2 py-1 mb-1">
                {getStatusIcon(mission.missionTree.status, mission.missionTree.isUnlocked)}
                <span className="font-medium">{mission.missionTree.title}</span>
                <Badge variant="outline" className="text-xs">1차</Badge>
                <span className={`text-xs ${mission.missionTree.status === 'approved' ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {getStatusLabel(mission.missionTree.status, mission.missionTree.isUnlocked, 1, false)}
                </span>
              </div>
              {mission.missionTree.children.map((child, index) =>
                renderMissionTree(child, index === mission.missionTree!.children.length - 1, '')
              )}
            </div>
            {!mission.isApprovedForChildAccess && (
              <p className="text-xs text-muted-foreground mt-2">
                현재 미션의 세부 미션을 모두 완료하고 승인을 받으면 다음 미션에 접근할 수 있습니다.
              </p>
            )}
          </div>
        )}

        {/* 미션안내 이미지 (Venue Image) - At Bottom */}
        {mission.venueImageUrl && (
          <div className="rounded-lg overflow-hidden mb-6">
            <img
              src={mission.venueImageUrl}
              alt="미션 안내"
              className="w-full object-contain"
            />
          </div>
        )}
      </div>

      {/* Action Tab Bar - Fixed at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg z-50">
        <div className="flex items-stretch max-w-lg mx-auto">
          {/* Left section: Sub-mission tabs with progress bar */}
          <div className="flex-1 flex flex-col">
            {/* Progress Bar - Above sub-mission icons */}
            <div className="px-2 pt-2">
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-300 dark:bg-gray-600">
                <div
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${mission.progressPercentage}%` }}
                />
              </div>
            </div>
            {/* Sub-mission Tabs */}
            <div className="flex justify-around items-center py-2 px-1">
              {dynamicTabs.map((tab, tabIndex) => {
                const isUnlocked = getTabUnlockStatus(tabIndex);
                const isCompleted = tab.subMission.submission?.status === 'approved';
                const TabIcon = getActionTypeTabIcon(tab.name);
                const tabLabel = getActionTypeTabLabel(tab.name);

                // 세부미션 기간 상태 확인
                const subMissionPeriodStatus = getPeriodStatus(
                  tab.subMission.startDate,
                  tab.subMission.endDate
                );
                const isSubMissionUpcoming = subMissionPeriodStatus === 'upcoming';
                const isSubMissionClosed = subMissionPeriodStatus === 'closed';

                // 날짜 설정이 최우선: 시작 전이면 잠금, 마감이면 비활성화
                const isEffectivelyLocked = !isUnlocked || isSubMissionUpcoming;
                const isDisabled = isEffectivelyLocked || isSubMissionClosed;

                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (isSubMissionUpcoming) {
                        toast({
                          title: "준비 중",
                          description: "아직 시작되지 않은 미션입니다.",
                        });
                      } else if (isSubMissionClosed) {
                        toast({
                          title: "마감됨",
                          description: "종료된 미션입니다.",
                        });
                      } else if (!isUnlocked) {
                        const currentLevel = tab.subMission.sequentialLevel || 0;
                        const prevLevel = currentLevel - 1;
                        toast({
                          title: "잠금됨",
                          description: prevLevel > 0
                            ? `${prevLevel}단계 미션을 모두 완료해야 접근할 수 있습니다.`
                            : "이전 미션을 완료해야 접근할 수 있습니다.",
                        });
                      } else {
                        handleTabClick(tab.subMission);
                      }
                    }}
                    className={`flex flex-col items-center gap-1 px-2 py-1 rounded-lg transition-all min-w-[56px] ${isSubMissionClosed
                      ? 'text-gray-400 dark:text-gray-500 opacity-50'
                      : isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : !isDisabled
                          ? 'text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    disabled={isDisabled && !isSubMissionClosed}
                  >
                    <div className="relative">
                      {isSubMissionClosed ? (
                        <>
                          <TabIcon className="h-6 w-6 opacity-50" />
                          <XCircle className="h-3 w-3 absolute -top-1 -right-1 text-gray-400" />
                        </>
                      ) : isCompleted ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : isSubMissionUpcoming ? (
                        <>
                          <TabIcon className="h-6 w-6 opacity-50" />
                          <Clock className="h-3 w-3 absolute -top-1 -right-1 text-orange-400" />
                        </>
                      ) : !isUnlocked ? (
                        <>
                          <TabIcon className="h-6 w-6 opacity-50" />
                          <Lock className="h-3 w-3 absolute -top-1 -right-1 text-gray-400" />
                        </>
                      ) : (
                        <TabIcon className="h-6 w-6" />
                      )}
                    </div>
                    <span className="text-xs font-medium">
                      {isSubMissionClosed ? '마감' : tabLabel}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right section: Gift button */}
          {hasGifts && (
            <div className="flex items-center px-2">
              <button
                onClick={handleOpenGift}
                className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-[56px] bg-purple-600 text-white hover:bg-purple-700"
              >
                <Gift className="h-6 w-6" />
                <span className="text-xs font-medium">완료선물</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SubMission Modal */}
      <Dialog open={!!selectedSubMission} onOpenChange={(open) => !open && closeSubMissionWithHistory()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedSubMission?.actionType?.name && (
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${getActionTypeBadgeStyle(selectedSubMission.actionType.name)}`}>
                  {(() => {
                    const ActionIcon = getActionTypeIcon(selectedSubMission.actionType?.name);
                    return ActionIcon ? <ActionIcon className="h-3 w-3" /> : null;
                  })()}
                  {selectedSubMission.actionType.name}
                </span>
              )}
              {selectedSubMission?.title}
            </DialogTitle>
          </DialogHeader>

          {selectedSubMission && (
            <div className="space-y-4 mt-4">
              {selectedSubMission.description && (
                <div
                  className="text-sm whitespace-pre-wrap p-3 bg-muted/30 rounded-lg"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedSubMission.description) }}
                />
              )}

              {selectedSubMission.requireReview && (
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                  <AlertCircle className="h-4 w-4" />
                  <span>이 미션은 관리자 검토가 필요합니다</span>
                </div>
              )}

              {selectedSubMission.submission?.status === 'rejected' && selectedSubMission.submission.reviewNotes && (
                <div className="bg-destructive/10 border border-destructive/20 p-3 rounded text-sm">
                  <p className="font-medium text-destructive mb-1">보류 사유:</p>
                  <p className="text-destructive/90">{selectedSubMission.submission.reviewNotes}</p>
                </div>
              )}

              {selectedSubMission.submissionTypes?.includes('attendance') ? (
                <AttendancePasswordForm
                  subMission={selectedSubMission}
                  isApproved={selectedSubMission.submission?.status === 'approved'}
                  isVerifying={verifyAttendanceMutation.isPending}
                  onSubmit={(password) => {
                    verifyAttendanceMutation.mutate({
                      subMissionId: selectedSubMission.id,
                      password
                    });
                  }}
                />
              ) : (
                <SubmissionForm
                  subMission={selectedSubMission}
                  missionId={missionId!}
                  onSubmit={(data) => {
                    submitMutation.mutate({
                      subMissionId: selectedSubMission.id,
                      submissionData: data,
                    });
                    // closeSubMissionModal()를 여기서 호출하지 않음!
                    // onSuccess에서 처리됨
                  }}
                  isSubmitting={submitMutation.isPending}
                  isLocked={selectedSubMission.submission?.isLocked || selectedSubMission.submission?.status === 'approved'}
                  missionStartDate={mission.startDate}
                  missionEndDate={mission.endDate}
                  onOpenGallery={handleOpenGallery}
                  isApplicationType={selectedSubMission.actionType?.name === '신청'}
                  onCancelApplication={() => setShowCancelConfirm(true)}
                  isCancelling={cancelApplicationMutation.isPending}
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Application Confirmation Dialog */}
      <AlertDialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>신청을 취소하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              신청을 취소하면 현재 신청 내역이 취소됩니다. 다시 신청하실 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={() => {
                if (selectedSubMission) {
                  cancelApplicationMutation.mutate({ subMissionId: selectedSubMission.id });
                }
              }}
            >
              신청 취소
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

interface AttendancePasswordFormProps {
  subMission: SubMission;
  isApproved: boolean;
  isVerifying: boolean;
  onSubmit: (password: string) => void;
}

function AttendancePasswordForm({ subMission, isApproved, isVerifying, onSubmit }: AttendancePasswordFormProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      return;
    }
    onSubmit(password);
  };

  if (isApproved) {
    return (
      <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="font-medium text-green-700 dark:text-green-300">출석 완료</span>
        </div>
        <p className="text-sm text-green-600 dark:text-green-400">
          {subMission.submission?.submittedAt &&
            `${new Date(subMission.submission.submittedAt).toLocaleString('ko-KR')}`
          }
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <div>
        <label className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2 block">
          출석 비밀번호
        </label>
        <div className="relative">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isVerifying}
            className="pr-10 bg-white dark:bg-gray-800"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isVerifying}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      <Button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-700"
        disabled={isVerifying || !password.trim()}
      >
        {isVerifying ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            확인 중...
          </>
        ) : (
          <>
            <Lock className="h-4 w-4 mr-2" />
            출석 확인
          </>
        )}
      </Button>
    </form>
  );
}

interface SubmissionFormProps {
  subMission: SubMission;
  missionId: string;
  onSubmit: (data: any) => void;
  isSubmitting: boolean;
  isLocked: boolean;
  missionStartDate?: string;
  missionEndDate?: string;
  onOpenGallery?: (subMissionId: number) => void;
  isApplicationType?: boolean;
  onCancelApplication?: () => void;
  isCancelling?: boolean;
}

interface SlotData {
  fileUrl: string;
  linkUrl: string;
  textContent: string;
  rating: number;
  memo: string;
  imageUrl: string;
  mimeType: string;
  fileName: string;
  gsPath: string;
  studioProjectId: number | null;
  studioPreviewUrl: string;
  studioProjectTitle: string;
  studioPdfUrl: string;
}

const createEmptySlotData = (): SlotData => ({
  fileUrl: '',
  linkUrl: '',
  textContent: '',
  rating: 5,
  memo: '',
  imageUrl: '',
  mimeType: '',
  fileName: '',
  gsPath: '',
  studioProjectId: null,
  studioPreviewUrl: '',
  studioProjectTitle: '',
  studioPdfUrl: '',
});

function SubmissionForm({ subMission, missionId, onSubmit, isSubmitting, isLocked, missionStartDate, missionEndDate, onOpenGallery, isApplicationType, onCancelApplication, isCancelling }: SubmissionFormProps) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const modal = useModal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingSubmissionData, setPendingSubmissionData] = useState<any>(null);

  const [pendingStudioProject, setPendingStudioProject] = useState<any>(null);
  const isDraftRestored = useRef(false); // 드래프트 복원 여부 추적용 Ref

  const availableTypes = getSubmissionTypes(subMission);
  const [selectedTypeIndex, setSelectedTypeIndex] = useState<number>(0);
  const selectedSubmissionType = availableTypes[selectedTypeIndex] || 'text';

  const getSubmissionLabelByIndex = (index: number, type: string): string => {
    const labels = (subMission as any).submissionLabels || {};
    if (labels[String(index)]) return labels[String(index)];
    if (labels[type]) return labels[type];
    switch (type) {
      case "file": return "파일 URL";
      case "image": return "이미지 URL";
      case "link": return "링크 URL";
      case "text": return "텍스트 내용";
      case "review": return "리뷰 내용";
      case "studio_submit": return "제작소 제출";
      default: return type;
    }
  };

  const getSubmissionLabel = (type: string): string => {
    return getSubmissionLabelByIndex(-1, type);
  };

  const [slotsData, setSlotsData] = useState<SlotData[]>(() => {
    console.log('[RESTORE] useState 초기화 시작');
    console.log('[RESTORE] missionId:', missionId, 'subMission.id:', subMission.id);

    // 1. URL 파라미터로 자동 선택된 프로젝트가 있는지 먼저 확인
    const params = new URLSearchParams(window.location.search);
    const autoSelectId = params.get('autoSelectProject');

    // 세션 스토리지에서 드래프트 확인 (페이지 이동 후 복귀 시)
    try {
      const draftKey = `submission_draft_${missionId}_${subMission.id}`;
      console.log('[RESTORE] 조회할 draftKey:', draftKey);

      const saved = sessionStorage.getItem(draftKey);
      console.log('[RESTORE] sessionStorage에서 가져온 데이터:', saved ? '있음 (길이: ' + saved.length + ')' : '없음');

      // autoSelectProject가 있으면 draft 무시하고 삭제
      if (autoSelectId) {
        console.log('[RESTORE] autoSelectProject 감지:', autoSelectId);
        console.log('[RESTORE] Draft 무시하고 서버 데이터 사용');
        sessionStorage.removeItem(draftKey); // draft 삭제
        // 아래로 fall through하여 서버 데이터 초기화
      } else if (saved) {
        const parsed = JSON.parse(saved);
        console.log('[RESTORE] 파싱된 데이터:', parsed);

        if (Array.isArray(parsed)) {
          // 복원 성공! sessionStorage는 유지 (모달 닫힐 때 정리)
          console.log('[RESTORE] 드래프트 복원 성공!');
          isDraftRestored.current = true; // 드래프트 복원됨 표시
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to load submission draft:', e);
    }

    // 2. 기존 제출 내역 확인
    const existingSlots = subMission.submission?.submissionData?.slots;
    if (existingSlots && Array.isArray(existingSlots)) {
      const slots = existingSlots.map((slot: any) => ({
        fileUrl: slot.fileUrl || '',
        linkUrl: slot.linkUrl || '',
        textContent: slot.textContent || '',
        rating: slot.rating || 5,
        memo: slot.memo || '',
        imageUrl: slot.imageUrl || '',
        mimeType: slot.mimeType || '',
        fileName: slot.fileName || '',
        gsPath: slot.gsPath || '',
        studioProjectId: slot.studioProjectId || null,
        studioPreviewUrl: slot.studioPreviewUrl || '',
        studioProjectTitle: slot.studioProjectTitle || '',
        studioPdfUrl: slot.studioPdfUrl || '',
      }));

      // autoSelectProject가 있으면 해당 슬롯 업데이트
      if (autoSelectId) {
        console.log('[RESTORE] autoSelectId 있음:', autoSelectId);
        console.log('[RESTORE] availableTypes:', availableTypes);
        const studioIndex = availableTypes.indexOf('studio_submit');
        console.log('[RESTORE] studioIndex:', studioIndex);

        if (studioIndex >= 0) {
          console.log('[RESTORE] studio 슬롯 업데이트 with autoSelectId:', autoSelectId);
          console.log('[RESTORE] 업데이트 전 slots[studioIndex]:', JSON.stringify(slots[studioIndex], null, 2));

          slots[studioIndex] = {
            ...slots[studioIndex],
            studioProjectId: parseInt(autoSelectId),
            studioProjectTitle: '작업물 불러오는 중...',
            // 서버에서 최신 데이터를 가져올 수 있도록 이전 URL 제거
            imageUrl: '',
            studioPdfUrl: '',
            studioPreviewUrl: '',
          };

          console.log('[RESTORE] 업데이트 후 slots[studioIndex]:', JSON.stringify(slots[studioIndex], null, 2));
        } else {
          console.error('[RESTORE] ERROR: studio_submit을 availableTypes에서 찾을 수 없음!');
        }
      }

      return slots;
    }

    // 3. 레거시 데이터 확인
    if (subMission.submission?.submissionData && !existingSlots) {
      const legacyData = subMission.submission.submissionData;
      const slots = availableTypes.map(() => ({
        fileUrl: legacyData.fileUrl || '',
        linkUrl: legacyData.linkUrl || '',
        textContent: legacyData.textContent || '',
        rating: legacyData.rating || 5,
        memo: legacyData.memo || '',
        imageUrl: legacyData.imageUrl || '',
        mimeType: legacyData.mimeType || '',
        fileName: legacyData.fileName || '',
        gsPath: legacyData.gsPath || '',
        studioProjectId: legacyData.studioProjectId || null,
        studioPreviewUrl: legacyData.studioPreviewUrl || '',
        studioProjectTitle: legacyData.studioProjectTitle || '',
        studioPdfUrl: legacyData.studioPdfUrl || '',
      }));

      // autoSelectProject가 있으면 해당 슬롯 업데이트
      if (autoSelectId) {
        const studioIndex = availableTypes.indexOf('studio_submit');
        if (studioIndex >= 0) {
          console.log('[RESTORE] legacy studio 슬롯 업데이트 with autoSelectId:', autoSelectId);
          slots[studioIndex] = {
            ...slots[studioIndex],
            studioProjectId: parseInt(autoSelectId),
            studioProjectTitle: '작업물 불러오는 중...',
            imageUrl: '',
            studioPdfUrl: '',
            studioPreviewUrl: '',
          };
        }
      }

      return slots;
    }

    // 4. 초기 상태
    const emptySlots = availableTypes.map(() => createEmptySlotData());

    // autoSelectProject가 있으면 해당 슬롯 업데이트
    if (autoSelectId) {
      const studioIndex = availableTypes.indexOf('studio_submit');
      if (studioIndex >= 0) {
        console.log('[RESTORE] empty studio 슬롯 업데이트 with autoSelectId:', autoSelectId);
        emptySlots[studioIndex] = {
          ...emptySlots[studioIndex],
          studioProjectId: parseInt(autoSelectId),
          studioProjectTitle: '작업물 불러오는 중...',
        };
      }
    }

    return emptySlots;
  });

  const [uploadingFile, setUploadingFile] = useState(false);
  const [studioPickerModalOpen, setStudioPickerModalOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // 스튜디오 피커 모달에 히스토리 API 연동
  const closeStudioPickerModal = useCallback(() => {
    setStudioPickerModalOpen(false);
    modal.close();
  }, [modal]);

  const { closeWithHistory: closeStudioPickerWithHistory } = useModalHistory({
    isOpen: studioPickerModalOpen,
    onClose: closeStudioPickerModal,
    modalId: 'studio-picker'
  });

  // 스튜디오 프로젝트 수동 로드
  const [isDataLoading, setIsDataLoading] = useState(false);
  const loadStudioProjects = async () => {
    try {
      setIsDataLoading(true);
      const studioCategory = subMission.partyTemplateProjectId ? 'party' : 'all';
      const response = await fetch(`/api/products/studio-gallery?category=${studioCategory}&limit=50`);
      if (!response.ok) throw new Error('제작소 작업물 조회 실패');
      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Failed to load studio projects:', error);
      toast({ title: "오류", description: "작업물 목록을 불러올 수 없습니다", variant: "destructive" });
      return [];
    } finally {
      setIsDataLoading(false);
    }
  };

  // autoSelectProject 자동 로드 추적 (무한 루프 방지)
  const autoLoadedProjectId = useRef<number | null>(null);

  // autoSelectProject가 있으면 해당 프로젝트 데이터 자동 로드
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoSelectId = params.get('autoSelectProject');

    if (!autoSelectId) return;

    const projectId = parseInt(autoSelectId);

    // 이미 로드했으면 스킵 (무한 루프 방지)
    if (autoLoadedProjectId.current === projectId) {
      console.log('[AUTO-LOAD] 이미 로드됨, 스킵:', projectId);
      return;
    }

    const studioIndex = availableTypes.indexOf('studio_submit');
    if (studioIndex < 0) {
      console.log('[AUTO-LOAD] studio_submit 슬롯 없음');
      return;
    }

    // 프로젝트 데이터 로드
    const loadProjectData = async () => {
      try {
        const fetchStartTime = performance.now();
        console.log('[AUTO-LOAD] ⏱️ 프로젝트 데이터 로드 시작:', autoSelectId);

        const response = await fetch(`/api/products/projects/${autoSelectId}`, {
          credentials: 'include',
        });

        if (!response.ok) throw new Error('프로젝트 조회 실패');

        const result = await response.json();
        const fetchEndTime = performance.now();
        const fetchDuration = Math.round(fetchEndTime - fetchStartTime);

        console.log(`[AUTO-LOAD] ✅ API 응답 (${fetchDuration}ms):`, result);

        // API 응답이 {data: {...}} 구조
        const project = result.data || result;
        console.log('[AUTO-LOAD] 프로젝트 데이터:', project);

        // 로드 완료 표시 (무한 루프 방지)
        autoLoadedProjectId.current = projectId;

        // 슬롯 데이터 업데이트
        const updateStartTime = performance.now();
        setSlotsData(prev => {
          const newSlots = [...prev];

          // Cache-busting: URL에 timestamp 추가하여 브라우저 캐시 우회
          const cacheBuster = `?t=${Date.now()}`;
          const thumbnailUrl = project.thumbnailUrl
            ? `${project.thumbnailUrl}${cacheBuster}`
            : '';
          const pdfUrl = project.pdfUrl
            ? `${project.pdfUrl}${cacheBuster}`
            : '';

          newSlots[studioIndex] = {
            ...newSlots[studioIndex],
            studioProjectId: project.id,
            studioProjectTitle: project.title || '작업물',
            studioPreviewUrl: thumbnailUrl,
            studioPdfUrl: pdfUrl,
          };

          const updateEndTime = performance.now();
          const updateDuration = Math.round(updateEndTime - updateStartTime);
          const totalDuration = Math.round(updateEndTime - fetchStartTime);

          console.log(`[AUTO-LOAD] ✅ 슬롯 업데이트 완료 (업데이트: ${updateDuration}ms, 전체: ${totalDuration}ms):`, newSlots[studioIndex]);
          return newSlots;
        });
      } catch (error) {
        console.error('[AUTO-LOAD] 프로젝트 로드 실패:', error);
      }
    };

    loadProjectData();
  }, [availableTypes]); // slotsData 제거하여 무한 루프 방지

  const currentSlotData = slotsData[selectedTypeIndex] || createEmptySlotData();

  const updateCurrentSlot = (updates: Partial<SlotData>) => {
    setSlotsData(prev => {
      const newSlots = [...prev];
      newSlots[selectedTypeIndex] = { ...newSlots[selectedTypeIndex], ...updates };
      return newSlots;
    });
  };

  const isSlotFilled = (slotIndex: number): boolean => {
    const slot = slotsData[slotIndex];
    if (!slot) return false;
    const type = availableTypes[slotIndex];
    switch (type) {
      case 'file':
        return !!slot.fileUrl;
      case 'image':
        return !!slot.imageUrl;
      case 'link':
        return !!slot.linkUrl;
      case 'text':
      case 'review':
        return !!slot.textContent;
      case 'studio_submit':
        return !!slot.studioProjectId;
      default:
        return false;
    }
  };

  const getFilledSlotsCount = (): number => {
    return slotsData.filter((_, index) => isSlotFilled(index)).length;
  };

  // URL에 http:// 또는 https:// 가 없으면 자동으로 https:// 추가
  const normalizeUrl = (url: string): string => {
    if (!url || url.trim() === '') return '';
    const trimmedUrl = url.trim();
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    return `https://${trimmedUrl}`;
  };

  // 미션 기간 체크 (세부미션 날짜 > 주제미션 날짜 우선순위)
  // 한국 시간대(KST) 기준으로 날짜 비교
  const checkPeriod = () => {
    const now = new Date();
    const nowParts = getKoreanDateParts(now);
    const nowValue = nowParts.year * 10000 + nowParts.month * 100 + nowParts.day;

    // 세부미션 날짜가 설정되어 있으면 그것을 우선 확인
    if (subMission.startDate || subMission.endDate) {
      if (subMission.startDate) {
        const subStart = parseKoreanDate(subMission.startDate);
        if (subStart) {
          const startParts = getKoreanDateParts(subStart);
          const startValue = startParts.year * 10000 + startParts.month * 100 + startParts.day;
          if (nowValue < startValue) {
            return {
              isValid: false,
              message: `이 미션은 ${formatSimpleDate(subMission.startDate)}부터 시작됩니다.`
            };
          }
        }
      }

      if (subMission.endDate) {
        const subEnd = parseKoreanDate(subMission.endDate);
        if (subEnd) {
          const endParts = getKoreanDateParts(subEnd);
          const endValue = endParts.year * 10000 + endParts.month * 100 + endParts.day;
          if (nowValue > endValue) {
            return {
              isValid: false,
              message: `이 미션 기간이 ${formatSimpleDate(subMission.endDate)}에 종료되었습니다.`
            };
          }
        }
      }

      return { isValid: true, message: '' };
    }

    // 세부미션 날짜가 없으면 주제미션 날짜 확인
    if (!missionStartDate || !missionEndDate) {
      return { isValid: true, message: '' };
    }

    const start = parseKoreanDate(missionStartDate);
    const end = parseKoreanDate(missionEndDate);

    if (start) {
      const startParts = getKoreanDateParts(start);
      const startValue = startParts.year * 10000 + startParts.month * 100 + startParts.day;
      if (nowValue < startValue) {
        return {
          isValid: false,
          message: `미션은 ${formatSimpleDate(missionStartDate)}부터 시작됩니다.`
        };
      }
    }

    if (end) {
      const endParts = getKoreanDateParts(end);
      const endValue = endParts.year * 10000 + endParts.month * 100 + endParts.day;
      if (nowValue > endValue) {
        return {
          isValid: false,
          message: `미션 기간이 ${formatSimpleDate(missionEndDate)}에 종료되었습니다.`
        };
      }
    }

    return { isValid: true, message: '' };
  };

  const periodCheck = checkPeriod();

  // 제출 데이터가 변경되면 슬롯 데이터 업데이트
  useEffect(() => {
    // 드래프트가 복원된 상태라면 서버 데이터로 덮어쓰지 않음
    if (isDraftRestored.current) {
      return;
    }

    // sessionStorage에 draft가 있는지 직접 확인 (추가 보호)
    const draftKey = `submission_draft_${missionId}_${subMission.id}`;
    const hasDraft = sessionStorage.getItem(draftKey);
    if (hasDraft) {
      // Draft가 존재하면 서버 동기화를 건너뛀
      return;
    }

    if (subMission.submission?.submissionData) {
      // ... (기존 로직 유지) ...
      // 여기서는 subMission.submission 변경 시에만 동작하므로, 드래프트 복원 로직과 충돌하지 않음
      // 단, 드래프트 복원이 우선순위를 가질 수 있도록 조정 필요할 수 있음.
      // 하지만 현재 구조상 드래프트 복원은 useState 초기값으로 처리되므로,
      // submissionData가 나중에 로드되어 이 Effect가 실행되면 덮어쓸 위험이 있음.

      // 해결책: 드래프트가 있었는지 확인하는 ref 사용
      const draftKey = `submission_draft_${missionId}_${subMission.id}`;
      // 이미 복원 후 삭제했으므로 sessionStorage에는 없음.
      // 따라서 별도 처리는 복잡함. 일단 "수정 모드"가 아니면 submissionData가 없을 것이므로 괜찮음.
      // 수정 모드에서도 사용자가 "제작하기"를 다녀오면 드래프트가 우선이어야 함. (?)

      const existingSlots = subMission.submission.submissionData.slots;
      if (existingSlots && Array.isArray(existingSlots)) {
        setSlotsData(existingSlots.map((slot: any) => ({
          fileUrl: slot.fileUrl || '',
          linkUrl: slot.linkUrl || '',
          textContent: slot.textContent || '',
          rating: slot.rating || 5,
          memo: slot.memo || '',
          imageUrl: slot.imageUrl || '',
          mimeType: slot.mimeType || '',
          fileName: slot.fileName || '',
          gsPath: slot.gsPath || '',
          studioProjectId: slot.studioProjectId || null,
          studioPreviewUrl: slot.studioPreviewUrl || '',
          studioProjectTitle: slot.studioProjectTitle || '',
          studioPdfUrl: slot.studioPdfUrl || '',
        })));
      } else {
        const legacyData = subMission.submission.submissionData;
        setSlotsData(availableTypes.map(() => ({
          fileUrl: legacyData.fileUrl || '',
          linkUrl: legacyData.linkUrl || '',
          textContent: legacyData.textContent || '',
          rating: legacyData.rating || 5,
          memo: legacyData.memo || '',
          imageUrl: legacyData.imageUrl || '',
          mimeType: legacyData.mimeType || '',
          fileName: legacyData.fileName || '',
          gsPath: legacyData.gsPath || '',
          studioProjectId: legacyData.studioProjectId || null,
          studioPreviewUrl: legacyData.studioPreviewUrl || '',
          studioProjectTitle: legacyData.studioProjectTitle || '',
          studioPdfUrl: legacyData.studioPdfUrl || '',
        })));
      }
    }
  }, [subMission.submission, availableTypes.length]);

  // 자동 선택된 프로젝트 상세 정보 로드 (드래프트 복원 직후)
  useEffect(() => {
    const studioSlotIndex = availableTypes.indexOf('studio_submit');
    if (studioSlotIndex === -1) return;

    // 초기 렌더링 시점의 slotsData 확인
    const slot = slotsData[studioSlotIndex];
    if (slot && slot.studioProjectId && slot.studioProjectTitle === '작업물 불러오는 중...') {
      const fetchProject = async () => {
        try {
          const response = await fetch(`/api/products/projects/${slot.studioProjectId}`);
          if (response.ok) {
            const json = await response.json();
            const project = json.data;

            setSlotsData(prev => {
              const newSlots = [...prev];
              newSlots[studioSlotIndex] = {
                ...newSlots[studioSlotIndex],
                studioProjectTitle: project.title,
                studioPreviewUrl: project.thumbnailUrl,
                // PDF는 비워둬서 사용자가 제출 시 생성하도록 유도 (또는 자동 생성 트리거 가능)
              };
              return newSlots;
            });
          }
        } catch (e) {
          console.error("Failed to fetch auto-selected project", e);
        }
      };
      fetchProject();
    }
  }, []); // 마운트 시 1회 실행 (slotsData 초기값 기준)

  // 제작소 작업물 선택 핸들러 - 상태만 업데이트하고 모달 닫기
  const handleStudioSelect = (project: any) => {
    setStudioPickerModalOpen(false);
    modal.close();
    setPendingStudioProject(project);

    updateCurrentSlot({
      studioProjectId: project.id,
      studioPreviewUrl: project.thumbnailUrl || '',
      studioProjectTitle: project.title || '작업물',
      studioPdfUrl: '', // 초기화 (새로 선택했으므로 PDF 다시 생성 필요)
    });
  };

  // 제작소 PDF/이미지 생성 및 업로드 헬퍼 함수
  const generateStudioFile = async (project: any): Promise<string | null> => {
    if (!project) return null;

    toast({
      title: "파일 생성 중...",
      description: "작업물 파일을 생성하고 있습니다."
    });

    setIsGeneratingPdf(true);

    try {
      // 카테고리에 따라 다른 API 엔드포인트 사용
      const apiEndpoint = project.category === 'photobook'
        ? `/api/photobook/projects/${project.id}`
        : `/api/products/projects/${project.id}`;

      const response = await fetch(apiEndpoint, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('프로젝트 정보 조회 실패');
      }

      const projectResult = await response.json();
      const projectData = projectResult.data;

      // 카테고리별 variant 설정 및 데이터 추출
      let variantConfig;
      let designsForPdf: any[] = [];

      if (project.category === 'photobook') {
        const pagesData = projectData?.pagesData;
        const spreads = pagesData?.editorState?.spreads;

        if (!spreads || spreads.length === 0) {
          throw new Error("작업물에 디자인 데이터가 없습니다.");
        }

        const albumSize = pagesData?.editorState?.albumSize;
        const widthMm = albumSize
          ? Math.round(albumSize.widthInches * 25.4 * 2)
          : Math.round(420);
        const heightMm = albumSize
          ? Math.round(albumSize.heightInches * 25.4)
          : Math.round(210);

        variantConfig = {
          widthMm,
          heightMm,
          bleedMm: 3,
          dpi: 300
        };

        const orientation = widthMm > heightMm ? 'landscape' : 'portrait';

        designsForPdf = spreads.map((spread: any) => ({
          id: spread.id,
          objects: spread.objects || [],
          background: spread.background || '#ffffff',
          backgroundLeft: spread.backgroundLeft,
          backgroundRight: spread.backgroundRight,
          orientation
        }));
      } else {
        const designsData = projectData?.designsData;

        if (!designsData?.designs || designsData.designs.length === 0) {
          throw new Error("작업물에 디자인 데이터가 없습니다.");
        }

        variantConfig = designsData?.variantConfig || projectData.variant || {
          widthMm: 148,
          heightMm: 210,
          bleedMm: 3,
          dpi: 300
        };
        designsForPdf = designsData.designs || [];
      }

      // 세부미션에 설정된 DPI와 파일 형식 사용
      const studioDpi = (subMission as any).studioDpi || 300;
      const studioFileFormat = (subMission as any).studioFileFormat || 'pdf';

      console.log('[📝 STUDIO-FILE] 파일 생성 설정:', { studioDpi, studioFileFormat });
      console.log('[📝 STUDIO-FILE] 프로젝트:', project);

      let fileBlob: Blob;
      let fileExtension: string;
      let uploadEndpoint = '/api/missions/upload-pdf';

      if (studioFileFormat === 'pdf') {
        fileBlob = await generatePdfBlob(
          designsForPdf,
          variantConfig,
          { format: 'pdf', qualityValue: String(studioDpi), dpi: studioDpi, includeBleed: true }
        );
        fileExtension = 'pdf';
      } else {
        const format = studioFileFormat as 'webp' | 'jpeg';
        fileBlob = await generateImageBlob(
          designsForPdf,
          variantConfig,
          { format, qualityValue: String(studioDpi), dpi: studioDpi, includeBleed: true }
        );
        fileExtension = format === 'webp' ? 'webp' : 'jpg';
      }

      const formData = new FormData();
      formData.append('file', fileBlob, `${project.title || 'submission'}.${fileExtension}`);

      const uploadResponse = await fetch(uploadEndpoint, {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!uploadResponse.ok) {
        throw new Error('파일 업로드 실패');
      }

      const uploadResult = await uploadResponse.json();

      console.log('[📝 STUDIO-FILE] 업로드 결과:', uploadResult);

      if (uploadResult.success && uploadResult.pdfUrl) {
        // 성공 시 URL 반환 및 상태 업데이트
        updateCurrentSlot({
          studioPdfUrl: uploadResult.pdfUrl
        });
        return uploadResult.pdfUrl;
      } else {
        throw new Error(uploadResult.error || '파일 업로드 실패');
      }
    } catch (error) {
      console.error('[❌ STUDIO-FILE] 파일 생성 오류:', error);
      toast({
        title: "제출 실패",
        description: error instanceof Error ? error.message : "작업물 파일 생성 중 오류가 발생했습니다.",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsGeneratingPdf(false);
      setPendingStudioProject(null);
    }
  };

  // 갤러리 이미지 선택 이벤트 리스너
  useEffect(() => {
    const handleGalleryImageSelected = (event: any) => {
      const { imageUrl, subMissionId, slotIndex } = event.detail;
      if (subMissionId === subMission.id) {
        const targetIndex = typeof slotIndex === 'number' ? slotIndex : selectedTypeIndex;
        setSlotsData(prev => {
          const newSlots = [...prev];
          newSlots[targetIndex] = { ...newSlots[targetIndex], imageUrl };
          return newSlots;
        });
      }
    };

    window.addEventListener('gallery-image-selected', handleGalleryImageSelected);
    return () => {
      window.removeEventListener('gallery-image-selected', handleGalleryImageSelected);
    };
  }, [subMission.id, selectedTypeIndex]);

  // 파일 업로드 핸들러
  const handleFileUpload = async (file: File, targetType: 'file' | 'image') => {
    if (!file) return;

    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      toast({
        title: "파일 크기 초과",
        description: "파일 크기는 10MB 이하여야 합니다.",
        variant: "destructive"
      });
      return;
    }

    // image 타입인 경우에만 이미지 파일인지 확인
    if (targetType === 'image' && !file.type.startsWith('image/')) {
      toast({
        title: "잘못된 파일 형식",
        description: "이미지 파일만 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    setUploadingFile(true);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(`/api/missions/upload?submissionType=${targetType}`, {
        method: 'POST',
        body: uploadFormData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '파일 업로드 실패');
      }

      const result = await response.json();

      // 현재 선택된 슬롯에만 저장 (gsPath 포함)
      if (targetType === 'file') {
        updateCurrentSlot({
          fileUrl: result.fileUrl,
          mimeType: result.mimeType,
          fileName: result.fileName || file.name,
          gsPath: result.gsPath || ''
        });
      } else {
        updateCurrentSlot({
          imageUrl: result.fileUrl,
          mimeType: result.mimeType,
          fileName: result.fileName || file.name,
          gsPath: result.gsPath || ''
        });
      }

      toast({
        title: "업로드 완료",
        description: "파일이 성공적으로 업로드되었습니다."
      });
    } catch (error) {
      console.error('파일 업로드 오류:', error);
      toast({
        title: "업로드 실패",
        description: error instanceof Error ? error.message : "파일 업로드 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const buildSubmissionData = (targetSlots = slotsData) => {
    // 첫 번째 채워진 슬롯 찾기 (레거시 호환성)
    const firstFilledIndex = targetSlots.findIndex((_, index) => isSlotFilled(index));
    const firstFilledSlot = firstFilledIndex >= 0 ? targetSlots[firstFilledIndex] : null;
    const firstFilledType = firstFilledIndex >= 0 ? availableTypes[firstFilledIndex] : null;

    // 슬롯 데이터를 배열로 제출 + 레거시 필드 포함
    // linkUrl에 대해 자동으로 https:// prefix 추가
    const normalizedSlotsData = targetSlots.map((slot, index) => ({
      ...slot,
      linkUrl: availableTypes[index] === 'link' ? normalizeUrl(slot.linkUrl) : slot.linkUrl
    }));

    const submissionData: any = {
      slots: normalizedSlotsData.map((slot, index) => ({
        index,
        type: availableTypes[index],
        ...slot
      })),
      filledSlotsCount: getFilledSlotsCount(), // 참고: 이 클로저 함수는 현재 slotsData를 보지만, 큰 문제는 없음
      totalSlotsCount: availableTypes.length,
    };

    // 레거시 호환성: 첫 번째 채워진 슬롯의 데이터를 top-level 필드로도 추가
    const normalizedFirstSlot = firstFilledIndex >= 0 ? normalizedSlotsData[firstFilledIndex] : null;
    if (normalizedFirstSlot && firstFilledType) {
      submissionData.submissionType = firstFilledType;
      if (normalizedFirstSlot.fileUrl) submissionData.fileUrl = normalizedFirstSlot.fileUrl;
      if (normalizedFirstSlot.imageUrl) submissionData.imageUrl = normalizedFirstSlot.imageUrl;
      if (normalizedFirstSlot.linkUrl) submissionData.linkUrl = normalizedFirstSlot.linkUrl;
      if (normalizedFirstSlot.textContent) submissionData.textContent = normalizedFirstSlot.textContent;
      if (normalizedFirstSlot.rating) submissionData.rating = normalizedFirstSlot.rating;
      if (normalizedFirstSlot.memo) submissionData.memo = normalizedFirstSlot.memo;
      if (normalizedFirstSlot.fileName) submissionData.fileName = normalizedFirstSlot.fileName;
      if (normalizedFirstSlot.mimeType) submissionData.mimeType = normalizedFirstSlot.mimeType;
      if (normalizedFirstSlot.gsPath) submissionData.gsPath = normalizedFirstSlot.gsPath;
      if (normalizedFirstSlot.studioProjectId) submissionData.studioProjectId = normalizedFirstSlot.studioProjectId;
      if (normalizedFirstSlot.studioPreviewUrl) submissionData.studioPreviewUrl = normalizedFirstSlot.studioPreviewUrl;
      if (normalizedFirstSlot.studioProjectTitle) submissionData.studioProjectTitle = normalizedFirstSlot.studioProjectTitle;
      if (normalizedFirstSlot.studioPdfUrl) submissionData.studioPdfUrl = normalizedFirstSlot.studioPdfUrl;
    }

    return submissionData;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // studio_submit 처리 로직: 프로젝트 선택 및 파일 생성 확인
    if (selectedSubmissionType === 'studio_submit') {
      if (!currentSlotData.studioProjectId) {
        toast({
          title: "작업물 선택 필요",
          description: "제출할 제작소 작업물을 선택해주세요.",
          variant: "destructive"
        });
        return;
      }

      // PDF가 아직 생성되지 않았다면 생성
      if (!currentSlotData.studioPdfUrl) {
        if (isGeneratingPdf) {
          toast({ title: "생성 중", description: "파일을 생성하고 있습니다. 잠시만 기다려주세요." });
          return;
        }

        const projectToProcess = pendingStudioProject || {
          id: currentSlotData.studioProjectId,
          category: subMission.partyTemplateProjectId ? 'party' : 'photobook' // 간단한 추론, 실제론 더 정확한 데이터 필요할 수 있음
        };

        // 프로젝트 데이터가 불충분할 경우 로드 시도
        // (여기서는 단순화를 위해 pendingStudioProject가 없으면 새로고침을 권장하거나, 다시 선택하게 유도할 수 있음)
        // 하지만 handleStudioSelect에서 선택 시 pendingStudioProject를 설정하므로 대부분의 경우 존재함.

        const generatedUrl = await generateStudioFile(projectToProcess);
        if (!generatedUrl) {
          return; // 생성 실패 시 중단
        }

        // 생성된 URL을 포함하여 제출 데이터 구성
        const tempSlots = [...slotsData];
        tempSlots[selectedTypeIndex] = {
          ...tempSlots[selectedTypeIndex],
          studioPdfUrl: generatedUrl
        };

        const submissionData = buildSubmissionData(tempSlots);
        onSubmit(submissionData);
        return;
      }
    }

    // 최소 하나 이상의 슬롯이 채워졌는지 확인 (studio_submit의 경우 위에서 처리되었거나, 이미 채워진 상태임)
    const filledCount = getFilledSlotsCount();
    if (filledCount === 0) {
      toast({
        title: "제출 실패",
        description: "최소 하나 이상의 항목을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    const submissionData = buildSubmissionData();

    // 기존 제출이 있으면 확인 팝업 표시
    if (subMission.submission) {
      setPendingSubmissionData(submissionData);
      modal.open('resubmitConfirm', {
        title: '수정 제출 확인',
        message: '먼저 제출했던 내용이 수정됩니다. 수정 제출 할까요?',
        onConfirm: () => {
          if (submissionData) {
            onSubmit(submissionData);
            setPendingSubmissionData(null);
          }
          modal.close();
        },
        onCancel: () => {
          setPendingSubmissionData(null);
          modal.close();
        }
      });
      return;
    }

    onSubmit(submissionData);
  };

  const handleConfirmResubmit = () => {
    if (pendingSubmissionData) {
      onSubmit(pendingSubmissionData);
      setPendingSubmissionData(null);
    }
    modal.close();
  };

  // 기간 외 제출 불가
  if (!periodCheck.isValid) {
    return (
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded">
        <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-2">
          <AlertCircle className="h-5 w-5" />
          <span className="font-medium">제출 불가 기간</span>
        </div>
        <p className="text-sm text-orange-600 dark:text-orange-400">
          {periodCheck.message}
        </p>
      </div>
    );
  }

  if (isLocked) {
    return (
      <div className="space-y-3">
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">승인 완료</span>
          </div>
          <p className="text-sm text-green-600 dark:text-green-400">
            이 세부 미션은 승인되어 더 이상 수정할 수 없습니다.
          </p>
          {subMission.submission?.submittedAt && (
            <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
              제출일: {new Date(subMission.submission.submittedAt).toLocaleString('ko-KR')}
            </p>
          )}
        </div>
        {isApplicationType && subMission.submission && (
          <Button
            type="button"
            variant="outline"
            className="w-full border-red-500 text-red-500 hover:bg-red-50"
            disabled={isCancelling}
            onClick={onCancelApplication}
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                취소 중...
              </>
            ) : (
              '신청 취소'
            )}
          </Button>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Type Selector (only show if multiple types available) */}
      {availableTypes.length > 1 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            제출 항목 선택
            <span className="text-muted-foreground ml-2">
              ({getFilledSlotsCount()}/{availableTypes.length} 완료)
            </span>
          </label>
          <div className="flex flex-col gap-2">
            {availableTypes.map((type, index) => {
              const TypeIcon = getSubmissionTypeIcon(type);
              const isSelected = selectedTypeIndex === index;
              const isFilled = isSlotFilled(index);
              const typeCounts: Record<string, number> = {};
              let typeNumber = 1;
              for (let i = 0; i <= index; i++) {
                const t = availableTypes[i];
                typeCounts[t] = (typeCounts[t] || 0) + 1;
                if (i === index) typeNumber = typeCounts[t];
              }
              const indexLabel = getSubmissionLabelByIndex(index, type);
              const totalOfType = availableTypes.filter(t => t === type).length;
              const label = (totalOfType > 1 && indexLabel === getSubmissionLabel(type))
                ? `${indexLabel} ${typeNumber}`
                : indexLabel;
              return (
                <Button
                  key={index}
                  type="button"
                  variant={isSelected ? "default" : isFilled ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedTypeIndex(index);
                  }}
                  disabled={isSubmitting}
                  className={`relative justify-start ${isSelected ? "ring-2 ring-purple-500" : ""} ${isFilled && !isSelected ? "border-green-500" : ""} ${!isSelected && !isFilled ? "bg-white text-black border-gray-300 hover:bg-gray-50" : ""}`}
                >
                  {isFilled && (
                    <CheckCircle className="h-3 w-3 absolute -top-1 -right-1 text-green-500 bg-white dark:bg-gray-800 rounded-full" />
                  )}
                  <TypeIcon className="h-4 w-4 mr-2" />
                  {label}
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {/* File Upload */}
      {selectedSubmissionType === 'file' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">{getSubmissionLabelByIndex(selectedTypeIndex, 'file')}</label>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="*/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'file');
              }}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingFile || isSubmitting}
            >
              {uploadingFile ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  업로드 중...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  파일 선택
                </>
              )}
            </Button>
            {currentSlotData.fileUrl && (
              <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle className="h-4 w-4" />
                  <span>업로드 완료: {currentSlotData.fileName || '파일'}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    updateCurrentSlot({ fileUrl: '', fileName: '' });
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image Upload (new type) */}
      {selectedSubmissionType === 'image' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">{getSubmissionLabelByIndex(selectedTypeIndex, 'image')}</label>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(file, 'image');
              }}
              className="hidden"
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingFile || isSubmitting}
              >
                {uploadingFile ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    디바이스에서 업로드
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenGallery?.(subMission.id)}
                disabled={isSubmitting}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                갤러리에서 선택
              </Button>
            </div>
            {currentSlotData.imageUrl && (
              <div className="space-y-2">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                  <img
                    src={currentSlotData.imageUrl}
                    alt="업로드된 이미지"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      updateCurrentSlot({ imageUrl: '', fileName: '' });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  이미지가 선택되었습니다
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Link Input */}
      {selectedSubmissionType === 'link' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">{getSubmissionLabelByIndex(selectedTypeIndex, 'link')}</label>
          <Input
            type="text"
            placeholder="URL을 입력하세요"
            value={currentSlotData.linkUrl}
            onChange={(e) => updateCurrentSlot({ linkUrl: e.target.value })}
            disabled={isSubmitting}
          />
          <p className="text-xs text-muted-foreground">
            http:// 또는 https:// 없이 입력하셔도 됩니다
          </p>
        </div>
      )}

      {/* Studio Submit */}
      {selectedSubmissionType === 'studio_submit' && (
        <div className="space-y-4">
          <label className="text-sm font-medium">{getSubmissionLabelByIndex(selectedTypeIndex, 'studio_submit')}</label>

          <div className="grid grid-cols-1 gap-2"> {/* grid-cols-2 -> grid-cols-1 로 변경하여 버튼을 꽉 차게 표시 */}
            {/* Party Editor Button - shows when partyTemplateProjectId exists */}
            {subMission.partyTemplateProjectId ? (
              <Button
                type="button"
                variant="outline"
                className="w-full bg-white hover:bg-gray-100 text-purple-600 border-purple-400 dark:bg-white dark:hover:bg-gray-100 dark:text-purple-600 dark:border-purple-400 py-6"
                onClick={() => {
                  console.log('[DEBUG] 제작하기 버튼 클릭됨!');
                  console.log('[DEBUG] missionId:', missionId, 'subMissionId:', subMission.id);
                  console.log('[DEBUG] 현재 slotsData:', JSON.stringify(slotsData, null, 2));

                  // 현재 입력 상태 임시 저장 (드래프트)
                  const draftKey = `submission_draft_${missionId}_${subMission.id}`;
                  console.log('[DEBUG] draftKey:', draftKey);

                  sessionStorage.setItem(draftKey, JSON.stringify(slotsData));
                  console.log('[DEBUG] sessionStorage 저장 완료');
                  console.log('[DEBUG] 저장 확인:', sessionStorage.getItem(draftKey));

                  navigate(`/party?subMissionId=${subMission.id}`);
                }}
                disabled={isLocked || isSubmitting}
              >
                <Palette className="h-5 w-5 mr-2" />
                <span className="text-base">{currentSlotData.studioProjectId ? '다시 제작하기' : '제작하기'}</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full py-6"
                onClick={() => {
                  const loadAndOpenPicker = async () => {
                    setStudioPickerModalOpen(true);
                    const projects = await loadStudioProjects();
                    modal.open('studioPicker', {
                      projects,
                      isLoading: false,
                      onSelect: handleStudioSelect
                    });
                  };
                  loadAndOpenPicker();
                }}
                disabled={isLocked || isSubmitting}
              >
                <FolderTree className="h-5 w-5 mr-2" />
                <span className="text-base">제작물 선택하기</span>
              </Button>
            )}
          </div>

          {currentSlotData.studioProjectId && (
            <div className="space-y-2">
              {currentSlotData.studioPreviewUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                  <img
                    key={currentSlotData.studioPreviewUrl}
                    src={currentSlotData.studioPreviewUrl}
                    alt="선택된 작업물"
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
              <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{((subMission as any)?.studioFileFormat === 'webp' || (subMission as any)?.studioFileFormat === 'jpeg') ? '이미지' : 'PDF'} 생성 중: {currentSlotData.studioProjectTitle}</span>
                    </>
                  ) : currentSlotData.studioPdfUrl ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>{((subMission as any)?.studioFileFormat === 'webp' || (subMission as any)?.studioFileFormat === 'jpeg') ? '이미지' : 'PDF'} 생성 완료: {currentSlotData.studioProjectTitle}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>선택 완료: {currentSlotData.studioProjectTitle}</span>
                    </>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => updateCurrentSlot({ studioProjectId: null, studioPreviewUrl: '', studioProjectTitle: '', studioPdfUrl: '' })} disabled={isGeneratingPdf}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {currentSlotData.studioPdfUrl && (
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {((subMission as any)?.studioFileFormat === 'webp' || (subMission as any)?.studioFileFormat === 'jpeg') ? '이미지가' : 'PDF가'} 준비되었습니다
                </p>
              )}
              {!currentSlotData.studioPdfUrl && !isGeneratingPdf && (
                <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  제출하기 버튼을 누르면 파일이 생성됩니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}



      {/* Text Content */}
      {
        (selectedSubmissionType === 'text' || selectedSubmissionType === 'review') && (
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {getSubmissionLabelByIndex(selectedTypeIndex, selectedSubmissionType)}
            </label>
            <Textarea
              placeholder={selectedSubmissionType === 'review' ? '리뷰를 작성해주세요' : '내용을 입력하세요'}
              value={currentSlotData.textContent}
              onChange={(e) => updateCurrentSlot({ textContent: e.target.value })}
              disabled={isSubmitting}
              rows={5}
            />
          </div>
        )
      }

      {/* Rating (for review type) */}
      {
        selectedSubmissionType === 'review' && (
          <div className="space-y-2">
            <label className="text-sm font-medium">별점</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => updateCurrentSlot({ rating: star })}
                  disabled={isSubmitting}
                  className="transition-colors"
                >
                  <Star
                    className={`h-6 w-6 ${star <= currentSlotData.rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                      }`}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm text-muted-foreground">
                {currentSlotData.rating}점
              </span>
            </div>
          </div>
        )
      }

      {/* Submit Button */}
      <div className="flex flex-col gap-2">
        <Button
          type="submit"
          className="w-full bg-purple-700 hover:bg-purple-800 text-white"
          disabled={uploadingFile || isSubmitting || isGeneratingPdf || isCancelling}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              제출 중...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              {subMission.submission ? '다시 제출' : '제출하기'}
            </>
          )}
        </Button>

        {isApplicationType && subMission.submission && (
          <Button
            type="button"
            variant="outline"
            className="w-full border-red-500 text-red-500 hover:bg-red-50"
            disabled={isCancelling || isSubmitting}
            onClick={onCancelApplication}
          >
            {isCancelling ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                취소 중...
              </>
            ) : (
              '신청 취소'
            )}
          </Button>
        )}
      </div>

    </form >
  );
}
