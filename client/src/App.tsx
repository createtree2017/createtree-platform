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
import MyMissionsPageNew from "@/pages/mymissions";
import MyMissionDetailPage from "@/pages/mymission-detail";
import MyMissionsPage from "@/pages/my-missions";
import MissionDetailPage from "@/pages/mission-detail";
import MissionReviewPage from "@/pages/mission-review";
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
import BottomNavigation, { MAIN_PAGE_PATHS, useMainMenus } from "@/components/BottomNavigation";
// Sidebar는 더 이상 Layout에서 사용하지 않음 (관리자 페이지에서 재사용 가능)
import { useMobile } from "./hooks/use-mobile";
import { ChevronLeft } from "lucide-react";

import { ThemeProvider } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AuthProvider, ProtectedRoute } from "@/lib/AuthProvider";
import { HospitalProvider } from "@/lib/HospitalContext";
import { ModalProvider, ModalContainer, initializeModalRegistry } from "@/components/modal";
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

// 중앙화된 모달 시스템 초기화
initializeModalRegistry();

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
  const [location, setLocation] = useLocation();
  const isMobile = useMobile();
  const { isGenerating, generationMessage } = useMusicGenerationStore();

  // Check if we're in an iframe
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    if (window.self !== window.top) {
      setIsInIframe(true);
      document.documentElement.classList.add('in-iframe');
    }
  }, []);

  // Determine if direct page mode (for iframe embedding of single features)
  const isDirectPage =
    location === "/music" ||
    location === "/chat";

  const isImagePage = location === "/image";
  const isIframeEmbedMode = isInIframe && (isDirectPage || isImagePage);

  // iframe에 있는 경우에만 네비게이션 숨김
  const showNavigation = !isIframeEmbedMode;

  // 관리자 페이지는 전체 너비 사용
  const isAdminPage = location.startsWith('/admin');

  // 메인 페이지에서만 하단바 표시 (세부 페이지에서는 숨김)
  const { mainPagePaths, rawMenus } = useMainMenus();
  const isMainPage = mainPagePaths.includes(location);
  const showBottomNav = showNavigation && isMainPage;

  // 현재 경로의 섹션을 판별하여 헤더 제목 결정 (DB 메뉴 기반)

  const getSectionTitle = (): { title: string; href: string } => {
    // DB 메뉴 데이터가 있으면 동적 매칭
    if (rawMenus && rawMenus.length > 0) {
      for (const menu of rawMenus) {
        const menuPath = menu.homeType === 'submenu' && menu.homeSubmenuPath
          ? menu.homeSubmenuPath
          : menu.path;
        if (location === menuPath || location.startsWith(menuPath + '/')) {
          return { title: menu.title, href: menuPath };
        }
      }
    }

    // 폴백 — DB 로딩 전이나 매칭되지 않는 경우
    if (location === '/mymissions' || location.startsWith('/mymissions/')) {
      return { title: '나의미션', href: '/mymissions' };
    }
    if (location === '/missions' || location.startsWith('/missions/') || location === '/my-missions') {
      return { title: '우리병원문화센터', href: '/missions' };
    }
    if (location === '/gallery' || location.startsWith('/studio-gallery')) {
      return { title: '나의 갤러리', href: '/gallery' };
    }
    if (location === '/profile' || location.startsWith('/account-settings') ||
      location.startsWith('/milestones') || location.startsWith('/admin') ||
      location.startsWith('/hospital') || location.startsWith('/super')) {
      return { title: '마이페이지', href: '/profile' };
    }
    return { title: 'AI이미지생성', href: '/' };
  };

  // 세부 페이지에서 뒤로가기 경로 결정
  const getBackPath = (): { href: string } | null => {
    if (isMainPage) return null;
    // 세부 페이지 → 해당 섹션의 메인 페이지로
    const section = getSectionTitle();
    return { href: section.href };
  };

  const sectionTitle = getSectionTitle();
  const backPath = getBackPath();

  return (
    <div className={`flex flex-col ${isInIframe ? "h-full" : "min-h-screen"} bg-background`}>
      {/* 상단 헤더 */}
      {showNavigation && (
        <header className="sticky top-0 z-30 w-full bg-card/80 backdrop-blur-xl safe-area-top border-b border-border/50">
          <div className="px-4 h-14 flex items-center justify-between max-w-[1800px] mx-auto relative">
            {/* 좌측: 뒤로가기 또는 빈 공간 */}
            <div className="w-10 flex-shrink-0">
              {backPath && (
                <button
                  onClick={() => setLocation(backPath.href)}
                  className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/50 transition-colors text-foreground/70 hover:text-foreground"
                  aria-label="뒤로가기"
                >
                  <ChevronLeft size={26} strokeWidth={3} className="text-yellow-400" />
                </button>
              )}
            </div>

            {/* 중앙: 섹션 홈버튼 (항상 로고 + 섹션명) */}
            <Link href={sectionTitle.href} className="absolute left-1/2 -translate-x-1/2">
              <button
                className="hover:bg-muted/50 rounded-md px-3 py-1.5 transition-colors flex items-center gap-2"
                onClick={() => window.scrollTo(0, 0)}
              >
                <img src="/icons/icon-32x32.png" alt="AI" className="w-6 h-6 rounded-full" />
                <h1 className={`font-semibold tracking-tight ${isMobile ? 'text-sm' : 'text-base'}`}>
                  {sectionTitle.title}
                </h1>
              </button>
            </Link>

            {/* 우측: 상태 표시기 및 테마 토글 */}
            <div className="flex items-center gap-2">
              <ImageProcessingIndicator />
              {isGenerating && (
                <div className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full text-xs font-medium animate-pulse border border-purple-300">
                  {isMobile ? '🎵' : generationMessage}
                </div>
              )}
            </div>
          </div>
        </header>
      )}

      {/* 메인 콘텐츠 */}
      <main className={`flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar ${showBottomNav ? "pb-20" : "pb-4"}`}>
        <div className={`${isInIframe ? "p-0" : ""} mx-auto ${isAdminPage ? 'w-full px-4 lg:px-8' : isMobile ? "max-w-xl" : "max-w-[1800px] p-6 lg:p-8"}`}>
          {children}
        </div>
      </main>

      {/* 하단 네비게이션 - 메인 페이지에서만 표시 */}
      {showBottomNav && <BottomNavigation />}

      {/* PWA 컴포넌트들 */}
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

      <Route path="/mymissions">
        <ProtectedRoute>
          <Layout>
            <MyMissionsPageNew />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route path="/mymissions/:id">
        <ProtectedRoute>
          <Layout>
            <MyMissionDetailPage />
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
            <MyMissionsPageNew />
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

      {/* 관리자 전용 - 미션 검수 바로가기 페이지 */}
      <Route path="/admin/review/:missionId">
        <ProtectedRoute allowedRoles={["hospital_admin", "admin", "superadmin"]}>
          <Layout>
            <MissionReviewPage />
          </Layout>
        </ProtectedRoute>
      </Route>

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
  // 모바일 최적화를 위한 뷰포트 메타 태그 추가
  // (OAuth 콜백 토큰 처리는 AuthProvider.tsx에서 통합 관리)
  useEffect(() => {

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
              <ModalProvider>
                <Router />
                <ModalContainer />
                <Toaster />
              </ModalProvider>
            </HospitalProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
