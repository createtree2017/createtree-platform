import React, { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuthContext } from "@/lib/AuthProvider";
import { useGoogleAuth, useGoogleCallbackHandler } from "@/hooks/useGoogleAuth";
import { Loader2, AlertCircle } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Separator } from "@/components/ui/separator";
import { Link } from "wouter";
import { applyLoginResult } from "@/lib/login-session";
import { loginDestination } from "@/lib/auth-navigation";
import { useToast } from "@/hooks/use-toast";

// 로그인 폼 검증 스키마
const loginSchema = z.object({
  username: z.string().email({
    message: "올바른 이메일 주소를 입력하세요.",
  }),
  password: z.string().min(6, {
    message: "비밀번호는 최소 6자 이상이어야 합니다.",
  }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const LoginForm: React.FC = () => {
  const { isLoginLoading } = useAuthContext();
  const { loginWithGoogle, isLoggingIn } = useGoogleAuth();
  const { toast } = useToast();

  // Google OAuth 콜백 처리
  useGoogleCallbackHandler();

  // 로그인 에러 상태
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // React Hook Form 설정
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  // 로그인 폼 제출 핸들러 - 직접 fetch로 에러 메시지를 안정적으로 처리
  const onSubmit = async (values: LoginFormValues) => {
    setLoginError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        setLoginError(errorData.message || "이메일 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      const data = await response.json();

      await applyLoginResult(data);

      toast({ title: "로그인 성공", description: "환영합니다!" });

      if (window.location.pathname !== '/') {
        window.history.pushState({}, '', loginDestination());
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    } catch (error: any) {
      setLoginError("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // 로그인 진행 상태 관리
  const [isGoogleLoginInProgress, setIsGoogleLoginInProgress] = useState(false);

  // Google 로그인 핸들러 - 서버 OAuth2 시스템 사용 (확실한 방법)
  const handleGoogleLogin = async () => {
    // 중복 요청 방지
    if (isGoogleLoginInProgress) {
      console.log('⚠️ 이미 로그인 진행 중입니다.');
      return;
    }

    try {
      setIsGoogleLoginInProgress(true);
      console.log("🚀 서버 Google OAuth2 로그인 시작");

      // 서버에서 Google OAuth URL 받아오기
      const response = await fetch(`/api/google-oauth/login?t=${Date.now()}`, {
        method: 'GET',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Google 로그인 URL 생성에 실패했습니다.');
      }

      const data = await response.json();
      console.log('🔗 서버 OAuth URL 받아옴:', data.authUrl?.substring(0, 50) + '...');

      if (data.success && data.authUrl) {
        // 페이지 리디렉션으로 Google OAuth 진행 (팝업 대신)
        console.log('🔄 Google 인증 페이지로 리디렉션합니다...');
        window.location.href = data.authUrl;
      } else {
        throw new Error('Google 로그인 URL을 받지 못했습니다.');
      }

    } catch (error: any) {
      console.error('💥 Firebase Google 로그인 실패:', error.code, error.message);

      // 구체적인 오류 처리
      let errorMessage = 'Google 로그인 중 오류가 발생했습니다.';

      if (error.code === 'auth/popup-blocked') {
        errorMessage = '팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = '네트워크 오류가 발생했습니다. 인터넷 연결을 확인하고 다시 시도해주세요.';
      } else if (error.code === 'auth/cancelled-popup-request') {
        // 사용자가 팝업을 취소한 경우 - 조용히 처리
        console.log('👤 사용자가 로그인 팝업을 취소했습니다.');
        return; // 에러 메시지 표시하지 않음
      } else if (error.code === 'auth/popup-closed-by-user') {
        // 사용자가 팝업을 직접 닫은 경우
        console.log('👤 사용자가 로그인 팝업을 닫았습니다.');
        return; // 에러 메시지 표시하지 않음
      }

      alert(errorMessage + '\n\n오류 코드: ' + (error.code || 'UNKNOWN'));
    } finally {
      // 로그인 진행 상태 초기화
      setIsGoogleLoginInProgress(false);
    }
  };

  const isLoading = isLoginLoading || isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이메일</FormLabel>
              <FormControl>
                <Input
                  placeholder="이메일 주소 입력"
                  type="email"
                  {...field}
                  disabled={isLoading}
                  autoComplete="username"
                  onChange={(e) => {
                    field.onChange(e);
                    setLoginError(null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>비밀번호</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="비밀번호 입력"
                  {...field}
                  disabled={isLoading}
                  autoComplete="current-password"
                  onChange={(e) => {
                    field.onChange(e);
                    setLoginError(null);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* 로그인 에러 메시지 - 인라인 표시 */}
        {loginError && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              로그인 중...
            </>
          ) : (
            "로그인"
          )}
        </Button>

        {/* 소셜 로그인 섹션 - 임시 숨김 처리 */}
        <div className="my-4 hidden">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">
                또는 소셜 계정으로 로그인
              </span>
            </div>
          </div>
        </div>

        {/* Google 로그인 버튼 - 임시 숨김 처리 */}
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-black border-gray-300 py-6 hidden"
          onClick={handleGoogleLogin}
          disabled={isLoggingIn || isGoogleLoginInProgress}
        >
          {(isLoggingIn || isGoogleLoginInProgress) ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>구글 로그인 중...</span>
            </>
          ) : (
            <>
              <FcGoogle className="h-5 w-5" />
              <span>Google 계정으로 로그인</span>
            </>
          )}
        </Button>
        <div className="text-xs text-center text-muted-foreground mt-1 hidden">
          <span className="text-gray-500">Google 계정으로 간편하게 로그인하세요</span>
        </div>

        {/* 계정 찾기 링크 */}
        <div className="mt-4 text-center">
          <div className="flex justify-center space-x-5 text-sm">
            <Link href="/find-email" className="text-gray-500 hover:text-primary underline">
              아이디 찾기
            </Link>
            <span className="text-gray-400">|</span>
            <Link href="/forgot-password" className="text-gray-500 hover:text-primary underline">
              비밀번호 찾기
            </Link>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default LoginForm;