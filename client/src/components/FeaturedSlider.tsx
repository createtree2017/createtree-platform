import { useState, useCallback, useEffect } from 'react';
import useEmblaCarousel from 'embla-carousel-react';
import { Link } from 'wouter';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface FeaturedItem {
  id: number;
  title: string;
  description: string;
  imageSrc: string;
  href: string;
  isNew?: boolean;
  slideInterval?: number;
  transitionEffect?: string;
}

interface FeaturedSliderProps {
  items: FeaturedItem[];
  title?: string;
}

export default function FeaturedSlider({ items, title }: FeaturedSliderProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    align: 'start',
    slidesToScroll: 1,
    containScroll: 'trimSnaps',
    dragFree: false,
  });
  
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on('select', onSelect);
    onSelect();
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  // 자동 슬라이드 기능
  useEffect(() => {
    if (!emblaApi || items.length === 0) return;
    
    const getCurrentSlideInterval = () => {
      const currentIndex = emblaApi.selectedScrollSnap();
      const currentItem = items[currentIndex];
      return currentItem?.slideInterval || 5000;
    };
    
    let autoplayInterval: NodeJS.Timeout;
    
    const setNextSlide = () => {
      emblaApi.scrollNext();
      const interval = getCurrentSlideInterval();
      autoplayInterval = setTimeout(setNextSlide, interval);
    };
    
    const initialInterval = getCurrentSlideInterval();
    autoplayInterval = setTimeout(setNextSlide, initialInterval);
    
    const handleSelect = () => {
      clearTimeout(autoplayInterval);
      const interval = getCurrentSlideInterval();
      autoplayInterval = setTimeout(setNextSlide, interval);
    };
    
    emblaApi.on('select', handleSelect);
    
    return () => {
      clearTimeout(autoplayInterval);
      emblaApi.off('select', handleSelect);
    };
  }, [emblaApi, items]);

  if (items.length === 0) {
    return (
      <div className="w-full aspect-[16/9] bg-zinc-900 rounded-2xl flex items-center justify-center">
        <p className="text-zinc-500">배너가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="relative group">
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white text-lg font-semibold">{title}</h2>
        </div>
      )}
      
      <div className="overflow-hidden rounded-2xl" ref={emblaRef}>
        <div className="flex gap-3">
          {items.map((item, index) => (
            <Link 
              key={item.id} 
              href={item.href}
              className="relative flex-shrink-0 w-[85%] md:w-[calc(33.333%-8px)] overflow-hidden rounded-2xl group/card"
              onClick={() => window.scrollTo(0, 0)}
            >
              {/* 카드 컨테이너 */}
              <div className="relative aspect-[16/10] bg-zinc-900 overflow-hidden">
                <img 
                  src={item.imageSrc} 
                  alt={item.title} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                />
                
                {/* 그라데이션 오버레이 */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                
                {/* 신규 배지 */}
                {item.isNew && (
                  <div className="absolute top-3 left-3 px-2 py-1 bg-rose-500 text-white text-xs font-bold rounded-md">
                    NEW
                  </div>
                )}
                
                {/* 텍스트 콘텐츠 */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white font-semibold text-sm md:text-base line-clamp-1 mb-1">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-zinc-300 text-xs line-clamp-2">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
      
      {/* 좌우 화살표 버튼 - PC에서만 표시 */}
      {items.length > 3 && (
        <>
          <button
            onClick={scrollPrev}
            className="hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-all opacity-0 group-hover:opacity-100"
            aria-label="이전 슬라이드"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={scrollNext}
            className="hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white transition-all opacity-0 group-hover:opacity-100"
            aria-label="다음 슬라이드"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
      
      {/* 도트 인디케이터 */}
      {scrollSnaps.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              onClick={() => emblaApi?.scrollTo(index)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === selectedIndex 
                  ? 'bg-white w-6' 
                  : 'bg-zinc-600 w-1.5 hover:bg-zinc-500'
              }`}
              aria-label={`슬라이드 ${index + 1}로 이동`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
