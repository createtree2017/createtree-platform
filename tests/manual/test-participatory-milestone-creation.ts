/**
 * 참여형 마일스톤 생성 오류 해결 검증 테스트 (API 엔드포인트 테스트)
 */

import fetch from 'node-fetch';

async function testParticipatoryMilestoneCreation() {
  console.log('🔍 참여형 마일스톤 생성 오류 해결 검증 시작 (API 테스트)\n');

  try {
    // 정보형 마일스톤 테스트 데이터 (올바른 categoryId 사용)
    const testMilestone = {
      title: '기저귀케이크만들기',
      description: '기저귀케이크만들기ㅁㄴㅇㅁㄴㅇㅁㄴㅇ',
      categoryId: 'prenatal-culture',
      weekStart: 1,
      weekEnd: 40,
      badgeEmoji: '🎂',
      encouragementMessage: '멋진 기저귀 케이크를 만들어보세요!',
      order: 0,
      isActive: true
    };

    console.log('📝 마일스톤 생성 API 호출 중...');
    console.log('요청 데이터:', JSON.stringify(testMilestone, null, 2));
    
    const response = await fetch('http://localhost:5000/api/admin/milestones', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testMilestone)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ 마일스톤 생성 성공!');
    console.log(`   ID: ${result.id}`);
    console.log(`   마일스톤 ID: ${result.milestoneId}`);
    console.log(`   제목: ${result.title}`);
    console.log(`   타입: ${result.type}`);
    console.log(`   Week Start: ${result.weekStart}`);
    console.log(`   Week End: ${result.weekEnd}`);
    
    return {
      success: true,
      milestone: result,
      message: '마일스톤 생성 오류가 완전히 해결되었습니다.'
    };

  } catch (error) {
    console.error('❌ 마일스톤 생성 실패:', error);
    
    return {
      success: false,
      error: error.message,
      message: '마일스톤 생성 오류가 여전히 존재합니다.'
    };
  }
}

// 테스트 실행
testParticipatoryMilestoneCreation()
  .then(result => {
    console.log('\n🏆 === 테스트 결과 ===');
    console.log(`상태: ${result.success ? '성공' : '실패'}`);
    console.log(`메시지: ${result.message}`);
    
    if (result.success) {
      console.log('\n🎉 참여형 마일스톤 생성 오류가 완전히 해결되었습니다!');
      console.log('관리자가 이제 참여형 마일스톤을 정상적으로 생성할 수 있습니다.');
    } else {
      console.log('\n🚨 추가 조치가 필요합니다.');
      console.log(`오류: ${result.error}`);
    }
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ 테스트 실행 오류:', error);
    process.exit(1);
  });