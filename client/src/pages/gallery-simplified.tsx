import { useState, useEffect } from "react";
import GalleryEmbedSimple from "@/components/GalleryEmbedSimple";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Images, Palette } from "lucide-react";
import { GalleryFilterKey } from "@shared/constants";
import { useAuthContext } from "@/lib/AuthProvider";
import { isSuperAdmin } from "@/lib/auth-utils";

// 제작소 갤러리 컴포넌트 임포트
import StudioGalleryPage from "./studio-gallery";

export default function Gallery() {
  const [location] = useLocation();
  const { user } = useAuthContext();
  const showStudioGallery = user && isSuperAdmin(user.memberType as any);

  const params = new URLSearchParams(window.location.search);
  const filterParam = params.get('filter') as GalleryFilterKey | null;
  const initialFilter = filterParam || "all";

  // URL 파라미터에서 탭 상태 읽기 (기본값: image)
  const getTabFromUrl = () => {
    const currentParams = new URLSearchParams(window.location.search);
    const tabParam = currentParams.get('tab');
    if (tabParam === 'studio') return 'studio';
    // 구버전 호환성: /studio-gallery 경로로 접근 시 스튜디오 탭으로 간주
    if (location === '/studio-gallery') return 'studio';
    return 'image';
  };

  const [activeMainTab, setActiveMainTab] = useState<'image' | 'studio'>(getTabFromUrl);

  // 탭 변경 시 상태 업데이트 및 URL 덮어쓰기 (replaceState)
  const handleTabChange = (newTab: 'image' | 'studio') => {
    setActiveMainTab(newTab);
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('tab', newTab);
    
    // pushState 대신 replaceState를 사용하여 뒤로가기 지옥(History Bloat) 방지
    const newUrl = `${window.location.pathname}?${currentParams.toString()}`;
    window.history.replaceState({}, '', newUrl);
  };

  // 브라우저 뒤로가기/앞으로가기 시 탭 상태 훅 동기화
  useEffect(() => {
    const handlePopState = () => {
      setActiveMainTab(getTabFromUrl());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location]);

  return (
    <div className="min-h-screen p-6">
      <div className="w-full">
        {/* 헤더 부분 */}
        <div className="text-center mb-8">
          {/* 갤러리 전환 버튼 - 최고관리자에게만 제작소갤러리 표시 */}
          {showStudioGallery && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant={activeMainTab === 'image' ? "default" : "outline"}
                className={activeMainTab === 'image' ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white" : ""}
                onClick={() => handleTabChange('image')}
              >
                <Images className="mr-2 h-4 w-4" />
                이미지갤러리
              </Button>
              <Button
                variant={activeMainTab === 'studio' ? "default" : "outline"}
                className={activeMainTab === 'studio' ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white" : ""}
                onClick={() => handleTabChange('studio')}
              >
                <Palette className="mr-2 h-4 w-4" />
                제작소갤러리
              </Button>
            </div>
          )}
        </div>

        {/* 선택된 탭 내용 렌더링 */}
        {activeMainTab === 'image' ? (
          <div className="rounded-2xl p-6 shadow-lg bg-card border border-border">
            <GalleryEmbedSimple
              filter={initialFilter}
              maxItems={50}
              showFilters={true}
              columns={3}
            />
          </div>
        ) : (
          <div className="mt-[-2rem]"> {/* 스튜디오 헤더와 간격 조정 */}
            <StudioGalleryPage isEmbedded={true} />
          </div>
        )}
      </div>
    </div>
  );
}