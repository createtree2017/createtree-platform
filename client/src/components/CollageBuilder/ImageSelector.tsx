import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, ImageIcon, X, Plus, Smartphone, Images } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// ── 타입 정의 ──────────────────────────────────────────────
export type SelectedImage =
  | { type: 'gallery'; id: number }
  | { type: 'device'; localId: string; file: File; previewUrl: string };

interface ImageSelectorProps {
  selectedLayout: '2' | '6' | '12' | '24' | null;
  selectedImages: SelectedImage[];
  onImageAdd: (image: SelectedImage) => void;
  onImageRemove: (index: number) => void;
  onClearAll: () => void;
}

interface GalleryImage {
  id: number;
  title: string;
  url: string;
  thumbnailUrl?: string;
  transformedUrl?: string;
  type: string;
}

type TabType = 'gallery' | 'device';

// ── 컴포넌트 ───────────────────────────────────────────────
export default function CollageImageSelector({
  selectedLayout,
  selectedImages,
  onImageAdd,
  onImageRemove,
  onClearAll,
}: ImageSelectorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('gallery');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requiredCount = selectedLayout ? parseInt(selectedLayout) : 0;
  const canAddMore = selectedImages.length < requiredCount;

  // 갤러리 API
  const { data: galleryImages = [], isLoading } = useQuery<GalleryImage[]>({
    queryKey: ['/api/gallery'],
    queryFn: async () => {
      const res = await fetch('/api/gallery');
      if (!res.ok) throw new Error('갤러리 조회 실패');
      return res.json();
    },
    enabled: !!selectedLayout,
  });

  // 갤러리 이미지 선택 횟수 맵
  const galleryCountMap: Record<number, number> = {};
  selectedImages.forEach((img) => {
    if (img.type === 'gallery') {
      galleryCountMap[img.id] = (galleryCountMap[img.id] || 0) + 1;
    }
  });

  // 레이아웃 변경 시 탭 초기화
  useEffect(() => {
    setActiveTab('gallery');
  }, [selectedLayout]);

  // 디바이스 파일 선택
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => {
      if (!canAddMore) return;
      const localId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const previewUrl = URL.createObjectURL(file);
      onImageAdd({ type: 'device', localId, file, previewUrl });
    });
    // input 초기화 (같은 파일 재선택 가능하게)
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── 분할 미선택 상태 ───────────────────────────────────
  if (!selectedLayout) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
          <ImageIcon className="h-7 w-7 text-gray-600" />
        </div>
        <p className="text-gray-400 text-sm font-medium">위에서 분할을 선택하면</p>
        <p className="text-gray-600 text-xs mt-1">이미지를 추가할 수 있어요</p>
      </div>
    );
  }

  // ── 이미지 그리드 공통 렌더러 ──────────────────────────
  function SelectedImageStrip() {
    if (selectedImages.length === 0) return null;
    return (
      <div className="flex gap-2 overflow-x-auto py-1 mb-3 scrollbar-hide">
        {selectedImages.map((img, idx) => {
          const src =
            img.type === 'gallery'
              ? galleryImages.find((g) => g.id === img.id)?.thumbnailUrl ||
                galleryImages.find((g) => g.id === img.id)?.url ||
                ''
              : img.previewUrl;
          return (
            <div key={idx} className="relative flex-shrink-0 w-12 h-12 group">
              <img
                src={src}
                alt={`선택 ${idx + 1}`}
                className="w-full h-full object-cover rounded-lg border border-gray-600"
              />
              <div className="absolute -bottom-1 -left-1 bg-purple-600 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {idx + 1}
              </div>
              <button
                onClick={() => onImageRemove(idx)}
                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  // ── 갤러리 탭 컨텐츠 ───────────────────────────────────
  function GalleryContent() {
    if (isLoading) {
      return (
        <div className="grid grid-cols-3 gap-2">
          {[...Array(9)].map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-xl" />
          ))}
        </div>
      );
    }

    if (galleryImages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <ImageIcon className="h-10 w-10 text-gray-600 mb-3" />
          <p className="text-gray-400 text-sm">갤러리에 이미지가 없어요</p>
          <p className="text-gray-600 text-xs mt-1">이미지를 먼저 생성해주세요</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-3 gap-2">
        {galleryImages.map((image) => {
          const count = galleryCountMap[image.id] || 0;
          const isSelected = count > 0;
          const disabled = !canAddMore && !isSelected;

          return (
            <button
              key={image.id}
              onClick={() =>
                !disabled && onImageAdd({ type: 'gallery', id: image.id })
              }
              disabled={disabled}
              className={`
                relative aspect-square rounded-xl overflow-hidden border-2 transition-all
                ${isSelected
                  ? 'border-purple-500 ring-2 ring-purple-500/30'
                  : disabled
                  ? 'border-gray-700 opacity-40 cursor-not-allowed'
                  : 'border-gray-700 hover:border-purple-400 hover:scale-[1.02]'}
              `}
            >
              <img
                src={image.transformedUrl || image.thumbnailUrl || image.url}
                alt={image.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {isSelected && (
                <div className="absolute inset-0 bg-purple-600/20 flex items-end justify-end p-1">
                  <div className="bg-purple-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {count > 1 ? count : <CheckCircle2 className="h-3 w-3" />}
                  </div>
                </div>
              )}
              {!isSelected && !disabled && (
                <div className="absolute inset-0 bg-black/0 hover:bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Plus className="h-7 w-7 text-white drop-shadow-lg" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // ── 디바이스 탭 컨텐츠 ─────────────────────────────────
  function DeviceContent() {
    const deviceImages = selectedImages.filter((img) => img.type === 'device');

    return (
      <div>
        {/* 업로드 버튼 */}
        <button
          onClick={() => canAddMore && fileInputRef.current?.click()}
          disabled={!canAddMore}
          className={`
            w-full flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed transition-all mb-4
            ${canAddMore
              ? 'border-purple-500/50 text-purple-400 hover:border-purple-400 hover:bg-purple-500/5 cursor-pointer'
              : 'border-gray-700 text-gray-600 cursor-not-allowed'}
          `}
        >
          <Plus className={`h-5 w-5 ${canAddMore ? 'text-purple-400' : 'text-gray-600'}`} />
          <span className="text-sm font-medium">
            {canAddMore ? '사진 추가하기' : '선택 완료'}
          </span>
        </button>

        {/* 선택한 디바이스 이미지 그리드 */}
        {deviceImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Smartphone className="h-10 w-10 text-gray-600 mb-3" />
            <p className="text-gray-400 text-sm">디바이스 사진을 추가해보세요</p>
            <p className="text-gray-600 text-xs mt-1">위 버튼을 눌러 선택하세요</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {deviceImages.map((img) => {
              if (img.type !== 'device') return null;
              const idx = selectedImages.findIndex(
                (s) => s.type === 'device' && s.localId === img.localId
              );
              return (
                <div key={img.localId} className="relative aspect-square group">
                  <img
                    src={img.previewUrl}
                    alt="업로드 이미지"
                    className="w-full h-full object-cover rounded-xl border-2 border-purple-500"
                  />
                  <button
                    onClick={() => onImageRemove(idx)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-1 shadow-md"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── 메인 렌더 ──────────────────────────────────────────
  return (
    <div>
      {/* 카운터 + 전체 해제 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">
            선택된 이미지
          </span>
          <span
            className={`text-sm font-bold px-2 py-0.5 rounded-full ${
              selectedImages.length === requiredCount
                ? 'bg-green-500/20 text-green-400'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            {selectedImages.length}/{requiredCount}개
          </span>
        </div>
        {selectedImages.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors flex items-center gap-1"
          >
            <X className="h-3 w-3" />
            전체 해제
          </button>
        )}
      </div>

      {/* 선택 이미지 스트립 */}
      <SelectedImageStrip />

      {/* 탭 전환 */}
      <div className="flex gap-1.5 mb-4 p-1 bg-gray-800 rounded-xl">
        {[
          { key: 'gallery' as TabType, icon: Images, label: '갤러리 선택' },
          { key: 'device' as TabType, icon: Smartphone, label: '디바이스 첨부' },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all
              ${activeTab === key
                ? 'bg-gray-700 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-300'}
            `}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {activeTab === 'gallery' ? <GalleryContent /> : <DeviceContent />}

      {/* 숨김 파일 input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}