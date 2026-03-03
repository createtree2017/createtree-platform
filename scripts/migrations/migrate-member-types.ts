/**
 * 회원 등급 시스템 마이그레이션 스크립트
 * 기존 잘못된 등급을 올바른 6단계 등급으로 변경합니다.
 * 
 * 새로운 등급 체계:
 * - free: 일반회원(무료회원)
 * - pro: pro회원 
 * - membership: 멤버쉽회원(pro회원등급)
 * - hospital_admin: 병원관리자
 * - admin: 관리자
 * - superadmin: 슈퍼관리자
 */

import { db } from '../../db';
import { users } from '@shared/schema';
import { eq, or } from 'drizzle-orm';

async function migrateMemberTypes() {
  console.log('🔄 회원 등급 마이그레이션 시작...');

  try {
    // 1. 기존 잘못된 등급들을 올바른 등급으로 매핑
    const memberTypeMapping: Record<string, string> = {
      'general': 'free',        // 기존 general -> free (일반회원)
      'user': 'free',           // 기존 user -> free (일반회원)
      'membership': 'membership', // membership 유지
      'admin': 'admin',         // admin 유지
      'superadmin': 'superadmin' // superadmin 유지
    };

    // 2. 모든 사용자 조회
    const allUsers = await db.select().from(users);
    console.log(`📋 총 ${allUsers.length}명의 사용자를 확인합니다.`);

    let migratedCount = 0;

    // 3. 각 사용자의 등급 확인 및 업데이트
    for (const user of allUsers) {
      const currentType = user.memberType;
      const newType = memberTypeMapping[currentType] || 'free'; // 기본값은 free

      if (currentType !== newType) {
        console.log(`🔄 사용자 ID ${user.id} (${user.username}): ${currentType} -> ${newType}`);
        
        await db
          .update(users)
          .set({ 
            memberType: newType,
            updatedAt: new Date()
          })
          .where(eq(users.id, user.id));
        
        migratedCount++;
      }
    }

    console.log(`✅ 마이그레이션 완료! ${migratedCount}명의 사용자 등급이 업데이트되었습니다.`);

    // 4. 최종 등급 분포 확인
    const finalUsers = await db.select().from(users);
    const typeDistribution: Record<string, number> = {};
    
    finalUsers.forEach(user => {
      typeDistribution[user.memberType] = (typeDistribution[user.memberType] || 0) + 1;
    });

    console.log('📊 최종 회원 등급 분포:');
    Object.entries(typeDistribution).forEach(([type, count]) => {
      const koreanName = getKoreanMemberTypeName(type);
      console.log(`  - ${type} (${koreanName}): ${count}명`);
    });

  } catch (error) {
    console.error('❌ 마이그레이션 실패:', error);
    throw error;
  }
}

function getKoreanMemberTypeName(memberType: string): string {
  const typeNames: Record<string, string> = {
    'free': '일반회원(무료회원)',
    'pro': 'pro회원',
    'membership': '멤버쉽회원(pro회원등급)',
    'hospital_admin': '병원관리자',
    'admin': '관리자',
    'superadmin': '슈퍼관리자'
  };
  return typeNames[memberType] || '알 수 없음';
}

// 스크립트 실행
if (require.main === module) {
  migrateMemberTypes()
    .then(() => {
      console.log('🎉 회원 등급 시스템 마이그레이션이 성공적으로 완료되었습니다!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 마이그레이션 실패:', error);
      process.exit(1);
    });
}

export { migrateMemberTypes };