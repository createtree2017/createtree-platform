import React from 'react';
import { Button } from '@/components/ui/button';
import { rememberLoginDestination } from '@/lib/auth-navigation';

interface Props {
  error: Error | null;
  hasData: boolean;
  isFetching: boolean;
  retry: () => void;
}

export function MissionQueryNotice({ error, hasData, isFetching, retry }: Props) {
  if (!error) return null;
  const needsLogin = (error as Error & { status?: number }).status === 401;
  return (
    <div role="alert" className="my-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <p>{needsLogin
        ? '로그인이 만료되었습니다. 다시 로그인하면 신청 내역을 확인할 수 있습니다.'
        : hasData
          ? '최신 목록을 확인하지 못했습니다. 이전에 불러온 목록을 표시합니다.'
          : '목록을 불러오지 못했습니다. 연결 상태를 확인하고 다시 시도해주세요.'}</p>
      <Button className="mt-3 min-h-11" variant="outline" disabled={isFetching} onClick={() => {
        if (needsLogin) {
          rememberLoginDestination();
          window.location.assign('/auth?reason=expired');
        } else retry();
      }}>
        {needsLogin ? '다시 로그인' : isFetching ? '불러오는 중…' : '다시 시도'}
      </Button>
    </div>
  );
}
