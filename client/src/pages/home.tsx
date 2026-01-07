import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import FeaturedSlider from "@/components/FeaturedSlider";
import { Loader2, Download, X, ChevronRight } from "lucide-react";
import { isPWAInstalled, isIOS, getBrowser } from "@/utils/platform";
import { pwaManager } from "@/utils/pwa";
import { 
  Music, 
  MessageCircle, 
  Images, 
  Award,
  Palette,
  Camera,
  Baby,
  Heart,
  Sparkles,
  BookOpen,
  ImageIcon
} from "lucide-react";

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

interface SmallBanner {
  id: number;
  title: string;
  description?: string;
  imageUrl: string;
  linkUrl?: string;
  href?: string;
  order?: number;
  isActive?: boolean;
}

interface PopularStyle {
  id: number;
  title: string;
  imageUrl: string;
  linkUrl: string;
  isActive: boolean;
  sortOrder: number;
}

interface MainGalleryItem {
  id: number;
  title: string;
  imageUrl: string;
  linkUrl: string;
  badge?: string;
  aspectRatio: 'square' | 'portrait' | 'landscape';
  isActive: boolean;
  sortOrder: number;
}

const getIconForTitle = (title: string) => {
  const iconMap: Record<string, any> = {
    "AI 초음파": Baby,
    "아기 얼굴 생성": Baby,
    "만삭사진": Camera,
    "만삭사진 만들기": Camera,
    "가족사진": Heart,
    "가족사진 만들기": Heart,
    "자장가": Music,
    "AI 도우미": MessageCircle,
    "내 갤러리": Images,
    "미션": Award,
    "포토북": BookOpen,
    "스냅사진": Camera,
    "스냅사진 만들기": Camera,
  };
  return iconMap[title] || ImageIcon;
};

const getGradientForTitle = (title: string) => {
  const gradientMap: Record<string, string> = {
    "AI 초음파": "from-violet-600/20 to-purple-600/20",
    "아기 얼굴 생성": "from-violet-600/20 to-purple-600/20",
    "만삭사진": "from-pink-600/20 to-rose-600/20",
    "만삭사진 만들기": "from-pink-600/20 to-rose-600/20",
    "가족사진": "from-orange-600/20 to-amber-600/20",
    "가족사진 만들기": "from-orange-600/20 to-amber-600/20",
    "자장가": "from-cyan-600/20 to-blue-600/20",
    "AI 도우미": "from-emerald-600/20 to-green-600/20",
    "내 갤러리": "from-indigo-600/20 to-blue-600/20",
    "미션": "from-yellow-600/20 to-orange-600/20",
    "포토북": "from-teal-600/20 to-cyan-600/20",
    "스냅사진": "from-rose-600/20 to-pink-600/20",
    "스냅사진 만들기": "from-rose-600/20 to-pink-600/20",
  };
  return gradientMap[title] || "from-zinc-600/20 to-zinc-600/20";
};

