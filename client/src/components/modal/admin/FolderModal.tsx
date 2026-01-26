import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

interface FolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingFolder?: { id: number; name: string; color: string } | null;
  onSave: (data: { name: string; color: string }) => Promise<void>;
  isPending?: boolean;
}

export function FolderModal({ isOpen, onClose, editingFolder, onSave, isPending = false }: FolderModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => {
    if (editingFolder) {
      setName(editingFolder.name);
      setColor(editingFolder.color);
    } else {
      setName('');
      setColor('#6366f1');
    }
  }, [editingFolder, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) return;
    await onSave({ name: name.trim(), color });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingFolder ? '폴더 수정' : '새 폴더 생성'}
          </DialogTitle>
          <DialogDescription>
            폴더를 사용하여 미션을 그룹화할 수 있습니다.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">폴더 이름</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="폴더 이름을 입력하세요"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">폴더 색상</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded cursor-pointer border-0"
              />
              <div className="flex gap-2">
                {['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full ${color === c ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button 
            onClick={handleSave}
            disabled={isPending || !name.trim()}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {editingFolder ? '수정' : '생성'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
