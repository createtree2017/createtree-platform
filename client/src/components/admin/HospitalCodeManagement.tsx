import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, QrCode, Users, Calendar, Edit, Download, Eye, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useModalContext } from '@/contexts/ModalContext';
import { apiRequest } from '@/lib/queryClient';
import { formatSimpleDate, parseKoreanDate } from '@/lib/dateUtils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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

interface Hospital {
  id: number;
  name: string;
  isActive: boolean;
}

const HospitalCodeManagement: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<HospitalCode | null>(null);
  const modal = useModalContext();

  // 병원 목록 조회
  const { data: hospitals = [], isLoading: hospitalsLoading } = useQuery<Hospital[]>({
    queryKey: ['/api/hospitals'],
    staleTime: 5 * 60 * 1000,
  });

  // 병원 코드 목록 조회
  const { data: hospitalCodes = [], isLoading: codesLoading, refetch: refetchCodes } = useQuery<HospitalCode[]>({
    queryKey: ['/api/admin/hospital-codes'],
    staleTime: 30 * 1000,
  });

  // 병원 코드 생성
  const createCodeMutation = useMutation({
    mutationFn: (codeData: any) => apiRequest('/api/admin/hospital-codes', {
      method: 'POST',
      body: JSON.stringify(codeData),
    }),
    onSuccess: () => {
      toast({
        title: '성공',
        description: '병원 코드가 생성되었습니다.',
      });
      modal.closeTopModal();
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hospital-codes'] });
    },
    onError: (error: any) => {
      toast({
        title: '오류',
        description: error.message || '코드 생성에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 병원 코드 삭제
  const deleteCodeMutation = useMutation({
    mutationFn: (codeId: number) => apiRequest(`/api/admin/hospital-codes/${codeId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      toast({
        title: '성공',
        description: '병원 코드가 삭제되었습니다.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hospital-codes'] });
    },
    onError: (error: any) => {
      toast({
        title: '오류',
        description: error.message || '코드 삭제에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // 병원 코드 활성화/비활성화
  const toggleCodeMutation = useMutation({
    mutationFn: ({ codeId, isActive }: { codeId: number; isActive: boolean }) =>
      apiRequest(`/api/admin/hospital-codes/${codeId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      }),
    onSuccess: () => {
      toast({
        title: '성공',
        description: '코드 상태가 변경되었습니다.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/hospital-codes'] });
    },
    onError: (error: any) => {
      toast({
        title: '오류',
        description: error.message || '상태 변경에 실패했습니다.',
        variant: 'destructive',
      });
    },
  });

  // QR 코드 다운로드 함수
  const downloadQRCode = async (code: HospitalCode) => {
    try {
      const response = await fetch(`/api/qr/generate/${code.hospitalId}/${code.id}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `QR-${code.hospitalName}-${code.code}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: '성공',
          description: 'QR 코드가 다운로드되었습니다.',
        });
      } else {
        throw new Error('QR 코드 다운로드 실패');
      }
    } catch (error) {
      toast({
        title: '오류',
        description: 'QR 코드 다운로드에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // QR 데이터 복사 함수
  const copyQRData = async (code: HospitalCode) => {
    try {
      const response = await fetch(`/api/qr/data/${code.hospitalId}/${code.id}`);
      if (response.ok) {
        const data = await response.json();
        await navigator.clipboard.writeText(data.qrString);

        toast({
          title: '성공',
          description: 'QR 데이터가 클립보드에 복사되었습니다.',
        });
      } else {
        throw new Error('QR 데이터 조회 실패');
      }
    } catch (error) {
      toast({
        title: '오류',
        description: 'QR 데이터 복사에 실패했습니다.',
        variant: 'destructive',
      });
    }
  };

  // QR 코드 미리보기 열기
  const openQRPreview = (code: HospitalCode) => {
    console.log('QR 미리보기 열기:', code);
    modal.openModal('qrPreview', {
      code,
      onDownload: downloadQRCode,
      onCopyData: copyQRData
    });
  };

  // 코드 수정 다이얼로그 열기
  const openEditDialog = (code: HospitalCode) => {
    modal.openModal('editHospitalCode', {
      hospitals,
      code,
      onSubmit: (data: any) => {
        // 수정 API 호출 로직 추가 필요
        console.log('코드 수정:', data);
        modal.closeTopModal();
      },
      isLoading: false
    });
  };

  // 필터링된 코드 목록
  const filteredCodes = hospitalCodes.filter((code) =>
    selectedHospitalFilter === 'all' || code.hospitalId.toString() === selectedHospitalFilter
  );

  // 코드 타입별 색상
  const getCodeTypeColor = (type: string) => {
    switch (type) {
      case 'master': return 'bg-purple-100 text-purple-800';
      case 'limited': return 'bg-blue-100 text-blue-800';
      case 'qr_unlimited': return 'bg-green-100 text-green-800';
      case 'qr_limited': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 코드 타입 한글명
  const getCodeTypeName = (type: string) => {
    switch (type) {
      case 'master': return '마스터';
      case 'limited': return '제한형';
      case 'qr_unlimited': return 'QR 무제한';
      case 'qr_limited': return 'QR 제한';
      default: return type;
    }
  };

  // 사용률 계산
  const getUsagePercentage = (current: number, max: number | null) => {
    if (!max) return 0;
    return Math.round((current / max) * 100);
  };

  // 사용률 색상
  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 70) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">병원 코드 관리</h2>
          <p className="text-muted-foreground">
            병원별 회원 인증코드를 생성하고 관리합니다
          </p>
        </div>

        <Button onClick={() => modal.openModal('createHospitalCode', {
          hospitals,
          onSubmit: (data: any) => createCodeMutation.mutate(data),
          isLoading: createCodeMutation.isPending
        })}>
          <Plus className="mr-2 h-4 w-4" />
          새 코드 생성
        </Button>
      </div>

      {/* 필터 및 통계 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 코드 수</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hospitalCodes.length}</div>
            <p className="text-xs text-muted-foreground">
              활성: {hospitalCodes.filter((c) => c.isActive).length}개
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 사용자 수</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hospitalCodes.reduce((sum, code) => sum + code.currentUsage, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              누적 가입자 수
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">병원 필터</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={selectedHospitalFilter} onValueChange={setSelectedHospitalFilter}>
              <SelectTrigger>
                <SelectValue placeholder="병원 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 병원</SelectItem>
                {hospitals.map((hospital) => (
                  <SelectItem key={hospital.id} value={hospital.id.toString()}>
                    {hospital.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {/* 코드 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>병원 코드 목록</CardTitle>
          <CardDescription>
            생성된 모든 병원 코드와 사용 현황을 확인할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {codesLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>병원</TableHead>
                  <TableHead>코드</TableHead>
                  <TableHead>타입</TableHead>
                  <TableHead>사용 현황</TableHead>
                  <TableHead>QR</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>생성일</TableHead>
                  <TableHead>만료일</TableHead>
                  <TableHead className="text-right">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCodes.map((code) => (
                  <TableRow key={code.id}>
                    <TableCell className="font-medium">
                      {code.hospitalName}
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-sm">
                        {code.code}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge className={getCodeTypeColor(code.codeType)}>
                        {getCodeTypeName(code.codeType)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm">
                          {code.currentUsage}
                          {code.maxUsage && ` / ${code.maxUsage}`}
                        </span>
                        {code.maxUsage && (
                          <span className={`text-xs ${getUsageColor(getUsagePercentage(code.currentUsage, code.maxUsage))}`}>
                            ({getUsagePercentage(code.currentUsage, code.maxUsage)}%)
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {code.isQREnabled ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          활성
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-600">
                          비활성
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={code.isActive}
                        onCheckedChange={(checked) =>
                          toggleCodeMutation.mutate({ codeId: code.id, isActive: checked })
                        }
                        disabled={toggleCodeMutation.isPending}
                      />
                    </TableCell>
                    <TableCell>
                      {formatSimpleDate(code.createdAt)}
                    </TableCell>
                    <TableCell>
                      {code.expiresAt ? (
                        <div className="text-sm">
                          {formatSimpleDate(code.expiresAt)}
                          {(() => {
                            const expiry = parseKoreanDate(code.expiresAt);
                            return expiry && expiry < new Date() ? (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                만료됨
                              </Badge>
                            ) : null;
                          })()}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">무제한</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        {code.isQREnabled && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openQRPreview(code)}
                              title="QR 코드 미리보기"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadQRCode(code)}
                              title="QR 코드 다운로드"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyQRData(code)}
                              title="QR 데이터 복사"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(code)}
                          title="코드 수정"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCodeToDelete(code);
                            setDeleteDialogOpen(true);
                          }}
                          disabled={deleteCodeMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                          title="코드 삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>병원 코드 삭제 확인</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <div>
                정말로 <strong>"{codeToDelete?.code}"</strong> 코드를 삭제하시겠습니까?
              </div>
              <div className="text-sm text-muted-foreground">
                • 삭제된 코드는 복구할 수 없습니다
              </div>
              <div className="text-sm text-muted-foreground">
                • 해당 코드로 가입한 사용자들의 접근에 영향을 줄 수 있습니다
              </div>
              <div className="text-sm text-muted-foreground">
                • 병원: {codeToDelete?.hospitalName}
              </div>
              <div className="text-sm text-muted-foreground">
                • 현재 사용자 수: {codeToDelete?.currentUsage}명
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setCodeToDelete(null)}>
              취소
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (codeToDelete) {
                  deleteCodeMutation.mutate(codeToDelete.id);
                  setDeleteDialogOpen(false);
                  setCodeToDelete(null);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteCodeMutation.isPending}
            >
              {deleteCodeMutation.isPending ? '삭제 중...' : '삭제하기'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HospitalCodeManagement;