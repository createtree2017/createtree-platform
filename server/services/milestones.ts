/**
 * Milestone service for pregnancy milestone tracking and achievements
 */
import { db } from "@db";
import {
  milestones,
  milestoneCategories,
  userMilestones,
  pregnancyProfiles,
  milestoneApplications
} from "../../shared/schema";
import { eq, and, or, gte, lte, desc, asc, isNull } from "drizzle-orm";
import { addWeeks, differenceInWeeks } from "date-fns";

/**
 * Get a user's pregnancy profile or create one if it doesn't exist
 */
export async function getOrCreatePregnancyProfile(userId: number, dueDate?: Date) {
  // Try to find existing profile
  const existingProfile = await db.query.pregnancyProfiles.findFirst({
    where: eq(pregnancyProfiles.userId, userId)
  });

  if (existingProfile) {
    return existingProfile;
  }

  // Create new profile if dueDate is provided
  if (dueDate) {
    const today = new Date();

    // Calculate current week based on due date
    // Pregnancy is typically 40 weeks, so we can determine current week
    // by calculating backwards from the due date
    const startDate = addWeeks(dueDate, -40); // 40 weeks before due date
    let currentWeek = differenceInWeeks(today, startDate);

    // Keep within valid range
    currentWeek = Math.max(1, Math.min(currentWeek, 40));

    const [newProfile] = await db.insert(pregnancyProfiles).values({
      userId,
      dueDate,
      currentWeek,
      lastUpdated: today,
      createdAt: today
    }).returning();

    return newProfile;
  }

  return null;
}

/**
 * Update a user's pregnancy profile
 */
export async function updatePregnancyProfile(
  userId: number,
  profileData: {
    dueDate?: Date;
    currentWeek?: number;
    babyNickname?: string;
    babyGender?: string;
    isFirstPregnancy?: boolean;
  }
) {
  const today = new Date();

  // Try to find existing profile
  const existingProfile = await db.query.pregnancyProfiles.findFirst({
    where: eq(pregnancyProfiles.userId, userId)
  });

  if (existingProfile) {
    // Update existing profile
    const [updatedProfile] = await db.update(pregnancyProfiles)
      .set({
        ...profileData,
        lastUpdated: today
      })
      .where(eq(pregnancyProfiles.userId, userId))
      .returning();

    return updatedProfile;
  } else if (profileData.dueDate) {
    // Create new profile
    let currentWeek = profileData.currentWeek;

    if (!currentWeek && profileData.dueDate) {
      // Calculate current week based on due date if not provided
      const startDate = addWeeks(profileData.dueDate, -40);
      currentWeek = differenceInWeeks(today, startDate);
      currentWeek = Math.max(1, Math.min(currentWeek, 40)); // Keep within valid range
    }

    const [newProfile] = await db.insert(pregnancyProfiles).values({
      userId,
      dueDate: profileData.dueDate,
      currentWeek: currentWeek || 1,
      babyNickname: profileData.babyNickname,
      babyGender: profileData.babyGender,
      isFirstPregnancy: profileData.isFirstPregnancy,
      lastUpdated: today,
      createdAt: today
    }).returning();

    return newProfile;
  }

  return null;
}

/**
 * Get available milestones based on the user's current pregnancy week
 */
export async function getAvailableMilestones(userId: number) {
  // Get user's pregnancy profile
  const profile = await db.query.pregnancyProfiles.findFirst({
    where: eq(pregnancyProfiles.userId, userId)
  });

  if (!profile) {
    return [];
  }

  // Get the milestones available for the user's current week
  const availableMilestones = await db.query.milestones.findMany({
    where: and(
      lte(milestones.weekStart, profile.currentWeek),
      gte(milestones.weekEnd, profile.currentWeek),
      eq(milestones.isActive, true)
    ),
    orderBy: [asc(milestones.order)]
  });

  // Get user's already completed milestones
  const completedMilestones = await db.query.userMilestones.findMany({
    where: eq(userMilestones.userId, userId),
    with: {
      milestone: true
    }
  });

  const completedMilestoneIds = new Set(
    completedMilestones.map(um => um.milestoneId)
  );

  // Filter out already completed milestones
  return availableMilestones.filter(
    milestone => !completedMilestoneIds.has(milestone.milestoneId)
  );
}

/**
 * Get all milestones with category relationships
 */
