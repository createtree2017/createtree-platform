import assert from 'node:assert/strict';
import { test, beforeEach, afterEach } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { z } from 'zod';
import { inquiryKeys, inquiryRequest, inquiryRetry, mayShowInquiryData } from '../hooks/useInquiries';
import { InquiryContent, InquiryStatus, UnreadInquiryBadge } from '../components/inquiries/InquiryParts';
import { inquiryDraftKey, readInquiryDraft, storeInquiryDraft } from './inquiry-draft';
import { resetAuthRecovery } from './authenticated-fetch';
import { canManageInquiries, inquiryDetailSchema, inquiryCreateSchema, inquiryListSchema, type InquiryDetail } from '@shared/inquiries';

const storage = new Map<string,string>();
const storageMock = { getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value),removeItem:(key:string)=>storage.delete(key) };
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storageMock});
Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storageMock});
const originalFetch = globalThis.fetch;
beforeEach(()=>{storage.clear();resetAuthRecovery();});
afterEach(()=>{globalThis.fetch=originalFetch;resetAuthRecovery();});
const json = (body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const item: InquiryDetail = { id:1,title:'<img src=x onerror=alert(1)>',content:'<script>alert(1)</script>\n두 번째 줄',answer:null,createdAt:'2026-09-22T00:00:00.000Z',answeredAt:null,answerUpdatedAt:null,status:'pending',answerRevision:0,isAnswerUnread:false };

test('입력 계약은 공백을 제거하며 빈 입력·초과 길이·알 수 없는 필드를 거부한다',()=>{
  assert.deepEqual(inquiryCreateSchema.parse({title:' 제목 ',content:' 내용 '}),{title:'제목',content:'내용'});
  for(const body of [{title:' ',content:'내용'},{title:'x'.repeat(101),content:'내용'},{title:'제목',content:'x'.repeat(3001)},{title:'제목',content:'내용',userId:99}])assert.equal(inquiryCreateSchema.safeParse(body).success,false);
});
test('회원과 관리 범위별 목록·상세 캐시가 분리된다',()=>{
  const keys=[inquiryKeys.list(1,false),inquiryKeys.list(2,false),inquiryKeys.list(1,true),inquiryKeys.list(1,true,'pending'),inquiryKeys.list(1,true,'pending',2),inquiryKeys.detail(1,false,1),inquiryKeys.detail(1,true,1),inquiryKeys.detail(2,false,1)];
  assert.equal(new Set(keys.map(k=>JSON.stringify(k))).size,keys.length);
  for(const role of ['free','membership','hospital_admin',null,undefined])assert.equal(canManageInquiries(role),false);
  assert.equal(canManageInquiries('admin'),true);assert.equal(canManageInquiries('superadmin'),true);
});
test('권한 상실 후 남은 캐시를 표시하지 않고 취소 요청은 재시도하지 않는다',()=>{
  for(const status of [401,403,404])assert.equal(mayShowInquiryData({status}),false);
  assert.equal(mayShowInquiryData({status:503}),true);
  assert.equal(inquiryRetry(0,new DOMException('취소','AbortError')),false);
});
test('미확인 답변 뱃지는 0개면 숨기고 99 초과를 축약하며 회원별 캐시를 사용한다',()=>{
  assert.equal(renderToStaticMarkup(React.createElement(UnreadInquiryBadge,{count:0})), '');
  assert.match(renderToStaticMarkup(React.createElement(UnreadInquiryBadge,{count:1})), /읽지 않은 답변 1개/);
  assert.match(renderToStaticMarkup(React.createElement(UnreadInquiryBadge,{count:120})), /99\+/);
  assert.notDeepEqual(inquiryKeys.unread(1),inquiryKeys.unread(2));
});
test('초안은 회원/문의별로 분리되고 깨진 저장값은 복원하지 않는다',()=>{
  const first=inquiryDraftKey(1,'new'),second=inquiryDraftKey(2,'new');
  storeInquiryDraft(first,'작성 중');assert.equal(readInquiryDraft(first,z.string(),''),'작성 중');assert.equal(readInquiryDraft(second,z.string(),''),'');
  assert.notEqual(first,inquiryDraftKey(1,'answer:1'));storage.set(first,'broken');assert.equal(readInquiryDraft(first,z.string(),''),'');
  storeInquiryDraft(first,null);assert.equal(storage.has(first),false);
});
test('문의와 답변의 HTML은 실행 요소가 아니라 텍스트로 표시된다',()=>{
  const html=renderToStaticMarkup(React.createElement(InquiryContent,{item}));
  assert.doesNotMatch(html,/<script>|<img /);assert.match(html,/&lt;script&gt;/);assert.match(html,/관리자 답변을 기다리고 있습니다/);
  const answered={...item,answer:'<iframe>답변</iframe>',status:'answered' as const,answeredAt:item.createdAt,answerUpdatedAt:'2026-09-22T01:00:00.000Z'};
  const result=renderToStaticMarkup(React.createElement(InquiryContent,{item:answered}));assert.doesNotMatch(result,/<iframe>/);assert.match(result,/수정일/);
  assert.match(renderToStaticMarkup(React.createElement(InquiryStatus,{status:'answered'})),/답변 완료/);
});
test('읽기 인증 만료는 갱신 후 1회 복구하며 올바른 JSON 계약을 확인한다',async()=>{
  let count=0,refresh=0;
  globalThis.fetch=async url=>{if(url==='/api/auth/refresh-token'){refresh++;return json({accessToken:'renewed'});}count++;return count===1?json({},401):json(item);};
  assert.equal((await inquiryRequest('/api/inquiries/1',inquiryDetailSchema)).id,1);assert.equal(refresh,1);assert.equal(count,2);
});
test('쓰기 실패는 자동 재전송하지 않고 저장 중 초안을 유지한다',async()=>{
  const key=inquiryDraftKey(1,'new');storeInquiryDraft(key,'내용');let count=0;
  globalThis.fetch=async()=>{count++;return json({message:'로그인 필요'},401);};
  await assert.rejects(inquiryRequest('/api/inquiries',inquiryDetailSchema,{method:'POST',data:{title:'문의',content:'내용'}}),/로그인 필요/);
  assert.equal(count,1);assert.equal(readInquiryDraft(key,z.string(),''),'내용');
});
test('잘못된 응답·500·HTML을 빈 문의 목록으로 표시하지 않는다',async()=>{
  globalThis.fetch=async()=>json({items:[]});await assert.rejects(inquiryRequest('/api/inquiries',inquiryListSchema),/응답/);
  globalThis.fetch=async()=>json({message:'일시적인 장애'},503);await assert.rejects(inquiryRequest('/api/inquiries',inquiryListSchema),/일시적인 장애/);
  globalThis.fetch=async()=>new Response('<html/>',{headers:{'Content-Type':'text/html'}});await assert.rejects(inquiryRequest('/api/inquiries',inquiryListSchema),/HTML/);
  assert.equal(inquiryRetry(0,{status:403}),false);assert.equal(inquiryRetry(0,{status:401}),false);assert.equal(inquiryRetry(0,{status:503}),true);assert.equal(inquiryRetry(1,{status:503}),false);
});
