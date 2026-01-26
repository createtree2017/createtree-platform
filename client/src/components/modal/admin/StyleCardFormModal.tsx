import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { Save, X } from "lucide-react";

interface StyleCard {
  id?: number;
  title: string;
  description?: string;
  imageSrc: string;
  category?: string;
  link?: string;
  isActive: boolean;
}

interface StyleCardFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  styleCard?: StyleCard | null;
  onSubmit: (data: Omit<StyleCard, 'id'>) => void;
  isPending?: boolean;
}

export function StyleCardFormModal({ isOpen, onClose, mode, styleCard, onSubmit, isPending }: StyleCardFormModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Omit<StyleCard, 'id'>>({
    title: styleCard?.title || "",
    description: styleCard?.description || "",
    imageSrc: styleCard?.imageSrc || "",
    category: styleCard?.category || "",
    link: styleCard?.link || "",
    isActive: styleCard?.isActive ?? true,
  });

  const handleImageUpload = async (file: File) => {
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);

      const response = await fetch('/api/admin/upload/thumbnail', {
        method: 'POST',
        body: uploadData,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      setFormData(prev => ({ ...prev, imageSrc: result.url }));
      
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
        description: "스타일 제목을 입력해주세요.",
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
            {mode === 'edit' ? "스타일 카드 수정" : "새 스타일 카드 추가"}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="title">스타일 제목 *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="예: 디즈니 스타일"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="스타일에 대한 설명을 입력하세요"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="category">카테고리</Label>
            <Input
              id="category"
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              placeholder="스타일 분류용 (예: 일러스트, 사진, 만화)"
            />
            <p className="text-xs text-gray-500 mt-1">스타일 카드를 분류하기 위한 카테고리명을 입력하세요</p>
          </div>

          <div>
            <Label htmlFor="link">이동 링크</Label>
            <Input
              id="link"
              type="text"
              value={formData.link}
              onChange={(e) => setFormData(prev => ({ ...prev, link: e.target.value }))}
              placeholder="/maternity-photo 또는 https://example.com"
            />
            <p className="text-xs text-gray-500 mt-1">사용자가 이 스타일 카드를 클릭했을 때 이동할 페이지 URL을 입력하세요</p>
          </div>

          <div>
            <Label>미리보기 이미지 *</Label>
            <div className="mt-2">
              <FileUpload
                onFileSelect={handleImageUpload}
                accept="image/*"
                maxFileSize={10 * 1024 * 1024}
                className="w-full"
              />
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
