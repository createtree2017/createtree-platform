import { Request, Response, NextFunction } from 'express';
import { ServicePermission, hasServicePermission } from '../../client/src/lib/auth-utils';

/**
 * 서비스별 권한 체크 미들웨어
 * 새로운 API 서비스 추가 시 한 줄로 권한 체크 가능
 */
export function requirePermission(requiredPermission: ServicePermission = ServicePermission.PREMIUM_SERVICES) {
  return async (req: Request, res: Response, next: NextFunction) => {
    console.log('\n🔒 [권한 체크] 미들웨어 시작');
    console.log(`   - 요청 URL: ${req.method} ${req.path}`);
    console.log(`   - JWT 사용자 ID: ${req.user?.id}`);
    console.log(`   - JWT 회원 등급: ${req.user?.memberType}`);
    console.log(`   - 필요 권한 레벨: ${requiredPermission}`);
    
    // 사용자 인증 확인
    if (!req.user) {
      console.log('❌ [권한 체크] 인증되지 않은 사용자');
      return res.status(401).json({
        success: false,
        error: "로그인이 필요합니다",
        message: "인증되지 않은 사용자입니다."
      });
    }

    let hasPermission = false;
    let currentUser: any = null;

    try {
      // DB에서 최신 사용자 정보 조회 (JWT 토큰 대신)
      const { db } = await import('@db');
      const { users } = await import('@shared/schema');
      const { eq } = await import('drizzle-orm');

      currentUser = await db.query.users.findFirst({
        where: eq(users.id, req.user.id)
      });

      if (!currentUser) {
        console.log('❌ [권한 체크] 사용자 정보를 찾을 수 없음');
        return res.status(404).json({
          success: false,
          error: "사용자 정보를 찾을 수 없습니다",
          message: "계정 정보가 존재하지 않습니다."
        });
      }

      // DB에서 조회한 최신 등급으로 권한 체크
      console.log(`🔄 [권한 체크] DB 최신 등급: ${currentUser.memberType} (JWT: ${req.user.memberType})`);
      
      hasPermission = hasServicePermission(currentUser.memberType, requiredPermission);
      console.log(`🔍 [권한 체크] hasServicePermission(${currentUser.memberType}, ${requiredPermission}) = ${hasPermission}`);
      
      // req.user의 memberType을 최신 정보로 업데이트
      req.user.memberType = currentUser.memberType;
      
    } catch (error) {
      console.error('❌ [권한 체크] DB 조회 오류:', error);
      return res.status(500).json({
        success: false,
        error: "권한 확인 중 오류가 발생했습니다",
        message: "잠시 후 다시 시도해주세요."
      });
    }
    
    if (!hasPermission) {
      const permissionNames = {
        [ServicePermission.READ_ONLY]: "기본 조회",
        [ServicePermission.PREMIUM_SERVICES]: "프리미엄 서비스",
        [ServicePermission.ADMIN_FEATURES]: "관리자 기능"
      };

      const memberTypeLabels = {
        'free': "무료회원",
        'pro': "개인 유료회원",
        'membership': "병원 소속회원",
        'hospital_admin': "병원 관리자",
        'admin': "관리자",
        'superadmin': "슈퍼관리자"
      };

      console.warn(`🚫 [권한 거부] 사용자 ${req.user.id} (${currentUser.memberType}) - 필요 권한: ${permissionNames[requiredPermission]}`);
      
      return res.status(403).json({
        success: false,
        error: "권한이 부족합니다",
        message: `이 서비스는 ${requiredPermission >= ServicePermission.PREMIUM_SERVICES ? '유료회원만' : '관리자만'} 사용할 수 있습니다.`,
        details: {
          currentMemberType: memberTypeLabels[req.user.memberType as keyof typeof memberTypeLabels] || memberTypeLabels['free'],
          requiredPermission: permissionNames[requiredPermission],
          upgradeMessage: requiredPermission >= ServicePermission.PREMIUM_SERVICES ? 
            "병원에 문의하여 회원 등급을 업그레이드하세요." : 
            "관리자에게 권한을 요청하세요."
        }
      });
    }

    // 권한 확인됨 - 다음 미들웨어로 진행
    const permissionNames = {
      [ServicePermission.READ_ONLY]: "기본 조회",
      [ServicePermission.PREMIUM_SERVICES]: "프리미엄 서비스", 
      [ServicePermission.ADMIN_FEATURES]: "관리자 기능"
    };
    
    console.log(`✅ [권한 승인] 사용자 ${req.user.id} (${req.user.memberType}) - ${permissionNames[requiredPermission]} 접근 허용`);
    next();
  };
}

