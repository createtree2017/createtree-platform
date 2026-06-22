import { db, pool } from "@db";
import {
  bigMissions,
  bigMissionTopics,
  MISSION_STATUS,
  subMissions,
  subMissionSubmissions,
  themeMissions,
  userBigMissionProgress,
  userMissionProgress,
} from "@shared/schema";
import { bigMissionProgressService } from "../server/services/mission/big-mission-progress.service";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

function getArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function toNumber(value: string | undefined, name: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name}에는 양의 정수를 입력해야 합니다.`);
  }
  return parsed;
}

function serializeDate(value: Date | string | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function main() {
  const themeMissionId = toNumber(getArg("themeMissionId"), "themeMissionId");
  const userId = toNumber(getArg("userId"), "userId");

  const mission = await db.query.themeMissions.findFirst({
    where: eq(themeMissions.id, themeMissionId),
    with: {
      category: true,
      subMissions: {
        orderBy: [asc(subMissions.order), asc(subMissions.id)],
        with: { actionType: true },
      },
    },
  });

  if (!mission) {
    throw new Error(`themeMissionId=${themeMissionId} 문화센터 프로그램을 찾을 수 없습니다.`);
  }

  const submissionRows = await db.query.subMissionSubmissions.findMany({
    where: eq(subMissionSubmissions.userId, userId),
    with: { subMission: true },
    orderBy: [desc(subMissionSubmissions.submittedAt)],
  });

  const missionSubMissionIds = new Set(mission.subMissions.map((subMission) => subMission.id));
  const subMissionById = new Map(mission.subMissions.map((subMission) => [subMission.id, subMission]));
  const missionSubmissions = submissionRows.filter((submission) =>
    missionSubMissionIds.has(submission.subMissionId),
  );

  const activeSubMissionIds = new Set(
    mission.subMissions
      .filter((subMission) => subMission.isActive)
      .map((subMission) => subMission.id),
  );
  const approvedActiveSubMissionIds = new Set(
    missionSubmissions
      .filter((submission) =>
        activeSubMissionIds.has(submission.subMissionId) &&
        submission.status === MISSION_STATUS.APPROVED,
      )
      .map((submission) => submission.subMissionId),
  );

  const latestSubmissionBySubMission = new Map<number, typeof missionSubmissions[number]>();
  for (const submission of missionSubmissions) {
    if (!latestSubmissionBySubMission.has(submission.subMissionId)) {
      latestSubmissionBySubMission.set(submission.subMissionId, submission);
    }
  }

  const summarizeSubMission = (subMission: typeof mission.subMissions[number]) => {
    const latestSubmission = latestSubmissionBySubMission.get(subMission.id);
    return {
      id: subMission.id,
      title: subMission.title,
      actionType: subMission.actionType?.name ?? null,
      isActive: subMission.isActive,
      latestSubmissionStatus: latestSubmission?.status ?? null,
      hasApprovedSubmission: missionSubmissions.some((submission) =>
        submission.subMissionId === subMission.id &&
        submission.status === MISSION_STATUS.APPROVED,
      ),
    };
  };

  const activeSubMissionCount = activeSubMissionIds.size;
  const approvedActiveSubMissionCount = approvedActiveSubMissionIds.size;
  const cultureCenterCompleted =
    activeSubMissionCount > 0 &&
    activeSubMissionCount === approvedActiveSubMissionCount;

  const userProgress = await db.query.userMissionProgress.findFirst({
    where: and(
      eq(userMissionProgress.userId, userId),
      eq(userMissionProgress.themeMissionId, themeMissionId),
    ),
  });

  const completedCategoryMap = await bigMissionProgressService.getCompletedCategoryMapForUser(userId);
  const completedCategory = mission.categoryId
    ? completedCategoryMap.get(mission.categoryId)
    : undefined;

  const relatedBigMissionRows = mission.categoryId
    ? await db
        .select({
          bigMissionId: bigMissions.id,
          bigMissionTitle: bigMissions.title,
          topicId: bigMissionTopics.id,
          topicTitle: bigMissionTopics.title,
          topicIsActive: bigMissionTopics.isActive,
        })
        .from(bigMissionTopics)
        .innerJoin(bigMissions, eq(bigMissionTopics.bigMissionId, bigMissions.id))
        .where(
          and(
            eq(bigMissionTopics.categoryId, mission.categoryId),
            eq(bigMissions.isActive, true),
          ),
        )
        .orderBy(asc(bigMissions.id), asc(bigMissionTopics.order))
    : [];

  const relatedBigMissionIds = [...new Set(relatedBigMissionRows.map((row) => row.bigMissionId))];
  const storedBigMissionProgressRows = relatedBigMissionIds.length > 0
    ? await db.query.userBigMissionProgress.findMany({
        where: and(
          eq(userBigMissionProgress.userId, userId),
          inArray(userBigMissionProgress.bigMissionId, relatedBigMissionIds),
        ),
      })
    : [];
  const storedBigMissionProgressById = new Map(
    storedBigMissionProgressRows.map((progress) => [progress.bigMissionId, progress]),
  );

  console.log(JSON.stringify({
    input: {
      themeMissionId,
      userId,
    },
    themeMission: {
      id: mission.id,
      missionId: mission.missionId,
      title: mission.title,
      categoryId: mission.categoryId,
      categoryName: mission.category?.name ?? null,
      isActive: mission.isActive,
    },
    activeSubMissions: mission.subMissions
      .filter((subMission) => subMission.isActive)
      .map(summarizeSubMission),
    inactiveSubMissions: mission.subMissions
      .filter((subMission) => !subMission.isActive)
      .map(summarizeSubMission),
    approvedSubmissions: missionSubmissions
      .filter((submission) => submission.status === MISSION_STATUS.APPROVED)
      .map((submission) => ({
        id: submission.id,
        subMissionId: submission.subMissionId,
        subMissionTitle: subMissionById.get(submission.subMissionId)?.title ?? null,
        status: submission.status,
        submittedAt: serializeDate(submission.submittedAt),
        reviewedAt: serializeDate(submission.reviewedAt),
      })),
    cultureCenterCompletionByActiveSubMissions: {
      activeSubMissionCount,
      approvedActiveSubMissionCount,
      isCompleted: cultureCenterCompleted,
    },
    storedUserMissionProgress: userProgress
      ? {
          id: userProgress.id,
          status: userProgress.status,
          completedSubMissions: userProgress.completedSubMissions,
          totalSubMissions: userProgress.totalSubMissions,
          progressPercent: userProgress.progressPercent,
        }
      : null,
    bigMissionCategoryCompletion: {
      categoryId: mission.categoryId,
      isCompletedCategory: !!completedCategory,
      completedThemeMissionId: completedCategory?.themeMissionId ?? null,
      completedMissionTitle: completedCategory?.completedMissionTitle ?? null,
      activeSubMissionCount: completedCategory?.activeSubMissionCount ?? 0,
      approvedSubMissionCount: completedCategory?.approvedSubMissionCount ?? 0,
    },
    relatedActiveBigMissionTopics: relatedBigMissionRows.map((row) => ({
      ...row,
      isCompletedByThisUser: !!completedCategory && row.topicIsActive !== false,
      storedBigMissionProgress: storedBigMissionProgressById.has(row.bigMissionId)
        ? {
            id: storedBigMissionProgressById.get(row.bigMissionId)!.id,
            status: storedBigMissionProgressById.get(row.bigMissionId)!.status,
            completedTopics: storedBigMissionProgressById.get(row.bigMissionId)!.completedTopics,
            totalTopics: storedBigMissionProgressById.get(row.bigMissionId)!.totalTopics,
            rewardStatus: storedBigMissionProgressById.get(row.bigMissionId)!.rewardStatus,
          }
        : null,
    })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error("big mission active submission diagnose failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
