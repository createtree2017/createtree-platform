/**
 * 개발 전용 자동 로그인 엔드포인트
 * - NODE_ENV !== 'production' 환경에서만 활성화
 * - 브라우저에서 /api/dev/auto-login 접속 시 테스트 계정으로 자동 로그인
 * - AI 에이전트 브라우저 테스트 시 로그인 문제 해결용
 */
import { Router, Request, Response } from "express";
import { db } from "@db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import { generateToken, sanitizeUser } from "../services/auth";

const router = Router();

// 개발 전용 자동 로그인 (GET으로 브라우저 URL 접속만으로 로그인 가능)
router.get("/auto-login", async (req: Request, res: Response) => {
  try {
    // 관리자 계정 또는 첫 번째 사용자 계정으로 자동 로그인
    const adminUser = await db.query.users.findFirst({
      where: eq(users.memberType, "admin"),
    });

    const targetUser = adminUser || await db.query.users.findFirst();

    if (!targetUser) {
      return res.status(404).json({ message: "테스트용 사용자가 없습니다." });
    }

    // Passport 세션 로그인 처리
    req.login(targetUser, (loginErr) => {
      if (loginErr) {
        console.error("[dev-login] 로그인 오류:", loginErr);
        return res.status(500).json({ message: "로그인 처리 실패" });
      }

      // 세션 저장
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error("[dev-login] 세션 저장 오류:", saveErr);
          return res.status(500).json({ message: "세션 저장 실패" });
        }

        // JWT 토큰 생성
        const jwtToken = generateToken({
          id: targetUser.id,
          userId: targetUser.id,
          email: targetUser.email,
          memberType: targetUser.memberType,
          hospitalId: targetUser.hospitalId,
          username: targetUser.username,
          roles: [],
        });

        // 쿠키 설정 (로컬 개발이므로 secure: false)
        res.cookie("connect.sid", req.sessionID, {
          httpOnly: true,
          secure: false,
          maxAge: 7 * 24 * 60 * 60 * 1000,
          sameSite: "lax",
          path: "/",
        });

        res.cookie("auth_token", jwtToken, {
          httpOnly: true,
          secure: false,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: "lax",
          path: "/",
        });

        res.cookie("auth_status", "logged_in", {
          httpOnly: false,
          secure: false,
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: "lax",
          path: "/",
        });

        const sanitized = sanitizeUser(targetUser);

        console.log(`[dev-login] 자동 로그인 성공: ${sanitized.username} (ID: ${sanitized.id})`);

        // JSON 응답 (API 호출 시)
        if (req.headers.accept?.includes("application/json")) {
          return res.json({
            message: "개발 자동 로그인 성공",
            user: sanitized,
          });
        }

        // 브라우저 직접 접속 시 메인 페이지로 리다이렉트
        return res.redirect("/");
      });
    });
  } catch (error) {
    console.error("[dev-login] 오류:", error);
    res.status(500).json({ message: "자동 로그인 실패" });
  }
});

// 로그인 상태 확인 (디버깅용)
router.get("/auth-status", (req: Request, res: Response) => {
  res.json({
    isAuthenticated: req.isAuthenticated(),
    user: req.user ? sanitizeUser(req.user as any) : null,
    sessionId: req.sessionID,
  });
});

export default router;
