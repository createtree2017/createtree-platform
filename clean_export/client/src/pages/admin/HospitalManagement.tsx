import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Building2, Edit, Trash2, Users, Calendar, Phone, Mail, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { HOSPITAL_CONSTANTS, PACKAGE_TYPE_OPTIONS, hospitalUtils } from "@shared/constants";

interface Hospital {
  id: number;
  name: string;
  address: string;
  phone: string;
  email?: string;
  logoUrl?: string;
  themeColor?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  packageType?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

interface HospitalFormData {
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  themeColor: string;
  contractStartDate: string;
  contractEndDate: string;
  packageType: string;
  isActive: boolean;
}

export default function HospitalManagement() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editFormData, setEditFormData] = useState<Partial<HospitalFormData>>({});

  // 병원 목록 조회
  const { data: hospitalsResponse, isLoading } = useQuery({
    queryKey: ["/api/admin/hospitals"],
    queryFn: async () => {
      const response = await fetch('/api/admin/hospitals', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error(HOSPITAL_CONSTANTS.MESSAGES.ERRORS.FETCH_FAILED);
      }
      return response.json();
    },
  });

  const hospitals = hospitalsResponse?.data || [];
  const pagination = hospitalsResponse?.pagination;

  // 검색된 병원 목록
  const filteredHospitals = hospitals.filter((hospital: Hospital) =>
    hospital.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    hospital.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    hospital.phone.includes(searchQuery)
  );

  // 병원 생성 뮤테이션
  const createHospitalMutation = useMutation({
    mutationFn: async (data: Partial<HospitalFormData>) => {
      const response = await fetch('/api/admin/hospitals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '병원 등록에 실패했습니다');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hospitals"] });
      setIsCreateDialogOpen(false);
      toast({
        title: "병원 등록 완료",
        description: "새로운 병원이 성공적으로 등록되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "병원 등록 실패",
        description: error.message || "병원 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 병원 수정 뮤테이션
  const updateHospitalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<HospitalFormData> }) => {
      console.log('클라이언트에서 전송하는 수정 데이터:', data);
      const response = await fetch(`/api/admin/hospitals/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '병원 수정에 실패했습니다');
      }
      const result = await response.json();
      console.log('서버에서 받은 수정 응답:', result);
      return result;
    },
    onSuccess: (data) => {
      console.log('병원 수정 성공, 캐시 무효화 시작');
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hospitals"] });
      queryClient.refetchQueries({ queryKey: ["/api/admin/hospitals"] });
      setIsEditDialogOpen(false);
      setSelectedHospital(null);
      setEditFormData({});
      toast({
        title: "병원 수정 완료",
        description: "병원 정보가 성공적으로 수정되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "병원 수정 실패",
        description: error.message || "병원 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 병원 삭제 뮤테이션
  const deleteHospitalMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/hospitals/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '병원 삭제에 실패했습니다');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hospitals"] });
      setIsDeleteDialogOpen(false);
      setSelectedHospital(null);
      toast({
        title: "병원 삭제 완료",
        description: "병원이 성공적으로 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "병원 삭제 실패",
        description: error.message || "병원 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    
    const name = formData.get("name") as string;
    const address = formData.get("address") as string;
    const phone = formData.get("phone") as string;

    // 필수 필드 검증
    if (!hospitalUtils.validateHospitalName(name?.trim() || "")) {
      toast({
        title: "입력 오류",
        description: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_NAME,
        variant: "destructive",
      });
      return;
    }

    if (!address?.trim()) {
      toast({
        title: "입력 오류", 
        description: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_ADDRESS,
        variant: "destructive",
      });
      return;
    }

    if (!phone?.trim() || !hospitalUtils.validatePhoneNumber(phone)) {
      toast({
        title: "입력 오류",
        description: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_PHONE,
        variant: "destructive",
      });
      return;
    }
    
    const data = {
      name: name.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: formData.get("email") as string || undefined,
      logoUrl: formData.get("logoUrl") as string || undefined,
      themeColor: formData.get("themeColor") as string || undefined,
      contractStartDate: formData.get("contractStartDate") as string || undefined,
      contractEndDate: formData.get("contractEndDate") as string || undefined,
      packageType: formData.get("packageType") as string || undefined,
    };

    createHospitalMutation.mutate(data);
  };

  const handleEditSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedHospital) return;

    // 필수 필드 검증
    if (!hospitalUtils.validateHospitalName(editFormData.name?.trim() || "")) {
      toast({
        title: "입력 오류",
        description: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_NAME,
        variant: "destructive",
      });
      return;
    }

    if (!editFormData.address?.trim()) {
      toast({
        title: "입력 오류", 
        description: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_ADDRESS,
        variant: "destructive",
      });
      return;
    }

    if (!editFormData.phone?.trim() || !hospitalUtils.validatePhoneNumber(editFormData.phone)) {
      toast({
        title: "입력 오류",
        description: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_PHONE,
        variant: "destructive",
      });
      return;
    }
    
    const data = {
      name: editFormData.name?.trim(),
      address: editFormData.address?.trim(),
      phone: editFormData.phone?.trim(),
      email: editFormData.email || undefined,
      logoUrl: editFormData.logoUrl || undefined,
      themeColor: editFormData.themeColor || undefined,
      contractStartDate: editFormData.contractStartDate || undefined,
      contractEndDate: editFormData.contractEndDate || undefined,
      packageType: editFormData.packageType || undefined,
      isActive: editFormData.isActive !== undefined ? editFormData.isActive : selectedHospital.isActive,
    };

    console.log('병원 수정 데이터:', data);
    updateHospitalMutation.mutate({ id: selectedHospital.id, data });
  };

  const handleEdit = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setEditFormData({
      name: hospital.name,
      address: hospital.address,
      phone: hospital.phone,
      email: hospital.email || "",
      logoUrl: hospital.logoUrl || "",
      themeColor: hospital.themeColor || "#000000",
      contractStartDate: hospital.contractStartDate ? 
        new Date(hospital.contractStartDate).toISOString().split('T')[0] : "",
      contractEndDate: hospital.contractEndDate ? 
        new Date(hospital.contractEndDate).toISOString().split('T')[0] : "",
      packageType: hospital.packageType || "",
      isActive: hospital.isActive
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (hospital: Hospital) => {
    setSelectedHospital(hospital);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedHospital) {
      deleteHospitalMutation.mutate(selectedHospital.id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">병원 목록을 불러오는 중...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">병원 관리</h1>
          <p className="text-muted-foreground">
            등록된 병원을 관리하고 새로운 병원을 추가할 수 있습니다.
          </p>
        </div>

        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              병원 추가
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>새 병원 등록</DialogTitle>
              <DialogDescription>
                새로운 병원의 기본 정보를 입력해주세요.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">병원명 *</Label>
                  <Input id="name" name="name" required />
                </div>
                <div>
                  <Label htmlFor="phone">전화번호 *</Label>
                  <Input id="phone" name="phone" type="tel" required />
                </div>
              </div>
              
              <div>
                <Label htmlFor="address">주소 *</Label>
                <Textarea id="address" name="address" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">이메일</Label>
                  <Input id="email" name="email" type="email" />
                </div>
                <div>
                  <Label htmlFor="packageType">패키지 유형</Label>
                  <select 
                    id="packageType" 
                    name="packageType" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">패키지 타입 선택</option>
                    {PACKAGE_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label} - {option.description}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="logoUrl">로고 URL</Label>
                  <Input id="logoUrl" name="logoUrl" type="url" />
                </div>
                <div>
                  <Label htmlFor="themeColor">테마 색상</Label>
                  <Input id="themeColor" name="themeColor" type="color" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contractStartDate">계약 시작일</Label>
                  <Input id="contractStartDate" name="contractStartDate" type="date" />
                </div>
                <div>
                  <Label htmlFor="contractEndDate">계약 종료일</Label>
                  <Input id="contractEndDate" name="contractEndDate" type="date" />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={createHospitalMutation.isPending}>
                  {createHospitalMutation.isPending ? "등록 중..." : "등록"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 검색 */}
      <div className="flex items-center space-x-4">
        <div className="flex-1">
          <Input
            placeholder="병원명, 주소, 전화번호로 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          총 {filteredHospitals.length}개 병원
        </div>
      </div>

      {/* 병원 목록 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredHospitals.map((hospital: Hospital) => (
          <Card key={hospital.id} className="relative">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                {hospital.logoUrl ? (
                  <img
                    src={hospital.logoUrl}
                    alt={hospital.name}
                    className="w-8 h-8 rounded object-cover"
                  />
                ) : (
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                )}
                <div>
                  <CardTitle className="text-lg">{hospital.name}</CardTitle>
                  <Badge variant={hospital.isActive ? "default" : "secondary"}>
                    {hospital.isActive ? "활성" : "비활성"}
                  </Badge>
                </div>
              </div>
              <div className="flex space-x-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleEdit(hospital)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(hospital)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="w-4 h-4 mr-2" />
                <span className="truncate">{hospital.address}</span>
              </div>
              <div className="flex items-center text-sm text-muted-foreground">
                <Phone className="w-4 h-4 mr-2" />
                <span>{hospital.phone}</span>
              </div>
              {hospital.email && (
                <div className="flex items-center text-sm text-muted-foreground">
                  <Mail className="w-4 h-4 mr-2" />
                  <span className="truncate">{hospital.email}</span>
                </div>
              )}
              <div className="flex items-center text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 mr-2" />
                <span>등록일: {new Date(hospital.createdAt).toLocaleDateString()}</span>
              </div>
              {hospital.packageType && (
                <div className="pt-2">
                  <Badge variant="outline">{hospital.packageType}</Badge>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredHospitals.length === 0 && (
        <div className="text-center py-12">
          <Building2 className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-2 text-sm font-semibold">병원이 없습니다</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {searchQuery ? "검색 조건에 맞는 병원이 없습니다." : "새로운 병원을 추가해보세요."}
          </p>
        </div>
      )}

      {/* 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>병원 정보 수정</DialogTitle>
            <DialogDescription>
              {selectedHospital?.name}의 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {selectedHospital && (
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-name">병원명 *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    value={editFormData.name || ""}
                    onChange={(e) => setEditFormData(prev => ({...prev, name: e.target.value}))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit-phone">전화번호 *</Label>
                  <Input
                    id="edit-phone"
                    name="phone"
                    type="tel"
                    value={editFormData.phone || ""}
                    onChange={(e) => setEditFormData(prev => ({...prev, phone: e.target.value}))}
                    required
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="edit-address">주소 *</Label>
                <Textarea
                  id="edit-address"
                  name="address"
                  value={editFormData.address || ""}
                  onChange={(e) => setEditFormData(prev => ({...prev, address: e.target.value}))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-email">이메일</Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    value={editFormData.email || ""}
                    onChange={(e) => setEditFormData(prev => ({...prev, email: e.target.value}))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-packageType">패키지 유형</Label>
                  <Input
                    id="edit-packageType"
                    name="packageType"
                    value={editFormData.packageType || ""}
                    onChange={(e) => setEditFormData(prev => ({...prev, packageType: e.target.value}))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-logoUrl">로고 URL</Label>
                  <Input
                    id="edit-logoUrl"
                    name="logoUrl"
                    type="url"
                    value={editFormData.logoUrl || ""}
                    onChange={(e) => setEditFormData(prev => ({...prev, logoUrl: e.target.value}))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-themeColor">테마 색상</Label>
                  <Input
                    id="edit-themeColor"
                    name="themeColor"
                    type="color"
                    value={editFormData.themeColor || "#000000"}
                    onChange={(e) => setEditFormData(prev => ({...prev, themeColor: e.target.value}))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-contractStartDate">계약 시작일</Label>
                  <Input
                    id="edit-contractStartDate"
                    name="contractStartDate"
                    type="date"
                    value={editFormData.contractStartDate || ""}
                    onChange={(e) => setEditFormData(prev => ({...prev, contractStartDate: e.target.value}))}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-contractEndDate">계약 종료일</Label>
                  <Input
                    id="edit-contractEndDate"
                    name="contractEndDate"
                    type="date"
                    value={editFormData.contractEndDate || ""}
                    onChange={(e) => setEditFormData(prev => ({...prev, contractEndDate: e.target.value}))}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="edit-isActive"
                  name="isActive"
                  checked={editFormData.isActive || false}
                  onCheckedChange={(checked) => setEditFormData(prev => ({...prev, isActive: checked}))}
                />
                <Label htmlFor="edit-isActive">활성 상태</Label>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  취소
                </Button>
                <Button type="submit" disabled={updateHospitalMutation.isPending}>
                  {updateHospitalMutation.isPending ? "수정 중..." : "수정"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>병원 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription>
              정말로 <strong>{selectedHospital?.name}</strong> 병원을 삭제하시겠습니까?
              <br />
              <br />
              <span className="text-red-600 font-medium">
                이 작업은 되돌릴 수 없습니다. 병원에 연결된 캠페인이나 사용자가 있는 경우 삭제가 거부됩니다.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteHospitalMutation.isPending}
            >
              {deleteHospitalMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}