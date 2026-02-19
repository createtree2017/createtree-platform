import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import {
    Trophy,
    History,
    Target,
    Calendar,
    Building2,
    ChevronRight,
    Loader2,
    Gift,
    CheckCircle2,
    Clock,
    FolderTree,
    Star,
} from "lucide-react";

interface BigMission {
    id: number;
    title: string;
    description?: string;
    headerImageUrl?: string;
    iconUrl?: string;
    visibilityType: string;
    hospitalId?: number;
    startDate?: string;
    endDate?: string;
    giftImageUrl?: string;
    giftDescription?: string;
    completedTopics: number;
    totalTopics: number;
    progressPercent: number;
    status: string;
    hasGift: boolean;
    hospital?: { id: number; name: string };
}

interface HistoryMission {
    id: number;
    missionId: string;
    title: string;
    description: string;
    headerImageUrl?: string;
    visibilityType: string;
    hospitalId?: number;
    startDate?: string;
    endDate?: string;
    isActive: boolean;
    order: number;
    category?: { categoryId: string; name: string };
    hospital?: { id: number; name: string };
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

type TabType = "big-missions" | "history";

// 기본 아이콘 (iconUrl 없을 시 사용)
const DEFAULT_ICON = "/icons/icon-192x192.png";

export default function MyMissionsPage() {
    const [activeTab, setActiveTab] = useState<TabType>("big-missions");
    const [historyFilter, setHistoryFilter] = useState<string>("all");
    const { user } = useAuth();

    // 큰미션 목록
    const { data: bigMissions = [], isLoading: bigMissionsLoading } = useQuery<BigMission[]>({
        queryKey: ["/api/big-missions"],
    });

    // 미션 히스토리
    const { data: historyMissions = [], isLoading: historyLoading } = useQuery<HistoryMission[]>({
        queryKey: ["/api/missions/history"],
        enabled: activeTab === "history",
    });

    // 히스토리 필터링
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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle2 className="h-3 w-3" /> 완료
                    </span>
                );
            case "in_progress":
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                        <Clock className="h-3 w-3" /> 진행중
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                        미시작
                    </span>
                );
        }
    };

    const tabs = [
        { key: "big-missions" as TabType, label: "컬렉션", icon: Trophy },
        { key: "history" as TabType, label: "히스토리", icon: History },
    ];

    return (
        <div className="min-h-screen bg-background">
            <div className="w-full px-4 py-6">
                {/* Header */}
                <div className="mb-6">
                    {(user as any)?.hospital?.name && (
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-3 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30">
                            <Building2 className="h-3.5 w-3.5 text-amber-500" />
                            <span className="text-sm font-medium text-amber-600 dark:text-amber-300">
                                {(user as any).hospital.name}
                            </span>
                        </div>
                    )}
                    <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-amber-500 to-orange-500 bg-clip-text text-transparent">
                        나의 미션
                    </h1>
                    <p className="text-muted-foreground">
                        컬렉션을 완성하고 특별한 보상을 받아보세요
                    </p>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 mb-6 p-1 bg-muted/50 rounded-xl">
                    {tabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all ${activeTab === tab.key
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                    }`}
                            >
                                <Icon className="h-4 w-4" />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Big Missions Tab */}
                {activeTab === "big-missions" && (
                    <>
                        {bigMissionsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                            </div>
                        ) : bigMissions.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                                    <p className="text-muted-foreground text-lg mb-2">
                                        아직 등록된 컬렉션이 없습니다
                                    </p>
                                    <p className="text-sm text-muted-foreground mb-4">
                                        새로운 컬렉션이 곧 추가될 예정이에요!
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-4">
                                {bigMissions.map((mission) => (
                                    <Link
                                        key={mission.id}
                                        href={`/mymissions/${mission.id}`}
                                        className="block"
                                    >
                                        <Card className="overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-amber-500/50 group">
                                            <div className="flex">
                                                {/* 이미지 영역 */}
                                                <div className="w-28 h-28 sm:w-36 sm:h-36 flex-shrink-0 bg-gradient-to-br from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 flex items-center justify-center overflow-hidden">
                                                    {mission.headerImageUrl ? (
                                                        <img
                                                            src={mission.headerImageUrl}
                                                            alt={mission.title}
                                                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        />
                                                    ) : (
                                                        <img
                                                            src={mission.iconUrl || DEFAULT_ICON}
                                                            alt={mission.title}
                                                            className="w-16 h-16 opacity-60"
                                                        />
                                                    )}
                                                </div>

                                                {/* 콘텐츠 영역 */}
                                                <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            {getStatusBadge(mission.status)}
                                                            {mission.hasGift && (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                                                    <Gift className="h-3 w-3" /> 보상
                                                                </span>
                                                            )}
                                                        </div>
                                                        <h3 className="font-bold text-base mb-1 truncate">
                                                            {mission.title}
                                                        </h3>
                                                        {mission.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                                {mission.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* 진행률 */}
                                                    <div className="mt-2">
                                                        <div className="flex justify-between text-xs mb-1">
                                                            <span className="text-muted-foreground">진행률</span>
                                                            <span className="font-medium text-amber-600 dark:text-amber-400">
                                                                {mission.completedTopics}/{mission.totalTopics}
                                                            </span>
                                                        </div>
                                                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-500 ${mission.status === "completed"
                                                                        ? "bg-gradient-to-r from-green-400 to-green-500"
                                                                        : "bg-gradient-to-r from-amber-400 to-orange-500"
                                                                    }`}
                                                                style={{ width: `${mission.progressPercent}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 화살표 */}
                                                <div className="flex items-center pr-3">
                                                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-amber-500 transition-colors" />
                                                </div>
                                            </div>
                                        </Card>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* History Tab */}
                {activeTab === "history" && (
                    <>
                        {/* 히스토리 필터 */}
                        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                            {[
                                { key: "all", label: "전체" },
                                { key: "in_progress", label: "진행중" },
                                { key: "completed", label: "완료" },
                                { key: "closed", label: "마감" },
                            ].map((filter) => (
                                <button
                                    key={filter.key}
                                    onClick={() => setHistoryFilter(filter.key)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${historyFilter === filter.key
                                            ? "bg-amber-500 text-white"
                                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                                        }`}
                                >
                                    {filter.label}
                                </button>
                            ))}
                        </div>

                        {historyLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                            </div>
                        ) : filteredHistory.length === 0 ? (
                            <Card>
                                <CardContent className="py-12 text-center">
                                    <History className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                                    <p className="text-muted-foreground text-lg mb-2">
                                        {historyFilter === "all"
                                            ? "아직 참여한 미션이 없습니다"
                                            : "해당 조건의 미션이 없습니다"}
                                    </p>
                                    <Link href="/missions">
                                        <Button variant="outline" className="gap-2 mt-2">
                                            <Target className="h-4 w-4" />
                                            문화센터 둘러보기
                                        </Button>
                                    </Link>
                                </CardContent>
                            </Card>
                        ) : (
                            <>
                                <div className="mb-4 text-sm text-muted-foreground">
                                    총 {filteredHistory.length}개 미션
                                </div>
                                <div className="grid gap-4">
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
                                                                                : "bg-amber-500"
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
                                                                    <Target className="h-3 w-3" />
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
