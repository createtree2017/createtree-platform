import { useEffect, useState } from 'react';
import { z } from 'zod';

export function inquiryDraftKey(userId: number, kind: string) { return `inquiry-draft:${userId}:${kind}`; }
export function readInquiryDraft<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try { const value = schema.safeParse(JSON.parse(sessionStorage.getItem(key) || 'null')); return value.success ? value.data : fallback; }
  catch { return fallback; }
}
export function storeInquiryDraft(key: string, value: unknown) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); }
  catch { /* 저장 공간이 제한되어도 현재 화면의 입력은 유지한다. */ }
}
// 호출하는 편집기는 userId/문의 ID를 React key로 사용하여 계정 변경 시 상태도 분리한다.
export function useInquiryDraft<T>(key: string, schema: z.ZodType<T>, fallback: T) {
  const [value, setValue] = useState<T>(() => readInquiryDraft(key, schema, fallback));
  useEffect(() => { storeInquiryDraft(key, value); }, [key, value]);
  return [value, setValue] as const;
}
