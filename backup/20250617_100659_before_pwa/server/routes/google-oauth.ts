import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '@db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// Google OAuth2 설정
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

console.log('🔐 Google OAuth2 설정 확인:', {
  CLIENT_ID: GOOGLE_CLIENT_ID ? '설정됨' : '없음',
  CLIENT_SECRET: GOOGLE_CLIENT_SECRET ? '설정됨' : '없음'
});

/**
 * 동적 리디렉션 URI 생성 함수
 * @param req Express Request 객체
 * @returns 동적으로 생성된 리디렉션 URI
 */
function getRedirectUri(req: any): string {
  // Replit 환경에서는 항상 HTTPS 강제 적용
  const host = req.get("host");
  const baseUrl = `https://${host}`;
  return `${baseUrl}/api/google-oauth/callback`;
}

/**
 * Google OAuth2 로그인 URL 생성
 * GET /api/google-oauth/login
 */
router.get('/login', (req, res) => {
  try {
    if (!GOOGLE_CLIENT_ID) {
      return res.status(500).json({ 
        success: false, 
        message: 'Google OAuth2 클라이언트 ID가 설정되지 않았습니다.' 
      });
    }

    // 동적 리디렉션 URI 생성
    const redirectUri = getRedirectUri(req);
    
    console.log('🔍 동적 redirect_uri:', redirectUri);
    
    // Google OAuth2 인증 URL 생성 (동적 URI 적용)
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    googleAuthUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    googleAuthUrl.searchParams.append('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.append('response_type', 'code');
    googleAuthUrl.searchParams.append('scope', 'openid email profile');
    googleAuthUrl.searchParams.append('prompt', 'consent'); // 권한 동의 강제 요청

    console.log('[Google OAuth] 로그인 URL 생성:', googleAuthUrl.toString());

    // JSON 응답으로 URL 반환 (프레임 차단 문제 해결)
    res.json({
      success: true,
      authUrl: googleAuthUrl.toString(),
      message: 'Google 인증 URL이 생성되었습니다.'
    });
  } catch (error) {
    console.error('[Google OAuth] 로그인 URL 생성 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인 URL 생성에 실패했습니다.'
    });
  }
});

/**
 * Google OAuth2 콜백 처리
 * GET /api/google-oauth/callback?code=...
 */
