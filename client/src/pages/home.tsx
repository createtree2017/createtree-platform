import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import FeaturedSlider from "@/components/FeaturedSlider";
import Masonry from "react-masonry-css";
import { Loader2 } from "lucide-react";
import {
  Smile,
  Aperture,
  Heart,
  Palette,
  Sticker,
  LayoutGrid,
  ImageIcon
} from "lucide-react";
import { GlowingButton } from "@/components/ui/glowing-button";

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
    "아기 얼굴 생성": Smile,
    "스냅사진 만들기": Aperture,
    "만삭사진 만들기": Heart,
    "사진스타일 바꾸기": Palette,
    "스티커 만들기": Sticker,
  };
  return iconMap[title] || ImageIcon;
};

const getGlowColorForTitle = (title: string) => {
  const glowMap: Record<string, string> = {
    "아기 얼굴 생성": "#a3e635",
    "스냅사진 만들기": "#ec4899",
    "만삭사진 만들기": "#22d3ee",
    "사진스타일 바꾸기": "#f59e0b",
    "스티커 만들기": "#8b5cf6",
  };
  return glowMap[title] || "#a3e635";
};

export default function Home() {
  const [, navigate] = useLocation();


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
    <div className="min-h-screen bg-background pb-20">
      {/* 섹션 1: 메뉴 카드 - 2단 그리드 (모바일) / 가로 나열 (데스크톱) */}
      <section className="py-4 px-4">
        <div className="flex flex-wrap gap-3">
          {(smallBanners || [])
            .filter((banner: SmallBanner) => banner.isActive !== false)
            .map((banner: SmallBanner) => {
              const IconComponent = getIconForTitle(banner.title);
              const glowColor = getGlowColorForTitle(banner.title);
              return (
                <div key={banner.id} className="w-[calc(50%-6px)] md:w-auto md:min-w-[160px]">
                  <GlowingButton
                    glowColor={glowColor}
                    onClick={() => navigate(banner.linkUrl || banner.href || "/")}
                    icon={<IconComponent className="w-4 h-4 md:w-5 md:h-5 text-foreground/90" />}
                  >
                    {banner.title}
                  </GlowingButton>
                </div>
              );
            })}
          {/* 콜라주 정적 버튼 */}
          <div className="w-[calc(50%-6px)] md:w-auto md:min-w-[160px]">
            <GlowingButton
              glowColor="#f43f5e"
              onClick={() => navigate("/gallery-collage")}
              icon={<LayoutGrid className="w-4 h-4 md:w-5 md:h-5 text-foreground/90" />}
            >
              콜라주
            </GlowingButton>
          </div>
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
            <h2 className="text-lg font-semibold text-foreground">인기 스타일</h2>
          </div>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
            {popularStyles.map((style: any) => (
              <Link key={style.id} href={style.linkUrl || "/maternity-styles"}>
                <div className="flex items-center gap-3 min-w-[180px] p-2 rounded-xl bg-card/60 border border-border/50 hover:bg-accent/60 hover:border-border transition-all cursor-pointer group">
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={style.imageUrl}
                      alt={style.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <span className="text-sm font-medium text-foreground/90 whitespace-nowrap">
                    {style.title}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 섹션 4: 메인 갤러리 - Masonry 레이아웃 (가로 순서 + masonry UI) */}
      {mainGalleryItems && mainGalleryItems.length > 0 && (
        <section className="py-6 px-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">추천 작품</h2>
          </div>

          <Masonry
            breakpointCols={{
              default: 5,
              1279: 4,
              1023: 3,
              767: 2
            }}
            className="flex -ml-3"
            columnClassName="pl-3"
          >
            {mainGalleryItems.map((item: any) => {
              const aspectClass =
                item.aspectRatio === 'portrait' ? 'aspect-[3/4]' :
                  item.aspectRatio === 'landscape' ? 'aspect-[4/3]' : 'aspect-square';

              return (
                <Link key={item.id} href={item.linkUrl || "/gallery-simplified"}>
                  <div className="group cursor-pointer mb-3">
                    <div className={`relative ${aspectClass} rounded-2xl overflow-hidden bg-muted`}>
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      {/* 오버레이 */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                      {/* 뱃지 */}
                      {item.badge && (
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-background/90 text-xs font-semibold text-foreground">
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
          </Masonry>
        </section>
      )}


    </div>
  );
}
