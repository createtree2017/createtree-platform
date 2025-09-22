import { create } from 'zustand';

interface ImageGenerationState {
  // 현재 생성 중인 작업들
  activeGenerations: Map<string, {
    categoryId: string;
    fileName: string;
    style: string;
    startTime: number;
  }>;
  
  // 생성 중인 작업이 있는지 확인
  hasActiveGeneration: () => boolean;
  
  // 특정 카테고리에서 생성 중인지 확인
  isGeneratingForCategory: (categoryId: string) => boolean;
  
  // 생성 작업 시작
  startGeneration: (id: string, data: {
    categoryId: string;
    fileName: string;
    style: string;
  }) => void;
  
  // 생성 작업 완료
  completeGeneration: (id: string) => void;
  
  // 모든 생성 작업 정리
  clearAllGenerations: () => void;
  
  // 현재 생성 중인 작업 정보 가져오기
  getActiveGeneration: () => {
    categoryId: string;
    fileName: string;
    style: string;
    startTime: number;
  } | null;
}

export const useImageGenerationStore = create<ImageGenerationState>((set, get) => ({
  activeGenerations: new Map(),
  
  hasActiveGeneration: () => {
    return get().activeGenerations.size > 0;
  },
  
  isGeneratingForCategory: (categoryId: string) => {
    const generations = get().activeGenerations;
    const entries = Array.from(generations.values());
    return entries.some(data => data.categoryId === categoryId);
  },
  
  startGeneration: (id: string, data) => {
    set((state) => {
      const newGenerations = new Map(state.activeGenerations);
      newGenerations.set(id, {
        ...data,
        startTime: Date.now()
      });
      console.log('🚀 전역 상태: 이미지 생성 시작', { id, data });
      return { activeGenerations: newGenerations };
    });
  },
  
  completeGeneration: (id: string) => {
    set((state) => {
      const newGenerations = new Map(state.activeGenerations);
      newGenerations.delete(id);
      console.log('✅ 전역 상태: 이미지 생성 완료', { id });
      return { activeGenerations: newGenerations };
    });
  },
  
  clearAllGenerations: () => {
    set(() => {
      console.log('🧹 전역 상태: 모든 생성 작업 정리');
      return { activeGenerations: new Map() };
    });
  },
  
  getActiveGeneration: () => {
    const generations = get().activeGenerations;
    if (generations.size === 0) return null;
    
    // 가장 최근 시작된 작업 반환
    let latest = null;
    let latestTime = 0;
    
    Array.from(generations.values()).forEach(data => {
      if (data.startTime > latestTime) {
        latestTime = data.startTime;
        latest = data;
      }
    });
    
    return latest;
  }
}));