export async function getAllMilestones(filters?: {
  type?: string;
  hospitalId?: number;
}) {
  try {
    let whereConditions = [eq(milestones.isActive, true)];

    if (filters?.type) {
      whereConditions.push(eq(milestones.type, filters.type));
    }

    if (filters?.hospitalId) {
      // hospitalId가 0이거나 null인 마일스톤은 모든 병원에서 보이도록 처리
      whereConditions.push(
        or(
          eq(milestones.hospitalId, filters.hospitalId),
          eq(milestones.hospitalId, 0),
          isNull(milestones.hospitalId)
        )!
      );
    }

    const allMilestones = await db.query.milestones.findMany({
      where: and(...whereConditions),
      orderBy: [asc(milestones.weekStart), asc(milestones.order)],
      with: {
        category: true,
        hospital: true
      }
    });

    return allMilestones;
  } catch (error) {
    console.error('Error fetching all milestones:', error);
    return [];
  }
}

/**
 * Get a user's completed milestones
 */
export async function getUserCompletedMilestones(userId: number) {
  return db.query.userMilestones.findMany({
    where: eq(userMilestones.userId, userId),
    with: {
      milestone: true
    },
    orderBy: [desc(userMilestones.completedAt)]
  });
}

/**
 * Mark a milestone as completed for a user
 */
export async function completeMilestone(
  userId: number,
  milestoneId: string,
  notes?: string
  // photoUrl 필드는 데이터베이스에 존재하지 않아 제거
) {
  // Check if already completed
  const existing = await db.query.userMilestones.findFirst({
    where: and(
      eq(userMilestones.userId, userId),
      eq(userMilestones.milestoneId, milestoneId)
    )
  });

  if (existing) {
    // Update existing entry
    const [updated] = await db.update(userMilestones)
      .set({
        notes: notes || existing.notes
        // photoUrl 필드는 데이터베이스에 존재하지 않아 제거
      })
      .where(and(
        eq(userMilestones.userId, userId),
        eq(userMilestones.milestoneId, milestoneId)
      ))
      .returning();

    // Get milestone details
    const milestone = await db.query.milestones.findFirst({
      where: eq(milestones.milestoneId, milestoneId)
    });

    return { userMilestone: updated, milestone };
  }

  // Create new completion
  const [newCompletion] = await db.insert(userMilestones).values({
    userId,
    milestoneId,
    notes,
    // photoUrl 필드는 데이터베이스에 존재하지 않아 제거
    completedAt: new Date(),
    createdAt: new Date()
  }).returning();

  // Get milestone details
  const milestone = await db.query.milestones.findFirst({
    where: eq(milestones.milestoneId, milestoneId)
  });

  return { userMilestone: newCompletion, milestone };
}

/**
 * Get a user's achievement statistics
 */
export async function getUserAchievementStats(userId: number) {
  // Get user's completed milestones
  const completedMilestones = await getUserCompletedMilestones(userId);

  // Get total available milestones
  const totalMilestones = await db.query.milestones.findMany({
    where: eq(milestones.isActive, true)
  });

  // Get milestones by category
  const allMilestones = await getAllMilestones();
  const categories = Object.keys(allMilestones);

  // Calculate category completion rates
  const categoryCompletion: Record<string, { completed: number, total: number, percent: number }> = {};

  for (const category of categories) {
    const totalInCategory = allMilestones[category].length;
    const completedInCategory = completedMilestones.filter(
      um => um.milestone.categoryId === category
    ).length;

    categoryCompletion[category] = {
      completed: completedInCategory,
      total: totalInCategory,
      percent: totalInCategory > 0 ? (completedInCategory / totalInCategory) * 100 : 0
    };
  }

  return {
    totalCompleted: completedMilestones.length,
    totalAvailable: totalMilestones.length,
    completionRate: totalMilestones.length > 0 ?
      (completedMilestones.length / totalMilestones.length) * 100 : 0,
    categories: categoryCompletion,
    recentlyCompleted: completedMilestones.slice(0, 5) // Most recent 5
  };
}

/**
 * 관리자용 마일스톤 CRUD 함수
 */

/**
 * 마일스톤 생성 함수 (정보형/참여형 모두 지원)
 */
