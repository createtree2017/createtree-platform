import { db } from '@db';
import { users } from '@shared/schema';
import { eq, and, or, like, desc } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { createError } from '../../utils/error-handler';
import type { PaginationParams } from '../../utils/request-helpers';

/**
 * 사용자 DB 서비스
 * - 모든 사용자 관련 DB 쿼리를 중앙 관리
 * - 쿼리 중복 제거
 * - 트랜잭션 관리
 */
export class UserService {
  /**
   * ID로 사용자 조회
   */
  static async findById(userId: number) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    
    if (!user) {
      throw createError.notFound('사용자를 찾을 수 없습니다');
    }
    
    return user;
  }

  /**
   * 이메일로 사용자 조회
   */
  static async findByEmail(email: string) {
    return db.query.users.findFirst({
      where: eq(users.email, email),
    });
  }

  /**
   * 사용자 존재 여부 확인
   */
  static async exists(userId: number): Promise<boolean> {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { id: true },
    });
    
    return !!user;
  }

  /**
   * 관리자 여부 확인
   */
  static async isAdmin(userId: number): Promise<boolean> {
    const user = await this.findById(userId);
    return ['admin', 'superadmin'].includes(user.memberType || '');
  }

  /**
   * 병원 관리자 여부 확인
   */
  static async isHospitalAdmin(userId: number): Promise<boolean> {
    const user = await this.findById(userId);
    return ['hospital_admin', 'admin', 'superadmin'].includes(user.memberType || '');
  }

  /**
   * 슈퍼 관리자 여부 확인
   */
  static async isSuperAdmin(userId: number): Promise<boolean> {
    const user = await this.findById(userId);
    return user.memberType === 'superadmin';
  }

  /**
   * 사용자 프로필 업데이트
   */
  static async updateProfile(
    userId: number,
    data: Partial<any>
  ) {
    const [updatedUser] = await db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!updatedUser) {
      throw createError.notFound('사용자를 찾을 수 없습니다');
    }
    
    logger.info('User profile updated', { userId });
    return updatedUser;
  }

  /**
   * 병원 ID로 사용자 목록 조회
   */
  static async findByHospitalId(hospitalId: number, pagination?: PaginationParams) {
    const query = db.query.users.findMany({
      where: eq(users.hospitalId, hospitalId),
      orderBy: desc(users.createdAt),
      ...(pagination && {
        limit: pagination.limit,
        offset: pagination.offset,
      }),
    });
    
    return query;
  }

  /**
   * 사용자 검색 (이름, 이메일)
   */
  static async search(searchTerm: string, pagination?: PaginationParams) {
    const searchPattern = `%${searchTerm}%`;
    
    return db.query.users.findMany({
      where: or(
        like(users.fullName, searchPattern),
        like(users.email, searchPattern)
      ),
      orderBy: desc(users.createdAt),
      ...(pagination && {
        limit: pagination.limit,
        offset: pagination.offset,
      }),
    });
  }

  /**
   * 사용자 통계
   */
  static async getStats(hospitalId?: number) {
    return {
      total: 0,
      byMemberType: {},
    };
  }
}
