import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, Palette } from 'lucide-react';
import { useState } from 'react';

interface StudioProject {
  id: number;
  title: string;
  category: string;
  thumbnailUrl?: string;
}

interface StudioPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: StudioProject[];
  isLoading: boolean;
  onSelect: (project: StudioProject) => void;
}

export function StudioPickerModal({
  isOpen,
  onClose,
  projects,
  isLoading,
  onSelect
}: StudioPickerModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);

  const handleConfirm = () => {
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      if (project) {
        onSelect(project);
        onClose(); // 제출 후 모달 닫기
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>제작소에서 작업물 선택</DialogTitle>
          <DialogDescription>
            제작소에서 만든 작업물 중 하나를 선택하세요
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 py-4">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-lg" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12">
              <Palette className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-muted-foreground">제작소에 작업물이 없습니다</p>
              <p className="text-sm text-muted-foreground mt-1">먼저 제작소에서 작업물을 만들어주세요</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => setSelectedProjectId(project.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all group ${selectedProjectId === project.id
                    ? 'border-purple-600 ring-2 ring-purple-200 ring-offset-2'
                    : 'border-gray-200 hover:border-purple-500 hover:scale-105'
                    }`}
                >
                  {project.thumbnailUrl ? (
                    <img
                      src={project.thumbnailUrl}
                      alt={project.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <Palette className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  {selectedProjectId === project.id && (
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <CheckCircle className="h-8 w-8 text-white bg-purple-600 rounded-full p-1" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1.5 truncate text-left">
                    {project.title}
                  </div>
                  <div className="absolute top-1 left-1 bg-purple-500/80 text-white text-xs px-1.5 py-0.5 rounded">
                    {project.category}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} className="mr-2">
            취소
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedProjectId}
            className="bg-purple-600 hover:bg-purple-700"
          >
            확인
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
