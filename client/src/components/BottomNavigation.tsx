import React from 'react';
import { Link, useLocation } from 'wouter';
import { Target, Sparkles, Images, User } from 'lucide-react';

interface NavItem {
  path: string;
  icon: React.ForwardRefExoticComponent<any>;
  label: string;
  ariaLabel: string;
}

// 메인 페이지 경로 목록 (이 경로에서만 하단바 표시)
export const MAIN_PAGE_PATHS = ['/', '/missions', '/gallery', '/profile'];

export default function BottomNavigation() {
  const [location] = useLocation();

  const navItems: NavItem[] = [
    {
      path: '/missions',
      icon: Target,
      label: '문화센터',
      ariaLabel: '문화센터 페이지',
    },
    {
      path: '/',
      icon: Sparkles,
      label: 'AI 생성',
      ariaLabel: 'AI 이미지 생성 페이지',
    },
    {
      path: '/gallery',
      icon: Images,
      label: '갤러리',
      ariaLabel: '이미지 갤러리 페이지',
    },
    {
      path: '/profile',
      icon: User,
      label: 'MY',
      ariaLabel: '마이페이지',
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 safe-area-bottom">
      {/* 글래스모피즘 배경 */}
      <nav
        className="flex items-center justify-around bg-background/80 backdrop-blur-xl border-t border-border/50 px-2 h-16"
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