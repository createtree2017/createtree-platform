import { ComponentType, lazy, Suspense, LazyExoticComponent } from 'react';
import { useModalContext, ModalInstance } from '../../contexts/ModalContext';
import { Loader2 } from 'lucide-react';

type ModalComponent<P = Record<string, unknown>> = ComponentType<P & { isOpen: boolean; onClose: () => void }>;

// 디스플레이 모드: 'modal' (기존 팝업) 또는 'bottomSheet' (바텀시트)
export type ModalDisplayMode = 'modal' | 'bottomSheet';

interface ModalRegistryEntry {
  component: ModalComponent<any> | LazyExoticComponent<ModalComponent<any>>;
  lazy: boolean;
  displayMode: ModalDisplayMode;
}

const modalRegistry: Map<string, ModalRegistryEntry> = new Map();

export function registerModal(
  id: string,
  component: any,
  options: { lazy?: boolean; displayMode?: ModalDisplayMode } = {}
): void {
  modalRegistry.set(id, {
    component,
    lazy: options.lazy || false,
    displayMode: options.displayMode || 'bottomSheet', // 기본값: 바텀시트
  });
}

export function registerLazyModal<P extends Record<string, unknown>>(
  id: string,
  importFn: () => Promise<{ default: ModalComponent<P> }>,
  options: { displayMode?: ModalDisplayMode } = {}
): void {
  const LazyComponent = lazy(importFn);
  modalRegistry.set(id, {
    component: LazyComponent,
    lazy: true,
    displayMode: options.displayMode || 'bottomSheet', // 기본값: 바텀시트
  });
}

export function unregisterModal(id: string): void {
  modalRegistry.delete(id);
}

export function getRegisteredModalIds(): string[] {
  return Array.from(modalRegistry.keys());
}

function ModalLoadingFallback() {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-background rounded-lg p-6 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>로딩 중...</span>
      </div>
    </div>
  );
}

function ModalRenderer({ modal, isTop }: { modal: ModalInstance; isTop: boolean }) {
  const { closeTopModal } = useModalContext();

  const entry = modalRegistry.get(modal.id);
  if (!entry) {
    console.warn(`Modal "${modal.id}" is not registered in ModalRegistry`);
    return null;
  }

  const Component = entry.component;
  const handleClose = () => {
    if (isTop) {
      closeTopModal();
    }
  };

  // Dialog/AlertDialog 컴포넌트가 이미 바텀시트 스타일로 렌더링됨
  if (entry.lazy) {
    return (
      <Suspense fallback={<ModalLoadingFallback />}>
        <Component
          isOpen={true}
          onClose={handleClose}
          {...modal.props}
        />
      </Suspense>
    );
  }

  return (
    <Component
      isOpen={true}
      onClose={handleClose}
      {...modal.props}
    />
  );
}

export function ModalContainer() {
  const { modalStack } = useModalContext();

  if (modalStack.length === 0) {
    return null;
  }

  return (
    <>
      {modalStack.map((modal, index) => {
        const isTop = index === modalStack.length - 1;
        return (
          <div
            key={modal.instanceId}
            style={{ zIndex: 50 + index }}
            className="fixed inset-0"
          >
            <ModalRenderer modal={modal} isTop={isTop} />
          </div>
        );
      })}
    </>
  );
}
