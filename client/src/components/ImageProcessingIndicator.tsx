import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useImageGenerationStore } from '@/stores/imageGenerationStore';

export function ImageProcessingIndicator() {
  const { hasActiveGeneration, getActiveGeneration } = useImageGenerationStore();
  const [backgroundTasks, setBackgroundTasks] = useState<string[]>([]);

  // 백그라운드 작업 상태 확인 (기존 시스템과의 호환성)
  useEffect(() => {
    const checkBackgroundTasks = () => {
      const tasks = localStorage.getItem('pendingImageTasks');
      if (tasks) {
        const taskList = JSON.parse(tasks);
        setBackgroundTasks(taskList);
      } else {
        setBackgroundTasks([]);
      }
    };

    // 초기 확인
    checkBackgroundTasks();
    
    // 주기적으로 확인 (1초마다)
    const interval = setInterval(checkBackgroundTasks, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // 전역 상태의 활성 생성 작업 또는 기존 백그라운드 작업이 있으면 표시
  const hasActivity = hasActiveGeneration() || backgroundTasks.length > 0;

  if (!hasActivity) return null;

  // 전역 상태의 활성 생성 작업이 있으면 우선 표시
  if (hasActiveGeneration()) {
    const activeGen = getActiveGeneration();
    const fileName = activeGen?.fileName || '이미지';

    return (
      <div className="flex items-center text-blue-600 gap-1.5 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 px-2.5 py-1 rounded-full">
        <Loader2 className="animate-spin h-3.5 w-3.5" />
        <span className="text-xs font-medium whitespace-nowrap">
          이미지 생성 중입니다...
        </span>
      </div>
    );
  }

  // 백그라운드 작업이 있으면 표시 (기존 시스템 호환성)
  if (backgroundTasks.length > 0) {
    return (
      <div className="flex items-center text-blue-600 gap-1.5 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 px-2.5 py-1 rounded-full">
        <Loader2 className="animate-spin h-3.5 w-3.5" />
        <span className="text-xs font-medium whitespace-nowrap">
          이미지 생성 중입니다...
        </span>
      </div>
    );
  }

  return null;
}