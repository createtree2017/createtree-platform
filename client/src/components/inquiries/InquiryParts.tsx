import React from 'react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { rememberLoginDestination } from '@/lib/auth-navigation';
import type { InquiryDetail, InquirySummary } from '@shared/inquiries';

export const inquiryDate = (value: string | null) => value ? new Date(value).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
export function UnreadInquiryBadge({ count }: { count: number }) {
  return count > 0 ? <span aria-label={`읽지 않은 답변 ${count}개`} className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{count > 99 ? '99+' : count}</span> : null;
}
export function InquiryStatus({ status }: { status: InquirySummary['status'] }) {
  return <Badge variant={status === 'answered' ? 'default' : 'secondary'}>{status === 'answered' ? '답변 완료' : '답변 대기'}</Badge>;
}
export function InquiryError({ error, retry }: { error: unknown; retry?: () => void }) {
  const status = (error as { status?: number })?.status;
  return <div role="alert" className="rounded-lg border border-destructive/40 p-4 space-y-3">
    <p className="text-sm">{status === 401 ? '로그인이 만료되었습니다. 작성 중인 내용은 이 탭에 보관됩니다. 다시 로그인해주세요.' : error instanceof Error ? error.message : '문의를 불러오지 못했습니다.'}</p>
    {status === 401 ? <Link href="/auth" onClick={rememberLoginDestination}><Button variant="outline">로그인하기</Button></Link>
      : retry && <Button variant="outline" onClick={retry}>다시 시도</Button>}
  </div>;
}
export function InquiryContent({ item }: { item: InquiryDetail }) {
  return <article className="space-y-5 min-w-0">
    <div className="space-y-2"><InquiryStatus status={item.status} /><h2 className="text-xl font-bold break-words [overflow-wrap:anywhere]">{item.title}</h2>
      <p className="text-sm text-muted-foreground">접수일 {inquiryDate(item.createdAt)}</p>
      {item.author && <p className="text-sm break-words [overflow-wrap:anywhere]">{item.author.name || '이름 없음'} · {item.author.email || '이메일 없음'}</p>}
    </div>
    <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.content}</p>
    <section className="rounded-xl bg-muted p-4 space-y-2" aria-label="관리자 답변">
      <h3 className="font-semibold">관리자 답변</h3>
      {item.answer === null ? <p className="text-sm text-muted-foreground">관리자 답변을 기다리고 있습니다.</p> : <>
        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{item.answer}</p>
        <p className="text-xs text-muted-foreground">답변일 {inquiryDate(item.answeredAt)}
          {item.answerUpdatedAt !== item.answeredAt && ` · 수정일 ${inquiryDate(item.answerUpdatedAt)}`}</p>
      </>}
    </section>
  </article>;
}
