import { Request, Response } from "express";
import { db } from "@db";
import {
    bigMissions,
    userBigMissionProgress,
    bigMissionTopics,
    subMissionSubmissions,
    subMissions,
    themeMissions,
    MISSION_STATUS,
    type BigMissionGiftItem,
    type SelectedRewardItem,
    type SelectedRewardQuantityItem
} from "@shared/schema";
import { eq, and, asc, desc } from "drizzle-orm";

function normalizeRewardText(value: unknown) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalText(value: unknown) {
    const text = normalizeRewardText(value);
    return text || null;
}

function buildRewardDeliveryInfo(body: unknown): { rewardShippingAddress?: string; rewardMemo: string | null; error?: string } {
    const payload = body as {
        shippingAddress?: unknown;
        rewardShippingAddress?: unknown;
        rewardMemo?: unknown;
        memo?: unknown;
    } | null;

    const rewardShippingAddress = normalizeRewardText(payload?.shippingAddress ?? payload?.rewardShippingAddress);
    if (!rewardShippingAddress) {
        return { rewardMemo: null, error: "배송 받을 주소를 입력해주세요." };
    }

    return {
        rewardShippingAddress,
        rewardMemo: normalizeOptionalText(payload?.rewardMemo ?? payload?.memo),
    };
}

function buildRewardChoices(mission: {
    giftItems?: BigMissionGiftItem[] | null;
    giftImageUrl?: string | null;
    giftDescription?: string | null;
}): SelectedRewardItem[] {
    const giftItems = Array.isArray(mission.giftItems) ? mission.giftItems : [];
    const choices = giftItems
        .map((item, index) => {
            const imageUrl = normalizeRewardText(item?.imageUrl);
            const description = normalizeRewardText(item?.description);
            return {
                imageUrl,
                description: description || "등록된 보상",
                selectedIndex: index
            };
        })
        .filter(item => !!item.imageUrl || item.description !== "등록된 보상");

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
        selectedIndex: 0
    }];
}

function parseRewardIndex(value: unknown) {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "") return Number(value);
    return NaN;
}

function normalizeRewardSelectionLimit(value: unknown) {
    return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : 1;
}

function buildSelectedRewardItems(
    body: unknown,
    rewardChoices: SelectedRewardItem[],
    rewardSelectionLimit: number
): { selectedRewardItem?: SelectedRewardQuantityItem[]; error?: string } {
    const payload = body as {
        selectedRewards?: unknown;
        selectedRewardIndex?: unknown;
    } | null;

    const rawSelections = Array.isArray(payload?.selectedRewards)
        ? payload.selectedRewards
        : payload?.selectedRewardIndex !== undefined
            ? [{ selectedIndex: payload.selectedRewardIndex, quantity: 1 }]
            : [];

    if (rawSelections.length === 0) {
        return { error: "선택한 보상 정보가 없습니다." };
    }

    const quantityByIndex = new Map<number, number>();

    for (const rawSelection of rawSelections) {
        const selection = rawSelection as { selectedIndex?: unknown; quantity?: unknown } | null;
        const selectedIndex = parseRewardIndex(selection?.selectedIndex);
        const quantity = typeof selection?.quantity === "number"
            ? selection.quantity
            : typeof selection?.quantity === "string" && selection.quantity.trim() !== ""
                ? Number(selection.quantity)
                : NaN;

        if (!Number.isInteger(selectedIndex)) {
            return { error: "선택한 보상 정보가 올바르지 않습니다." };
        }

        if (!Number.isInteger(quantity) || quantity < 0) {
            return { error: "보상 수량은 0 이상의 정수만 선택할 수 있습니다." };
        }

        if (!rewardChoices.some(choice => choice.selectedIndex === selectedIndex)) {
            return { error: "선택한 보상을 찾을 수 없습니다." };
        }

        quantityByIndex.set(selectedIndex, (quantityByIndex.get(selectedIndex) || 0) + quantity);
    }

    const totalQuantity = Array.from(quantityByIndex.values()).reduce((sum, quantity) => sum + quantity, 0);

    if (totalQuantity === 0) {
        return { error: "선택한 보상 수량이 없습니다." };
    }

    if (totalQuantity !== rewardSelectionLimit) {
        return { error: `보상은 총 ${rewardSelectionLimit}개를 선택해야 합니다.` };
    }

    const selectedRewardItem = rewardChoices
        .map(choice => ({
            ...choice,
            quantity: quantityByIndex.get(choice.selectedIndex) || 0
        }))
        .filter(choice => choice.quantity > 0);

    return { selectedRewardItem };
}

