import GalleryEmbedSimple from "@/components/GalleryEmbedSimple";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { ImageIcon } from "lucide-react";
import { GalleryFilterKey } from "@shared/constants";

export default function Gallery() {
  const [location] = useLocation();
  
  const params = new URLSearchParams(window.location.search);
  const filterParam = params.get('filter') as GalleryFilterKey | null;
  const initialFilter = filterParam || "all";

  return (
    <div className="min-h-screen p-6">
      <div className="w-full">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">나의 갤러리</h1>
          <p className="text-gray-300 mb-4">소중한 추억의 모든 모먼트 공간</p>
          
          {/* 콜라주 만들기 버튼 */}
          <Link href="/gallery-collage">
            <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white">
              <ImageIcon className="mr-2 h-4 w-4" />
              콜라주 만들기
            </Button>
          </Link>
        </div>

        {/* 통합 갤러리 */}
        <div className="rounded-2xl p-6 shadow-lg bg-gray-800 border border-gray-700">
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