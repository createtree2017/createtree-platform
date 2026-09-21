import { useLocation } from "wouter";
import { loginDestination, clearLoginDestination, rememberLoginDestination } from "./auth-navigation";
import * as React from "react";
import { createContext, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";
import { User } from "@shared/schema";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface RegisterData {
  username: string;
  password: string;
  email?: string;
  name?: string;
  phoneNumber: string;
  birthdate?: string;
  memberType: "free" | "membership";
  hospitalId?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
  retryAuth: () => void;
  login: (credentials: { username: string; password: string }) => void;
  register: (data: RegisterData) => void;
  registerAsync: (data: RegisterData) => Promise<any>;
  logout: () => void;
  loginWithGoogle: () => void;
  isLoginLoading: boolean;
  isRegisterLoading: boolean;
  isLogoutLoading: boolean;
  isGoogleLoginLoading: boolean;

  // Firebase Direct Upload 관련 상태
  uploadMode: 'SERVER' | 'FIREBASE';
  isFirebaseReady: boolean;
  firebaseToken: string | null;

  // Firebase 상태 업데이트 함수 (🔥 useAuth.ts에서 사용)
  setUploadMode: (mode: 'SERVER' | 'FIREBASE') => void;
  setIsFirebaseReady: (ready: boolean) => void;
  setFirebaseToken: (token: string | null) => void;
}

// Auth Context 생성
const AuthContext = createContext<AuthContextType | null>(null);

// AuthProvider 컴포넌트
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 컴포넌트 마운트시 세션 쿠키 확인 및 Google OAuth 콜백 처리
  React.useEffect(() => {
    // 현재 쿠키 및 로컬 스토리지 상태 로깅
    console.log("[AuthProvider] 현재 쿠키:", document.cookie);
    console.log("[AuthProvider] 현재 로컬 스토리지:", {
      auth_status: localStorage.getItem("auth_status"),
      auth_user_id: localStorage.getItem("auth_user_id"),
      auth_timestamp: localStorage.getItem("auth_timestamp")
    });

    // URL 파라미터에서 JWT 토큰 확인 (Google OAuth 콜백 처리)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const status = urlParams.get('status');
    const userId = urlParams.get('user_id');

    if (token && status === 'login_success') {
      console.log('🎉 Google OAuth 로그인 성공! 사용자 정보 가져오는 중...');

      // JWT 토큰을 localStorage에 저장
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_status', 'logged_in');
      localStorage.setItem('auth_user_id', userId || '');
      localStorage.setItem('auth_timestamp', Date.now().toString());

      // URL에서 토큰 파라미터 제거 (보안을 위해)
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);

      // JWT 토큰으로 사용자 정보 즉시 가져오기
      fetch('/api/auth/me', {
        credentials: 'include',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(userData => {
          if (userData && userData.id) {
            console.log('✅ 사용자 정보 로드 성공:', userData.email);

            setUser(userData);  // ✅ 이 한 줄이 핵심! 절대로 생략 금지

            // 🔥 Firebase Direct Upload: firebaseToken 처리
            console.log('🔍 [Firebase 체크] 조건 검증:', {
              hasFirebaseToken: !!userData.firebaseToken,
              tokenPreview: userData.firebaseToken ? userData.firebaseToken.substring(0, 20) + '...' : 'null',
              envValue: import.meta.env.VITE_ENABLE_FIREBASE_UPLOAD,
              envType: typeof import.meta.env.VITE_ENABLE_FIREBASE_UPLOAD,
              comparison: import.meta.env.VITE_ENABLE_FIREBASE_UPLOAD === 'true',
              willActivate: userData.firebaseToken && import.meta.env.VITE_ENABLE_FIREBASE_UPLOAD === 'true'
            });

            if (userData.firebaseToken && import.meta.env.VITE_ENABLE_FIREBASE_UPLOAD === 'true') {
              console.log('🔥 Firebase Token 수신, Firebase 로그인 시도...');
              import('@/lib/firebase').then(({ loginWithCustomToken }) => {
                loginWithCustomToken(userData.firebaseToken!)
                  .then((success) => {
                    if (success) {
                      console.log('✅ Firebase 로그인 성공, Direct Upload 활성화');
                      console.log('📝 [상태 변경] uploadMode: SERVER → FIREBASE');
                      console.log('📝 [상태 변경] isFirebaseReady: false → true');
                      setUploadMode('FIREBASE');
                      setIsFirebaseReady(true);
                      setFirebaseToken(userData.firebaseToken!);
                    } else {
                      console.warn('⚠️ Firebase 로그인 실패, 서버 업로드 유지');
                      setUploadMode('SERVER');
                      setIsFirebaseReady(false);
                    }
                  })
                  .catch((error) => {
                    console.error('❌ Firebase 로그인 중 오류:', error);
                    setUploadMode('SERVER');
                    setIsFirebaseReady(false);
                  });
              }).catch((error) => {
                console.error('❌ Firebase 모듈 로드 실패:', error);
                setUploadMode('SERVER');
                setIsFirebaseReady(false);
              });
            } else {
              console.log('❌ Firebase Direct Upload 비활성화됨');
              console.log('   이유: hasToken=', !!userData.firebaseToken, ', env=', import.meta.env.VITE_ENABLE_FIREBASE_UPLOAD);
              setUploadMode('SERVER');
              setIsFirebaseReady(false);
            }

            window.location.href = '/';
          } else {
            console.log('⚠️ 사용자 정보 없음, 페이지 새로고침');
            window.location.reload();
          }
        })
        .catch(error => {
          console.error('❌ 사용자 정보 로드 실패:', error);
          window.location.reload();
        });
    }
  }, []);

  const authHook = useAuth();
  const {
    user,
    setUser,
    isLoading,
    login,
    register,
    registerAsync,
    logout,
    loginWithGoogle,
    isLoginLoading,
    isRegisterLoading,
    isLogoutLoading,
    isGoogleLoginLoading,
  } = authHook;

  const [location, setLocation] = useLocation();
  React.useEffect(() => {
    if (!user || isLoading || !sessionStorage.getItem('auth_return_to')) return;
    const destination = loginDestination();
    if (window.location.pathname + window.location.search + window.location.hash === destination) {
      clearLoginDestination();
    } else {
      setLocation(destination, { replace: true });
    }
  }, [user, isLoading, location, setLocation]);

  // Firebase Direct Upload 상태 관리
  const [uploadMode, setUploadMode] = React.useState<'SERVER' | 'FIREBASE'>('SERVER');
  const [isFirebaseReady, setIsFirebaseReady] = React.useState<boolean>(false);
  const [firebaseToken, setFirebaseToken] = React.useState<string | null>(null);

  // 🔥 Firebase Direct Upload: /api/auth/me 응답의 firebaseToken 감지 및 활성화
  React.useEffect(() => {
    const userAny = user as any;
    if (userAny?.firebaseToken && import.meta.env.VITE_ENABLE_FIREBASE_UPLOAD === 'true' && !isFirebaseReady) {
      console.log('🔥 [AuthProvider] firebaseToken 감지됨, Firebase 로그인 시도...');
      import('@/lib/firebase').then(({ loginWithCustomToken }) => {
        loginWithCustomToken(userAny.firebaseToken)
          .then((success) => {
            if (success) {
              console.log('✅ [AuthProvider] Firebase 로그인 성공, Direct Upload 활성화');
              setUploadMode('FIREBASE');
              setIsFirebaseReady(true);
              setFirebaseToken(userAny.firebaseToken);
            } else {
              console.warn('⚠️ [AuthProvider] Firebase 로그인 실패, 서버 업로드 유지');
              setUploadMode('SERVER');
              setIsFirebaseReady(false);
            }
          })
          .catch((error) => {
            console.error('❌ [AuthProvider] Firebase 로그인 오류:', error);
            setUploadMode('SERVER');
            setIsFirebaseReady(false);
          });
      }).catch((error) => {
        console.error('❌ [AuthProvider] Firebase 모듈 로드 실패:', error);
        setUploadMode('SERVER');
        setIsFirebaseReady(false);
      });
    }
  }, [user, isFirebaseReady]);

  // 🎯 전역 초기 로딩 상태 관리 - 최소 1초간 로딩 화면 표시
  const [isInitialLoadComplete, setIsInitialLoadComplete] = React.useState(false);
  const [startTime] = React.useState(Date.now());

  React.useEffect(() => {
    // 인증 로딩이 완료되면 최소 1초 후 초기 로드 완료로 표시
    if (!isLoading) {
      const elapsed = Date.now() - startTime;
      const minLoadTime = 1000; // 1초 최소 로딩 시간

      if (elapsed >= minLoadTime) {
        setIsInitialLoadComplete(true);
      } else {
        const remainingTime = minLoadTime - elapsed;
        setTimeout(() => {
          setIsInitialLoadComplete(true);
        }, remainingTime);
      }
    }
  }, [isLoading, startTime]);

  // 모든 인증 로직은 useAuth 훅에서 처리됨
  return (
    <AuthContext.Provider
      value={{
        user: user || null, // null 타입 보장
        isLoading,
        error: authHook.error,
        retryAuth: () => { void authHook.refetch(); },
        login,
        register,
        registerAsync,
        logout,
        loginWithGoogle,
        isLoginLoading,
        isRegisterLoading,
        isLogoutLoading,
        isGoogleLoginLoading,

        // Firebase Direct Upload 상태
        uploadMode,
        isFirebaseReady,
        firebaseToken,

        // Firebase 상태 업데이트 함수
        setUploadMode,
        setIsFirebaseReady,
        setFirebaseToken,
      }}
    >
      {(isLoading || !isInitialLoadComplete) ? (
        <LoadingScreen message="앱을 시작하는 중입니다..." />
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

// Auth Context 사용을 위한 Hook
export const useAuthContext = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuthContext must be used within an AuthProvider");
  }
  return context;
};

// Protected Route 컴포넌트 - 인증이 필요한 라우트를 감싸는 컴포넌트
export const ProtectedRoute: React.FC<{
  children: React.ReactNode;
  allowedRoles?: string[];
}> = ({ children, allowedRoles }) => {
  const { user, isLoading, error, retryAuth } = useAuthContext();

  // 디버깅 로그 추가
  React.useEffect(() => {
    if (!isLoading) {
      console.log('[ProtectedRoute] 현재 상태:', {
        user: user,
        memberType: user?.memberType,
        allowedRoles: allowedRoles,
        isLoading: isLoading,
        pathname: window.location.pathname
      });
    }
  }, [user, isLoading, allowedRoles]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user && error) {
    return (
      <div role="alert" className="mx-auto max-w-md p-6 text-center">
        <p>로그인 상태를 확인하지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.</p>
        <button type="button" className="mt-4 min-h-11 rounded-md border px-4" onClick={retryAuth}>다시 시도</button>
      </div>
    );
  }

  // 로그인되지 않은 경우 원래 화면을 저장하고 /auth로 이동
  if (!user) {
    console.log('[ProtectedRoute] 사용자 정보 없음 - /auth로 리다이렉트');
    return <LoginRequired />;
  }

  // 프로필 완성 강제 리다이렉션 제거 - Google OAuth 사용자는 바로 서비스 이용 가능

  // 역할 확인이 필요한 경우
  if (allowedRoles && allowedRoles.length > 0) {
    // 사용자 객체는 있지만 memberType이 없는 경우 체크
    if (!user.memberType) {
      console.error('[ProtectedRoute] 사용자 객체는 있지만 memberType이 null:', user);
      console.log('권한 부족: memberType이 null, 필요한 역할:', allowedRoles);
      return <Redirect to="/unauthorized" />;
    }

    // superadmin은 모든 경로에 접근 가능
    if (user.memberType === 'superadmin') {
      console.log('[ProtectedRoute] 슈퍼관리자 접근 허용');
      // 슈퍼관리자는 모든 페이지 접근 가능
    } else if (!allowedRoles.includes(user.memberType)) {
      // 권한 없음 페이지로 리다이렉션
      console.log('권한 부족:', user.memberType, '필요한 역할:', allowedRoles);
      return <Redirect to="/unauthorized" />;
    }
  }

  return <>{children}</>;
};
function LoginRequired() {
  const [, setLocation] = useLocation();
  React.useEffect(() => {
    rememberLoginDestination();
    setLocation('/auth?reason=expired', { replace: true });
  }, [setLocation]);
  return <p role="status" className="p-6 text-center">로그인 화면으로 이동합니다…</p>;
}
