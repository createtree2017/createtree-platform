import { Request, Response } from "express";
import { db } from "@db";
import {
    bigMissions,
    bigMissionTopics,
    missionCategories,
    hospitals
} from "@shared/schema";
import { eq, asc, desc } from "drizzle-orm";

export class AdminBigMissionController {
    // ============================================
    // 큰미션 관리 (Big Missions)
    // ============================================

    async getAllBigMissions(req: Request, res: Response) {
        try {
            const missions = await db.query.bigMissions.findMany({
                with: {
                    topics: {
                        with: {
                            category: true
                        },
                        orderBy: [asc(bigMissionTopics.order)]
                    },
                    hospital: true
                },
                orderBy: [asc(bigMissions.order), desc(bigMissions.createdAt)],
            });
            res.json(missions);
        } catch (error) {
            console.error("Error fetching big missions:", error);
            res.status(500).json({ error: "큰미션 목록을 불러오지 못했습니다." });
        }
    }

    async getBigMissionById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const mission = await db.query.bigMissions.findFirst({
                where: eq(bigMissions.id, parseInt(id)),
                with: {
                    topics: {
                        with: {
                            category: true
                        },
                        orderBy: [asc(bigMissionTopics.order)]
                    },
                    hospital: true
                }
            });

            if (!mission) {
                return res.status(404).json({ error: "큰미션을 찾을 수 없습니다." });
            }
            res.json(mission);
        } catch (error) {
            console.error("Error fetching big mission:", error);
            res.status(500).json({ error: "큰미션을 불러오지 못했습니다." });
        }
    }

    async createBigMission(req: Request, res: Response) {
        try {
            const body = req.body;

            // Whitelist only valid bigMissions columns
            const insertData: Record<string, any> = {};
            const allowedFields = [
                'title', 'description', 'headerImageUrl', 'iconUrl',
                'visibilityType', 'hospitalId',
                'startDate', 'endDate',
                'giftImageUrl', 'giftDescription',
                'order', 'isActive',
                'growthEnabled', 'growthTreeName', 'growthStageImages'
            ];

            for (const field of allowedFields) {
                if (body[field] !== undefined) {
                    if ((field === 'startDate' || field === 'endDate') && body[field]) {
                        insertData[field] = new Date(body[field]);
                    } else if ((field === 'startDate' || field === 'endDate') && !body[field]) {
                        insertData[field] = null;
                    } else {
                        insertData[field] = body[field];
                    }
                }
            }

            const [newMission] = await db.insert(bigMissions).values(insertData as any).returning();
            res.json(newMission);
        } catch (error) {
            console.error("Error creating big mission:", error);
            res.status(500).json({ error: "큰미션 생성에 실패했습니다." });
        }
    }

    async updateBigMission(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const body = req.body;

            // Whitelist only valid bigMissions columns (exclude relations like topics, hospital)
            const updateData: Record<string, any> = {};
            const allowedFields = [
                'title', 'description', 'headerImageUrl', 'iconUrl',
                'visibilityType', 'hospitalId',
                'startDate', 'endDate',
                'giftImageUrl', 'giftDescription',
                'order', 'isActive',
                'growthEnabled', 'growthTreeName', 'growthStageImages'
            ];

            for (const field of allowedFields) {
                if (body[field] !== undefined) {
                    // Handle date fields: convert string to Date or null
                    if ((field === 'startDate' || field === 'endDate') && body[field]) {
                        updateData[field] = new Date(body[field]);
                    } else if ((field === 'startDate' || field === 'endDate') && !body[field]) {
                        updateData[field] = null;
                    } else {
                        updateData[field] = body[field];
                    }
                }
            }

            updateData.updatedAt = new Date();

            const [updatedMission] = await db.update(bigMissions)
                .set(updateData)
                .where(eq(bigMissions.id, parseInt(id)))
                .returning();

            if (!updatedMission) {
                return res.status(404).json({ error: "큰미션을 찾을 수 없습니다." });
            }
            res.json(updatedMission);
        } catch (error) {
            console.error("Error updating big mission:", error);
            res.status(500).json({ error: "큰미션 수정에 실패했습니다." });
        }
    }

    async deleteBigMission(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const [deletedMission] = await db.delete(bigMissions)
                .where(eq(bigMissions.id, parseInt(id)))
                .returning();

            if (!deletedMission) {
                return res.status(404).json({ error: "큰미션을 찾을 수 없습니다." });
            }
            res.json({ success: true, mission: deletedMission });
        } catch (error) {
            console.error("Error deleting big mission:", error);
            res.status(500).json({ error: "큰미션 삭제에 실패했습니다." });
        }
    }

    async toggleActive(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const currentMission = await db.query.bigMissions.findFirst({
                where: eq(bigMissions.id, parseInt(id))
            });

            if (!currentMission) {
                return res.status(404).json({ error: "큰미션을 찾을 수 없습니다." });
            }

            const [updatedMission] = await db.update(bigMissions)
                .set({ isActive: !currentMission.isActive, updatedAt: new Date() })
                .where(eq(bigMissions.id, parseInt(id)))
                .returning();

            res.json(updatedMission);
        } catch (error) {
            console.error("Error toggling big mission active status:", error);
            res.status(500).json({ error: "상태 변경에 실패했습니다." });
        }
    }

    // ============================================
    // 큰미션 토픽 관리 (Big Mission Topics)
    // ============================================

    async createTopic(req: Request, res: Response) {
        try {
            const { bigMissionId } = req.params;
            const data = req.body;

            const payload = { ...data, bigMissionId: parseInt(bigMissionId) };
            const [newTopic] = await db.insert(bigMissionTopics).values(payload).returning();
            res.json(newTopic);
        } catch (error) {
            console.error("Error creating big mission topic:", error);
            res.status(500).json({ error: "토픽 생성에 실패했습니다." });
        }
    }

    async updateTopic(req: Request, res: Response) {
        try {
            const { bigMissionId, topicId } = req.params;
            const data = req.body;

            const [updatedTopic] = await db.update(bigMissionTopics)
                .set({ ...data, updatedAt: new Date() })
                .where(eq(bigMissionTopics.id, parseInt(topicId)))
                .returning();

            if (!updatedTopic) {
                return res.status(404).json({ error: "토픽을 찾을 수 없습니다." });
            }

            res.json(updatedTopic);
        } catch (error) {
            console.error("Error updating big mission topic:", error);
            res.status(500).json({ error: "토픽 수정에 실패했습니다." });
        }
    }

    async deleteTopic(req: Request, res: Response) {
        try {
            const { bigMissionId, topicId } = req.params;
            const [deletedTopic] = await db.delete(bigMissionTopics)
                .where(eq(bigMissionTopics.id, parseInt(topicId)))
                .returning();

            if (!deletedTopic) {
                return res.status(404).json({ error: "토픽을 찾을 수 없습니다." });
            }

            res.json({ success: true, topic: deletedTopic });
        } catch (error) {
            console.error("Error deleting big mission topic:", error);
            res.status(500).json({ error: "토픽 삭제에 실패했습니다." });
        }
    }
}
