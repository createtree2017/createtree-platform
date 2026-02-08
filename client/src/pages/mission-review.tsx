import { useParams } from "wouter";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReviewDashboard } from "@/components/admin/MissionManagement";

/**
 * 미션 검수 전용 페이지
 * - mission-detail 페이지의 "검수 대기" 바로가기 버튼에서 진입
 * - ReviewDashboard를 재사용하여 해당 미션의 검수 화면을 보여줌
 * - hospital_admin / admin / superadmin 전용 (App.tsx ProtectedRoute에서 제한)
 */
export default function MissionReviewPage() {
    const { missionId } = useParams<{ missionId: string }>();
    const [, navigate] = useLocation();

    return (
        <div className="min-h-screen bg-background py-6 px-4">
            {/* 뒤로가기 버튼 */}
            <div className="mb-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/missions/${missionId}`)}
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    미션으로 돌아가기
                </Button>
            </div>

            {/* 검수 대시보드 - 해당 미션 자동 선택 */}
            <ReviewDashboard
                activeMissionId={missionId || null}
            />
        </div>
    );
}
