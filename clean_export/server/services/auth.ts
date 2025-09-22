import { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { db } from "@db";
import { users, roles, userRoles, refreshTokens } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

// TypeScript에서 Session 타입 확장 (패스포트 타입 오류 수정)
import 'express-session';

declare module 'express-session' {
  interface SessionData {
    passport: {
      user: number;
    };
  }
}

// JWT 설정 (보안 강화)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 환경변수가 설정되지 않았습니다.');
}
const JWT_EXPIRES_IN = "6h"; // 1단계: 6시간으로 테스트 (30분 → 6시간 → 24시간 → 30일)
const REFRESH_TOKEN_EXPIRES_IN = 14 * 24 * 60 * 60 * 1000; // 리프레시 토큰 유효 시간 (14일)

// 비밀번호 해싱 설정
const SALT_ROUNDS = 10;

// 비밀번호 해싱 함수
export async function hashPassword(password: string | null): Promise<string> {
  // null이나 빈 문자열인 경우 임의의 문자열로 해시 (Firebase 인증 등에서 사용)
  if (!password) {
    // Firebase 사용자는 로컬 비밀번호로 로그인할 수 없게 임의의 강력한 해시 생성
    const randomString = randomBytes(32).toString('hex');
    return bcrypt.hash(randomString, SALT_ROUNDS);
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

// 비밀번호 검증 함수
export async function verifyPassword(
  password: string | null,
  hashedPassword: string | null
): Promise<boolean> {
  // 비밀번호나 해시가 없으면 인증 실패
  if (!password || !hashedPassword) {
    console.log(`[비밀번호 검증] 빈 값 - password: ${!!password}, hashedPassword: ${!!hashedPassword}`);
    return false;
  }
  
  try {
    const result = await bcrypt.compare(password, hashedPassword);
    console.log(`[비밀번호 검증] bcrypt.compare 결과: ${result}`);
    return result;
  } catch (error) {
    console.error(`[비밀번호 검증] bcrypt.compare 오류:`, error);
    return false;
  }
}

// 사용자 정보에서 민감한 정보 제거
export function sanitizeUser(user: any) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...sanitizedUser } = user;
  return sanitizedUser;
}

// Passport 초기화 및 설정
export function initPassport() {

  // Serialize user to session - 사용자 ID를 세션에 저장
  passport.serializeUser((user: any, done) => {
    if (!user || typeof user.id === 'undefined') {
      console.error('[serializeUser] 오류: 유효하지 않은 사용자 객체', user);
      return done(new Error('유효하지 않은 사용자 객체'), null);
    }

    // 항상 숫자 타입으로 저장 (일관성 보장)
    const userId = typeof user.id === 'string' ? parseInt(user.id, 10) : user.id;

    if (isNaN(userId)) {
      return done(new Error('유효하지 않은 사용자 ID 형식'), null);
    }

    done(null, userId);
  });

  // Deserialize user from session - 세션에 저장된 ID로 사용자 정보 조회
  passport.deserializeUser(async (id: any, done) => {
    try {
      // ID 타입 검증 및 변환
      let userId = id;
      if (typeof id === 'string') {
        userId = parseInt(id, 10);
        if (isNaN(userId)) {
          return done(null, null);
        }
      }

      // 실제 사용자 정보 조회
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return done(null, null);
      }

      // 민감한 정보 제거 후 사용자 객체 반환
      const sanitizedUser = sanitizeUser(user);
      done(null, sanitizedUser);
    } catch (error) {
      done(null, null);
    }
  });

  // 로컬 전략 설정 (이메일/비밀번호 인증)
  passport.use(
    new LocalStrategy(
      {
        usernameField: "username", // form에서는 'username' 필드명 유지 (실제로는 이메일)
        passwordField: "password",
      },
      async (username: string, password: string, done: any) => {
        try {
          console.log(`[로컬 전략] 로그인 시도 - 입력: ${username}`);
          
          // username 또는 이메일로 사용자 검색 (둘 다 지원)
          let user = await db.query.users.findFirst({
            where: eq(users.email, username),
          });
          
          // 이메일로 찾지 못했다면 username으로 검색
          if (!user) {
            user = await db.query.users.findFirst({
              where: eq(users.username, username),
            });
          }

          if (!user) {
            console.log(`[로컬 전략] 사용자를 찾을 수 없음: ${username}`);
            return done(null, false, { message: "잘못된 사용자명/이메일 또는 비밀번호입니다." });
          }
          
          console.log(`[로컬 전략] 사용자 발견: ${user.username} (ID: ${user.id}), 비밀번호 있음: ${!!user.password}`);
          
          // Firebase 사용자인 경우 (password가 null이거나 빈 문자열인 경우)
          if (!user.password) {
            console.log(`[로컬 전략] Firebase 사용자는 일반 로그인 불가: ${user.username}`);
            return done(null, false, { message: "소셜 로그인으로 가입된 계정입니다. 구글 로그인을 사용해주세요." });
          }

          // 비밀번호 검증 전 로그
          console.log(`[로컬 전략] 비밀번호 검증 시작 - 사용자: ${user.username}`);
          console.log(`[로컬 전략] 입력된 비밀번호 길이: ${password.length}, 저장된 해시 길이: ${user.password?.length || 0}`);
          
          // 비밀번호 검증
          const isPasswordValid = await verifyPassword(password, user.password);
          
          console.log(`[로컬 전략] 비밀번호 검증 결과: ${isPasswordValid} - 사용자: ${user.username}`);
          
          if (!isPasswordValid) {
            console.log(`[로컬 전략] 비밀번호 불일치 - 사용자: ${user.username}`);
            return done(null, false, { message: "잘못된 이메일 주소 또는 비밀번호입니다." });
          }

          // 사용자 권한 조회
          const userRolesResult = await db
            .select({
              roleName: roles.name,
            })
            .from(userRoles)
            .innerJoin(roles, eq(userRoles.roleId, roles.id))
            .where(eq(userRoles.userId, user.id));

          // 사용자 역할 목록 추가
          const userWithRoles = {
            ...user,
            roles: userRolesResult.map((r: { roleName: string }) => r.roleName),
          };

          // 로그인 시간 업데이트
          await db
            .update(users)
            .set({ lastLogin: new Date() })
            .where(eq(users.id, user.id));

          console.log(`[로컬 전략] 로그인 성공 - 사용자: ${user.username} (ID: ${user.id})`);
          return done(null, userWithRoles);
        } catch (error) {
          console.error(`[로컬 전략] 오류 발생:`, error);
          return done(error);
        }
      }
    )
  );

  return passport;
}

