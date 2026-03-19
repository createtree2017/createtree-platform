import { db } from "@db";
import { themeMissions, subMissions, subMissionSubmissions, userMissionProgress, MISSION_STATUS, VISIBILITY_TYPE } from "@shared/schema";
import { eq, and, or, asc, desc, sql, not, inArray } from "drizzle-orm";
import { countAllMissions, buildMissionTree } from "../../utils/mission-utils";
import { ensurePermanentUrl } from "../../utils/gcs-image-storage";

export class UserMissionService {
  async getMyParticipatedMissions(userId: number) {
    const userSubmissions = await db
      .select({
        themeMissionId: subMissions.themeMissionId,
      })
      .from(subMissionSubmissions)
      .innerJoin(
        subMissions,
        eq(subMissionSubmissions.subMissionId, subMissions.id),
      )
      .where(eq(subMissionSubmissions.userId, userId))
      .groupBy(subMissions.themeMissionId);

    if (userSubmissions.length === 0) {
      return [];
    }

    const themeMissionIds = userSubmissions.map((s) => s.themeMissionId);

    async function getRootMissionId(missionId: number): Promise<number> {
      const mission = await db.query.themeMissions.findFirst({
        where: eq(themeMissions.id, missionId),
      });

      if (!mission || !mission.parentMissionId) {
        return missionId;
      }

      return getRootMissionId(mission.parentMissionId);
    }

    const rootMissionIds = await Promise.all(
      themeMissionIds.map((id) => getRootMissionId(id)),
    );
    const uniqueRootMissionIds = [...new Set(rootMissionIds)];

    const missions = await db.query.themeMissions.findMany({
      where: and(
        inArray(themeMissions.id, uniqueRootMissionIds),
        eq(themeMissions.isActive, true),
      ),
      with: {
        category: true,
        hospital: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
          orderBy: [asc(subMissions.order)],
        },
        childMissions: {
          where: eq(themeMissions.isActive, true),
        },
      },
      orderBy: [desc(themeMissions.id)],
    });

