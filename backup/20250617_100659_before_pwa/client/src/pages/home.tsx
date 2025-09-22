import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import PolioCard from "@/components/PolioCard";
import FeaturedSlider from "@/components/FeaturedSlider";
import { useAuthContext } from "@/lib/AuthProvider";
import { Loader2 } from "lucide-react";
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
      {/* 배너 슬라이더 - PC에서는 최대 너비 제한 */}
      <section className="mb-6 px-2 md:px-4 pt-2">
        <div className="max-w-screen-xl mx-auto">
          <FeaturedSlider 
            items={displayBanners} 
          />
        </div>
      </section>

      {/* 작은 배너 섹션 */}
      {smallBanners && smallBanners.length > 0 && (
        <section className="mb-8 px-4">
          <div className="max-w-screen-xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {smallBanners
                .filter((banner: any) => banner.isActive)
                .map((banner: any) => (
                <Link key={banner.id} href={banner.href || "#"}>
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
      
      {/* 하단 여백 */}
      <div className="h-8"></div>
    </div>
  );
}