export async function createMilestone(milestoneData: {
  title: string;
  description: string;
  categoryId: string;
  weekStart?: number;
  weekEnd?: number;
  badgeEmoji: string;
  badgeImageUrl?: string;
  encouragementMessage: string;
  order: number;
  isActive: boolean;
  type?: 'info' | 'campaign';
  hospitalId?: number;
  headerImageUrl?: string;
  campaignStartDate?: Date;
  campaignEndDate?: Date;
  selectionStartDate?: Date;
  selectionEndDate?: Date;
  participationStartDate?: Date;
  participationEndDate?: Date;
  maxParticipants?: number;
}) {
  const milestoneId = `${milestoneData.categoryId}-${Date.now()}`;

  // 참여형 마일스톤인 경우 week_start/week_end를 기본값으로 설정
  const isInfoType = !milestoneData.type || milestoneData.type === 'info';
  const weekStart = milestoneData.weekStart ?? (isInfoType ? 1 : 0); // 정보형: 1주, 참여형: 0주
  const weekEnd = milestoneData.weekEnd ?? (isInfoType ? 40 : 40); // 정보형: 40주, 참여형: 40주

  const [newMilestone] = await db.insert(milestones).values({
    milestoneId,
    title: milestoneData.title,
    description: milestoneData.description,
    categoryId: milestoneData.categoryId,
    weekStart,
    weekEnd,
    badgeEmoji: milestoneData.badgeEmoji,
    badgeImageUrl: milestoneData.badgeImageUrl || undefined,
    encouragementMessage: milestoneData.encouragementMessage,
    order: milestoneData.order,
    isActive: milestoneData.isActive,
    // 참여형 마일스톤 필드
    type: milestoneData.type || 'info',
    hospitalId: milestoneData.hospitalId,
    headerImageUrl: milestoneData.headerImageUrl,
    campaignStartDate: milestoneData.campaignStartDate,
    campaignEndDate: milestoneData.campaignEndDate,
    selectionStartDate: milestoneData.selectionStartDate,
    selectionEndDate: milestoneData.selectionEndDate,
    participationStartDate: milestoneData.participationStartDate,
    participationEndDate: milestoneData.participationEndDate,
    maxParticipants: milestoneData.maxParticipants
  }).returning();

  return newMilestone;
}

/**
 * 마일스톤 업데이트 함수
 */
export async function updateMilestone(
  milestoneId: string,
  milestoneData: Partial<{
    title: string;
    description: string;
    category: string;
    weekStart: number;
    weekEnd: number;
    badgeEmoji: string;
    badgeImageUrl: string | null;
    encouragementMessage: string;
    order: number;
    isActive: boolean;
  }>
) {
  const [updatedMilestone] = await db.update(milestones)
    .set({
      ...milestoneData,
      updatedAt: new Date()
    })
    .where(eq(milestones.milestoneId, milestoneId))
    .returning();

  return updatedMilestone;
}

/**
 * 마일스톤 삭제 함수 (milestoneId 문자열로 삭제)
 */
export async function deleteMilestone(milestoneId: string) {
  // 먼저 해당 마일스톤과 관련된 모든 유저 마일스톤 데이터 삭제
  await db.delete(userMilestones)
    .where(eq(userMilestones.milestoneId, milestoneId));

  // 이후 마일스톤 삭제
  const [deletedMilestone] = await db.delete(milestones)
    .where(eq(milestones.milestoneId, milestoneId))
    .returning();

  return deletedMilestone;
}

/**
 * 마일스톤 삭제 함수 (숫자 ID로 삭제)
 */
export async function deleteMilestoneByNumericId(id: number) {
  // 먼저 마일스톤 정보 조회 (삭제 전 milestoneId 확인용)
  const milestone = await db.query.milestones.findFirst({
    where: eq(milestones.id, id)
  });

  if (!milestone) {
    throw new Error("마일스톤을 찾을 수 없습니다.");
  }

  // 해당 마일스톤과 관련된 모든 유저 마일스톤 데이터 삭제
  await db.delete(userMilestones)
    .where(eq(userMilestones.milestoneId, milestone.milestoneId));

  // 마일스톤 신청 데이터도 삭제
  await db.delete(milestoneApplications)
    .where(eq(milestoneApplications.milestoneId, milestone.milestoneId));

  // 이후 마일스톤 삭제
  const [deletedMilestone] = await db.delete(milestones)
    .where(eq(milestones.id, id))
    .returning();

  return deletedMilestone;
}

/**
 * 특정 마일스톤 가져오기 (milestoneId 문자열로 조회)
 */
export async function getMilestoneById(milestoneId: string) {
  return db.query.milestones.findFirst({
    where: eq(milestones.milestoneId, milestoneId)
  });
}

