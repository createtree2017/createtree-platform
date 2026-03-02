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

interface CreateHospitalCodeModalProps {
    hospitals: Hospital[];
    onSubmit: (data: any) => void;
    isLoading: boolean;
}

export function CreateHospitalCodeModal({ hospitals, onSubmit, isLoading }: CreateHospitalCodeModalProps) {
    const modal = useModalContext();
    const [formData, setFormData] = useState({
        hospitalId: '',
        code: '',
        codeType: 'limited',
        maxUsage: '',
        isQREnabled: false,
        qrDescription: '',
        expiresAt: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // 필수 필드 검증
        if (!formData.hospitalId || !formData.codeType) {
            console.error('필수 필드 누락:', formData);
            return;
        }

        const submitData = {
            hospitalId: parseInt(formData.hospitalId),
            code: formData.code || '', // 빈 문자열이면 서버에서 자동 생성
            codeType: formData.codeType,
            maxUsage: formData.maxUsage ? parseInt(formData.maxUsage) : null,
            isQREnabled: formData.isQREnabled,
            qrDescription: formData.qrDescription || null,
            expiresAt: formData.expiresAt || null,
        };

        console.log('폼 제출 데이터:', submitData);
        onSubmit(submitData);
    };

    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setFormData(prev => ({ ...prev, code: result }));
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && modal.closeTopModal()}>
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>새 병원 코드 생성</DialogTitle>
                    <DialogDescription>
                        병원 회원 인증을 위한 새로운 코드를 생성합니다
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="hospitalId">병원 선택 *</Label>
                        <Select
                            value={formData.hospitalId}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, hospitalId: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="병원을 선택하세요" />
                            </SelectTrigger>
                            <SelectContent>
                                {hospitals.map((hospital: Hospital) => (
                                    <SelectItem key={hospital.id} value={hospital.id.toString()}>
                                        {hospital.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <Label htmlFor="code">인증코드</Label>
                        <div className="flex space-x-2">
                            <Input
                                id="code"
                                value={formData.code}
                                onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                                placeholder="빈칸이면 자동 생성됩니다"
                                maxLength={20}
                            />
                            <Button type="button" variant="outline" onClick={generateRandomCode}>
                                자동생성
                            </Button>
                        </div>
                    </div>

                    <div>
                        <Label htmlFor="codeType">코드 타입 *</Label>
                        <Select
                            value={formData.codeType}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, codeType: value }))}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="master">마스터 (무제한)</SelectItem>
                                <SelectItem value="limited">제한형</SelectItem>
                                <SelectItem value="qr_unlimited">QR 무제한</SelectItem>
                                <SelectItem value="qr_limited">QR 제한형</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {(formData.codeType === 'limited' || formData.codeType === 'qr_limited') && (
                        <div>
                            <Label htmlFor="maxUsage">최대 사용 인원 *</Label>
                            <Input
                                id="maxUsage"
                                type="number"
                                value={formData.maxUsage}
                                onChange={(e) => setFormData(prev => ({ ...prev, maxUsage: e.target.value }))}
                                placeholder="예: 100"
                                min="1"
                                required
                            />
                        </div>
                    )}

                    {(formData.codeType === 'qr_unlimited' || formData.codeType === 'qr_limited') && (
                        <>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="isQREnabled"
                                    checked={formData.isQREnabled}
                                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isQREnabled: checked }))}
                                />
                                <Label htmlFor="isQREnabled">QR 코드 활성화</Label>
                            </div>

                            {formData.isQREnabled && (
                                <div>
                                    <Label htmlFor="qrDescription">QR 설명</Label>
                                    <Input
                                        id="qrDescription"
                                        value={formData.qrDescription}
                                        onChange={(e) => setFormData(prev => ({ ...prev, qrDescription: e.target.value }))}
                                        placeholder="QR 코드 설명 입력"
                                        maxLength={100}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div>
                        <Label htmlFor="expiresAt">만료일 (선택사항)</Label>
                        <Input
                            id="expiresAt"
                            type="date"
                            value={formData.expiresAt}
                            onChange={(e) => setFormData(prev => ({ ...prev, expiresAt: e.target.value }))}
                        />
                    </div>

                    <div className="flex justify-end space-x-2">
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? '생성 중...' : '코드 생성'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
