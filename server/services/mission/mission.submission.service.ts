import { db } from "@db";
import { themeMissions, subMissions, subMissionSubmissions, userMissionProgress, MISSION_STATUS } from "@shared/schema";
import { eq, and, not, sql, asc } from "drizzle-orm";

export class UserSubmissionService {
  async startMission(missionId: string, userId: number) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
    });

    if (!mission) {
      throw new Error("NOT_FOUND");
    }

    const existingProgress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.id),
      ),
    });

    if (existingProgress) {
      throw new Error("ALREADY_STARTED");
    }

    const [newProgress] = await db
      .insert(userMissionProgress)
      .values({
        userId,
        themeMissionId: mission.id,
        status: MISSION_STATUS.IN_PROGRESS,
      })
      .returning();

    return newProgress;
  }

  async submitSubMission(missionId: string, subMissionId: number, userId: number, submissionData: any) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
    });

    if (!mission) throw new Error("MISSION_NOT_FOUND");

    if (mission.startDate && mission.endDate) {
      const now = new Date();
      const startDate = new Date(mission.startDate);
      const endDate = new Date(mission.endDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      if (now < startDate) throw new Error("NOT_STARTED_YET");
      if (now > endDate) throw new Error("ALREADY_ENDED");
    }

    const subMission = await db.query.subMissions.findFirst({
      where: and(
        eq(subMissions.id, subMissionId),
        eq(subMissions.themeMissionId, mission.id),
      ),
      with: { actionType: true },
    });

    if (!subMission) throw new Error("SUB_MISSION_NOT_FOUND");

    let progress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.id),
      ),
    });

    if (!progress) {
      [progress] = await db
        .insert(userMissionProgress)
        .values({
          userId,
          themeMissionId: mission.id,
          status: MISSION_STATUS.IN_PROGRESS,
        })
        .returning();
    }

    const existingSubmission = await db.query.subMissionSubmissions.findFirst({
      where: and(
        eq(subMissionSubmissions.userId, userId),
        eq(subMissionSubmissions.subMissionId, subMission.id),
        not(eq(subMissionSubmissions.status, MISSION_STATUS.CANCELLED)),
      ),
    });

    if (existingSubmission?.isLocked) {
      throw new Error("ALREADY_APPROVED");
    }

    const isApplicationType = subMission.actionType?.name === "신청";
    let submissionStatus = MISSION_STATUS.SUBMITTED;
    let shouldLock = false;

    if (isApplicationType && mission.capacity) {
      if (mission.isFirstCome) {
        submissionStatus = MISSION_STATUS.SUBMITTED;
        shouldLock = false;
      } else {
        submissionStatus = MISSION_STATUS.SUBMITTED;
        shouldLock = false;
      }
    } else {
      const autoApprove = subMission.requireReview === false;
      submissionStatus = autoApprove ? MISSION_STATUS.APPROVED : MISSION_STATUS.SUBMITTED;
      shouldLock = autoApprove;
    }

    let resultSubmission;

    if (existingSubmission) {
      const [updatedSubmission] = await db
        .update(subMissionSubmissions)
        .set({
          submissionData,
          status: submissionStatus,
          isLocked: shouldLock,
          submittedAt: new Date(),
          reviewedAt: shouldLock ? new Date() : undefined,
          updatedAt: new Date(),
        })
        .where(eq(subMissionSubmissions.id, existingSubmission.id))
        .returning();
      resultSubmission = updatedSubmission;
    } else {
      const [newSubmission] = await db
        .insert(subMissionSubmissions)
        .values({
          userId,
          subMissionId: subMission.id,
          submissionData,
          status: submissionStatus,
          isLocked: shouldLock,
          submittedAt: new Date(),
          reviewedAt: shouldLock ? new Date() : undefined,
        })
        .returning();
      resultSubmission = newSubmission;
    }

    if (isApplicationType && mission.capacity && mission.isFirstCome) {
      const lockKey = subMission.id;

      const updateResult = await db.execute(sql`
        WITH lock_acquired AS (
          SELECT pg_advisory_xact_lock(${lockKey})
        ),
        current_count AS (
          SELECT COUNT(DISTINCT user_id) as cnt
          FROM ${subMissionSubmissions}
          WHERE sub_mission_id = ${subMission.id}
          AND status = ${MISSION_STATUS.APPROVED}
        )
        UPDATE ${subMissionSubmissions}
        SET 
          status = CASE 
            WHEN (SELECT cnt FROM current_count) < ${mission.capacity}
            THEN ${MISSION_STATUS.APPROVED}
            ELSE ${MISSION_STATUS.WAITLIST}
          END,
          is_locked = CASE 
            WHEN (SELECT cnt FROM current_count) < ${mission.capacity}
            THEN true
            ELSE false
          END,
          reviewed_at = CASE 
            WHEN (SELECT cnt FROM current_count) < ${mission.capacity}
            THEN NOW()
            ELSE reviewed_at
          END,
          updated_at = NOW()
        WHERE id = ${resultSubmission.id}
        RETURNING *
      `);

      return { submission: updateResult.rows[0], isUpdate: !!existingSubmission };
    }

    return { submission: resultSubmission, isUpdate: !!existingSubmission };
  }

  async cancelSubmission(missionId: string, subMissionId: number, userId: number) {
    const submission = await db.query.subMissionSubmissions.findFirst({
      where: and(
        eq(subMissionSubmissions.userId, userId),
        eq(subMissionSubmissions.subMissionId, subMissionId),
      ),
    });

    if (!submission) throw new Error("NOT_FOUND");
    if (submission.isLocked) throw new Error("ALREADY_APPROVED");

    const [deletedSubmission] = await db
      .delete(subMissionSubmissions)
      .where(eq(subMissionSubmissions.id, submission.id))
      .returning();

    return deletedSubmission;
  }

  async cancelApplication(missionId: string, subMissionId: number, userId: number) {
    const subMission = await db.query.subMissions.findFirst({
      where: eq(subMissions.id, subMissionId),
      with: {
        actionType: true,
        themeMission: true,
      },
    });

    if (!subMission) throw new Error("SUB_MISSION_NOT_FOUND");
    if (subMission.actionType?.name !== "신청") throw new Error("NOT_APPLICATION_TYPE");

    const submission = await db.query.subMissionSubmissions.findFirst({
      where: and(
        eq(subMissionSubmissions.userId, userId),
        eq(subMissionSubmissions.subMissionId, subMissionId),
        not(eq(subMissionSubmissions.status, MISSION_STATUS.CANCELLED)),
      ),
    });

    if (!submission) throw new Error("NOT_FOUND");

    const previousStatus = submission.status;

    const [cancelledSubmission] = await db
      .update(subMissionSubmissions)
      .set({
        status: MISSION_STATUS.CANCELLED,
        isLocked: false,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subMissionSubmissions.id, submission.id))
      .returning();

    if (subMission.themeMission?.isFirstCome && previousStatus === MISSION_STATUS.APPROVED) {
      const waitlistSubmission = await db.query.subMissionSubmissions.findFirst({
        where: and(
          eq(subMissionSubmissions.subMissionId, subMissionId),
          eq(subMissionSubmissions.status, MISSION_STATUS.WAITLIST),
        ),
        orderBy: asc(subMissionSubmissions.submittedAt),
      });

      if (waitlistSubmission) {
        await db
          .update(subMissionSubmissions)
          .set({
            status: MISSION_STATUS.APPROVED,
            isLocked: true,
            reviewedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(subMissionSubmissions.id, waitlistSubmission.id));
      }
    }

    return cancelledSubmission;
  }

  async completeMission(missionId: string, userId: number) {
    const mission = await db.query.themeMissions.findFirst({
      where: eq(themeMissions.missionId, missionId),
      with: {
        subMissions: {
          where: eq(subMissions.isActive, true),
        },
      },
    });

    if (!mission) throw new Error("NOT_FOUND");

    const progress = await db.query.userMissionProgress.findFirst({
      where: and(
        eq(userMissionProgress.userId, userId),
        eq(userMissionProgress.themeMissionId, mission.id),
      ),
    });

    if (!progress) throw new Error("NO_PROGRESS");

    const totalSubMissions = mission.subMissions.length;
    const approvedSubmissions = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(subMissionSubmissions)
      .where(
        and(
          eq(subMissionSubmissions.userId, userId),
          eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
          sql`${subMissionSubmissions.subMissionId} IN (SELECT id FROM ${subMissions} WHERE ${subMissions.themeMissionId} = ${mission.id})`,
        ),
      );

    const approvedCount = approvedSubmissions[0]?.count || 0;

    if (approvedCount < totalSubMissions) {
      throw new Error(`INCOMPLETE|${approvedCount}|${totalSubMissions}`);
    }

    const [completedProgress] = await db
      .update(userMissionProgress)
      .set({
        status: MISSION_STATUS.APPROVED,
        updatedAt: new Date(),
      })
      .where(eq(userMissionProgress.id, progress.id))
      .returning();

    return completedProgress;
  }

  async verifyAttendance(subMissionId: number, password: string, userId: number) {
    const subMission = await db.query.subMissions.findFirst({
      where: eq(subMissions.id, subMissionId),
      with: { actionType: true },
    });

    if (!subMission) throw new Error("NOT_FOUND");
    if (!(subMission.submissionTypes || []).includes("attendance")) throw new Error("INVALID_TYPE");
    if (subMission.attendancePassword !== password) throw new Error("INVALID_PASSWORD");

    const existing = await db.query.subMissionSubmissions.findFirst({
      where: and(
        eq(subMissionSubmissions.userId, userId),
        eq(subMissionSubmissions.subMissionId, subMissionId),
      ),
    });

    if (existing) {
      await db
        .update(subMissionSubmissions)
        .set({
          status: MISSION_STATUS.APPROVED,
          isLocked: true,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subMissionSubmissions.id, existing.id));
    } else {
      await db.insert(subMissionSubmissions).values({
        userId,
        subMissionId,
        status: MISSION_STATUS.APPROVED,
        isLocked: true,
        reviewedAt: new Date(),
      });
    }
  }
}
