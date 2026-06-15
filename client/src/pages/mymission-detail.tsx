import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Trophy,
    CheckCircle2,
    Lock,
    Gift,
    ChevronLeft,
    Loader2,
    Target,
    ArrowRight,
    Settings,
    Minus,
    Plus,
    MapPin,
    MessageSquareText,
    Pencil,
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

interface RewardChoice {
    imageUrl?: string;
    description: string;
    selectedIndex: number;
}

interface SelectedRewardLine extends RewardChoice {
    quantity: number;
}

type SelectedRewardSnapshot = RewardChoice | SelectedRewardLine[];

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
    rewardStatus?: string;
    progressId?: number;
    rewardSelectionLimit?: number;
    selectedRewardItem?: SelectedRewardSnapshot | null;
    rewardShippingAddress?: string | null;
    rewardMemo?: string | null;
}

// 기본 아이콘 (iconUrl 없을 시 사용)
const DEFAULT_ICON = "/icons/icon-192x192.png";

function normalizeRewardText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function buildRewardChoices(mission: Pick<BigMissionDetail, "giftItems" | "giftImageUrl" | "giftDescription">): RewardChoice[] {
    const choices = (mission.giftItems || [])
        .map((gift, index) => {
            const imageUrl = normalizeRewardText(gift.imageUrl);
            const description = normalizeRewardText(gift.description);
            return {
                imageUrl,
                description: description || "등록된 보상",
                selectedIndex: index,
            };
        })
        .filter(gift => !!gift.imageUrl || gift.description !== "등록된 보상");

    if (choices.length > 0) {
        return choices;
    }

    const legacyImageUrl = normalizeRewardText(mission.giftImageUrl);
    const legacyDescription = normalizeRewardText(mission.giftDescription);

    if (!legacyImageUrl && !legacyDescription) {
        return [];
    }

    return [{
        imageUrl: legacyImageUrl,
        description: legacyDescription || "등록된 보상",
        selectedIndex: 0,
    }];
}

function normalizeSelectedRewardLines(snapshot: SelectedRewardSnapshot | null | undefined): SelectedRewardLine[] {
    if (!snapshot) {
        return [];
    }

    if (Array.isArray(snapshot)) {
        return snapshot
            .map(item => ({
                imageUrl: item.imageUrl,
                description: item.description || "선택 보상",
                selectedIndex: item.selectedIndex,
                quantity: Number.isInteger(item.quantity) && item.quantity > 0 ? item.quantity : 0,
            }))
            .filter(item => item.quantity > 0);
    }

    return [{
        imageUrl: snapshot.imageUrl,
        description: snapshot.description || "선택 보상",
        selectedIndex: snapshot.selectedIndex,
        quantity: 1,
    }];
}

