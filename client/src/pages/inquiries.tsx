import React from 'react';
import { Link, useLocation } from 'wouter';
import { z } from 'zod';
import { useAuthContext } from '@/lib/AuthProvider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { mayShowInquiryData, useCreateInquiry, useInquiryDetail, useMyInquiries } from '@/hooks/useInquiries';
import { InquiryContent, InquiryError, InquiryStatus, inquiryDate } from '@/components/inquiries/InquiryParts';
import { inquiryCreateSchema, inquiryIdSchema, INQUIRY_TEXT_MAX, INQUIRY_TITLE_MAX } from '@shared/inquiries';
import { inquiryDraftKey, storeInquiryDraft, useInquiryDraft } from '@/lib/inquiry-draft';
import InquiryReadReceipt from '@/components/inquiries/InquiryReadReceipt';

export default function InquiriesPage({ mode = 'list', id }: { mode?: 'list' | 'new' | 'detail'; id?: string }) {
  const { user } = useAuthContext();
  if (!user) return null;
  return <div className="max-w-2xl mx-auto space-y-5 py-4">
    <Link href={mode === 'list' ? '/profile' : '/inquiries'}><Button variant="outline">{mode === 'list' ? 'MY로 돌아가기' : '문의 목록'}</Button></Link>
    <h1 className="text-2xl font-bold">{mode === 'new' ? '문의하기' : '문의사항'}</h1>
    {mode === 'list' ? <MyList key={user.id} userId={user.id} /> : mode === 'new' ? <NewInquiry key={user.id} userId={user.id} /> : <MyDetail key={`${user.id}:${id}`} userId={user.id} id={id || ''} />}
  </div>;
}
function MyList({ userId }: { userId: number }) {
  const query = useMyInquiries(userId);
  const items = mayShowInquiryData(query.error) ? [...new Map(query.data?.pages.flatMap(page => page.items).map(item => [item.id, item]) ?? []).values()] : [];
  return <>
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">내 문의와 관리자 답변을 확인하세요.</p><Link href="/inquiries/new"><Button>문의하기</Button></Link></div>
    {query.isPending && <p role="status">문의를 불러오고 있습니다.</p>}
    {query.isError && <InquiryError error={query.error} retry={() => void query.refetch()} />}
    {!query.isError && query.data && items.length === 0 && <p className="rounded-xl border p-6 text-center text-muted-foreground">등록된 문의가 없습니다.</p>}
    <ul className="space-y-3">{items.map(item => <li key={item.id}><Link href={`/inquiries/${item.id}`} className="block rounded-xl border p-4 space-y-2 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex flex-wrap items-center gap-2"><InquiryStatus status={item.status} />{item.isAnswerUnread && <span className="text-xs font-semibold text-red-500">새 답변</span>}</div><p className="font-medium break-words [overflow-wrap:anywhere]">{item.title}</p><p className="text-sm text-muted-foreground">{inquiryDate(item.createdAt)}</p>
    </Link></li>)}</ul>
    {query.hasNextPage && mayShowInquiryData(query.error) && <Button variant="outline" className="w-full" disabled={query.isFetching} onClick={() => void query.fetchNextPage()}>{query.isFetchingNextPage ? '불러오는 중...' : '더 보기'}</Button>}
  </>;
}
const draftSchema = z.object({ title: z.string().max(INQUIRY_TITLE_MAX), content: z.string().max(INQUIRY_TEXT_MAX) });
function NewInquiry({ userId }: { userId: number }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const key = inquiryDraftKey(userId, 'new');
  const [draft, setDraft] = useInquiryDraft(key, draftSchema, { title: '', content: '' });
  const mutation = useCreateInquiry();
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault();
    if (mutation.isPending) return;
    const parsed = inquiryCreateSchema.safeParse(draft);
    if (!parsed.success) { toast({ title: '제목과 내용을 확인해주세요.', variant: 'destructive' }); return; }
    try {
      const item = await mutation.mutateAsync(parsed.data);
      storeInquiryDraft(key, null);
      toast({ title: '문의가 접수되었습니다.' });
      navigate(`/inquiries/${item.id}`, { replace: true });
    } catch { /* 입력을 보존하고 아래에 오류를 표시한다. */ }
  }}>
    <p className="text-sm text-muted-foreground">문의는 본인과 운영 관리자만 확인할 수 있습니다.</p>
    <div className="space-y-2"><Label htmlFor="inquiry-title">제목</Label><Input id="inquiry-title" required maxLength={INQUIRY_TITLE_MAX} value={draft.title} disabled={mutation.isPending} onChange={e => setDraft({ ...draft, title: e.target.value })} placeholder="문의 제목을 입력해주세요" /></div>
    <div className="space-y-2"><Label htmlFor="inquiry-content">내용</Label><Textarea id="inquiry-content" required rows={8} maxLength={INQUIRY_TEXT_MAX} value={draft.content} disabled={mutation.isPending} onChange={e => setDraft({ ...draft, content: e.target.value })} placeholder="문의 내용을 입력해주세요" /><p className="text-xs text-right text-muted-foreground">{draft.content.length}/{INQUIRY_TEXT_MAX}</p></div>
    {mutation.isError && <InquiryError error={mutation.error} />}
    <Button type="submit" className="w-full min-h-11" disabled={mutation.isPending}>{mutation.isPending ? '접수 중...' : '문의 제출'}</Button>
  </form>;
}
function MyDetail({ userId, id }: { userId: number; id: string }) {
  const parsed = inquiryIdSchema.safeParse(id);
  const query = useInquiryDetail(userId, parsed.success ? parsed.data : 0);
  if (!parsed.success) return <p role="alert">문의 번호가 올바르지 않습니다.</p>;
  if (query.isPending) return <p role="status">문의를 불러오고 있습니다.</p>;
  return <>{query.isError && <InquiryError error={query.error} retry={() => void query.refetch()} />}{query.data && mayShowInquiryData(query.error) && <>
    <InquiryContent item={query.data} />
    {!query.isError && <InquiryReadReceipt item={query.data} />}
  </>}</>;
}
