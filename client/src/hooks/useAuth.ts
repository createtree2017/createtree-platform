import * as React from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/useToast";
import { User } from "@shared/schema";
import { auth as firebaseAuth, googleProvider } from "@/lib/firebase";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";

type LoginCredentials = {
  username: string;
  password: string;
};

type RegisterData = {
  username: string;
  password: string;
  email?: string;
  name?: string;
  phoneNumber: string;
  birthdate?: string;
  memberType: "free" | "membership";
  hospitalId?: string;
};

export function useAuth() {
  const { toast } = useToast();


  React.useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(firebaseAuth);
        if (result && result.user) {
          const userData = {
            uid: result.user.uid,
            email: result.user.email || "",
            displayName: result.user.displayName || ""
          };

          const response = await fetch("/api/auth/firebase-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user: userData }),
            credentials: "include"
          });

          if (response.ok) {
            const data = await response.json();
            queryClient.setQueryData(["/api/auth/me"], data.user);
            toast({ title: "Google 로그인 성공", description: "환영합니다!" });

            // 강제 새로고침 대신 React Router로 부드러운 전환
            if (window.location.pathname !== '/') {
              window.history.pushState({}, '', '/');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }
          }
        }
      } catch (error) {
        toast({ title: "Google 로그인 실패", description: String(error), variant: "destructive" });
      }
    };
    handleRedirectResult();
  }, []);

  const {
    data: user,
    isLoading,
    error,
    refetch
  } = useQuery<User | null>({
    queryKey: ["/api/auth/me"],
    queryFn: async (): Promise<User | null> => {
      try {
        const jwtToken = localStorage.getItem("auth_token");
        const headers: Record<string, string> = {};
        if (jwtToken) {
          headers["Authorization"] = `Bearer ${jwtToken}`;
        }

        const response = await fetch("/api/auth/me", {
          credentials: "include",
          headers: {
            ...headers,
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
          }
        });

        if (response.ok) {
          const userData = await response.json();
          console.log('useAuth - API 응답:', userData);
          console.log('useAuth - API 응답의 user.memberType:', userData?.user?.memberType);
          // 🎯 서버 응답 구조에 맞게 user 객체 반환
          if (userData.success && userData.user) {
            console.log('useAuth - 반환할 사용자 객체:', userData.user);
            console.log('useAuth - 반환할 사용자 memberType:', userData.user.memberType);

            // 🔥 Firebase Token이 있으면 user 객체에 병합하여 반환
            if (userData.firebaseToken) {
              console.log('🔥 useAuth - Firebase Token 감지됨, user 객체에 포함');
              return { ...userData.user, firebaseToken: userData.firebaseToken };
            }

            return userData.user;
          }
          // 중첩 구조가 없는 경우 대비
          if (userData.memberType) {
            console.log('useAuth - 중첩 없이 반환:', userData);
            // 최상위에 firebaseToken이 있는 경우 처리
            if (userData.firebaseToken) {
              return userData;
            }
            return userData;
          }
          return userData.user || userData;
        }

        // 세션 실패 시 JWT 인증 시도
        if (response.status === 401 && jwtToken) {
          const jwtVerify = await fetch("/api/jwt-auth/verify-token", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ token: jwtToken })
          });

          if (jwtVerify.ok) {
            const jwtData = await jwtVerify.json();
            if (jwtData.success && jwtData.user) {
              return jwtData.user as User;
            }
          }
        }

        return null;
      } catch (err) {
        console.error("[인증 API 오류] 사용자 정보 조회 실패:", err);
        return null;
      }
    },
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });

  const login = useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include"
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "로그인에 실패했습니다");
      }
      return await response.json();
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);

      // JWT 토큰이 있으면 localStorage에 저장 (슈퍼관리자용)
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        console.log('[로그인 성공] JWT 토큰 저장 완료');
      }

      // 🔥 Firebase Direct Upload: firebaseToken 처리 (AuthProvider에서 처리됨)

      toast({ title: "로그인 성공", description: "환영합니다!" });

      // 강제 새로고침 대신 React Router로 부드러운 전환
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    },
    onError: (error: Error) => {
      toast({ title: "로그인 실패", description: error.message, variant: "destructive" });
    }
  });

  const register = useMutation({
    mutationFn: async (data: RegisterData) => {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "회원가입에 실패했습니다");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      // 자동 로그인 처리 - 사용자 데이터를 쿼리 캐시에 저장
      queryClient.setQueryData(["/api/auth/me"], data.user);

      // JWT 토큰 저장 (서버에서 제공된 경우)
      if (data.accessToken) {
        localStorage.setItem('auth_token', data.accessToken);
        localStorage.setItem('auth_status', 'logged_in');
        localStorage.setItem('auth_user_id', data.user.id.toString());
        localStorage.setItem('auth_timestamp', Date.now().toString());
        console.log('[회원가입 성공] 자동 로그인 완료 - JWT 토큰 저장');
      }

      // 성공 메시지 표시
      toast({
        title: "회원가입 및 로그인이 완료되었습니다",
        description: "CreateTree 문화센터에 오신 것을 환영합니다! 이제 모든 AI 서비스를 이용하실 수 있습니다.",
        duration: 8000
      });

      // 3초 후 자연스럽게 메인 페이지로 이동
      // 강제 새로고침 없이 React 상태 기반으로 처리
      setTimeout(() => {
        // 인증 상태 캐시 갱신
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });

        // 회원가입 페이지에서만 리디렉션 실행
        if (window.location.pathname === '/register') {
          // pushState로 부드러운 페이지 전환
          window.history.pushState({}, '', '/');
          // popstate 이벤트로 React Router가 감지하도록 함
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }, 3000);
    },
    onError: (error: Error) => {
      toast({ title: "회원가입 실패", description: error.message, variant: "destructive" });
    }
  });

  const logout = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("로그아웃에 실패했습니다");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      // 자동 로그인 관련 모든 데이터 완전 삭제
      localStorage.removeItem("auth_token");
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("jwt_user");
      localStorage.removeItem("auth_status");
      localStorage.removeItem("auth_user_id");
      localStorage.removeItem("auth_user_email");
      localStorage.removeItem("auth_timestamp");
      localStorage.removeItem("mobile_bypass_auth");
      localStorage.removeItem("remember_me");
      localStorage.removeItem("auto_login_token");
      localStorage.removeItem("user_preferences");

      // 세션 스토리지도 완전 삭제
      sessionStorage.removeItem("auth_token");
      sessionStorage.removeItem("jwt_token");
      sessionStorage.removeItem("temp_auth");
      sessionStorage.removeItem("login_redirect");

      // React Query 캐시: 인증 데이터만 null로 설정 (전체 clear 제거 — 이중 로딩 방지)
      queryClient.setQueryData(["/api/auth/me"], null);

      console.log("로그아웃 완료: 모든 저장된 인증 정보 삭제됨", data);

      // 즉시 로그인 페이지로 하드 리다이렉트 (setTimeout 제거 — 이중 로딩 방지)
      window.location.href = "/auth";
    },
    onError: (error: Error) => {
      toast({ title: "로그아웃 실패", description: error.message, variant: "destructive" });
    }
  });

  const loginWithGoogle = useMutation({
    mutationFn: async () => {
      const result = await signInWithPopup(firebaseAuth, googleProvider);
      const user = result.user;
      const userData = {
        uid: user.uid,
        email: user.email || "",
        displayName: user.displayName || ""
      };
      const response = await fetch("/api/auth/firebase-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user: userData }),
        credentials: "include"
      });
      if (!response.ok) {
        throw new Error("Firebase 인증 실패");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
      toast({ title: "Google 로그인 성공", description: "환영합니다!" });

      // 강제 새로고침 대신 React Router로 부드러운 전환
      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    },
    onError: (error: Error) => {
      toast({ title: "Google 로그인 실패", description: error.message, variant: "destructive" });
    }
  });

  const setUser = (userData: User | null) => {
    queryClient.setQueryData(["/api/auth/me"], userData);
  };

  return {
    user,
    setUser,
    isLoading,
    error,
    login: login.mutate,
    register: register.mutate,
    registerAsync: register.mutateAsync,
    logout: logout.mutate,
    loginWithGoogle: loginWithGoogle.mutate,
    isLoginLoading: login.isPending,
    isRegisterLoading: register.isPending,
    isLogoutLoading: logout.isPending,
    isGoogleLoginLoading: loginWithGoogle.isPending
  };
}
