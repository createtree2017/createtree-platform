import { Request, Response } from "express";
import { db } from "@db";
import {
    bigMissions,
    userBigMissionProgress,
    bigMissionTopics
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";

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

            // Filter for user's hospital or public (superadmin sees dev too)
            const memberType = (req.user as any)?.memberType;
            const isSuperAdmin = memberType === 'superadmin';

            const visibleMissions = missions.filter(m =>
                m.visibilityType === "public" ||
                (m.visibilityType === "hospital" && m.hospitalId === hospitalId) ||
                (m.visibilityType === "dev" && isSuperAdmin)
            );

            // Fetch user progress for these missions
            const progressList = await db.query.userBigMissionProgress.findMany({
                where: eq(userBigMissionProgress.userId, userId)
            });

            const progressMap = new Map(progressList.map(p => [p.bigMissionId, p]));

            // Build payload
            const result = visibleMissions.map(mission => {
                const progress = progressMap.get(mission.id);
                const totalTopics = mission.topics.length;
                const completedTopics = progress?.completedTopics || 0;
                const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

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
                    hasGift: !!mission.giftImageUrl || !!mission.giftDescription,
                    totalTopics,
                    completedTopics,
                    progressPercent,
                    status: progress?.status || (completedTopics > 0 ? "in_progress" : "not_started")
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

            const progress = await db.query.userBigMissionProgress.findFirst({
                where: and(eq(userBigMissionProgress.userId, userId), eq(userBigMissionProgress.bigMissionId, mission.id))
            });

            const totalTopics = mission.topics.length;
            const completedTopics = progress?.completedTopics || 0;
            const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;

            const result = {
                ...mission,
                hasGift: !!mission.giftImageUrl || !!mission.giftDescription,
                totalTopics,
                completedTopics,
                progressPercent,
                status: progress?.status || (completedTopics > 0 ? "in_progress" : "not_started")
            };

            res.json(result);
        } catch (error) {
            console.error("Error fetching big mission detail:", error);
            res.status(500).json({ error: "큰미션 상세정보를 가져오지 못했습니다." });
        }
    }
}
