import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { Save, X } from "lucide-react";

interface SmallBanner {
  id?: number;
  title: string;
  description?: string;
  imageSrc: string;
  href?: string;
  isActive: boolean;
  order: number;
}

interface SmallBannerFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  banner?: SmallBanner | null;
  onSubmit: (data: Omit<SmallBanner, 'id'>) => void;
  isPending?: boolean;
}

export function SmallBannerFormModal({ isOpen, onClose, mode, banner, onSubmit, isPending }: SmallBannerFormModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Omit<SmallBanner, 'id'>>({
    title: banner?.title || "",
    description: banner?.description || "",
    imageSrc: banner?.imageSrc || "",
    href: banner?.href || "",
    isActive: banner?.isActive ?? true,
    order: banner?.order || 0,
  });

  const handleImageUpload = async (file: File) => {
    try {
      const uploadData = new FormData();
      uploadData.append('banner', file);
      uploadData.append('bannerType', 'small');

      const response = await fetch('/api/admin/upload/banner', {
        method: 'POST',
        body: uploadData,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      setFormData(prev => ({ ...prev, imageSrc: result.url || result.imageSrc }));
      
      toast({
        title: "업로드 완료",
        description: "이미지가 성공적으로 업로드되었습니다.",
      });
    } catch (error) {
      toast({
        title: "업로드 실패",
        description: "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: "입력 오류",
        description: "배너 제목을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.imageSrc.trim()) {
      toast({
        title: "입력 오류",
        description: "이미지를 업로드해주세요.",
        variant: "destructive",
      });
      return;
    }

    onSubmit(formData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'edit' ? "배너 수정" : "새 배너 추가"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">제목 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="배너 제목을 입력하세요"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="배너 설명을 입력하세요"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="href">이동 링크</Label>
            <Input
              id="href"
              value={formData.href}
              onChange={(e) => setFormData(prev => ({ ...prev, href: e.target.value }))}
              placeholder="/maternity-photo 또는 https://example.com"
            />
          </div>

          <div>
            <Label htmlFor="order">정렬 순서</Label>
            <Input
              id="order"
              type="number"
              value={formData.order}
              onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
              placeholder="0"
            />
          </div>

          <div>
            <Label>배너 이미지 *</Label>
            <div className="mt-2 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="이미지 URL을 입력하세요"
                  value={formData.imageSrc}
                  onChange={(e) => setFormData(prev => ({ ...prev, imageSrc: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <FileUpload
                  onFileSelect={handleImageUpload}
                  accept="image/*"
                  className="w-auto"
                />
              </div>
              {formData.imageSrc && (
                <div className="mt-3">
                  <img 
                    src={formData.imageSrc} 
                    alt="미리보기" 
                    className="w-20 h-20 object-cover rounded border"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
              className="rounded"
            />
            <Label htmlFor="isActive">활성화</Label>
          </div>

          <div className="flex space-x-2 pt-4">
            <Button type="submit" className="flex-1" disabled={isPending}>
              <Save className="w-4 h-4 mr-2" />
              {mode === 'edit' ? "수정" : "생성"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              <X className="w-4 h-4 mr-2" />
              취소
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
