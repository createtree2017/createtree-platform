import { useState, useEffect, useCallback } from 'react';
import { X, Plus, Loader2, Download, Pencil, Trash2, Check } from 'lucide-react';
import { UnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

export interface ProductProject {
  id: number;
  userId?: number;
  categoryId?: number;
  variantId?: number | null;
  title: string;
  status: string;
  designsData?: any;
  thumbnailUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductLoadModalProps {
  isOpen: boolean;
  productTypeName: string;
  projects: ProductProject[];
  isLoading: boolean;
  currentProjectId?: number | null;
  loadingProjectId?: number | null;
  downloadingProjectId?: number | null;
  onClose: () => void;
  onLoad: (projectId: number) => void;
  onCreate: () => void;
  onRename: (projectId: number, newTitle: string) => Promise<void>;
  onDelete: (project: ProductProject) => void;
  onDownload?: (projectId: number) => void;
  unsavedGuard?: UnsavedChangesGuard;
}

export const ProductLoadModal: React.FC<ProductLoadModalProps> = ({
  isOpen,
  productTypeName,
  projects,
  isLoading,
  currentProjectId,
  loadingProjectId,
  downloadingProjectId,
  onClose,
  onLoad,
  onCreate,
  onRename,
  onDelete,
  onDownload,
  unsavedGuard
}) => {
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [editingProjectTitle, setEditingProjectTitle] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setEditingProjectId(null);
      setEditingProjectTitle('');
    }
  }, [isOpen]);

  const handleClose = () => {
    setEditingProjectId(null);
    onClose();
  };

  const handleGuardedCreate = useCallback(() => {
    handleClose();
    if (unsavedGuard) {
      unsavedGuard.guardedNavigate(onCreate);
    } else {
      onCreate();
    }
  }, [unsavedGuard, onCreate]);

  const handleGuardedLoad = useCallback((projectId: number) => {
    if (unsavedGuard) {
      unsavedGuard.guardedNavigate(() => onLoad(projectId));
    } else {
      onLoad(projectId);
    }
  }, [unsavedGuard, onLoad]);

  const handleRename = async (projectId: number) => {
    if (!editingProjectTitle.trim()) return;
    setIsRenaming(true);
    try {
      await onRename(projectId, editingProjectTitle.trim());
      setEditingProjectId(null);
    } finally {
      setIsRenaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, projectId: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRename(projectId);
    } else if (e.key === 'Escape') {
      setEditingProjectId(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] z-10 overflow-hidden flex flex-col animate-in fade-in duration-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-bold text-gray-900">저장된 {productTypeName} 불러오기</h2>
          <button 
            onClick={handleClose}
            className="p-1 rounded-md hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4">
          <button
            onClick={handleGuardedCreate}
            className="w-full mb-4 p-4 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center justify-center space-x-2 text-indigo-700 font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>새 {productTypeName} 만들기</span>
          </button>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : !projects || projects.length === 0 ? (
            <div className="text-center text-gray-500 py-12">
              <p>저장된 {productTypeName}이(가) 없습니다.</p>
              <p className="text-sm mt-2">위 버튼을 눌러 새 {productTypeName}을(를) 만들어 보세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((project) => {
                const isCurrentProject = project.id === currentProjectId;
                const isEditing = editingProjectId === project.id;
                const isLoadingThis = loadingProjectId === project.id;
                
                return (
                  <div 
                    key={project.id}
                    onClick={() => !isCurrentProject && !isEditing && !isLoadingThis && handleGuardedLoad(project.id)}
                    className={`p-4 rounded-lg border transition-all relative ${
                      isCurrentProject 
                        ? 'border-indigo-300 bg-indigo-50 cursor-default' 
                        : isEditing || isLoadingThis
                          ? 'border-indigo-300 bg-white cursor-default'
                          : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50 cursor-pointer'
                    } ${isLoadingThis ? 'opacity-50' : ''}`}
                  >
                    {isLoadingThis && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg z-10">
                        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editingProjectTitle}
                              onChange={(e) => setEditingProjectTitle(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => handleKeyDown(e, project.id)}
                              className="flex-1 px-2 py-1 border border-indigo-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRename(project.id);
                              }}
                              disabled={isRenaming}
                              className="p-1 text-green-600 hover:bg-green-100 rounded-md transition-colors"
                            >
                              {isRenaming ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProjectId(null);
                              }}
                              className="p-1 text-gray-500 hover:bg-gray-100 rounded-md transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-medium text-gray-900 truncate">{project.title}</h3>
                            <p className="text-sm text-gray-500 mt-1">
                              수정: {formatDate(project.updatedAt)}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 ml-2 flex-shrink-0">
                        {!isEditing && (
                          <>
                            {onDownload && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDownload(project.id);
                                }}
                                disabled={downloadingProjectId === project.id}
                                className={`p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors ${downloadingProjectId === project.id ? 'opacity-50 cursor-wait' : ''}`}
                                title="다운로드"
                              >
                                {downloadingProjectId === project.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingProjectId(project.id);
                                setEditingProjectTitle(project.title);
                              }}
                              className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                              title="이름 변경"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(project);
                              }}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                        {isCurrentProject && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
                            현재 편집 중
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-end p-4 border-t bg-gray-50">
          <button 
            onClick={handleClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors font-medium text-sm"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  productTypeName: string;
  projectTitle: string;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  productTypeName,
  projectTitle,
  isDeleting = false,
  onClose,
  onConfirm
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full z-10 overflow-hidden animate-in fade-in duration-200">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">{productTypeName} 삭제</h3>
          </div>
          <p className="text-gray-600 mb-2">
            <span className="font-medium">"{projectTitle}"</span>을(를) 삭제하시겠습니까?
          </p>
          <p className="text-sm text-gray-500 mb-6">
            이 작업은 되돌릴 수 없으며, 모든 페이지와 데이터가 영구적으로 삭제됩니다.
          </p>
          <div className="flex space-x-3 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md transition-colors font-medium text-sm"
            >
              취소
            </button>
            <button
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-md transition-colors font-medium text-sm disabled:opacity-50"
            >
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
