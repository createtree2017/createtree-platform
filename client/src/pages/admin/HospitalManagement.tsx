import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Plus, Building2, Edit, Trash2, Users, Calendar, Phone, Mail, MapPin } from "lucide-react";
import { formatDateForInput } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useModalContext } from "@/contexts/ModalContext";
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
  const modal = useModalContext();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // 병원 목록 조회
  const { data: hospitalsResponse, isLoading } = useQuery({
    queryKey: ["/api/admin/hospitals"],
    queryFn: async () => {
      const response = await fetch('/api/admin/hospitals', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("병원 목록을 불러오는데 실패했습니다.");
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

  const handleEdit = (hospital: Hospital) => {
    modal.openModal('hospitalForm', { hospital });
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

        <Button onClick={() => modal.openModal('hospitalForm')}>
          <Plus className="mr-2 h-4 w-4" />
          병원 추가
        </Button>
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