router.get('/callback', async (req, res) => {
  try {
    const { code } = req.query;

    if (!code) {
      console.error('[Google OAuth] 콜백 - 인증 코드 없음');
      return res.status(400).json({
        success: false,
        message: '인증 코드가 제공되지 않았습니다.'
      });
    }

    console.log('[Google OAuth] 콜백 처리 시작 - 코드:', typeof code === 'string' ? code.substring(0, 20) + '...' : code);

    // 동적 리디렉션 URI 생성 (콜백에서도 동일하게)
    const redirectUri = getRedirectUri(req);
    console.log('🔍 콜백 redirect_uri:', redirectUri);

    // 1. Access Token 요청
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID!,
        client_secret: GOOGLE_CLIENT_SECRET!,
        code: code as string,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Google OAuth] 토큰 요청 실패:', errorText);
      return res.status(400).json({
        success: false,
        message: 'Google 토큰 요청에 실패했습니다.'
      });
    }

    const tokenData = await tokenResponse.json();
    console.log('[Google OAuth] 토큰 요청 성공');

    // 2. 사용자 정보 요청
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    if (!userResponse.ok) {
      console.error('[Google OAuth] 사용자 정보 요청 실패');
      return res.status(400).json({
        success: false,
        message: 'Google 사용자 정보 요청에 실패했습니다.'
      });
    }

    const googleUser = await userResponse.json();
    console.log('[Google OAuth] 사용자 정보 조회 성공:', {
      email: googleUser.email?.substring(0, 3) + '...',
      name: googleUser.name || '이름 없음'
    });

    // 3. 데이터베이스에서 사용자 확인/생성
    let user = await db.query.users.findFirst({
      where: eq(users.email, googleUser.email)
    });

    if (!user) {
      console.log('[Google OAuth] 새 사용자 생성 중...');
      
      // 🎯 구글 로그인 시 무료 회원으로 자동 설정
      const memberType = 'free'; // 구글 로그인은 항상 무료 회원
      console.log('[Google OAuth] 구글 로그인 → 무료 회원으로 설정:', googleUser.email);
      
      const [newUser] = await db.insert(users).values({
        username: googleUser.email, // username 필드 사용
        email: googleUser.email,
        password: '', // Google OAuth는 비밀번호 불필요하므로 빈 문자열
        fullName: googleUser.name || googleUser.email,
        firebaseUid: googleUser.id, // Google ID를 firebaseUid에 저장
        emailVerified: true,
        memberType: memberType, // 🎯 자동 설정된 회원등급 사용
        needProfileComplete: false // ✅ Google 로그인은 프로필 완성 불필요
      }).returning();
      
      user = newUser;
      console.log('[Google OAuth] 새 사용자 생성 완료:', `ID: ${user.id}, 등급: ${memberType}`);
    } else {
      console.log('[Google OAuth] 기존 사용자 로그인:', user.id);
      
      // Google ID 및 프로필 완성 상태 업데이트 (필요한 경우)
      if (!user.firebaseUid || user.firebaseUid !== googleUser.id || user.needProfileComplete === true) {
        await db.update(users)
          .set({
            firebaseUid: googleUser.id,
            emailVerified: true,
            needProfileComplete: false // ✅ 기존 Google 사용자도 프로필 완성 불필요
          })
          .where(eq(users.id, user.id));
        
        console.log('[Google OAuth] 기존 사용자 프로필 완성 상태 업데이트:', user.id);
      }
    }

    // 4. 서버 세션 설정 (JWT와 병행)
    req.session.user = {
      uid: user.firebaseUid || user.id.toString(),
      id: user.id,
      email: user.email || '',
      memberType: user.memberType || 'free',
      role: user.memberType || 'general'
    };
    
    console.log('[Google OAuth] 서버 세션 설정 완료:', req.session.user);

    // 5. JWT 토큰 생성
    const jwtToken = jwt.sign(
      {
        id: user.id, // id로 통일
        userId: user.id, // 하위 호환성 유지
        email: user.email || '',
        memberType: user.memberType
      },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('[Google OAuth] JWT 토큰 생성 완료 - JWT + 세션 병행 사용');

    // 6. JWT를 HttpOnly 쿠키로 설정
    res.cookie('auth_token', jwtToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30일
    });

    // 6. 로그인 상태 쿠키 설정 (프론트엔드에서 확인용)
    res.cookie('auth_status', 'logged_in', {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    // 8. 성공 후 토큰과 함께 클라이언트 콜백 페이지로 리디렉션
    const redirectUrl = `/?token=${jwtToken}&status=login_success&user_id=${user.id}`;
    res.redirect(redirectUrl);

  } catch (error) {
    console.error('[Google OAuth] 콜백 처리 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그인 처리 중 오류가 발생했습니다.'
    });
  }
});

/**
 * 로그아웃 (JWT-only)
 * POST /api/google-oauth/logout
 */
router.post('/logout', (req, res) => {
  try {
    // JWT 관련 쿠키만 제거 (세션 제거됨)
    res.clearCookie('auth_token');
    res.clearCookie('auth_status');
    
    console.log('[Google OAuth] JWT 로그아웃 완료 - 세션 없이 쿠키만 제거');

    res.json({
      success: true,
      message: '로그아웃되었습니다.'
    });
  } catch (error) {
    console.error('[Google OAuth] 로그아웃 오류:', error);
    res.status(500).json({
      success: false,
      message: '로그아웃 처리 중 오류가 발생했습니다.'
    });
  }
});

export default router;