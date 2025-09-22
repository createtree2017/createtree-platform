import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Save, X } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";

interface SmallBanner {
  id: number;
  title: string;
  description?: string;
  imageSrc: string;    // 기존 배너 스키마에 맞춤
  href?: string;       // 기존 배너 스키마에 맞춤
  isActive: boolean;
  order: number;
  createdAt: string;
}

export default function SmallBannerManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<SmallBanner | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageSrc: "",  // 기존 배너 스키마에 맞춤
    href: "",      // 기존 배너 스키마에 맞춤  
    isActive: true,
    order: 0
  });

  // 작은 배너 목록 조회
  const { data: banners = [], isLoading } = useQuery<SmallBanner[]>({
    queryKey: ["/api/small-banners"],
    queryFn: async () => {
      const response = await fetch('/api/small-banners');
      if (!response.ok) throw new Error('Failed to fetch small banners');
      return response.json();
    }
  });

  // 작은 배너 생성 API 사용
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/admin/create-small-banner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create small banner');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/small-banners"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "성공",
        description: "배너가 성공적으로 생성되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "생성 실패",
        description: "배너 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 기존 배너 수정 API 사용
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/admin/small-banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update banner');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/small-banners"] });
      setIsCreateDialogOpen(false);
      setEditingBanner(null);
      resetForm();
      toast({
        title: "성공",
        description: "배너가 성공적으로 수정되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "수정 실패",
        description: "배너 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 기존 배너 삭제 API 사용
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/small-banners/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete banner');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/small-banners"] });
      toast({
        title: "성공",
        description: "배너가 성공적으로 삭제되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "배너 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      imageSrc: "",  // 기존 배너 스키마에 맞춤
      href: "",      // 기존 배너 스키마에 맞춤
      isActive: true,
      order: 0
    });
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

    if (editingBanner) {
      updateMutation.mutate({ id: editingBanner.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (banner: SmallBanner) => {
    setEditingBanner(banner);
    setFormData({
      title: banner.title,
      description: banner.description || "",
      imageSrc: banner.imageSrc,
      href: banner.href || "",
      isActive: banner.isActive,
      order: banner.order
    });
  };

  const handleImageUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bannerType', 'small'); // small-banners 폴더에 저장

      const response = await fetch('/api/admin/upload/banner', {
        method: 'POST',
        body: formData,
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

  const handleDelete = (id: number) => {
    if (window.confirm("정말로 이 배너를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">배너를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">작은 배너 관리</h3>
          <p className="text-gray-600 mt-1">메인 페이지에 표시할 작은 배너를 관리합니다</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingBanner(null); }}>
              <Plus className="w-4 h-4 mr-2" />
              새 배너 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBanner ? "배너 수정" : "새 배너 추가"}
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
                <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingBanner ? "수정" : "생성"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingBanner(null);
                    resetForm();
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  취소
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 배너 목록 */}
      <div className="grid gap-4">
        {banners.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            등록된 배너가 없습니다.
          </div>
        ) : (
          banners.map((banner: SmallBanner) => (
            <div key={banner.id} className="flex items-center space-x-4 p-4 border rounded-lg">
              <img 
                src={banner.imageSrc} 
                alt={banner.title}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <h4 className="font-medium">{banner.title}</h4>
                {banner.description && (
                  <p className="text-sm text-gray-600 mt-1">{banner.description}</p>
                )}
                {banner.href && (
                  <p className="text-xs text-blue-600 mt-1">링크: {banner.href}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  순서: {banner.order} | {banner.isActive ? '활성' : '비활성'}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    handleEdit(banner);
                    setIsCreateDialogOpen(true);
                  }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(banner.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}