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

  // 세션 스토리지에서 갤러리 탭 상태 불러오기 (새로고침/뒤로가기 시 유지)
  const [activeMainTab, setActiveMainTab] = useState<'image' | 'studio'>(() => {
    // 만약 파라미터나 외부에서 명시적으로 studio-gallery로 접근하려 했다면 우선 처리
    if (location === '/studio-gallery') return 'studio';
    return (sessionStorage.getItem('gallery_activeMainTab') as 'image' | 'studio') || 'image';
  });

  // 상태 변경 시 세션 스토리지에 저장
  useEffect(() => {
    sessionStorage.setItem('gallery_activeMainTab', activeMainTab);
  }, [activeMainTab]);

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
                onClick={() => setActiveMainTab('image')}
              >
                <Images className="mr-2 h-4 w-4" />
                이미지갤러리
              </Button>
              <Button
                variant={activeMainTab === 'studio' ? "default" : "outline"}
                className={activeMainTab === 'studio' ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white" : ""}
                onClick={() => setActiveMainTab('studio')}
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