import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface ApprovedUser {
  userId: number;
  name: string;
  email: string;
  approvedAt?: string;
}

interface ApprovedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  users?: ApprovedUser[];
  isLoading?: boolean;
}

export function ApprovedUsersModal({ isOpen, onClose, users, isLoading = false }: ApprovedUsersModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>승인된 사용자 목록</DialogTitle>
          <DialogDescription>
            이 사용자들만 하부미션에 접근할 수 있습니다
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : !users || users.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              승인된 사용자가 없습니다
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.userId}
                  className="p-3 border rounded flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                  {user.approvedAt && (
                    <Badge variant="outline" className="text-xs">
                      {new Date(user.approvedAt).toLocaleDateString()} 승인
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
