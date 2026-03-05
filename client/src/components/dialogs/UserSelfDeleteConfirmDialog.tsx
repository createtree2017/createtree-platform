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
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface UserSelfDeleteConfirmDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    isDeleting: boolean;
}

export function UserSelfDeleteConfirmDialog({
    isOpen,
    onOpenChange,
    onConfirm,
    isDeleting,
}: UserSelfDeleteConfirmDialogProps) {
    return (
        <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="w-5 h-5" />
                        정말 탈퇴하시겠습니까?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4 pt-4">
                        <p>
                            회원 탈퇴를 신청하시면 이하의 조치가 취해집니다:
                        </p>
                        <ul className="list-disc pl-5 space-y-1 text-sm text-gray-600">
                            <li>즉시 로그아웃되며, 현재 계정으로 다시 로그인할 수 없습니다.</li>
                            <li>보관된 모든 파일(이미지, 음악..) 및 서비스 이용 내역은, 완전히 삭제될 수 있습니다.</li>
                        </ul>
                        <p className="font-medium text-red-600 mt-4">
                            탈퇴 후에는 이 계정을 다시 복구할 수 없습니다.
                        </p>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                    <Button
                        variant="destructive"
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        disabled={isDeleting}
                    >
                        {isDeleting ? "처리 중..." : "탈퇴하기"}
                    </Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
