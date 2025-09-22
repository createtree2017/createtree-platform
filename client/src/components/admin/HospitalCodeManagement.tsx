import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Trash2, Plus, QrCode, Users, Calendar, Edit, Download, Eye, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>('all');
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [selectedCodeForQR, setSelectedCodeForQR] = useState<HospitalCode | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<HospitalCode | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [codeToDelete, setCodeToDelete] = useState<HospitalCode | null>(null);

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
      setIsCreateDialogOpen(false);
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
    setSelectedCodeForQR(code);
    setQrDialogOpen(true);
  };

  // 코드 수정 다이얼로그 열기
  const openEditDialog = (code: HospitalCode) => {
    setEditingCode(code);
    setEditDialogOpen(true);
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
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              새 코드 생성
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>새 병원 코드 생성</DialogTitle>
              <DialogDescription>
                병원 회원 인증을 위한 새로운 코드를 생성합니다
              </DialogDescription>
            </DialogHeader>
            <CreateCodeForm 
              hospitals={hospitals}
              onSubmit={(data) => createCodeMutation.mutate(data)}
              isLoading={createCodeMutation.isPending}
            />
          </DialogContent>
        </Dialog>
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
                      {new Date(code.createdAt).toLocaleDateString('ko-KR')}
                    </TableCell>
                    <TableCell>
                      {code.expiresAt ? (
                        <div className="text-sm">
                          {new Date(code.expiresAt).toLocaleDateString('ko-KR')}
                          {new Date(code.expiresAt) < new Date() && (
                            <Badge variant="destructive" className="ml-2 text-xs">
                              만료됨
                            </Badge>
                          )}
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

      {/* QR 코드 미리보기 다이얼로그 */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>QR 코드 미리보기</DialogTitle>
            <DialogDescription>
              {selectedCodeForQR && `${selectedCodeForQR.hospitalName} - ${selectedCodeForQR.code}`}
            </DialogDescription>
          </DialogHeader>
          {selectedCodeForQR && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <img 
                  src={`/api/qr/generate/${selectedCodeForQR.hospitalId}/${selectedCodeForQR.id}`}
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
                  onClick={() => downloadQRCode(selectedCodeForQR)}
                  className="flex-1"
                >
                  <Download className="w-4 h-4 mr-2" />
                  다운로드
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => copyQRData(selectedCodeForQR)}
                  className="flex-1"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  데이터 복사
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 코드 수정 다이얼로그 */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>병원 코드 수정</DialogTitle>
            <DialogDescription>
              기존 병원 코드의 설정을 수정합니다
            </DialogDescription>
          </DialogHeader>
          {editingCode && (
            <EditCodeForm 
              hospitals={hospitals}
              code={editingCode}
              onSubmit={(data) => {
                // 수정 API 호출 로직 추가 필요
                console.log('코드 수정:', data);
                setEditDialogOpen(false);
              }}
              isLoading={false}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// 코드 생성 폼 컴포넌트
interface CreateCodeFormProps {
  hospitals: Hospital[];
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

const CreateCodeForm: React.FC<CreateCodeFormProps> = ({ hospitals, onSubmit, isLoading }) => {
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
  );
};

// 코드 수정 폼 컴포넌트
interface EditCodeFormProps {
  hospitals: Hospital[];
  code: HospitalCode;
  onSubmit: (data: any) => void;
  isLoading: boolean;
}

const EditCodeForm: React.FC<EditCodeFormProps> = ({ hospitals, code, onSubmit, isLoading }) => {
  const [formData, setFormData] = useState({
    hospitalId: code.hospitalId.toString(),
    codeType: code.codeType,
    maxUsage: code.maxUsage?.toString() || '',
    isQREnabled: code.isQREnabled,
    qrDescription: code.qrDescription || '',
    expiresAt: code.expiresAt ? code.expiresAt.split('T')[0] : ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      hospitalId: parseInt(formData.hospitalId),
      maxUsage: formData.maxUsage ? parseInt(formData.maxUsage.toString()) : null,
      expiresAt: formData.expiresAt || null
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="edit-hospital">병원 선택</Label>
        <Select value={formData.hospitalId} onValueChange={(value) => setFormData({...formData, hospitalId: value})}>
          <SelectTrigger>
            <SelectValue placeholder="병원을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            {hospitals.map((hospital) => (
              <SelectItem key={hospital.id} value={hospital.id.toString()}>
                {hospital.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="edit-codeType">코드 타입</Label>
        <Select value={formData.codeType} onValueChange={(value) => setFormData({...formData, codeType: value as any})}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="master">마스터 (무제한)</SelectItem>
            <SelectItem value="limited">제한형</SelectItem>
            <SelectItem value="qr_unlimited">QR 무제한</SelectItem>
            <SelectItem value="qr_limited">QR 제한</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {(formData.codeType === 'limited' || formData.codeType === 'qr_limited') && (
        <div>
          <Label htmlFor="edit-maxUsage">최대 사용 인원</Label>
          <Input
            id="edit-maxUsage"
            type="number"
            value={formData.maxUsage}
            onChange={(e) => setFormData({...formData, maxUsage: e.target.value})}
            placeholder="최대 사용 가능 인원수"
            min="1"
          />
        </div>
      )}

      {formData.codeType.startsWith('qr_') && (
        <>
          <div className="flex items-center space-x-2">
            <Switch
              id="edit-qrEnabled"
              checked={formData.isQREnabled}
              onCheckedChange={(checked) => setFormData({...formData, isQREnabled: checked})}
            />
            <Label htmlFor="edit-qrEnabled">QR 코드 활성화</Label>
          </div>

          {formData.isQREnabled && (
            <div>
              <Label htmlFor="edit-qrDescription">QR 설명</Label>
              <Input
                id="edit-qrDescription"
                value={formData.qrDescription}
                onChange={(e) => setFormData({...formData, qrDescription: e.target.value})}
                placeholder="QR 코드에 대한 설명 (선택사항)"
              />
            </div>
          )}
        </>
      )}

      <div>
        <Label htmlFor="edit-expiresAt">만료일 (선택사항)</Label>
        <Input
          id="edit-expiresAt"
          type="date"
          value={formData.expiresAt}
          onChange={(e) => setFormData({...formData, expiresAt: e.target.value})}
        />
      </div>

      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={() => {}}>
          취소
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? '수정 중...' : '수정 완료'}
        </Button>
      </div>
    </form>
  );
};

export default HospitalCodeManagement;