import { pool } from '@db';
import { eq, desc } from 'drizzle-orm';
import { db } from '@db';

/**
 * 채팅 기능이 제거되어 비활성화됨
 */
export async function exportChatHistoryAsHtml(): Promise<string> {
  return "채팅 기능이 제거되었습니다.";
}