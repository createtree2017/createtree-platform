/**
 * 병원 비활성화가 멤버십 회원에게 미치는 영향 테스트
 * 포유문산부인과 비활성화 후 해당 병원 멤버십 회원들의 권한 상태 확인
 */

import { db } from './db';
import { users, hospitals } from './shared/schema';
import { eq } from 'drizzle-orm';

async function testHospitalDeactivationImpact() {
  console.log('\n=== 병원 비활성화 영향 테스트 시작 ===\n');

  try {
    // 1. 포유문산부인과 현재 상태 확인
    console.log('1. 포유문산부인과 현재 상태 확인');
    const poyuHospital = await db.query.hospitals.findFirst({
      where: eq(hospitals.name, '포유문산부인과')
    });

    if (!poyuHospital) {
      console.log('❌ 포유문산부인과를 찾을 수 없습니다.');
      return;
    }

    console.log(`포유문산부인과 (ID: ${poyuHospital.id})`);
    console.log(`- 활성화 상태: ${poyuHospital.isActive ? '✅ 활성' : '❌ 비활성'}`);
    console.log(`- 생성일: ${poyuHospital.createdAt}`);
    console.log(`- 업데이트일: ${poyuHospital.updatedAt}\n`);

    // 2. 포유문산부인과 소속 멤버십 회원 조회
    console.log('2. 포유문산부인과 소속 멤버십 회원 조회');
    const poyuMembers = await db.query.users.findMany({
      where: eq(users.hospitalId, poyuHospital.id),
      with: {
        hospital: true
      }
    });

    console.log(`포유문산부인과 소속 회원 수: ${poyuMembers.length}명`);
    
    if (poyuMembers.length === 0) {
      console.log('포유문산부인과 소속 회원이 없습니다.\n');
    } else {
      poyuMembers.forEach((member, index) => {
        console.log(`\n회원 ${index + 1}:`);
        console.log(`- ID: ${member.id}`);
        console.log(`- 이름: ${member.username}`);
        console.log(`- 이메일: ${member.email}`);
        console.log(`- 회원 등급: ${member.memberType}`);
        console.log(`- 병원 ID: ${member.hospitalId}`);
        console.log(`- 병원명: ${member.hospital?.name || 'N/A'}`);
        console.log(`- 병원 활성화 상태: ${member.hospital?.isActive ? '✅ 활성' : '❌ 비활성'}`);
      });
    }

    // 3. 권한 시스템 테스트를 위한 membership 회원 생성 (테스트용)
    console.log('\n\n3. 권한 시스템 테스트');
    
    // 테스트 회원 중 하나 선택 또는 생성
    let testMember = poyuMembers.find(m => m.memberType === 'membership');
    
    if (!testMember) {
      console.log('포유문산부인과 소속 membership 회원이 없어서 테스트 회원을 찾겠습니다.');
      
      // 다른 병원의 membership 회원 찾기
      const membershipUsers = await db.query.users.findMany({
        where: eq(users.memberType, 'membership'),
        with: {
          hospital: true
        },
        limit: 3
      });

      console.log(`\n전체 membership 회원 현황 (${membershipUsers.length}명):`);
      membershipUsers.forEach((member, index) => {
        console.log(`\n회원 ${index + 1}:`);
        console.log(`- ID: ${member.id}, 이름: ${member.username}`);
        console.log(`- 병원: ${member.hospital?.name || 'N/A'} (ID: ${member.hospitalId})`);
        console.log(`- 병원 활성화: ${member.hospital?.isActive ? '✅ 활성' : '❌ 비활성'}`);
      });

      testMember = membershipUsers[0];
    }

    // 4. 권한 체크 시뮬레이션
    if (testMember) {
      console.log(`\n\n4. 권한 체크 시뮬레이션 - ${testMember.username} (ID: ${testMember.id})`);
      console.log(`회원 등급: ${testMember.memberType}`);
      console.log(`소속 병원: ${testMember.hospital?.name || 'N/A'}`);
      console.log(`병원 활성화 상태: ${testMember.hospital?.isActive ? '✅ 활성' : '❌ 비활성'}`);

      // 권한 체크 로직 시뮬레이션
      const isMembership = testMember.memberType === 'membership';
      const hasActiveHospital = testMember.hospital?.isActive === true;
      const shouldHaveAccess = isMembership && hasActiveHospital;

      console.log('\n권한 체크 결과:');
      console.log(`- Membership 회원: ${isMembership ? '✅' : '❌'}`);
      console.log(`- 활성화된 병원: ${hasActiveHospital ? '✅' : '❌'}`);
      console.log(`- 프리미엄 서비스 접근 권한: ${shouldHaveAccess ? '✅ 허용' : '❌ 차단'}`);

      if (!shouldHaveAccess && isMembership) {
        console.log('\n⚠️ 예상 동작: 이 회원은 병원이 비활성화되어 프리미엄 서비스에 접근할 수 없어야 합니다.');
      }
    }

    // 5. 모든 병원 활성화 상태 요약
    console.log('\n\n5. 전체 병원 활성화 상태 요약');
    const allHospitals = await db.query.hospitals.findMany({
      orderBy: hospitals.id
    });

    console.log(`총 병원 수: ${allHospitals.length}개`);
    allHospitals.forEach(hospital => {
      console.log(`- ${hospital.name} (ID: ${hospital.id}): ${hospital.isActive ? '✅ 활성' : '❌ 비활성'}`);
    });

    // 6. 권한 시스템 정상 작동 확인을 위한 추천 사항
    console.log('\n\n6. 권한 시스템 테스트 추천 사항');
    console.log('다음 단계로 실제 API 테스트를 권장합니다:');
    console.log('1. 포유문산부인과 소속 membership 회원으로 로그인');
    console.log('2. 이미지 생성 API (/api/generate-image) 호출 시도');
    console.log('3. 예상 결과: 403 Forbidden (병원 비활성화로 인한 접근 거부)');
    console.log('4. 다른 활성화된 병원 소속 membership 회원으로 테스트');
    console.log('5. 예상 결과: 정상 접근 허용');

  } catch (error) {
    console.error('테스트 중 오류 발생:', error);
  }
}

// 실행
testHospitalDeactivationImpact().catch(console.error);