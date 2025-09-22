import { ReactNode } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { MemberType, isAdmin, isHospitalAdmin, isSuperAdmin } from '@/lib/auth-utils';
import { AlertCircle } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: MemberType | MemberType[];
  requireAdmin?: boolean;
  requireSuperAdmin?: boolean;
  requireHospitalAdmin?: boolean;
  fallbackPath?: string;
}

export function ProtectedRoute({
  children,
  requiredRole,
  requireAdmin = false,
  requireSuperAdmin = false,
  requireHospitalAdmin = false,
  fallbackPath = '/'
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // 로딩 중이면 로딩 표시
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // 로그인되지 않은 경우
  if (!user) {
    window.location.href = '/login';
    return null;
  }

  // 슈퍼관리자 권한 필요한 경우
  if (requireSuperAdmin && !isSuperAdmin(user.memberType)) {
    return <UnauthorizedMessage message="슈퍼관리자 권한이 필요합니다." />;
  }

  // 관리자 권한 필요한 경우
  if (requireAdmin && !isAdmin(user.memberType)) {
    return <UnauthorizedMessage message="관리자 권한이 필요합니다." />;
  }

  // 병원 관리자 권한 필요한 경우
  if (requireHospitalAdmin && !isHospitalAdmin(user.memberType) && !isAdmin(user.memberType)) {
    return <UnauthorizedMessage message="병원 관리자 권한이 필요합니다." />;
  }

  // 특정 등급 필요한 경우
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (!roles.includes(user.memberType)) {
      return <UnauthorizedMessage message="해당 기능을 사용할 권한이 없습니다." />;
    }
  }

  return <>{children}</>;
}

function UnauthorizedMessage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md w-full mx-4">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">접근 권한 없음</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <button
          onClick={() => window.history.back()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          돌아가기
        </button>
      </div>
    </div>
  );
}