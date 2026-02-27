import { Router, Request, Response } from "express";
import passport from "passport";
import jwt from "jsonwebtoken";
import { db } from "@db";
import crypto from "crypto";

// JWT Secret 환경변수 확인 (프로덕션에서는 반드시 설정되어야 함)
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET 환경변수가 설정되지 않았습니다. 보안을 위해 필수입니다.");
}
import {
  users,
  roles,
  userRoles,
  hospitals,
  hospitalCodes,
  passwordResetTokens,
  emailVerificationTokens,
  userNotificationSettings,
  insertUserSchema,
  insertRoleSchema,
  insertUserRoleSchema,
} from "../../shared/schema";
import { eq, and, sql, lt } from "drizzle-orm";
import {
  hashPassword,
  sanitizeUser,
  generateToken,
  generateRefreshToken,
  refreshAccessToken,
  invalidateRefreshToken,
  authenticateJWT,
  checkRole,
} from "../../server/services/auth";
import {
  FirebaseUserData,
  handleFirebaseAuth,
} from "../../server/services/firebase-auth";
import { sendPasswordResetEmail, sendPasswordResetSuccessEmail, sendVerificationEmail, isValidEmail } from "../../server/services/email";
import bcrypt from "bcrypt";
import { requireAuth } from '../middleware/auth';
import { auth as firebaseAuth } from '../firebase';

const router = Router();

// 사용자명 중복 체크 API
router.get("/check-username/:username", async (req, res) => {
  try {
    const { username } = req.params;

    if (!username || username.length < 3) {
      return res.status(400).json({
        available: false,
        message: "사용자명은 최소 3자 이상이어야 합니다."
      });
    }

    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, username),
    });

    if (existingUser) {
      return res.json({
        available: false,
        message: `'${username}' 사용자명이 이미 사용 중입니다.`
      });
    }

    return res.json({
      available: true,
      message: `'${username}' 사용자명을 사용할 수 있습니다.`
    });
  } catch (error) {
    console.error("사용자명 중복 체크 오류:", error);
    return res.status(500).json({
      available: false,
      message: "사용자명 확인 중 오류가 발생했습니다."
    });
  }
});

// 회원 가입 API
router.post("/register", async (req, res) => {
  try {
    // 입력 데이터 유효성 검사
    const validatedData = insertUserSchema.parse(req.body);

    // 사용자명 중복 검사
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, validatedData.username),
    });

    if (existingUser) {
      console.log(`회원가입 실패: 사용자명 '${validatedData.username}' 이미 존재 (ID: ${existingUser.id})`);
      return res
        .status(400)
        .json({
          message: `'${validatedData.username}' 사용자명이 이미 사용 중입니다. 다른 사용자명을 선택해주세요.`,
          field: "username"
        });
    }

    // 이메일 중복 검사 (이메일이 있는 경우)
    if (validatedData.email) {
      const existingEmail = await db.query.users.findFirst({
        where: eq(users.email, validatedData.email),
      });

      if (existingEmail) {
        console.log(`회원가입 실패: 이메일 '${validatedData.email}' 이미 존재 (ID: ${existingEmail.id})`);
        return res
          .status(400)
          .json({
            message: `'${validatedData.email}' 이메일이 이미 사용 중입니다. 다른 이메일을 사용하거나 로그인해주세요.`,
            field: "email"
          });
      }
    }

    // 비밀번호 해싱
    const hashedPassword = await hashPassword(validatedData.password);

    try {
      // 사용자 생성 - createdAt과 updatedAt을 SQL 레벨에서 DEFAULT(current_timestamp)로 처리
      console.log("회원가입 요청 데이터:", validatedData); // 로깅 추가

      // name 필드가 있으면 fullName에 매핑, 아니면 fullName 사용
      const userValues = {
        username: validatedData.username,
        password: hashedPassword,
        email: validatedData.email || null,
        fullName: validatedData.name || validatedData.fullName || null, // name 필드 우선 사용
        emailVerified: false,
        memberType: validatedData.memberType || "free", // DB 스키마와 일치하도록 "free"로 변경
        hospitalId: validatedData.hospitalId ? parseInt(validatedData.hospitalId, 10) : null, // 문자열을 정수로 변환
        phoneNumber: validatedData.phoneNumber || null,
        birthdate: validatedData.birthdate ? new Date(validatedData.birthdate) : null, // 문자열을 Date 객체로 변환
        // hospitalId 기반 promoCode 저장
        promoCode: validatedData.promoCode || null,
      };

      // 사용자 생성
      const newUser = await db.insert(users).values(userValues).returning();

      // Hospital ID가 있는 경우 로그 기록
      if (validatedData.hospitalId) {
        console.log(`병원 연결 사용자 생성: 병원 ID ${validatedData.hospitalId}`);
      }

      if (!newUser || newUser.length === 0) {
        return res.status(500).json({ message: "사용자 생성에 실패했습니다." });
      }

      // 기본 역할 (user) 찾기
      const userRole = await db.query.roles.findFirst({
        where: eq(roles.name, "user"),
      });

      // 만약 역할이 존재하지 않는다면 생성
      let roleId = userRole?.id;
      if (!roleId) {
        const newRole = await db
          .insert(roles)
          .values({
            name: "user",
            description: "일반 사용자",
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          .returning();

        roleId = newRole[0].id;
      }

      // 사용자-역할 매핑 생성
      await db.insert(userRoles).values({
        userId: newUser[0].id,
        roleId: roleId,
        createdAt: new Date(),
      });

      // 회원가입 후 세션에 바로 로그인 될 수 있도록 준비
      // JWT 토큰에 hospitalId 포함을 위해 완전한 사용자 정보 생성
      const userWithRoles = {
        ...newUser[0],
        hospitalId: newUser[0].hospitalId, // 명시적으로 hospitalId 포함
        roles: ["user"],
      };

      const accessToken = generateToken(userWithRoles);
      const refreshToken = await generateRefreshToken(newUser[0].id);

      // 자동 로그인을 위한 세션 설정
      req.login(userWithRoles, (loginErr) => {
        if (loginErr) {
          console.error("회원가입 후 자동 로그인 오류:", loginErr);
          return res.status(500).json({ message: "회원가입은 성공했지만 자동 로그인에 실패했습니다." });
        }

        // 응답 쿠키 설정
        res.cookie("refreshToken", refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 14 * 24 * 60 * 60 * 1000, // 14일
        });

        res.cookie("auth_token", accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 24 * 60 * 60 * 1000 // 24시간
        });

        res.cookie("auth_status", "logged_in", {
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 24 * 60 * 60 * 1000 // 24시간
        });

        console.log(`회원가입 및 자동 로그인 성공: 사용자 ID ${newUser[0].id}, 이메일 ${newUser[0].email}`);

        return res.status(201).json({
          user: sanitizeUser(userWithRoles),
          accessToken,
          message: "회원가입 및 로그인이 완료되었습니다."
        });
      });
    } catch (dbError: any) {
      console.error("DB 저장 오류:", dbError);

      // 구체적인 오류 메시지 제공
      if (dbError.code === "23505") {
        return res.status(400).json({ message: "이미 등록된 계정입니다." });
      }

      throw dbError; // 다른 오류는 상위 catch 블록으로 전달
    }
  } catch (error: any) {
    console.error("회원가입 오류:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({
        message: "입력 데이터가 유효하지 않습니다.",
        errors: error.errors,
      });
    }
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 모바일 Firebase 로그인 후 JWT 토큰 생성
router.post("/firebase-jwt", async (req, res) => {
  try {
    console.log("[Firebase JWT] Firebase 인증 후 JWT 토큰 생성 요청");

    const { firebaseUid, email } = req.body;

    if (!firebaseUid || !email) {
      return res.status(400).json({
        message: "Firebase UID 및 이메일이 필요합니다."
      });
    }

    // 사용자 DB에서 조회 또는 생성
    let user = await db.query.users.findFirst({
      where: eq(users.firebaseUid, firebaseUid)
    });

    if (!user) {
      // 새 사용자 생성
      console.log("[Firebase JWT] 새 사용자 생성:", email);
      const [newUser] = await db.insert(users).values({
        username: email.split('@')[0],
        firebaseUid,
        fullName: email.split('@')[0],
        memberType: "general",
        needProfileComplete: true
      }).returning();

      user = newUser;
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

    // JWT 토큰 생성 (일관된 generateToken 함수 사용)
    const token = generateToken(userWithRoles);

    console.log("[Firebase JWT] JWT 토큰 생성 성공, 사용자 ID:", user.id);

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        memberType: user.memberType,
        needProfileComplete: user.needProfileComplete
      }
    });

  } catch (error) {
    console.error("[Firebase JWT] 오류:", error);
    res.status(500).json({
      message: "JWT 토큰 생성 중 오류가 발생했습니다."
    });
  }
});

