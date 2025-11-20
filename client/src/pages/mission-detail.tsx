import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";

interface SubMission {
  id: number;
  themeMissionId: number;
  title: string;
  description?: string;
  submissionType: string;
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
}

export default function MissionDetailPage() {
  const { missionId } = useParams<{ missionId: string }>();
  const { toast } = useToast();
  const [expandedSubmission, setExpandedSubmission] = useState<number | null>(null);

  const { data: mission, isLoading, error } = useQuery<MissionDetail>({
    queryKey: ['/api/missions', missionId],
    queryFn: async () => {
      const response = await apiRequest(`/api/missions/${missionId}`);
      return await response.json();
    },
    enabled: !!missionId
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

  const getStatusBadge = (status?: string) => {
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

  const getSubmissionTypeIcon = (type: string) => {
    const icons = {
      file: Upload,
      link: LinkIcon,
      text: FileText,
      review: Star,
      image: ImageIcon,
    };
    return icons[type as keyof typeof icons] || FileText;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <Card>
            <CardContent className="py-12 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">미션을 찾을 수 없습니다</h2>
              <p className="text-muted-foreground mb-4">
                {error instanceof Error ? error.message : "미션 정보를 불러오는 중 오류가 발생했습니다."}
              </p>
              <Link href="/missions">
                <Button>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  미션 목록으로
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back Button */}
        <Link href="/missions">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            미션 목록으로
          </Button>
        </Link>

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
              {getStatusBadge(
                mission.completedSubMissions === mission.totalSubMissions
                  ? 'approved'
                  : mission.completedSubMissions > 0
                  ? 'in_progress'
                  : 'not_started'
              )}
            </div>
            <CardDescription className="text-base">
              {mission.description}
            </CardDescription>
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
                const Icon = getSubmissionTypeIcon(subMission.submissionType);
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
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold">{subMission.title}</h3>
                            <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          </div>
                          {subMission.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {subMission.description}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0">
                          {getStatusBadge(subMission.submission?.status || 'not_started')}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 pb-4">
                      <div className="space-y-4 pt-4 border-t">
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
}

function SubmissionForm({ subMission, missionId, onSubmit, isSubmitting, isLocked, missionStartDate, missionEndDate }: SubmissionFormProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    fileUrl: subMission.submission?.submissionData?.fileUrl || '',
    linkUrl: subMission.submission?.submissionData?.linkUrl || '',
    textContent: subMission.submission?.submissionData?.textContent || '',
    rating: subMission.submission?.submissionData?.rating || 5,
    memo: subMission.submission?.submissionData?.memo || '',
    imageUrl: subMission.submission?.submissionData?.imageUrl || '',
    mimeType: subMission.submission?.submissionData?.mimeType || '',
  });
  
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('');

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

  // 제출 데이터가 변경되면 폼 데이터 업데이트
  useEffect(() => {
    if (subMission.submission?.submissionData) {
      setFormData({
        fileUrl: subMission.submission.submissionData.fileUrl || '',
        linkUrl: subMission.submission.submissionData.linkUrl || '',
        textContent: subMission.submission.submissionData.textContent || '',
        rating: subMission.submission.submissionData.rating || 5,
        memo: subMission.submission.submissionData.memo || '',
        imageUrl: subMission.submission.submissionData.imageUrl || '',
      });
    }
  }, [subMission.submission]);

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

    // 이미지 파일인지 확인
    if (!file.type.startsWith('image/')) {
      toast({
        title: "잘못된 파일 형식",
        description: "이미지 파일만 업로드 가능합니다.",
        variant: "destructive"
      });
      return;
    }

    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/missions/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '파일 업로드 실패');
      }

      const result = await response.json();
      
      // 타입에 따라 적절한 필드에 저장
      if (targetType === 'file') {
        setFormData(prev => ({ 
          ...prev, 
          fileUrl: result.fileUrl,
          mimeType: result.mimeType
        }));
      } else {
        setFormData(prev => ({ 
          ...prev, 
          imageUrl: result.fileUrl,
          mimeType: result.mimeType
        }));
      }
      setUploadedFileName(result.fileName || file.name);
      
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
    
    const submissionData: any = {
      submissionType: subMission.submissionType,
    };

    switch (subMission.submissionType) {
      case 'file':
        if (!formData.fileUrl) {
          alert('파일을 업로드해주세요.');
          return;
        }
        submissionData.fileUrl = formData.fileUrl;
        submissionData.fileName = uploadedFileName;
        submissionData.mimeType = formData.mimeType;
        submissionData.memo = formData.memo;
        break;
      case 'link':
        if (!formData.linkUrl) {
          alert('링크 URL을 입력해주세요.');
          return;
        }
        submissionData.linkUrl = formData.linkUrl;
        submissionData.memo = formData.memo;
        break;
      case 'text':
        if (!formData.textContent) {
          alert('텍스트 내용을 입력해주세요.');
          return;
        }
        submissionData.textContent = formData.textContent;
        submissionData.memo = formData.memo;
        break;
      case 'review':
        if (!formData.textContent) {
          alert('리뷰 내용을 입력해주세요.');
          return;
        }
        submissionData.textContent = formData.textContent;
        submissionData.rating = formData.rating;
        submissionData.memo = formData.memo;
        break;
      case 'image':
        if (!formData.imageUrl) {
          alert('이미지를 업로드하거나 선택해주세요.');
          return;
        }
        submissionData.imageUrl = formData.imageUrl;
        submissionData.fileName = uploadedFileName;
        submissionData.mimeType = formData.mimeType;
        submissionData.memo = formData.memo;
        break;
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
      {/* File Upload */}
      {subMission.submissionType === 'file' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">파일 업로드</label>
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
            {formData.fileUrl && (
              <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                  <CheckCircle className="h-4 w-4" />
                  <span>업로드 완료: {uploadedFileName || '파일'}</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFormData({ ...formData, fileUrl: '' });
                    setUploadedFileName('');
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
      {subMission.submissionType === 'image' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">이미지 선택</label>
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
                onClick={() => {
                  window.open('/gallery-simplified', '_blank');
                  toast({
                    title: "갤러리 열기",
                    description: "새 탭에서 갤러리를 열었습니다. 이미지를 복사한 후 붙여넣기 하세요."
                  });
                }}
                disabled={isSubmitting}
              >
                <ImageIcon className="h-4 w-4 mr-2" />
                갤러리에서 선택
              </Button>
            </div>
            {formData.imageUrl && (
              <div className="space-y-2">
                <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
                  <img
                    src={formData.imageUrl}
                    alt="업로드된 이미지"
                    className="w-full h-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2"
                    onClick={() => {
                      setFormData({ ...formData, imageUrl: '' });
                      setUploadedFileName('');
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
      {subMission.submissionType === 'link' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">링크 URL</label>
          <Input
            type="url"
            placeholder="https://example.com"
            value={formData.linkUrl}
            onChange={(e) => setFormData({ ...formData, linkUrl: e.target.value })}
            disabled={isSubmitting}
          />
        </div>
      )}

      {/* Text Content */}
      {(subMission.submissionType === 'text' || subMission.submissionType === 'review') && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            {subMission.submissionType === 'review' ? '리뷰 내용' : '텍스트 내용'}
          </label>
          <Textarea
            placeholder={subMission.submissionType === 'review' ? '리뷰를 작성해주세요' : '내용을 입력하세요'}
            value={formData.textContent}
            onChange={(e) => setFormData({ ...formData, textContent: e.target.value })}
            disabled={isSubmitting}
            rows={5}
          />
        </div>
      )}

      {/* Rating (for review type) */}
      {subMission.submissionType === 'review' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">별점</label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFormData({ ...formData, rating: star })}
                disabled={isSubmitting}
                className="transition-colors"
              >
                <Star
                  className={`h-6 w-6 ${
                    star <= formData.rating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
              </button>
            ))}
            <span className="ml-2 text-sm text-muted-foreground">
              {formData.rating}점
            </span>
          </div>
        </div>
      )}

      {/* Memo (optional for all types) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">메모 (선택사항)</label>
        <Textarea
          placeholder="추가 메모가 있으시면 입력해주세요"
          value={formData.memo}
          onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
          disabled={isSubmitting}
          rows={2}
        />
      </div>

      {/* Submit Button */}
      <Button
        type="submit"
        className="w-full"
        disabled={isSubmitting}
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
