import GalleryEmbedSimple from "@/components/GalleryEmbedSimple";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Images, Palette } from "lucide-react";
import { GalleryFilterKey } from "@shared/constants";
import { useAuthContext } from "@/lib/AuthProvider";
import { isSuperAdmin } from "@/lib/auth-utils";

export default function Gallery() {
  const [location] = useLocation();
  const { user } = useAuthContext();
  const showStudioGallery = user && isSuperAdmin(user.memberType as any);

  const params = new URLSearchParams(window.location.search);
  const filterParam = params.get('filter') as GalleryFilterKey | null;
  const initialFilter = filterParam || "all";

  return (
    <div className="min-h-screen p-6">
      <div className="w-full">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">나의 갤러리</h1>
          <p className="text-muted-foreground mb-4">소중한 추억의 모든 모먼트 공간</p>

          {/* 갤러리 전환 버튼 - 최고관리자에게만 제작소갤러리 표시 */}
          {showStudioGallery && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <Button
                variant="default"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
              >
                <Images className="mr-2 h-4 w-4" />
                이미지갤러리
              </Button>
              <Link href="/studio-gallery">
                <Button variant="outline">
                  <Palette className="mr-2 h-4 w-4" />
                  제작소갤러리
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* 통합 갤러리 */}
        <div className="rounded-2xl p-6 shadow-lg bg-card border border-border">
          <GalleryEmbedSimple
            filter={initialFilter}
            maxItems={50}
            showFilters={true}
            columns={3}
          />
        </div>
      </div>
    </div>
  );
}