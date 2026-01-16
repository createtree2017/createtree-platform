import { useEffect, useCallback, useRef, useState } from 'react';

interface UseUnsavedChangesGuardOptions {
  isDirty: boolean;
  onSave?: () => Promise<void>;
  warningMessage?: string;
}

interface UseUnsavedChangesGuardReturn {
  showExitDialog: boolean;
  setShowExitDialog: (show: boolean) => void;
  handleConfirmExit: () => void;
  handleCancelExit: () => void;
  handleSaveAndExit: () => Promise<void>;
  isSaving: boolean;
  guardedNavigate: (navigateFn: () => void) => void;
}

export function useUnsavedChangesGuard({
  isDirty,
  onSave,
  warningMessage = '저장하지 않은 변경사항이 있습니다. 정말 나가시겠습니까?',
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardReturn {
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const popstateHandled = useRef(false);
  const currentPathRef = useRef(window.location.pathname + window.location.search);

  useEffect(() => {
    currentPathRef.current = window.location.pathname + window.location.search;
  }, []);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = warningMessage;
      return warningMessage;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDirty, warningMessage]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isDirty && !popstateHandled.current) {
        const targetPath = window.location.pathname + window.location.search;
        
        window.history.pushState(null, '', currentPathRef.current);
        
        pendingNavigation.current = () => {
          popstateHandled.current = true;
          window.location.href = targetPath;
        };
        setShowExitDialog(true);
      } else if (popstateHandled.current) {
        popstateHandled.current = false;
      }
    };

    if (isDirty) {
      window.addEventListener('popstate', handlePopState);
      return () => {
        window.removeEventListener('popstate', handlePopState);
      };
    }
  }, [isDirty]);

  const handleConfirmExit = useCallback(() => {
    setShowExitDialog(false);
    if (pendingNavigation.current) {
      const nav = pendingNavigation.current;
      pendingNavigation.current = null;
      nav();
    }
  }, []);

  const handleCancelExit = useCallback(() => {
    setShowExitDialog(false);
    pendingNavigation.current = null;
  }, []);

  const handleSaveAndExit = useCallback(async () => {
    if (onSave) {
      setIsSaving(true);
      try {
        await onSave();
        setShowExitDialog(false);
        if (pendingNavigation.current) {
          const nav = pendingNavigation.current;
          pendingNavigation.current = null;
          nav();
        }
      } catch (error) {
        console.error('Save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }
  }, [onSave]);

  const guardedNavigate = useCallback((navigateFn: () => void) => {
    if (isDirty) {
      pendingNavigation.current = navigateFn;
      setShowExitDialog(true);
    } else {
      navigateFn();
    }
  }, [isDirty]);

  return {
    showExitDialog,
    setShowExitDialog,
    handleConfirmExit,
    handleCancelExit,
    handleSaveAndExit,
    isSaving,
    guardedNavigate,
  };
}
