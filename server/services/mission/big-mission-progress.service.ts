import { db } from "@db";
import {
  bigMissions,
  bigMissionTopics,
  subMissions,
  subMissionSubmissions,
  themeMissions,
  userMissionProgress,
  userBigMissionProgress,
  MISSION_STATUS,
} from "@shared/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

export const BIG_MISSION_PROGRESS_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

export type BigMissionProgressStatus =
  (typeof BIG_MISSION_PROGRESS_STATUS)[keyof typeof BIG_MISSION_PROGRESS_STATUS];

export type CompletedCategoryInfo = {
  categoryId: string;
  themeMissionId: number;
  missionTitle: string;
  completedMissionTitle: string;
  activeSubMissionCount: number;
  approvedSubMissionCount: number;
  completedAt: Date | null;
};

type BigMissionTopicLike = typeof bigMissionTopics.$inferSelect;
type BigMissionLike = typeof bigMissions.$inferSelect & {
  topics?: BigMissionTopicLike[];
};

export type EvaluatedBigMissionTopic<TTopic extends BigMissionTopicLike = BigMissionTopicLike> =
  TTopic & {
    isCompleted: boolean;
    completedMissionTitle?: string;
    completedThemeMissionId?: number;
    completedAt?: Date | null;
  };

export type BigMissionProgressCalculation<TTopic extends BigMissionTopicLike = BigMissionTopicLike> = {
  topics: EvaluatedBigMissionTopic<TTopic>[];
  totalTopics: number;
  completedTopics: number;
  progressPercent: number;
  status: BigMissionProgressStatus;
  completedAt: Date | null;
};

type ProgramCompletionBucket = {
  categoryId: string;
  themeMissionId: number;
  missionTitle: string;
  activeSubMissionIds: Set<number>;
  approvedSubMissionIds: Set<number>;
  completedAt: Date | null;
};

