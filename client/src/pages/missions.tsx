import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { sanitizeHtml } from "@/lib/utils";
import { formatSimpleDate, getPeriodStatus } from "@/lib/dateUtils";
import { MissionBadges } from "@/lib/missionUtils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Building2, Loader2, FolderTree } from "lucide-react";

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
  isApprovedForChildAccess?: boolean;
  hasGift?: boolean;
  capacity?: number | null;
  currentApplicants?: number;
  applicationPeriod?: {
    startDate?: string;
    endDate?: string;
  } | null;
}

type TabType = 'active' | 'upcoming' | 'closed';

export default function MissionsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const { user } = useAuth();

  const { data: missions = [], isLoading: missionsLoading } = useQuery<ThemeMission[]>({
    queryKey: ['/api/missions'],
  });

  // 미션을 상태별로 분류
  const categorizedMissions = useMemo(() => {
    const active: ThemeMission[] = [];
    const upcoming: ThemeMission[] = [];
    const closed: ThemeMission[] = [];

    missions.forEach(mission => {
      const status = getPeriodStatus(mission.startDate, mission.endDate);
      if (status === 'active') {
        active.push(mission);
      } else if (status === 'upcoming') {
        upcoming.push(mission);
      } else {
        closed.push(mission);
      }
    });

    return { active, upcoming, closed };
  }, [missions]);

  const currentMissions = categorizedMissions[activeTab];

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'active', label: '진행중', count: categorizedMissions.active.length },
    { key: 'upcoming', label: '준비중', count: categorizedMissions.upcoming.length },
    { key: 'closed', label: '마감', count: categorizedMissions.closed.length },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          {/* 사용자 멤버쉽 병원 배지 */}
          {(user as any)?.hospital?.name && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 rounded-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 dark:border-purple-400/30">
              <Building2 className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
              <span className="text-sm font-medium text-purple-600 dark:text-purple-300">
                {(user as any).hospital.name}
              </span>
            </div>
          )}
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">문화센터를 즐기다</h1>
          <p className="text-muted-foreground">
            다양한 미션을 완료하고 특별한 혜택을 받아보세요
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 font-medium text-sm transition-colors relative ${activeTab === tab.key
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-muted-foreground hover:text-foreground'
                }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${activeTab === tab.key
                  ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                  {tab.count}
                </span>
              )}
              {activeTab === tab.key && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400" />
              )}
            </button>
          ))}
        </div>

        {/* Missions Grid */}
        {missionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : currentMissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {activeTab === 'active' && '진행중인 미션이 없습니다'}
              {activeTab === 'upcoming' && '준비중인 미션이 없습니다'}
              {activeTab === 'closed' && '마감된 미션이 없습니다'}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {currentMissions.map((mission) => (
              <Link href={`/missions/${mission.missionId}`} key={mission.id} className="block">
                <Card className="hover:shadow-lg transition-shadow cursor-pointer hover:border-purple-500/50">
                  <CardHeader>
                    {mission.headerImageUrl && (
                      <div className="w-full aspect-square rounded-md overflow-hidden mb-4">
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
                      className="text-sm text-muted-foreground line-clamp-3 overflow-visible"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(mission.description || '') }}
                    />
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 모집인원 바 */}
                    {mission.capacity ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">모집인원</span>
                          <span className="font-medium">
                            {mission.currentApplicants || 0} / {mission.capacity}명
                          </span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-300 dark:bg-gray-600">
                          <div
                            className="h-full bg-blue-500 transition-all"
                            style={{ width: `${Math.min(((mission.currentApplicants || 0) / mission.capacity) * 100, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        <span className="px-2 py-1 bg-green-500/10 text-green-600 dark:text-green-400 rounded">누구나 참여</span>
                      </div>
                    )}

                    {/* Meta info */}
                    <div className="space-y-2 text-sm text-muted-foreground">

                      {mission.hospital && (
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          <span>{mission.hospital.name}</span>
                        </div>
                      )}
                      {mission.applicationPeriod && (mission.applicationPeriod.startDate || mission.applicationPeriod.endDate) && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>
                            모집: {formatSimpleDate(mission.applicationPeriod.startDate)} ~ {formatSimpleDate(mission.applicationPeriod.endDate) || '제한 없음'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Total Missions Count */}
                    {(mission.totalMissionCount ?? 1) > 1 && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FolderTree className="h-4 w-4" />
                        <span>전체미션 {mission.totalMissionCount}개</span>
                      </div>
                    )}

                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
