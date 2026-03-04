import { db } from "@db";
import { subMissions, themeMissions } from "@shared/schema";
import { eq, asc, sql } from "drizzle-orm";

export class MissionSubService {
  async getSubMissions(missionId: string) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
    });

    if (!mission) {
      throw new Error("MISSION_NOT_FOUND");
    }

    return await db.query.subMissions.findMany({
      where: eq(subMissions.themeMissionId, mission.id),
      orderBy: [asc(subMissions.order)],
    });
  }

  async createSubMission(missionId: string, subMissionData: any) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
    });

    if (!mission) {
      throw new Error("MISSION_NOT_FOUND");
    }

    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX("order"), -1)::int` })
      .from(subMissions)
      .where(eq(subMissions.themeMissionId, mission.id));

    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    const dataToInsert = {
      ...subMissionData,
      themeMissionId: mission.id,
      order: nextOrder,
    };

    if (dataToInsert.startDate && typeof dataToInsert.startDate === "string" && dataToInsert.startDate.trim() !== "") {
      const parsed = new Date(`${dataToInsert.startDate}T00:00:00+09:00`);
      dataToInsert.startDate = isNaN(parsed.getTime()) ? null : parsed;
    } else {
      dataToInsert.startDate = null;
    }

    if (dataToInsert.endDate && typeof dataToInsert.endDate === "string" && dataToInsert.endDate.trim() !== "") {
      const parsed = new Date(`${dataToInsert.endDate}T23:59:59+09:00`);
      dataToInsert.endDate = isNaN(parsed.getTime()) ? null : parsed;
    } else {
      dataToInsert.endDate = null;
    }

    dataToInsert.sequentialLevel = parseInt(dataToInsert.sequentialLevel) || 0;

    const [newSubMission] = await db
      .insert(subMissions)
      .values(dataToInsert)
      .returning();

    return newSubMission;
  }

  async updateSubMission(subId: number, subMissionData: any) {
    const dataToUpdate = { ...subMissionData };

    if (dataToUpdate.startDate && typeof dataToUpdate.startDate === "string" && dataToUpdate.startDate.trim() !== "") {
      const parsed = new Date(`${dataToUpdate.startDate}T00:00:00+09:00`);
      dataToUpdate.startDate = isNaN(parsed.getTime()) ? null : parsed;
    } else {
      dataToUpdate.startDate = null;
    }

    if (dataToUpdate.endDate && typeof dataToUpdate.endDate === "string" && dataToUpdate.endDate.trim() !== "") {
      const parsed = new Date(`${dataToUpdate.endDate}T23:59:59+09:00`);
      dataToUpdate.endDate = isNaN(parsed.getTime()) ? null : parsed;
    } else {
      dataToUpdate.endDate = null;
    }

    dataToUpdate.sequentialLevel = parseInt(dataToUpdate.sequentialLevel) || 0;

    const [updatedSubMission] = await db
      .update(subMissions)
      .set({ ...dataToUpdate, updatedAt: new Date() })
      .where(eq(subMissions.id, subId))
      .returning();

    if (!updatedSubMission) {
      throw new Error("NOT_FOUND");
    }

    return updatedSubMission;
  }

  async deleteSubMission(subId: number) {
    const [deletedSubMission] = await db
      .delete(subMissions)
      .where(eq(subMissions.id, subId))
      .returning();

    if (!deletedSubMission) {
      throw new Error("NOT_FOUND");
    }

    return deletedSubMission;
  }

  async reorderSubMissions(orders: Array<{ id: number; order: number }>) {
    for (const item of orders) {
      await db
        .update(subMissions)
        .set({ order: item.order, updatedAt: new Date() })
        .where(eq(subMissions.id, item.id));
    }
  }

  async duplicateSubMission(subId: number) {
    const original = await db.query.subMissions.findFirst({
      where: eq(subMissions.id, subId),
    });

    if (!original) {
      throw new Error("NOT_FOUND");
    }

    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX("order"), -1)::int` })
      .from(subMissions)
      .where(eq(subMissions.themeMissionId, original.themeMissionId));

    const nextOrder = (maxOrderResult[0]?.maxOrder ?? -1) + 1;

    const { id: _id, createdAt: _ca, updatedAt: _ua, ...subData } = original as any;

    const [newSubMission] = await db
      .insert(subMissions)
      .values({
        ...subData,
        title: `[복사본] ${original.title}`,
        order: nextOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newSubMission;
  }
}