// TypeScript에서 Session 타입 확장 (모바일 Firebase 인증 지원)
declare module "express-session" {
  interface SessionData {
    passport: {
      user: number;
    };
    // Firebase 인증 관련 세션 필드
    userId?: number;
    firebaseUid?: string;
    userEmail?: string;
    userRole?: string;
    isAdmin?: boolean;
    isHospitalAdmin?: boolean;
    // 직접 사용자 객체 저장을 위한 필드 추가
    user?: {
      uid: string;
      email: string;
      role: string;
      [key: string]: any;
    };
  }
}

// 로그인 API (세션 기반)
router.post("/login", (req, res, next) => {
  // 로그인 요청 데이터 디버깅
  console.log("로그인 요청 - 사용자명:", req.body.username);
  console.log("로그인 요청 - 비밀번호 있음:", !!req.body.password);

  passport.authenticate("local", (err: any, user: any, info: any) => {
    try {
      if (err) {
        console.error("로그인 인증 오류:", err);
        return next(err);
      }

      if (!user) {
        console.log("로그인 실패 - 사용자 정보 없음, 이유:", info?.message);
        return res
          .status(401)
          .json({ message: info?.message || "로그인 실패" });
      }

      console.log("인증 성공 - 사용자:", user.username, "(ID:", user.id, ")");

      // req.login()을 사용하여 세션에 사용자 저장
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("req.login 호출 오류:", loginErr);
          return next(loginErr);
        }

        // 세션 정보 디버깅 로그
        const sessionInfo = {
          id: req.session.id,
          passport: req.session.passport
            ? JSON.stringify(req.session.passport)
            : "없음",
          cookie: req.session.cookie
            ? {
              originalMaxAge: req.session.cookie.originalMaxAge,
              expires: req.session.cookie.expires,
              secure: req.session.cookie.secure,
              httpOnly: req.session.cookie.httpOnly,
            }
            : "없음",
        };

        console.log("로그인 성공, 세션 정보:", sessionInfo);
        console.log("req.isAuthenticated():", req.isAuthenticated());
        console.log("req.sessionID:", req.sessionID);

        // 중요: 세션 강제 저장 - 항상 세션 저장 보장
        req.session.save(async (saveErr) => {
          if (saveErr) {
            console.error("세션 저장 오류:", saveErr);
            return next(saveErr);
          }

          // JWT 토큰 생성 (Google 로그인과 동일한 방식)
          console.log("세션 저장 완료, JWT 토큰 생성");

          const jwtToken = generateToken({
            id: user.id,
            userId: user.id,
            email: user.email,
            memberType: user.memberType,
            hospitalId: user.hospitalId,
            username: user.username,
            roles: user.roles || [],
          });

          // 세션 쿠키 설정 강화
          const isProduction = process.env.NODE_ENV === "production";
          const isHttps = process.env.PROTOCOL === "https" || isProduction;

          // 명시적으로 세션 쿠키 세팅 추가
          res.cookie("connect.sid", req.sessionID, {
            httpOnly: true,
            secure: isHttps,
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7일
            sameSite: isHttps ? "none" : "lax",
            path: "/",
          });

          // JWT 토큰 쿠키 설정 (Google 로그인과 동일)
          res.cookie("auth_token", jwtToken, {
            httpOnly: true,
            secure: isHttps,
            maxAge: 30 * 24 * 60 * 60 * 1000, // 30일
            sameSite: isHttps ? "none" : "lax",
            path: "/",
          });

          // 인증 상태 쿠키 (프론트엔드에서 확인용)
          res.cookie("auth_status", "logged_in", {
            httpOnly: false,
            secure: isHttps,
            maxAge: 30 * 24 * 60 * 60 * 1000,
            sameSite: isHttps ? "none" : "lax",
            path: "/",
          });

          const sanitizedUser = sanitizeUser(user);
          console.log('[로그인 성공] 반환할 사용자 정보:', { id: sanitizedUser.id, email: sanitizedUser.email, memberType: sanitizedUser.memberType });

          // 🔥 Firebase Direct Upload: Custom Token 생성 (Feature Flag 확인)
          let firebaseToken = null;

          console.log('=== 🔥 Firebase Token 생성 디버깅 ===');
          console.log('1. Feature Flag 값:', process.env.ENABLE_FIREBASE_DIRECT_UPLOAD);
          console.log('2. 타입:', typeof process.env.ENABLE_FIREBASE_DIRECT_UPLOAD);
          console.log('3. 조건 결과:', process.env.ENABLE_FIREBASE_DIRECT_UPLOAD === 'true');

          if (process.env.ENABLE_FIREBASE_DIRECT_UPLOAD === 'true') {
            console.log('4. ✅ IF 블록 진입');
            try {
              console.log('5. createFirebaseCustomToken import 시도...');
              const { createFirebaseCustomToken } = await import('../services/firebase-auth');
              console.log('6. ✅ import 성공, 함수 호출 시작...');

              firebaseToken = await createFirebaseCustomToken(user.id);
              console.log('7. ✅ Firebase Custom Token 생성 성공, 길이:', firebaseToken?.length);
            } catch (error) {
              console.error('❌ Firebase Custom Token 생성 실패:', error);
              console.error('에러 스택:', error instanceof Error ? error.stack : error);
              // Token 생성 실패해도 로그인 자체는 성공 처리
            }
          } else {
            console.log('4. ❌ IF 블록 건너뜀 (Feature Flag OFF)');
          }

          console.log('8. 최종 firebaseToken:', firebaseToken ? `있음 (${firebaseToken.substring(0, 50)}...)` : 'null');
          console.log('===================================');

          return res.json({
            user: sanitizedUser,
            token: jwtToken,
            firebaseToken, // 🔥 Firebase Direct Upload용 토큰 추가
          });
        });
      });
    } catch (error) {
      console.error("로그인 처리 중 예외 발생:", error);
      return next(error);
    }
  })(req, res, next);
});

