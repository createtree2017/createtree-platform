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
  memberType: "general" | "membership";
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
            window.location.href = "/";
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
          // 🎯 서버 응답 구조에 맞게 user 객체 반환
          if (userData.success && userData.user) {
            console.log('useAuth - 반환할 사용자 객체:', userData.user);
            return userData.user;
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
    retry: false
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
        throw new Error("로그인에 실패했습니다");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
      
      // JWT 토큰이 있으면 localStorage에 저장 (슈퍼관리자용)
      if (data.token) {
        localStorage.setItem('auth_token', data.token);
        console.log('[로그인 성공] JWT 토큰 저장 완료');
      }
      
      toast({ title: "로그인 성공", description: "환영합니다!" });
      window.location.href = "/";
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
        throw new Error("회원가입에 실패했습니다");
      }
      return await response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/auth/me"], data.user);
      toast({ title: "회원가입 성공", description: "환영합니다!" });
      window.location.href = "/";
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
    onSuccess: () => {
      // 클라이언트에서도 모든 인증 데이터 삭제
      localStorage.removeItem("auth_token");
      localStorage.removeItem("jwt_token");
      localStorage.removeItem("jwt_user");
      localStorage.removeItem("auth_status");
      localStorage.removeItem("auth_user_id");
      localStorage.removeItem("auth_user_email");
      localStorage.removeItem("auth_timestamp");
      localStorage.removeItem("mobile_bypass_auth");
      
      // React Query 캐시도 완전히 무효화
      queryClient.setQueryData(["/api/auth/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.removeQueries({ queryKey: ["/api/auth/me"] });
      
      toast({ title: "로그아웃 완료", description: "안녕히 가세요!" });
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
      window.location.href = "/";
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
    logout: logout.mutate,
    loginWithGoogle: loginWithGoogle.mutate,
    isLoginLoading: login.isPending,
    isRegisterLoading: register.isPending,
    isLogoutLoading: logout.isPending,
    isGoogleLoginLoading: loginWithGoogle.isPending
  };
}