export class UserBigMissionController {

    async getMyBigMissions(req: Request, res: Response) {
        try {
            const userId = (req.user as any)?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }

            const hospitalId = (req.user as any)?.hospitalId;

            // Fetch active big missions
            const missions = await db.query.bigMissions.findMany({
                where: eq(bigMissions.isActive, true),
                with: {
                    topics: true,
                    hospital: true
                },
                orderBy: [asc(bigMissions.order)]
            });

            // Filter for user's hospital or public (superadmin sees all active missions)
            const memberType = (req.user as any)?.memberType;
            const isSuperAdmin = memberType === 'superadmin';

            const visibleMissions = missions.filter(m =>
                isSuperAdmin ||
                m.visibilityType === "public" ||
                (m.visibilityType === "hospital" && m.hospitalId === hospitalId)
            );

            // 승인된 문화센터 미션 내역(카테고리 기반) 가져오기
            const approvedSubmissions = await db
                .select({
                    categoryId: themeMissions.categoryId,
                    missionTitle: subMissions.title
                })
                .from(subMissionSubmissions)
                .innerJoin(subMissions, eq(subMissionSubmissions.subMissionId, subMissions.id))
                .innerJoin(themeMissions, eq(subMissions.themeMissionId, themeMissions.id))
                .where(
                    and(
                        eq(subMissionSubmissions.userId, userId),
                        eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED)
                    )
                )
                .orderBy(desc(subMissionSubmissions.reviewedAt));

            // 사용자별 완료한 카테고리 매핑 (최신 승인 건의 미션명 보관)
            const approvedCategoryMap = new Map<string, string>();
            for (const sub of approvedSubmissions) {
                if (sub.categoryId && !approvedCategoryMap.has(sub.categoryId)) {
                    approvedCategoryMap.set(sub.categoryId, sub.missionTitle);
                }
            }

            // Build payload
            const result = visibleMissions.map(mission => {
                let dynamicCompletedCount = 0;
                mission.topics.forEach(topic => {
                    const isCompleted = topic.categoryId ? approvedCategoryMap.has(topic.categoryId) : false;
                    if (isCompleted) dynamicCompletedCount++;
                });

                const totalTopics = mission.topics.length;
                const progressPercent = totalTopics > 0 ? Math.round((dynamicCompletedCount / totalTopics) * 100) : 0;

                let computedStatus = "not_started";
                if (dynamicCompletedCount === totalTopics && totalTopics > 0) computedStatus = "completed";
                else if (dynamicCompletedCount > 0) computedStatus = "in_progress";

                return {
                    id: mission.id,
                    title: mission.title,
                    description: mission.description,
                    headerImageUrl: mission.headerImageUrl,
                    iconUrl: mission.iconUrl,
                    visibilityType: mission.visibilityType,
                    hospitalId: mission.hospitalId,
                    hospital: mission.hospital,
                    startDate: mission.startDate,
                    endDate: mission.endDate,
                    giftImageUrl: mission.giftImageUrl,
                    giftDescription: mission.giftDescription,
                    giftItems: (mission as any).giftItems || [],
                    rewardSelectionLimit: normalizeRewardSelectionLimit((mission as any).rewardSelectionLimit),
                    hasGift: !!mission.giftImageUrl || !!mission.giftDescription || ((mission as any).giftItems && (mission as any).giftItems.length > 0),
                    totalTopics,
                    completedTopics: dynamicCompletedCount,
                    progressPercent,
                    status: computedStatus
                };
            });

