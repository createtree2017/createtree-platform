import { db } from "@db";
import { themeMissions, subMissions, subMissionSubmissions, userMissionProgress, actionTypes, MISSION_STATUS, VISIBILITY_TYPE } from "@shared/schema";
import { eq, and, or, asc, desc, sql, inArray } from "drizzle-orm";
import { ensurePermanentUrl } from "../../utils/gcs-image-storage";

export class AdminMissionReviewService {
  async getThemeMissionsWithStats(userRole: string | undefined, userHospitalId: number | undefined, hospitalIdQuery: any) {
    if (userRole === "hospital_admin" && hospitalIdQuery) {
      throw new Error("UNAUTHORIZED_HOSPITAL");
    }

    const conditions = [];
    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");
      conditions.push(
        or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        )
      );
    } else if (hospitalIdQuery && hospitalIdQuery !== "all") {
      const filterHospitalId = parseInt(hospitalIdQuery, 10);
      if (!isNaN(filterHospitalId)) {
        conditions.push(eq(themeMissions.hospitalId, filterHospitalId));
      }
    }

    const missions = await db.query.themeMissions.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        category: true,
        hospital: true,
        subMissions: { orderBy: [asc(subMissions.order)] },
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)],
    });

    const missionsWithStats = await Promise.all(
      missions.map(async (mission) => {
        const subMissionIds = mission.subMissions.map((sm) => sm.id);
        if (subMissionIds.length === 0) {
          return {
            ...mission,
            stats: { pending: 0, approved: 0, rejected: 0, total: 0 },
          };
        }

        const statsResult = await db
          .select({
            pending: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int`,
            approved: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.APPROVED} THEN 1 END)::int`,
            rejected: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.REJECTED} THEN 1 END)::int`,
            waitlist: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.WAITLIST} THEN 1 END)::int`,
            cancelled: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.CANCELLED} THEN 1 END)::int`,
            total: sql<number>`COUNT(*)::int`,
          })
          .from(subMissionSubmissions)
          .where(inArray(subMissionSubmissions.subMissionId, subMissionIds));

        return {
          ...mission,
          stats: statsResult[0] || { pending: 0, approved: 0, rejected: 0, waitlist: 0, cancelled: 0, total: 0 },
        };
      })
    );

    const missionMap = new Map<number, any>();
    const rootMissions: any[] = [];
    const includedMissionIds = new Set(missionsWithStats.map((m) => m.id));

    for (const mission of missionsWithStats) {
      missionMap.set(mission.id, { ...mission, childMissions: [] });
    }

    for (const mission of missionsWithStats) {
      const missionWithChildren = missionMap.get(mission.id)!;
      if (mission.parentMissionId) {
        if (includedMissionIds.has(mission.parentMissionId)) {
          const parent = missionMap.get(mission.parentMissionId);
          if (parent) parent.childMissions.push(missionWithChildren);
        } else {
          rootMissions.push(missionWithChildren);
        }
      } else {
        rootMissions.push(missionWithChildren);
      }
    }

    return rootMissions;
  }

  async getSubMissionsWithStats(missionId: string, userRole: string | undefined, userHospitalId: number | undefined) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
    });

    if (!mission) throw new Error("MISSION_NOT_FOUND");

    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");
      if (mission.visibilityType === VISIBILITY_TYPE.HOSPITAL && mission.hospitalId !== userHospitalId) {
        throw new Error("UNAUTHORIZED");
      }
    }

    const subMissionsList = await db.query.subMissions.findMany({
      where: eq(subMissions.themeMissionId, mission.id),
      orderBy: [asc(subMissions.order)],
      with: { actionType: true },
    });

    return await Promise.all(
      subMissionsList.map(async (subMission) => {
        const statsResult = await db
          .select({
            pending: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.SUBMITTED} THEN 1 END)::int`,
            approved: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.APPROVED} THEN 1 END)::int`,
            rejected: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.REJECTED} THEN 1 END)::int`,
            waitlist: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.WAITLIST} THEN 1 END)::int`,
            cancelled: sql<number>`COUNT(CASE WHEN ${subMissionSubmissions.status} = ${MISSION_STATUS.CANCELLED} THEN 1 END)::int`,
            total: sql<number>`COUNT(*)::int`,
          })
          .from(subMissionSubmissions)
          .where(eq(subMissionSubmissions.subMissionId, subMission.id));

        return {
          ...subMission,
          stats: statsResult[0] || { pending: 0, approved: 0, rejected: 0, waitlist: 0, cancelled: 0, total: 0 },
        };
      })
    );
  }

  async getSubmissions(queryStr: any, userRole: string | undefined, userHospitalId: number | undefined) {
    const { subMissionId, status, hospitalId } = queryStr;

    if (userRole === "hospital_admin" && hospitalId) {
      throw new Error("UNAUTHORIZED_HOSPITAL");
    }

    let submissions;
    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");

      const accessibleMissions = await db.query.themeMissions.findMany({
        where: or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        ),
        columns: { id: true },
      });

      const accessibleMissionIds = accessibleMissions.map((m) => m.id);
      if (accessibleMissionIds.length === 0) return [];

      const accessibleSubMissions = await db.query.subMissions.findMany({
        where: inArray(subMissions.themeMissionId, accessibleMissionIds),
        columns: { id: true },
      });

      const accessibleSubMissionIds = accessibleSubMissions.map((sm) => sm.id);
      if (accessibleSubMissionIds.length === 0) return [];

      const conditions = [inArray(subMissionSubmissions.subMissionId, accessibleSubMissionIds)];

      if (subMissionId) {
        const requestedSubMissionId = parseInt(subMissionId as string);
        if (!accessibleSubMissionIds.includes(requestedSubMissionId)) {
          throw new Error("UNAUTHORIZED");
        }
        conditions.push(eq(subMissionSubmissions.subMissionId, requestedSubMissionId));
      }

      if (status && status !== "all") {
        conditions.push(eq(subMissionSubmissions.status, status as string));
      }

      submissions = await db.query.subMissionSubmissions.findMany({
        where: and(...conditions),
        with: {
          user: true,
          subMission: {
            with: {
              themeMission: {
                with: { category: true, hospital: true },
              },
            },
          },
        },
        orderBy: [desc(subMissionSubmissions.submittedAt)],
      });
    } else {
      const conditions = [];
      if (subMissionId) {
        conditions.push(eq(subMissionSubmissions.subMissionId, parseInt(subMissionId as string)));
      }
      if (status && status !== "all") {
        conditions.push(eq(subMissionSubmissions.status, status as string));
      }

      submissions = await db.query.subMissionSubmissions.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        with: {
          user: true,
          subMission: {
            with: {
              themeMission: {
                with: { category: true, hospital: true },
              },
            },
          },
        },
        orderBy: [desc(subMissionSubmissions.submittedAt)],
      });
    }

    return submissions.map((submission: any) => {
      const originalData = submission.submissionData as any;
      if (!originalData) return submission;

      const processedData = JSON.parse(JSON.stringify(originalData));
      if (processedData.fileUrl && processedData.gsPath) {
        processedData.fileUrl = ensurePermanentUrl(processedData.fileUrl, processedData.gsPath);
      }
      if (processedData.imageUrl && processedData.gsPath) {
        processedData.imageUrl = ensurePermanentUrl(processedData.imageUrl, processedData.gsPath);
      }
      if (processedData.slots && Array.isArray(processedData.slots)) {
        processedData.slots = processedData.slots.map((slot: any) => ({
          ...slot,
          fileUrl: slot.fileUrl && slot.gsPath ? ensurePermanentUrl(slot.fileUrl, slot.gsPath) : slot.fileUrl,
          imageUrl: slot.imageUrl && slot.gsPath ? ensurePermanentUrl(slot.imageUrl, slot.gsPath) : slot.imageUrl,
        }));
      }
      return { ...submission, submissionData: processedData };
    });
  }

  async getPendingSubmissions(userRole: string | undefined, userHospitalId: number | undefined) {
    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");

      const accessibleMissions = await db.query.themeMissions.findMany({
        where: or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        ),
        columns: { id: true },
      });

      const accessibleMissionIds = accessibleMissions.map((m) => m.id);
      if (accessibleMissionIds.length === 0) return [];

      const accessibleSubMissions = await db.query.subMissions.findMany({
        where: inArray(subMissions.themeMissionId, accessibleMissionIds),
        columns: { id: true },
      });

      const accessibleSubMissionIds = accessibleSubMissions.map((sm) => sm.id);
      if (accessibleSubMissionIds.length === 0) return [];

      return await db.query.subMissionSubmissions.findMany({
        where: and(
          inArray(subMissionSubmissions.subMissionId, accessibleSubMissionIds),
          eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED)
        ),
        with: {
          user: true,
          subMission: {
            with: {
              themeMission: {
                with: { category: true },
              },
            },
          },
        },
        orderBy: [desc(subMissionSubmissions.submittedAt)],
        limit: 50,
      });
    }

    return await db.query.subMissionSubmissions.findMany({
      where: eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED),
      with: {
        user: true,
        subMission: {
          with: {
            themeMission: {
              with: { category: true },
            },
          },
        },
      },
      orderBy: [desc(subMissionSubmissions.submittedAt)],
      limit: 50,
    });
  }

  async approveSubmission(submissionId: number, adminId: number) {
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: eq(subMissionSubmissions.id, submissionId),
    });

    if (!submission) throw new Error("NOT_FOUND");
    if (submission.status !== MISSION_STATUS.SUBMITTED) throw new Error("NOT_PENDING");

    const [approved] = await db
      .update(subMissionSubmissions)
      .set({
        status: MISSION_STATUS.APPROVED,
        isLocked: true,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subMissionSubmissions.id, submissionId))
      .returning();

    return approved;
  }

  async rejectSubmission(submissionId: number, adminId: number, rejectReason: string) {
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: eq(subMissionSubmissions.id, submissionId),
    });

    if (!submission) throw new Error("NOT_FOUND");
    if (submission.status !== MISSION_STATUS.SUBMITTED) throw new Error("NOT_PENDING");

    const [rejected] = await db
      .update(subMissionSubmissions)
      .set({
        status: MISSION_STATUS.REJECTED,
        isLocked: false,
        rejectReason: rejectReason || null,
        reviewedBy: adminId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subMissionSubmissions.id, submissionId))
      .returning();

    return rejected;
  }

  async bulkUpdateStatus(submissionIds: number[], status: string, adminId: number, rejectReason?: string) {
    if (![MISSION_STATUS.APPROVED, MISSION_STATUS.REJECTED, MISSION_STATUS.SUBMITTED, MISSION_STATUS.WAITLIST, MISSION_STATUS.CANCELLED].includes(status as any)) {
      throw new Error("INVALID_STATUS");
    }

    const isLocked = status === MISSION_STATUS.APPROVED;

    const [updated] = await db
      .update(subMissionSubmissions)
      .set({
        status: status as any,
        isLocked,
        rejectReason: status === MISSION_STATUS.REJECTED ? (rejectReason || null) : null,
        reviewedBy: [MISSION_STATUS.APPROVED, MISSION_STATUS.REJECTED].includes(status as any) ? adminId : null,
        reviewedAt: [MISSION_STATUS.APPROVED, MISSION_STATUS.REJECTED].includes(status as any) ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(inArray(subMissionSubmissions.id, submissionIds))
      .returning();

    return updated;
  }

  async getRecentActivities(userRole: string | undefined, userHospitalId: number | undefined) {
    let submissionsCondition = undefined;

    if (userRole === "hospital_admin") {
      if (!userHospitalId) throw new Error("NO_HOSPITAL_INFO");

      const accessibleMissions = await db.query.themeMissions.findMany({
        where: or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, userHospitalId)
          )
        ),
        columns: { id: true },
      });

      const accessibleMissionIds = accessibleMissions.map((m) => m.id);
      if (accessibleMissionIds.length === 0) return { recentSubmissions: [], recentApplications: [] };

      const accessibleSubMissions = await db.query.subMissions.findMany({
        where: inArray(subMissions.themeMissionId, accessibleMissionIds),
        columns: { id: true },
      });

      const accessibleSubMissionIds = accessibleSubMissions.map((sm) => sm.id);
      if (accessibleSubMissionIds.length === 0) return { recentSubmissions: [], recentApplications: [] };

      submissionsCondition = inArray(subMissionSubmissions.subMissionId, accessibleSubMissionIds);
    }

    const recentSubmissions = await db.query.subMissionSubmissions.findMany({
      where: submissionsCondition,
      with: {
        user: true,
        subMission: {
          with: {
            themeMission: {
              with: { category: true },
            },
          },
        },
      },
      orderBy: [desc(subMissionSubmissions.submittedAt)],
      limit: 10,
    });

    const recentApplications = await db.query.subMissionSubmissions.findMany({
      where: submissionsCondition ? and(
        submissionsCondition,
        eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED)
      ) : eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED),
      with: {
        user: true,
        subMission: {
          with: {
            themeMission: {
              with: { category: true },
            },
            actionType: true,
          },
        },
      },
      orderBy: [desc(subMissionSubmissions.submittedAt)],
      limit: 10,
    });

    return { recentSubmissions, recentApplications };
  }
}
