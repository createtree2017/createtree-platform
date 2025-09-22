
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, MessageSquare, UserCheck, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Review {
  id: number;
  reviewUrl: string;
  isSelected: boolean;
  createdAt: string;
  user: {
    id: number;
    username: string;
    email: string;
  };
}

export default function HospitalDashboard() {
  const { user } = useAuth();
  
  // 현재 사용자의 병원 정보 조회
  const { data: hospitalInfo } = useQuery({
    queryKey: ["/api/hospital/info"],
    enabled: !!user && user.memberType === 'hospital_admin'
  });

  // 후기 목록 조회
  const { data: reviews = [], isLoading: reviewsLoading } = useQuery({
    queryKey: ["/hospital/reviews"],
    queryFn: () => fetch("/hospital/reviews").then(r => r.json()).then(res => res.data || [])
  });

  const handleSelectReview = async (reviewId: number, isSelected: boolean) => {
    try {
      const response = await fetch(`/hospital/reviews/${reviewId}/select`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSelected })
      });

      if (response.ok) {
        // 후기 목록 새로고침
        window.location.reload();
      }
    } catch (error) {
      console.error('후기 선정 변경 실패:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR');
  };

  if (!user || !['hospital_admin', 'admin', 'superadmin'].includes(user.memberType)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">접근 권한 없음</h3>
              <p className="text-sm text-gray-500">병원 관리자 권한이 필요합니다.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">병원 관리 대시보드</h1>
          <p className="text-muted-foreground">후기를 관리하고 검토하세요.</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-2">        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">후기 수</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reviews.length}</div>
            <p className="text-xs text-muted-foreground">
              제출된 후기 수
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">선정된 후기</CardTitle>
            <UserCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reviews.filter((r: Review) => r.isSelected).length}
            </div>
            <p className="text-xs text-muted-foreground">
              승인된 후기 수
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 후기 관리 */}
      <Card>
        <CardHeader>
          <CardTitle>후기 관리</CardTitle>
          <CardDescription>
            제출된 후기를 검토하고 선정 여부를 결정하세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reviewsLoading ? (
            <div className="text-center py-8">로딩 중...</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              제출된 후기가 없습니다.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사용자</TableHead>
                  <TableHead>이메일</TableHead>
                  <TableHead>제출일</TableHead>
                  <TableHead>선정 상태</TableHead>
                  <TableHead>후기 링크</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review: Review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">
                      {review.user.username}
                    </TableCell>
                    <TableCell>{review.user.email}</TableCell>
                    <TableCell>{formatDate(review.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={review.isSelected ? "default" : "secondary"}>
                        {review.isSelected ? "선정됨" : "검토 중"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            보기
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>후기 내용</DialogTitle>
                            <DialogDescription>
                              {review.user.username}님의 후기
                            </DialogDescription>
                          </DialogHeader>
                          <div className="mt-4">
                            <iframe 
                              src={review.reviewUrl} 
                              className="w-full h-96 border rounded"
                              title="후기 내용"
                            />
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant={review.isSelected ? "destructive" : "default"}
                        size="sm"
                        onClick={() => handleSelectReview(review.id, !review.isSelected)}
                      >
                        {review.isSelected ? "선정 취소" : "선정"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}