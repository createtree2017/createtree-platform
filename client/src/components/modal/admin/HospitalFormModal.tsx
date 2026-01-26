import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { HOSPITAL_CONSTANTS, PACKAGE_TYPE_OPTIONS, hospitalUtils } from "@shared/constants";
import { formatDateForInput } from "@/lib/dateUtils";

interface Hospital {
  id?: number;
  name: string;
  address: string;
  phone: string;
  email?: string;
  logoUrl?: string;
  themeColor?: string;
  contractStartDate?: string;
  contractEndDate?: string;
  packageType?: string;
  isActive?: boolean;
}

interface HospitalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  hospital?: Hospital | null;
  onSubmit: (data: Partial<Hospital>) => void;
  isPending?: boolean;
}

export function HospitalFormModal({ isOpen, onClose, mode, hospital, onSubmit, isPending }: HospitalFormModalProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<Hospital>>({
    name: "",
    address: "",
    phone: "",
    email: "",
    logoUrl: "",
    themeColor: "#000000",
    contractStartDate: "",
    contractEndDate: "",
    packageType: "",
    isActive: true,
  });

  useEffect(() => {
    if (mode === 'edit' && hospital) {
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
        isActive: hospital.isActive ?? true,
      });
    } else {
      setFormData({
        name: "",
        address: "",
        phone: "",
        email: "",
        logoUrl: "",
        themeColor: "#000000",
        contractStartDate: "",
        contractEndDate: "",
        packageType: "",
        isActive: true,
      });
    }
  }, [mode, hospital, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!hospitalUtils.validateHospitalName(formData.name?.trim() || "")) {
      toast({
        title: "입력 오류",
        description: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_NAME,
        variant: "destructive",
      });
      return;
    }

    if (!formData.address?.trim()) {
      toast({
        title: "입력 오류", 
        description: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_ADDRESS,
        variant: "destructive",
      });
      return;
    }

    if (!formData.phone?.trim() || !hospitalUtils.validatePhoneNumber(formData.phone)) {
      toast({
        title: "입력 오류",
        description: HOSPITAL_CONSTANTS.MESSAGES.ERRORS.INVALID_PHONE,
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
      isActive: formData.isActive,
    };

    onSubmit(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '병원 정보 수정' : '새 병원 등록'}</DialogTitle>
          <DialogDescription>
            {mode === 'edit' ? `${hospital?.name}의 정보를 수정합니다.` : '새로운 병원의 기본 정보를 입력해주세요.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">병원명 *</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} 
                required 
              />
            </div>
            <div>
              <Label htmlFor="phone">전화번호 *</Label>
              <Input 
                id="phone" 
                type="tel" 
                value={formData.phone} 
                onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))} 
                required 
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="address">주소 *</Label>
            <Textarea 
              id="address" 
              value={formData.address} 
              onChange={(e) => setFormData(prev => ({...prev, address: e.target.value}))} 
              required 
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="email">이메일</Label>
              <Input 
                id="email" 
                type="email" 
                value={formData.email} 
                onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))} 
              />
            </div>
            <div>
              <Label htmlFor="packageType">패키지 유형</Label>
              <select 
                id="packageType" 
                value={formData.packageType} 
                onChange={(e) => setFormData(prev => ({...prev, packageType: e.target.value}))} 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
                value={formData.logoUrl} 
                onChange={(e) => setFormData(prev => ({...prev, logoUrl: e.target.value}))} 
              />
            </div>
            <div>
              <Label htmlFor="themeColor">테마 색상</Label>
              <Input 
                id="themeColor" 
                type="color" 
                value={formData.themeColor} 
                onChange={(e) => setFormData(prev => ({...prev, themeColor: e.target.value}))} 
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="contractStartDate">계약 시작일</Label>
              <Input 
                id="contractStartDate" 
                type="date" 
                value={formData.contractStartDate} 
                onChange={(e) => setFormData(prev => ({...prev, contractStartDate: e.target.value}))} 
              />
            </div>
            <div>
              <Label htmlFor="contractEndDate">계약 종료일</Label>
              <Input 
                id="contractEndDate" 
                type="date" 
                value={formData.contractEndDate} 
                onChange={(e) => setFormData(prev => ({...prev, contractEndDate: e.target.value}))} 
              />
            </div>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center space-x-2">
              <Switch 
                id="isActive" 
                checked={formData.isActive} 
                onCheckedChange={(checked) => setFormData(prev => ({...prev, isActive: checked}))} 
              />
              <Label htmlFor="isActive">활성 상태</Label>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "저장 중..." : mode === 'edit' ? "수정" : "등록"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
