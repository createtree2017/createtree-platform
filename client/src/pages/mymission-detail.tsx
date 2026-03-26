import { useQuery } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    Trophy,
    CheckCircle2,
    Lock,
    Gift,
    ChevronLeft,
    Loader2,
    Target,
    ArrowRight,
} from "lucide-react";
import CreationTreeProgress from "@/components/ui/CreationTreeProgress";

interface BigMissionTopic {
    id: number;
    title: string;
    description?: string;
    iconUrl?: string;
    categoryId: string;
    isCompleted: boolean;
    completedMissionTitle?: string;
    category?: { categoryId: string; name: string };
}

interface BigMissionDetail {
    id: number;
    title: string;
    description?: string;
    headerImageUrl?: string;
    iconUrl?: string;
    giftImageUrl?: string;
    giftDescription?: string;
    growthEnabled?: boolean;
    growthTreeName?: string;
    growthStageImages?: string[];
    giftItems?: { imageUrl?: string; description?: string }[];
    topics: BigMissionTopic[];
    completedTopics: number;
    totalTopics: number;
    progressPercent: number;
    status: string;
    hasGift: boolean;
}

// 기본 아이콘 (iconUrl 없을 시 사용)
const DEFAULT_ICON = "/icons/icon-192x192.png";

export default function MyMissionDetailPage() {
    const [, params] = useRoute("/mymissions/:id");
    const [, navigate] = useLocation();
    const missionId = params?.id;

    const { data: mission, isLoading } = useQuery<BigMissionDetail>({
        queryKey: ["/api/big-missions", missionId],
        queryFn: async () => {
            const res = await fetch(`/api/big-missions/${missionId}`);
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
        enabled: !!missionId,
    });

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            </div>
        );
    }

    if (!mission) {
        return (
            <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
                <p className="text-muted-foreground">큰미션을 찾을 수 없습니다</p>
                <Button variant="outline" onClick={() => navigate("/mymissions")}>
                    돌아가기
                </Button>
            </div>
        );
    }

    const isAllCompleted = mission.status === "completed";

    return (
        <div className="min-h-screen bg-background">

            <div className="px-4 pb-8 pt-4">
                {/* 제목 & 설명 */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                        {isAllCompleted && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                                <CheckCircle2 className="h-3 w-3" /> 컬렉션 완성!
                            </span>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold mb-2">{mission.title}</h1>
                    {mission.description && (
                        <p className="text-muted-foreground">{mission.description}</p>
                    )}
                </div>

                {/* 전체 진행률 — growthEnabled일 때만 성장 캐릭터 표시 */}
                {mission.growthEnabled && (
                    <CreationTreeProgress
                        completedTopics={mission.completedTopics}
                        totalTopics={mission.totalTopics}
                        isAllCompleted={isAllCompleted}
                        treeName={mission.growthTreeName || "사과몽"}
                        stageImages={mission.growthStageImages || []}
                    />
                )}

                {/* 주제미션 아이콘 그리드 */}
                <div className="mb-6">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Target className="h-5 w-5 text-amber-500" />
                        진행 미션
                        <span className="text-sm font-normal text-muted-foreground">
                            [{mission.topics.filter(t => t.isCompleted).length}/{mission.topics.length}]
                        </span>
                    </h2>
                    <div className="grid grid-cols-3 gap-3">
                        {mission.topics.map((topic) => (
                            <div
                                key={topic.id}
                                className={`relative flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${topic.isCompleted
                                    ? "bg-gradient-to-b from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-300 dark:border-amber-700 shadow-md"
                                    : "bg-muted/30 border-muted hover:bg-muted/50"
                                    }`}
                            >
                                {/* 완료 체크 마크 */}
                                {topic.isCompleted && (
                                    <div className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-sm">
                                        <CheckCircle2 className="h-4 w-4 text-white" />
                                    </div>
                                )}

                                {/* 아이콘 */}
                                <div
                                    className={`w-14 h-14 rounded-full flex items-center justify-center overflow-hidden ${topic.isCompleted
                                        ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-background"
                                        : "opacity-40 grayscale"
                                        }`}
                                >
                                    <img
                                        src={topic.iconUrl || DEFAULT_ICON}
                                        alt={topic.title}
                                        className="w-12 h-12 object-cover rounded-full"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = DEFAULT_ICON;
                                        }}
                                    />
                                </div>

                                {/* 잠금 아이콘 */}
                                {!topic.isCompleted && (
                                    <Lock className="h-3 w-3 text-muted-foreground absolute bottom-10" />
                                )}

                                {/* 제목 */}
                                <span
                                    className={`text-xs text-center font-medium leading-tight line-clamp-2 ${topic.isCompleted ? "text-foreground" : "text-muted-foreground"
                                        }`}
                                >
                                    {topic.title}
                                </span>

                                {/* 완료된 미션명 */}
                                {topic.isCompleted && topic.completedMissionTitle && (
                                    <span className="text-[10px] text-amber-600 dark:text-amber-400 truncate max-w-full">
                                        {topic.completedMissionTitle}
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 보상 영역 */}
                {mission.hasGift && (
                    <Card
                        className={`mb-6 overflow-hidden ${isAllCompleted
                            ? "border-amber-400 dark:border-amber-600 shadow-lg shadow-amber-100 dark:shadow-amber-900/20"
                            : "opacity-60 grayscale"
                            }`}
                    >
                        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <Gift className="h-5 w-5 text-amber-500" />
                                <span className="font-bold text-amber-700 dark:text-amber-300">
                                    {isAllCompleted ? "🎁 완료 선물" : "🔒 완료 선물"}
                                </span>
                            </div>
                            <div className="space-y-4">
                                {(mission.giftItems && mission.giftItems.length > 0) ? (
                                    mission.giftItems.map((gift, idx) => (
                                        <div key={idx} className="flex items-center gap-4 border-b border-amber-200/50 dark:border-amber-700/50 pb-4 last:border-0 last:pb-0">
                                            {gift.imageUrl && (
                                                <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800">
                                                    <img
                                                        src={gift.imageUrl}
                                                        alt="보상"
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                            )}
                                            <div className="flex-1">
                                                <span className="inline-block text-sm font-semibold text-amber-800 dark:text-amber-200 px-3 py-1 rounded-full border-2 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/30 shadow-sm">
                                                    {gift.description || "특별한 보상이 기다립니다!"}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex items-center gap-4">
                                        {mission.giftImageUrl && (
                                            <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800">
                                                <img
                                                    src={mission.giftImageUrl}
                                                    alt="보상"
                                                    className="w-full h-full object-cover"
                                                />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            <span className="inline-block text-sm font-semibold text-amber-800 dark:text-amber-200 px-3 py-1 rounded-full border-2 border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/30 shadow-sm">
                                                {mission.giftDescription || "모든 미션을 완료하면 특별한 보상이 기다립니다!"}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {!isAllCompleted && (
                                <p className="text-xs text-muted-foreground mt-4 text-center border-t border-amber-200/50 dark:border-amber-700/50 pt-3">
                                    남은 미션: {mission.totalTopics - mission.completedTopics}개
                                </p>
                            )}
                        </div>
                    </Card>
                )}

                {/* 문화센터 바로가기 */}
                <Link href="/missions">
                    <Button className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600">
                        <Target className="h-4 w-4" />
                        문화센터에서 미션 참여하기
                        <ArrowRight className="h-4 w-4" />
                    </Button>
                </Link>
            </div>
        </div>
    );
}
