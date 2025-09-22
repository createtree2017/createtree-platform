import GalleryEmbedSimple from "@/components/GalleryEmbedSimple";

export default function Gallery() {
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">나의 갤러리</h1>
          <p className="text-gray-300">소중한 추억의 모든 모먼트 공간</p>
        </div>

        {/* 통합 갤러리 */}
        <div className="rounded-2xl p-6 shadow-lg bg-gray-800 border border-gray-700">
          <GalleryEmbedSimple 
            maxItems={50}
            showFilters={true}
            columns={3}
          />
        </div>
      </div>
    </div>
  );
}