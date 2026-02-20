/**
 * BottomNavigation — 하단 네비게이션 컴포넌트
 * 
 * /api/main-menus API에서 활성화된 메뉴를 가져와 동적으로 렌더링
 * API 실패 시 하드코딩된 폴백 데이터 사용
 */

import React from 'react';
import { Link, useLocation } from 'wouter';
import { useMainMenus } from '@/hooks/useMainMenus';

// MAIN_PAGE_PATHS를 동적으로 제공하는 Hook (App.tsx에서 사용)
export { useMainMenus } from '@/hooks/useMainMenus';

// 폴백용 정적 경로 (React Hook 외부에서 사용하는 경우 대비)
export const MAIN_PAGE_PATHS = ['/', '/missions', '/gallery', '/profile'];

export default function BottomNavigation() {
  const [location] = useLocation();
  const { navItems } = useMainMenus();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      {/* 글래스모피즘 배경 */}
      <nav
        className="flex items-center justify-around bg-background/80 backdrop-blur-xl border-t border-border/50 px-2 h-20"
        style={{ boxShadow: '0 -2px 20px rgba(0,0,0,0.15)' }}
      >
        {navItems.map((item) => {
          const isActive = location === item.path;
          const IconComponent = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.ariaLabel}
              onClick={() => window.scrollTo(0, 0)}
              className="flex flex-col items-center justify-center flex-1 py-1.5 relative group"
            >
              {/* 아이콘 컨테이너 */}
              <div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300
                  ${isActive
                    ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 scale-110'
                    : 'group-hover:bg-muted/50 scale-100'
                  }
                `}
              >
                <IconComponent
                  size={22}
                  strokeWidth={isActive ? 2.2 : 1.5}
                  className={`transition-all duration-300 ${isActive
                    ? 'text-purple-500 dark:text-purple-400 drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
                    : 'text-muted-foreground group-hover:text-foreground'
                    }`}
                />
              </div>

              {/* 라벨 */}
              <span
                className={`text-[10px] font-semibold mt-0.5 transition-colors duration-300 ${isActive
                  ? 'text-purple-500 dark:text-purple-400'
                  : 'text-muted-foreground group-hover:text-foreground'
                  }`}
              >
                {item.label}
              </span>

              {/* 활성 인디케이터 도트 */}
              {isActive && (
                <div className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-gradient-to-r from-purple-500 to-pink-500" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}