    return await Promise.all(
      missions.map(async (mission) => {
        const progress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, mission.id),
          ),
        });

        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`,
            ),
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = approvedCount[0]?.count || 0;
        const progressPercentage =
          totalSubMissions > 0
            ? Math.round((completedSubMissions / totalSubMissions) * 100)
            : 0;

        const totalMissionCount = await countAllMissions(mission.id);

        return {
          ...mission,
          hasChildMissions:
            mission.childMissions && mission.childMissions.length > 0,
          childMissionCount: mission.childMissions?.length || 0,
          totalMissionCount,
          userProgress: {
            status: progress?.status || MISSION_STATUS.IN_PROGRESS,
            progressPercent: progressPercentage,
            completedSubMissions,
            totalSubMissions,
          },
          hasGift: !!(mission.giftImageUrl || mission.giftDescription),
        };
      }),
    );
  }

  async getPublicMissions(userId: number, userHospitalId: number | undefined, isSuperAdmin: boolean, superadminFilter?: string) {
    let visibilityCondition;

    if (isSuperAdmin) {
      if (superadminFilter === 'dev') {
        visibilityCondition = eq(themeMissions.visibilityType, VISIBILITY_TYPE.DEV);
      } else if (superadminFilter === 'public') {
        visibilityCondition = eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC);
      } else if (superadminFilter?.startsWith('hospital:')) {
        const hospitalIdMatch = parseInt(superadminFilter.replace('hospital:', ''), 10);
        if (!isNaN(hospitalIdMatch)) {
          visibilityCondition = and(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
            eq(themeMissions.hospitalId, hospitalIdMatch)
          );
        } else {
          visibilityCondition = or(
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.DEV),
            eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL)
          );
        }
      } else {
        visibilityCondition = or(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.DEV),
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL)
        );
      }
    } else {
      visibilityCondition = or(
        eq(themeMissions.visibilityType, VISIBILITY_TYPE.PUBLIC),
        and(
          eq(themeMissions.visibilityType, VISIBILITY_TYPE.HOSPITAL),
          userHospitalId
            ? eq(themeMissions.hospitalId, userHospitalId)
            : sql`false`,
        ),
      );
    }

    const conditions = [
      eq(themeMissions.isActive, true),
      sql`${themeMissions.parentMissionId} IS NULL`, // 최상위 미션만 조회
      visibilityCondition,
    ];

    const missions = await db.query.themeMissions.findMany({
      where: and(...conditions),
      with: {
        category: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
          orderBy: [asc(subMissions.order)],
          with: {
            actionType: true,
          },
        },
        childMissions: {
          where: eq(themeMissions.isActive, true),
        },
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)],
    });

    return await Promise.all(
      missions.map(async (mission) => {
        const progress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, mission.id),
          ),
        });

        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`,
            ),
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = approvedCount[0]?.count || 0;
        const progressPercentage =
          totalSubMissions > 0
            ? Math.round((completedSubMissions / totalSubMissions) * 100)
            : 0;

        let status = progress?.status || MISSION_STATUS.NOT_STARTED;
        if (!progress) {
          const now = new Date();
          const startDate = mission.startDate
            ? new Date(mission.startDate)
            : null;
          const endDate = mission.endDate ? new Date(mission.endDate) : null;

          if (startDate && endDate) {
            if (now < startDate) {
              status = MISSION_STATUS.NOT_STARTED;
            } else if (now >= startDate && now <= endDate) {
              status = MISSION_STATUS.IN_PROGRESS;
            } else {
              status = MISSION_STATUS.NOT_STARTED;
            }
          } else if (startDate && now >= startDate) {
            status = MISSION_STATUS.IN_PROGRESS;
          }
        }

        const hasChildMissions = (mission.childMissions?.length || 0) > 0;
        const isApprovedForChildAccess =
          progress?.status === MISSION_STATUS.APPROVED;
        const totalMissionCount = await countAllMissions(mission.id);

        const applicationSubMission = mission.subMissions.find(
          (sm: any) => sm.actionType?.name === "신청",
        );

        let currentApplicants = 0;
        if (applicationSubMission && mission.capacity) {
          const applicantCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(subMissionSubmissions)
            .where(
              and(
                eq(
                  subMissionSubmissions.subMissionId,
                  applicationSubMission.id,
                ),
                or(
                  eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
                  eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED),
                ),
              ),
            );
          currentApplicants = applicantCount[0]?.count || 0;
        }

        const applicationPeriod = applicationSubMission
          ? {
              startDate: applicationSubMission.startDate,
              endDate: applicationSubMission.endDate,
            }
          : null;

        return {
          ...mission,
          userProgress: progress
            ? {
                ...progress,
                status: progress.status,
                progressPercent: progressPercentage,
                completedSubMissions,
                totalSubMissions,
              }
            : {
                status,
                progressPercent: progressPercentage,
                completedSubMissions,
                totalSubMissions,
              },
          progressPercentage,
          completedSubMissions,
          totalSubMissions,
          hasChildMissions,
          childMissionCount: mission.childMissions?.length || 0,
          totalMissionCount,
          isApprovedForChildAccess,
          hasGift: !!(mission.giftImageUrl || mission.giftDescription),
          capacity: mission.capacity || null,
          currentApplicants,
          applicationPeriod,
        };
      }),
    );
  }

  async getChildMissions(parentId: number, userId: number, isSuperAdmin: boolean = false) {
    const parentMission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, parentId),
    });

    if (!parentMission) {
      throw new Error("PARENT_NOT_FOUND");
    }

    const parentProgress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, parentId),
        eq(userMissionProgress.status, MISSION_STATUS.APPROVED),
      ),
    });

    if (!parentProgress && !isSuperAdmin) {
      throw new Error("UNAUTHORIZED_FOR_CHILD");
    }

    const childMissions = await db.query.themeMissions.findMany({
      where: and(
        eq(themeMissions.parentMissionId, parentId),
        eq(themeMissions.isActive, true),
      ),
      with: {
        category: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
          orderBy: [asc(subMissions.order)],
        },
        childMissions: {
          where: eq(themeMissions.isActive, true),
        },
      },
      orderBy: [asc(themeMissions.order), desc(themeMissions.id)],
    });

    const childMissionsWithProgress = await Promise.all(
      childMissions.map(async (mission) => {
        const progress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, mission.id),
          ),
        });

        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`,
            ),
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = approvedCount[0]?.count || 0;
        const progressPercentage =
          totalSubMissions > 0
            ? Math.round((completedSubMissions / totalSubMissions) * 100)
            : 0;

        const hasChildMissions = (mission.childMissions?.length || 0) > 0;
        const isApprovedForChildAccess =
          progress?.status === MISSION_STATUS.APPROVED;

        return {
          ...mission,
          userProgress: progress
            ? {
                ...progress,
                progressPercent: progressPercentage,
                completedSubMissions,
                totalSubMissions,
              }
            : {
                status: MISSION_STATUS.NOT_STARTED,
                progressPercent: progressPercentage,
                completedSubMissions,
                totalSubMissions,
              },
          progressPercentage,
          completedSubMissions,
          totalSubMissions,
          hasChildMissions,
          childMissionCount: mission.childMissions?.length || 0,
          isApprovedForChildAccess,
          hasGift: !!(mission.giftImageUrl || mission.giftDescription),
        };
      }),
    );

    return {
      parentMission: {
        id: parentMission.id,
        missionId: parentMission.missionId,
        title: parentMission.title,
      },
      childMissions: childMissionsWithProgress,
    };
  }

  async getMissionHistory(userId: number) {
    const userSubmissions = await db
      .select({
        themeMissionId: subMissions.themeMissionId,
      })
      .from(subMissionSubmissions)
      .innerJoin(
        subMissions,
        eq(subMissionSubmissions.subMissionId, subMissions.id),
      )
      .where(
        and(
          eq(subMissionSubmissions.userId, userId),
          not(eq(subMissionSubmissions.status, MISSION_STATUS.CANCELLED)),
        ),
      )
      .groupBy(subMissions.themeMissionId);

    if (userSubmissions.length === 0) {
      return [];
    }

    const themeMissionIds = userSubmissions.map((s) => s.themeMissionId);

    const missions = await db.query.themeMissions.findMany({
      where: inArray(themeMissions.id, themeMissionIds),
      with: {
        category: true,
        hospital: true,
        subMissions: {
          orderBy: [asc(subMissions.order)],
        },
        childMissions: true,
      },
      orderBy: [desc(themeMissions.id)],
    });

    return await Promise.all(
      missions.map(async (mission) => {
        const progress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, mission.id),
          ),
        });

        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`,
            ),
          );

        const activeSubMissions = mission.subMissions.filter(
          (sm: any) => sm.isActive,
        );
        const totalSubMissions = activeSubMissions.length;
        const completedSubMissions = approvedCount[0]?.count || 0;
        const progressPercentage =
          totalSubMissions > 0
            ? Math.round((completedSubMissions / totalSubMissions) * 100)
            : 0;

        return {
          ...mission,
          hasChildMissions:
            mission.childMissions && mission.childMissions.length > 0,
          childMissionCount: mission.childMissions?.length || 0,
          isActive: mission.isActive,
          userProgress: {
            status: progress?.status || MISSION_STATUS.IN_PROGRESS,
            progressPercent: progressPercentage,
            completedSubMissions,
            totalSubMissions,
          },
          hasGift: !!(mission.giftImageUrl || mission.giftDescription),
        };
      }),
    );
  }

  async getMyMissions(userId: number) {
    const myProgress = await db.query.userMissionProgress.findMany({
      where: eq(userMissionProgress.userId, userId),
      with: {
        themeMission: {
          with: {
            category: true,
            subMissions: {
              where: eq(subMissions.isActive, true),
            },
          },
        },
      },
      orderBy: [desc(userMissionProgress.createdAt)],
    });

    return await Promise.all(
      myProgress.map(async (progress) => {
        const mission = progress.themeMission;

        const approvedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`,
            ),
          );

        const totalSubMissions = mission.subMissions.length;
        const completedSubMissions = approvedCount[0]?.count || 0;
        const progressPercentage =
          totalSubMissions > 0
            ? Math.round((completedSubMissions / totalSubMissions) * 100)
            : 0;

        return {
          ...progress,
          progressPercentage,
          completedSubMissions,
          totalSubMissions,
        };
      }),
    );
  }

  // Gets mission detail completely, including validating ancestors, depth processing, and more
  async getMissionDetail(missionId: string, userId: number, userHospitalId: number | undefined, isSuperAdmin: boolean) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
      with: {
        category: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
          orderBy: [asc(subMissions.order)],
          with: {
            actionType: true,
          },
        },
      },
    });

    if (!mission) throw new Error("NOT_FOUND");
    if (!mission.isActive && !isSuperAdmin) throw new Error("INACTIVE_MISSION");

    if (mission.visibilityType === VISIBILITY_TYPE.DEV && !isSuperAdmin) {
      throw new Error("UNAUTHORIZED");
    }

    if (mission.visibilityType === VISIBILITY_TYPE.HOSPITAL && !isSuperAdmin) {
      if (!userHospitalId || mission.hospitalId !== userHospitalId) {
        throw new Error("UNAUTHORIZED");
      }
    }

    if (mission.parentMissionId && !isSuperAdmin) {
      const parentProgress = await db.query.userMissionProgress.findFirst({
        where: and(
          eq(userMissionProgress.userId, userId),
          eq(userMissionProgress.themeMissionId, mission.parentMissionId),
        ),
      });

      if (!parentProgress || parentProgress.status !== MISSION_STATUS.APPROVED) {
        const parentMission = await db.query.themeMissions.findFirst({
          where: eq(themeMissions.id, mission.parentMissionId),
        });
        throw new Error(`PREVIOUS_MISSION_REQUIRED|${parentMission?.title || "이전 미션"}|${parentMission?.missionId}`);
      }

      const validateAncestorChain = async (id: number): Promise<{ valid: boolean; blockerMission?: any }> => {
        const currentMission = await db.query.themeMissions.findFirst({
          where: eq(themeMissions.id, id),
        });
        if (!currentMission) return { valid: false };

        const progress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, id),
          ),
        });

        if (!progress || progress.status !== MISSION_STATUS.APPROVED) {
          return { valid: false, blockerMission: currentMission };
        }

        if (currentMission.parentMissionId) {
          return validateAncestorChain(currentMission.parentMissionId);
        }
        return { valid: true };
      };

      const parentMissionData = await db.query.themeMissions.findFirst({
        where: eq(themeMissions.id, mission.parentMissionId),
      });

      if (parentMissionData?.parentMissionId) {
        const ancestorResult = await validateAncestorChain(parentMissionData.parentMissionId);
        if (!ancestorResult.valid && ancestorResult.blockerMission) {
          throw new Error(`ANCESTOR_MISSION_REQUIRED|${ancestorResult.blockerMission.title}|${ancestorResult.blockerMission.missionId}`);
        }

        const parentSiblings = await db.query.themeMissions.findMany({
          where: and(
            eq(themeMissions.parentMissionId, parentMissionData.parentMissionId),
            eq(themeMissions.isActive, true),
          ),
        });

        for (const sibling of parentSiblings) {
          const siblingProgress = await db.query.userMissionProgress.findFirst({
            where: and(
              eq(userMissionProgress.userId, userId),
              eq(userMissionProgress.themeMissionId, sibling.id),
              eq(userMissionProgress.status, MISSION_STATUS.APPROVED),
            ),
          });

          if (!siblingProgress) {
            throw new Error(`SIBLING_MISSION_REQUIRED|${sibling.title}|${sibling.missionId}|${parentSiblings.length}`);
          }
        }
      }
    }

    const progress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.id),
      ),
    });

    const subMissionsWithSubmissions = await Promise.all(
      mission.subMissions.map(async (subMission) => {
        const submission = await db.query.subMissionSubmissions.findFirst({
          where: and(
            eq(subMissionSubmissions.userId, userId),
            eq(subMissionSubmissions.subMissionId, subMission.id),
          ),
          orderBy: [desc(subMissionSubmissions.submittedAt)],
        });

        if (submission) {
          const originalData = submission.submissionData as any;
          if (originalData) {
            const data = JSON.parse(JSON.stringify(originalData));
            if (data.fileUrl && data.gsPath) {
              data.fileUrl = ensurePermanentUrl(data.fileUrl, data.gsPath);
            }
            if (data.imageUrl && data.gsPath) {
              data.imageUrl = ensurePermanentUrl(data.imageUrl, data.gsPath);
            }
            if (data.slots && Array.isArray(data.slots)) {
              data.slots = data.slots.map((slot: any) => ({
                ...slot,
                fileUrl: slot.fileUrl && slot.gsPath ? ensurePermanentUrl(slot.fileUrl, slot.gsPath) : slot.fileUrl,
                imageUrl: slot.imageUrl && slot.gsPath ? ensurePermanentUrl(slot.imageUrl, slot.gsPath) : slot.imageUrl,
              }));
            }
            return {
              ...subMission,
              submission: { ...submission, submissionData: data },
            };
          }
        }

        return {
          ...subMission,
          submission: submission || null,
        };
      }),
    );

    const totalSubMissions = mission.subMissions.length;
    const completedSubMissions = subMissionsWithSubmissions.filter(
      (sm) => sm.submission?.status === MISSION_STATUS.APPROVED,
    ).length;
    const progressPercentage =
      totalSubMissions > 0
        ? Math.round((completedSubMissions / totalSubMissions) * 100)
        : 0;

    const isCurrentMissionApproved = progress?.status === MISSION_STATUS.APPROVED;

    let currentMissionDepth = 1;
    let ancestorId: number | null = mission.parentMissionId;
    while (ancestorId) {
      currentMissionDepth++;
      const ancestor = await db
        .select({ parentMissionId: themeMissions.parentMissionId })
        .from(themeMissions)
        .where(eq(themeMissions.id, ancestorId))
        .limit(1);
      ancestorId = ancestor[0]?.parentMissionId ?? null;
    }

    const childMissionDepth = currentMissionDepth + 1;

    const childMissions = await db.query.themeMissions.findMany({
      where: and(
        eq(themeMissions.parentMissionId, mission.id),
        eq(themeMissions.isActive, true),
      ),
      with: {
        category: true,
        subMissions: {
          where: eq(subMissions.isActive, true),
        },
      },
      orderBy: [asc(themeMissions.order), asc(themeMissions.id)],
    });

    const childMissionsWithStatus = await Promise.all(
      childMissions.map(async (childMission) => {
        const childProgress = await db.query.userMissionProgress.findFirst({
          where: and(
            eq(userMissionProgress.userId, userId),
            eq(userMissionProgress.themeMissionId, childMission.id),
          ),
        });

        const childSubmittedCount = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.userId, userId),
              sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${childMission.id})`,
            ),
          );

        const childTotalSubMissions = childMission.subMissions.length;
        const childCompletedSubMissions = childSubmittedCount[0]?.count || 0;
        const childProgressPercentage =
          childTotalSubMissions > 0
            ? Math.round((childCompletedSubMissions / childTotalSubMissions) * 100)
            : 0;

        let isUnlocked = isCurrentMissionApproved;

        if (isUnlocked && mission.parentMissionId) {
          const parentSiblings = await db.query.themeMissions.findMany({
            where: and(
              eq(themeMissions.parentMissionId, mission.parentMissionId),
              eq(themeMissions.isActive, true),
            ),
          });

          for (const sibling of parentSiblings) {
            const siblingProgress = await db.query.userMissionProgress.findFirst({
              where: and(
                eq(userMissionProgress.userId, userId),
                eq(userMissionProgress.themeMissionId, sibling.id),
                eq(userMissionProgress.status, MISSION_STATUS.APPROVED),
              ),
            });
            if (!siblingProgress) {
              isUnlocked = false;
              break;
            }
          }
        }

        return {
          id: childMission.id,
          missionId: childMission.missionId,
          title: childMission.title,
          order: childMission.order,
          depth: childMissionDepth,
          status: childProgress?.status || MISSION_STATUS.NOT_STARTED,
          progressPercentage: childProgressPercentage,
          completedSubMissions: childCompletedSubMissions,
          totalSubMissions: childTotalSubMissions,
          isUnlocked,
          isApproved: childProgress?.status === MISSION_STATUS.APPROVED,
        };
      }),
    );

    let parentMissionInfo = null;
    let rootMissionInfo = null;

    if (mission.parentMissionId) {
      const parentMission = await db.query.themeMissions.findFirst({
        where: eq(themeMissions.id, mission.parentMissionId),
      });
      if (parentMission) {
        parentMissionInfo = {
          id: parentMission.id,
          missionId: parentMission.missionId,
          title: parentMission.title,
        };
      }

      type AncestorRecord = {
        id: number;
        missionId: string;
        title: string;
        parentMissionId: number | null;
      };
      let currentId: number | null = mission.parentMissionId;

      for (let depth = 0; depth < 10 && currentId !== null; depth++) {
        const ancestors: AncestorRecord[] = await db
          .select({
            id: themeMissions.id,
            missionId: themeMissions.missionId,
            title: themeMissions.title,
            parentMissionId: themeMissions.parentMissionId,
          })
          .from(themeMissions)
          .where(eq(themeMissions.id, currentId))
          .limit(1);

        if (!ancestors.length) break;
        const foundAncestor = ancestors[0];
        rootMissionInfo = {
          id: foundAncestor.id,
          missionId: foundAncestor.missionId,
          title: foundAncestor.title,
        };
        currentId = foundAncestor.parentMissionId;
      }
    }

    const totalMissionCount = await countAllMissions(mission.id);

    let missionTree = null;
    if (!mission.parentMissionId) {
      missionTree = await buildMissionTree(mission.id, userId, 1);
    }

    let currentApplicants = 0;
    let waitlistCount = 0;
    const applicationSubMission = mission.subMissions.find(
      (sm) => sm.actionType?.name === "신청",
    );

    if (applicationSubMission) {
      if (mission.isFirstCome) {
        const approvedApplications = await db
          .select({ count: sql<number>`count(DISTINCT ${subMissionSubmissions.userId})::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.subMissionId, applicationSubMission.id),
              eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
            ),
          );
        currentApplicants = approvedApplications[0]?.count || 0;

        const waitlistApplications = await db
          .select({ count: sql<number>`count(DISTINCT ${subMissionSubmissions.userId})::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.subMissionId, applicationSubMission.id),
              eq(subMissionSubmissions.status, MISSION_STATUS.WAITLIST),
            ),
          );
        waitlistCount = waitlistApplications[0]?.count || 0;
      } else {
        const allApplications = await db
          .select({ count: sql<number>`count(DISTINCT ${subMissionSubmissions.userId})::int` })
          .from(subMissionSubmissions)
          .where(
            and(
              eq(subMissionSubmissions.subMissionId, applicationSubMission.id),
              or(
                eq(subMissionSubmissions.status, MISSION_STATUS.SUBMITTED),
                eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
              ),
            ),
          );
        currentApplicants = allApplications[0]?.count || 0;
      }
    }

    return {
      ...mission,
      subMissions: subMissionsWithSubmissions,
      progress: progress || null,
      progressPercentage,
      completedSubMissions,
      totalSubMissions,
      isApprovedForChildAccess: isCurrentMissionApproved,
      childMissions: childMissionsWithStatus,
      parentMission: parentMissionInfo,
      rootMission: rootMissionInfo,
      totalMissionCount,
      missionTree,
      isRootMission: !mission.parentMissionId,
      currentApplicants,
      waitlistCount,
    };
  }

  async getApplicationStatus(missionId: number) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.id, missionId),
      with: {
        subMissions: {
          with: { actionType: true },
        },
      },
    });

    if (!mission) throw new Error("NOT_FOUND");

    const applicationSubMission = mission.subMissions.find(
      (sm: any) => sm.actionType?.name === "신청",
    );

    if (!applicationSubMission) {
      return {
        capacity: mission.capacity || null,
        currentCount: 0,
        isFirstCome: mission.isFirstCome || false,
        hasApplication: false,
      };
    }

    const approvedCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subMissionSubmissions)
      .where(
        and(
          eq(subMissionSubmissions.subMissionId, applicationSubMission.id),
          eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
        ),
      );

    return {
      capacity: mission.capacity || null,
      currentCount: Number(approvedCount[0]?.count || 0),
      isFirstCome: mission.isFirstCome || false,
      hasApplication: true,
    };
  }
}
