/**
 * 병원 활성화 상태 확인 미들웨어
 * 비활성 병원 소속 사용자의 서비스 API 접근을 차단합니다.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '@db';
import { hospitals } from '../../shared/schema';
import { eq } from 'drizzle-orm';

interface AuthenticatedRequest extends Request {
  user?: {
    id: number;
    userId: number;
    email: string | null;
    memberType: string | null;
    hospitalId?: number | null;
    username?: string;
    hospital?: {
      id: number;
      name: string;
      isActive: boolean;
    };
  };
}

/**
 * 병원 활성화 상태 확인 미들웨어
 * 서비스 API (이미지/음악 생성) 접근 시 병원 활성화 상태를 확인합니다.
 */
export const requireActiveHospital = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user;
    
    // 사용자가 병원에 소속되지 않은 경우 통과
    if (!user?.hospitalId) {
      return next();
    }

    // 이미 병원 정보가 있고 활성화된 경우 통과
    if (user.hospital?.isActive === true) {
      return next();
    }

    // 병원 정보를 다시 조회하여 최신 상태 확인
    const hospital = await db.query.hospitals.findFirst({
      where: eq(hospitals.id, user.hospitalId)
    });

    if (!hospital) {
      console.log(`[병원 인증] 병원 ID ${user.hospitalId}를 찾을 수 없음`);
      return res.status(404).json({
        success: false,
        error: "소속 병원 정보를 찾을 수 없습니다.",
        code: "HOSPITAL_NOT_FOUND"
      });
    }

    // 병원이 비활성화된 경우 접근 차단
    if (!hospital.isActive) {
      console.log(`[병원 인증] 비활성 병원 ${hospital.name} 서비스 차단`);
      return res.status(403).json({
        success: false,
        error: `소속 병원 '${hospital.name}'의 서비스가 일시 중단되었습니다. 기존 갤러리 및 음악은 계속 이용하실 수 있습니다.`,
        code: "HOSPITAL_INACTIVE",
        hospitalName: hospital.name,
        hospitalId: hospital.id
      });
    }

    // 병원 정보를 req.user에 업데이트
    if (user) {
      user.hospital = {
        id: hospital.id,
        name: hospital.name,
        isActive: hospital.isActive
      };
    }

    console.log(`[병원 인증] 활성 병원 ${hospital.name} 서비스 접근 허용`);
    next();

  } catch (error) {
    console.error('[병원 인증] 미들웨어 오류:', error);
    return res.status(500).json({
      success: false,
      error: "병원 상태 확인 중 오류가 발생했습니다.",
      code: "HOSPITAL_CHECK_ERROR"
    });
  }
};