import { create } from 'zustand';

interface MusicGenerationState {
  isGenerating: boolean;
  setGenerating: (status: boolean) => void;
}

export const useMusicGenerationStore = create<MusicGenerationState>((set) => ({
  isGenerating: false,
  setGenerating: (status: boolean) => {
    console.log('🎵 Store - setGenerating 호출됨:', status);
    set({ isGenerating: status });
    console.log('🎵 Store - 상태 업데이트 완료');
  }
}));