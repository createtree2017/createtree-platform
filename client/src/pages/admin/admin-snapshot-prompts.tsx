/**
 * AI Snapshot Generator - Admin Prompt Management UI
 * 관리자가 스냅사진 생성에 사용되는 프롬프트를 관리하는 페이지
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, Power, PowerOff, Search, BarChart3 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface SnapshotPrompt {
  id: number;
  category: string;
  type: string;
  gender: string;
  text: string;
  tags: string[] | null;
  region: string | null;
  season: string | null;
  timeOfDay: string | null;
  isActive: boolean;
  usageCount: number;
  order: number;
  createdAt: string;
  updatedAt: string;
}

interface PromptFormData {
  category: string;
  type: string;
  gender: string;
  text: string;
  tags: string;
  region: string;
  season: string;
  timeOfDay: string;
  isActive: boolean;
  order: number;
}

interface Stats {
  total: number;
  active: number;
  inactive: number;
  categoryDistribution: { category: string; count: number }[];
  typeDistribution: { type: string; count: number }[];
  genderDistribution: { gender: string; count: number }[];
  mostUsedPrompts: SnapshotPrompt[];
}

export default function AdminSnapshotPrompts() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SnapshotPrompt | null>(null);
  const [showStats, setShowStats] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isActiveFilter, setIsActiveFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const [formData, setFormData] = useState<PromptFormData>({
    category: "daily",
    type: "family",
    gender: "unisex",
    text: "",
    tags: "",
    region: "",
    season: "",
    timeOfDay: "",
    isActive: true,
    order: 0,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Build query params
  const buildQueryParams = () => {
    const params = new URLSearchParams();
    params.append("page", currentPage.toString());
    params.append("limit", itemsPerPage.toString());
    
    if (categoryFilter !== "all") params.append("category", categoryFilter);
    if (typeFilter !== "all") params.append("type", typeFilter);
    if (isActiveFilter !== "all") params.append("isActive", isActiveFilter);
    if (searchTerm) params.append("search", searchTerm);
    
    return params.toString();
  };

  // Fetch prompts
  const { data: promptsData, isLoading } = useQuery({
    queryKey: ["/api/admin/snapshot-prompts", currentPage, categoryFilter, typeFilter, isActiveFilter, searchTerm],
    queryFn: async () => {
      const response = await fetch(`/api/admin/snapshot-prompts?${buildQueryParams()}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch prompts");
      return response.json();
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery<{ success: boolean; data: Stats }>({
    queryKey: ["/api/admin/snapshot-prompts/stats"],
    queryFn: async () => {
      const response = await fetch("/api/admin/snapshot-prompts/stats", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch stats");
      return response.json();
    },
    enabled: showStats,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: PromptFormData) => {
      const payload = {
        ...data,
        tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : null,
        region: data.region || null,
        season: data.season || null,
        timeOfDay: data.timeOfDay || null,
      };
      return apiRequest("/api/admin/snapshot-prompts", { method: "POST", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/snapshot-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/snapshot-prompts/stats"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "성공",
        description: "프롬프트가 성공적으로 추가되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "프롬프트 추가에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: PromptFormData }) => {
      const payload = {
        ...data,
        tags: data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : null,
        region: data.region || null,
        season: data.season || null,
        timeOfDay: data.timeOfDay || null,
      };
      return apiRequest(`/api/admin/snapshot-prompts/${id}`, { method: "PUT", body: JSON.stringify(payload) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/snapshot-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/snapshot-prompts/stats"] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "성공",
        description: "프롬프트가 성공적으로 수정되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "프롬프트 수정에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/snapshot-prompts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/snapshot-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/snapshot-prompts/stats"] });
      toast({
        title: "성공",
        description: "프롬프트가 성공적으로 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "프롬프트 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // Toggle active mutation
  const toggleMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/admin/snapshot-prompts/${id}/toggle`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/snapshot-prompts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/snapshot-prompts/stats"] });
      toast({
        title: "성공",
        description: "프롬프트 활성화 상태가 변경되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "상태 변경에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      category: "daily",
      type: "family",
      gender: "unisex",
      text: "",
      tags: "",
      region: "",
      season: "",
      timeOfDay: "",
      isActive: true,
      order: 0,
    });
    setEditingPrompt(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (prompt: SnapshotPrompt) => {
    setEditingPrompt(prompt);
    setFormData({
      category: prompt.category,
      type: prompt.type,
      gender: prompt.gender,
      text: prompt.text,
      tags: prompt.tags ? prompt.tags.join(", ") : "",
      region: prompt.region || "",
      season: prompt.season || "",
      timeOfDay: prompt.timeOfDay || "",
      isActive: prompt.isActive,
      order: prompt.order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingPrompt) {
      updateMutation.mutate({ id: editingPrompt.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: number) => {
    if (window.confirm("이 프롬프트를 정말 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  const prompts = promptsData?.data || [];
  const pagination = promptsData?.pagination;
  const stats = statsData?.data;

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">스냅사진 프롬프트 관리</h1>
          <p className="text-muted-foreground mt-1">
            AI 스냅사진 생성에 사용되는 프롬프트를 관리합니다
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowStats(!showStats)}>
            <BarChart3 className="w-4 h-4 mr-2" />
            통계 {showStats ? "숨기기" : "보기"}
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            프롬프트 추가
          </Button>
        </div>
      </div>

      {/* Stats */}
      {showStats && stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">전체 통계</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">전체</span>
                <span className="font-semibold">{stats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">활성화</span>
                <span className="font-semibold text-green-600">{stats.active}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">비활성화</span>
                <span className="font-semibold text-gray-400">{stats.inactive}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">카테고리별 분포</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.categoryDistribution.map((item) => (
                <div key={item.category} className="flex justify-between">
                  <span className="text-sm capitalize">{item.category}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">타입별 분포</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.typeDistribution.map((item) => (
                <div key={item.type} className="flex justify-between">
                  <span className="text-sm capitalize">{item.type}</span>
                  <span className="font-semibold">{item.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Label>검색</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="프롬프트 텍스트 검색..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <Label>카테고리</Label>
              <Select value={categoryFilter} onValueChange={(value) => {
                setCategoryFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="film">Film</SelectItem>
                  <SelectItem value="mix">Mix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>타입</Label>
              <Select value={typeFilter} onValueChange={(value) => {
                setTypeFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="family">Family</SelectItem>
                  <SelectItem value="couple">Couple</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>상태</Label>
              <Select value={isActiveFilter} onValueChange={(value) => {
                setIsActiveFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  <SelectItem value="true">활성화</SelectItem>
                  <SelectItem value="false">비활성화</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              로딩 중...
            </div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              프롬프트가 없습니다
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">ID</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead>타입</TableHead>
                    <TableHead>성별</TableHead>
                    <TableHead className="max-w-md">프롬프트</TableHead>
                    <TableHead className="w-24">사용횟수</TableHead>
                    <TableHead className="w-24">상태</TableHead>
                    <TableHead className="w-32">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prompts.map((prompt: SnapshotPrompt) => (
                    <TableRow key={prompt.id}>
                      <TableCell className="font-mono text-xs">{prompt.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {prompt.category}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="capitalize">
                          {prompt.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm capitalize">{prompt.gender}</TableCell>
                      <TableCell className="max-w-md">
                        <div className="text-sm truncate" title={prompt.text}>
                          {prompt.text}
                        </div>
                        {prompt.tags && prompt.tags.length > 0 && (
                          <div className="flex gap-1 mt-1 flex-wrap">
                            {prompt.tags.slice(0, 3).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {prompt.usageCount}
                      </TableCell>
                      <TableCell>
                        <Badge variant={prompt.isActive ? "default" : "secondary"}>
                          {prompt.isActive ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleMutation.mutate(prompt.id)}
                          >
                            {prompt.isActive ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEditDialog(prompt)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(prompt.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    전체 {pagination.total}개 중 {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, pagination.total)}개 표시
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      이전
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                        const page = i + 1;
                        return (
                          <Button
                            key={page}
                            variant={currentPage === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === pagination.totalPages}
                    >
                      다음
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* CRUD Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? "프롬프트 수정" : "프롬프트 추가"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>카테고리 *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="travel">Travel</SelectItem>
                    <SelectItem value="film">Film</SelectItem>
                    <SelectItem value="mix">Mix</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>타입 *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="family">Family</SelectItem>
                    <SelectItem value="couple">Couple</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>성별 *</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => setFormData({ ...formData, gender: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unisex">Unisex</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>프롬프트 텍스트 *</Label>
              <Textarea
                value={formData.text}
                onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                placeholder="A warm family portrait in a sunlit kitchen..."
                required
                rows={6}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                영어로 작성하며, 필름 스타일(Kodak Portra 400, Fuji Pro 400H 등)을 포함하세요.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>태그 (쉼표로 구분)</Label>
                <Input
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="indoor, cooking, bonding"
                />
              </div>

              <div>
                <Label>우선순위</Label>
                <Input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>지역 (선택)</Label>
                <Input
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="japan, korea, europe"
                />
              </div>

              <div>
                <Label>계절 (선택)</Label>
                <Select
                  value={formData.season}
                  onValueChange={(value) => setFormData({ ...formData, season: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">없음</SelectItem>
                    <SelectItem value="spring">Spring</SelectItem>
                    <SelectItem value="summer">Summer</SelectItem>
                    <SelectItem value="fall">Fall</SelectItem>
                    <SelectItem value="winter">Winter</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>시간대 (선택)</Label>
                <Select
                  value={formData.timeOfDay}
                  onValueChange={(value) => setFormData({ ...formData, timeOfDay: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">없음</SelectItem>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="afternoon">Afternoon</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
              />
              <Label>활성화</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                취소
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingPrompt ? "수정" : "추가"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
