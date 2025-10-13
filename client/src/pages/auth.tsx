import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// 상대 경로로 변경
import LoginForm from "../components/forms/LoginForm";
import RegisterForm from "../components/forms/RegisterForm";
import { useAuthContext } from "@/lib/AuthProvider";
import FloatingBabyItems from "@/components/FloatingBabyItems";
import { getAuth, getRedirectResult } from "firebase/auth";
import { Loader2, Sparkles, Check, ArrowRight, Heart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import bannerImage from "@assets/stock_images/mother_baby_happy_sm_f0d1f967.jpg";

const AuthPage = () => {
  const [location, setLocation] = useLocation();
  const { user, isLoading, loginWithGoogle } = useAuthContext();
  const [processingRedirect, setProcessingRedirect] = useState(false);
  const { toast } = useToast();

  // Firebase 리디렉션 결과 처리
  useEffect(() => {
    const processRedirectResult = async () => {
      try {
        setProcessingRedirect(true);
        const auth = getAuth();
        
        console.log("[AuthPage] Firebase 리디렉션 결과 확인 중...");
        const result = await getRedirectResult(auth);
        
        if (result && result.user) {
          console.log("[AuthPage] 리디렉션 로그인 성공, 사용자 정보:", {
            uid: result.user.uid.substring(0, 5) + "...",
            email: result.user.email,
            displayName: result.user.displayName
          });
          
          // 리디렉션 로그인 성공 시 로그인 처리
          toast({
            title: "Google 로그인 성공",
            description: "환영합니다! 로그인 정보를 처리 중입니다...",
          });
          
          // 서버에 Firebase 사용자 정보 전송
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
          
          if (!response.ok) {
            throw new Error("서버 인증에 실패했습니다");
          }
          
          // 로그인 성공 시 홈으로 리디렉션
          setTimeout(() => {
            setLocation("/");
          }, 1000);
        } else {
          console.log("[AuthPage] 리디렉션 결과 없음");
        }
      } catch (error) {
        console.error("[AuthPage] 리디렉션 결과 처리 중 오류:", error);
        toast({
          title: "로그인 처리 중 오류 발생",
          description: error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다",
          variant: "destructive"
        });
      } finally {
        setProcessingRedirect(false);
      }
    };
    
    // 현재 URL에 auth 관련 파라미터가 있는지 확인
    const hasAuthParams = window.location.href.includes("__/auth/handler");
    if (hasAuthParams) {
      processRedirectResult();
    }
  }, [setLocation, toast]);

  // 이미 로그인된 상태 확인
  useEffect(() => {
    if (user && !isLoading && !processingRedirect) {
      setLocation("/");
    }
  }, [user, isLoading, processingRedirect, setLocation]);

  if (isLoading) {
    return <div>로딩 중...</div>;
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row bg-gradient-to-br from-blue-50 to-purple-50 relative overflow-hidden">
      {/* 배경에 떠다니는 유아용품 아이템 */}
      <FloatingBabyItems />
      {/* 왼쪽 로그인/회원가입 영역 */}
      <div className="w-full md:w-1/2 p-4 md:p-10 flex flex-col justify-center">
        <div className="max-w-md mx-auto w-full">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-primary">AI우리병원 문화센터</h1>
            <p className="text-muted-foreground mt-2">
              임산부와 영유아 엄마들을 위한 AI 서비스
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>계정 관리</CardTitle>
              <CardDescription>
                우리병원 문화센터의 AI 서비스를 이용하려면 로그인이 필요합니다.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="login" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="login">로그인</TabsTrigger>
                  <TabsTrigger value="register">회원가입</TabsTrigger>
                </TabsList>
                <TabsContent value="login">
                  <LoginForm />
                </TabsContent>
                <TabsContent value="register">
                  <RegisterForm />
                </TabsContent>
                


              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* 오른쪽 이미지/소개 영역 */}
      <div className="w-full md:w-1/2 bg-gradient-to-br from-primary/10 to-primary/20 flex flex-col justify-center items-center p-10 hidden md:flex">
        <div className="max-w-lg">
          <h2 className="text-3xl font-bold text-primary mb-4">
            우리병원 전용 AI 태교 문화센터
          </h2>
          <p className="text-lg mb-8 text-gray-700">
            우리병원 문화센터는 임산부와 영유아 엄마들을 위한 AI 기반 맞춤형 서비스를 제공합니다. 
            사진 변환, 태교 음악 생성, AI 대화 기능을 통해 특별한 경험을 선사합니다.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/80 p-4 rounded-lg shadow-sm">
              <h3 className="font-bold text-primary mb-2">AI 이미지 변환</h3>
              <p className="text-sm text-gray-600">
                소중한 순간을 다양한 스타일로 변환하여 특별한 추억을 만들어보세요.
              </p>
            </div>
            <div className="bg-white/80 p-4 rounded-lg shadow-sm">
              <h3 className="font-bold text-primary mb-2">태교 음악 생성</h3>
              <p className="text-sm text-gray-600">
                아기의 이름과 성격을 담은 맞춤형 태교 음악을 AI가 만들어드립니다.
              </p>
            </div>
            <div className="bg-white/80 p-4 rounded-lg shadow-sm">
              <h3 className="font-bold text-primary mb-2">AI 대화 서비스</h3>
              <p className="text-sm text-gray-600">
                임신과 육아에 관한 질문을 AI가 24시간 답변해드립니다.
              </p>
            </div>
            <div className="bg-white/80 p-4 rounded-lg shadow-sm">
              <h3 className="font-bold text-primary mb-2">마일스톤 관리</h3>
              <p className="text-sm text-gray-600">
                임신과 육아의 중요한 순간을 기록하고 추억하세요.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 하단 배너 - 병원 도입 홍보 */}
      <a 
        href="https://createtreeai.replit.app/" 
        target="_blank" 
        rel="noopener noreferrer"
        className="w-full block"
      >
        <div className="w-full relative overflow-hidden bg-gradient-to-br from-pink-50 via-orange-50 to-amber-50 border-t border-orange-100 hover:shadow-xl transition-shadow duration-300 cursor-pointer">
          {/* 장식 요소 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-pink-200 rounded-full blur-3xl opacity-30"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-200 rounded-full blur-3xl opacity-20"></div>
          
          <div className="relative max-w-7xl mx-auto px-6 py-12 md:py-16">
            <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">
              
              {/* 왼쪽: 콘텐츠 */}
              <div className="space-y-4 md:space-y-6 order-2 md:order-1">
                <div className="inline-flex items-center gap-2 bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full shadow-sm">
                  <Heart className="w-5 h-5 text-pink-500" />
                  <span className="text-gray-700 font-medium">병원을 위한 특별한 제안</span>
                </div>
                
                <h2 className="text-3xl md:text-5xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent leading-tight">
                  당신의 병원에도<br />
                  'AI 문화센터'가<br />
                  생깁니다. 💗
                </h2>
                
                <div className="space-y-3 text-gray-600">
                  <p className="text-base md:text-lg flex items-start gap-2">
                    <Check className="w-5 md:w-6 h-5 md:h-6 text-green-500 mt-1 flex-shrink-0" />
                    AI가 병원의 감성을 디자인합니다
                  </p>
                  <p className="text-base md:text-lg flex items-start gap-2">
                    <Check className="w-5 md:w-6 h-5 md:h-6 text-green-500 mt-1 flex-shrink-0" />
                    산모가 행복한 시간을 만들어드립니다
                  </p>
                  <p className="text-base md:text-lg flex items-start gap-2">
                    <Check className="w-5 md:w-6 h-5 md:h-6 text-green-500 mt-1 flex-shrink-0" />
                    병원 브랜드 가치를 높여드립니다
                  </p>
                </div>
                
                <div className="pt-4 md:pt-6">
                  <div className="inline-flex items-center gap-3 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white px-6 md:px-10 py-4 md:py-6 text-base md:text-xl rounded-2xl shadow-2xl hover:shadow-3xl transition-all group">
                    <Sparkles className="w-5 md:w-6 h-5 md:h-6" />
                    <span className="font-semibold">무료 상담 신청하기</span>
                    <ArrowRight className="w-5 md:w-6 h-5 md:h-6 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </div>

              {/* 오른쪽: 이미지 */}
              <div className="relative order-1 md:order-2">
                <div className="absolute inset-0 bg-gradient-to-br from-pink-300 to-orange-300 rounded-3xl blur-2xl opacity-30"></div>
                <img 
                  src={bannerImage}
                  alt="행복한 산모와 아기" 
                  className="relative rounded-3xl shadow-2xl w-full object-cover aspect-[4/3]"
                />
              </div>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
};

export default AuthPage;