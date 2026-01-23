import { Switch, Route, useLocation, Link } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { useEffect, useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";

// 구버전 이미지 페이지 import 제거됨
import Chat from "@/pages/chat";
import Gallery from "@/pages/gallery-simplified";
import GalleryCollage from "@/pages/gallery-collage";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import AdminSafe from "@/pages/AdminSafe";
import Milestones from "@/pages/milestones";
import MissionsPage from "@/pages/missions";
import MyMissionsPage from "@/pages/my-missions";
import MissionDetailPage from "@/pages/mission-detail";
import MissionChildrenPage from "@/pages/mission-children";
import AuthPage from "@/pages/auth";
import AuthHandlerPage from "@/pages/auth-handler";
import RegisterPage from "@/pages/register";
import CompleteProfilePage from "@/pages/signup/complete-profile";
import TestAceStepPage from "@/pages/test-ace-step";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import FindEmail from "@/pages/FindEmail";
import { TopMediaTest } from "@/pages/TopMediaTest"; 
import PermissionTest from "@/pages/PermissionTest";
import BottomNavigation from "@/components/BottomNavigation";
import Sidebar from "@/components/Sidebar";
import { useMobile } from "./hooks/use-mobile";
import { Menu, X, ChevronLeft, ChevronRight } from "lucide-react";

import { ThemeProvider } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthProvider, ProtectedRoute } from "@/lib/AuthProvider";
import { HospitalProvider } from "@/lib/HospitalContext";
import { ImageProcessingIndicator } from "@/components/ImageProcessingIndicator";
import { useMusicGenerationStore } from "@/stores/musicGenerationStore";
// import { PWAInstallPrompt } from "@/components/PWAInstallPrompt"; // 중복 팝업 제거
import { PWAOfflineIndicator } from "@/components/PWAOfflineIndicator";
import { PWAUpdatePrompt } from "@/components/PWAUpdatePrompt";
import { SplashScreen } from "@/components/SplashScreen";
import { useBeforeUnload } from "@/hooks/useBeforeUnload";
// 서비스 페이지 컴포넌트 가져오기
import MaternityPhoto from "@/pages/maternity-photo";
import FamilyPhoto from "@/pages/family-photo";
import BabyFace from "@/pages/baby-face";
import Stickers from "@/pages/stickers";
import Lullaby from "@/pages/lullaby";
import PWAInstallGuide from "@/pages/pwa-install-guide";
import SnapshotPage from "@/pages/snapshot";
import SnapshotHistoryPage from "@/pages/snapshot-history";

// 컨셉 갤러리 페이지
import MaternityStyles from "@/pages/maternity-styles";
import FamilyStyles from "@/pages/family-styles";
import BabyStyles from "@/pages/baby-styles";
import StickerStyles from "@/pages/sticker-styles";

// 캠페인 관련 컴포넌트 제거됨
import HospitalDashboard from "@/pages/hospital/HospitalDashboard";

import DreamBookList from "@/pages/dream-book";
import DreamBookDetail from "@/pages/dream-book/[id]";
import CreateDreamBook from "@/pages/dream-book/create";
import AccountSettings from "@/pages/account-settings";
import PWAInstallGuidePage from "@/pages/pwa-install-guide";
import PhotobookV2Page from "@/pages/photobook-v2";
import PostcardPage from "@/pages/postcard";
import PartyPage from "@/pages/party";
import StudioGalleryPage from "@/pages/studio-gallery";

// 리디렉션 컴포넌트
function RedirectToAuth() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/auth");
  }, [setLocation]);
  return null;
}