/**
 * 특정 마일스톤 가져오기 (숫자 ID로 조회)
 */
export async function getMilestoneByNumericId(id: number) {
  return db.query.milestones.findFirst({
    where: eq(milestones.id, id)
  });
}

/**
 * 마일스톤 카테고리 관리 함수
 */

/**
 * 모든 마일스톤 카테고리 조회
 */
export async function getAllMilestoneCategories() {
  return db.query.milestoneCategories.findMany({
    orderBy: [asc(milestoneCategories.order)]
  });
}

/**
 * 특정 마일스톤 카테고리 조회
 */
export async function getMilestoneCategoryById(categoryId: string) {
  return db.query.milestoneCategories.findFirst({
    where: eq(milestoneCategories.categoryId, categoryId)
  });
}

/**
 * 마일스톤 카테고리 생성
 */
export async function createMilestoneCategory(categoryData: {
  categoryId: string;
  name: string;
  description?: string;
  emoji?: string;
  order?: number;
  isActive?: boolean;
}) {
  const [newCategory] = await db.insert(milestoneCategories).values({
    ...categoryData,
    emoji: categoryData.emoji || "📌",
    order: categoryData.order || 0,
    isActive: categoryData.isActive ?? true,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();

  return newCategory;
}

/**
 * 마일스톤 카테고리 업데이트
 */
export async function updateMilestoneCategory(
  categoryId: string,
  categoryData: Partial<{
    name: string;
    description: string;
    emoji: string;
    order: number;
    isActive: boolean;
  }>
) {
  const [updatedCategory] = await db.update(milestoneCategories)
    .set({
      ...categoryData,
      updatedAt: new Date()
    })
    .where(eq(milestoneCategories.categoryId, categoryId))
    .returning();

  return updatedCategory;
}

/**
 * 마일스톤 카테고리 삭제
 * 주의: 카테고리를 참조하는 마일스톤이 있는 경우 삭제하지 않음
 */
export async function deleteMilestoneCategory(categoryId: string) {
  // 먼저 해당 카테고리를 참조하는 마일스톤이 있는지 확인
  const referencingMilestones = await db.query.milestones.findMany({
    where: eq(milestones.categoryId, categoryId)
  });

  if (referencingMilestones.length > 0) {
    throw new Error("카테고리를 참조하는 마일스톤이 있어 삭제할 수 없습니다.");
  }

  // 이후 카테고리 삭제
  const [deletedCategory] = await db.delete(milestoneCategories)
    .where(eq(milestoneCategories.categoryId, categoryId))
    .returning();

  return deletedCategory;
}

/**
 * ==================== 참여형 마일스톤 (캠페인) 전용 함수들 ====================
 */

/**
 * 참여형 마일스톤만 조회
 */
export async function getCampaignMilestones(filters?: {
  hospitalId?: number;
  status?: string;
}) {
  try {
    let whereConditions = [
      eq(milestones.isActive, true),
      eq(milestones.type, 'campaign')
    ];

    if (filters?.hospitalId) {
      // hospitalId가 0이거나 null인 마일스톤은 모든 병원에서 보이도록 처리
      whereConditions.push(
        or(
          eq(milestones.hospitalId, filters.hospitalId),
          eq(milestones.hospitalId, 0),
          isNull(milestones.hospitalId)
        )!
      );
    }

    // 상태별 필터링 (active, upcoming, expired)
    const now = new Date();
    if (filters?.status === 'active') {
      whereConditions.push(lte(milestones.campaignStartDate, now));
      whereConditions.push(gte(milestones.campaignEndDate, now));
    } else if (filters?.status === 'upcoming') {
      whereConditions.push(gte(milestones.campaignStartDate, now));
    } else if (filters?.status === 'expired') {
      whereConditions.push(lte(milestones.campaignEndDate, now));
    }

    const campaigns = await db.query.milestones.findMany({
      where: and(...whereConditions),
      with: {
        category: true,
        hospital: true
      },
      orderBy: [desc(milestones.createdAt)]
    });

    return campaigns;
  } catch (error) {
    console.error('Error fetching campaign milestones:', error);
    return [];
  }
}

/**
 * 참여형 마일스톤 신청
 */
export async function applyToMilestone(
  userId: number,
  milestoneId: string,
  applicationData: any
) {
  try {
    // 마일스톤 존재 및 참여형인지 확인
    const milestone = await db.query.milestones.findFirst({
      where: and(
        eq(milestones.milestoneId, milestoneId),
        eq(milestones.type, 'campaign'),
        eq(milestones.isActive, true)
      )
    });

    if (!milestone) {
      throw new Error('참여형 마일스톤을 찾을 수 없습니다.');
    }

    // 참여 기간 확인
    const now = new Date();
    if (milestone.campaignStartDate && milestone.campaignStartDate > now) {
      throw new Error('아직 참여 기간이 시작되지 않았습니다.');
    }

    if (milestone.campaignEndDate && milestone.campaignEndDate < now) {
      throw new Error('참여 기간이 종료되었습니다.');
    }

    // 중복 신청 확인
    const existingApplication = await db.query.milestoneApplications.findFirst({
      where: and(
        eq(milestoneApplications.userId, userId),
        eq(milestoneApplications.milestoneId, milestoneId)
      )
    });

    if (existingApplication) {
      throw new Error('이미 신청중인 마일스톤(또는 캠페인)입니다.');
    }

    // 신청 생성
    const [newApplication] = await db.insert(milestoneApplications).values({
      userId,
      milestoneId,
      status: 'pending',
      applicationData: JSON.stringify(applicationData),
      appliedAt: now,
      createdAt: now,
      updatedAt: now
    }).returning();

    return newApplication;

  } catch (error) {
    console.error('Error applying to milestone:', error);
    throw error;
  }
}

/**
 * 사용자의 신청 내역 조회
 */
export async function getUserApplications(
  userId: number,
  filters?: {
    status?: string;
    milestoneId?: string;
  }
) {
  try {
    let whereConditions = [eq(milestoneApplications.userId, userId)];

    if (filters?.status) {
      whereConditions.push(eq(milestoneApplications.status, filters.status));
    }

    if (filters?.milestoneId) {
      whereConditions.push(eq(milestoneApplications.milestoneId, filters.milestoneId));
    }

    const applications = await db.query.milestoneApplications.findMany({
      where: and(...whereConditions),
      with: {
        milestone: {
          with: {
            category: true,
            hospital: true
          }
        }
      },
      orderBy: [desc(milestoneApplications.appliedAt)]
    });

    return applications;

  } catch (error) {
    console.error('Error fetching user applications:', error);
    return [];
  }
}

/**
 * 특정 신청 상세 정보 조회
 */
export async function getApplicationDetails(applicationId: number, userId: number) {
  try {
    const application = await db.query.milestoneApplications.findFirst({
      where: and(
        eq(milestoneApplications.id, applicationId),
        eq(milestoneApplications.userId, userId)
      ),
      with: {
        milestone: {
          with: {
            category: true,
            hospital: true
          }
        }
      }
    });

    if (!application) {
      throw new Error('신청 내역을 찾을 수 없습니다.');
    }

    return application;

  } catch (error) {
    console.error('Error fetching application details:', error);
    throw error;
  }
}

/**
 * 내 신청 내역 조회
 */
export async function getMyApplications(userId: number, filters?: {
  status?: string;
  milestoneId?: number;
}) {
  try {
    let whereConditions = [eq(milestoneApplications.userId, userId)];

    if (filters?.status) {
      whereConditions.push(eq(milestoneApplications.status, filters.status));
    }

    if (filters?.milestoneId) {
      whereConditions.push(eq(milestoneApplications.milestoneId, filters.milestoneId));
    }

    const applications = await db.query.milestoneApplications.findMany({
      where: and(...whereConditions),
      with: {
        milestone: {
          with: {
            category: true,
            hospital: true
          }
        }
      },
      orderBy: [desc(milestoneApplications.createdAt)]
    });

    return applications;

  } catch (error) {
    console.error('Error fetching my applications:', error);
    throw error;
  }
}

/**
 * 신청 취소
 */
export async function cancelApplication(applicationId: number, userId: number) {
  try {
    // 신청 존재 및 권한 확인
    const application = await db.query.milestoneApplications.findFirst({
      where: and(
        eq(milestoneApplications.id, applicationId),
        eq(milestoneApplications.userId, userId)
      )
    });

    if (!application) {
      throw new Error('신청 내역을 찾을 수 없습니다.');
    }

    if (application.status !== 'pending') {
      throw new Error('대기 중인 신청만 취소할 수 있습니다.');
    }

    // 신청 상태를 cancelled로 변경
    const [updatedApplication] = await db.update(milestoneApplications)
      .set({
        status: 'cancelled',
        updatedAt: new Date()
      })
      .where(eq(milestoneApplications.id, applicationId))
      .returning();

    return updatedApplication;

  } catch (error) {
    console.error('Error cancelling application:', error);
    throw error;
  }
}

/**
 * 마일스톤 신청 생성
 */
export async function createMilestoneApplication(data: {
  userId: string;
  milestoneId: number;
  applicationData?: string;
}) {
  try {
    const [newApplication] = await db
      .insert(milestoneApplications)
      .values({
        userId: data.userId,
        milestoneId: data.milestoneId.toString(),
        applicationData: data.applicationData || null,
        status: 'pending',
        submittedAt: new Date(),
      })
      .returning();

    // Phase 5: 마일스톤 신청 시 자동 알림 생성
    try {
      // 마일스톤 정보 조회 (알림 메시지용)
      const milestone = await db.query.milestones.findFirst({
        where: eq(milestones.id, data.milestoneId),
        with: {
          hospital: true
        }
      });

      if (milestone) {
        // 알림 생성 함수 동적 import
        const { createApplicationNotification } = await import('./notifications.js');

        // 신청 완료 알림 생성
        await createApplicationNotification(
          data.userId,
          milestone.title,
          milestone.hospital?.name || '우리병원'
        );

        console.log(`✅ 마일스톤 신청 알림 생성 완료: 사용자 ${data.userId}, 마일스톤 "${milestone.title}"`);
      }
    } catch (notificationError) {
      // 알림 생성 실패해도 신청은 성공으로 처리
      console.error('알림 생성 중 오류 발생 (신청은 정상 처리됨):', notificationError);
    }

    return newApplication;
  } catch (error) {
    console.error('Error creating milestone application:', error);
    throw error;
  }
}

/**
 * 신청 상세 정보 조회 (ID로)
 */
export async function getApplicationById(
  applicationId: number,
  userId: string | number
): Promise<MilestoneApplication | null> {
  try {
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    const application = await db.query.milestoneApplications.findFirst({
      where: (applications, { eq, and }) =>
        and(
          eq(applications.id, applicationId),
          eq(applications.userId, numericUserId)
        ),
      with: {
        milestone: {
          with: {
            category: true,
            hospital: true
          }
        }
      }
    });

    return application || null;
  } catch (error) {
    console.error('Error getting application by ID:', error);
    throw error;
  }
}

/**
 * 문자열 ID로 마일스톤 조회
 */
export async function getMilestoneByStringId(milestoneId: string) {
  try {
    const milestone = await db.query.milestones.findFirst({
      where: eq(milestones.milestoneId, milestoneId),
      with: {
        category: true,
        hospital: true
      }
    });
    return milestone;
  } catch (error) {
    console.error('Error getting milestone by string ID:', error);
    throw error;
  }
}

/**
 * 문자열 ID로 마일스톤 삭제 (연관 데이터와 함께)
 */
export async function deleteMilestoneByStringId(milestoneId: string) {
  try {
    // 1. 먼저 마일스톤 정보 가져오기
    const milestone = await getMilestoneByStringId(milestoneId);
    if (!milestone) {
      throw new Error('Milestone not found');
    }

    console.log('🗑️ [문자열 ID 삭제] 마일스톤 정보:', {
      id: milestone.id,
      milestoneId: milestone.milestoneId,
      title: milestone.title
    });

    // 2. 관련 신청 데이터 삭제
    const deletedApplications = await db.delete(milestoneApplications)
      .where(eq(milestoneApplications.milestoneId, milestone.milestoneId))
      .returning();

    console.log('🗑️ [문자열 ID 삭제] 신청 데이터 삭제됨:', deletedApplications.length, '개');

    // 3. 관련 사용자 마일스톤 데이터 삭제
    const deletedUserMilestones = await db.delete(userMilestones)
      .where(eq(userMilestones.milestoneId, milestone.milestoneId))
      .returning();

    console.log('🗑️ [문자열 ID 삭제] 사용자 마일스톤 삭제됨:', deletedUserMilestones.length, '개');

    // 4. 마일스톤 자체 삭제
    const deletedMilestone = await db.delete(milestones)
      .where(eq(milestones.milestoneId, milestoneId))
      .returning();

    console.log('🗑️ [문자열 ID 삭제] 마일스톤 삭제 완료:', deletedMilestone[0]?.milestoneId);

    return deletedMilestone[0];
  } catch (error) {
    console.error('Error deleting milestone by string ID:', error);
    throw error;
  }
}