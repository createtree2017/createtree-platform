import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '@db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

// JWT Secret 환경변수 확인 (보안 강화)
const JWT_SECRET = process.env.JWT_SECRET || '';
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
}

// TypeScript를 위한 타입 가드
function getJwtSecret(): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
  }
  return JWT_SECRET;
}

// JWT 페이로드 타입 정의
interface JWTPayload {
  id: number; // userId를 id로 통일
  userId: number; // 하위 호환성 유지
  sub?: string; // Standard JWT subject claim
  email: string | null;
  memberType: string | null;
  hospitalId?: number | null;
  username?: string;
  iat?: number;
  exp?: number;
}

// Express Request 타입 확장
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

/**
 * JWT-only 인증 미들웨어
 * 쿠키에서 JWT 토큰을 읽고 검증한 뒤, req.user에 사용자 정보 할당
 * 토큰이 없거나 잘못된 경우 401 반환
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // 쿠키와 Authorization 헤더에서 토큰 확인
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  console.log(`[JWT Auth] 토큰 확인 - 쿠키: ${!!req.cookies?.auth_token}, 헤더: ${!!req.headers.authorization}`);

  if (!token) {
    console.warn("[JWT Auth] 토큰 없음 - 로그인이 필요합니다");
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
      message: "인증 토큰이 없습니다."
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;

    console.log(`[JWT Auth] 토큰 디코딩 성공:`, {
      id: decoded.id,
      userId: decoded.userId,
      email: decoded.email,
      memberType: decoded.memberType
    });

    // req.user에 사용자 정보 할당 (JWTPayload 타입에 맞게 변환)
    req.user = {
      id: decoded.id || decoded.userId,
      userId: decoded.userId || decoded.id,
      email: decoded.email || null,
      memberType: decoded.memberType || null,
      hospitalId: decoded.hospitalId || null,
      username: decoded.username || undefined
    };

    console.log(`[JWT Auth] 인증 성공 - 사용자 ID: ${decoded.userId || decoded.id}, 등급: ${decoded.memberType}`);
    next();
  } catch (err: any) {
    console.error("[JWT Auth] 토큰 검증 실패:", err.message);

    // 토큰 만료 vs 유효하지 않은 토큰 구분
    let errorMessage = "인증 토큰이 유효하지 않습니다.";
    if (err.name === 'TokenExpiredError') {
      errorMessage = "인증 토큰이 만료되었습니다. 다시 로그인해주세요.";
    } else if (err.name === 'JsonWebTokenError') {
      errorMessage = "잘못된 인증 토큰입니다.";
    }

    return res.status(401).json({
      success: false,
      error: "토큰 인증 실패",
      message: errorMessage
    });
  }
}

/**
 * 선택적 인증 미들웨어 (로그인하지 않아도 접근 가능하지만 로그인한 경우 사용자 정보 제공)
 */
export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  // 쿠키와 Authorization 헤더에서 토큰 확인
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    // 토큰이 없어도 계속 진행
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    req.user = {
      id: decoded.id || decoded.userId,
      userId: decoded.userId || decoded.id,
      email: decoded.email || null,
      memberType: decoded.memberType || null,
      hospitalId: decoded.hospitalId || null,
      username: decoded.username
    };
    console.log(`[JWT Optional Auth] 사용자 인증됨 - ID: ${decoded.userId}`);
  } catch (err) {
    console.warn("[JWT Optional Auth] 토큰 검증 실패, 비로그인 상태로 진행");
    // 토큰이 잘못되어도 계속 진행
  }

  next();
}

/**
 * 관리자 전용 인증 미들웨어 (admin, superadmin, hospital_admin)
 * JWT 인증 + DB에서 최신 권한 정보 조회
 * admin-auth.ts에서 통합됨
 */
