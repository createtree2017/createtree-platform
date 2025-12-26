import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Target, Calendar, ChevronRight, Loader2, ArrowLeft, FolderTree, Lock } from "lucide-react";

interface ChildMission {
  id: number;
  missionId: string;
  title: string;
  description?: string;
  categoryId?: string;
  headerImageUrl?: string;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  order: number;
  category?: {
    categoryId: string;
    name: string;
  };
  userProgress?: {
    status: string;
    progressPercent: number;
    completedSubMissions: number;
    totalSubMissions: number;
  };
  hasChildMissions?: boolean;
  childMissionCount?: number;
  isApprovedForChildAccess?: boolean;
}

interface ChildMissionsResponse {
  parentMission: {
    id: number;
    missionId: string;
    title: string;
  };
  childMissions: ChildMission[];
}

export default function MissionChildrenPage() {
  const params = useParams();
  const parentId = params.parentId;

  const { data, isLoading, error } = useQuery<ChildMissionsResponse>({
    queryKey: ['/api/missions', parentId, 'child-missions'],
    queryFn: async () => {
      const response = await fetch(`/api/missions/${parentId}/child-missions`, {
        credentials: 'include'
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || data.error || '하부미션 조회 실패');
      }
      return response.json();
    },
    enabled: !!parentId
  });

  const getStatusBadge = (mission: ChildMission) => {
    const userStatus = mission.userProgress?.status;

    if (userStatus === 'in_progress') {
      return <Badge className="bg-blue-500 text-white hover:bg-blue-600">진행 중</Badge>;
    }

    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      not_started: { label: "미시작", variant: "outline" },
      submitted: { label: "제출 완료", variant: "secondary" },
      approved: { label: "승인됨", variant: "default" },
      rejected: { label: "거절됨", variant: "destructive" }
    };

    const config = statusConfig[userStatus || 'not_started'];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <Card>
            <CardContent className="py-12 text-center">
              <Lock className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold mb-2">접근 권한이 없습니다</h2>
              <p className="text-muted-foreground mb-4">
                {(error as Error).message}
              </p>
              <Link href="/missions">
                <Button variant="outline">
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

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-6">
          <Link href="/missions">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              미션 목록으로
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <FolderTree className="h-6 w-6 text-purple-600" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              {data.parentMission.title}
            </h1>
          </div>
          <p className="text-muted-foreground">
            하부미션을 완료하고 추가 혜택을 받아보세요
          </p>
        </div>

        {data.childMissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              아직 하부미션이 없습니다
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {data.childMissions.map((mission) => (
              <Card key={mission.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  {mission.headerImageUrl && (
                    <div className="w-full h-40 rounded-md overflow-hidden mb-4">
                      <img 
                        src={mission.headerImageUrl} 
                        alt={mission.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="space-y-2 mb-2">
                    {getStatusBadge(mission)}
                    <CardTitle className="text-lg">{mission.title}</CardTitle>
                  </div>
                  {mission.description && (
                    <CardDescription className="line-clamp-2">
                      {mission.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {mission.userProgress && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">진행률</span>
                        <span className="font-medium">
                          {mission.userProgress.completedSubMissions} / {mission.userProgress.totalSubMissions}
                        </span>
                      </div>
                      <Progress value={mission.userProgress.progressPercent} />
                    </div>
                  )}

                  <div className="space-y-2 text-sm text-muted-foreground">
                    {mission.category && (
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <span>{mission.category.name}</span>
                      </div>
                    )}
                    {(mission.startDate || mission.endDate) && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDate(mission.startDate)} ~ {formatDate(mission.endDate) || '제한 없음'}
                        </span>
                      </div>
                    )}
                  </div>

                  {mission.hasChildMissions && (
                    <div className={`p-3 rounded-lg ${mission.isApprovedForChildAccess ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                      <div className="flex items-center gap-2">
                        {mission.isApprovedForChildAccess ? (
                          <FolderTree className="h-4 w-4 text-green-600" />
                        ) : (
                          <Lock className="h-4 w-4 text-gray-400" />
                        )}
                        <span className={`text-sm font-medium ${mission.isApprovedForChildAccess ? 'text-green-700' : 'text-gray-500'}`}>
                          하부미션 {mission.childMissionCount}개
                        </span>
                      </div>
                      {mission.isApprovedForChildAccess ? (
                        <Link href={`/missions/${mission.id}/children`} className="block mt-2">
                          <Button size="sm" variant="outline" className="w-full text-green-600 border-green-300 hover:bg-green-50">
                            하부미션 보기
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      ) : (
                        <p className="text-xs text-gray-400 mt-2">
                          미션 승인 후 하부미션에 접근할 수 있습니다
                        </p>
                      )}
                    </div>
                  )}

                  <Link href={`/missions/${mission.missionId}`} className="block mt-4">
                    <Button className="w-full" variant="outline">
                      자세히 보기
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
