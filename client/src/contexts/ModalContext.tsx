import { createContext, useContext, useCallback, useState, useEffect, useRef, ReactNode } from 'react';

export interface ModalInstance {
  id: string;
  instanceId: string;
  props: Record<string, unknown>;
}

interface ModalContextValue {
  modalStack: ModalInstance[];
  openModal: (id: string, props?: Record<string, unknown>) => string;
  closeTopModal: () => void;
  closeAllModals: () => void;
  isModalOpen: (id: string) => boolean;
  getModalProps: <T extends Record<string, unknown>>(id: string) => T | null;
  getTopModal: () => ModalInstance | null;
}

const ModalContext = createContext<ModalContextValue | null>(null);

interface ModalProviderProps {
  children: ReactNode;
}

let instanceCounter = 0;
function generateInstanceId(modalId: string): string {
  return `${modalId}-${++instanceCounter}`;
}

const propsStore = new Map<string, Record<string, unknown>>();

interface ModalHistoryEntry {
  id: string;
  instanceId: string;
}

interface ModalHistoryState {
  modalEntries?: ModalHistoryEntry[];
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [modalStack, setModalStack] = useState<ModalInstance[]>([]);
  const isNavigatingRef = useRef(false);

  const rebuildStackFromHistory = useCallback((): ModalInstance[] => {
    const state = window.history.state as ModalHistoryState | null;
    const entries = state?.modalEntries || [];
    
    return entries.map((entry) => ({
      id: entry.id,
      instanceId: entry.instanceId,
      props: propsStore.get(entry.instanceId) || {},
    }));
  }, []);

  useEffect(() => {
    const initialStack = rebuildStackFromHistory();
    if (initialStack.length > 0) {
      setModalStack(initialStack);
    }
  }, [rebuildStackFromHistory]);

  const openModal = useCallback((id: string, props: Record<string, unknown> = {}): string => {
    const instanceId = generateInstanceId(id);
    
    propsStore.set(instanceId, props);
    
    const currentState = window.history.state as ModalHistoryState | null;
    const currentEntries = currentState?.modalEntries || [];
    const newEntries: ModalHistoryEntry[] = [...currentEntries, { id, instanceId }];
    
    // 기존 URL(pathname + search)을 보존하면서 pushState 실행
    const currentUrl = window.location.pathname + window.location.search + window.location.hash;
    
    window.history.pushState(
      { modalEntries: newEntries },
      '',
      currentUrl
    );
    
    setModalStack((prev) => [...prev, { id, instanceId, props }]);
    
    return instanceId;
  }, []);

  const closeTopModal = useCallback(() => {
    if (modalStack.length === 0) return;
    if (isNavigatingRef.current) return;
    
    isNavigatingRef.current = true;
    window.history.back();
  }, [modalStack.length]);

  const closeAllModals = useCallback(() => {
    if (modalStack.length === 0) return;
    if (isNavigatingRef.current) return;
    
    isNavigatingRef.current = true;
    window.history.go(-modalStack.length);
  }, [modalStack.length]);

  const isModalOpen = useCallback((id: string) => {
    return modalStack.some((m) => m.id === id);
  }, [modalStack]);

  const getModalProps = useCallback(<T extends Record<string, unknown>>(id: string): T | null => {
    const modal = modalStack.find((m) => m.id === id);
    return modal ? (modal.props as T) : null;
  }, [modalStack]);

  const getTopModal = useCallback((): ModalInstance | null => {
    return modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;
  }, [modalStack]);

  useEffect(() => {
    const handlePopState = () => {
      isNavigatingRef.current = false;
      
      const newStack = rebuildStackFromHistory();
      
      setModalStack((prevStack) => {
        const removedInstances = prevStack
          .filter((m) => !newStack.some((n) => n.instanceId === m.instanceId))
          .map((m) => m.instanceId);
        
        removedInstances.forEach((instanceId) => {
          propsStore.delete(instanceId);
        });
        
        return newStack;
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [rebuildStackFromHistory]);

  useEffect(() => {
    if (modalStack.length > 0) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalStack.length]);

  const value: ModalContextValue = {
    modalStack,
    openModal,
    closeTopModal,
    closeAllModals,
    isModalOpen,
    getModalProps,
    getTopModal,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

export function useModalContext(): ModalContextValue {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }
  return context;
}