// 토큰 갱신 API
router.post("/refresh-token", async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ message: "리프레시 토큰이 없습니다." });
  }

  try {
    const newAccessToken = await refreshAccessToken(refreshToken);

    if (!newAccessToken) {
      // 쿠키 삭제
      res.clearCookie("refreshToken");
      return res
        .status(401)
        .json({ message: "유효하지 않거나 만료된 토큰입니다." });
    }

    return res.json({
      accessToken: newAccessToken,
    });
  } catch (error) {
    console.error("토큰 갱신 오류:", error);
    return res.status(500).json({ message: "서버 오류가 발생했습니다." });
  }
});

// 로그아웃 API (세션 기반)
router.post("/logout", (req, res) => {
  // 디버깅 정보 출력
  console.log("로그아웃 요청: isAuthenticated=", req.isAuthenticated());
  // 🚨 보안: 민감한 세션 정보 로깅 제거 (PII 및 식별자 노출 방지)

  // req.logout() 사용하여 세션에서 사용자 정보 제거
  req.logout((err) => {
    if (err) {
      console.error("로그아웃 오류:", err);
      return res
        .status(500)
        .json({ message: "로그아웃 중 오류가 발생했습니다." });
    }

    // 세션 파기
    req.session.destroy((sessionErr) => {
      if (sessionErr) {
        console.error("세션 파기 오류:", sessionErr);
      }

      // 쿠키 삭제 - Replit 환경에서의 설정을 고려
      const isProduction = process.env.NODE_ENV === "production";
      const isHttps = process.env.PROTOCOL === "https" || isProduction;

      // 모든 인증 관련 쿠키 삭제
      res.clearCookie("connect.sid", {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
      });

      // JWT 토큰 쿠키도 삭제
      res.clearCookie("auth_token", {
        httpOnly: false,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
      });

      // 추가 쿠키들도 삭제
      res.clearCookie("auth_status", {
        httpOnly: false,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
      });

      res.clearCookie("refreshToken", {
        httpOnly: false,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
      });

      // 자동 로그인 관련 쿠키 완전 삭제
      res.clearCookie("createtree.sid", {
        httpOnly: false,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
      });

      res.clearCookie("remember_me", {
        httpOnly: false,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
      });

      res.clearCookie("auto_login_token", {
        httpOnly: true,
        secure: isHttps,
        sameSite: isHttps ? "none" : "lax",
        path: "/",
      });

      console.log("로그아웃 완료, 모든 인증 쿠키 삭제됨");
      return res.json({
        message: "로그아웃 성공",
        clearAll: true, // 클라이언트에서 추가 정리 작업 수행
        timestamp: Date.now()
      });
    });
  });
});

