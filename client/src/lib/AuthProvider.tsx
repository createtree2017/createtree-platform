import * as React from "react";
import { createContext, useContext } from "react";
import { useAuth } from "@/hooks/useAuth";
import { User } from "@shared/schema";
import { LoadingScreen } from "@/components/LoadingScreen";
import { Redirect } from "wouter";
import { Loader2 } from "lucide-react";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: { username: string; password: string }) => void;
  register: (data: {
    username: string;
    password: string;
    email?: string;
    name?: string;
    phoneNumber: string;
    birthdate?: string;
    memberType: "free" | "membership";
    hospitalId?: string;
  }) => void;
  logout: () => void;
  loginWithGoogle: () => void;
  isLoginLoading: boolean;
  isRegisterLoading: boolean;
  isLogoutLoading: boolean;
  isGoogleLoginLoading: boolean;
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
    logout,
    loginWithGoogle,
    isLoginLoading,
    isRegisterLoading,
    isLogoutLoading,
    isGoogleLoginLoading,
  } = authHook;

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
        login,
        register,
        logout,
        loginWithGoogle,
        isLoginLoading,
        isRegisterLoading,
        isLogoutLoading,
        isGoogleLoginLoading,
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
  const { user, isLoading } = useAuthContext();

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

  // 로그인되지 않은 경우 /auth로 리다이렉트
  if (!user) {
    console.log('[ProtectedRoute] 사용자 정보 없음 - /auth로 리다이렉트');
    return <Redirect to="/auth" />;
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