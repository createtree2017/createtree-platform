import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

export interface RecoveryUser {
  id: number;
  isDeleted?: boolean | null;
  hospitalId?: number | null;
  memberType?: string | null;
}

interface RecoveryDependencies<T extends RecoveryUser> {
  secret: string;
  findUser: (id: number) => Promise<T | undefined>;
  refreshAccessToken: (token: string) => Promise<string | null>;
  generateToken: (user: T) => string;
}

export function authCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' || process.env.PROTOCOL === 'https',
    sameSite: 'lax' as const,
    path: '/',
  };
}

export function setAccessCookie(res: Response, token: string) {
  res.cookie('auth_token', token, { ...authCookieOptions(), maxAge: 6 * 60 * 60 * 1000 });
  res.set('Cache-Control', 'no-store');
}

// 의존성 주입으로 실제 DB/운영 계정 없이 인증 경계를 검증한다.
export function createAuthRecovery<T extends RecoveryUser>(deps: RecoveryDependencies<T>) {
  return async (req: Request, forceRefresh = false): Promise<{ user: T; accessToken?: string } | null> => {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7) : undefined;
    const token = req.cookies?.auth_token || bearer;
    let claims: jwt.JwtPayload | undefined;
    if (token) {
      try {
        const verified = jwt.verify(token, deps.secret);
        if (typeof verified !== 'string') claims = verified;
      } catch { /* 만료/잘못된 JWT는 갱신 자격으로 사용하지 않는다. */ }
    }

    // Google OAuth는 session.user, 일반 로그인은 Passport를 사용한다.
    const sessionId = req.isAuthenticated?.()
      ? (req.user as { id?: number } | undefined)?.id
      : req.session?.user?.id;
    const validTokenId = claims?.userId || claims?.id;
    let userId = sessionId || (!forceRefresh ? validTokenId : undefined);
    let accessToken: string | undefined;

    if (!userId && req.cookies?.refreshToken) {
      const renewed = await deps.refreshAccessToken(req.cookies.refreshToken);
      if (renewed) {
        const verified = jwt.verify(renewed, deps.secret) as jwt.JwtPayload;
        userId = verified.userId || verified.id;
        accessToken = renewed;
      }
    }
    if (!Number.isInteger(userId) || userId <= 0) return null;

    const user = await deps.findUser(userId);
    if (!user || user.isDeleted) return null;

    const claimsOutdated = validTokenId !== user.id ||
      claims?.hospitalId !== user.hospitalId || claims?.memberType !== user.memberType;
    if (sessionId && (forceRefresh || !claims || claimsOutdated)) {
      accessToken = deps.generateToken(user);
    } else if (!accessToken && claims && claimsOutdated && typeof claims.exp === 'number') {
      // 세션이 없어도 변경된 소속/권한은 반영하되, JWT만으로 만료 기간을 늘리지는 않는다.
      const updated = jwt.verify(deps.generateToken(user), deps.secret) as jwt.JwtPayload;
      accessToken = jwt.sign({ ...updated, exp: claims.exp }, deps.secret);
    }
    return { user, accessToken };
  };
}

export function createRefreshHandler(recover: ReturnType<typeof createAuthRecovery>) {
  return async (req: Request, res: Response) => {
    res.set('Cache-Control', 'no-store');
    try {
      const recovered = await recover(req, true);
      if (!recovered?.accessToken) {
        return res.status(401).json({ message: '로그인이 만료되었습니다. 다시 로그인해주세요.' });
      }
      setAccessCookie(res, recovered.accessToken);
      return res.json({ success: true, accessToken: recovered.accessToken });
    } catch {
      console.error('[인증 갱신] 처리 실패');
      return res.status(503).json({ message: '로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
  };
}
