import { db } from "@db";
import { missionFolders, themeMissions } from "@shared/schema";
import { eq, asc, sql, and } from "drizzle-orm";

export class AdminMissionFolderService {
  async getAllFolders() {
    return await db.query.missionFolders.findMany({
      orderBy: [asc(missionFolders.order), asc(missionFolders.id)],
      with: {
        themeMissions: {
          where: and(
            eq(themeMissions.isActive, true),
            sql`${themeMissions.parentMissionId} IS NULL`,
          ),
          orderBy: [asc(themeMissions.order)],
        },
      },
    });
  }

  async createFolder(data: any) {
    const maxOrderResult = await db
      .select({ maxOrder: sql<number>`COALESCE(MAX("order"), 0)` })
      .from(missionFolders);
    const newOrder = (maxOrderResult[0]?.maxOrder || 0) + 1;

    const [folder] = await db
      .insert(missionFolders)
      .values({ ...data, order: newOrder })
      .returning();

    return folder;
  }

  async reorderFolders(folderIds: number[]) {
    for (let i = 0; i < folderIds.length; i++) {
      await db
        .update(missionFolders)
        .set({ order: i, updatedAt: new Date() })
        .where(eq(missionFolders.id, folderIds[i]));
    }
  }

  async updateFolder(id: number, data: any) {
    const existing = await db.query.missionFolders.findFirst({
      where: eq(missionFolders.id, id),
    });

    if (!existing) throw new Error("NOT_FOUND");

    const [updatedFolder] = await db
      .update(missionFolders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(missionFolders.id, id))
      .returning();

    return updatedFolder;
  }

  async deleteFolder(id: number) {
    await db
      .update(themeMissions)
      .set({ folderId: null, updatedAt: new Date() })
      .where(eq(themeMissions.folderId, id));

    const [deletedFolder] = await db
      .delete(missionFolders)
      .where(eq(missionFolders.id, id))
      .returning();

    if (!deletedFolder) throw new Error("NOT_FOUND");

    return deletedFolder;
  }
}
