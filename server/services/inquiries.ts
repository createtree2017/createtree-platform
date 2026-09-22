import { and, count, desc, eq, gte, gt, isNotNull, isNull, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { customerInquiries as inquiries, users } from '@shared/schema';
import type * as schema from '@shared/schema';
import type { InquiryCreate, InquiryDetail, InquiryList, InquiryPage, InquirySummary } from '@shared/inquiries';

export interface InquiryMember { id: number; memberType: string | null; isDeleted: boolean | null }
export interface InquiryService {
  findMember(id: number): Promise<InquiryMember | undefined>;
  create(userId: number, data: InquiryCreate): Promise<InquiryDetail>;
  list(page: InquiryPage, userId?: number): Promise<InquiryList>;
  detail(id: number, userId?: number): Promise<InquiryDetail | undefined>;
  answer(id: number, adminId: number, answer: string): Promise<InquiryDetail | undefined>;
  unreadCount(userId: number): Promise<number>;
  markRead(id: number, userId: number, revision: number): Promise<boolean>;
}
type Row = typeof inquiries.$inferSelect;
function summary(row: Pick<Row, 'id' | 'title' | 'createdAt' | 'answeredAt' | 'answerUpdatedAt' | 'answerRevision' | 'readAnswerRevision'>, owner = true): InquirySummary {
  const { readAnswerRevision, ...publicRow } = row;
  return { ...publicRow, isAnswerUnread: owner && row.answerRevision > readAnswerRevision, createdAt: row.createdAt.toISOString(), answeredAt: row.answeredAt?.toISOString() ?? null,
    answerUpdatedAt: row.answerUpdatedAt?.toISOString() ?? null, status: row.answeredAt ? 'answered' : 'pending' };
}
function detail(row: Row, owner = true): InquiryDetail {
  const { id, title, createdAt, answeredAt, answerUpdatedAt, answerRevision, readAnswerRevision } = row;
  return { ...summary({ id, title, createdAt, answeredAt, answerUpdatedAt, answerRevision, readAnswerRevision }, owner), content: row.content, answer: row.answer };
}

export function createInquiryService(db: NodePgDatabase<typeof schema>): InquiryService {
  return {
    async findMember(id) {
      const [member] = await db.select({ id: users.id, memberType: users.memberType, isDeleted: users.isDeleted }).from(users).where(eq(users.id, id));
      return member;
    },
    async create(userId, data) {
      const [row] = await db.insert(inquiries).values({ userId, title: data.title, content: data.content }).returning();
      return detail(row);
    },
    async list(page, userId) {
      const where = and(userId === undefined ? undefined : eq(inquiries.userId, userId),
        page.status === 'pending' ? isNull(inquiries.answer) : page.status === 'answered' ? isNotNull(inquiries.answer) : undefined);
      // 최신순 정렬의 동률은 ID로 해소한다.
      const [total] = await db.select({ value: count() }).from(inquiries).where(where);
      const rows = await db.select({ id: inquiries.id, title: inquiries.title, createdAt: inquiries.createdAt,
        answeredAt: inquiries.answeredAt, answerUpdatedAt: inquiries.answerUpdatedAt,
        answerRevision: inquiries.answerRevision, readAnswerRevision: inquiries.readAnswerRevision,
        name: users.fullName, email: users.email }).from(inquiries).innerJoin(users, eq(inquiries.userId, users.id))
        .where(where).orderBy(desc(inquiries.createdAt), desc(inquiries.id)).limit(page.limit).offset((page.page - 1) * page.limit);
      return { items: rows.map(({ name, email, ...row }) => ({ ...summary(row, userId !== undefined), ...(userId === undefined ? { author: { name, email } } : {}) })),
        page: page.page, total: total.value, hasMore: page.page * page.limit < total.value };
    },
    async detail(id, userId) {
      const [row] = await db.select({ inquiry: inquiries, name: users.fullName, email: users.email }).from(inquiries)
        .innerJoin(users, eq(inquiries.userId, users.id)).where(and(eq(inquiries.id, id), userId === undefined ? undefined : eq(inquiries.userId, userId)));
      return row ? { ...detail(row.inquiry, userId !== undefined), ...(userId === undefined ? { author: { name: row.name, email: row.email } } : {}) } : undefined;
    },
    async answer(id, adminId, answer) {
      const [row] = await db.update(inquiries).set({ answer, answeredBy: adminId, answerRevision: sql`${inquiries.answerRevision} + 1`,
        answeredAt: sql`COALESCE(${inquiries.answeredAt}, now())`, answerUpdatedAt: sql`now()` }).where(eq(inquiries.id, id)).returning();
      return row ? detail(row, false) : undefined;
    },
    async unreadCount(userId) {
      const [row] = await db.select({ value: count() }).from(inquiries).where(and(eq(inquiries.userId, userId), isNotNull(inquiries.answer), gt(inquiries.answerRevision, inquiries.readAnswerRevision)));
      return row.value;
    },
    async markRead(id, userId, revision) {
      const rows = await db.update(inquiries).set({ readAnswerRevision: sql`GREATEST(${inquiries.readAnswerRevision}, ${revision})` })
        .where(and(eq(inquiries.id, id), eq(inquiries.userId, userId), isNotNull(inquiries.answer), gte(inquiries.answerRevision, revision)))
        .returning({ id: inquiries.id });
      return rows.length > 0;
    },
  };
}