export default function MyMissionDetailPage() {
    const { user } = useAuth();
    const [, params] = useRoute("/mymissions/:id");
    const [, navigate] = useLocation();
    const missionId = params?.id;

    const { data: mission, isLoading } = useQuery<BigMissionDetail>({
        queryKey: ["/api/big-missions", missionId],
        queryFn: async () => {
            const res = await apiRequest(`/api/big-missions/${missionId}`);
            if (!res.ok) throw new Error("Failed to fetch");
            return res.json();
        },
        enabled: !!missionId,
    });

    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [selectedRewardQuantities, setSelectedRewardQuantities] = useState<Record<number, number>>({});
    const [shippingAddress, setShippingAddress] = useState("");
    const [rewardMemo, setRewardMemo] = useState("");
    const [isEditingRewardApplication, setIsEditingRewardApplication] = useState(false);

    const applyRewardMutation = useMutation({
        mutationFn: async (payload: {
            selectedRewards: SelectedRewardLine[];
            shippingAddress: string;
            rewardMemo: string;
        }) => {
            const res = await apiRequest(`/api/big-missions/${missionId}/apply-reward`, {
                method: "POST",
                data: {
                    selectedRewards: payload.selectedRewards.map(item => ({
                        selectedIndex: item.selectedIndex,
                        quantity: item.quantity,
                    })),
                    shippingAddress: payload.shippingAddress,
                    rewardMemo: payload.rewardMemo,
                },
            });
            return await res.json();
        },
        onSuccess: () => {
            const wasEditing = isEditingRewardApplication;
            toast({
                title: wasEditing ? "수정 완료" : "신청 완료",
                description: wasEditing
                    ? "선물 신청 내용이 수정되었습니다."
                    : "선물 신청이 완료되었습니다. 관리자 확인 후 처리됩니다.",
            });
            setIsEditingRewardApplication(false);
            // 쿼리 무효화로 데이터 갱신
            queryClient.invalidateQueries({ queryKey: ["/api/big-missions", missionId] });
            queryClient.invalidateQueries({ queryKey: ["/api/big-missions"] });
        },
        onError: (error: Error) => {
            toast({
                title: "신청 실패",
                description: error.message || "신청 중 오류가 발생했습니다.",
                variant: "destructive",
            });
        }
    });

    const rewardChoices = useMemo(
        () => mission ? buildRewardChoices(mission) : [],
        [mission]
    );

    useEffect(() => {
        const selectedLines = normalizeSelectedRewardLines(mission?.selectedRewardItem);
        if (selectedLines.length > 0) {
            setSelectedRewardQuantities(
                selectedLines.reduce<Record<number, number>>((acc, item) => {
                    acc[item.selectedIndex] = item.quantity;
                    return acc;
                }, {})
            );
            return;
        }

        setSelectedRewardQuantities({});
    }, [mission?.id, mission?.selectedRewardItem]);

    useEffect(() => {
        setShippingAddress(mission?.rewardShippingAddress || "");
        setRewardMemo(mission?.rewardMemo || "");
        setIsEditingRewardApplication(false);
    }, [mission?.id, mission?.rewardShippingAddress, mission?.rewardMemo]);

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
    const isRewardPending = mission.rewardStatus === "pending";
    const isRewardApproved = mission.rewardStatus === "approved";
    const isRewardSubmitted = mission.rewardStatus === "pending" || mission.rewardStatus === "approved";
    const shouldShowRewardForm = isAllCompleted && (!isRewardSubmitted || isEditingRewardApplication);
    const selectedRewardSnapshot = mission.selectedRewardItem || null;
    const rewardSelectionLimit = Number.isInteger(mission.rewardSelectionLimit) && mission.rewardSelectionLimit! > 0
        ? mission.rewardSelectionLimit!
        : 1;
    const selectedRewardLines = rewardChoices
        .map(choice => ({
            ...choice,
            quantity: selectedRewardQuantities[choice.selectedIndex] || 0,
        }))
        .filter(choice => choice.quantity > 0);
    const selectedRewardTotal = selectedRewardLines.reduce((sum, item) => sum + item.quantity, 0);
    const selectedRewardSnapshotLines = normalizeSelectedRewardLines(selectedRewardSnapshot);
    const normalizedShippingAddress = shippingAddress.trim();
    const normalizedRewardMemo = rewardMemo.trim();
    const isRewardFormReady = selectedRewardTotal === rewardSelectionLimit
        && selectedRewardLines.length > 0
        && normalizedShippingAddress.length > 0;
    const rewardSubmitLabel = isEditingRewardApplication ? "수정 저장하기" : "🎉 선물 신청하기";
    const rewardSubmittingLabel = isEditingRewardApplication ? "수정 저장중..." : "신청 처리중...";

    const setRewardQuantity = (selectedIndex: number, nextQuantity: number) => {
        setSelectedRewardQuantities(prev => {
            const currentQuantity = prev[selectedIndex] || 0;
            const currentTotal = Object.values(prev).reduce((sum, quantity) => sum + quantity, 0);
            const otherTotal = currentTotal - currentQuantity;
            const boundedQuantity = Math.max(0, Math.min(nextQuantity, rewardSelectionLimit - otherTotal));
            return {
                ...prev,
                [selectedIndex]: boundedQuantity,
            };
        });
    };

    const resetRewardFormFromMission = () => {
        const selectedLines = normalizeSelectedRewardLines(mission.selectedRewardItem);
        setSelectedRewardQuantities(
            selectedLines.reduce<Record<number, number>>((acc, item) => {
                acc[item.selectedIndex] = item.quantity;
                return acc;
            }, {})
        );
        setShippingAddress(mission.rewardShippingAddress || "");
        setRewardMemo(mission.rewardMemo || "");
    };

    return (
        <div className="min-h-screen bg-background">

            <div className="px-4 pb-8 pt-4">
                {/* 관리자 전용 관리 버튼 */}
                {user?.memberType === "superadmin" && (
                    <div className="mb-4 flex justify-end">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200 shadow-sm"
                            onClick={() => navigate(`/admin?menuItem=my-missions&panel=reward-applications&missionTitle=${encodeURIComponent(mission.title)}`)}
                        >
                            <Settings className="h-3.5 w-3.5 mr-1" />
                            🎁 관리자 리워드 신청 관리
                        </Button>
                    </div>
                )}

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
                                {shouldShowRewardForm ? (
                                    rewardChoices.length > 0 ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-white/70 px-3 py-2 dark:border-amber-800 dark:bg-gray-900/30">
                                                <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                                                    선택 수량
                                                </span>
                                                <span className={`text-sm font-bold ${selectedRewardTotal === rewardSelectionLimit
                                                    ? "text-green-600 dark:text-green-400"
                                                    : selectedRewardTotal > rewardSelectionLimit
                                                        ? "text-red-600 dark:text-red-400"
                                                        : "text-amber-700 dark:text-amber-300"
                                                    }`}>
                                                    {selectedRewardTotal} / {rewardSelectionLimit}
                                                </span>
                                            </div>

                                            {rewardChoices.map((gift) => {
                                                const quantity = selectedRewardQuantities[gift.selectedIndex] || 0;
                                                const canIncrease = selectedRewardTotal < rewardSelectionLimit;
                                                const canDecrease = quantity > 0;

                                                return (
                                                    <div
                                                        key={gift.selectedIndex}
                                                        className={`rounded-xl border p-3 transition-colors ${quantity > 0
                                                            ? "border-amber-500 bg-amber-100/80 dark:bg-amber-900/40"
                                                            : "border-amber-200/70 bg-white/70 dark:border-amber-700/60 dark:bg-gray-900/30"
                                                            }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            {gift.imageUrl && (
                                                                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-white dark:bg-gray-800">
                                                                    <img
                                                                        src={gift.imageUrl}
                                                                        alt="보상"
                                                                        className="h-full w-full object-cover"
                                                                    />
                                                                </div>
                                                            )}
                                                            <span className="min-w-0 flex-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
                                                                {gift.description}
                                                            </span>
                                                        </div>

                                                        <div className="mt-3 flex items-center justify-end gap-3">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-11 w-11 rounded-full border-amber-300 bg-white text-amber-700 disabled:opacity-40 dark:bg-gray-950"
                                                                disabled={!canDecrease}
                                                                aria-label={`${gift.description} 수량 줄이기`}
                                                                onClick={() => setRewardQuantity(gift.selectedIndex, quantity - 1)}
                                                            >
                                                                <Minus className="h-4 w-4" />
                                                            </Button>
                                                            <span className="flex h-11 min-w-12 items-center justify-center rounded-full border border-amber-200 bg-white px-4 text-lg font-bold text-amber-900 dark:border-amber-800 dark:bg-gray-950 dark:text-amber-100">
                                                                {quantity}
                                                            </span>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon"
                                                                className="h-11 w-11 rounded-full border-amber-300 bg-white text-amber-700 disabled:opacity-40 dark:bg-gray-950"
                                                                disabled={!canIncrease}
                                                                aria-label={`${gift.description} 수량 늘리기`}
                                                                onClick={() => setRewardQuantity(gift.selectedIndex, quantity + 1)}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            <div className="space-y-3 rounded-xl border border-amber-200/80 bg-white/80 p-3 dark:border-amber-800 dark:bg-gray-900/40">
                                                <div className="space-y-2">
                                                    <label htmlFor="reward-shipping-address" className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-100">
                                                        <MapPin className="h-4 w-4 text-amber-500" />
                                                        배송 받을 주소 <span className="text-red-500">*</span>
                                                    </label>
                                                    <Input
                                                        id="reward-shipping-address"
                                                        value={shippingAddress}
                                                        onChange={(event) => setShippingAddress(event.target.value)}
                                                        placeholder="예: 서울시 강남구 ..."
                                                        className="min-h-11 border-amber-200 bg-white text-sm dark:border-amber-800 dark:bg-gray-950"
                                                    />
                                                    <p className="text-xs leading-relaxed text-muted-foreground">
                                                        선물 배송에 필요한 주소를 정확히 입력해주세요.
                                                    </p>
                                                </div>

                                                <div className="space-y-2">
                                                    <label htmlFor="reward-memo" className="flex items-center gap-2 text-sm font-bold text-amber-900 dark:text-amber-100">
                                                        <MessageSquareText className="h-4 w-4 text-amber-500" />
                                                        메모
                                                    </label>
                                                    <Textarea
                                                        id="reward-memo"
                                                        value={rewardMemo}
                                                        onChange={(event) => setRewardMemo(event.target.value)}
                                                        placeholder="예: 부재 시 문 앞에 놓아주세요"
                                                        className="min-h-24 resize-none border-amber-200 bg-white text-sm dark:border-amber-800 dark:bg-gray-950"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-sm text-muted-foreground text-center py-4">
                                            선택 가능한 보상이 없습니다.
                                        </div>
                                    )
                                ) : isRewardSubmitted ? (
                                    <div className="space-y-3">
                                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                            {selectedRewardSnapshotLines.length > 0 ? "선택한 선물" : "기존 신청 보상"}
                                        </p>
                                        {selectedRewardSnapshotLines.length > 0 ? (
                                            <div className="space-y-2">
                                                {selectedRewardSnapshotLines.map((gift) => (
                                                    <div key={gift.selectedIndex} className="flex items-center gap-4 rounded-lg border border-amber-300 bg-white/70 p-3 dark:border-amber-700 dark:bg-gray-900/30">
                                                        {gift.imageUrl && (
                                                            <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800">
                                                                <img
                                                                    src={gift.imageUrl}
                                                                    alt="선택한 보상"
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            </div>
                                                        )}
                                                        <span className="flex-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
                                                            {gift.description}
                                                        </span>
                                                        <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800 dark:bg-amber-900/50 dark:text-amber-100">
                                                            {gift.quantity}개
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                <div className="rounded-lg border border-dashed border-amber-300 p-3 text-xs leading-relaxed text-muted-foreground">
                                                    선택형 보상 적용 전 접수된 기존 신청 건입니다. 신청 당시 선택한 선물 기록은 없지만, 현재 미션에 등록된 보상은 아래와 같습니다.
                                                </div>
                                                {rewardChoices.length > 0 ? (
                                                    rewardChoices.map((gift) => (
                                                        <div key={gift.selectedIndex} className="flex items-center gap-4 rounded-lg border border-amber-200/70 bg-white/60 p-3 dark:border-amber-700/60 dark:bg-gray-900/30">
                                                            {gift.imageUrl && (
                                                                <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-white dark:bg-gray-800">
                                                                    <img
                                                                        src={gift.imageUrl}
                                                                        alt="등록된 보상"
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                            )}
                                                            <span className="flex-1 text-sm font-semibold text-amber-900 dark:text-amber-100">
                                                                {gift.description}
                                                            </span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="rounded-lg border border-dashed border-amber-300 p-4 text-center text-sm text-muted-foreground">
                                                        등록된 보상이 없습니다.
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="space-y-3 rounded-lg border border-amber-200/70 bg-white/70 p-3 dark:border-amber-700/60 dark:bg-gray-900/30">
                                            <div>
                                                <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                    배송 받을 주소
                                                </p>
                                                <p className="whitespace-pre-wrap break-words text-sm font-medium text-amber-950 dark:text-amber-50">
                                                    {mission.rewardShippingAddress || "배송 정보 없음"}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                    <MessageSquareText className="h-3.5 w-3.5" />
                                                    메모
                                                </p>
                                                <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
                                                    {mission.rewardMemo || "메모 없음"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    rewardChoices.map((gift) => (
                                        <div key={gift.selectedIndex} className="flex items-center gap-4 border-b border-amber-200/50 dark:border-amber-700/50 pb-4 last:border-0 last:pb-0">
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
                                                    {gift.description}
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            {!isAllCompleted && (
                                <p className="text-xs text-muted-foreground mt-4 text-center border-t border-amber-200/50 dark:border-amber-700/50 pt-3">
                                    남은 미션: {mission.totalTopics - mission.completedTopics}개
                                </p>
                            )}

                            {isAllCompleted && (
                                <div className="mt-4 border-t border-amber-200/50 dark:border-amber-700/50 pt-4">
                                    {isRewardPending && !isEditingRewardApplication ? (
                                        <div className="space-y-2">
                                            <Button disabled className="w-full bg-gray-400 text-white">
                                                🎁 신청 완료 (담당자 확인중)
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="h-11 w-full border-amber-300 bg-white text-amber-700 hover:bg-amber-50 dark:bg-gray-950 dark:text-amber-200"
                                                onClick={() => {
                                                    resetRewardFormFromMission();
                                                    setIsEditingRewardApplication(true);
                                                }}
                                            >
                                                <Pencil className="mr-2 h-4 w-4" />
                                                신청 내용 수정
                                            </Button>
                                        </div>
                                    ) : isRewardApproved ? (
                                        <Button disabled className="w-full bg-green-500 text-white opacity-100 font-bold">
                                            🎁 보상 지급 완료
                                        </Button>
                                    ) : (
                                        <div className="space-y-2">
                                            <Button
                                                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold"
                                                onClick={() => {
                                                    if (selectedRewardTotal !== rewardSelectionLimit || selectedRewardLines.length === 0) {
                                                        toast({
                                                            title: "선물 수량 확인",
                                                            description: `총 ${rewardSelectionLimit}개를 선택해야 신청할 수 있습니다.`,
                                                            variant: "destructive",
                                                        });
                                                        return;
                                                    }
                                                    if (!normalizedShippingAddress) {
                                                        toast({
                                                            title: "배송 주소 확인",
                                                            description: "선물을 받을 주소를 입력해주세요.",
                                                            variant: "destructive",
                                                        });
                                                        return;
                                                    }
                                                    applyRewardMutation.mutate({
                                                        selectedRewards: selectedRewardLines,
                                                        shippingAddress: normalizedShippingAddress,
                                                        rewardMemo: normalizedRewardMemo,
                                                    });
                                                }}
                                                disabled={applyRewardMutation.isPending || !isRewardFormReady}
                                            >
                                                {applyRewardMutation.isPending ? rewardSubmittingLabel : rewardSubmitLabel}
                                            </Button>
                                            {isEditingRewardApplication && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="h-11 w-full"
                                                    disabled={applyRewardMutation.isPending}
                                                    onClick={() => {
                                                        resetRewardFormFromMission();
                                                        setIsEditingRewardApplication(false);
                                                    }}
                                                >
                                                    취소
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </div>
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
