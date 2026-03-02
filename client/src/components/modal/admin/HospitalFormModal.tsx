import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useModalContext } from "@/contexts/ModalContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { HOSPITAL_CONSTANTS, PACKAGE_TYPE_OPTIONS, hospitalUtils } from "@shared/constants";
import { formatDateForInput } from "@/lib/dateUtils";

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

export function HospitalFormModal({
  isOpen,
  onClose,
  hospital,
}: {
  isOpen?: boolean;
  onClose?: () => void;
  hospital?: Hospital;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const modal = useModalContext();

  const [formData, setFormData] = useState<Partial<HospitalFormData>>({});

  useEffect(() => {
    if (isOpen) {
      if (hospital) {
        setFormData({
          name: hospital.name,
          address: hospital.address,
          phone: hospital.phone,
          email: hospital.email || "",
          logoUrl: hospital.logoUrl || "",
          themeColor: hospital.themeColor || "#000000",
          contractStartDate: formatDateForInput(hospital.contractStartDate) || "",
          contractEndDate: formatDateForInput(hospital.contractEndDate) || "",
          packageType: hospital.packageType || "",
          isActive: hospital.isActive
        });
      } else {
        setFormData({
          themeColor: "#000000"
        });
      }
    }
  }, [isOpen, hospital]);

  const createHospitalMutation = useMutation({
    mutationFn: async (data: Partial<HospitalFormData>) => {
      const response = await fetch('/api/admin/hospitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      toast({
        title: "병원 등록 완료",
        description: "새로운 병원이 성공적으로 등록되었습니다.",
      });
      modal.closeTopModal ? modal.closeTopModal() : onClose?.();
    },
    onError: (error: any) => {
      toast({
        title: "병원 등록 실패",
        description: error.message || "병원 등록 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const updateHospitalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<HospitalFormData> }) => {
      const response = await fetch(`/api/admin/hospitals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '병원 수정에 실패했습니다');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/hospitals"] });
      toast({
        title: "병원 수정 완료",
        description: "병원 정보가 성공적으로 수정되었습니다.",
      });
      modal.closeTopModal ? modal.closeTopModal() : onClose?.();
    },
    onError: (error: any) => {
      toast({
        title: "병원 수정 실패",
        description: error.message || "병원 수정 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!hospitalUtils.validateHospitalName(formData.name?.trim() || "")) {
      toast({
        title: "입력 오류",
        description: "올바른 병원명을 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.address?.trim()) {
      toast({
        title: "입력 오류",
        description: "주소를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone?.trim() || !hospitalUtils.validatePhoneNumber(formData.phone)) {
      toast({
        title: "입력 오류",
        description: "올바른 형식의 연락처를 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    const data = {
      name: formData.name?.trim(),
      address: formData.address?.trim(),
      phone: formData.phone?.trim(),
      email: formData.email || undefined,
      logoUrl: formData.logoUrl || undefined,
      themeColor: formData.themeColor || undefined,
      contractStartDate: formData.contractStartDate || undefined,
      contractEndDate: formData.contractEndDate || undefined,
      packageType: formData.packageType || undefined,
      isActive: formData.isActive !== undefined ? formData.isActive : (hospital?.isActive ?? true),
    };

    if (hospital) {
      updateHospitalMutation.mutate({ id: hospital.id, data });
    } else {
      createHospitalMutation.mutate(data);
    }
  };

  const isPending = createHospitalMutation.isPending || updateHospitalMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && (modal.closeTopModal ? modal.closeTopModal() : onClose?.())}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{hospital ? "병원 정보 수정" : "새 병원 등록"}</DialogTitle>
          <DialogDescription>
            {hospital ? `${hospital.name}의 정보를 수정합니다.` : "새로운 병원의 기본 정보를 입력해주세요."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">병원명 *</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">전화번호 *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="address">주소 *</Label>
            <Textarea
              id="address"
              value={formData.address || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, address: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="packageType">패키지 유형</Label>
              <select
                id="packageType"
                value={formData.packageType || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, packageType: e.target.value }))}
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
              <Input
                id="logoUrl"
                type="url"
                value={formData.logoUrl || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, logoUrl: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="themeColor">테마 색상</Label>
              <Input
                id="themeColor"
                type="color"
                value={formData.themeColor || "#000000"}
                onChange={(e) => setFormData((prev) => ({ ...prev, themeColor: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contractStartDate">계약 시작일</Label>
              <Input
                id="contractStartDate"
                type="date"
                value={formData.contractStartDate || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, contractStartDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="contractEndDate">계약 종료일</Label>
              <Input
                id="contractEndDate"
                type="date"
                value={formData.contractEndDate || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, contractEndDate: e.target.value }))}
              />
            </div>
          </div>

          {hospital && (
            <div className="flex items-center space-x-2">
              <Switch
                id="isActive"
                checked={formData.isActive || false}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="isActive">활성 상태</Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => modal.closeTopModal ? modal.closeTopModal() : onClose?.()}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (hospital ? "수정 중..." : "등록 중...") : (hospital ? "수정" : "등록")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
