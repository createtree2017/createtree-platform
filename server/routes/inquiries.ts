import { db } from '@db';
import { requireAuth } from '../middleware/auth';
import { createInquiryService } from '../services/inquiries';
import { createInquiriesRouter } from './inquiries-router';

const service = createInquiryService(db);
export const inquiryRouter = createInquiriesRouter(service, requireAuth);
export const adminInquiryRouter = createInquiriesRouter(service, requireAuth, true);
