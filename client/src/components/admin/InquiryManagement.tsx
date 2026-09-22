import React, { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAdminInquiries, useAnswerInquiry, useInquiryDetail } from '@/hooks/useInquiries';
import { InquiryContent, InquiryError, InquiryStatus, inquiryDate } from '@/components/inquiries/InquiryParts';
import { inquiryDraftKey, storeInquiryDraft, useInquiryDraft } from '@/lib/inquiry-draft';
import { inquiryAnswerSchema, DEFAULT_INQUIRY_FILTER, INQUIRY_TEXT_MAX, type InquiryDetail, type InquiryFilter } from '@shared/inquiries';

export default function InquiryManagement({ userId }: { userId: number }) {
  const [filter, setFilter] = useState<InquiryFilter>(DEFAULT_INQUIRY_FILTER);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);
  const query = useAdminInquiries(userId, filter, page);
  if (selected !== null) return <div className="max-w-3xl mx-auto space-y-5">
    <Button variant="outline" onClick={() => setSelected(null)}>문의 목록</Button>
    <AdminDetail key={`${userId}:${selected}`} userId={userId} id={selected} />
  </div>;
  return <div className="space-y-5">
    <h2 className="text-2xl font-bold">문의사항</h2>
    <div className="flex flex-wrap items-center gap-3">
      <Label htmlFor="inquiry-filter">답변 상태</Label>
      <select id="inquiry-filter" className="min-h-11 rounded-md border bg-background px-3 text-sm" value={filter} onChange={e => { setFilter(e.target.value as InquiryFilter); setPage(1); setSelected(null); }}>
        <option value="all">전체</option><option value="pending">답변 대기</option><option value="answered">답변 완료</option>
      </select>
      {query.data && <span className="text-sm text-muted-foreground">총 {query.data.total}건</span>}
    </div>
    {query.isPending && <p role="status">문의를 불러오고 있습니다.</p>}
    {query.isError && <InquiryError error={query.error} retry={() => void query.refetch()} />}
    {!query.isError && query.data && <>
      {query.data.items.length === 0 && <p className="rounded-xl border p-6 text-center text-muted-foreground">해당 조건의 문의가 없습니다.</p>}
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{query.data.items.map(item => <li key={item.id}>
        <button type="button" className="h-full w-full rounded-xl border p-4 text-left space-y-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelected(item.id)}>
          <InquiryStatus status={item.status} /><p className="font-semibold break-words [overflow-wrap:anywhere]">{item.title}</p>
          <p className="text-sm break-words [overflow-wrap:anywhere]">{item.author?.name || '이름 없음'} · {item.author?.email || '이메일 없음'}</p>
          <p className="text-xs text-muted-foreground">접수 {inquiryDate(item.createdAt)}</p>
          {item.answeredAt && <p className="text-xs text-muted-foreground">답변 {inquiryDate(item.answeredAt)}</p>}
        </button>
      </li>)}</ul>
    </>}
    <div className="flex items-center justify-center gap-4">
      <Button variant="outline" disabled={page === 1 || query.isFetching} onClick={() => setPage(p => p - 1)}>이전</Button>
      <span className="text-sm">{page}페이지</span>
      <Button variant="outline" disabled={!query.data?.hasMore || query.isFetching || query.isError} onClick={() => setPage(p => p + 1)}>다음</Button>
    </div>
  </div>;
}
function AdminDetail({ userId, id }: { userId: number; id: number }) {
  const query = useInquiryDetail(userId, id, true);
  if (query.isPending) return <p role="status">문의를 불러오고 있습니다.</p>;
  if (query.isError) return <InquiryError error={query.error} retry={() => void query.refetch()} />;
  return query.data ? <>
    <InquiryContent item={query.data} />
    <AnswerEditor userId={userId} item={query.data} />
  </> : null;
}
const answerDraftSchema = z.string().max(INQUIRY_TEXT_MAX);
function AnswerEditor({ userId, item }: { userId: number; item: InquiryDetail }) {
  const { toast } = useToast();
  const key = inquiryDraftKey(userId, `answer:${item.id}`);
  const [answer, setAnswer] = useInquiryDraft(key, answerDraftSchema, item.answer || '');
  const mutation = useAnswerInquiry(item.id);
  return <form className="space-y-3 border-t pt-5" onSubmit={async e => {
    e.preventDefault();
    if (mutation.isPending) return;
    const data = inquiryAnswerSchema.safeParse({ answer });
    if (!data.success) { toast({ title: '답변을 1~3000자로 입력해주세요.', variant: 'destructive' }); return; }
    try {
      await mutation.mutateAsync(data.data.answer);
      storeInquiryDraft(key, null);
      toast({ title: '답변이 저장되었습니다.' });
    } catch { /* 실패 시 입력과 초안을 유지한다. */ }
  }}>
    <Label htmlFor="inquiry-answer">{item.answer === null ? '답변 작성' : '답변 수정'}</Label>
    <Textarea id="inquiry-answer" value={answer} onChange={e => setAnswer(e.target.value)} maxLength={INQUIRY_TEXT_MAX} rows={7} required disabled={mutation.isPending} placeholder="고객에게 전달할 답변을 입력해주세요" />
    <p className="text-right text-xs text-muted-foreground">{answer.length}/{INQUIRY_TEXT_MAX}</p>
    {mutation.isError && <InquiryError error={mutation.error} />}
    <Button type="submit" className="w-full min-h-11" disabled={mutation.isPending}>{mutation.isPending ? '저장 중...' : '답변 저장'}</Button>
  </form>;
}
