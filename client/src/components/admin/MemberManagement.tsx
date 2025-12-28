import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { Edit, Trash2, Search } from "lucide-react";

interface User {
  id: number;
  username: string;
  email: string;
  memberType: 'free' | 'pro' | 'membership' | 'hospital_admin' | 'admin' | 'superadmin';
  hospitalId?: number;
  hospital?: {
    id: number;
    name: string;
  };
  phoneNumber?: string;
  birthdate?: string;
  fullName?: string;
  createdAt: string;
}

export function MemberManagement() {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchInput, setSearchInput] = useState(""); // 입력창에 표시되는 값
  const [searchTerm, setSearchTerm] = useState(""); // 실제 검색에 사용되는 값 (디바운스됨)
  const [memberTypeFilter, setMemberTypeFilter] = useState("all");
  const [hospitalFilter, setHospitalFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // 검색어 디바운싱: 입력 후 500ms 대기 후 검색 실행
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 500);
    
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 사용자 목록 조회 (필터 파라미터 포함)
  const { data: usersResponse, isLoading, error } = useQuery({
    queryKey: ["/api/admin/users", { search: searchTerm, memberType: memberTypeFilter, hospitalId: hospitalFilter, page: currentPage }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (memberTypeFilter && memberTypeFilter !== 'all') params.append('memberType', memberTypeFilter);
      if (hospitalFilter && hospitalFilter !== 'all') params.append('hospitalId', hospitalFilter);
      params.append('page', currentPage.toString());
      
      const url = `/api/admin/users${params.toString() ? '?' + params.toString() : ''}`;
      
      return fetch(url, {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      }).then(res => res.json());
    }
  });

  const users = usersResponse?.users || [];
  const pagination = usersResponse?.pagination || { page: 1, limit: 50, total: 0, totalPages: 0 };

  // 검색어나 필터가 변경되면 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, memberTypeFilter, hospitalFilter]);

  // 병원 목록 조회 (수정 시 사용)
  const { data: hospitals } = useQuery({
    queryKey: ["/api/admin/hospitals"],
    queryFn: async () => {
      console.log('🏥 [MemberManagement] 병원 API 요청 시작');
      const response = await fetch("/api/admin/hospitals", {
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        throw new Error("병원 목록을 가져오는데 실패했습니다");
      }
      const data = await response.json();
      console.log('🏥 [MemberManagement] 병원 API 응답:', data);
      return data;
    }
  });

  // 디버깅 정보
  console.log("[MemberManagement] API 응답:", usersResponse);
  console.log("[MemberManagement] 사용자 목록:", users);
  console.log("[MemberManagement] 로딩 상태:", isLoading);
  console.log("[MemberManagement] 에러:", error);
  console.log("[MemberManagement] 병원 목록:", hospitals);

  // 사용자 수정 뮤테이션
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: number; userData: Partial<User> }) =>
      apiRequest(`/api/admin/users/${userId}`, {
        method: "PUT",
        body: JSON.stringify(userData),
      }),
    onSuccess: () => {
      toast({
        title: "회원 정보 수정 완료",
        description: "회원 정보가 성공적으로 수정되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
      setIsEditDialogOpen(false);
      setEditingUser(null);
    },
    onError: (error) => {
      toast({
        title: "오류 발생",
        description: "회원 정보 수정에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
      console.error("사용자 수정 오류:", error);
    },
  });

  // 사용자 삭제 뮤테이션
  const deleteUserMutation = useMutation({
    mutationFn: (userId: number) =>
      apiRequest(`/api/admin/users/${userId}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      toast({
        title: "회원 삭제 완료",
        description: "회원이 성공적으로 삭제되었습니다.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"], exact: false });
    },
    onError: (error) => {
      toast({
        title: "오류 발생",
        description: "회원 삭제에 실패했습니다. 다시 시도해주세요.",
        variant: "destructive",
      });
      console.error("사용자 삭제 오류:", error);
    },
  });

  // 사용자 편집 핸들러
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  // 사용자 삭제 핸들러
  const handleDeleteUser = (userId: number, username: string) => {
    if (window.confirm(`정말로 "${username}" 회원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      deleteUserMutation.mutate(userId);
    }
  };

  // 서버에서 필터링되므로 클라이언트 필터링 불필요
  const filteredUsers = users || [];

  // 회원 등급 표시
  const getMemberTypeLabel = (memberType: string) => {
    switch (memberType) {
      case 'superadmin': return '최고관리자';
      case 'admin': return '관리자';
      case 'hospital_admin': return '병원관리자';
      case 'membership': return '병원회원';
      case 'pro': return '프로회원';
      case 'free': return '무료회원';
      case 'user': return '일반회원';
      default: return memberType;
    }
  };

  // 회원 등급 색상
  const getMemberTypeColor = (memberType: string) => {
    switch (memberType) {
      case 'superadmin': return 'bg-red-100 text-red-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'hospital_admin': return 'bg-purple-100 text-purple-800';
      case 'membership': return 'bg-green-100 text-green-800';
      case 'pro': return 'bg-yellow-100 text-yellow-800';
      case 'free': return 'bg-gray-100 text-gray-800';
      case 'user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">회원 목록을 불러오는 중...</div>;
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 */}
      <Card className="p-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="회원명 또는 이메일로 검색"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="w-48">
            <Select value={memberTypeFilter} onValueChange={setMemberTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="모든 회원 등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 회원 등급</SelectItem>
                <SelectItem value="free">무료회원</SelectItem>
                <SelectItem value="pro">프로회원</SelectItem>
                <SelectItem value="membership">병원회원</SelectItem>
                <SelectItem value="hospital_admin">병원관리자</SelectItem>
                <SelectItem value="admin">관리자</SelectItem>
                <SelectItem value="superadmin">최고관리자</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select value={hospitalFilter} onValueChange={setHospitalFilter}>
              <SelectTrigger>
                <SelectValue placeholder="모든 병원" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">모든 병원</SelectItem>
                {hospitals?.data?.map((hospital: any) => (
                  <SelectItem key={hospital.id} value={hospital.id.toString()}>
                    {hospital.name}
                  </SelectItem>
                )) || []}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* 회원 목록 */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>회원 ID</TableHead>
              <TableHead>회원명</TableHead>
              <TableHead>이메일</TableHead>
              <TableHead>전화번호</TableHead>
              <TableHead>생년월일</TableHead>
              <TableHead>등급</TableHead>
              <TableHead>소속 병원</TableHead>
              <TableHead>가입일</TableHead>
              <TableHead>관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user: User) => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono">{user.id}</TableCell>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phoneNumber || '-'}</TableCell>
                  <TableCell>{user.birthdate ? new Date(user.birthdate).toLocaleDateString('ko-KR') : '-'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getMemberTypeColor(user.memberType)}`}>
                      {getMemberTypeLabel(user.memberType)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {typeof user.hospital === 'string' ? user.hospital : user.hospital?.name || '-'}
                  </TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString('ko-KR')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditUser(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                  {searchInput ? "검색 결과가 없습니다." : "등록된 회원이 없습니다."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {/* 페이지네이션 */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t">
            <div className="text-sm text-gray-500">
              총 {pagination.total}명 중 {((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)}명 표시
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
              >
                처음
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                이전
              </Button>
              
              {/* 페이지 번호 */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                  // 현재 페이지 주변 5개 페이지만 표시
                  let pageNum;
                  if (pagination.totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= pagination.totalPages - 2) {
                    pageNum = pagination.totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="min-w-[2.5rem]"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(pagination.totalPages, prev + 1))}
                disabled={currentPage === pagination.totalPages}
              >
                다음
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(pagination.totalPages)}
                disabled={currentPage === pagination.totalPages}
              >
                마지막
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 회원 수정 다이얼로그 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>회원 정보 수정</DialogTitle>
            <DialogDescription>
              회원의 등급과 소속 병원을 수정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          
          {editingUser && (
            <UserEditForm
              user={editingUser}
              hospitals={hospitals?.data || hospitals?.hospitals || []}
              onSave={(userData) => updateUserMutation.mutate({ userId: editingUser.id, userData })}
              onCancel={() => {
                setIsEditDialogOpen(false);
                setEditingUser(null);
              }}
              isLoading={updateUserMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 사용자 편집 폼 컴포넌트
interface UserEditFormProps {
  user: User;
  hospitals: any[];
  onSave: (userData: Partial<User>) => void;
  onCancel: () => void;
  isLoading: boolean;
}

function UserEditForm({ user, hospitals, onSave, onCancel, isLoading }: UserEditFormProps) {
  const [formData, setFormData] = useState({
    username: user.username,
    email: user.email,
    memberType: user.memberType,
    hospitalId: user.hospitalId || '',
    phoneNumber: user.phoneNumber || '',
    birthdate: user.birthdate ? user.birthdate.split('T')[0] : '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      username: formData.username,
      email: formData.email,
      memberType: formData.memberType as 'free' | 'pro' | 'membership' | 'hospital_admin' | 'admin' | 'superadmin',
      hospitalId: formData.hospitalId ? Number(formData.hospitalId) : undefined,
      phoneNumber: formData.phoneNumber || undefined,
      birthdate: formData.birthdate || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="username">회원명</Label>
        <Input
          id="username"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="phoneNumber">전화번호</Label>
        <Input
          id="phoneNumber"
          type="tel"
          value={formData.phoneNumber}
          onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
          placeholder="010-0000-0000"
        />
      </div>

      <div>
        <Label htmlFor="birthdate">생년월일</Label>
        <Input
          id="birthdate"
          type="date"
          value={formData.birthdate}
          onChange={(e) => setFormData({ ...formData, birthdate: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="memberType">회원 등급</Label>
        <Select 
          value={formData.memberType} 
          onValueChange={(value) => setFormData({ ...formData, memberType: value as any })}
        >
          <SelectTrigger>
            <SelectValue placeholder="회원 등급을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">일반회원(무료회원)</SelectItem>
            <SelectItem value="pro">pro회원</SelectItem>
            <SelectItem value="membership">멤버쉽회원(pro회원등급)</SelectItem>
            <SelectItem value="hospital_admin">병원관리자</SelectItem>
            <SelectItem value="admin">관리자</SelectItem>
            <SelectItem value="superadmin">슈퍼관리자</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="hospitalId">소속 병원</Label>
        <Select 
          value={formData.hospitalId.toString()} 
          onValueChange={(value) => setFormData({ ...formData, hospitalId: value === 'none' ? '' : value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="병원을 선택하세요" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">병원 미소속</SelectItem>
            {Array.isArray(hospitals) && hospitals.map((hospital) => (
              <SelectItem key={hospital.id} value={hospital.id.toString()}>
                {hospital.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          취소
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? "저장 중..." : "저장"}
        </Button>
      </div>
    </form>
  );
}