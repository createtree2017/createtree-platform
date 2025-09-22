import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

// JWT Secret 환경변수 확인
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
}

// JWT 페이로드 타입 정의
interface JWTPayload {
  id: number; // userId를 id로 통일
  userId: number; // 하위 호환성 유지
  email: string;
  memberType: string;
  hospitalId?: number;
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

  if (!token) {
    console.warn("[JWT Auth] 토큰 없음 - 로그인이 필요합니다");
    return res.status(401).json({ 
      success: false,
      error: "로그인이 필요합니다.",
      message: "인증 토큰이 없습니다."
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // req.user에 사용자 정보 할당 (id와 userId 모두 제공하여 일관성 확보)
    req.user = {
      id: decoded.id || decoded.userId,
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      memberType: decoded.memberType,
      username: decoded.username
    };
    
    console.log(`[JWT Auth] 인증 성공 - 사용자 ID: ${decoded.userId}, 등급: ${decoded.memberType}`);
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
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    req.user = {
      id: decoded.id || decoded.userId,
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      memberType: decoded.memberType,
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
 * 병원 관리자 전용 인증 미들웨어
 * JWT 인증 + hospital_admin 권한 + hospitalId 필수 검증
 */
export function requireHospitalAdmin(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.auth_token;

  if (!token) {
    console.warn("[Hospital Admin Auth] 토큰 없음 - 로그인이 필요합니다");
    return res.status(401).json({ 
      success: false,
      error: "로그인이 필요합니다.",
      message: "인증 토큰이 제공되지 않았습니다."
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    
    // 병원 관리자 권한 검증
    if (decoded.memberType !== 'hospital_admin') {
      console.warn(`[Hospital Admin Auth] 권한 없음 - 사용자 등급: ${decoded.memberType}`);
      return res.status(403).json({ 
        success: false,
        error: "병원 관리자 권한이 필요합니다.",
        message: "해당 기능은 병원 관리자만 사용할 수 있습니다."
      });
    }

    // hospitalId 필수 검증
    if (!decoded.hospitalId) {
      console.error(`[Hospital Admin Auth] hospitalId 없음 - 사용자 ID: ${decoded.userId}`);
      return res.status(403).json({ 
        success: false,
        error: "병원 관리자 설정이 올바르지 않습니다.",
        message: "병원 정보가 설정되지 않았습니다."
      });
    }
    
    // req.user에 사용자 정보 할당
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      memberType: decoded.memberType,
      hospitalId: decoded.hospitalId,
      username: decoded.username
    };
    
    console.log(`[Hospital Admin Auth] 인증 성공 - 병원 관리자 ID: ${decoded.userId}, 병원 ID: ${decoded.hospitalId}`);
    next();
  } catch (err: any) {
    console.error("[Hospital Admin Auth] 토큰 검증 실패:", err.message);
    
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