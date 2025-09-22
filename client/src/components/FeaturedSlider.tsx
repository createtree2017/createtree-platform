import React, { useState, useCallback, useEffect } from 'react';
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
  // 현재 전환 효과 가져오기
  const getCurrentTransitionEffect = () => {
    if (items.length === 0) return "fade";
    const currentIndex = selectedIndex;
    const currentItem = items[currentIndex];
    return currentItem?.transitionEffect || "fade";
  };

  const [emblaRef, emblaApi] = useEmblaCarousel({ 
    loop: true,
    // 전환 효과를 위해 Embla 애니메이션 비활성화
    duration: 0
  });
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const newIndex = emblaApi.selectedScrollSnap();
    setIsTransitioning(true);
    setSelectedIndex(newIndex);
    
    // 전환 효과 지속 시간 후 상태 리셋
    setTimeout(() => setIsTransitioning(false), 800);
  }, [emblaApi]);



  useEffect(() => {
    if (!emblaApi) return;
    
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on('select', onSelect);
    
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  // 자동 슬라이드 기능 - 동적 시간 적용
  useEffect(() => {
    if (!emblaApi || items.length === 0) return;
    
    // 현재 슬라이드의 시간 설정을 가져오거나 기본값 사용
    const getCurrentSlideInterval = () => {
      const currentIndex = emblaApi.selectedScrollSnap();
      const currentItem = items[currentIndex];
      return currentItem?.slideInterval || 5000;
    };
    
    let autoplayInterval: NodeJS.Timeout;
    
    const setNextSlide = () => {
      setIsTransitioning(true);
      emblaApi.scrollNext();
      const interval = getCurrentSlideInterval();
      autoplayInterval = setTimeout(setNextSlide, interval);
    };
    
    // 초기 설정
    const initialInterval = getCurrentSlideInterval();
    autoplayInterval = setTimeout(setNextSlide, initialInterval);
    
    // 슬라이드 변경 시 타이머 재설정
    const handleSelect = () => {
      clearTimeout(autoplayInterval);
      setIsTransitioning(true);
      const interval = getCurrentSlideInterval();
      autoplayInterval = setTimeout(setNextSlide, interval);
    };
    
    emblaApi.on('select', handleSelect);
    
    return () => {
      clearTimeout(autoplayInterval);
      emblaApi.off('select', handleSelect);
    };
  }, [emblaApi, items]);

  return (
    <div className="relative">
      {title && (
        <div className="flex items-center justify-between mb-6 px-4">
          <h2 className="text-white text-xl md:text-2xl font-medium">{title}</h2>
        </div>
      )}
      
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex">
          {items.map((item, index) => {
            const transitionEffect = item.transitionEffect || "fade";
            const isActive = index === selectedIndex;
            
            // 전환 효과별 클래스와 스타일 정의
            const getTransitionStyles = () => {
              const baseClass = "w-full h-full object-cover group-hover:scale-105";
              
              switch (transitionEffect) {
                case "fade":
                  return {
                    className: `${baseClass} transition-opacity duration-700`,
                    style: { opacity: isActive ? 1 : 0.3 }
                  };
                case "slide":
                  return {
                    className: `${baseClass} transition-transform duration-700`,
                    style: { transform: isActive ? 'translateX(0)' : 'translateX(20px)' }
                  };
                case "zoom":
                  return {
                    className: `${baseClass} transition-transform duration-700`,
                    style: { transform: isActive ? 'scale(1)' : 'scale(0.95)' }
                  };
                case "cube":
                  return {
                    className: `${baseClass} transition-transform duration-700`,
                    style: { 
                      transform: isActive ? 'perspective(1000px) rotateY(0deg)' : 'perspective(1000px) rotateY(-15deg)',
                      transformOrigin: 'center'
                    }
                  };
                case "flip":
                  return {
                    className: `${baseClass} transition-transform duration-700`,
                    style: { 
                      transform: isActive ? 'perspective(1000px) rotateX(0deg)' : 'perspective(1000px) rotateX(-10deg)',
                      transformOrigin: 'center'
                    }
                  };
                default:
                  return {
                    className: `${baseClass} transition-all duration-700`,
                    style: {}
                  };
              }
            };
            
            const transitionStyles = getTransitionStyles();

            return (
              <Link 
                key={item.id} 
                href={item.href}
                className="relative min-w-full block aspect-[4/5] md:aspect-[16/9] overflow-hidden group"
                onClick={() => {
                  // 슬라이드 배너 클릭 시 스크롤을 최상단으로 리셋
                  window.scrollTo(0, 0);
                }}
              >
                {/* 풀스크린 이미지 */}
                <div className="absolute inset-0">
                  <img 
                    src={item.imageSrc} 
                    alt={item.title} 
                    className={transitionStyles.className}
                    style={transitionStyles.style}
                  />
                </div>
                
                {/* 신규 배지 */}
                {item.isNew && (
                  <div className="absolute top-4 right-4 px-3 py-1 bg-[#FF4D6D] text-white text-xs font-bold rounded-md z-10">
                    신규
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      </div>
      

      
      {/* 이미지 내부 도트 인디케이터 */}
      {scrollSnaps.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex justify-center gap-2 bg-black/30 rounded-full px-3 py-2">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              onClick={() => emblaApi?.scrollTo(index)}
              className={`h-2 rounded-full transition-all ${
                index === selectedIndex 
                  ? 'bg-white w-6' 
                  : 'bg-white/50 w-2 hover:bg-white/70'
              }`}
              aria-label={`슬라이드 ${index + 1}로 이동`}
            />
          ))}
        </div>
      )}
    </div>
  );
}