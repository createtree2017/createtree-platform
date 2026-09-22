import React from 'react';
import { Link } from 'wouter';
import { MessageSquare } from 'lucide-react';
import { useAuthContext } from '@/lib/AuthProvider';
import { mayShowInquiryData, useUnreadInquiryCount } from '@/hooks/useInquiries';
import { UnreadInquiryBadge } from './InquiryParts';

export default function InquiryMenuItem() {
  const { user } = useAuthContext();
  const query = useUnreadInquiryCount(user?.id || 0);
  const count = mayShowInquiryData(query.error) ? query.data?.unreadCount ?? 0 : 0;
  return <section className="mb-6">
    <Link href="/inquiries" className="block rounded-xl border-2 border-yellow-500 dark:border-yellow-400 bg-muted p-4 hover:bg-muted/80">
      <div className="flex items-center gap-3">
        <div className="relative shrink-0"><MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          {count > 0 && <span className="absolute -top-2 -right-2"><UnreadInquiryBadge count={count} /></span>}
        </div>
        <span className="font-semibold">문의사항</span>
        {count > 0 && <span className="ml-auto text-xs text-purple-500 font-medium">{count}개 안읽음</span>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">문의 작성 및 관리자 답변 확인</p>
      {query.isError && <p className="mt-1 text-xs text-destructive" role="status">답변 알림을 불러오지 못했습니다. 문의 목록에서 확인해주세요.</p>}
    </Link>
  </section>;
}
