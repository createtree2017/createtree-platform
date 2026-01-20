import { useCallback } from 'react';
import { Plus, Pencil, LucideIcon } from 'lucide-react';
import { UnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

interface ProductStartupModalProps {
  isOpen: boolean;
  productTypeName: string;
  ProductIcon: LucideIcon;
  projectCount: number;
  onCreate: () => void;
  onLoad: () => void;
  onGoHome: () => void;
  unsavedGuard?: UnsavedChangesGuard;
}

export function ProductStartupModal({
  isOpen,
  productTypeName,
  ProductIcon,
  projectCount,
  onCreate,
  onLoad,
  onGoHome,
  unsavedGuard,
}: ProductStartupModalProps) {
  const handleGuardedCreate = useCallback(() => {
    if (unsavedGuard) {
      unsavedGuard.guardedNavigate(onCreate);
    } else {
      onCreate();
    }
  }, [unsavedGuard, onCreate]);

  const handleGuardedLoad = useCallback(() => {
    if (unsavedGuard) {
      unsavedGuard.guardedNavigate(onLoad);
    } else {
      onLoad();
    }
  }, [unsavedGuard, onLoad]);

  const handleGuardedGoHome = useCallback(() => {
    if (unsavedGuard) {
      unsavedGuard.guardedNavigate(onGoHome);
    } else {
      onGoHome();
    }
  }, [unsavedGuard, onGoHome]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4 border border-gray-200 shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
            <ProductIcon className="w-8 h-8 text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 text-center">{productTypeName} 에디터</h2>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={handleGuardedCreate}
            className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
          >
            <Plus className="w-12 h-12 text-indigo-600 mb-2" />
            <span className="text-gray-900 font-medium">새 프로젝트</span>
          </button>
          
          <button
            onClick={handleGuardedLoad}
            className="flex flex-col items-center justify-center p-6 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors border border-gray-200"
          >
            <Pencil className="w-12 h-12 text-green-600 mb-2" />
            <span className="text-gray-900 font-medium">불러오기</span>
            {projectCount > 0 && (
              <span className="text-xs text-gray-600 mt-1">{projectCount}개 프로젝트</span>
            )}
          </button>
        </div>
        
        <button
          onClick={handleGuardedGoHome}
          className="w-full py-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
