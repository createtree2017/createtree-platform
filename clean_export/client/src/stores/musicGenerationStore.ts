import { create } from 'zustand';

interface MusicGenerationState {
  isGenerating: boolean;
  generationMessage: string;
  setGenerating: (status: boolean, message?: string) => void;
}

// 음악 생성 상태 메시지 정의
const GENERATION_MESSAGES = {
  default: '🎵 음악 생성 중입니다...',
  lyrics: '📝 가사를 생성하고 있습니다...',
  melody: '🎼 멜로디를 만들고 있습니다...',
  processing: '⚙️ 음악을 처리하고 있습니다...',
  finalizing: '✨ 마지막 작업을 진행 중입니다...'
} as const;

export const useMusicGenerationStore = create<MusicGenerationState>((set) => ({
  isGenerating: false,
  generationMessage: GENERATION_MESSAGES.default,
  setGenerating: (status: boolean, message?: string) => {
    console.log('🎵 Store - setGenerating 호출됨:', status, message);
    set({ 
      isGenerating: status,
      generationMessage: message || GENERATION_MESSAGES.default
    });
    console.log('🎵 Store - 상태 업데이트 완료');
  }
}));