// JWT 토큰 생성 - ES 모듈 호환
export function generateToken(user: any): string {
  const payload = {
    id: user.userId || user.id, // id로 통일
    userId: user.userId || user.id, // 하위 호환성 유지
    email: user.email,
    memberType: user.memberType,
    hospitalId: user.hospitalId,
    username: user.username,
    roles: user.roles || [],
    iat: Math.floor(Date.now() / 1000),
  } as const;

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// 리프레시 토큰 생성 및 저장
export async function generateRefreshToken(userId: number): Promise<string> {
  const token = randomBytes(40).toString("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN);

  // DB에 리프레시 토큰 저장
  await db.insert(refreshTokens).values({
    userId,
    token,
    expiresAt,
  });

  return token;
}

// 리프레시 토큰 검증 및 새 토큰 발급
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    // 리프레시 토큰 찾기
    const tokenData = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.token, refreshToken),
    });

    if (!tokenData) {
      return null; // 토큰이 존재하지 않음
    }

    // 토큰 만료 검사
    if (new Date() > tokenData.expiresAt) {
      // 만료된 토큰 삭제
      await db
        .delete(refreshTokens)
        .where(eq(refreshTokens.id, tokenData.id));
      return null;
    }

    // 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, tokenData.userId),
    });

    if (!user) {
      return null;
    }

    // 사용자 권한 조회
    const userRolesResult = await db
      .select({
        roleName: roles.name,
      })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, user.id));

    // 새 액세스 토큰 생성
    const userWithRoles = {
      ...user,
      roles: userRolesResult.map((r: { roleName: string }) => r.roleName),
    };

    return generateToken(userWithRoles);
  } catch (error) {
    console.error("리프레시 토큰 오류:", error);
    return null;
  }
}

// 리프레시 토큰 무효화 (로그아웃)
export async function invalidateRefreshToken(token: string): Promise<boolean> {
  try {
    const result = await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.token, token));
    return true;
  } catch (error) {
    console.error("토큰 무효화 오류:", error);
    return false;
  }
}

// JWT 인증 미들웨어 (캐시 최적화)
export async function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const { jwtCache } = await import('../utils/jwt-cache');
  const token = req.cookies?.auth_token;

  if (!token) {
    return res.status(401).json({ success: false, message: "인증 토큰이 없습니다" });
  }

  try {
    // 1. 캐시에서 먼저 확인
    const cachedUser = jwtCache.get(token);
    if (cachedUser) {
      // CachedUser를 JWTPayload 형태로 변환
      req.user = {
        id: cachedUser.id,
        userId: cachedUser.userId,
        email: cachedUser.email,
        memberType: cachedUser.memberType,
        hospitalId: cachedUser.hospitalId,
        username: cachedUser.username
      };
      return next();
    }

    // 2. 토큰 검증
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // 3. 데이터베이스에서 사용자 정보 조회 (필수 정보만)
    const user = await db.query.users.findFirst({
      where: eq(users.id, decoded.userId || decoded.id),
      columns: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        memberType: true,
        hospitalId: true
      }
    });

    if (!user) {
      return res.status(401).json({ success: false, message: "사용자를 찾을 수 없습니다" });
    }

    // 4. 캐시에 저장
    const userInfo = {
      id: user.id,
      userId: user.id,
      email: user.email,
      username: user.username,
      fullName: user.fullName,
      memberType: user.memberType,
      hospitalId: user.hospitalId,
      cachedAt: Date.now()
    };
    
    jwtCache.set(token, userInfo);
    
    // JWTPayload 형태로 변환하여 req.user에 할당
    req.user = {
      id: user.id,
      userId: user.id,
      email: user.email,
      memberType: user.memberType,
      hospitalId: user.hospitalId,
      username: user.username
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "토큰 검증 실패", error: (err as any).message });
  }
}

// 역할 기반 권한 검사 미들웨어
export function checkRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.sendStatus(401);
    }

    const userRoles = (req.user as any).roles || [];
    const hasRole = roles.some(role => userRoles.includes(role));

    if (!hasRole) {
      return res.sendStatus(403);
    }

    next();
  };
}