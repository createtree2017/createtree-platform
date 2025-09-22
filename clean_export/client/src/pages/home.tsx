import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import PolioCard from "@/components/PolioCard";
import FeaturedSlider from "@/components/FeaturedSlider";
import { useAuthContext } from "@/lib/AuthProvider";
import { Loader2, Download, X } from "lucide-react";
import { isPWAInstalled, canInstallPWA, isIOS, isIOSSafari, getBrowser } from "@/utils/platform";
import { pwaManager } from "@/utils/pwa";
import { 
  Music, 
  PaintbrushVertical, 
  MessageCircle, 
  Images, 
  Sparkles, 
  Award,
  Flame,
  Bot,
  BarChart,
  Zap,
  Palette
} from "lucide-react";

// 컨셉 타입 정의 제거 - 관리자 페이지에서만 사용

interface RecentActivity {
  id: number;
  title: string;
  timestamp: string;
  type: "music" | "image";
}

interface Banner {
  id: number;
  title: string;
  description: string;
  imageSrc: string;
  href: string;
  isNew?: boolean;
  isActive: boolean;
  sortOrder: number;
}

export default function Home() {
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    // PWA가 설치되지 않았으면 버튼 표시
    if (!isPWAInstalled()) {
      console.log('[PWA] 설치되지 않음, 버튼 표시');
      setShowInstallButton(true);
    }

    // beforeinstallprompt 이벤트 리스너
    const handleInstallPrompt = (e: Event) => {
      console.log('[PWA] beforeinstallprompt 이벤트 발생');
      e.preventDefault();
      // pwaManager가 이미 이벤트를 저장하므로 여기서는 버튼만 표시
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    
    // 이미 pwaManager에 설치 프롬프트가 저장되어 있는지 확인
    if (pwaManager.canInstall) {
      console.log('[PWA] 이미 설치 가능한 상태');
      setShowInstallButton(true);
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (isInstalling) return;

    // iOS 사용자인 경우 안내 페이지로 이동
    if (isIOS()) {
      // Safari가 아닌 경우
      if (getBrowser() !== 'safari') {
        alert('iOS에서는 Safari 브라우저에서만 앱 설치가 가능합니다.\n\nSafari로 이동하여 설치해 주세요.');
        return;
      }
      
      // Safari인 경우 설치 안내 페이지로 이동
      window.location.href = '/pwa-install-guide';
      return;
    }

    // Android/Desktop은 기존 로직대로 진행
    const status = pwaManager.getStatus();
    console.log('[PWA] 현재 상태:', status);
    
    if (!status.canInstall) {
      alert('PWA 설치를 위해서는 실제 배포된 사이트에서 접속해주세요.\n\nReplit 미리보기 환경에서는 설치가 제한됩니다.');
      return;
    }

    setIsInstalling(true);
    try {
      const result = await pwaManager.promptInstall();
      if (result) {
        setShowInstallButton(false);
      }
    } catch (error) {
      console.error('PWA 설치 오류:', error);
      alert('설치에 실패했습니다. 브라우저 설정을 확인해주세요.');
    } finally {
      setIsInstalling(false);
    }
  };

  // AuthProvider에서 이미 로딩 상태를 관리하므로 홈페이지에서는 별도 로딩 체크 불필요
  
  // 배너 데이터 가져오기
  const { data: banners, isLoading: bannersLoading } = useQuery({
    queryKey: ["/api/banners"],
    queryFn: async () => {
      const response = await fetch("/api/banners");
      if (!response.ok) {
        throw new Error("배너 데이터를 가져오는데 실패했습니다");
      }
      return response.json() as Promise<Banner[]>;
    }
  });

  // 작은 배너 데이터 가져오기
  const { data: smallBanners, isLoading: smallBannersLoading } = useQuery({
    queryKey: ["/api/small-banners"],
    queryFn: async () => {
      const response = await fetch("/api/small-banners");
      if (!response.ok) {
        throw new Error("작은 배너 데이터를 가져오는데 실패했습니다");
      }
      return response.json();
    }
  });
  
  // 실제 DB 배너 데이터만 사용 - 하드코딩된 임시 데이터 제거
  const displayBanners = banners || [];
  
  // 컨셉 데이터 로딩 제거 - 관리자 페이지에서만 사용

  // AI 도구
  const aiTools = [
    {
      title: "추억 예술",
      icon: Palette,
      href: "/image",
      isNew: true,
    },
    {
      title: "자장가 제작",
      icon: Music,
      href: "/music",
      isNew: true,
    },
    {
      title: "AI 도우미",
      icon: MessageCircle,
      href: "/chat",
    },
    {
      title: "마일스톤",
      icon: Award,
      href: "/milestones",
    },
    {
      title: "내 갤러리",
      icon: Images,
      href: "/gallery",
    },
    {
      title: "진행 상황",
      icon: BarChart,
      href: "/progress",
    },
  ];

  // 캐릭터 도우미
  const characterHelpers = [
    {
      title: "산모 도우미",
      description: "임신과 출산에 대한 모든 질문을 물어보세요",
      imageSrc: "https://images.pexels.com/photos/7282589/pexels-photo-7282589.jpeg?auto=compress&cs=tinysrgb&w=600",
      href: "/chat?character=midwife",
      aspectRatio: "portrait" as const,
    },
    {
      title: "태교 전문가",
      description: "태교에 관한 질문에 답해드립니다",
      imageSrc: "https://images.pexels.com/photos/4473871/pexels-photo-4473871.jpeg?auto=compress&cs=tinysrgb&w=600",
      href: "/chat?character=prenatal",
      aspectRatio: "portrait" as const,
    },
    {
      title: "수면 코치",
      description: "아기 수면 패턴 개선을 도와드립니다",
      imageSrc: "https://images.pexels.com/photos/3933455/pexels-photo-3933455.jpeg?auto=compress&cs=tinysrgb&w=600",
      href: "/chat?character=sleep",
      aspectRatio: "portrait" as const,
    },
  ];

  // 인기 기능 및 참고 자료
  const trendingResources = [
    {
      title: "AI 이미지 스타일",
      icon: Sparkles,
      imageSrc: "https://images.pexels.com/photos/757882/pexels-photo-757882.jpeg?auto=compress&cs=tinysrgb&w=600",
      href: "/image",
    },
    {
      title: "자장가 모음",
      icon: Music,
      imageSrc: "https://images.pexels.com/photos/3662850/pexels-photo-3662850.jpeg?auto=compress&cs=tinysrgb&w=600",
      href: "/music?collection=lullabies",
    },
    {
      title: "마일스톤 챌린지",
      icon: Flame,
      imageSrc: "https://images.pexels.com/photos/4473768/pexels-photo-4473768.jpeg?auto=compress&cs=tinysrgb&w=600",
      href: "/milestones/challenge",
    },
    {
      title: "AI 콘텐츠 가이드",
      icon: Bot,
      imageSrc: "https://images.pexels.com/photos/1181271/pexels-photo-1181271.jpeg?auto=compress&cs=tinysrgb&w=600",
      href: "/guide/ai-content",
    },
  ];

  // 최근 활동 데이터 (임시) - API 연동 전 더미 데이터
  const recentActivities: any[] = [];
  
  // 배너 데이터 로딩 상태만 관리
  const isLoading = bannersLoading;

  // 로딩 중일 때 로딩 화면 표시
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="pb-16 animate-fadeIn">
      {/* 풀스크린 배너 슬라이더 - 풀스크린으로 여백 제거 */}
      <section className="mb-6 -mx-4 md:mx-0">
        <FeaturedSlider 
          items={displayBanners} 
        />
      </section>
      {/* 작은 배너 섹션 */}
      {smallBanners && smallBanners.length > 0 && (
        <section className="mb-8 px-4">
          <div className="max-w-screen-xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {smallBanners
                .filter((banner: any) => banner.isActive)
                .map((banner: any) => (
                <Link 
                  key={banner.id} 
                  href={banner.href || "#"}
                  onClick={() => {
                    // 배너 클릭 시 스크롤을 최상단으로 리셋
                    window.scrollTo(0, 0);
                  }}
                >
                  <div className="group cursor-pointer">
                    <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-blue-50 to-indigo-100 shadow-sm hover:shadow-md transition-all duration-300">
                      {/* 이미지 */}
                      {banner.imageSrc && (
                        <div className="relative h-32 overflow-hidden">
                          <img 
                            src={banner.imageSrc} 
                            alt={banner.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}
                      
                      {/* 콘텐츠 */}
                      <div className="p-4">
                        <h3 className="font-semibold text-gray-800 mb-2 group-hover:text-blue-600 transition-colors">
                          {banner.title}
                        </h3>
                        {banner.description && (
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {banner.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
      {/* AI 이미지 스타일 섹션 제거 - 관리자 페이지에서 관리 */}
      {/* PWA 설치 버튼 */}
      {showInstallButton && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="bg-purple-600/90 rounded-t-3xl shadow-2xl p-6">
            <button 
              onClick={() => setShowInstallButton(false)}
              className="absolute top-4 right-4 text-white/80 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="text-center text-white mb-4">
              <h3 className="font-bold text-lg mb-2">앱으로 더 편리하게!</h3>
              <p className="text-sm text-white/90">
                병원인증 앱으로 안전합니다. 앱아이콘을 통해 편리하게 사용하세요
              </p>
            </div>
            <button
              onClick={handleInstallPWA}
              disabled={isInstalling}
              className="w-full py-3 bg-white text-purple-600 font-semibold rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Download className="h-5 w-5" />
              {isInstalling ? '설치 중...' : (isIOS() ? '설치 방법 보기' : '지금 설치하기')}
            </button>
          </div>
        </div>
      )}
      {/* 하단 여백 */}
      <div className="h-8"></div>
    </div>
  );
}
