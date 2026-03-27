import React, { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Search, X, Users } from "lucide-react";

interface PushUser {
  id: number;
  username: string;
  email: string | null;
  fullName: string | null;
  phoneNumber: string | null;
  hospitalId: number | null;
  memberType: string | null;
}

interface PushUserSelectorProps {
  selectedUsers: PushUser[];
  onSelectionChange: (users: PushUser[]) => void;
}

export default function PushUserSelector({ selectedUsers, onSelectionChange }: PushUserSelectorProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);

  // 디바운스 검색
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 300);
  }, []);

  // 회원 목록 조회
  const { data, isLoading } = useQuery<{
    users: PushUser[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: ["/api/admin/push-users", debouncedSearch, page],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("search", debouncedSearch);
      params.set("page", String(page));
      params.set("limit", "15");
      const res = await fetch(`/api/admin/push-users?${params.toString()}`);
      if (!res.ok) throw new Error("회원 목록 조회 실패");
      return res.json();
    },
  });

  const isSelected = (userId: number) => selectedUsers.some((u) => u.id === userId);

  const toggleUser = (user: PushUser) => {
    if (isSelected(user.id)) {
      onSelectionChange(selectedUsers.filter((u) => u.id !== user.id));
    } else {
      onSelectionChange([...selectedUsers, user]);
    }
  };

  const removeUser = (userId: number) => {
    onSelectionChange(selectedUsers.filter((u) => u.id !== userId));
  };

  return (
    <div className="space-y-3">
      {/* 선택된 사용자 뱃지 */}
      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-muted rounded-md">
          <span className="text-xs text-muted-foreground flex items-center mr-1">
            <Users className="h-3 w-3 mr-1" />
            {selectedUsers.length}명 선택
          </span>
          {selectedUsers.map((user) => (
            <Badge key={user.id} variant="secondary" className="text-xs gap-1">
              {user.fullName || user.username} (ID:{user.id})
              <X
                className="h-3 w-3 cursor-pointer hover:text-destructive"
                onClick={() => removeUser(user.id)}
              />
            </Badge>
          ))}
        </div>
      )}

      {/* 검색 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="이름, 이메일, 전화번호로 검색..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 회원 목록 */}
      <div className="border rounded-md max-h-60 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 text-center text-sm text-muted-foreground">로딩 중...</div>
        ) : !data?.users?.length ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            {debouncedSearch ? "검색 결과가 없습니다" : "검색어를 입력하세요"}
          </div>
        ) : (
          <div>
            {data.users.map((user) => (
              <label
                key={user.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-muted cursor-pointer border-b last:border-b-0"
              >
                <Checkbox
                  checked={isSelected(user.id)}
                  onCheckedChange={() => toggleUser(user)}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {user.fullName || user.username}
                    <span className="text-muted-foreground ml-1 font-normal">
                      (ID:{user.id})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {user.email || "이메일 없음"}
                    {user.phoneNumber && ` · ${user.phoneNumber}`}
                  </div>
                </div>
                {user.memberType && (
                  <Badge variant="outline" className="text-xs shrink-0">
                    {user.memberType}
                  </Badge>
                )}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            총 {data.pagination.total}명 중 {((page - 1) * 15) + 1}~{Math.min(page * 15, data.pagination.total)}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="h-7 text-xs"
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
              disabled={page >= data.pagination.totalPages}
              className="h-7 text-xs"
            >
              다음
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
