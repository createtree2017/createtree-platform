import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { useToast } from "@/hooks/use-toast";
import { Save, X, Palette } from "lucide-react";

interface PopularStyle {
    id?: number;
    title: string;
    imageUrl: string;
    linkUrl?: string;
    isActive: boolean;
    sortOrder: number;
}

interface PopularStyleFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    styleCard?: PopularStyle | null;
    onSubmit: (data: Omit<PopularStyle, 'id'>) => void;
    isPending?: boolean;
}

export default function PopularStyleFormModal({ isOpen, onClose, styleCard, onSubmit, isPending }: PopularStyleFormModalProps) {
    const { toast } = useToast();
    const isEditing = !!styleCard;

    const [formData, setFormData] = useState<Omit<PopularStyle, 'id'>>({
        title: "",
        imageUrl: "",
        linkUrl: "",
        isActive: true,
        sortOrder: 0
    });

    useEffect(() => {
        if (isOpen) {
            if (styleCard) {
                setFormData({
                    title: styleCard.title,
                    imageUrl: styleCard.imageUrl,
                    linkUrl: styleCard.linkUrl || "",
                    isActive: styleCard.isActive,
                    sortOrder: styleCard.sortOrder
                });
            } else {
                setFormData({
                    title: "",
                    imageUrl: "",
                    linkUrl: "",
                    isActive: true,
                    sortOrder: 0
                });
            }
        }
    }, [isOpen, styleCard]);

    const handleImageUpload = async (file: File) => {
        try {
            const uploadData = new FormData();
            uploadData.append('banner', file);
            uploadData.append('bannerType', 'popular-styles');

            const response = await fetch('/api/admin/upload/banner', {
                method: 'POST',
                body: uploadData,
            });

            if (!response.ok) throw new Error('Upload failed');

            const result = await response.json();
            setFormData(prev => ({ ...prev, imageUrl: result.url || result.imageSrc }));

            toast({ title: "업로드 완료", description: "이미지가 성공적으로 업로드되었습니다." });
        } catch (error) {
            toast({ title: "업로드 실패", description: "이미지 업로드 중 오류가 발생했습니다.", variant: "destructive" });
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.title.trim()) {
            toast({ title: "입력 오류", description: "제목을 입력해주세요.", variant: "destructive" });
            return;
        }
        if (!formData.imageUrl.trim()) {
            toast({ title: "입력 오류", description: "이미지를 업로드해주세요.", variant: "destructive" });
            return;
        }
        onSubmit(formData);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        {isEditing ? "인기스타일 수정" : "새 인기스타일 추가"}
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <Label htmlFor="title">제목 *</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="인기스타일 제목을 입력하세요"
                            required
                        />
                    </div>

                    <div>
                        <Label htmlFor="linkUrl">이동 링크</Label>
                        <Input
                            id="linkUrl"
                            value={formData.linkUrl}
                            onChange={(e) => setFormData(prev => ({ ...prev, linkUrl: e.target.value }))}
                            placeholder="/maternity-photo 또는 https://example.com"
                        />
                    </div>

                    <div>
                        <Label htmlFor="sortOrder">정렬 순서</Label>
                        <Input
                            id="sortOrder"
                            type="number"
                            value={formData.sortOrder}
                            onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                            placeholder="0"
                        />
                    </div>

                    <div>
                        <Label>이미지 *</Label>
                        <div className="mt-2 space-y-3">
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="이미지 URL을 입력하세요"
                                    value={formData.imageUrl}
                                    onChange={(e) => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <FileUpload
                                    onFileSelect={handleImageUpload}
                                    accept="image/*"
                                    className="w-auto"
                                />
                            </div>
                            {formData.imageUrl && (
                                <div className="mt-3">
                                    <img
                                        src={formData.imageUrl}
                                        alt="미리보기"
                                        className="w-20 h-20 object-cover rounded border"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                            className="rounded"
                        />
                        <Label htmlFor="isActive">활성화</Label>
                    </div>

                    <div className="flex space-x-2 pt-4">
                        <Button type="submit" className="flex-1" disabled={isPending}>
                            <Save className="w-4 h-4 mr-2" />
                            {isEditing ? "수정" : "생성"}
                        </Button>
                        <Button type="button" variant="outline" onClick={onClose}>
                            <X className="w-4 h-4 mr-2" />
                            취소
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
