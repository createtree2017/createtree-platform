import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { History as HistoryIcon, Camera, Calendar, ArrowLeft, Download, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pagination } from "@/components/ui/pagination";
import { useToast } from "@/hooks/use-toast";
import { SNAPSHOT_MODES, SNAPSHOT_STYLES } from "@/constants/snapshot";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

interface SnapshotRecord {
  id: number;
  mode: string;
  style: string;
  gender?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  imageUrls: string[];
  thumbnailUrls?: string[];
}

interface HistoryResponse {
  records: SnapshotRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function SnapshotHistoryPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all_statuses');
  const [selectedRecord, setSelectedRecord] = useState<SnapshotRecord | null>(null);
  const [viewImageIndex, setViewImageIndex] = useState(0);
  const limit = 10;

  // Reset pagination to page 1 when status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  const { data, isLoading, error } = useQuery<HistoryResponse>({
    queryKey: ['/api/snapshot/history', { page, limit, status: statusFilter }],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit)
      });
      
      if (statusFilter && statusFilter !== 'all_statuses') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/snapshot/history?${params}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('히스토리 조회 실패');
      }

      return response.json();
    }
  });

  const getModeLabel = (mode: string) => {
    const found = SNAPSHOT_MODES.find(m => m.value === mode);
    return found?.label || mode;
  };

  const getStyleLabel = (style: string) => {
    const found = SNAPSHOT_STYLES.find(s => s.value === style);
    return found?.label || style;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">완료</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500">대기중</Badge>;
      case 'failed':
        return <Badge variant="destructive">실패</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const downloadImage = async (url: string, recordId: number, index: number) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `snapshot-${recordId}-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      toast({
        title: "다운로드 완료",
        description: "이미지가 다운로드되었습니다."
      });
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드에 실패했습니다.",
        variant: "destructive"
      });
    }
  };

  const openImageViewer = (record: SnapshotRecord, imageIndex: number) => {
    setSelectedRecord(record);
    setViewImageIndex(imageIndex);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <HistoryIcon className="h-8 w-8 text-primary" />
            스냅샷 히스토리
          </h1>
          <p className="text-muted-foreground">
            생성한 스냅샷 기록을 확인하세요
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/snapshot">
            <ArrowLeft className="h-4 w-4 mr-2" />
            돌아가기
          </Link>
        </Button>
      </div>

      {/* 필터 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex-1 max-w-xs">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="상태 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_statuses">전체 상태</SelectItem>
                  <SelectItem value="completed">완료</SelectItem>
                  <SelectItem value="pending">대기중</SelectItem>
                  <SelectItem value="failed">실패</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 로딩 상태 */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* 에러 상태 */}
      {error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-destructive">히스토리를 불러오는데 실패했습니다.</p>
              <p className="text-sm text-muted-foreground mt-2">{error.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 데이터 표시 */}
      {!isLoading && !error && (
        <>
          {data && data.records.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center">
                  <Camera className="h-16 w-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">히스토리가 없습니다</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    아직 생성한 스냅샷이 없습니다
                  </p>
                  <Button asChild>
                    <Link href="/snapshot">
                      <Camera className="h-4 w-4 mr-2" />
                      스냅샷 생성하기
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 히스토리 목록 */}
              <div className="grid gap-6 md:grid-cols-2">
                {data?.records.map((record) => (
                  <Card key={record.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {getModeLabel(record.mode)} - {getStyleLabel(record.style)}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            {format(new Date(record.createdAt), 'PPP p', { locale: ko })}
                          </CardDescription>
                        </div>
                        {getStatusBadge(record.status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* 메타데이터 */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline">{getModeLabel(record.mode)}</Badge>
                          <Badge variant="outline">{getStyleLabel(record.style)}</Badge>
                          {record.gender && (
                            <Badge variant="outline">{record.gender}</Badge>
                          )}
                        </div>

                        {/* 이미지 썸네일 */}
                        {record.status === 'completed' && record.imageUrls && record.imageUrls.length > 0 && (
                          <div className="grid grid-cols-3 gap-2">
                            {record.imageUrls.slice(0, 6).map((url, index) => (
                              <div key={index} className="relative group cursor-pointer">
                                <AspectRatio ratio={1}>
                                  <img
                                    src={record.thumbnailUrls?.[index] || url}
                                    alt={`Result ${index + 1}`}
                                    className="rounded-md object-cover w-full h-full"
                                    onClick={() => openImageViewer(record, index)}
                                  />
                                </AspectRatio>
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-md flex items-center justify-center gap-1">
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openImageViewer(record, index);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="secondary"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      downloadImage(url, record.id, index);
                                    }}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {record.status === 'pending' && (
                          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            생성 중...
                          </div>
                        )}

                        {record.status === 'failed' && (
                          <div className="text-center py-4 text-sm text-destructive">
                            생성에 실패했습니다
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* 페이지네이션 */}
              {data && data.totalPages > 1 && (
                <div className="flex justify-center pt-4">
                  <Pagination
                    currentPage={page}
                    totalPages={data.totalPages}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 이미지 뷰어 다이얼로그 */}
      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {selectedRecord && `${getModeLabel(selectedRecord.mode)} - ${getStyleLabel(selectedRecord.style)}`}
            </DialogTitle>
          </DialogHeader>
          {selectedRecord && selectedRecord.imageUrls && (
            <div className="space-y-4">
              <AspectRatio ratio={16 / 9}>
                <img
                  src={selectedRecord.imageUrls[viewImageIndex]}
                  alt={`Image ${viewImageIndex + 1}`}
                  className="rounded-lg object-contain w-full h-full"
                />
              </AspectRatio>
              
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {selectedRecord.imageUrls.map((_, index) => (
                    <Button
                      key={index}
                      variant={viewImageIndex === index ? "default" : "outline"}
                      size="sm"
                      onClick={() => setViewImageIndex(index)}
                    >
                      {index + 1}
                    </Button>
                  ))}
                </div>
                <Button
                  onClick={() => downloadImage(
                    selectedRecord.imageUrls[viewImageIndex],
                    selectedRecord.id,
                    viewImageIndex
                  )}
                >
                  <Download className="h-4 w-4 mr-2" />
                  다운로드
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
