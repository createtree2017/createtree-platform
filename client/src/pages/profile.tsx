import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Settings, User as UserIcon, Calendar, Hospital, Download, Building2, Smartphone, LogOut, Shield, Moon, Sun, Palette, ClipboardList, Bell } from "lucide-react";
import { Link } from "wouter";
import { useTheme } from "@/hooks/use-theme";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useMainMenus } from "@/hooks/useMainMenus";

// 역할 및 멤버 타입 한글 맵핑
const MEMBER_TYPE_MAP: Record<string, string> = {
  'superadmin': '슈퍼관리자',
  'hospital_admin': '병원 관리자',
  'admin': '관리자',
  'membership': '멤버십회원',
  'pro': '프로회원',
  'general': '일반회원',
  'user': '일반 사용자'
};

// 날짜 포맷팅 함수
const formatDate = (dateStr?: string | Date | null) => {
  if (!dateStr) return '설정되지 않음';
  const date = new Date(dateStr);
  // 유효한 날짜인지 확인
  if (isNaN(date.getTime())) return '설정되지 않음';
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).replace(/\.\s/g, '.'); // "2025.06.01" 형식으로 변환
};

// 병원 정보 인터페이스
interface Hospital {
  id: number;
  name: string;
  slug: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export default function Profile() {
  const { user, logout } = useAuth();
  const { rawMenus } = useMainMenus();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  // OS 감지 (컴포넌트 스코프 — JSX에서도 사용)
  const userAgentStr = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isAndroid = /Android/.test(userAgentStr);
  const isIOS = /iPad|iPhone|iPod/.test(userAgentStr);

  // 메뉴 활성 상태 확인 (관리자 메뉴관리에서 비활성화되면 여기서도 숨김)
  const isMenuActive = (menuId: string) => {
    if (!rawMenus || rawMenus.length === 0) return true; // API 로딩 중이면 기본 표시
    return rawMenus.some(menu => menu.menuId === menuId);
  };

  // PWA 설치 가능 여부 감지
  useEffect(() => {
    // 이미 PWA로 실행 중인지 확인 (다양한 방법으로 체크)
    const isRunningStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    setIsInstalled(isRunningStandalone);

    // beforeinstallprompt 이벤트 리스너
    const handleBeforeInstallPrompt = (e: any) => {
      console.log('beforeinstallprompt 이벤트 감지됨');
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    // appinstalled 이벤트 리스너 (설치 완료 시)
    const handleAppInstalled = () => {
      console.log('PWA 설치 완료');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    // PWA 설치 가능성 체크 (Chrome 조건)
    const checkInstallability = () => {
      // Chrome PWA 설치 조건들을 확인
      const hasManifest = document.querySelector('link[rel="manifest"]');
      const hasServiceWorker = 'serviceWorker' in navigator;
      const isHTTPS = location.protocol === 'https:' || location.hostname === 'localhost';

      console.log('PWA 설치 조건 체크:', {
        hasManifest: !!hasManifest,
        hasServiceWorker,
        isHTTPS,
        userAgent: navigator.userAgent
      });
    };

    // 페이지 로드 후 잠시 후 체크
    setTimeout(checkInstallability, 1000);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // PWA 설치 실행
  const handleInstallPWA = async () => {
    if (deferredPrompt) {
      // Chrome에서 자동 프롬프트가 있는 경우
      try {
        const { outcome } = await deferredPrompt.prompt();
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setIsInstallable(false);
        }
        setDeferredPrompt(null);
      } catch (error) {
        console.error('PWA 설치 오류:', error);
      }
      return;
    }

    // 플랫폼별 처리
    if (isAndroid) {
      // 안드로이드: 구글 플레이 스토어로 이동
      window.open(
        'https://play.google.com/store/apps/details?id=com.createtree.app&pcampaignid=web_share',
        '_blank'
      );
    } else if (isIOS) {
      alert('📱 iPhone/iPad 설치 방법:\n\n1. Safari 브라우저에서 이 사이트 열기\n2. 화면 하단 공유 버튼(□↗) 탭\n3. "홈 화면에 추가" 선택\n4. "추가" 버튼 탭\n\n✅ 홈 화면에서 앱처럼 사용 가능!');
    } else {
      alert('💻 Chrome 설치 방법:\n\n1. 주소창 우측 설치 아이콘(⬇) 클릭\n또는\n2. 메뉴(⋮) → "앱 설치" 선택\n\n✅ 데스크톱에서 앱처럼 사용 가능!');
    }
  };

  // 병원 관리자인 경우 병원 정보 가져오기
  const { data: hospital, isLoading: isLoadingHospital } = useQuery<Hospital>({
    queryKey: [`/api/hospitals/${user?.hospitalId}`],
    queryFn: async () => {
      if (!user?.hospitalId) return null;
      const response = await fetch(`/api/hospitals/${user.hospitalId}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('병원 정보를 가져오는데 실패했습니다.');
      }
      return response.json();
    },
    enabled: !!user?.hospitalId,
  });

  return (
    <div className="p-5 animate-fadeIn">


      {/* 프로필 정보 - Suno 스타일 */}
      <div className="bg-card p-6 rounded-2xl shadow-md border border-border mb-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center">
            <UserAvatar className="w-10 h-10 text-purple-600" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="font-bold text-xl text-foreground">{user?.username || "사용자"}</h3>
            <p className="text-sm text-muted-foreground mb-4">{user?.email || "이메일 정보 없음"}</p>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">계정 유형:</span>
                <span className="text-sm text-foreground">{user?.memberType ? MEMBER_TYPE_MAP[user.memberType] || user.memberType : "일반 사용자"}</span>
              </div>

              {/* 소속 병원 정보 및 superadmin 전환 버튼 */}
              {(user?.hospitalId || user?.memberType === 'superadmin') && (
                <>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">소속 병원:</span>
                    <span className="text-sm text-foreground">
                      {isLoadingHospital ? "로딩 중..." : (hospital?.name || (user?.memberType === 'superadmin' ? '전체 관리자' : '병원 정보 없음'))}
                    </span>
                  </div>

                  {hospital?.contractStartDate && (
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-muted-foreground">계약 기간:</span>
                      <span className="text-sm text-foreground">
                        {formatDate(hospital.contractStartDate)} ~ {formatDate(hospital.contractEndDate)}
                      </span>
                    </div>
                  )}
                </>
              )}

              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">가입일:</span>
                <span className="text-sm text-foreground">
                  {user?.createdAt ? formatDate(user.createdAt) : "정보 없음"}
                </span>
              </div>
            </div>

            {/* 최고관리자 전용: 관리자 페이지 버튼 */}
            {user?.memberType === 'superadmin' && (
              <Link href="/admin" className="block mt-4">
                <Button
                  variant="ghost"
                  className="w-full justify-center gap-2 p-3 h-auto font-bold bg-yellow-500 hover:bg-yellow-400 rounded-xl text-black hover:text-black"
                >
                  <Shield className="w-5 h-5" />
                  <span>관리자 페이지</span>
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* 활동내역 */}
      <div className="bg-card p-4 rounded-2xl shadow-md border border-border mb-4">
        <h3 className="font-bold text-lg mb-4 px-2 text-foreground">활동내역</h3>
        <ul className="space-y-2">
          {/* 나의 알림 */}
          <NotificationMenuItem />
          {isMenuActive('gallery') && (
            <li>
              <Link to="/gallery" className="group flex items-center gap-3 p-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors">
                <Download className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-foreground">나의 갤러리</span>
              </Link>
            </li>
          )}
          {isMenuActive('my-missions') && (
            <li>
              <Link to="/my-missions" className="group flex items-center gap-3 p-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors">
                <ClipboardList className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-foreground">나의미션</span>
              </Link>
            </li>
          )}
        </ul>
      </div>

      {/* 계정관리 */}
      <div className="bg-card p-4 rounded-2xl shadow-md border border-border mb-4">
        <h3 className="font-bold text-lg mb-4 px-2 text-foreground">계정관리</h3>
        <ul className="space-y-2">
          <li>
            <Link href="/account-settings" className="block">
              <Button variant="ghost" className="w-full justify-start gap-3 p-3 h-auto font-normal bg-muted hover:bg-muted/80 rounded-xl text-foreground hover:text-foreground">
                <Settings className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm">계정 설정</span>
              </Button>
            </Link>
          </li>
        </ul>
      </div>

      {/* 시스템설정 */}
      <div className="bg-card p-4 rounded-2xl shadow-md border border-border">
        <h3 className="font-bold text-lg mb-4 px-2 text-foreground">시스템설정</h3>
        <ul className="space-y-2">
          <li>
            <ThemeButton />
          </li>

          {/* PWA 설치 버튼 */}
          {!isInstalled && (
            <li>
              <Button
                onClick={handleInstallPWA}
                variant="ghost"
                className="w-full justify-start gap-3 p-3 h-auto font-normal bg-muted hover:bg-muted/80 rounded-xl text-foreground hover:text-foreground"
              >
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                <div className="flex flex-col items-start">
                  <span className="text-sm">창조트리문화센터 앱 설치</span>
                  <span className="text-xs text-muted-foreground">
                    {isAndroid ? '구글 플레이 스토어에서 설치' : 'iOS: 홈 화면에 추가하여 앱처럼 사용'}
                  </span>
                </div>
              </Button>
            </li>
          )}

          {/* PWA 설치 완료 표시 */}
          {isInstalled && (
            <li>
              <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
                <Smartphone className="w-5 h-5 text-green-600" />
                <div className="flex flex-col">
                  <span className="text-green-800 font-medium">앱이 설치되었습니다</span>
                  <span className="text-xs text-green-600">홈 화면에서 앱으로 실행 중</span>
                </div>
              </div>
            </li>
          )}

          {/* 로그아웃 버튼 */}
          <li>
            <Button
              onClick={() => logout()}
              variant="ghost"
              className="w-full justify-start gap-3 p-3 h-auto font-normal bg-red-950/30 hover:bg-red-950/50 rounded-xl text-red-400 hover:text-red-300"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm">로그아웃</span>
            </Button>
          </li>
        </ul>
      </div>
    </div>
  );
}

// 테마 변경 버튼 컴포넌트
const ThemeButton = () => {
  const { theme, setTheme } = useTheme();

  const themeConfig: Record<string, { icon: React.ReactNode; label: string; next: string; bgColor: string; textColor: string; iconColor: string }> = {
    dark: {
      icon: <Moon className="w-5 h-5" />,
      label: "다크모드",
      next: "light",
      bgColor: "bg-slate-100 hover:bg-slate-200",
      textColor: "text-slate-800",
      iconColor: "text-slate-600",
    },
    light: {
      icon: <Sun className="w-5 h-5" />,
      label: "라이트모드",
      next: "pastel",
      bgColor: "bg-amber-50 hover:bg-amber-100",
      textColor: "text-amber-800",
      iconColor: "text-amber-600",
    },
    pastel: {
      icon: <Palette className="w-5 h-5" />,
      label: "파스텔모드",
      next: "dark",
      bgColor: "bg-pink-50 hover:bg-pink-100",
      textColor: "text-pink-800",
      iconColor: "text-pink-600",
    },
  };

  const current = themeConfig[theme] || themeConfig.dark;
  const nextTheme = themeConfig[current.next] || themeConfig.dark;

  return (
    <button
      onClick={() => setTheme(current.next as any)}
      className={`group flex items-center justify-between w-full gap-3 p-3 ${current.bgColor} rounded-xl transition-colors`}
    >
      <div className="flex items-center gap-3">
        <span className={current.iconColor}>{current.icon}</span>
        <span className={current.textColor}>테마 변경</span>
      </div>
      <span className={`text-xs ${current.iconColor}`}>
        현재: {current.label} → {nextTheme.label}
      </span>
    </button>
  );
};

// 나의 알림 메뉴 아이템 (읽지 않은 알림 개수 뱃지 포함)
const NotificationMenuItem = () => {
  const { data } = useQuery<{ unreadCount: number }>({
    queryKey: ['/api/notifications/unread-count'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/unread-count', { credentials: 'include' });
      if (!res.ok) return { unreadCount: 0 };
      return res.json();
    },
    refetchInterval: 30000, // 30초마다 자동 갱신
  });

  const unreadCount = data?.unreadCount || 0;

  return (
    <li>
      <Link to="/notifications" className="group flex items-center gap-3 p-3 bg-muted hover:bg-muted/80 rounded-xl transition-colors">
        <div className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <span className="text-sm text-foreground">나의 알림</span>
        {unreadCount > 0 && (
          <span className="ml-auto text-xs text-purple-500 font-medium">{unreadCount}개 안읽음</span>
        )}
      </Link>
    </li>
  );
};

// User 아이콘 컴포넌트
const UserAvatar = ({ className }: { className?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
      <circle cx="12" cy="7" r="4"></circle>
    </svg>
  );
};