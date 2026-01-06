import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Save, X, Palette } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { apiRequest } from "@/lib/queryClient";
import ConceptPickerModal from "./ConceptPickerModal";

interface MainGalleryItem {
  id: number;
  title: string;
  imageUrl: string;
  linkUrl?: string;
  badge?: string;
  aspectRatio: 'square' | 'portrait' | 'landscape';
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

export default function MainGalleryManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isConceptPickerOpen, setIsConceptPickerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MainGalleryItem | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    imageUrl: "",
    linkUrl: "",
    badge: "",
    aspectRatio: "square" as 'square' | 'portrait' | 'landscape',
    isActive: true,
    sortOrder: 0
  });

  const { data: items = [], isLoading } = useQuery<MainGalleryItem[]>({
    queryKey: ["/api/admin/main-gallery"],
    queryFn: async () => {
      const response = await fetch('/api/admin/main-gallery');
      if (!response.ok) throw new Error('Failed to fetch main gallery items');
      return response.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/admin/main-gallery', {
        method: 'POST',
        data: {
          ...data,
          sortOrder: Number(data.sortOrder) || 0
        }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/main-gallery"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({ title: "성공", description: "메인갤러리 항목이 성공적으로 생성되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "생성 실패", description: error.message || "메인갤러리 항목 생성 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await apiRequest(`/api/admin/main-gallery/${id}`, {
        method: 'PUT',
        data: {
          ...data,
          sortOrder: Number(data.sortOrder) || 0
        }
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/main-gallery"] });
      setIsCreateDialogOpen(false);
      setEditingItem(null);
      resetForm();
      toast({ title: "성공", description: "메인갤러리 항목이 성공적으로 수정되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "수정 실패", description: error.message || "메인갤러리 항목 수정 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest(`/api/admin/main-gallery/${id}`, {
        method: 'DELETE'
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/main-gallery"] });
      toast({ title: "성공", description: "메인갤러리 항목이 성공적으로 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ title: "삭제 실패", description: error.message || "메인갤러리 항목 삭제 중 오류가 발생했습니다.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      title: "",
      imageUrl: "",
      linkUrl: "",
      badge: "",
      aspectRatio: "square",
      isActive: true,
      sortOrder: 0
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({ title: "입력 오류", description: "제목을 입력해주세요.", variant: "destructive" });
      return;
    }

    if (!formData.imageUrl.trim()) {
      toast({ title: "입력 오류", description: "이미지를 업로드해주세요.", variant: "destructive" });
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (item: MainGalleryItem) => {
    setEditingItem(item);
    setFormData({
      title: item.title,
      imageUrl: item.imageUrl,
      linkUrl: item.linkUrl || "",
      badge: item.badge || "",
      aspectRatio: item.aspectRatio,
      isActive: item.isActive,
      sortOrder: item.sortOrder
    });
  };

  const handleImageUpload = async (file: File) => {
    try {
      const formDataObj = new FormData();
      formDataObj.append('banner', file);
      formDataObj.append('bannerType', 'main-gallery');

      const response = await fetch('/api/admin/upload/banner', {
        method: 'POST',
        body: formDataObj,
      });

      if (!response.ok) throw new Error('Upload failed');
      
      const result = await response.json();
      setFormData(prev => ({ ...prev, imageUrl: result.url || result.imageSrc }));
      
      toast({ title: "업로드 완료", description: "이미지가 성공적으로 업로드되었습니다." });
    } catch (error) {
      toast({ title: "업로드 실패", description: "이미지 업로드 중 오류가 발생했습니다.", variant: "destructive" });
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("정말로 이 메인갤러리 항목을 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleConceptSelect = (concept: { title: string; imageUrl: string; linkUrl: string; conceptId: string }) => {
    setFormData(prev => ({
      ...prev,
      title: concept.title,
      imageUrl: concept.imageUrl,
      linkUrl: concept.linkUrl,
    }));
  };

  const getAspectRatioLabel = (ratio: string) => {
    switch (ratio) {
      case 'square': return '정사각형';
      case 'portrait': return '세로형';
      case 'landscape': return '가로형';
      default: return ratio;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">메인갤러리를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">메인갤러리 관리</h3>
          <p className="text-gray-600 mt-1">메인 페이지에 표시할 갤러리 항목을 관리합니다</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingItem(null); }}>
              <Plus className="w-4 h-4 mr-2" />
              새 갤러리 항목 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "갤러리 항목 수정" : "새 갤러리 항목 추가"}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">제목 *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="갤러리 항목 제목을 입력하세요"
                  required
                />
              </div>

              <div>
                <Label htmlFor="linkUrl">이동 링크</Label>
                <Input
                  id="linkUrl"
                  value={formData.linkUrl}
                  onChange={(e) => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))}
                  placeholder="/maternity-photo 또는 https://example.com"
                />
              </div>

              <div>
                <Label htmlFor="badge">뱃지 텍스트</Label>
                <Input
                  id="badge"
                  value={formData.badge}
                  onChange={(e) => setFormData(prev => ({ ...prev, badge: e.target.value }))}
                  placeholder="NEW, HOT, 추천 등"
                />
              </div>

              <div>
                <Label htmlFor="aspectRatio">비율</Label>
                <Select 
                  value={formData.aspectRatio} 
                  onValueChange={(value: 'square' | 'portrait' | 'landscape') => setFormData(prev => ({ ...prev, aspectRatio: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="비율 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="square">정사각형</SelectItem>
                    <SelectItem value="portrait">세로형</SelectItem>
                    <SelectItem value="landscape">가로형</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="sortOrder">정렬 순서</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  placeholder="0"
                />
              </div>

              <div>
                <Label>이미지 *</Label>
                <div className="mt-2 space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsConceptPickerOpen(true)}
                    className="w-full border-dashed border-purple-400 text-purple-600 hover:bg-purple-50"
                  >
                    <Palette className="w-4 h-4 mr-2" />
                    스타일에서 선택
                  </Button>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span>또는 직접 입력</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="이미지 URL을 입력하세요"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <FileUpload
                      onFileSelect={handleImageUpload}
                      accept="image/*"
                      className="w-auto"
                    />
                  </div>
                  {formData.imageUrl && (
                    <div className="mt-3">
                      <img 
                        src={formData.imageUrl} 
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
                  {editingItem ? "수정" : "생성"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingItem(null);
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

      <div className="grid gap-4">
        {items.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            등록된 메인갤러리 항목이 없습니다.
          </div>
        ) : (
          items.map((item: MainGalleryItem) => (
            <div key={item.id} className="flex items-center space-x-4 p-4 border rounded-lg">
              <img 
                src={item.imageUrl} 
                alt={item.title}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{item.title}</h4>
                  {item.badge && (
                    <span className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded">{item.badge}</span>
                  )}
                </div>
                {item.linkUrl && (
                  <p className="text-xs text-blue-600 mt-1">링크: {item.linkUrl}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  비율: {getAspectRatioLabel(item.aspectRatio)} | 순서: {item.sortOrder} | {item.isActive ? '활성' : '비활성'}
                </p>
              </div>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    handleEdit(item);
                    setIsCreateDialogOpen(true);
                  }}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(item.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <ConceptPickerModal
        open={isConceptPickerOpen}
        onOpenChange={setIsConceptPickerOpen}
        onSelect={handleConceptSelect}
      />
    </div>
  );
}
