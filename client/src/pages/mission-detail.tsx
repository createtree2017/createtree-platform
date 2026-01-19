import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { sanitizeHtml } from "@/lib/utils";
import { generatePdfBlob } from "@/services/exportService";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
}

export default function MissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);
  const [isGalleryDialogOpen, setIsGalleryDialogOpen] = useState(false);
  const [currentSubMissionId, setCurrentSubMissionId] = useState<number | null>(null);

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

  const { data: galleryImages = [], isLoading: isLoadingGallery } = useQuery<any[]>({
    queryKey: ['/api/gallery'],
    queryFn: async () => {
      const response = await fetch('/api/gallery');
      if (!response.ok) throw new Error('갤러리 조회 실패');
      return response.json();
    },
    enabled: isGalleryDialogOpen
  });

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/missions', missionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/missions'] });
      toast({
        title: "제출 완료",
        description: "세부 미션이 성공적으로 제출되었습니다.",
      });
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

  const getMissionStatusBadge = () => {
    if (!mission) return null;
    
    const periodStatus = getMissionPeriodStatus(mission.startDate, mission.endDate);
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
      rejected: { label: "거절됨", variant: "destructive" }
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
      rejected: { label: "거절됨", variant: "destructive", icon: XCircle },
      pending: { label: "검토 대기", variant: "secondary", icon: Clock },
    };

    const config = statusConfig[status || 'not_started'];
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('ko-KR');
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
            className={`truncate max-w-[200px] text-left ${
              node.isUnlocked 
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
          <span className={`text-xs shrink-0 ${
            node.status === 'approved' ? 'text-green-600' :
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full px-4 py-8">
        {/* Back Buttons */}
        <div className="flex items-center gap-2 mb-4">
          {mission.rootMission && !mission.isRootMission && (
            <Link href={`/missions/${mission.rootMission.missionId}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                주제 미션으로
              </Button>
            </Link>
          )}
          <Link href="/missions">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              미션 목록으로
            </Button>
          </Link>
        </div>

        {/* Mission Header */}
        <Card className="mb-6 overflow-hidden">
          {mission.headerImageUrl && (
            <div className="w-full h-64 overflow-hidden">
              <img
                src={mission.headerImageUrl}
                alt={mission.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <CardHeader>
            <div className="flex items-start justify-between gap-4 mb-4">
              <CardTitle className="text-2xl">{mission.title}</CardTitle>
              {getMissionStatusBadge()}
            </div>
            <div 
              className="text-base text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(mission.description || '') }}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">진행 상황</span>
                <span className="text-muted-foreground">
                  {mission.completedSubMissions} / {mission.totalSubMissions} 완료
                </span>
              </div>
              <Progress value={mission.progressPercentage} className="h-2" />
              <div className="text-right text-sm text-muted-foreground">
                {mission.progressPercentage}%
              </div>
            </div>

            {/* Mission Tree (1차 미션에서만 표시) */}
            {mission.isRootMission && mission.missionTree && (mission.totalMissionCount ?? 1) > 1 && (
              <div className="pt-4 border-t">
                <div className="flex items-center gap-2 mb-3">
                  <FolderTree className="h-4 w-4 text-purple-600" />
                  <span className="text-sm font-medium">전체미션</span>
                  <Badge variant="outline" className="text-xs">
                    {mission.totalMissionCount}개
                  </Badge>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 overflow-x-auto">
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

            {/* Meta Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              {mission.category && (
                <div className="flex items-center gap-2 text-sm">
                  <Target className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">카테고리:</span>
                  <Badge variant="secondary">{mission.category.name}</Badge>
                </div>
              )}
              {mission.hospital && (
                <div className="flex items-center gap-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">병원:</span>
                  <span className="text-muted-foreground">{mission.hospital.name}</span>
                </div>
              )}
              {(mission.startDate || mission.endDate) && (
                <div className="flex items-center gap-2 text-sm md:col-span-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">기간:</span>
                  <span className="text-muted-foreground">
                    {formatDate(mission.startDate)} ~ {formatDate(mission.endDate) || '제한 없음'}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sub Missions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">세부 미션</h2>
          
          {mission.subMissions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                등록된 세부 미션이 없습니다.
              </CardContent>
            </Card>
          ) : (
            <Accordion type="single" collapsible className="space-y-4">
              {mission.subMissions.map((subMission, index) => {
                const types = getSubmissionTypes(subMission);
                const isApproved = subMission.submission?.status === 'approved';
                const isLocked = subMission.submission?.isLocked;
                const isPending = subMission.submission && !isApproved && !isLocked;

                return (
                  <AccordionItem
                    key={subMission.id}
                    value={`sub-${subMission.id}`}
                    className="border rounded-lg bg-card"
                  >
                    <AccordionTrigger className="px-4 hover:no-underline">
                      <div className="flex items-start gap-4 text-left w-full">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center font-semibold text-purple-600 dark:text-purple-300">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{subMission.title}</h3>
                            <div className="flex items-center gap-1">
                              {types.map((type, idx) => {
                                const TypeIcon = getSubmissionTypeIcon(type);
                                return <TypeIcon key={idx} className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
                              })}
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {getSubMissionStatusBadge(subMission.submission?.status || 'not_started')}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 pt-4 border-t">
                        {/* Full Description */}
                        {subMission.description && (
                          <div 
                            className="text-sm whitespace-pre-wrap p-3 bg-muted/30 rounded-lg"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(subMission.description) }}
                          />
                        )}

                        {/* Submission Info */}
                        {subMission.requireReview && (
                          <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                            <AlertCircle className="h-4 w-4" />
                            <span>이 미션은 관리자 검토가 필요합니다</span>
                          </div>
                        )}

                        {/* Review Notes (if rejected) */}
                        {subMission.submission?.status === 'rejected' && subMission.submission.reviewNotes && (
                          <div className="bg-destructive/10 border border-destructive/20 p-3 rounded text-sm">
                            <p className="font-medium text-destructive mb-1">거절 사유:</p>
                            <p className="text-destructive/90">{subMission.submission.reviewNotes}</p>
                          </div>
                        )}

                        {/* Submission Form */}
                        <SubmissionForm
                          subMission={subMission}
                          missionId={missionId!}
                          onSubmit={(data) => {
                            submitMutation.mutate({
                              subMissionId: subMission.id,
                              submissionData: data,
                            });
                          }}
                          isSubmitting={submitMutation.isPending}
                          isLocked={isLocked || isApproved}
                          missionStartDate={mission.startDate}
                          missionEndDate={mission.endDate}
                          onOpenGallery={(subMissionId) => {
                            setCurrentSubMissionId(subMissionId);
                            setIsGalleryDialogOpen(true);
                          }}
                        />
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </div>

      {/* Gallery Selection Dialog */}
      <Dialog open={isGalleryDialogOpen} onOpenChange={setIsGalleryDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>갤러리에서 이미지 선택</DialogTitle>
            <DialogDescription>
              갤러리에 저장된 이미지 중 하나를 선택하세요
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingGallery ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 py-4">
              {[...Array(12)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : galleryImages.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-muted-foreground">갤러리에 이미지가 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">먼저 이미지를 생성해주세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 py-4">
              {galleryImages.map((image: any) => (
                <button
                  key={image.id}
                  onClick={() => {
                    const imageUrl = image.transformedUrl || image.originalUrl || image.url;
                    
                    const event = new CustomEvent('gallery-image-selected', {
                      detail: { imageUrl, subMissionId: currentSubMissionId }
                    });
                    window.dispatchEvent(event);
                    
                    setIsGalleryDialogOpen(false);
                    toast({
                      title: "이미지 선택됨",
                      description: "선택한 이미지가 적용되었습니다"
                    });
                  }}
                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-purple-500 hover:scale-105 transition-all group"
                >
                  <img
                    src={image.thumbnailUrl || image.url}
                    alt={image.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <CheckCircle className="h-8 w-8 text-white bg-purple-600 rounded-full p-1" />
                  </div>
                  <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded">
                    {image.type.replace('_img', '')}
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
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

function SubmissionForm({ subMission, missionId, onSubmit, isSubmitting, isLocked, missionStartDate, missionEndDate, onOpenGallery }: SubmissionFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    const existingSlots = subMission.submission?.submissionData?.slots;
    if (existingSlots && Array.isArray(existingSlots)) {
      return existingSlots.map((slot: any) => ({
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
    }
    if (subMission.submission?.submissionData && !existingSlots) {
      const legacyData = subMission.submission.submissionData;
      return availableTypes.map(() => ({
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
    }
    return availableTypes.map(() => createEmptySlotData());
  });
  
  const [uploadingFile, setUploadingFile] = useState(false);
  const [studioPickerOpen, setStudioPickerOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const { data: studioProjects = [], isLoading: isLoadingStudioProjects } = useQuery<any[]>({
    queryKey: ['/api/products/studio-gallery'],
    queryFn: async () => {
      const response = await fetch('/api/products/studio-gallery?category=all&limit=50');
      if (!response.ok) throw new Error('제작소 작업물 조회 실패');
      const result = await response.json();
      return result.data || [];
    },
    enabled: studioPickerOpen
  });

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

  // 미션 기간 체크
  const checkPeriod = () => {
    if (!missionStartDate || !missionEndDate) {
      return { isValid: true, message: '' };
    }

    const now = new Date();
    const start = new Date(missionStartDate);
    const end = new Date(missionEndDate);
    
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    
    if (now < start) {
      return {
        isValid: false,
        message: `미션은 ${new Date(missionStartDate).toLocaleDateString('ko-KR')}부터 시작됩니다.`
      };
    }
    
    if (now > end) {
      return {
        isValid: false,
        message: `미션 기간이 ${new Date(missionEndDate).toLocaleDateString('ko-KR')}에 종료되었습니다.`
      };
    }
    
    return { isValid: true, message: '' };
  };

  const periodCheck = checkPeriod();

  // 제출 데이터가 변경되면 슬롯 데이터 업데이트
  useEffect(() => {
    if (subMission.submission?.submissionData) {
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

  // 제작소 작업물 선택 및 PDF 생성 핸들러
  const handleStudioSelect = async (project: any) => {
    setStudioPickerOpen(false);
    
    updateCurrentSlot({
      studioProjectId: project.id,
      studioPreviewUrl: project.thumbnailUrl || '',
      studioProjectTitle: project.title || '작업물',
      studioPdfUrl: '',
    });
    
    toast({
      title: "작업물 선택됨",
      description: "PDF 생성 중..."
    });
    
    setIsGeneratingPdf(true);
    
    try {
      const response = await fetch(`/api/products/projects/${project.id}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('프로젝트 정보 조회 실패');
      }
      
      const projectResult = await response.json();
      const projectData = projectResult.data;
      
      if (!projectData?.designsData?.designs || projectData.designsData.designs.length === 0) {
        toast({
          title: "PDF 생성 실패",
          description: "작업물에 디자인 데이터가 없습니다.",
          variant: "destructive"
        });
        setIsGeneratingPdf(false);
        return;
      }
      
      const variantConfig = projectData.designsData?.variantConfig || projectData.variant || {
        widthMm: 148,
        heightMm: 210,
        bleedMm: 3,
        dpi: 300
      };
      
      // 세부미션에 설정된 DPI 사용 (기본값 300)
      const studioDpi = (subMission as any).studioDpi || 300;
      
      const pdfBlob = await generatePdfBlob(
        projectData.designsData.designs,
        variantConfig,
        { format: 'pdf', qualityValue: String(studioDpi), dpi: studioDpi, includeBleed: true }
      );
      
      const formData = new FormData();
      formData.append('file', pdfBlob, `${project.title || 'submission'}.pdf`);
      
      const uploadResponse = await fetch('/api/missions/upload-pdf', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      
      if (!uploadResponse.ok) {
        throw new Error('PDF 업로드 실패');
      }
      
      const uploadResult = await uploadResponse.json();
      
      if (uploadResult.success && uploadResult.pdfUrl) {
        updateCurrentSlot({
          studioPdfUrl: uploadResult.pdfUrl,
        });
        toast({
          title: "PDF 생성 완료",
          description: "작업물 PDF가 생성되었습니다."
        });
      } else {
        throw new Error(uploadResult.error || 'PDF 업로드 실패');
      }
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      toast({
        title: "PDF 생성 실패",
        description: error instanceof Error ? error.message : "작업물 PDF 생성 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsGeneratingPdf(false);
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // studio_submit 타입인데 PDF가 아직 생성 중이면 제출 차단
    if (selectedSubmissionType === 'studio_submit' && currentSlotData.studioProjectId && !currentSlotData.studioPdfUrl) {
      toast({
        title: "PDF 생성 중",
        description: "PDF 생성이 완료될 때까지 잠시 기다려주세요.",
        variant: "destructive"
      });
      return;
    }
    
    // 최소 하나 이상의 슬롯이 채워졌는지 확인
    const filledCount = getFilledSlotsCount();
    if (filledCount === 0) {
      toast({
        title: "제출 실패",
        description: "최소 하나 이상의 항목을 입력해주세요.",
        variant: "destructive"
      });
      return;
    }

    // 첫 번째 채워진 슬롯 찾기 (레거시 호환성)
    const firstFilledIndex = slotsData.findIndex((_, index) => isSlotFilled(index));
    const firstFilledSlot = firstFilledIndex >= 0 ? slotsData[firstFilledIndex] : null;
    const firstFilledType = firstFilledIndex >= 0 ? availableTypes[firstFilledIndex] : null;

    // 슬롯 데이터를 배열로 제출 + 레거시 필드 포함
    // linkUrl에 대해 자동으로 https:// prefix 추가
    const normalizedSlotsData = slotsData.map((slot, index) => ({
      ...slot,
      linkUrl: availableTypes[index] === 'link' ? normalizeUrl(slot.linkUrl) : slot.linkUrl
    }));

    const submissionData: any = {
      slots: normalizedSlotsData.map((slot, index) => ({
        index,
        type: availableTypes[index],
        ...slot
      })),
      filledSlotsCount: filledCount,
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

    onSubmit(submissionData);
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
          <div className="flex flex-wrap gap-2">
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
                  className={`relative ${isSelected ? "ring-2 ring-purple-500" : ""} ${isFilled && !isSelected ? "border-green-500" : ""}`}
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
            placeholder="www.example.com 또는 https://example.com"
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
        <div className="space-y-2">
          <label className="text-sm font-medium">{getSubmissionLabelByIndex(selectedTypeIndex, 'studio_submit')}</label>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => setStudioPickerOpen(true)}
            disabled={isSubmitting || isGeneratingPdf}
          >
            {isGeneratingPdf ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                PDF 생성 중...
              </>
            ) : (
              <>
                <Palette className="h-4 w-4 mr-2" />
                제작소에서 작업물 선택
              </>
            )}
          </Button>
          {currentSlotData.studioProjectId && (
            <div className="space-y-2">
              {currentSlotData.studioPreviewUrl && (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                  <img src={currentSlotData.studioPreviewUrl} alt="선택된 작업물" className="object-cover w-full h-full" />
                </div>
              )}
              <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>PDF 생성 중: {currentSlotData.studioProjectTitle}</span>
                    </>
                  ) : currentSlotData.studioPdfUrl ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>PDF 생성 완료: {currentSlotData.studioProjectTitle}</span>
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
                  PDF가 준비되었습니다
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Studio Picker Dialog */}
      <Dialog open={studioPickerOpen} onOpenChange={setStudioPickerOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>제작소에서 작업물 선택</DialogTitle>
            <DialogDescription>
              제작소에서 만든 작업물 중 하나를 선택하세요
            </DialogDescription>
          </DialogHeader>
          
          {isLoadingStudioProjects ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-4">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : studioProjects.length === 0 ? (
            <div className="text-center py-12">
              <Palette className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-muted-foreground">제작소에 작업물이 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">먼저 제작소에서 작업물을 만들어주세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 py-4">
              {studioProjects.map((project: any) => (
                <button
                  key={project.id}
                  onClick={() => handleStudioSelect(project)}
                  className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200 hover:border-purple-500 hover:scale-105 transition-all group"
                >
                  {project.thumbnailUrl ? (
                    <img
                      src={project.thumbnailUrl}
                      alt={project.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Palette className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <CheckCircle className="h-8 w-8 text-white bg-purple-600 rounded-full p-1" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 truncate">
                    {project.title}
                  </div>
                  <div className="absolute top-1 left-1 bg-purple-500/80 text-white text-xs px-1.5 py-0.5 rounded">
                    {project.category}
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Text Content */}
      {(selectedSubmissionType === 'text' || selectedSubmissionType === 'review') && (
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
      )}

      {/* Rating (for review type) */}
      {selectedSubmissionType === 'review' && (
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
                  className={`h-6 w-6 ${
                    star <= currentSlotData.rating
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
      )}

      {/* Memo (optional for all types) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">메모 (선택사항)</label>
        <Textarea
          placeholder="추가 메모가 있으시면 입력해주세요"
          value={currentSlotData.memo}
          onChange={(e) => updateCurrentSlot({ memo: e.target.value })}
          disabled={isSubmitting}
          rows={2}
        />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        disabled={uploadingFile || isSubmitting || isGeneratingPdf}
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
    </form>
  );
}