// 프로필 완성 API
router.post("/complete-profile", async (req, res) => {
  try {
    // 사용자 인증 확인 - 세션 및 Firebase 인증 모두 확인
    const authStatus = req.isAuthenticated();
    const sessionUserId = req.session.userId || (req.session.passport && req.session.passport.user);

    // 상세 로그 추가
    console.log(`
===================================================
[프로필 완성 요청]
- 인증 상태: ${authStatus}
- 세션 ID: ${req.session.id || '없음'}
- 세션 사용자 ID: ${sessionUserId || '없음'}
- 세션 사용자 객체: ${req.session.user ? JSON.stringify(req.session.user) : '없음'}
- 요청 쿠키: ${req.headers.cookie || '없음'}
===================================================
    `);

    // 세션 인증 확인
    if (!authStatus && !sessionUserId) {
      return res.status(401).json({
        message: "로그인이 필요합니다.",
        details: "세션이 만료되었거나 인증되지 않았습니다."
      });
    }

    // 요청 데이터 검증
    const {
      displayName,
      nickname,
      memberType,
      hospitalId,
      phoneNumber,
      birthdate,
      dueDate
    } = req.body;

    // 필수 정보 확인
    if (!phoneNumber || !displayName || !nickname || !birthdate || !memberType) {
      return res.status(400).json({ message: "필수 정보가 누락되었습니다." });
    }

    // 멤버십 회원인 경우 병원 ID 필수
    if (memberType === "membership" && !hospitalId) {
      return res.status(400).json({ message: "멤버십 회원은 병원 선택이 필수입니다." });
    }

    // 사용자 ID 확인 (여러 소스에서 확인)
    let userId = 0;

    if (req.user && (req.user as any).id) {
      // Passport 인증 사용자
      userId = (req.user as any).id;
    } else if (req.session.userId) {
      // 세션에 직접 저장된 사용자 ID
      userId = req.session.userId;
    } else if (req.session.passport && req.session.passport.user) {
      // Passport 세션 사용자 ID
      userId = req.session.passport.user;
    } else if (req.session.user && req.session.user.id) {
      // 세션에 직접 저장된 사용자 객체
      userId = req.session.user.id;
    }

    if (!userId) {
      return res.status(401).json({
        message: "유효한 사용자 ID를 찾을 수 없습니다.",
        details: "세션이 만료되었거나 손상되었습니다."
      });
    }

    console.log(`[프로필 완성] 사용자 ID 확인: ${userId}`);

    // 사용자 정보 업데이트 (기존 필드만 사용하여 업데이트)
    const updateData: any = {
      fullName: displayName,
      username: nickname,
      memberType: memberType,
      hospitalId: memberType === "membership" ? parseInt(hospitalId) : null,
      phoneNumber: phoneNumber,
      dueDate: dueDate ? new Date(dueDate) : null,
      needProfileComplete: false, // 프로필 완성 플래그 업데이트
      updatedAt: new Date()
    };

    // 생년월일 필드 추가 - 스키마에 있을 경우에만 사용
    try {
      updateData.birthdate = new Date(birthdate);
    } catch (err) {
      console.warn("[프로필 완성] 생년월일 변환 오류:", err);
    }

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    // 즉시 DB에 needProfileComplete: false로 업데이트
    const updateResult = await db.update(users)
      .set({
        needProfileComplete: false
      })
      .where(eq(users.id, userId))
      .returning();

    console.log("[프로필 완성] needProfileComplete 필드 명시적 업데이트:", updateResult.length > 0);

    // 업데이트된 사용자 정보 조회 (최신 상태 확인)
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    if (!updatedUser) {
      return res.status(500).json({ message: "사용자 정보 업데이트 후 조회 실패" });
    }

    console.log(`[프로필 완성] 사용자 정보 업데이트 성공: ID=${userId}, 전화번호=${phoneNumber}, 병원=${hospitalId}, needProfileComplete=${updatedUser.needProfileComplete}`);

    // 세션 상태 강제 갱신 (직접 할당)
    if (req.session.user) {
      // 세션에 명시적으로 설정
      req.session.user = {
        ...req.session.user,
        displayName,
        nickname,
        memberType,
        phoneNumber,
        hospitalId: memberType === "membership" ? parseInt(hospitalId) : null,
        birthdate,
        needProfileComplete: false
      };
    }

    // req.user 객체도 업데이트 (Passport 사용자 객체)
    if (req.user && typeof req.user === 'object') {
      // 대체하지 말고 속성만 업데이트
      (req.user as any).needProfileComplete = false;
      (req.user as any).fullName = displayName;
      (req.user as any).username = nickname;
      (req.user as any).memberType = memberType;
      (req.user as any).phoneNumber = phoneNumber;
      (req.user as any).hospitalId = memberType === "membership" ? parseInt(hospitalId) : null;
      (req.user as any).birthdate = birthdate;
    }

    // Passport 세션 객체 강제 갱신
    if (req.session.passport) {
      req.session.passport = { user: userId };
    }

    // 세션 사용자 정보 명시적 갱신
    if (req.session.user) {
      req.session.user = {
        ...(req.session.user || {}),
        phoneNumber,
        hospitalId: memberType === "membership" ? parseInt(hospitalId) : null,
        dueDate,
        needProfileComplete: false
      };
    }

    // Passport 사용자도 다시 로그인 시켜 세션에 재등록
    req.login(updatedUser, (loginErr) => {
      if (loginErr) {
        console.error("재로그인 실패:", loginErr);
      } else {
        console.log("[프로필 완성] 재로그인 성공:", updatedUser.id);
      }
    });

    // 쿠키 명시적으로 설정 (모바일 호환성)
    res.cookie("connect.sid", req.sessionID, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    // 세션 저장 (비동기)
    req.session.save((saveErr) => {
      if (saveErr) {
        console.error("[Complete Profile] 세션 저장 오류:", saveErr);
        // 세션 저장 실패해도 DB는 업데이트되었으므로 성공 응답
      }

      console.log("[프로필 완성] 세션 저장 완료");
    });

    // 즉시 성공 응답 반환
    return res.status(200).json({
      message: "프로필 정보가 성공적으로 저장되었습니다.",
      success: true,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        username: updatedUser.username, // 닉네임
        memberType: updatedUser.memberType,
        phoneNumber: updatedUser.phoneNumber,
        hospitalId: updatedUser.hospitalId,
        birthdate: updatedUser.birthdate,
        dueDate: updatedUser.dueDate,
        needProfileComplete: false
      }
    });
  } catch (error) {
    console.error("[Complete Profile] 오류:", error);
    return res.status(500).json({
      message: "사용자 정보 업데이트 중 오류가 발생했습니다.",
      details: error instanceof Error ? error.message : "알 수 없는 오류"
    });
  }
});

// 중복 라우트 제거됨 - 하단의 통합 /me 엔드포인트 사용

// 관리자 역할 확인 API (세션 기반)
router.get("/admin-check", (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "로그인이 필요합니다." });
  }

  // 사용자의 역할이나 memberType을 확인
  const user = req.user as any;
  const isAdmin =
    user.memberType === "admin" ||
    user.memberType === "superadmin" ||
    (user.roles &&
      user.roles.some((role: string) =>
        ["admin", "superadmin"].includes(role),
      ));

  if (!isAdmin) {
    return res.status(403).json({ message: "관리자 권한이 필요합니다." });
  }

  return res.json({ isAdmin: true });
});