export async function requireAdminOrSuperAdmin(req: Request, res: Response, next: NextFunction) {
  // 쿠키와 Authorization 헤더에서 토큰 확인
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    console.warn("[Admin Auth] 토큰 없음 - 로그인이 필요합니다");
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
      message: "인증 토큰이 제공되지 않았습니다."
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    console.log(`[Admin Auth] 토큰 디코딩 결과:`, decoded);

    // 사용자 ID로 DB에서 최신 권한 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId || decoded.id),
      columns: {
        id: true,
        memberType: true,
        email: true,
        username: true,
        hospitalId: true
      }
    });

    if (!user) {
      console.warn(`[Admin Auth] 사용자를 찾을 수 없음 - ID: ${decoded.userId || decoded.id}`);
      return res.status(403).json({
        success: false,
        error: "사용자를 찾을 수 없습니다."
      });
    }

    // 관리자 권한 검증 (admin, superadmin, hospital_admin)
    if (user.memberType !== 'admin' && user.memberType !== 'superadmin' && user.memberType !== 'hospital_admin') {
      console.warn(`[Admin Auth] 권한 없음 - 사용자 등급: ${user.memberType}`);
      return res.status(403).json({
        success: false,
        error: "관리자 권한이 필요합니다.",
        message: "해당 기능은 관리자만 사용할 수 있습니다."
      });
    }

    // req.user에 DB에서 조회한 최신 정보 할당
    req.user = {
      id: user.id,
      userId: user.id,
      email: user.email || null,
      memberType: user.memberType || null,
      hospitalId: (user as any).hospitalId || decoded.hospitalId || null,
      username: user.username || undefined
    };

    console.log(`[Admin Auth] 인증 성공 - 관리자 ID: ${user.id}, 등급: ${user.memberType}`);
    next();
  } catch (err: any) {
    console.error("[Admin Auth] 토큰 검증 실패:", err.message);

    let errorMessage = "인증 토큰이 유효하지 않습니다.";
    if (err.name === 'TokenExpiredError') {
      errorMessage = "인증 토큰이 만료되었습니다. 다시 로그인해주세요.";
    } else if (err.name === 'JsonWebTokenError') {
      errorMessage = "잘못된 인증 토큰입니다.";
    }

    return res.status(401).json({
      success: false,
      error: "토큰 인증 실패",
      message: errorMessage
    });
  }
}

// 하위 호환성: requireAdmin이 사용되는 곳(upscale.ts)을 위한 별칭
export { requireAdminOrSuperAdmin as requireAdmin };

/**
 * 병원 관리자 전용 인증 미들웨어
 * JWT 인증 + 병원 관리자/관리자 권한 검증
 * hospital_admin은 hospitalId 필수, admin/superadmin은 hospitalId 없이도 접근 가능
 * admin-auth.ts에서 통합됨
 */
export function requireHospitalAdmin(req: Request, res: Response, next: NextFunction) {
  // 쿠키와 Authorization 헤더에서 토큰 확인
  let token = req.cookies?.auth_token;

  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    console.warn("[Hospital Auth] 토큰 없음 - 로그인이 필요합니다");
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
      message: "인증 토큰이 제공되지 않았습니다."
    });
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as any;

    // 병원 관리자 권한 검증 (hospital_admin, admin, superadmin)
    if (!['hospital_admin', 'admin', 'superadmin'].includes(decoded.memberType)) {
      console.warn(`[Hospital Auth] 권한 없음 - 사용자 등급: ${decoded.memberType}`);
      return res.status(403).json({
        success: false,
        error: "병원 관리자 권한이 필요합니다.",
        message: "해당 기능은 병원 관리자만 사용할 수 있습니다."
      });
    }

    // 병원 ID 확인 (hospital_admin의 경우 필수)
    if (decoded.memberType === 'hospital_admin' && !decoded.hospitalId) {
      console.warn(`[Hospital Auth] 병원 ID 없음 - 사용자 ID: ${decoded.userId}`);
      return res.status(403).json({
        success: false,
        error: "병원 정보가 없습니다.",
        message: "병원 관리자 계정에 병원 정보가 설정되지 않았습니다."
      });
    }

    // req.user에 사용자 정보 할당
    req.user = {
      id: decoded.id || decoded.userId,
      userId: decoded.userId || decoded.id,
      email: decoded.email || null,
      memberType: decoded.memberType || null,
      hospitalId: decoded.hospitalId || null,
      username: decoded.username || undefined
    };

    console.log(`[Hospital Auth] 인증 성공 - 병원관리자 ID: ${decoded.userId}, 병원 ID: ${decoded.hospitalId}`);
    next();
  } catch (err: any) {
    console.error("[Hospital Auth] 토큰 검증 실패:", err.message);

    let errorMessage = "인증 토큰이 유효하지 않습니다.";
    if (err.name === 'TokenExpiredError') {
      errorMessage = "인증 토큰이 만료되었습니다. 다시 로그인해주세요.";
    } else if (err.name === 'JsonWebTokenError') {
      errorMessage = "잘못된 인증 토큰입니다.";
    }

    return res.status(401).json({
      success: false,
      error: "토큰 인증 실패",
      message: errorMessage
    });
  }
}