/**
 * 병원 활성 상태 체크 미들웨어 (membership 회원용)
 */
export function requireActiveHospital() {
  return async (req: Request, res: Response, next: NextFunction) => {
    console.log('\n🏥 [병원 활성화 체크] 미들웨어 시작');
    console.log(`   - 사용자 ID: ${req.user?.id}`);
    console.log(`   - 회원 등급: ${req.user?.memberType}`);
    console.log(`   - 병원 ID: ${req.user?.hospitalId}`);
    
    // membership 회원이 아니면 체크하지 않음
    if (req.user?.memberType !== 'membership' || !req.user.hospitalId) {
      console.log(`🔓 [병원 활성화 체크] 통과 - membership 회원이 아니거나 병원 ID 없음`);
      return next();
    }

    try {
      const { db } = await import('@db');
      const { hospitals } = await import('../../shared/schema');
      const { eq } = await import('drizzle-orm');

      console.log(`🔍 [병원 활성화 체크] DB에서 병원 ID ${req.user.hospitalId} 조회 중...`);

      const hospital = await db.query.hospitals.findFirst({
        where: eq(hospitals.id, req.user.hospitalId)
      });

      if (!hospital) {
        console.log(`❌ [병원 활성화 체크] 병원 ID ${req.user.hospitalId} 찾을 수 없음`);
        return res.status(404).json({
          success: false,
          error: "병원을 찾을 수 없습니다",
          message: "소속 병원 정보가 존재하지 않습니다."
        });
      }

      console.log(`🏥 [병원 활성화 체크] 병원 정보:`);
      console.log(`   - 병원명: ${hospital.name}`);
      console.log(`   - 활성화 상태: ${hospital.isActive}`);

      if (!hospital.isActive) {
        console.warn(`🚫 [병원 비활성] 사용자 ${req.user.id} - 병원 ${hospital.name} 비활성 상태로 접근 차단`);
        
        return res.status(403).json({
          success: false,
          error: "병원 서비스가 일시 중단되었습니다",
          message: `${hospital.name}의 서비스가 일시 중단되어 이용할 수 없습니다. 병원에 문의해주세요.`,
          details: {
            hospitalName: hospital.name,
            hospitalId: hospital.id,
            status: "inactive"
          }
        });
      }

      // 병원 활성 상태 확인됨
      console.log(`✅ [병원 활성] 사용자 ${req.user.id} - 병원 ${hospital.name} 활성 상태 확인, 접근 허용`);
      next();
    } catch (error) {
      console.error('❌ [병원 상태 체크 오류]', error);
      return res.status(500).json({
        success: false,
        error: "병원 상태 확인 중 오류가 발생했습니다",
        message: "잠시 후 다시 시도해주세요."
      });
    }
  };
}

/**
 * 프리미엄 서비스 접근 권한 (기본)
 */
export const requirePremiumAccess = requirePermission(ServicePermission.PREMIUM_SERVICES);

/**
 * 관리자 권한 필요
 */
export const requireAdminAccess = requirePermission(ServicePermission.ADMIN_FEATURES);

/**
 * 조회 권한만 필요 (모든 회원)
 */
export const requireReadAccess = requirePermission(ServicePermission.READ_ONLY);