// Firebase 로그인 API (작업지시서 방식 - ID 토큰 검증)
router.post("/firebase-login", async (req, res) => {
  try {
    console.log('🔥 Firebase 로그인 요청 받음:', Object.keys(req.body));

    // 작업지시서에 따라 ID 토큰만 추출
    const { idToken } = req.body;

    if (!idToken) {
      console.log('❌ ID 토큰 없음');
      return res.status(400).json({ error: "ID 토큰이 필요합니다." });
    }

    console.log('🎫 ID 토큰 수신 완료:', idToken.substring(0, 50) + '...');

    // Firebase Admin SDK로 ID 토큰 검증 (이미 초기화된 인스턴스 사용)
    try {

      // ID 토큰 검증
      const decodedToken = await firebaseAuth.verifyIdToken(idToken);
      const { uid, email, name } = decodedToken;

      console.log('👤 토큰에서 추출된 사용자 정보:', { uid, email, name });

      if (!uid || !email) {
        throw new Error('토큰에서 필수 정보를 찾을 수 없습니다.');
      }

      // 사용자 DB에서 조회 또는 생성
      let user = await db.query.users.findFirst({
        where: eq(users.firebaseUid, uid)
      });

      if (!user) {
        // 새 사용자 생성
        console.log('👤 새 사용자 생성:', email);
        const [newUser] = await db.insert(users).values({
          firebaseUid: uid,
          email,
          username: email.split('@')[0],
          fullName: name || email.split('@')[0],
          memberType: "general",
          needProfileComplete: true
        }).returning();

        user = newUser;
      }

      console.log('✅ 사용자 정보 확인 완료:', user.id);

      // 세션에 사용자 정보 저장
      req.session.passport = { user: user.id };
      req.session.userId = user.id;
      req.session.firebaseUid = uid;
      req.session.userEmail = email;
      req.session.userRole = user.memberType ? user.memberType : undefined;

      // 세션 저장 보장
      req.session.save((saveError) => {
        if (saveError) {
          console.error('💥 세션 저장 오류:', saveError);
          return res.status(500).json({ error: "세션 저장 중 오류가 발생했습니다." });
        }

        console.log('✅ 로그인 성공, 세션 저장 완료');

        return res.json({
          token: 'session-based', // 세션 기반이므로 토큰 불필요
          uid,
          email,
          user: {
            id: user.id,
            email: user.email,
            fullName: user.fullName,
            memberType: user.memberType,
            needProfileComplete: user.needProfileComplete
          }
        });
      });

    } catch (decodeError) {
      console.error('💥 토큰 디코딩 오류:', decodeError);
      return res.status(401).json({ error: "Invalid token" });
    }

  } catch (error) {
    console.error('💥 Firebase 로그인 오류:', error);
    return res.status(500).json({ error: "로그인 처리 중 오류가 발생했습니다." });
  }
});
// 회원가입용 공개 병원 목록 API
router.get("/public/hospitals", async (req: Request, res: Response) => {
  try {
    const hospitalsList = await db.query.hospitals.findMany({
      where: eq(hospitals.isActive, true),
      orderBy: (hospitals, { asc }) => [asc(hospitals.name)]
    });

    res.json(hospitalsList);
  } catch (error) {
    console.error("Error fetching public hospitals:", error);
    res.status(500).json({ error: "Failed to fetch hospitals" });
  }
});

// JWT 기반 사용자 정보 반환 API (requireAuth 미들웨어 사용)
router.get("/me", async (req: Request, res: Response) => {
  try {
    let userId: number | null = null;

    // 디버그 로그
    console.log("[/api/auth/me] 요청 받음");
    console.log("[/api/auth/me] req.isAuthenticated():", req.isAuthenticated());
    console.log("[/api/auth/me] req.user:", req.user);
    // 🚨 보안: 민감한 세션 정보 로깅 제거 (PII 및 식별자 노출 방지)

    // 1. 세션 기반 인증 확인 (우선순위)
    if (req.isAuthenticated() && req.user) {
      userId = (req.user as any).id;
      console.log("[/api/auth/me] 세션 인증 성공, userId:", userId);
    }

    // 2. JWT 토큰 인증 확인 (세션이 없는 경우)
    if (!userId) {
      // 쿠키에서 JWT 토큰 확인 (우선순위)
      let token = req.cookies?.auth_token;

      // Authorization 헤더에서 JWT 토큰 확인 (대안)
      if (!token) {
        const authHeader = req.headers.authorization;
        console.log("[/api/auth/me] JWT 헤더:", authHeader);
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (token) {
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
          userId = decoded.userId || decoded.id;
          console.log("[/api/auth/me] JWT 인증 성공, userId:", userId);
        } catch (jwtError: any) {
          console.log("[/api/auth/me] JWT 검증 실패:", jwtError);

          // JWT 만료된 경우 자동 갱신 시도
          if (jwtError.name === 'TokenExpiredError') {
            try {
              const decoded = jwt.decode(token) as any;
              if (decoded && decoded.userId) {
                // 사용자 정보 조회 후 완전한 JWT 토큰 생성
                const userForToken = await db.query.users.findFirst({
                  where: eq(users.id, decoded.userId)
                });

                if (userForToken) {
                  const newToken = generateToken(userForToken);

                  // 새 토큰을 쿠키에 설정
                  res.cookie('auth_token', newToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 24 * 60 * 60 * 1000 // 24시간
                  });
                } else {
                  console.log("[/api/auth/me] 사용자 조회 실패 - JWT 갱신 중단");
                }

                userId = decoded.userId;
                console.log("[/api/auth/me] JWT 자동 갱신 성공, userId:", userId);
              }
            } catch (refreshError) {
              console.log("[/api/auth/me] JWT 자동 갱신 실패:", refreshError);
            }
          }
        }
      }
    }

    if (!userId) {
      console.log("[/api/auth/me] 인증 실패, 401 반환");
      return res.status(401).json({
        success: false,
        message: "인증 토큰이 없습니다"
      });
    }

    // 데이터베이스에서 최신 사용자 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId)
    });

    // 병원 정보를 별도로 조회
    let hospitalInfo = null;
    if (user && user.hospitalId) {
      try {
        const hospital = await db.query.hospitals.findFirst({
          where: eq(hospitals.id, user.hospitalId)
        });
        if (hospital && hospital.isActive === true) {
          hospitalInfo = {
            id: hospital.id,
            name: hospital.name
          };
        }
      } catch (hospitalError) {
        console.error("병원 정보 조회 오류:", hospitalError);
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "사용자 계정이 존재하지 않습니다"
      });
    }

    // 디버깅 로그 추가
    console.log(`[/api/auth/me] 사용자 ${user.username} (ID: ${user.id}) 병원 정보:`, {
      hospitalId: user.hospitalId,
      hospitalInfoReturned: hospitalInfo
    });

    // Firebase Custom Token 생성 (Direct Upload용) - 통합된 firebase.ts 인스턴스 사용
    let firebaseToken: string | undefined;
    if (process.env.ENABLE_FIREBASE_DIRECT_UPLOAD === 'true') {
      try {
        firebaseToken = await firebaseAuth.createCustomToken(String(user.id));
        console.log(`[Firebase Token] 사용자 ${user.id}에 대한 토큰 생성 완료`);
      } catch (firebaseError) {
        console.error('[Firebase Token] 생성 실패:', firebaseError);
        // Firebase 토큰 생성 실패는 치명적이지 않으므로 계속 진행
      }
    }

    // 응답 형식 통일
    const responseData: any = {
      success: true,
      user: {
        id: user.id,
        userId: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        memberType: user.memberType,
        hospitalId: user.hospitalId,
        hospital: hospitalInfo
      }
    };

    // Firebase 토큰이 생성되었으면 응답에 포함
    if (firebaseToken) {
      responseData.firebaseToken = firebaseToken;
      console.log(`[Firebase Token] 응답에 포함됨`);
    }

    console.log(`[/api/auth/me] 응답 데이터:`, { userId: responseData.user.id, email: responseData.user.email, memberType: responseData.user.memberType });

    // 캐싱 비활성화 - 304 응답 방지 (memberType이 undefined가 되는 문제 해결)
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    res.json(responseData);

  } catch (error) {
    console.error("[/api/auth/me] 사용자 정보 조회 실패:", error);
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다"
    });
  }
});

