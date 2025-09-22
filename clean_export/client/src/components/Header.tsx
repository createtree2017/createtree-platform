import React from 'react';
import { Link } from 'wouter';
import { Bell, Search, Home, Image, Music, MessageCircle, User } from 'lucide-react';
import { ImageProcessingIndicator } from './ImageProcessingIndicator';
import { useMusicGenerationStore } from '@/stores/musicGenerationStore';

export default function Header() {
  const { isGenerating, setGenerating } = useMusicGenerationStore();

  return (
    <header className="sticky top-0 z-40 w-full bg-gradient-to-r from-primary-lavender to-primary-mint safe-area-top shadow-md">
      <div className="mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <h1 className="text-xl font-semibold tracking-tight text-neutral-darkest font-heading">
            <span className="text-white">Mom's</span> <span className="text-neutral-darkest">Service</span>
          </h1>
        </Link>
        
        {/* Navigation - Visible on larger screens */}
        <nav className="hidden md:flex items-center space-x-8">
          <Link href="/" className="text-white font-medium hover:text-neutral-darkest transition-colors font-body">
            홈
          </Link>
          <Link href="/image" className="text-white font-medium hover:text-neutral-darkest transition-colors font-body">
            추억 예술
          </Link>
          <Link href="/music" className="text-white font-medium hover:text-neutral-darkest transition-colors font-body">
            자장가
          </Link>
          <Link href="/chat" className="text-white font-medium hover:text-neutral-darkest transition-colors font-body">
            AI 도우미
          </Link>
        </nav>
        
        {/* Processing indicators and Action icons */}
        <div className="flex items-center space-x-3">
          {/* 이미지 생성 상태 표시 */}
          <ImageProcessingIndicator />
          
          {/* 음악 생성 상태 표시 */}
          {isGenerating && (
            <button 
              onClick={() => {
                setGenerating(false);
                console.log('🎵 사용자가 수동으로 로딩 상태 해제');
              }}
              className="bg-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium animate-pulse hover:bg-purple-600 transition-colors cursor-pointer"
              title="클릭하여 로딩 상태 해제"
            >
              🎵 음악 생성 중입니다... (클릭시 해제)
            </button>
          )}
          
          <button 
            className="w-10 h-10 flex items-center justify-center text-white hover:text-neutral-darkest transition-colors rounded-full bg-white/20 hover:bg-white/30" 
            aria-label="Search"
          >
            <Search size={20} />
          </button>
          <button 
            className="w-10 h-10 flex items-center justify-center text-white hover:text-neutral-darkest transition-colors rounded-full bg-white/20 hover:bg-white/30"
            aria-label="Notifications"
          >
            <Bell size={20} />
          </button>
        </div>
      </div>
    </header>
  );
}