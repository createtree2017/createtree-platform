import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function PushLogs() {
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/admin/push-logs", page],
    queryFn: async () => {
       const res = await fetch(`/api/admin/push-logs?page=${page}&limit=${limit}`);
       if (!res.ok) throw new Error("푸시 로그를 불러오는데 실패했습니다.");
       return res.json();
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed": return <Badge variant="default" className="bg-green-500">성공</Badge>;
      case "failed": return <Badge variant="destructive">실패</Badge>;
      case "partial_success": return <Badge variant="outline" className="text-yellow-600 border-yellow-600">부분 성공</Badge>;
      case "pending": return <Badge variant="secondary">대기중</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const getTriggerTypeBadge = (type: string) => {
    switch (type) {
      case "manual": return <Badge variant="outline" className="bg-blue-50">수동</Badge>;
      case "mission_approved": return <Badge variant="outline" className="bg-indigo-50">미션 승인</Badge>;
      case "mission_rejected": return <Badge variant="outline" className="bg-orange-50">미션 반려</Badge>;
      case "grade_up": return <Badge variant="outline" className="bg-purple-50">등급업</Badge>;
      default: return <Badge variant="outline">{type}</Badge>;
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">로딩 중...</div>;
  if (isError) return <div className="p-8 text-center text-red-500">데이터를 불러오는 중 오류가 발생했습니다.</div>;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>푸시 발송 내역</CardTitle>
        <Button variant="outline" onClick={() => { setPage(1); /* Need to invalidate query but simple page reset is fine */}}>
          새로고침
        </Button>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>발송 시간</TableHead>
                <TableHead>유형</TableHead>
                <TableHead>대분류</TableHead>
                <TableHead>제목</TableHead>
                <TableHead>전체건</TableHead>
                <TableHead>성공</TableHead>
                <TableHead>실패</TableHead>
                <TableHead>상태</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center">
                    발송 내역이 없습니다.
                  </TableCell>
                </TableRow>
              ) : (
                data?.logs?.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {log.completedAt ? format(new Date(log.completedAt), "MM-dd HH:mm") : "-"}
                    </TableCell>
                    <TableCell>{getTriggerTypeBadge(log.triggerType)}</TableCell>
                    <TableCell>{log.targetType === "all" ? "전체" : "특정 대상"}</TableCell>
                    <TableCell className="max-w-[200px] truncate" title={log.title || "제목 없음"}>
                      {log.title || "제목 없음"}
                    </TableCell>
                    <TableCell>{(log.successCount || 0) + (log.failureCount || 0)}</TableCell>
                    <TableCell className="text-green-600 font-medium">{log.successCount}</TableCell>
                    <TableCell className="text-red-500 font-medium">{log.failureCount}</TableCell>
                    <TableCell>{getStatusBadge(log.status)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* 간단한 페이지네이션 */}
        {data?.pagination && data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-center space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              이전
            </Button>
            <span className="text-sm">
              {page} / {data.pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page === data.pagination.totalPages}
            >
              다음
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