function normalizeDate(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function pickLatestDate(current: Date | null, next: Date | null) {
  if (!next) return current;
  if (!current || next.getTime() > current.getTime()) return next;
  return current;
}

function shouldReplaceCompletedCategory(current: CompletedCategoryInfo | undefined, next: CompletedCategoryInfo) {
  if (!current) return true;

  const currentTime = current.completedAt?.getTime() ?? 0;
  const nextTime = next.completedAt?.getTime() ?? 0;

  if (nextTime !== currentTime) {
    return nextTime > currentTime;
  }

  return next.themeMissionId > current.themeMissionId;
}

export class BigMissionProgressService {
  async getCompletedCategoryMapForUser(userId: number): Promise<Map<string, CompletedCategoryInfo>> {
    const rows = await db
      .select({
        categoryId: themeMissions.categoryId,
        themeMissionId: themeMissions.id,
        missionTitle: themeMissions.title,
        subMissionId: subMissions.id,
        approvedSubmissionId: subMissionSubmissions.id,
        approvedAt: sql<Date | null>`COALESCE(${subMissionSubmissions.reviewedAt}, ${subMissionSubmissions.updatedAt}, ${subMissionSubmissions.submittedAt})`,
      })
      .from(subMissions)
      .innerJoin(themeMissions, eq(subMissions.themeMissionId, themeMissions.id))
      .leftJoin(
        subMissionSubmissions,
        and(
          eq(subMissionSubmissions.subMissionId, subMissions.id),
          eq(subMissionSubmissions.userId, userId),
          eq(subMissionSubmissions.status, MISSION_STATUS.APPROVED),
        ),
      )
      .where(
        and(
          eq(subMissions.isActive, true),
          sql`${themeMissions.categoryId} IS NOT NULL`,
        ),
      );

    const programBuckets = new Map<number, ProgramCompletionBucket>();

    for (const row of rows) {
      if (!row.categoryId) continue;

      const bucket = programBuckets.get(row.themeMissionId) ?? {
        categoryId: row.categoryId,
        themeMissionId: row.themeMissionId,
        missionTitle: row.missionTitle,
        activeSubMissionIds: new Set<number>(),
        approvedSubMissionIds: new Set<number>(),
        completedAt: null,
      };

      bucket.activeSubMissionIds.add(row.subMissionId);

      if (row.approvedSubmissionId) {
        bucket.approvedSubMissionIds.add(row.subMissionId);
        bucket.completedAt = pickLatestDate(bucket.completedAt, normalizeDate(row.approvedAt));
      }

      programBuckets.set(row.themeMissionId, bucket);
    }

    const completedCategoryMap = new Map<string, CompletedCategoryInfo>();

    for (const bucket of programBuckets.values()) {
      const activeSubMissionCount = bucket.activeSubMissionIds.size;
      const approvedSubMissionCount = bucket.approvedSubMissionIds.size;

      if (activeSubMissionCount === 0 || activeSubMissionCount !== approvedSubMissionCount) {
        continue;
      }

      const info: CompletedCategoryInfo = {
        categoryId: bucket.categoryId,
        themeMissionId: bucket.themeMissionId,
        missionTitle: bucket.missionTitle,
        completedMissionTitle: bucket.missionTitle,
        activeSubMissionCount,
        approvedSubMissionCount,
        completedAt: bucket.completedAt,
      };

      if (shouldReplaceCompletedCategory(completedCategoryMap.get(bucket.categoryId), info)) {
        completedCategoryMap.set(bucket.categoryId, info);
      }
    }

    return completedCategoryMap;
  }

  calculateMissionProgressFromMap<TMission extends BigMissionLike>(
    mission: TMission,
    completedCategoryMap: Map<string, CompletedCategoryInfo>,
  ): BigMissionProgressCalculation {
    const activeTopics = (mission.topics ?? [])
      .filter((topic) => topic.isActive !== false)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    let completedTopics = 0;
    let completedAt: Date | null = null;

    const topics = activeTopics.map((topic) => {
      const completedCategory = completedCategoryMap.get(topic.categoryId);
      const isCompleted = !!completedCategory;

      if (isCompleted) {
        completedTopics += 1;
        completedAt = pickLatestDate(completedAt, completedCategory.completedAt);
      }

      return {
        ...topic,
        isCompleted,
        completedMissionTitle: completedCategory?.completedMissionTitle,
        completedThemeMissionId: completedCategory?.themeMissionId,
        completedAt: completedCategory?.completedAt ?? null,
      };
    });

    const totalTopics = activeTopics.length;
    const progressPercent = totalTopics > 0 ? Math.round((completedTopics / totalTopics) * 100) : 0;
    const status = totalTopics > 0 && completedTopics === totalTopics
      ? BIG_MISSION_PROGRESS_STATUS.COMPLETED
      : completedTopics > 0
        ? BIG_MISSION_PROGRESS_STATUS.IN_PROGRESS
        : BIG_MISSION_PROGRESS_STATUS.NOT_STARTED;

    return {
      topics,
      totalTopics,
      completedTopics,
      progressPercent,
      status,
      completedAt: status === BIG_MISSION_PROGRESS_STATUS.COMPLETED ? completedAt : null,
    };
  }

  async calculateMissionProgress<TMission extends BigMissionLike>(
    userId: number,
    mission: TMission,
  ): Promise<BigMissionProgressCalculation> {
    const completedCategoryMap = await this.getCompletedCategoryMapForUser(userId);
    return this.calculateMissionProgressFromMap(mission, completedCategoryMap);
  }

  async calculateMissionsProgress<TMission extends BigMissionLike>(
    userId: number,
    missions: TMission[],
  ): Promise<Map<number, BigMissionProgressCalculation>> {
    const completedCategoryMap = await this.getCompletedCategoryMapForUser(userId);
    const progressMap = new Map<number, BigMissionProgressCalculation>();

    for (const mission of missions) {
      progressMap.set(mission.id, this.calculateMissionProgressFromMap(mission, completedCategoryMap));
    }

    return progressMap;
  }

  async recalculateUserBigMissionProgress(userId: number) {
    const activeBigMissions = await db.query.bigMissions.findMany({
      where: eq(bigMissions.isActive, true),
      with: {
        topics: {
          where: eq(bigMissionTopics.isActive, true),
          orderBy: [asc(bigMissionTopics.order)],
        },
      },
    });

    const completedCategoryMap = await this.getCompletedCategoryMapForUser(userId);

    for (const mission of activeBigMissions) {
      const calculation = this.calculateMissionProgressFromMap(mission, completedCategoryMap);
      const existingProgress = await db.query.userBigMissionProgress.findFirst({
        where: and(
          eq(userBigMissionProgress.userId, userId),
          eq(userBigMissionProgress.bigMissionId, mission.id),
        ),
      });

      const completedAt = calculation.status === BIG_MISSION_PROGRESS_STATUS.COMPLETED
        ? existingProgress?.completedAt ?? calculation.completedAt ?? new Date()
        : null;

      if (existingProgress) {
        await db
          .update(userBigMissionProgress)
          .set({
            completedTopics: calculation.completedTopics,
            totalTopics: calculation.totalTopics,
            status: calculation.status,
            completedAt,
            updatedAt: new Date(),
          })
          .where(eq(userBigMissionProgress.id, existingProgress.id));
      } else if (calculation.completedTopics > 0) {
        await db.insert(userBigMissionProgress).values({
          userId,
          bigMissionId: mission.id,
          completedTopics: calculation.completedTopics,
          totalTopics: calculation.totalTopics,
          status: calculation.status,
          completedAt,
        });
      }
    }
  }

  async getRelatedUserIdsForThemeMission(themeMissionId: number): Promise<number[]> {
    const subMissionRows = await db
      .select({ id: subMissions.id })
      .from(subMissions)
      .where(eq(subMissions.themeMissionId, themeMissionId));

    const subMissionIds = subMissionRows.map((row) => row.id);

    const submissionUsers = subMissionIds.length > 0
      ? await db
          .select({ userId: subMissionSubmissions.userId })
          .from(subMissionSubmissions)
          .where(inArray(subMissionSubmissions.subMissionId, subMissionIds))
          .groupBy(subMissionSubmissions.userId)
      : [];

    const progressUsers = await db
      .select({ userId: userMissionProgress.userId })
      .from(userMissionProgress)
      .where(eq(userMissionProgress.themeMissionId, themeMissionId))
      .groupBy(userMissionProgress.userId);

    return [...new Set([
      ...submissionUsers.map((row) => row.userId),
      ...progressUsers.map((row) => row.userId),
    ])].sort((a, b) => a - b);
  }

  async recalculateUsersForThemeMission(themeMissionId: number) {
    const userIds = await this.getRelatedUserIdsForThemeMission(themeMissionId);

    for (const userId of userIds) {
      await this.recalculateUserBigMissionProgress(userId);
    }

    return { themeMissionId, userIds, recalculatedCount: userIds.length };
  }
}

export const bigMissionProgressService = new BigMissionProgressService();
