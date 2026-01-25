import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { sanitizeHtml } from "@/lib/utils";
import { formatSimpleDate } from "@/lib/dateUtils";
import { MissionBadges } from "@/lib/missionUtils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Target, Calendar, Building2, ChevronRight, Loader2, FolderTree, ClipboardList } from "lucide-react";

interface ThemeMission {
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
  order: number;
  category?: {
    categoryId: string;
    name: string;
  };
  hospital?: {
    id: number;
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
  totalMissionCount?: number;
  hasGift?: boolean;
}

export default function MyMissionsPage() {
  const { data: missions = [], isLoading } = useQuery<ThemeMission[]>({
    queryKey: ['/api/missions/my'],
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            나의 미션
          </h1>
          <p className="text-muted-foreground">
            내가 참여한 미션을 확인하세요
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : missions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <ClipboardList className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground text-lg mb-4">
                아직 참여한 미션이 없습니다
              </p>
              <Link href="/missions">
                <Button variant="default" className="gap-2">
                  <Target className="h-4 w-4" />
                  미션 둘러보기
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="mb-6 text-sm text-muted-foreground">
              총 {missions.length}개 미션 참여 중
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {missions.map((mission) => (
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
                      <MissionBadges 
                        startDate={mission.startDate} 
                        endDate={mission.endDate} 
                        hasGift={mission.hasGift} 
                      />
                      <CardTitle className="text-lg">{mission.title}</CardTitle>
                    </div>
                    <div 
                      className="text-sm text-muted-foreground line-clamp-2"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(mission.description || '') }}
                    />
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
                      {mission.hospital && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>{mission.hospital.name}</span>
                        </div>
                      )}
                      {(mission.startDate || mission.endDate) && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            {formatSimpleDate(mission.startDate)} ~ {formatSimpleDate(mission.endDate) || '제한 없음'}
                          </span>
                        </div>
                      )}
                    </div>

                    {(mission.totalMissionCount ?? 1) > 1 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FolderTree className="h-4 w-4" />
                        <span>전체미션 {mission.totalMissionCount}개</span>
                      </div>
                    )}

                    <Link href={`/missions/${mission.missionId}`} className="block">
                      <Button variant="outline" className="w-full gap-2">
                        미션 상세보기
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