            res.json(result);
        } catch (error) {
            console.error("Error fetching user big missions:", error);
            res.status(500).json({ error: "나의 큰미션 목록을 가져오지 못했습니다." });
        }
    }

    async getBigMissionDetail(req: Request, res: Response) {
        try {
            const userId = (req.user as any)?.id;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const { id } = req.params;

            const mission = await db.query.bigMissions.findFirst({
                where: and(eq(bigMissions.id, parseInt(id)), eq(bigMissions.isActive, true)),
                with: {
                    topics: {
                        with: { category: true },
                        orderBy: [asc(bigMissionTopics.order)]
                    },
                    hospital: true
                }
            });

            if (!mission) {
                return res.status(404).json({ error: "미션을 찾을 수 없습니다." });
            }

            // 승인된 문화센터 미션 내역 가져오기
            const approvedSubmissions = await db
                .select({
                    categoryId: themeMissions.categoryId,
                    missionTitle: subMissions.title
                })
                .from(subMissionSubmissions)
                .innerJoin(subMissions, eq(subMissionSubmissions.subMissionId, subMissions.id))
                .innerJoin(themeMissions, eq(subMissions.themeMissionId, themeMissions.id))
                .where(
                    and(
                        eq(subMissionSubmissions.userId, userId),
                        eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED)
                    )
                )
                .orderBy(desc(subMissionSubmissions.reviewedAt));

            const approvedCategoryMap = new Map<string, string>();
            for (const sub of approvedSubmissions) {
                if (sub.categoryId && !approvedCategoryMap.has(sub.categoryId)) {
                    approvedCategoryMap.set(sub.categoryId, sub.missionTitle);
                }
            }

            let dynamicCompletedCount = 0;
            const evaluatedTopics = mission.topics.map(topic => {
                const isCompleted = topic.categoryId ? approvedCategoryMap.has(topic.categoryId) : false;
                if (isCompleted) dynamicCompletedCount++;
                return {
                    ...topic,
                    isCompleted,
                    completedMissionTitle: isCompleted ? approvedCategoryMap.get(topic.categoryId) : undefined
                };
            });

            const totalTopics = mission.topics.length;
            const progressPercent = totalTopics > 0 ? Math.round((dynamicCompletedCount / totalTopics) * 100) : 0;

            let computedStatus = "not_started";
            if (dynamicCompletedCount === totalTopics && totalTopics > 0) computedStatus = "completed";
            else if (dynamicCompletedCount > 0) computedStatus = "in_progress";

            // 리워드 상태 조회
            const progressRecord = await db.query.userBigMissionProgress.findFirst({
                where: and(
                    eq(userBigMissionProgress.userId, userId),
                    eq(userBigMissionProgress.bigMissionId, parseInt(id))
                )
            });

            const result = {
                ...mission,
                topics: evaluatedTopics,
                hasGift: !!mission.giftImageUrl || !!mission.giftDescription || ((mission as any).giftItems && (mission as any).giftItems.length > 0),
                totalTopics,
                completedTopics: dynamicCompletedCount,
                progressPercent,
                status: computedStatus,
                progressId: progressRecord?.id || null,
                rewardStatus: progressRecord?.rewardStatus || 'not_eligible',
                rewardSelectionLimit: normalizeRewardSelectionLimit((mission as any).rewardSelectionLimit),
                selectedRewardItem: progressRecord?.selectedRewardItem || null,
                rewardShippingAddress: progressRecord?.rewardShippingAddress || null,
                rewardMemo: progressRecord?.rewardMemo || null
            };

            res.json(result);
        } catch (error) {
            console.error("Error fetching big mission detail:", error);
            res.status(500).json({ error: "큰미션 상세정보를 가져오지 못했습니다." });
        }
    }

    async applyReward(req: Request, res: Response) {
        try {
            const userId = (req.user as any)?.id || (req.user as any)?.userId;
            if (!userId) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const { id } = req.params;
            const bigMissionId = parseInt(id);

            // 1. 미션 존재 파악 및 달성률 계산 로직 재활용
            const mission = await db.query.bigMissions.findFirst({
                where: and(eq(bigMissions.id, bigMissionId), eq(bigMissions.isActive, true)),
                with: { topics: true }
            });

            if (!mission) {
                return res.status(404).json({ error: "미션을 찾을 수 없습니다." });
            }

            const rewardChoices = buildRewardChoices(mission);
            if (rewardChoices.length === 0) {
                return res.status(400).json({ error: "선택 가능한 보상이 없습니다." });
            }

            const rewardSelectionLimit = normalizeRewardSelectionLimit((mission as any).rewardSelectionLimit);
            const rewardSelection = buildSelectedRewardItems(req.body, rewardChoices, rewardSelectionLimit);
            if (!rewardSelection.selectedRewardItem) {
                return res.status(400).json({ error: rewardSelection.error || "선택한 보상 정보가 올바르지 않습니다." });
            }

            const deliveryInfo = buildRewardDeliveryInfo(req.body);
            if (!deliveryInfo.rewardShippingAddress) {
                return res.status(400).json({ error: deliveryInfo.error || "배송 정보를 입력해주세요." });
            }

            const approvedSubmissions = await db
                .select({ categoryId: themeMissions.categoryId })
                .from(subMissionSubmissions)
                .innerJoin(subMissions, eq(subMissionSubmissions.subMissionId, subMissions.id))
                .innerJoin(themeMissions, eq(subMissions.themeMissionId, themeMissions.id))
                .where(
                    and(
                        eq(subMissionSubmissions.userId, userId),
                        eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED)
                    )
                );

            const approvedCategories = new Set(approvedSubmissions.map(s => s.categoryId).filter(Boolean));

            let completedCount = 0;
            mission.topics.forEach(topic => {
                if (topic.categoryId && approvedCategories.has(topic.categoryId)) {
                    completedCount++;
                }
            });

            const totalTopics = mission.topics.length;
            if (totalTopics === 0 || completedCount < totalTopics) {
                return res.status(400).json({ error: "아직 달성률이 100%가 아닙니다." });
            }

            // 2. userBigMissionProgress 업데이트 또는 삽입
            const existingProgress = await db.query.userBigMissionProgress.findFirst({
                where: and(
                    eq(userBigMissionProgress.userId, userId),
                    eq(userBigMissionProgress.bigMissionId, bigMissionId)
                )
            });

            if (existingProgress?.rewardStatus === 'approved') {
                return res.status(400).json({ error: "이미 지급 완료된 리워드는 수정할 수 없습니다." });
            }

            if (existingProgress && existingProgress.rewardStatus !== 'not_eligible' && existingProgress.rewardStatus !== 'can_apply' && existingProgress.rewardStatus !== 'pending') {
                return res.status(400).json({ error: "현재 상태에서는 리워드를 신청하거나 수정할 수 없습니다." });
            }

            if (existingProgress) {
                await db.update(userBigMissionProgress)
                    .set({
                        rewardStatus: 'pending',
                        rewardAppliedAt: existingProgress.rewardAppliedAt || new Date(),
                        completedTopics: completedCount,
                        totalTopics: totalTopics,
                        status: 'completed',
                        selectedRewardItem: rewardSelection.selectedRewardItem,
                        rewardShippingAddress: deliveryInfo.rewardShippingAddress,
                        rewardMemo: deliveryInfo.rewardMemo,
                        updatedAt: new Date()
                    })
                    .where(eq(userBigMissionProgress.id, existingProgress.id));
            } else {
                await db.insert(userBigMissionProgress).values({
                    userId,
                    bigMissionId,
                    completedTopics: completedCount,
                    totalTopics: totalTopics,
                    status: 'completed',
                    rewardStatus: 'pending',
                    rewardAppliedAt: new Date(),
                    selectedRewardItem: rewardSelection.selectedRewardItem,
                    rewardShippingAddress: deliveryInfo.rewardShippingAddress,
                    rewardMemo: deliveryInfo.rewardMemo,
                });
            }

            // 3. 관리자 알림 (Telegram 연동은 추후 추가)
            console.log(`[Reward Log] User ${userId} applied/updated reward in Big Mission ${bigMissionId}.`);

            res.json({ success: true, message: "리워드 신청이 완료되었습니다." });

        } catch (error) {
            console.error("Error applying for reward:", error);
            res.status(500).json({ error: "리워드 신청 중 오류가 발생했습니다." });
        }
    }
}
