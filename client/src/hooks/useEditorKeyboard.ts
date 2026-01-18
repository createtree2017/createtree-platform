/**
 * 제작소 에디터 공통 키보드 이벤트 Hook
 * 모든 에디터(포토북, 엽서, 행사)에서 공유하는 키보드 핸들링
 */

import { useEffect, useCallback } from 'react';

export interface UseEditorKeyboardConfig {
  selectedObjectId: string | null;
  onDeleteObject: (id: string) => void;
  onSpacePressed: (pressed: boolean) => void;
}

export function useEditorKeyboard(config: UseEditorKeyboardConfig) {
  const { selectedObjectId, onDeleteObject, onSpacePressed } = config;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInputField = ['INPUT', 'TEXTAREA'].includes(target.tagName);

    if (e.code === 'Space' && !isInputField) {
      e.preventDefault();
      onSpacePressed(true);
    }

    if ((e.code === 'Delete' || e.code === 'Backspace') && !isInputField && selectedObjectId) {
      onDeleteObject(selectedObjectId);
    }
  }, [selectedObjectId, onDeleteObject, onSpacePressed]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code === 'Space') {
      onSpacePressed(false);
    }
  }, [onSpacePressed]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);
}