// Main layout component
function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const isMobile = useMobile();
  const { isGenerating, generationMessage } = useMusicGenerationStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  // 모바일 브라우저 종료 방지 활성화
  // 다운로드 링크 클릭 시 경고 팝업 방지를 위해 주석 처리
  // useBeforeUnload(true);
  
  // Check if we're in an iframe
  const [isInIframe, setIsInIframe] = useState(false);
  
  useEffect(() => {
    if (window.self !== window.top) {
      setIsInIframe(true);
      document.documentElement.classList.add('in-iframe');
    }
  }, []);
  
  // Close sidebar when clicking outside on mobile
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (
        isMobile && 
        sidebarOpen && 
        !target.closest('.sidebar') && 
        !target.closest('.sidebar-toggle')
      ) {
        setSidebarOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, sidebarOpen]);
  
  // Close sidebar when location changes on mobile
  useEffect(() => {
    if (isMobile && sidebarOpen) {
      setSidebarOpen(false);
    }
  }, [location, isMobile]);
  
  // Determine if direct page mode (for iframe embedding of single features)
  const isDirectPage = 
    location === "/music" || 
    location === "/chat";
    
  // 이미지 페이지는 query parameter가 있는 경우에만 direct page로 처리
  const isImagePage = location === "/image";
  const isIframeEmbedMode = isInIframe && (isDirectPage || isImagePage);
  
  // iframe에 있는 경우에만 네비게이션 숨김 (일반 페이지에서는 항상 네비게이션 표시)
  const showNavigation = !isIframeEmbedMode;
  
  // Use sidebar on desktop, use bottom navigation on mobile (unless in iframe direct mode)
  const useDesktopLayout = !isMobile && showNavigation;
  const useMobileLayout = isMobile && showNavigation;
  
  // 관리자 페이지는 전체 너비 사용
  const isAdminPage = location.startsWith('/admin');
  
  const toggleCollapsed = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };
  
  if (useDesktopLayout) {
    return (
      <div className="flex min-h-screen bg-background overflow-hidden">
        <div className="sidebar relative">
          <Sidebar collapsed={sidebarCollapsed} />
          <button 
            onClick={toggleCollapsed}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-card text-foreground/70 hover:text-foreground
              rounded-full p-1 shadow-md border border-border"
          >
            {sidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 데스크톱 헤더 - 음악 생성 상태 표시 포함 */}
          <header className="bg-card h-14 border-b border-border px-6 flex items-center justify-between gap-4">
            <div className="font-semibold text-[12px]">우리병원 고객만을 위한 AI문화센터 서비스</div>
            <div className="flex items-center gap-4">
              <ImageProcessingIndicator />
              
              {/* 음악 생성 상태 표시 - 동적 메시지 */}
              {isGenerating && (
                <div className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium animate-pulse border border-purple-300">
                  {generationMessage}
                </div>
              )}
              

              
              <ThemeToggle />
            </div>
          </header>
          
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar bg-background">
            <div className={`w-full ${isAdminPage ? '' : 'max-w-[1800px] mx-auto'} p-6 lg:p-8`}>
              {children}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`flex flex-col ${isInIframe ? "h-full" : "min-h-screen"} bg-background`}>
      {/* 모바일 사이드바 오버레이 */}
      {useMobileLayout && sidebarOpen && (
        <div className="fixed inset-0 bg-black/70 z-40" onClick={() => setSidebarOpen(false)} />
      )}
      
      {/* 모바일 사이드바 */}
      {useMobileLayout && (
        <div className={`sidebar fixed top-0 bottom-0 left-0 z-50 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Sidebar collapsed={false} />
          <button 
            className="absolute top-4 right-4 text-foreground p-1.5 bg-muted rounded-full"
            onClick={() => setSidebarOpen(false)}
            aria-label="사이드바 닫기"
          >
            <X size={18} />
          </button>
        </div>
      )}
      
      {/* 모바일 헤더 */}
      {useMobileLayout && (
        <header className="sticky top-0 z-30 w-full bg-card safe-area-top border-b border-border">
          <div className="px-4 h-14 flex items-center justify-between">
            {/* 메뉴 버튼 */}
            <button 
              className="sidebar-toggle w-9 h-9 flex items-center justify-center text-foreground/80 hover:text-foreground 
                       rounded-md hover:bg-muted transition-colors"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="사이드바 토글"
            >
              <Menu size={22} />
            </button>
            
            {/* 로고 */}
            <Link href="/" className="flex items-center">
              <button 
                className="hover:bg-muted/50 rounded-md px-2 py-1 transition-colors"
                onClick={() => {
                  window.scrollTo(0, 0); // 홈으로 이동 시 스크롤 최상단 리셋
                }}
              >
                <h1 className="text-lg font-semibold tracking-tight font-heading">
                  <span className="text-foreground">우리병원</span><span className="text-primary">문화센터</span>
                </h1>
              </button>
            </Link>
            
            {/* 상태 표시기 및 테마 토글 */}
            <div className="flex items-center gap-3">
              <ImageProcessingIndicator />
              
              {/* 음악 생성 상태 표시 - 모바일 */}
              {isGenerating && (
                <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium animate-pulse border border-purple-300">
                  🎵 생성중
                </div>
              )}
              
              <ThemeToggle />
            </div>
          </div>
        </header>
      )}
      
      {/* 메인 콘텐츠 */}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar ${useMobileLayout ? "pb-16" : "pb-4"}`}>
        <div className={`${isInIframe ? "p-0" : ""} mx-auto ${isMobile && !isAdminPage ? "max-w-xl" : ""}`}>
          {children}
        </div>
      </main>
      
      {/* 하단 네비게이션 제거됨 - 사용자 요청에 따라 */}
      
      {/* PWA 컴포넌트들 */}
      {/* <PWAInstallPrompt /> 중복 팝업 제거 */}
      <PWAOfflineIndicator />
      <PWAUpdatePrompt />
    </div>
  );
}

function Router() {
  // 로그인 상태는 각 페이지 컴포넌트에서 처리
  const [location] = useLocation();
  
  return (
    <Switch>
      {/* 인증 불필요 경로 */}
      <Route path="/auth">
        <AuthPage />
      </Route>
      <Route path="/__/auth/handler">
        <AuthHandlerPage />
      </Route>
      <Route path="/auth/callback">
        <AuthHandlerPage />
      </Route>
      <Route path="/login">
        <RedirectToAuth />
      </Route>
      <Route path="/register">
        <RegisterPage />
      </Route>
      <Route path="/signup">
        <RegisterPage />
      </Route>
      <Route path="/signup/complete-profile">
        <CompleteProfilePage />
      </Route>
      <Route path="/forgot-password">
        <ForgotPassword />
      </Route>
      <Route path="/reset-password">
        <ResetPassword />
      </Route>
      <Route path="/find-email">
        <FindEmail />
      </Route>


      {/* PWA 설치 안내 페이지 */}
      <Route path="/pwa-install-guide">
        <PWAInstallGuide />
      </Route>

      {/* 개발 환경에서만 활성화되는 테스트 라우트 */}
      {import.meta.env.DEV && (
        <>
          <Route path="/test-ace-step">
            <Layout>
              <TestAceStepPage />
            </Layout>
          </Route>
          
          <Route path="/topmedia-test">
            <Layout>
              <TopMediaTest />
            </Layout>
          </Route>
          
          <Route path="/permission-test">
            <Layout>
              <PermissionTest />
            </Layout>
          </Route>
        </>
      )}

      <Route path="/unauthorized">
        <div className="min-h-screen flex flex-col items-center justify-center p-4">
          <h1 className="text-3xl font-bold text-red-500 mb-4">접근 권한이 없습니다</h1>
          <p className="mb-6">이 페이지에 접근할 권한이 없습니다. 관리자에게 문의하세요.</p>
          <Link to="/" className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90">
            홈으로 돌아가기
          </Link>
        </div>
      </Route>
      
      {/* 인증 필요 경로 - 일반 사용자 */}
      <Route path="/">
        <ProtectedRoute>
          <Layout>
            <Home />
          </Layout>
        </ProtectedRoute>
      </Route>
      

      
      {/* 구버전 /image 라우트 제거됨 - 자동으로 404 페이지로 이동 */}
      
      <Route path="/chat">
        <ProtectedRoute>
          <Layout>
            <Chat />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/gallery">
        <ProtectedRoute>
          <Layout>
            <Gallery />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/studio-gallery">
        <ProtectedRoute>
          <Layout>
            <StudioGalleryPage />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/gallery-collage">
        <ProtectedRoute>
          <Layout>
            <GalleryCollage />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/collage-builder">
        <ProtectedRoute>
          <Layout>
            <GalleryCollage />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/milestones">
        <ProtectedRoute>
          <Layout>
            <Milestones />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/missions">
        <ProtectedRoute>
          <Layout>
            <MissionsPage />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/my-missions">
        <ProtectedRoute>
          <Layout>
            <MyMissionsPage />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/missions/:parentId/children">
        <ProtectedRoute>
          <Layout>
            <MissionChildrenPage />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/missions/:missionId">
        <ProtectedRoute>
          <Layout>
            <MissionDetailPage />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/profile">
        <ProtectedRoute>
          <Layout>
            <Profile />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/account-settings">
        <ProtectedRoute>
          <Layout>
            <AccountSettings />
          </Layout>
        </ProtectedRoute>
      </Route>

      {/* 서비스 경로 */}
      <Route path="/maternity-photo">
        <ProtectedRoute>
          <Layout>
            <MaternityPhoto />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/family-photo">
        <ProtectedRoute>
          <Layout>
            <FamilyPhoto />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/baby-face">
        <ProtectedRoute>
          <Layout>
            <BabyFace />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/stickers">
        <ProtectedRoute>
          <Layout>
            <Stickers />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/snapshot">
        <ProtectedRoute>
          <Layout>
            <SnapshotPage />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/snapshot/history">
        <ProtectedRoute>
          <Layout>
            <SnapshotHistoryPage />
          </Layout>
        </ProtectedRoute>
      </Route>

      {/* 컨셉 갤러리 경로 */}
      <Route path="/maternity-styles">
        <ProtectedRoute>
          <Layout>
            <MaternityStyles />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/family-styles">
        <ProtectedRoute>
          <Layout>
            <FamilyStyles />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/baby-styles">
        <ProtectedRoute>
          <Layout>
            <BabyStyles />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/sticker-styles">
        <ProtectedRoute>
          <Layout>
            <StickerStyles />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/lullaby">
        <ProtectedRoute>
          <Layout>
            <Lullaby />
          </Layout>
        </ProtectedRoute>
      </Route>
      
      <Route path="/music">
        <ProtectedRoute>
          <Layout>
            <Lullaby />
          </Layout>
        </ProtectedRoute>
      </Route>
      


      {/* 태몽동화 경로 */}
      <Route path="/dream-book">
        <ProtectedRoute>
          <Layout>
            <DreamBookList />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/dream-book/create">
        <ProtectedRoute>
          <Layout>
            <CreateDreamBook />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/dream-book/:id">
        <ProtectedRoute>
          <Layout>
            <DreamBookDetail />
          </Layout>
        </ProtectedRoute>
      </Route>

      {/* 포토북 에디터 */}
      <Route path="/photobook-v2">
        <ProtectedRoute>
          <PhotobookV2Page />
        </ProtectedRoute>
      </Route>

      {/* 엽서 에디터 */}
      <Route path="/postcard">
        <ProtectedRoute>
          <PostcardPage />
        </ProtectedRoute>
      </Route>

      {/* 행사용 에디터 */}
      <Route path="/party">
        <ProtectedRoute>
          <PartyPage />
        </ProtectedRoute>
      </Route>

      {/* 캠페인 관련 라우트 제거됨 */}
      
      {/* 관리자 전용 경로 - 병원 관리자도 병원 캠페인 수정 가능 */}
      <Route path="/admin">
        <ProtectedRoute allowedRoles={["admin", "superadmin", "hospital_admin"]}>
          <div className="w-full px-4 lg:px-8">
            <Admin />
          </div>
        </ProtectedRoute>
      </Route>
      
      {/* 병원 관리자 전용 대시보드 */}
      <Route path="/hospital/dashboard">
        <ProtectedRoute allowedRoles={["hospital_admin", "admin", "superadmin"]}>
          <Layout>
            <HospitalDashboard />
          </Layout>
        </ProtectedRoute>
      </Route>

      {/* 병원 관리자 캠페인 관련 라우트 제거됨 */}
      
      {/* 404 페이지 */}
      <Route>
        <NotFound />
      </Route>
    </Switch>
  );
}

function App() {
  // JWT 토큰 자동 저장 및 모바일 최적화를 위한 뷰포트 메타 태그 추가
  useEffect(() => {
    // JWT 토큰 자동 저장 (Google OAuth 콜백에서 URL 파라미터로 전달됨)
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const status = urlParams.get('status');
    
    if (token && status === 'login_success') {
      console.log('[App] JWT 토큰 자동 저장 시작');
      localStorage.setItem('auth_token', token);
      
      // URL에서 토큰 파라미터 제거 (보안상 중요)
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      console.log('[App] JWT 토큰 저장 완료, URL 정리됨');
    }
    
    // 모바일 기기를 위한 뷰포트 설정
    const metaViewport = document.createElement('meta');
    metaViewport.name = 'viewport';
    metaViewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover, maximum-scale=1';
    document.head.appendChild(metaViewport);
    
    // 브라우저 콘솔에 환경변수 정보 출력 (디버깅용)
    console.log("🔥 환경변수 확인:", {
      VITE_FIREBASE_API_KEY: import.meta.env.VITE_FIREBASE_API_KEY,
      VITE_FIREBASE_PROJECT_ID: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      VITE_FIREBASE_APP_ID: import.meta.env.VITE_FIREBASE_APP_ID
    });
    
    return () => {
      document.head.removeChild(metaViewport);
    };
  }, []);
  
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <HospitalProvider>
              <Router />
              <Toaster />
            </HospitalProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
