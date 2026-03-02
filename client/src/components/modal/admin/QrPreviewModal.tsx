import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Copy } from 'lucide-react';
import { useModalContext } from '@/contexts/ModalContext';

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

interface QrPreviewModalProps {
    code: HospitalCode;
    onDownload: (code: HospitalCode) => void;
    onCopyData: (code: HospitalCode) => void;
}

export function QrPreviewModal({ code, onDownload, onCopyData }: QrPreviewModalProps) {
    const modal = useModalContext();

    return (
        <Dialog open={true} onOpenChange={(open) => !open && modal.closeTopModal()}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>QR 코드 미리보기</DialogTitle>
                    <DialogDescription>
                        {code.hospitalName} - {code.code}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="flex justify-center">
                        <img
                            src={`/api/qr/generate/${code.hospitalId}/${code.id}`}
                            alt="QR Code"
                            className="w-64 h-64 border rounded"
                            onError={(e) => {
                                console.error('QR 이미지 로드 실패');
                                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjU2IiBoZWlnaHQ9IjI1NiIgdmlld0JveD0iMCAwIDI1NiAyNTYiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyNTYiIGhlaWdodD0iMjU2IiBmaWxsPSIjRjNGNEY2Ii8+Cjx0ZXh0IHg9IjEyOCIgeT0iMTI4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNkI3MjgwIiBmb250LXNpemU9IjE2Ij5RUiDloZTrk5zquLDroqTsg4E8L3RleHQ+Cjwvc3ZnPgo=';
                            }}
                        />
                    </div>
                    <div className="flex space-x-2">
                        <Button
                            onClick={() => onDownload(code)}
                            className="flex-1"
                        >
                            <Download className="w-4 h-4 mr-2" />
                            다운로드
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => onCopyData(code)}
                            className="flex-1"
                        >
                            <Copy className="w-4 h-4 mr-2" />
                            데이터 복사
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
