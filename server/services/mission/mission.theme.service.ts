import { db } from "@db";
import { themeMissions, subMissions, subMissionSubmissions, userMissionProgress, VISIBILITY_TYPE, MISSION_STATUS } from "@shared/schema";
import { eq, and, or, asc, desc, sql } from "drizzle-orm";
import { saveImageToGCS } from "../../utils/gcs-image-storage";

export class MissionThemeService {
  async uploadHeaderImage(file: any) {
    if (!file) {
      throw new Error("FILE_REQUIRED");
    }

    const result = await saveImageToGCS(
      file.buffer,
      "admin",
      "mission-headers",
      file.originalname
    );

    return {
      imageUrl: result.originalUrl,
      gsPath: result.gsPath,
    };
  }

  async reorderMissions(missionOrders: Array<{ id: number; order: number; folderId: number | null }>) {
    for (const item of missionOrders) {
      await db
        .update(themeMissions)
        .set({
          order: item.order,
          folderId: item.folderId,
          updatedAt: new Date(),
        })
        .where(eq(themeMissions.id, item.id));
    }
  }

  async getAdminMissions(filters: {
    visibilityType?: string;
    hospitalId?: number;
    isActive?: boolean;
    categoryId?: string;
    parentMissionId?: number;
  }) {
    const conditions = [];

    if (filters.visibilityType) {
      conditions.push(eq(themeMissions.visibilityType, filters.visibilityType));
    }
    if (filters.hospitalId) {
      conditions.push(eq(themeMissions.hospitalId, filters.hospitalId));
    }
    if (filters.isActive !== undefined) {
      conditions.push(eq(themeMissions.isActive, filters.isActive));
    }
    if (filters.categoryId) {
      conditions.push(eq(themeMissions.categoryId, filters.categoryId));
    }
    if (filters.parentMissionId) {
      conditions.push(eq(themeMissions.parentMissionId, filters.parentMissionId));
    }

    const missions = await db.query.themeMissions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        category: true,
        hospital: true,
        subMissions: {
          orderBy: [asc(subMissions.order)],
        },
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)],
    });

    const missionMap = new Map<number, any>();
    const rootMissions: any[] = [];

    for (const mission of missions) {
      missionMap.set(mission.id, {
        ...mission,
        subMissionCount: mission.subMissions.length,
        childMissions: [],
      });
    }

    for (const mission of missions) {
      const missionWithChildren = missionMap.get(mission.id)!;
      if (mission.parentMissionId) {
        const parent = missionMap.get(mission.parentMissionId);
        if (parent) {
          parent.childMissions.push(missionWithChildren);
        } else {
          rootMissions.push(missionWithChildren);
        }
      } else {
        rootMissions.push(missionWithChildren);
      }
    }

    for (const mission of missionMap.values()) {
      mission.childMissionCount = mission.childMissions.length;
    }

    return rootMissions;
  }

  async getMissionById(missionId: string) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
      with: {
        category: true,
        hospital: true,
        subMissions: {
          orderBy: [asc(subMissions.order)],
        },
      },
    });

    if (!mission) {
      throw new Error("NOT_FOUND");
    }

    return mission;
  }

  async createMission(missionData: any) {
    if (
      missionData.visibilityType === VISIBILITY_TYPE.HOSPITAL &&
      !missionData.hospitalId
    ) {
      throw new Error("HOSPITAL_ID_REQUIRED");
    }

    const [newMission] = await db
      .insert(themeMissions)
      .values(missionData)
      .returning();

    return newMission;
  }

  async updateMission(id: number, missionData: any) {
    if (
      missionData.visibilityType === VISIBILITY_TYPE.HOSPITAL &&
      !missionData.hospitalId
    ) {
      throw new Error("HOSPITAL_ID_REQUIRED");
    }

    if (missionData.visibilityType === VISIBILITY_TYPE.PUBLIC) {
      missionData.hospitalId = null;
    }

    const dateFields = ["startDate", "endDate", "eventDate", "eventEndTime"];
    dateFields.forEach((field) => {
      if (missionData[field]) {
        const value = missionData[field];
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const parsed = new Date(`${value}T00:00:00+09:00`);
          missionData[field] = isNaN(parsed.getTime()) ? null : parsed;
        } else {
          const parsed = new Date(value);
          missionData[field] = isNaN(parsed.getTime()) ? null : parsed;
        }
      }
    });

    const [updatedMission] = await db
      .update(themeMissions)
      .set({ ...missionData, updatedAt: new Date() })
      .where(eq(themeMissions.id, id))
      .returning();

    if (!updatedMission) {
      throw new Error("NOT_FOUND");
    }

    return updatedMission;
  }

  async deleteMission(id: number) {
    const [deletedMission] = await db
      .delete(themeMissions)
      .where(eq(themeMissions.id, id))
      .returning();

    if (!deletedMission) {
      throw new Error("NOT_FOUND");
    }

    return deletedMission;
  }

  async duplicateMission(id: number) {
    const original = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, id),
      with: {
        subMissions: {
          orderBy: [asc(subMissions.order)],
        },
        childMissions: {
          with: {
            subMissions: {
              orderBy: [asc(subMissions.order)],
            },
          },
        },
      },
    });

    if (!original) {
      throw new Error("NOT_FOUND");
    }

    const newMissionId = `${original.missionId}-copy-${Date.now()}`;
    const {
      id: _id,
      missionId: _mid,
      createdAt: _ca,
      updatedAt: _ua,
      subMissions: _sm,
      childMissions: _cm,
      category: _cat,
      hospital: _h,
      folder: _f,
      parentMission: _pm,
      userProgress: _up,
      ...missionData
    } = original as any;

    const [newMission] = await db
      .insert(themeMissions)
      .values({
        ...missionData,
        missionId: newMissionId,
        title: `[복사본] ${original.title}`,
        visibilityType: VISIBILITY_TYPE.DEV,
        hospitalId: null,
        parentMissionId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (original.subMissions && original.subMissions.length > 0) {
      for (const sub of original.subMissions) {
        const {
          id: _sid,
          themeMissionId: _tmid,
          createdAt: _sca,
          updatedAt: _sua,
          ...subData
        } = sub;
        await db.insert(subMissions).values({
          ...subData,
          themeMissionId: newMission.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    if (original.childMissions && original.childMissions.length > 0) {
      for (const child of original.childMissions) {
        const childNewMissionId = `${child.missionId}-copy-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const {
          id: _cid,
          missionId: _cmid,
          parentMissionId: _pmid,
          createdAt: _cca,
          updatedAt: _cua,
          subMissions: _csm,
          childMissions: _ccm,
          category: _ccat,
          hospital: _ch,
          ...childData
        } = child as any;

        const [newChild] = await db
          .insert(themeMissions)
          .values({
            ...childData,
            missionId: childNewMissionId,
            title: `[복사본] ${child.title}`,
            visibilityType: VISIBILITY_TYPE.DEV,
            hospitalId: null,
            parentMissionId: newMission.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        if (child.subMissions && child.subMissions.length > 0) {
          for (const sub of child.subMissions) {
            const {
              id: _sid,
              themeMissionId: _tmid,
              createdAt: _sca,
              updatedAt: _sua,
              ...subData
            } = sub;
            await db.insert(subMissions).values({
              ...subData,
              themeMissionId: newChild.id,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }
      }
    }

    return newMission;
  }

  // --- CHILD MISSIONS & STATS ---

  async getChildMissions(parentId: number) {
    const childMissions = await db.query.themeMissions.findMany({
      where: eq(themeMissions.parentMissionId, parentId),
      with: {
        category: true,
        hospital: true,
        subMissions: {
          orderBy: [asc(subMissions.order)],
        },
        childMissions: true,
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)],
    });

    return await Promise.all(
      childMissions.map(async (mission) => {
        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(userMissionProgress)
          .where(
            and(
              eq(userMissionProgress.themeMissionId, mission.id),
              eq(userMissionProgress.status, MISSION_STATUS.APPROVED),
            )
          );

        return {
          ...mission,
          subMissionCount: mission.subMissions.length,
          childMissionCount: mission.childMissions?.length || 0,
          approvedUserCount: approvedCount[0]?.count || 0,
        };
      })
    );
  }

  async createChildMission(parentId: number, missionData: any) {
    const parentMission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, parentId),
    });

    if (!parentMission) {
      throw new Error("PARENT_NOT_FOUND");
    }

    const parseKoreanDate = (dateStr: string | null | undefined) => {
      if (!dateStr) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(`${dateStr}T00:00:00+09:00`);
      }
      return new Date(dateStr);
    };

    const [newChildMission] = await db
      .insert(themeMissions)
      .values({
        missionId: missionData.missionId,
        title: missionData.title,
        description: missionData.description || "",
        categoryId: missionData.categoryId || null,
        order: missionData.order,
        isActive: missionData.isActive,
        startDate: parseKoreanDate(missionData.startDate),
        endDate: parseKoreanDate(missionData.endDate),
        parentMissionId: parentId,
        hospitalId: parentMission.hospitalId,
        visibilityType: parentMission.visibilityType,
      })
      .returning();

    return newChildMission;
  }

  async getApprovedUsers(parentId: number) {
    const approvedProgress = await db.query.userMissionProgress.findMany({
      where: and(
        eq(userMissionProgress.themeMissionId, parentId),
        eq(userMissionProgress.status, MISSION_STATUS.APPROVED),
      ),
      with: {
        user: true,
      },
    });

    return approvedProgress.map((p) => ({
      userId: p.userId,
      name: (p.user as any)?.name || "알 수 없음",
      email: (p.user as any)?.email || "",
      approvedAt: p.reviewedAt,
    }));
  }

  async toggleActive(id: number) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, id),
    });

    if (!mission) {
      throw new Error("NOT_FOUND");
    }

    const [updatedMission] = await db
      .update(themeMissions)
      .set({
        isActive: !mission.isActive,
        updatedAt: new Date(),
      })
      .where(eq(themeMissions.id, id))
      .returning();

    return updatedMission;
  }

  async getAdminStats() {
    const totalMissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(themeMissions);

    const activeMissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(themeMissions)
      .where(eq(themeMissions.isActive, true));

    const publicMissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(themeMissions)
      .where(eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC));

    const hospitalMissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(themeMissions)
      .where(eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL));

    return {
      total: totalMissions[0]?.count || 0,
      active: activeMissions[0]?.count || 0,
      public: publicMissions[0]?.count || 0,
      hospital: hospitalMissions[0]?.count || 0,
    };
  }
}
