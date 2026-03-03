/**
 * 컨셉 순서 변경 API 테스트
 */

import { db } from '@db';
import { users } from '@shared/schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

async function generateAdminToken() {
  console.log('관리자 토큰 생성 중...');
  
  // 슈퍼관리자 찾기
  const admin = await db.query.users.findFirst({
    where: eq(users.memberType, 'superadmin'),
    columns: {
      id: true,
      email: true,
      username: true,
      memberType: true,
      hospitalId: true
    }
  });
  
  if (!admin) {
    console.error('슈퍼관리자를 찾을 수 없습니다');
    return null;
  }
  
  console.log('찾은 관리자:', admin);
  
  // JWT 토큰 생성
  const token = jwt.sign({
    userId: admin.id,
    email: admin.email,
    username: admin.username,
    memberType: admin.memberType,
    hospitalId: admin.hospitalId
  }, JWT_SECRET, { expiresIn: '24h' });
  
  console.log('\n생성된 JWT 토큰:');
  console.log(token);
  
  return token;
}

async function testConceptReorder() {
  const token = await generateAdminToken();
  
  if (!token) {
    console.error('토큰 생성 실패');
    return;
  }
  
  console.log('\n=== 컨셉 순서 변경 API 테스트 ===');
  
  // 1. 현재 컨셉 목록 조회
  console.log('\n1. 기존 컨셉 목록 조회...');
  
  const conceptsResponse = await fetch('http://localhost:5000/api/admin/concepts', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (!conceptsResponse.ok) {
    console.error('컨셉 조회 실패:', await conceptsResponse.text());
    return;
  }
  
  const conceptsData = await conceptsResponse.json();
  console.log('기존 컨셉들:', conceptsData.concepts?.slice(0, 3).map((c: any) => ({
    conceptId: c.conceptId,
    title: c.title,
    order: c.order
  })));
  
  // 2. 순서 변경 테스트
  console.log('\n2. 순서 변경 테스트...');
  
  const testData = {
    conceptOrders: [
      { conceptId: "watercolor_mom", order: 100 },
      { conceptId: "cute_mugshot_babybelly", order: 200 }
    ]
  };
  
  const reorderResponse = await fetch('http://localhost:5000/api/admin/reorder-concepts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(testData)
  });
  
  if (!reorderResponse.ok) {
    console.error('순서 변경 실패:', reorderResponse.status, await reorderResponse.text());
    return;
  }
  
  const reorderResult = await reorderResponse.json();
  console.log('순서 변경 결과:', reorderResult);
  
  // 3. 변경 후 확인
  console.log('\n3. 변경 후 컨셉 목록 재조회...');
  
  const conceptsAfterResponse = await fetch('http://localhost:5000/api/admin/concepts', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  if (conceptsAfterResponse.ok) {
    const conceptsAfterData = await conceptsAfterResponse.json();
    const changedConcepts = conceptsAfterData.concepts?.filter((c: any) => 
      c.conceptId === "watercolor_mom" || c.conceptId === "cute_mugshot_babybelly"
    );
    
    console.log('변경된 컨셉들:', changedConcepts?.map((c: any) => ({
      conceptId: c.conceptId,
      title: c.title,
      order: c.order
    })));
  }
}

// 실행
testConceptReorder().catch(console.error);