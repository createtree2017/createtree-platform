// 사용자 등급별 권한 관리 유틸리티

export type MemberType = 'free' | 'pro' | 'membership' | 'hospital_admin' | 'admin' | 'superadmin';
const MEMBER_TYPES: readonly MemberType[] = ['free', 'pro', 'membership', 'hospital_admin', 'admin', 'superadmin'];

export function normalizeMemberType(memberType?: string | null): MemberType {
  return MEMBER_TYPES.includes(memberType as MemberType) ? (memberType as MemberType) : 'free';
}

// 권한 레벨 정의 (숫자가 높을수록 높은 권한)
export enum PermissionLevel {
  FREE = 0,           // 무료회원 (조회만 가능)
  PRO = 10,          // 개인 유료회원 (모든 서비스)
  MEMBERSHIP = 20,   // 병원 소속회원 (모든 서비스)
  HOSPITAL_ADMIN = 30,
  ADMIN = 40,
  SUPERADMIN = 50
}

// 서비스별 필요 권한 정의
export enum ServicePermission {
  READ_ONLY = 0,        // 갤러리/음악 조회
  PREMIUM_SERVICES = 10, // 이미지/음악 생성 등 프리미엄 기능
  ADMIN_FEATURES = 40   // 관리자 기능
}

/**
 * 회원 등급을 권한 레벨로 변환
 */
export function getMemberPermissionLevel(memberType?: string | null): PermissionLevel {
  switch (normalizeMemberType(memberType)) {
    case 'free': return PermissionLevel.FREE;
    case 'pro': return PermissionLevel.PRO;
    case 'membership': return PermissionLevel.MEMBERSHIP;
    case 'hospital_admin': return PermissionLevel.HOSPITAL_ADMIN;
    case 'admin': return PermissionLevel.ADMIN;
    case 'superadmin': return PermissionLevel.SUPERADMIN;
    default: return PermissionLevel.FREE;
  }
}

/**
 * 특정 서비스 사용 권한이 있는지 확인
 */
export function hasServicePermission(memberType?: string | null, requiredPermission: ServicePermission = ServicePermission.PREMIUM_SERVICES): boolean {
  const userLevel = getMemberPermissionLevel(memberType);
  return userLevel >= requiredPermission;
}

export interface AuthUser {
  id: number;
  username: string;
  email?: string;
  memberType: MemberType | string | null;
  hospitalId?: number;
}

/**
 * 관리자 권한이 있는지 확인
 */
export function isAdmin(memberType?: string | null): boolean {
  return memberType === 'admin' || memberType === 'superadmin';
}

/**
 * 슈퍼관리자인지 확인
 */
export function isSuperAdmin(memberType?: string | null): boolean {
  return memberType === 'superadmin';
}

/**
 * 병원 관리자인지 확인
 */
export function isHospitalAdmin(memberType?: string | null): boolean {
  return memberType === 'hospital_admin';
}

/**
 * 프리미엄 회원인지 확인 (pro 이상)
 */
export function isPremiumMember(memberType?: string | null): boolean {
  return ['pro', 'membership', 'hospital_admin', 'admin', 'superadmin'].includes(memberType || '');
}

/**
 * 특정 페이지 접근 권한 확인
 */
export function canAccessAdminPage(memberType?: string | null): boolean {
  return isAdmin(memberType);
}

export function canAccessHospitalPage(memberType?: string | null): boolean {
  return isHospitalAdmin(memberType) || isAdmin(memberType);
}

/**
 * 등급 변경 권한 확인
 */
export function canChangeUserRole(currentUserType?: string | null, targetUserType?: string | null, newUserType?: string | null): boolean {
  // 슈퍼관리자는 모든 등급 변경 가능
  if (isSuperAdmin(currentUserType)) {
    return true;
  }
  
  // 일반 관리자는 admin/superadmin 관련 변경 불가
  if (isAdmin(currentUserType)) {
    const forbidden = ['admin', 'superadmin'];
    return !forbidden.includes(targetUserType || '') && !forbidden.includes(newUserType || '');
  }
  
  return false;
}

/**
 * 현재 사용자가 변경할 수 있는 등급 목록 반환
 */
export function getAvailableRoles(currentUserType?: MemberType): Array<{value: MemberType, label: string}> {
  const allRoles = [
    { value: 'free' as MemberType, label: '일반회원' },
    { value: 'pro' as MemberType, label: 'Pro회원' },
    { value: 'membership' as MemberType, label: '멤버쉽회원' },
    { value: 'hospital_admin' as MemberType, label: '병원관리자' },
    { value: 'admin' as MemberType, label: '관리자' },
    { value: 'superadmin' as MemberType, label: '슈퍼관리자' }
  ];

  if (isSuperAdmin(currentUserType)) {
    return allRoles;
  }
  
  if (isAdmin(currentUserType)) {
    return allRoles.filter(role => !['admin', 'superadmin'].includes(role.value));
  }
  
  return [];
}

/**
 * 등급명을 한국어로 변환
 */
export function getMemberTypeLabel(memberType?: string | null): string {
  const labels: Record<MemberType, string> = {
    'free': '일반회원',
    'pro': 'Pro회원', 
    'membership': '멤버쉽회원',
    'hospital_admin': '병원관리자',
    'admin': '관리자',
    'superadmin': '슈퍼관리자'
  };
  
  return labels[normalizeMemberType(memberType)] || '일반회원';
}

/**
 * 등급별 배지 색상 반환
 */
export function getMemberTypeBadgeColor(memberType?: string | null): string {
  const colors: Record<MemberType, string> = {
    'free': 'bg-gray-100 text-gray-800',
    'pro': 'bg-blue-100 text-blue-800',
    'membership': 'bg-purple-100 text-purple-800',
    'hospital_admin': 'bg-green-100 text-green-800',
    'admin': 'bg-orange-100 text-orange-800',
    'superadmin': 'bg-red-100 text-red-800'
  };
  
  return colors[normalizeMemberType(memberType)] || 'bg-gray-100 text-gray-800';
}
