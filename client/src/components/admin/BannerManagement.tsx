import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { BannerFormModal } from "@/components/modal/admin/BannerFormModal";
import { DeleteConfirmModal } from "@/components/modal/common/DeleteConfirmModal";
import { Edit, Trash2, Plus, ImageIcon, ExternalLink } from "lucide-react";

// 배너 스키마 정의
const bannerFormSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  description: z.string().min(1, "설명을 입력해주세요"),
  imageSrc: z.string().min(1, "이미지 URL을 입력해주세요"),
  href: z.string().min(1, "링크 URL을 입력해주세요"),
  isNew: z.boolean().default(false),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
  slideInterval: z.coerce.number().int().min(1000, "최소 1초 이상이어야 합니다").max(30000, "최대 30초까지 가능합니다").default(5000),
  transitionEffect: z.enum(["fade", "slide", "zoom", "cube", "flip"]).default("fade"),
});

type BannerFormValues = z.infer<typeof bannerFormSchema>;


interface Banner {
  id: number;
  title: string;
  description: string;
  imageSrc: string;
  href: string;
  isNew?: boolean;
  isActive: boolean;
  sortOrder: number;
  slideInterval: number;
  transitionEffect: string;
  createdAt: string;
  updatedAt: string;
}

export default function BannerManagement() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 배너 목록 조회
  const { data: banners, isLoading } = useQuery<Banner[]>({
    queryKey: ["/api/admin/banners"],
    queryFn: async () => {
      const response = await fetch("/api/admin/banners", {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("배너 목록을 불러오는데 실패했습니다");
      }
      return response.json();
    },
  });

  // 배너 생성 뮤테이션
  const createBannerMutation = useMutation({
    mutationFn: async (values: BannerFormValues) => {
      const response = await fetch("/api/admin/banners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        throw new Error("배너 생성에 실패했습니다");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      setIsCreateModalOpen(false);
      toast({
        title: "배너 생성 완료",
        description: "새로운 배너가 생성되었습니다",
      });
    },
    onError: (error) => {
      toast({
        title: "배너 생성 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 배너 수정 뮤테이션
  const updateBannerMutation = useMutation({
    mutationFn: async ({ id, values }: { id: number; values: BannerFormValues }) => {
      const response = await fetch(`/api/admin/banners/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // 쿠키 전송을 위해 필수
        body: JSON.stringify(values),
      });
      
      if (!response.ok) {
        throw new Error("배너 수정에 실패했습니다");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      setIsEditModalOpen(false);
      setSelectedBanner(null);
      toast({
        title: "배너 수정 완료",
        description: "배너가 수정되었습니다",
      });
    },
    onError: (error) => {
      toast({
        title: "배너 수정 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // 배너 삭제 뮤테이션
  const deleteBannerMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/banners/${id}`, {
        method: "DELETE",
        credentials: "include", // 쿠키 전송을 위해 필수
      });
      
      if (!response.ok) {
        throw new Error("배너 삭제에 실패했습니다");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/banners"] });
      setIsDeleteModalOpen(false);
      setSelectedBanner(null);
      toast({
        title: "배너 삭제 완료",
        description: "배너가 삭제되었습니다",
      });
    },
    onError: (error) => {
      toast({
        title: "배너 삭제 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // 배너 수정 모달 열기
  function handleEditClick(banner: Banner) {
    setSelectedBanner(banner);
    setIsEditModalOpen(true);
  }
  
  // 배너 삭제 모달 열기
  function handleDeleteClick(banner: Banner) {
    setSelectedBanner(banner);
    setIsDeleteModalOpen(true);
  }

  // 배너 생성 핸들러
  function handleCreateSubmit(values: BannerFormValues) {
    createBannerMutation.mutate(values);
  }

  // 배너 수정 핸들러
  function handleEditSubmit(values: BannerFormValues) {
    if (selectedBanner) {
      updateBannerMutation.mutate({ id: selectedBanner.id, values });
    }
  }

  // 배너 삭제 핸들러
  async function handleDeleteConfirm() {
    if (selectedBanner) {
      deleteBannerMutation.mutate(selectedBanner.id);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">배너 관리</h2>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          새 배너 추가
        </Button>
      </div>

      {/* 배너 목록 */}
      <Card>
        <CardHeader>
          <CardTitle>배너 목록</CardTitle>
          <CardDescription>
            홈페이지에 표시되는 배너를 관리합니다. 활성화된 배너만 표시됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableCaption>총 {banners?.length || 0}개의 배너</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">순서</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>설명</TableHead>
                <TableHead>이미지</TableHead>
                <TableHead>슬라이드 시간</TableHead>
                <TableHead>전환 효과</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">로딩 중...</TableCell>
                </TableRow>
              ) : banners?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center">등록된 배너가 없습니다</TableCell>
                </TableRow>
              ) : (
                banners?.map((banner) => (
                  <TableRow key={banner.id}>
                    <TableCell>{banner.sortOrder}</TableCell>
                    <TableCell className="font-medium">
                      {banner.title}
                      {banner.isNew && (
                        <span className="ml-2 text-xs font-bold text-primary-lavender">NEW</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{banner.description}</TableCell>
                    <TableCell>
                      <div className="relative w-10 h-10 overflow-hidden rounded">
                        {banner.imageSrc ? (
                          <img
                            src={banner.imageSrc}
                            alt={banner.title}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full bg-secondary">
                            <ImageIcon size={16} />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        {(banner.slideInterval || 5000) / 1000}초
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                        {banner.transitionEffect === "fade" && "페이드"}
                        {banner.transitionEffect === "slide" && "슬라이드"}
                        {banner.transitionEffect === "zoom" && "줌"}
                        {banner.transitionEffect === "cube" && "큐브"}
                        {banner.transitionEffect === "flip" && "플립"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          banner.isActive
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                            : "bg-neutral-100 text-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
                        }`}
                      >
                        {banner.isActive ? "활성화" : "비활성화"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditClick(banner)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(banner)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={banner.href} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 배너 생성 모달 */}
      <BannerFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        mode="create"
        onSubmit={handleCreateSubmit}
        isPending={createBannerMutation.isPending}
      />

      {/* 배너 수정 모달 */}
      <BannerFormModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedBanner(null);
        }}
        mode="edit"
        data={selectedBanner ? {
          title: selectedBanner.title,
          description: selectedBanner.description,
          imageSrc: selectedBanner.imageSrc,
          href: selectedBanner.href,
          isNew: selectedBanner.isNew || false,
          isActive: selectedBanner.isActive,
          sortOrder: selectedBanner.sortOrder,
          slideInterval: selectedBanner.slideInterval || 5000,
          transitionEffect: (selectedBanner.transitionEffect as "fade" | "slide" | "zoom" | "cube" | "flip") || "fade",
        } : undefined}
        onSubmit={handleEditSubmit}
        isPending={updateBannerMutation.isPending}
      />

      {/* 배너 삭제 확인 모달 */}
      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedBanner(null);
        }}
        title="배너 삭제"
        description="정말로 이 배너를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다."
        itemName={selectedBanner?.title}
        itemDescription={selectedBanner?.description}
        onConfirm={handleDeleteConfirm}
        isPending={deleteBannerMutation.isPending}
      />
    </div>
  );
}