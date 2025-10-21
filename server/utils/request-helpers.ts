import type { Request, Response } from 'express';
import { USER_ROLES, ADMIN_ROLES } from '../config/constants';

/**
 * 요청에서 사용자 ID 추출
 * - req.user.id, req.user.userId, req.user.sub 모두 지원
 * - Number 타입으로 정규화
 */
export function extractUserId(req: Request): number {
  const userIdRaw = req.user?.userId || req.user?.id || req.user?.sub;
  const userId = Number(userIdRaw);
  
  if (isNaN(userId)) {
    throw new Error('Invalid user ID');
  }
  
  return userId;
}

/**
 * 사용자 ID 검증 및 추출
 * - 실패 시 자동으로 401 응답
 * - 성공 시 userId 반환, 실패 시 null
 */
export function validateAuthUser(req: Request, res: Response): number | null {
  try {
    const userId = extractUserId(req);
    return userId;
  } catch (error) {
    res.status(401).json({
      success: false,
      error: '인증이 필요합니다',
    });
    return null;
  }
}

/**
 * 사용자 ID를 String으로 추출 (일부 레거시 API용)
 */
export function extractUserIdString(req: Request): string {
  const userId = req.user?.userId || req.user?.id || req.user?.sub;
  return String(userId);
}

/**
 * 관리자 권한 확인
 */
export function isAdmin(req: Request): boolean {
  const memberType = req.user?.memberType;
  return ADMIN_ROLES.includes(memberType as any);
}

/**
 * 병원 관리자 권한 확인
 */
export function isHospitalAdmin(req: Request): boolean {
  const memberType = req.user?.memberType;
  return [
    USER_ROLES.HOSPITAL_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.SUPERADMIN,
  ].includes(memberType as any);
}

/**
 * 슈퍼 관리자 권한 확인
 */
export function isSuperAdmin(req: Request): boolean {
  const memberType = req.user?.memberType;
  return memberType === USER_ROLES.SUPERADMIN;
}

/**
 * 병원 ID 추출
 */
export function extractHospitalId(req: Request): number | undefined {
  const hospitalId = req.user?.hospitalId;
  return hospitalId ? Number(hospitalId) : undefined;
}

/**
 * 페이지네이션 파라미터 추출
 */
export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function extractPagination(req: Request, defaultLimit = 20): PaginationParams {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || defaultLimit));
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
}

/**
 * 정렬 파라미터 추출
 */
export interface SortParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export function extractSort(
  req: Request,
  allowedFields: string[] = [],
  defaultSortBy = 'createdAt'
): SortParams {
  const sortBy = req.query.sortBy as string || defaultSortBy;
  const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'asc' ? 'asc' : 'desc';
  
  const validSortBy = allowedFields.length > 0 && !allowedFields.includes(sortBy)
    ? defaultSortBy
    : sortBy;
  
  return { sortBy: validSortBy, sortOrder };
}

/**
 * 필터 파라미터 추출 (타입 안전)
 */
export function extractFilters<T extends Record<string, any>>(
  req: Request,
  allowedFilters: (keyof T)[]
): Partial<T> {
  const filters: Partial<T> = {};
  
  for (const key of allowedFilters) {
    const value = req.query[key as string];
    if (value !== undefined && value !== null && value !== '') {
      filters[key] = value as T[keyof T];
    }
  }
  
  return filters;
}

/**
 * 쿼리 스트링에서 boolean 값 추출
 */
export function extractBoolean(value: any): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === 'true' || value === '1' || value === 1) return true;
  if (value === 'false' || value === '0' || value === 0) return false;
  return undefined;
}

/**
 * 쿼리 스트링에서 숫자 배열 추출
 */
export function extractNumberArray(value: any): number[] {
  if (!value) return [];
  
  const arr = Array.isArray(value) ? value : [value];
  return arr.map(v => Number(v)).filter(v => !isNaN(v));
}

/**
 * 쿼리 스트링에서 문자열 배열 추출
 */
export function extractStringArray(value: any): string[] {
  if (!value) return [];
  
  const arr = Array.isArray(value) ? value : [value];
  return arr.map(v => String(v)).filter(v => v.length > 0);
}
