import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Image, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileUpload } from "@/components/ui/file-upload";

interface StyleCard {
  id: number;
  title: string;
  description?: string;
  imageSrc: string;
  category?: string;
  link?: string;
  isActive: boolean;
  createdAt: string;
}

export default function StyleCardManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<StyleCard | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    imageSrc: "",
    category: "",
    link: "",
    isActive: true
  });
  const [errors, setErrors] = useState({
    title: "",
    imageSrc: "",
    link: ""
  });

  // 스타일 카드 목록 조회
  const { data: styleCards = [], isLoading } = useQuery({
    queryKey: ["/api/style-cards"],
    queryFn: async () => {
      const response = await fetch('/api/style-cards');
      if (!response.ok) throw new Error('Failed to fetch style cards');
      return response.json();
    },
  });

  // 스타일 카드 생성
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      console.log("🚀 클라이언트에서 테스트 API로 요청 보냄:", data);
      const response = await fetch('/api/test-style-card-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create style card');
      const result = await response.json();
      console.log("✅ 서버 응답:", result);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-cards"] });
      setIsCreateDialogOpen(false);
      resetForm();
      toast({
        title: "스타일 카드 생성 완료",
        description: "새로운 AI 이미지 스타일이 성공적으로 추가되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "생성 실패",
        description: "스타일 카드 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  // 스타일 카드 수정
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/admin/style-cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update style card');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-cards"] });
      setEditingCard(null);
      resetForm();
      toast({
        title: "수정 완료",
        description: "스타일 카드가 성공적으로 수정되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "수정 실패",
        description: "스타일 카드 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  // 스타일 카드 삭제
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/style-cards/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete style card');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/style-cards"] });
      toast({
        title: "삭제 완료",
        description: "스타일 카드가 성공적으로 삭제되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "삭제 실패",
        description: "스타일 카드 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  });

  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      imageSrc: "",
      category: "",
      link: "",
      isActive: true
    });
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

    if (editingCard) {
      updateMutation.mutate({ id: editingCard.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (card: StyleCard) => {
    setEditingCard(card);
    setFormData({
      title: card.title,
      description: card.description || "",
      imageSrc: card.imageSrc,
      category: card.category || "",
      link: card.link || "",
      isActive: card.isActive
    });
  };

  const handleImageUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/upload-thumbnail', {
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
    if (window.confirm("정말로 이 스타일 카드를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">스타일 카드를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">AI 이미지 스타일 관리</h3>
          <p className="text-gray-600 mt-1">이미지 생성에 사용할 스타일 카드를 관리합니다</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setEditingCard(null); }}>
              <Plus className="w-4 h-4 mr-2" />
              새 스타일 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingCard ? "스타일 카드 수정" : "새 스타일 카드 추가"}
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
                <p className="text-xs text-gray-500 mt-1">사용자가 이 스타일 카드를 클릭했을 때 이동할 페이지 URL을 입력하세요 (상대경로 또는 절대경로)</p>
              </div>

              <div>
                <Label>미리보기 이미지 *</Label>
                <div className="mt-2">
                  <FileUpload
                    onFileSelect={handleImageUpload}
                    accept="image/*"
                    maxFileSize={10 * 1024 * 1024} // 10MB
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
                <Button type="submit" className="flex-1" disabled={createMutation.isPending || updateMutation.isPending}>
                  <Save className="w-4 h-4 mr-2" />
                  {editingCard ? "수정" : "생성"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setEditingCard(null);
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

      {/* 스타일 카드 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {styleCards.map((card: StyleCard) => (
          <Card key={card.id} className="overflow-hidden">
            <div className="aspect-video relative bg-gray-100">
              {card.imageSrc ? (
                <img 
                  src={card.imageSrc} 
                  alt={card.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Image className="w-8 h-8 text-gray-400" />
                </div>
              )}
              <div className="absolute top-2 right-2">
                <Badge variant={card.isActive ? "default" : "secondary"}>
                  {card.isActive ? "활성" : "비활성"}
                </Badge>
              </div>
            </div>
            
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">{card.title}</h4>
                {card.description && (
                  <p className="text-xs text-gray-600 line-clamp-2">{card.description}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {card.category && (
                    <Badge variant="outline" className="text-xs">{card.category}</Badge>
                  )}
                  {card.link && (
                    <Badge variant="secondary" className="text-xs">🔗 링크 설정됨</Badge>
                  )}
                </div>
              </div>
              
              <div className="flex space-x-2 mt-3">
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    handleEdit(card);
                    setIsCreateDialogOpen(true);
                  }}
                  className="flex-1"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  수정
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive"
                  onClick={() => handleDelete(card.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {styleCards.length === 0 && (
        <div className="text-center py-12">
          <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-1">아직 스타일 카드가 없습니다</h3>
          <p className="text-gray-600 mb-4">첫 번째 AI 이미지 스타일을 추가해보세요</p>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            첫 스타일 추가하기
          </Button>
        </div>
      )}
    </div>
  );
}