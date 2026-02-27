import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { sanitizeHtml } from "@/lib/utils";
import { formatSimpleDate, formatSimpleDateWithDay, getPeriodStatus } from "@/lib/dateUtils";
import { MissionBadges } from "@/lib/missionUtils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Building2, Loader2, FolderTree, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  eventDate?: string | null;
  eventEndTime?: string | null;
}

type TabType = 'active' | 'upcoming' | 'closed';

export default function MissionsPage() {
  // 세션 스토리지에서 이전 탭 상태 불러오기 (초기값 지정)
  const [activeMainTab, setActiveMainTab] = useState<'culture' | 'history'>(() => {
    return (sessionStorage.getItem('missions_activeMainTab') as 'culture' | 'history') || 'culture';
  });

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    return (sessionStorage.getItem('missions_activeTab') as TabType) || 'active';
  });

  const [historyFilter, setHistoryFilter] = useState<string>(() => {
    return sessionStorage.getItem('missions_historyFilter') || "all";
  });

  // 상태가 변경될 때마다 세션 스토리지에 저장하여 뒤로가기 시 유지되도록 함
  useEffect(() => {
    sessionStorage.setItem('missions_activeMainTab', activeMainTab);
    sessionStorage.setItem('missions_activeTab', activeTab);
    sessionStorage.setItem('missions_historyFilter', historyFilter);
  }, [activeMainTab, activeTab, historyFilter]);

  const { user } = useAuth();

  // 기존 문화센터 쿼리
  const { data: missions = [], isLoading: missionsLoading } = useQuery<ThemeMission[]>({
    queryKey: ['/api/missions'],
  });

  // 미션 히스토리 쿼리 (새로 이식됨)
  const { data: historyMissions = [], isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["/api/missions/history"],
    enabled: activeMainTab === "history",
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

  // 히스토리 필터링 (새로 이식됨)
  const filteredHistory = historyMissions.filter((mission) => {
    if (historyFilter === "all") return true;
    if (historyFilter === "completed") return mission.userProgress?.status === "approved";
    if (historyFilter === "in_progress") {
      const periodStatus = getPeriodStatus(mission.startDate, mission.endDate);
      return mission.userProgress?.status !== "approved" && periodStatus === "active";
    }
    if (historyFilter === "closed") {
      const periodStatus = getPeriodStatus(mission.startDate, mission.endDate);
      return periodStatus === "closed" || !mission.isActive;
    }
    return true;
  });

  const currentMissions = categorizedMissions[activeTab];

  const tabs: { key: TabType; label: string; count: number }[] = [
    { key: 'active', label: '참여가능', count: categorizedMissions.active.length },
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

        {/* 메인 네비게이션 탭 (갤러리 버튼 스타일과 완전히 동일하게 맞춤) */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <Button
            onClick={() => setActiveMainTab('culture')}
            variant={activeMainTab === 'culture' ? "default" : "outline"}
            className={activeMainTab === 'culture'
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
              : "text-foreground"
            }
          >
            <Building2 className="mr-2 h-4 w-4" />
            문화센터
          </Button>
          <Button
            onClick={() => setActiveMainTab('history')}
            variant={activeMainTab === 'history' ? "default" : "outline"}
            className={activeMainTab === 'history'
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
              : "text-foreground"
            }
          >
            <FolderTree className="mr-2 h-4 w-4" />
            히스토리
          </Button>
        </div>

        {/* Culture Center Content */}
        {activeMainTab === 'culture' && (
          <>
            {/* Tab Navigation (진행중/준비중/마감) */}
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
                  <Link href={`/missions/${mission.missionId}`} key={mission.id} className="block h-full">
                    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow cursor-pointer hover:border-purple-500/50">
                      <CardHeader className="flex flex-row gap-4 items-start pb-6 space-y-0 relative">
                        <div className="flex-1 min-w-0 flex flex-col space-y-2">
                          <div className="space-y-4 mb-0">
                            <MissionBadges
                              startDate={mission.startDate}
                              endDate={mission.endDate}
                              hasGift={mission.hasGift}
                            />
                            <CardTitle className="text-xl break-words mt-1 leading-snug">{mission.title}</CardTitle>
                          </div>
                          <div
                            className="text-sm text-muted-foreground line-clamp-3 overflow-hidden break-words"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(mission.description || '') }}
                          />
                        </div>
                        {mission.headerImageUrl && (
                          <div className="w-28 h-28 sm:w-32 sm:h-32 shrink-0 rounded-2xl overflow-hidden bg-muted flex-none ml-2 shadow-sm border border-border">
                            <img
                              src={mission.headerImageUrl}
                              alt={mission.title}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
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
                          {(mission.eventDate || mission.eventEndTime) && (
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              <span>
                                행사: {mission.eventDate ? formatSimpleDateWithDay(mission.eventDate) : ''}
                                {mission.eventEndTime ? ` ~ ${formatSimpleDateWithDay(mission.eventEndTime)}` : ''}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Total Missions Count */}
                        {(mission.totalMissionCount ?? 1) > 1 && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4 border-t pt-3">
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
          </>
        )}

        {/* History Content */}
        {activeMainTab === 'history' && (
          <>
            {/* 히스토리 필터 (문화센터 하부 탭 스타일과 동일하게 + 카운트 배지 추가) */}
            <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
              {[
                { key: "all", label: "전체", count: historyMissions?.length || 0 },
                {
                  key: "in_progress", label: "진행중", count: historyMissions?.filter((m: any) => {
                    const status = getPeriodStatus(m.startDate, m.endDate);
                    return m.isActive && (status === "active" || status === "upcoming") && m.userProgress?.status !== "approved";
                  }).length || 0
                },
                { key: "completed", label: "완료", count: historyMissions?.filter((m: any) => m.userProgress?.status === "approved").length || 0 },
                {
                  key: "closed", label: "마감", count: historyMissions?.filter((m: any) => {
                    const status = getPeriodStatus(m.startDate, m.endDate);
                    return !m.isActive || status === "closed";
                  }).length || 0
                },
              ].map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setHistoryFilter(filter.key)}
                  className={`px-4 py-2 font-medium text-sm transition-colors relative ${historyFilter === filter.key
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  {filter.label}
                  {filter.count > 0 && (
                    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${historyFilter === filter.key
                      ? 'bg-purple-100 text-purple-600 dark:bg-purple-900 dark:text-purple-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                      {filter.count}
                    </span>
                  )}
                  {historyFilter === filter.key && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400" />
                  )}
                </button>
              ))}
            </div>

            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
              </div>
            ) : filteredHistory.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FolderTree className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-lg mb-2">
                    {historyFilter === "all"
                      ? "아직 참여한 미션이 없습니다"
                      : "해당 조건의 미션이 없습니다"}
                  </p>
                  <Button
                    variant="outline"
                    className="gap-2 mt-2"
                    onClick={() => setActiveMainTab('culture')}
                  >
                    <Building2 className="h-4 w-4" />
                    문화센터 둘러보기
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid gap-4 mt-2">
                  {filteredHistory.map((mission) => {
                    const periodStatus = getPeriodStatus(mission.startDate, mission.endDate);
                    const isExpired = periodStatus === "closed" || !mission.isActive;

                    return (
                      <Link
                        href={`/missions/${mission.missionId}`}
                        key={mission.id}
                        className="block"
                      >
                        <Card className={`hover:shadow-md transition-shadow ${isExpired ? "opacity-70" : ""}`}>
                          <CardHeader className="pb-2">
                            <div className="flex items-start gap-3">
                              {mission.headerImageUrl && (
                                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                                  <img
                                    src={mission.headerImageUrl}
                                    alt={mission.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <MissionBadges
                                    startDate={mission.startDate}
                                    endDate={mission.endDate}
                                    hasGift={mission.hasGift}
                                  />
                                  {!mission.isActive && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                      비활성
                                    </span>
                                  )}
                                  {mission.userProgress?.status === "approved" && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                      <CheckCircle2 className="h-3 w-3" /> 완료
                                    </span>
                                  )}
                                </div>
                                <CardTitle className="text-base">{mission.title}</CardTitle>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-2">
                            {/* 진행률 */}
                            {mission.userProgress && (
                              <div className="space-y-1 mb-3">
                                <div className="flex justify-between text-xs">
                                  <span className="text-muted-foreground">진행률</span>
                                  <span className="font-medium">
                                    {mission.userProgress.completedSubMissions}/
                                    {mission.userProgress.totalSubMissions}
                                  </span>
                                </div>
                                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                  <div
                                    className={`h-full rounded-full transition-all ${mission.userProgress.status === "approved"
                                      ? "bg-green-500"
                                      : "bg-purple-500"
                                      }`}
                                    style={{ width: `${mission.userProgress.progressPercent}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* 메타 */}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              {mission.category && (
                                <div className="flex items-center gap-1">
                                  <FolderTree className="h-3 w-3" />
                                  <span>{mission.category.name}</span>
                                </div>
                              )}
                              {(mission.startDate || mission.endDate) && (
                                <div className="flex items-center gap-1">
                                  <Calendar className="h-3 w-3" />
                                  <span>
                                    {formatSimpleDate(mission.startDate)} ~{" "}
                                    {formatSimpleDate(mission.endDate) || "제한없음"}
                                  </span>
                                </div>
                              )}
                              {(mission.totalMissionCount ?? 1) > 1 && (
                                <div className="flex items-center gap-1">
                                  <FolderTree className="h-3 w-3" />
                                  <span>{mission.totalMissionCount}개</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
