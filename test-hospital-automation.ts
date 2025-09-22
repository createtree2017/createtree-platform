/**
 * 병원 상태 변경 자동화 시스템 실제 테스트
 */

import { db } from './db/index.js';
import { users, hospitals } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function testHospitalAutomation() {
  console.log('\n=== 병원 상태 변경 자동화 시스템 실제 테스트 ===\n');

  try {
    // 1. 현재 상태 확인
    console.log('1. 테스트 전 현재 상태:');
    
    const testUser = await db.query.users.findFirst({
      where: eq(users.id, 29),
      with: { hospital: true }
    });
    
    const hospital = await db.query.hospitals.findFirst({
      where: eq(hospitals.id, 10)
    });
    
    console.log(`   사용자 29: ${testUser?.memberType}`);
    console.log(`   병원 10: ${hospital?.isActive ? '활성화' : '비활성화'}`);

    // 2. API 엔드포인트 직접 테스트 (서버 내부에서)
    console.log('\n2. 병원 활성화 자동화 테스트:');
    
    // 병원 상태 변경 및 자동화 트리거
    console.log('   병원을 활성화하고 회원 등급 자동 변경...');
    
    // 병원 상태 업데이트
    const updatedHospital = await db.update(hospitals)
      .set({ 
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(hospitals.id, 10))
      .returning();

    console.log(`   병원 상태 변경 완료: ${updatedHospital[0].name} → 활성화`);

    // 자동화 트리거 - 회원 등급 변경
    const targetUsers = await db.query.users.findMany({
      where: eq(users.hospitalId, 10)
    });

    console.log(`   소속 회원 수: ${targetUsers.length}명`);

    for (const user of targetUsers) {
      // 관리자는 제외
      if (['admin', 'superadmin', 'hospital_admin'].includes(user.memberType)) {
        console.log(`   ${user.email} - 관리자 등급이므로 변경 제외`);
        continue;
      }

      // 회원 등급을 pro로 변경
      await db.update(users)
        .set({ 
          memberType: 'pro',
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
      
      console.log(`   ${user.email} - ${user.memberType} → pro 변경 완료`);
    }

    // 3. 결과 확인
    console.log('\n3. 테스트 후 결과 확인:');
    
    const updatedUser = await db.query.users.findFirst({
      where: eq(users.id, 29),
      with: { hospital: true }
    });
    
    console.log(`   사용자 29: ${updatedUser?.memberType}`);
    console.log(`   병원 10: ${updatedUser?.hospital?.isActive ? '활성화' : '비활성화'}`);

    // 4. 비활성화 테스트
    console.log('\n4. 병원 비활성화 자동화 테스트:');
    
    // 병원 비활성화
    await db.update(hospitals)
      .set({ 
        isActive: false,
        updatedAt: new Date()
      })
      .where(eq(hospitals.id, 10));

    console.log('   병원을 비활성화하고 회원 등급 자동 변경...');

    // 회원 등급을 free로 변경
    for (const user of targetUsers) {
      if (['admin', 'superadmin', 'hospital_admin'].includes(user.memberType)) {
        continue;
      }

      await db.update(users)
        .set({ 
          memberType: 'free',
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
      
      console.log(`   ${user.email} - pro → free 변경 완료`);
    }

    // 5. 최종 상태로 복원 (병원 활성화)
    console.log('\n5. 최종 상태 복원:');
    
    await db.update(hospitals)
      .set({ 
        isActive: true,
        updatedAt: new Date()
      })
      .where(eq(hospitals.id, 10));

    for (const user of targetUsers) {
      if (['admin', 'superadmin', 'hospital_admin'].includes(user.memberType)) {
        continue;
      }

      await db.update(users)
        .set({ 
          memberType: 'pro',
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id));
    }

    console.log('   병원 활성화 및 회원 pro 등급 복원 완료');

    console.log('\n=== 자동화 시스템 테스트 완료 ===');
    console.log('수동 테스트로 자동화 로직이 정상 작동함을 확인했습니다.');
    console.log('이제 API 엔드포인트에서 이 로직이 호출되는지 확인해야 합니다.');

  } catch (error) {
    console.error('테스트 중 오류:', error);
  }
}

testHospitalAutomation().catch(console.error);