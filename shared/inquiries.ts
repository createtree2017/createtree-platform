import { z } from 'zod';

export const INQUIRY_PAGE_SIZE = 20;
export const INQUIRY_TITLE_MAX = 100;
export const INQUIRY_TEXT_MAX = 3000;
export const DEFAULT_INQUIRY_FILTER = 'all' as const;
const text = (max: number) => z.string().trim().min(1, '내용을 입력해주세요.').max(max, `${max}자 이하로 입력해주세요.`);
export const inquiryCreateSchema = z.object({ title: text(INQUIRY_TITLE_MAX), content: text(INQUIRY_TEXT_MAX) }).strict();
export const inquiryAnswerSchema = z.object({ answer: text(INQUIRY_TEXT_MAX) }).strict();
export const inquiryReadSchema = z.object({ answerRevision: z.number().int().positive().max(2147483647) }).strict();
export const inquiryUnreadSchema = z.object({ unreadCount: z.number().int().nonnegative() });
export const inquiryReadResultSchema = z.object({ success: z.literal(true) });
export const inquiryIdSchema = z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().max(2147483647));
const positiveInteger = (fallback: string, max: number) => z.string().regex(/^[1-9]\d*$/).default(fallback).transform(Number).pipe(z.number().int().max(max));
export const inquiryPageSchema = z.object({
  page: positiveInteger('1', 100000),
  limit: positiveInteger(String(INQUIRY_PAGE_SIZE), INQUIRY_PAGE_SIZE),
});
export const inquiryAdminPageSchema = inquiryPageSchema.extend({ status: z.enum(['pending', 'answered', 'all']).default(DEFAULT_INQUIRY_FILTER) });
export type InquiryFilter = z.infer<typeof inquiryAdminPageSchema>['status'];
export type InquiryCreate = z.infer<typeof inquiryCreateSchema>;
export type InquiryPage = z.infer<typeof inquiryPageSchema> & { status?: InquiryFilter };
export const canManageInquiries = (memberType?: string | null) => memberType === 'admin' || memberType === 'superadmin';

export const inquirySummarySchema = z.object({
  id: z.number().int().positive(), title: z.string(), createdAt: z.string().datetime(),
  answeredAt: z.string().datetime().nullable(), answerUpdatedAt: z.string().datetime().nullable(),
  status: z.enum(['pending', 'answered']),
  answerRevision: z.number().int().nonnegative(), isAnswerUnread: z.boolean(),
  author: z.object({ name: z.string().nullable(), email: z.string().nullable() }).optional(),
});
export const inquiryDetailSchema = inquirySummarySchema.extend({ content: z.string(), answer: z.string().nullable() });
export const inquiryListSchema = z.object({
  items: z.array(inquirySummarySchema), page: z.number().int().positive(), total: z.number().int().nonnegative(), hasMore: z.boolean(),
});
export type InquirySummary = z.infer<typeof inquirySummarySchema>;
export type InquiryDetail = z.infer<typeof inquiryDetailSchema>;
export type InquiryList = z.infer<typeof inquiryListSchema>;