// 🔧 JWT 토큰 갱신 API (관리자 권한 문제 해결)
router.post("/refresh-token", async (req: Request, res: Response) => {
  try {
    console.log("[JWT 갱신] JWT 토큰 갱신 요청");

    // 현재 토큰에서 사용자 ID 추출
    const currentToken = req.cookies?.auth_token;
    if (!currentToken) {
      return res.status(401).json({
        success: false,
        message: "현재 토큰이 없습니다"
      });
    }

    let userId;
    try {
      const decoded = jwt.verify(currentToken, JWT_SECRET!) as any;
      userId = decoded.userId || decoded.id;
    } catch (err) {
      return res.status(401).json({
        success: false,
        message: "유효하지 않은 토큰입니다"
      });
    }

    // 데이터베이스에서 최신 사용자 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다"
      });
    }

    // 새로운 JWT 토큰 생성 (generateToken 함수 사용)
    const newToken = generateToken(user);

    // 새 토큰을 쿠키에 설정
    res.cookie("auth_token", newToken, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000, // 24시간
    });

    console.log(`[JWT 갱신] 성공 - 사용자 ID: ${user.id}, 권한: ${user.memberType}`);

    res.json({
      success: true,
      message: "토큰이 성공적으로 갱신되었습니다",
      user: {
        id: user.id,
        userId: user.id,
        email: user.email,
        username: user.username,
        memberType: user.memberType,
        hospitalId: user.hospitalId
      }
    });

  } catch (error) {
    console.error("[JWT 갱신] 토큰 갱신 실패:", error);
    res.status(500).json({
      success: false,
      message: "토큰 갱신 중 오류가 발생했습니다"
    });
  }
});

// 🔧 세션 기반 사용자 정보 반환 API (새로 추가)
router.get("/session-me", async (req: Request, res: Response) => {
  try {
    // 세션에서 사용자 정보 확인
    if (!req.session?.user) {
      return res.status(401).json({
        success: false,
        message: '로그인되어 있지 않습니다.'
      });
    }

    const sessionUser = req.session.user;
    console.log('[세션 기반 인증] 세션 사용자:', sessionUser);

    // 데이터베이스에서 최신 사용자 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, sessionUser.id),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "사용자 계정이 존재하지 않습니다"
      });
    }

    // 응답 형식 통일
    res.json({
      success: true,
      user: {
        userId: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        memberType: user.memberType
      }
    });

  } catch (error) {
    console.error("[/api/auth/session-me] 세션 기반 사용자 정보 조회 실패:", error);
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다"
    });
  }
});

// Health Check 엔드포인트 추가
router.get('/health', async (req, res) => {
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'unknown',
        topMediai: 'unknown',
        storage: 'unknown'
      },
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    };

    // 데이터베이스 상태 확인
    try {
      await db.query.users.findFirst();
      healthStatus.services.database = 'healthy';
    } catch (dbError) {
      healthStatus.services.database = 'error';
      healthStatus.status = 'degraded';
    }

    // TopMediai 서비스 상태 확인
    try {
      const { musicEngineService } = await import('../services/music-engine-service');
      const systemStatus = await musicEngineService.getSystemStatus();
      healthStatus.services.topMediai = systemStatus.topmedia.enabled ? 'healthy' : 'error';
    } catch (topMediaError) {
      healthStatus.services.topMediai = 'error';
      healthStatus.status = 'degraded';
    }

    // GCS 스토리지 상태 확인
    try {
      if (process.env.FB_PROJECT_ID && process.env.FB_PRIVATE_KEY) {
        healthStatus.services.storage = 'healthy';
      } else {
        healthStatus.services.storage = 'misconfigured';
      }
    } catch (storageError) {
      healthStatus.services.storage = 'error';
      healthStatus.status = 'degraded';
    }

    // 전체 상태 결정
    const hasErrors = Object.values(healthStatus.services).some(status => status === 'error');
    if (hasErrors) {
      healthStatus.status = 'degraded';
    }

    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    res.status(statusCode).json(healthStatus);

  } catch (error) {
    console.error('[Health Check] 시스템 상태 확인 실패:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

// 비밀번호 재설정 요청 API
router.post("/forgot-password", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email || !isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "유효한 이메일 주소를 입력해주세요."
      });
    }

    // 사용자 확인
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    // 보안상 이메일 존재 여부를 직접 알려주지 않음
    if (!user) {
      console.log(`비밀번호 재설정 요청 - 존재하지 않는 이메일: ${email}`);
      return res.json({
        success: true,
        message: "이메일이 등록되어 있다면 비밀번호 재설정 링크를 발송했습니다."
      });
    }

    // 기존 토큰 무효화
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(passwordResetTokens.userId, user.id),
        sql`${passwordResetTokens.usedAt} IS NULL`
      ));

    // 새 토큰 생성
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후 만료

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt
    });

    // 재설정 URL 생성 - PRODUCTION_DOMAIN 환경변수 사용
    const productionDomain = process.env.PRODUCTION_DOMAIN;
    const baseUrl = productionDomain
      ? productionDomain
      : `http://localhost:${process.env.PORT || 5000}`;
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    // 이메일 발송
    try {
      await sendPasswordResetEmail(user.email!, resetUrl, '1시간');
      console.log(`비밀번호 재설정 이메일 발송 성공: ${user.email}`);
    } catch (emailError) {
      console.error('이메일 발송 실패:', emailError);
      // 이메일 발송 실패해도 성공 응답 (보안상)
    }

    res.json({
      success: true,
      message: "이메일이 등록되어 있다면 비밀번호 재설정 링크를 발송했습니다."
    });

  } catch (error) {
    console.error('비밀번호 재설정 요청 오류:', error);
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
    });
  }
});

