import React, { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useModalContext } from '@/contexts/ModalContext';

interface Hospital {
    id: number;
    name: string;
    isActive: boolean;
}

interface HospitalCode {
    id: number;
    hospitalId: number;
    hospitalName: string;
    code: string;
    codeType: 'master' | 'limited' | 'qr_unlimited' | 'qr_limited';
    maxUsage: number | null;
    currentUsage: number;
    isQREnabled: boolean;
    qrDescription: string | null;
    isActive: boolean;
    expiresAt: string | null;
    createdAt: string;
    updatedAt: string;
}

interface EditHospitalCodeModalProps {
    hospitals: Hospital[];
    code: HospitalCode;
    onSubmit: (data: any) => void;
    isLoading: boolean;
}

export function EditHospitalCodeModal({ hospitals, code, onSubmit, isLoading }: EditHospitalCodeModalProps) {
    const modal = useModalContext();
    const [formData, setFormData] = useState({
        hospitalId: code.hospitalId.toString(),
        codeType: code.codeType,
        maxUsage: code.maxUsage?.toString() || '',
        isQREnabled: code.isQREnabled,
        qrDescription: code.qrDescription || '',
        expiresAt: code.expiresAt ? code.expiresAt.split('T')[0] : ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            ...formData,
            hospitalId: parseInt(formData.hospitalId),
            maxUsage: formData.maxUsage ? parseInt(formData.maxUsage.toString()) : null,
            expiresAt: formData.expiresAt || null
        });
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && modal.closeTopModal()}>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>병원 코드 수정</DialogTitle>
                    <DialogDescription>
                        기존 병원 코드의 설정을 수정합니다
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="edit-hospital">병원 선택</Label>
                        <Select value={formData.hospitalId} onValueChange={(value) => setFormData({ ...formData, hospitalId: value })}>
                            <SelectTrigger>
                                <SelectValue placeholder="병원을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                                {hospitals.map((hospital) => (
                                    <SelectItem key={hospital.id} value={hospital.id.toString()}>
                                        {hospital.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="edit-codeType">코드 타입</Label>
                        <Select value={formData.codeType} onValueChange={(value) => setFormData({ ...formData, codeType: value as any })}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="master">마스터 (무제한)</SelectItem>
                                <SelectItem value="limited">제한형</SelectItem>
                                <SelectItem value="qr_unlimited">QR 무제한</SelectItem>
                                <SelectItem value="qr_limited">QR 제한</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(formData.codeType === 'limited' || formData.codeType === 'qr_limited') && (
                        <div>
                            <Label htmlFor="edit-maxUsage">최대 사용 인원</Label>
                            <Input
                                id="edit-maxUsage"
                                type="number"
                                value={formData.maxUsage}
                                onChange={(e) => setFormData({ ...formData, maxUsage: e.target.value })}
                                placeholder="최대 사용 가능 인원수"
                                min="1"
                            />
                        </div>
                    )}

                    {formData.codeType.startsWith('qr_') && (
                        <>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="edit-qrEnabled"
                                    checked={formData.isQREnabled}
                                    onCheckedChange={(checked) => setFormData({ ...formData, isQREnabled: checked })}
                                />
                                <Label htmlFor="edit-qrEnabled">QR 코드 활성화</Label>
                            </div>

                            {formData.isQREnabled && (
                                <div>
                                    <Label htmlFor="edit-qrDescription">QR 설명</Label>
                                    <Input
                                        id="edit-qrDescription"
                                        value={formData.qrDescription}
                                        onChange={(e) => setFormData({ ...formData, qrDescription: e.target.value })}
                                        placeholder="QR 코드에 대한 설명 (선택사항)"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div>
                        <Label htmlFor="edit-expiresAt">만료일 (선택사항)</Label>
                        <Input
                            id="edit-expiresAt"
                            type="date"
                            value={formData.expiresAt}
                            onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                        />
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={() => modal.closeTopModal()}>
                            취소
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? '수정 중...' : '수정 완료'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
