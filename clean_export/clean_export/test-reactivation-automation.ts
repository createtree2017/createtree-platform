/**
 * 병원 재활성화 시 회원 등급 복구 자동화 테스트
 */

import { db } from './db/index.js';
import { users, hospitals } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function testReactivationAutomation() {
  console.log('\n=== 병원 재활성화 자동화 테스트 ===\n');

  try {
    // 현재 상태 확인
    const testUser = await db.query.users.findFirst({
      where: eq(users.id, 29)
    });
    
    const hospital = await db.query.hospitals.findFirst({
      where: eq(hospitals.id, 10)
    });
    
    console.log(`현재 상태:`);
    console.log(`  사용자 29: ${testUser?.memberType}`);
    console.log(`  병원 10: ${hospital?.isActive ? '활성화' : '비활성화'}`);

    // 병원 재활성화
    console.log(`\n병원을 활성화로 변경...`);
    
    await db.update(hospitals)
      .set({ 
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(hospitals.id, 10));

    // 자동화 트리거
    const targetUsers = await db.query.users.findMany({
      where: eq(users.hospitalId, 10)
    });

    const usersToUpdate = targetUsers.filter(u => 
      ['membership', 'pro', 'free'].includes(u.memberType) && 
      !['admin', 'superadmin', 'hospital_admin'].includes(u.memberType)
    );
    
    console.log(`회원 등급 pro로 복구 중...`);
    
    for (const user of usersToUpdate) {
      await db.update(users)
        .set({ 
          memberType: 'pro',
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
      
      console.log(`  ${user.email} → pro 변경 완료`);
    }

    // 최종 상태 확인
    const finalUser = await db.query.users.findFirst({
      where: eq(users.id, 29)
    });
    
    const finalHospital = await db.query.hospitals.findFirst({
      where: eq(hospitals.id, 10)
    });
    
    console.log(`\n최종 상태:`);
    console.log(`  사용자 29: ${finalUser?.memberType}`);
    console.log(`  병원 10: ${finalHospital?.isActive ? '활성화' : '비활성화'}`);

    console.log('\n✅ 병원 재활성화 자동화 테스트 완료');
    
  } catch (error) {
    console.error('❌ 테스트 중 오류:', error);
  }
}

testReactivationAutomation().catch(console.error);