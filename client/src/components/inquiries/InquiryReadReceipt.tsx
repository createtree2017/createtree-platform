import React, { useEffect, useRef } from 'react';
import { useMarkInquiryRead } from '@/hooks/useInquiries';
import { Button } from '@/components/ui/button';
import type { InquiryDetail } from '@shared/inquiries';

// 실제 사용자 상세 화면에 답변이 표시된 이후에만 읽음 저장한다. 관리자 조회는 사용하지 않는다.
export default function InquiryReadReceipt({ item }: { item: InquiryDetail }) {
  const mutation = useMarkInquiryRead(item.id);
  const attempted = useRef(0);
  const { mutate } = mutation;
  useEffect(() => {
    const markVisibleAnswer = () => {
      if (document.visibilityState !== 'visible' || !item.isAnswerUnread || item.answer === null || attempted.current >= item.answerRevision) return;
      attempted.current = item.answerRevision;
      mutate(item.answerRevision);
    };
    markVisibleAnswer();
    document.addEventListener('visibilitychange', markVisibleAnswer);
    return () => document.removeEventListener('visibilitychange', markVisibleAnswer);
  }, [item.answerRevision, item.answer, item.isAnswerUnread, mutate]);
  if (!mutation.isError || !item.isAnswerUnread) return null;
  return <div role="status" className="space-y-2 text-sm text-muted-foreground">
    <p>답변은 표시됐지만 읽음 상태를 저장하지 못했습니다.</p>
    <Button variant="outline" onClick={() => mutate(item.answerRevision)} disabled={mutation.isPending}>읽음 처리 다시 시도</Button>
  </div>;
}
