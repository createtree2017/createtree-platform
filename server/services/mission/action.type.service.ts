import { db } from "@db";
import { actionTypes, subMissions } from "@shared/schema";
import { eq, asc, desc } from "drizzle-orm";

export class ActionTypeService {
  async getAllActionTypes() {
    return await db.query.actionTypes.findMany({
      orderBy: [asc(actionTypes.order)],
    });
  }

  async getActiveActionTypes() {
    return await db.query.actionTypes.findMany({
      where: eq(actionTypes.isActive, true),
      orderBy: [asc(actionTypes.order)],
    });
  }

  async createActionType(data: any) {
    const lastType = await db.query.actionTypes.findFirst({
      orderBy: [desc(actionTypes.order)],
    });
    
    const nextOrder = (lastType?.order || 0) + 1;

    const [newType] = await db
      .insert(actionTypes)
      .values({
        ...data,
        order: nextOrder,
        isSystem: false,
      })
      .returning();

    return newType;
  }

  async updateActionType(id: number, data: any) {
    const existing = await db.query.actionTypes.findFirst({
      where: eq(actionTypes.id, id),
    });

    if (!existing) throw new Error("NOT_FOUND");
    if (existing.isSystem && data.name && data.name !== existing.name) {
      throw new Error("SYSTEM_NAME_IMMUTABLE");
    }

    const [updated] = await db
      .update(actionTypes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(actionTypes.id, id))
      .returning();

    return updated;
  }

  async deleteActionType(id: number) {
    const existing = await db.query.actionTypes.findFirst({
      where: eq(actionTypes.id, id),
    });

    if (!existing) throw new Error("NOT_FOUND");
    if (existing.isSystem) throw new Error("SYSTEM_IMMUTABLE");

    const usedInMissions = await db.query.subMissions.findFirst({
      where: eq(subMissions.actionTypeId, id),
    });

    if (usedInMissions) throw new Error("IN_USE");

    await db.delete(actionTypes).where(eq(actionTypes.id, id));
    return { success: true };
  }

  async reorderActionTypes(orderedIds: number[]) {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(actionTypes)
        .set({ order: i + 1, updatedAt: new Date() })
        .where(eq(actionTypes.id, orderedIds[i]));
    }

    return await db.query.actionTypes.findMany({
      orderBy: [asc(actionTypes.order)],
    });
  }
}
