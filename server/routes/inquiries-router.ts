import { Router, type RequestHandler } from 'express';
import { canManageInquiries, inquiryAdminPageSchema, inquiryAnswerSchema, inquiryCreateSchema, inquiryIdSchema, inquiryPageSchema, inquiryReadSchema } from '@shared/inquiries';
import type { InquiryService, InquiryMember } from '../services/inquiries';

export function createInquiriesRouter(service: InquiryService, authenticate: RequestHandler, admin = false) {
  const router = Router();
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(authenticate);
  router.use(async (req, res, next) => {
    try {
      const id = req.user?.id;
      const member = Number.isInteger(id) && id! > 0 ? await service.findMember(id!) : undefined;
      if (!member || member.isDeleted) { res.status(401).json({ message: '로그인이 만료되었습니다. 다시 로그인해주세요.' }); return; }
      if (admin && !canManageInquiries(member.memberType)) { res.status(403).json({ message: '운영 관리자만 접근할 수 있습니다.' }); return; }
      res.locals.inquiryMember = member;
      next();
    } catch { res.status(503).json({ message: '계정 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.' }); }
  });
  const handle = (fn: RequestHandler): RequestHandler => async (req, res, next) => {
    try { await fn(req, res, next); }
    catch { console.error('[문의] DB 처리 실패', { method: req.method }); res.status(503).json({ message: '문의 처리에 실패했습니다. 잠시 후 다시 시도해주세요.' }); }
  };
  router.get('/', handle(async (req, res) => {
    const parsed = (admin ? inquiryAdminPageSchema : inquiryPageSchema).safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ message: '목록 조회 조건이 올바르지 않습니다.' }); return; }
    const member = res.locals.inquiryMember as InquiryMember;
    res.json(await service.list(parsed.data, admin ? undefined : member.id));
  }));
  if (!admin) {
    router.get('/unread-count', handle(async (_req, res) => {
      const member = res.locals.inquiryMember as InquiryMember;
      res.json({ unreadCount: await service.unreadCount(member.id) });
    }));
    router.put('/:id/read', handle(async (req, res) => {
      const id = inquiryIdSchema.safeParse(req.params.id);
      const data = inquiryReadSchema.safeParse(req.body);
      if (!id.success || !data.success) { res.status(400).json({ message: '읽음 처리 요청이 올바르지 않습니다.' }); return; }
      const member = res.locals.inquiryMember as InquiryMember;
      if (!await service.markRead(id.data, member.id, data.data.answerRevision)) { res.status(404).json({ message: '확인할 답변을 찾을 수 없습니다.' }); return; }
      res.json({ success: true });
    }));
  }
  router.get('/:id', handle(async (req, res) => {
    const id = inquiryIdSchema.safeParse(req.params.id);
    if (!id.success) { res.status(400).json({ message: '문의 번호가 올바르지 않습니다.' }); return; }
    const member = res.locals.inquiryMember as InquiryMember;
    const item = await service.detail(id.data, admin ? undefined : member.id);
    if (!item) { res.status(404).json({ message: '문의를 찾을 수 없습니다.' }); return; }
    res.json(item);
  }));
  if (admin) {
    router.put('/:id/answer', handle(async (req, res) => {
      const id = inquiryIdSchema.safeParse(req.params.id);
      const data = inquiryAnswerSchema.safeParse(req.body);
      if (!id.success || !data.success) { res.status(400).json({ message: '문의 번호와 답변 내용(1~3000자)을 확인해주세요.' }); return; }
      const member = res.locals.inquiryMember as InquiryMember;
      const item = await service.answer(id.data, member.id, data.data.answer);
      if (!item) { res.status(404).json({ message: '문의를 찾을 수 없습니다.' }); return; }
      res.json(item);
    }));
  } else {
    router.post('/', handle(async (req, res) => {
      const data = inquiryCreateSchema.safeParse(req.body);
      if (!data.success) { res.status(400).json({ message: '제목(1~100자)과 내용(1~3000자)을 확인해주세요.' }); return; }
      const member = res.locals.inquiryMember as InquiryMember;
      res.status(201).json(await service.create(member.id, data.data));
    }));
  }
  return router;
}