// 아이디(이메일) 찾기 API
router.post("/find-email", async (req: Request, res: Response) => {
  try {
    const { fullName, phoneNumber } = req.body;

    if (!fullName || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "이름과 전화번호를 모두 입력해주세요."
      });
    }

    // 사용자 찾기
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.fullName, fullName),
        eq(users.phoneNumber, phoneNumber)
      )
    });

    if (!user) {
      // 보안상 찾지 못해도 동일한 응답
      return res.json({
        success: true,
        email: null
      });
    }

    // 이메일 마스킹 처리
    const email = user.email;
    if (!email) {
      return res.json({
        success: true,
        email: null
      });
    }

    const [localPart, domain] = email.split('@');
    const maskedLocal = localPart.length > 3
      ? localPart.substring(0, 3) + '****'
      : localPart.substring(0, 1) + '****';
    const maskedEmail = `${maskedLocal}@${domain}`;

    return res.json({
      success: true,
      email: maskedEmail
    });

  } catch (error) {
    console.error('아이디 찾기 오류:', error);
    return res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// 비밀번호 재설정 토큰 검증 API
router.get("/reset-password/verify", async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        message: "유효하지 않은 토큰입니다."
      });
    }

    // 토큰 확인
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, token),
        sql`${passwordResetTokens.usedAt} IS NULL`,
        sql`${passwordResetTokens.expiresAt} > ${new Date()}`
      )
    });

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: "만료되었거나 유효하지 않은 토큰입니다."
      });
    }

    res.json({
      success: true,
      message: "유효한 토큰입니다."
    });

  } catch (error) {
    console.error('토큰 검증 오류:', error);
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// 비밀번호 재설정 API
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "필수 정보가 누락되었습니다."
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "비밀번호는 최소 6자 이상이어야 합니다."
      });
    }

    // 토큰 확인
    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: and(
        eq(passwordResetTokens.token, token),
        sql`${passwordResetTokens.usedAt} IS NULL`,
        sql`${passwordResetTokens.expiresAt} > ${new Date()}`
      )
    });

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: "만료되었거나 유효하지 않은 토큰입니다."
      });
    }

    // 사용자 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, resetToken.userId)
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "사용자를 찾을 수 없습니다."
      });
    }

    // 비밀번호 해시화
    const hashedPassword = await hashPassword(newPassword);

    // 비밀번호 업데이트
    await db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, resetToken.userId));

    // 토큰 사용 처리
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, resetToken.id));

    // 성공 이메일 발송
    try {
      if (user.email) {
        await sendPasswordResetSuccessEmail(user.email);
      }
    } catch (emailError) {
      console.error('성공 이메일 발송 실패:', emailError);
      // 이메일 실패해도 비밀번호는 변경됨
    }

    res.json({
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다."
    });

  } catch (error) {
    console.error('비밀번호 재설정 오류:', error);
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다."
    });
  }
});

// ===== routes.ts에서 이동된 auth 관련 라우트들 =====

// [LEGACY] 프로필 업데이트 (레거시)
router.put("/profile-legacy", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { fullName, email, phoneNumber, dueDate, birthdate } = req.body;

    // 이메일 중복 체크 (다른 사용자가 사용 중인지 확인)
    if (email) {
      const existingUser = await db.query.users.findFirst({
        where: (users, { eq, and, ne }) => and(eq(users.email, email), ne(users.id, userId))
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "이미 사용 중인 이메일입니다."
        });
      }
    }

    // 사용자 정보 업데이트
    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (email !== undefined) updateData.email = email;
    if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (birthdate !== undefined) updateData.birthdate = birthdate ? new Date(birthdate) : null;
    updateData.updatedAt = new Date();

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, Number(userId)))
      .returning();

    res.json({
      success: true,
      message: "프로필이 업데이트되었습니다.",
      user: updatedUser
    });
  } catch (error) {
    console.error("프로필 업데이트 오류:", error);
    res.status(500).json({
      success: false,
      message: "프로필 업데이트 중 오류가 발생했습니다."
    });
  }
});

// [PUBLIC] Change password - requires authentication
router.put("/change-password", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const { currentPassword, newPassword } = req.body;

    // 현재 사용자 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(userId))
    });

    if (!user || !user.password) {
      return res.status(400).json({
        success: false,
        message: "비밀번호를 변경할 수 없습니다. 소셜 로그인 계정입니다."
      });
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: "현재 비밀번호가 올바르지 않습니다."
      });
    }

    // 새 비밀번호 해시화
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // 비밀번호 업데이트
    await db
      .update(users)
      .set({
        password: hashedNewPassword,
        updatedAt: new Date()
      })
      .where(eq(users.id, Number(userId)));

    res.json({
      success: true,
      message: "비밀번호가 성공적으로 변경되었습니다."
    });
  } catch (error) {
    console.error("비밀번호 변경 오류:", error);
    res.status(500).json({
      success: false,
      message: "비밀번호 변경 중 오류가 발생했습니다."
    });
  }
});

// [PUBLIC] Get notification settings - requires authentication
router.get("/notification-settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // 알림 설정이 있는지 확인, 없으면 기본값으로 생성
    let settings = await db.query.userNotificationSettings?.findFirst({
      where: eq(userNotificationSettings.userId, userId)
    });

    if (!settings) {
      // 기본 설정으로 생성
      const [newSettings] = await db.insert(userNotificationSettings).values({
        userId,
        emailNotifications: true,
        pushNotifications: true,
        pregnancyReminders: true,
        weeklyUpdates: true,
        promotionalEmails: false,
      }).returning();
      settings = newSettings;
    }

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error("알림 설정 조회 오류:", error);
    res.status(500).json({
      success: false,
      message: "알림 설정을 불러오는 중 오류가 발생했습니다."
    });
  }
});