export default function Home() {
  const [, navigate] = useLocation();
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    if (!isPWAInstalled()) {
      setShowInstallButton(true);
    }

    const handleInstallPrompt = (e: Event) => {
      e.preventDefault();
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    
    if (pwaManager.canInstall) {
      setShowInstallButton(true);
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  const handleInstallPWA = async () => {
    if (isInstalling) return;

    if (isIOS()) {
      if (getBrowser() !== 'safari') {
        alert('iOS에서는 Safari 브라우저에서만 앱 설치가 가능합니다.\n\nSafari로 이동하여 설치해 주세요.');
        return;
      }
      window.location.href = '/pwa-install-guide';
      return;
    }

    const status = pwaManager.getStatus();
    
    if (!status.canInstall) {
      alert('PWA 설치를 위해서는 실제 배포된 사이트에서 접속해주세요.');
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
      alert('설치에 실패했습니다.');
    } finally {
      setIsInstalling(false);
    }
  };

  // 배너 데이터 가져오기
  const { data: banners, isLoading: bannersLoading } = useQuery({
    queryKey: ["/api/banners"],
    queryFn: async () => {
      const response = await fetch("/api/banners");
      if (!response.ok) throw new Error("배너 데이터를 가져오는데 실패했습니다");
      return response.json() as Promise<Banner[]>;
    }
  });

  // 인기스타일 데이터 가져오기
  const { data: popularStyles, isLoading: popularStylesLoading, error: popularStylesError } = useQuery({
    queryKey: ["/api/popular-styles"],
    queryFn: async () => {
      const response = await fetch("/api/popular-styles");
      if (!response.ok) throw new Error("인기스타일 데이터를 가져오는데 실패했습니다");
      return response.json() as Promise<PopularStyle[]>;
    }
  });

  // 메인갤러리 데이터 가져오기
  const { data: mainGalleryItems, isLoading: mainGalleryLoading, error: mainGalleryError } = useQuery({
    queryKey: ["/api/main-gallery"],
    queryFn: async () => {
      const response = await fetch("/api/main-gallery");
      if (!response.ok) throw new Error("메인갤러리 데이터를 가져오는데 실패했습니다");
      return response.json() as Promise<MainGalleryItem[]>;
    }
  });

  // 간단배너(메뉴카드) 데이터 가져오기
  const { data: smallBanners, isLoading: smallBannersLoading } = useQuery({
    queryKey: ["/api/small-banners"],
    queryFn: async () => {
      const response = await fetch("/api/small-banners");
      if (!response.ok) throw new Error("간단배너 데이터를 가져오는데 실패했습니다");
      return response.json() as Promise<SmallBanner[]>;
    }
  });

  const displayBanners = banners || [];

  if (bannersLoading || smallBannersLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black pb-20">
      {/* 섹션 1: 메뉴 카드 - 가로 스크롤 */}
      <section className="py-4 px-4">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {(smallBanners || [])
            .filter((banner: SmallBanner) => banner.isActive !== false)
            .map((banner: SmallBanner) => {
              const IconComponent = getIconForTitle(banner.title);
              const gradient = getGradientForTitle(banner.title);
              return (
                <div 
                  key={banner.id} 
                  onClick={() => navigate(banner.linkUrl || banner.href || "/")}
                  className={`
                    flex items-center gap-3 
                    min-w-[160px] h-[64px] 
                    px-4 rounded-2xl 
                    bg-gradient-to-br ${gradient}
                    bg-zinc-900/80 backdrop-blur-sm
                    border border-zinc-800/50
                    hover:border-zinc-700 hover:bg-zinc-800/80
                    transition-all duration-200 cursor-pointer
                    group
                  `}
                >
                  <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-zinc-800/80">
                    <IconComponent className="w-5 h-5 text-white/90" />
                  </div>
                  <span className="text-sm font-medium text-white/90 whitespace-nowrap flex-1">
                    {banner.title}
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-400 transition-colors" />
                </div>
              );
            })}
        </div>
      </section>

      {/* 섹션 2: 슬라이드 배너 - 3개 동시 표시 캐러셀 */}
      <section className="py-4 px-4">
        <FeaturedSlider items={displayBanners} />
      </section>

      {/* 섹션 3: 인기스타일 - 가로 스크롤 (데이터가 있을 때만 표시) */}
      {popularStyles && popularStyles.length > 0 && (
        <section className="py-6 px-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">인기 스타일</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {popularStyles.map((style: any) => (
              <Link key={style.id} href={style.linkUrl || "/maternity-styles"}>
                <div className="flex items-center gap-3 min-w-[180px] p-2 rounded-xl bg-zinc-900/60 border border-zinc-800/50 hover:bg-zinc-800/60 hover:border-zinc-700 transition-all cursor-pointer group">
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    <img 
                      src={style.imageUrl} 
                      alt={style.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <span className="text-sm font-medium text-white/90 whitespace-nowrap">
                    {style.title}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 섹션 4: 메인 갤러리 - Masonry 레이아웃 (데이터가 있을 때만 표시) */}
      {mainGalleryItems && mainGalleryItems.length > 0 && (
        <section className="py-6 px-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">추천 작품</h2>
          </div>
          
          {/* Row-first Grid - 가로 순서 우선 */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {mainGalleryItems.map((item: any) => {
              const aspectClass = 
                item.aspectRatio === 'portrait' ? 'aspect-[3/4]' :
                item.aspectRatio === 'landscape' ? 'aspect-[4/3]' : 'aspect-square';
              
              return (
                <Link key={item.id} href={item.linkUrl || "/gallery-simplified"}>
                  <div className="group cursor-pointer">
                    <div className={`relative ${aspectClass} rounded-2xl overflow-hidden bg-zinc-900`}>
                      <img 
                        src={item.imageUrl} 
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* 오버레이 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* 뱃지 */}
                      {item.badge && (
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-white/90 text-xs font-semibold text-zinc-900">
                          {item.badge}
                        </div>
                      )}
                      
                      {/* 제목 */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <p className="text-sm font-medium text-white truncate">{item.title}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* PWA 설치 버튼 */}
      {showInstallButton && (
        <div className="fixed bottom-0 left-0 right-0 z-50">
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-t-3xl shadow-2xl p-6">
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
    </div>
  );
}
