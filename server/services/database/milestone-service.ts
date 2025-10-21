import { db } from '@db';
import { milestones, milestoneApplications } from '@shared/schema';
import { eq, and, desc, gte, lte, isNull, or } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { createError } from '../../utils/error-handler';

/**
 * 마일스톤 DB 서비스
 * - services/milestones.ts의 DB 쿼리를 여기서 관리
 * - 비즈니스 로직은 services/milestones.ts에 유지
 */
export class MilestoneService {
  /**
   * 모든 마일스톤 조회 (필터링 포함)
   */
  static async findAll(filters?: {
    type?: string;
    hospitalId?: number | null;
    isActive?: boolean;
  }) {
    const conditions = [];
    
    if (filters?.type) {
      conditions.push(eq(milestones.type, filters.type));
    }
    
    if (filters?.hospitalId !== undefined) {
      if (filters.hospitalId === null) {
        conditions.push(isNull(milestones.hospitalId));
      } else {
        conditions.push(eq(milestones.hospitalId, filters.hospitalId));
      }
    }
    
    if (filters?.isActive) {
      const now = new Date();
      conditions.push(
        or(
          isNull(milestones.campaignStartDate),
          lte(milestones.campaignStartDate, now)
        ),
        or(
          isNull(milestones.campaignEndDate),
          gte(milestones.campaignEndDate, now)
        )
      );
    }
    
    return db.query.milestones.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: desc(milestones.createdAt),
    });
  }

  /**
   * ID로 마일스톤 조회
   */
  static async findById(milestoneId: number) {
    const milestone = await db.query.milestones.findFirst({
      where: eq(milestones.id, milestoneId),
    });
    
    if (!milestone) {
      throw createError.notFound('마일스톤을 찾을 수 없습니다');
    }
    
    return milestone;
  }

  /**
   * 사용자의 신청 내역 조회
   */
  static async findUserApplications(userId: number) {
    return db.query.milestoneApplications.findMany({
      where: eq(milestoneApplications.userId, userId),
      with: {
        milestone: true,
      },
      orderBy: desc(milestoneApplications.createdAt),
    });
  }

  /**
   * 마일스톤 신청
   */
  static async applyToMilestone(
    userId: number,
    milestoneId: string,
    data: any
  ) {
    const existing = await db.query.milestoneApplications.findFirst({
      where: and(
        eq(milestoneApplications.userId, userId),
        eq(milestoneApplications.milestoneId, milestoneId)
      ),
    });
    
    if (existing) {
      throw createError.conflict('이미 신청한 마일스톤입니다');
    }
    
    const [application] = await db
      .insert(milestoneApplications)
      .values({
        userId,
        milestoneId,
        status: 'pending',
        ...data,
      })
      .returning();
    
    logger.info('Milestone application created', { userId, milestoneId });
    return application;
  }

  /**
   * 신청 상태 업데이트
   */
  static async updateApplicationStatus(
    applicationId: number,
    status: string
  ) {
    const [updated] = await db
      .update(milestoneApplications)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(milestoneApplications.id, applicationId))
      .returning();
    
    if (!updated) {
      throw createError.notFound('신청 내역을 찾을 수 없습니다');
    }
    
    logger.info('Application status updated', { applicationId, status });
    return updated;
  }
}