// 알림 설정 업데이트 API
router.put("/notification-settings", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;
    const {
      emailNotifications,
      pushNotifications,
      pregnancyReminders,
      weeklyUpdates,
      promotionalEmails
    } = req.body;

    // 기존 설정 확인
    const existingSettings = await db.query.userNotificationSettings?.findFirst({
      where: eq(userNotificationSettings.userId, userId)
    });

    if (existingSettings) {
      // 업데이트
      const [updatedSettings] = await db
        .update(userNotificationSettings)
        .set({
          emailNotifications,
          pushNotifications,
          pregnancyReminders,
          weeklyUpdates,
          promotionalEmails,
          updatedAt: new Date()
        })
        .where(eq(userNotificationSettings.userId, userId))
        .returning();

      res.json({
        success: true,
        message: "알림 설정이 업데이트되었습니다.",
        settings: updatedSettings
      });
    } else {
      // 새로 생성
      const [newSettings] = await db.insert(userNotificationSettings).values({
        userId,
        emailNotifications,
        pushNotifications,
        pregnancyReminders,
        weeklyUpdates,
        promotionalEmails,
      }).returning();

      res.json({
        success: true,
        message: "알림 설정이 생성되었습니다.",
        settings: newSettings
      });
    }
  } catch (error) {
    console.error("알림 설정 업데이트 오류:", error);
    res.status(500).json({
      success: false,
      message: "알림 설정 업데이트 중 오류가 발생했습니다."
    });
  }
});

// 이메일 인증 발송 API
router.post("/send-verification-email", requireAuth, async (req, res) => {
  try {
    const userId = (req as any).user.id;

    // 사용자 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, Number(userId))
    });

    if (!user || !user.email) {
      return res.status(400).json({
        success: false,
        message: "이메일 정보를 찾을 수 없습니다."
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: "이미 인증된 이메일입니다."
      });
    }

    // 보안을 위한 인증 토큰 32바이트 생성
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24시간 후 만료

    // 이전에 발송된 미사용 토큰들 만료 처리 로직 (선택적 최적화)
    await db.update(emailVerificationTokens)
      .set({ usedAt: new Date() }) // 명시적 폐기
      .where(and(
        eq(emailVerificationTokens.userId, user.id),
        sql`${emailVerificationTokens.usedAt} IS NULL`
      ));

    // 새 토큰 저장
    await db.insert(emailVerificationTokens).values({
      userId: user.id,
      token,
      expiresAt
    });

    // 인증 링크 생성
    const protocol = req.protocol === 'https' ? 'https' : (req.headers['x-forwarded-proto'] || 'http');
    const host = req.get('host');
    const verifyUrl = `${protocol}://${host}/verify-email?token=${token}`;

    // 이메일 발송
    await sendVerificationEmail(user.email, verifyUrl);

    res.json({
      success: true,
      message: "인증 이메일이 발송되었습니다."
    });
  } catch (error) {
    console.error("이메일 인증 발송 오류:", error);
    res.status(500).json({
      success: false,
      message: "이메일 발송 중 오류가 발생했습니다."
    });
  }
});

// 이메일 인증 검증 API
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "유효하지 않은 인증 요청입니다. (토큰 누락)"
      });
    }

    // 토큰 조회
    const verificationRecord = await db.query.emailVerificationTokens.findFirst({
      where: and(
        eq(emailVerificationTokens.token, token),
        sql`${emailVerificationTokens.usedAt} IS NULL`
      )
    });

    if (!verificationRecord) {
      return res.status(400).json({
        success: false,
        message: "유효하지 않거나 이미 사용된 인증 링크입니다."
      });
    }

    if (new Date() > new Date(verificationRecord.expiresAt)) {
      return res.status(400).json({
        success: false,
        message: "만료된 인증 링크입니다. 인증 이메일을 다시 요청해주세요."
      });
    }

    // 인증 처리 완료
    await db.update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, verificationRecord.userId));

    // 토큰 사용 처리
    await db.update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(eq(emailVerificationTokens.id, verificationRecord.id));

    res.json({
      success: true,
      message: "이메일 인증이 완료되었습니다."
    });
  } catch (error) {
    console.error("이메일 인증 검증 오류:", error);
    res.status(500).json({
      success: false,
      message: "이메일 인증 검증 중 오류가 발생했습니다."
    });
  }
});

// 병원 코드 검증 API
router.post("/verify-hospital-code", async (req, res) => {
  try {
    const { hospitalId, code } = req.body;

    if (!hospitalId || !code) {
      return res.status(400).json({
        valid: false,
        message: "병원과 인증코드를 모두 입력해주세요"
      });
    }

    // 코드 조회 및 검증
    const hospitalCode = await db.select()
      .from(hospitalCodes)
      .where(and(
        eq(hospitalCodes.hospitalId, parseInt(hospitalId)),
        eq(hospitalCodes.code, code),
        eq(hospitalCodes.isActive, true)
      ))
      .limit(1);

    if (!hospitalCode.length) {
      return res.status(400).json({
        valid: false,
        message: "유효하지 않은 인증코드입니다"
      });
    }

    const codeData = hospitalCode[0];

    // 만료일 체크
    if (codeData.expiresAt && new Date() > new Date(codeData.expiresAt)) {
      return res.status(400).json({
        valid: false,
        message: "만료된 인증코드입니다"
      });
    }

    // 인원 제한 체크 (limited, qr_limited 타입)
    if ((codeData.codeType === 'limited' || codeData.codeType === 'qr_limited') &&
      codeData.maxUsage && codeData.currentUsage >= codeData.maxUsage) {
      return res.status(400).json({
        valid: false,
        message: "인증코드 사용 인원이 마감되었습니다"
      });
    }

    // 사용 가능한 경우 남은 자리 수 계산
    let remainingSlots: number | undefined;
    if (codeData.maxUsage) {
      remainingSlots = codeData.maxUsage - codeData.currentUsage;
    }

    return res.status(200).json({
      valid: true,
      message: "유효한 인증코드입니다",
      remainingSlots,
      codeType: codeData.codeType
    });

  } catch (error) {
    console.error('코드 검증 오류:', error);
    return res.status(500).json({
      valid: false,
      message: "코드 검증 중 오류가 발생했습니다"
    });
  }
});

// 이메일 인증 확인 API
router.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "인증 토큰이 필요합니다."
      });
    }

    // 실제 토큰 검증 로직은 이메일 서비스 설정이 필요합니다
    // 현재는 기본 구현만 제공
    console.log(`이메일 인증 토큰: ${token}`);

    return res.json({
      success: true,
      message: "이메일이 성공적으로 인증되었습니다."
    });
  } catch (error) {
    console.error("이메일 인증 확인 오류:", error);
    return res.status(500).json({
      success: false,
      message: "이메일 인증 중 오류가 발생했습니다."
    });
  }
});

export default router;