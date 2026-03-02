import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FileUpload } from '@/components/ui/file-upload';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useModalContext } from '@/contexts/ModalContext';

interface CharacterGenerationModalProps {
    onSuccess: (data: any) => void;
    babyName: string;
    styleId: string | null;
}

export function CharacterGenerationModal({ onSuccess, babyName, styleId }: CharacterGenerationModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [backgroundDescription, setBackgroundDescription] = useState<string>('환상적이고 아름다운 배경');
    const { toast } = useToast();
    const modal = useModalContext();

    const handleFileSelected = (file: File) => {
        setSelectedFile(file);
    };

    const generateCharacterMutation = useMutation({
        mutationFn: async (data: FormData) => {
            return fetch('/api/dream-books/character', {
                method: 'POST',
                body: data
            }).then(response => {
                if (!response.ok) {
                    throw new Error('캐릭터 생성에 실패했습니다');
                }
                return response.json();
            });
        },
        onSuccess: (data) => {
            onSuccess(data);
            modal.closeTopModal();
        },
        onError: (error) => {
            toast({
                title: '오류 발생',
                description: '캐릭터 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
                variant: 'destructive'
            });
            console.error('Character generation error:', error);
        }
    });

    const handleGenerateCharacter = () => {
        if (!selectedFile) {
            toast({
                title: '사진 필요',
                description: '캐릭터 생성을 위해 사진을 업로드해주세요.',
                variant: 'destructive'
            });
            return;
        }

        if (!styleId) {
            toast({
                title: '스타일 필요',
                description: '캐릭터 생성을 위해 스타일을 선택해주세요.',
                variant: 'destructive'
            });
            return;
        }

        toast({
            title: '캐릭터 생성 시작',
            description: '업로드한 사진을 기반으로 아기 캐릭터를 생성하고 있습니다. 잠시 기다려주세요.',
        });

        const formData = new FormData();
        formData.append('babyName', babyName || '아기');
        formData.append('style', String(styleId));
        formData.append('image', selectedFile);
        formData.append('backgroundDescription', backgroundDescription);

        generateCharacterMutation.mutate(formData);
    };

    return (
        <Dialog open={true} onOpenChange={(open) => !open && modal.closeTopModal()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>사진으로 캐릭터 생성하기</DialogTitle>
                    <DialogDescription>
                        사진을 업로드하여 태몽동화에 사용할 캐릭터를 생성할 수 있습니다.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="space-y-4">
                        <p className="text-sm font-medium">사진 업로드</p>
                        <FileUpload
                            accept="image/*"
                            maxSize={5 * 1024 * 1024} // 5MB
                            onFileSelect={handleFileSelected}
                        />
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-medium">배경 설명</p>
                        <Textarea
                            placeholder="이 캐릭터가 있는 장면의 배경을 묘사해주세요. (예: 밤하늘에 별이 가득하고 잔디밭이 펼쳐진 초원)"
                            id="backgroundDescription"
                            rows={3}
                            className="resize-none"
                            value={backgroundDescription}
                            onChange={(e) => setBackgroundDescription(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            캐릭터가 있는 장면의 배경을 자세히 묘사해주세요. 이 설명에 따라 배경이 함께 생성됩니다.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => modal.closeTopModal()}
                    >
                        취소
                    </Button>
                    <Button
                        onClick={handleGenerateCharacter}
                        disabled={generateCharacterMutation.isPending || !selectedFile}
                    >
                        {generateCharacterMutation.isPending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                생성 중...
                            </>
                        ) : (
                            "캐릭터 생성하기"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
