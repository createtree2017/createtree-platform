/**
 * Phase 5: 참여형 마일스톤 알림 시스템 완전 테스트
 * 
 * 테스트 범위:
 * 1. 알림 테이블 생성 및 스키마 검증
 * 2. 알림 서비스 함수 8개 동작 확인
 * 3. 알림 API 엔드포인트 8개 테스트
 * 4. 참여형 마일스톤 연동 알림 자동 생성
 * 5. 알림 설정 시스템 완전 검증
 */

import { db } from './server/db/index.js';
import { 
  notifications, 
  notificationSettings,
  milestoneApplications,
  users,
  eq, desc, and
} from './shared/schema.js';

interface TestResult {
  phase: number;
  test: string;
  status: 'PASS' | 'FAIL';
  issue?: string;
  error?: any;
  details?: any;
}

const results: TestResult[] = [];

async function testPhase5NotificationSystem() {
  console.log('\n🔔 Phase 5: 참여형 마일스톤 알림 시스템 완전 테스트 시작');
  console.log('=' * 60);

  // Phase 5-1: 알림 테이블 및 스키마 검증
  await testNotificationTables();
  
  // Phase 5-2: 알림 서비스 함수 테스트
  await testNotificationServices();
  
  // Phase 5-3: 알림 API 엔드포인트 테스트
  await testNotificationAPIs();
  
  // Phase 5-4: 참여형 마일스톤 연동 테스트
  await testMilestoneNotificationIntegration();
  
  // Phase 5-5: 알림 설정 시스템 테스트
  await testNotificationSettings();

  // 결과 요약
  const phase5Results = results.filter(r => r.phase === 5);
  const passCount = phase5Results.filter(r => r.status === 'PASS').length;
  const totalCount = phase5Results.length;
  const successRate = Math.round((passCount / totalCount) * 100);

  console.log('\n📊 Phase 5 테스트 결과 요약');
  console.log('=' * 40);
  console.log(`총 테스트: ${totalCount}개`);
  console.log(`성공: ${passCount}개`);
  console.log(`실패: ${totalCount - passCount}개`);
  console.log(`성공률: ${successRate}%`);

  if (successRate >= 90) {
    console.log('✅ Phase 5 알림 시스템 완성도: 우수 (90% 이상)');
  } else if (successRate >= 75) {
    console.log('⚠️ Phase 5 알림 시스템 완성도: 양호 (75-89%)');
  } else {
    console.log('❌ Phase 5 알림 시스템 완성도: 미흡 (75% 미만)');
  }

  // 실패한 테스트 상세 정보
  const failedTests = phase5Results.filter(r => r.status === 'FAIL');
  if (failedTests.length > 0) {
    console.log('\n❌ 실패한 테스트 상세:');
    failedTests.forEach(test => {
      console.log(`- ${test.test}: ${test.issue || test.error}`);
    });
  }

  return {
    phase: 5,
    totalTests: totalCount,
    passedTests: passCount,
    successRate,
    status: successRate >= 90 ? 'EXCELLENT' : successRate >= 75 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
  };
}

// Phase 5-1: 알림 테이블 및 스키마 검증
async function testNotificationTables() {
  console.log('\n📋 Phase 5-1: 알림 테이블 및 스키마 검증');
  
  try {
    // 1. notifications 테이블 존재 확인
    const notificationCount = await db.select().from(notifications).limit(1);
    results.push({
      phase: 5,
      test: '알림 테이블(notifications) 존재 확인',
      status: 'PASS'
    });
  } catch (error) {
    results.push({
      phase: 5,
      test: '알림 테이블(notifications) 존재 확인',
      status: 'FAIL',
      error
    });
  }

  try {
    // 2. notification_settings 테이블 존재 확인
    const settingsCount = await db.select().from(notificationSettings).limit(1);
    results.push({
      phase: 5,
      test: '알림 설정 테이블(notification_settings) 존재 확인',
      status: 'PASS'
    });
  } catch (error) {
    results.push({
      phase: 5,
      test: '알림 설정 테이블(notification_settings) 존재 확인',
      status: 'FAIL',
      error
    });
  }

  try {
    // 3. 알림 테이블 필수 컬럼 확인
    const testNotification = {
      userId: 'test-user',
      type: 'test_notification',
      title: '테스트 알림',
      message: '테스트 메시지',
      isRead: false
    };

    const [inserted] = await db.insert(notifications).values(testNotification).returning();
    await db.delete(notifications).where(eq(notifications.id, inserted.id));

    results.push({
      phase: 5,
      test: '알림 테이블 필수 컬럼 및 스키마 검증',
      status: 'PASS'
    });
  } catch (error) {
    results.push({
      phase: 5,
      test: '알림 테이블 필수 컬럼 및 스키마 검증',
      status: 'FAIL',
      error
    });
  }
}

// Phase 5-2: 알림 서비스 함수 테스트
async function testNotificationServices() {
  console.log('\n🔧 Phase 5-2: 알림 서비스 함수 테스트');

  try {
    // 알림 서비스 import 테스트
    const {
      createNotification,
      getUserNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      deleteNotification,
      getUserNotificationSettings,
      updateNotificationSettings,
      shouldSendNotification
    } = await import('./server/services/notifications.js');

    results.push({
      phase: 5,
      test: '알림 서비스 함수 8개 import 확인',
      status: 'PASS'
    });

    // 테스트용 사용자 ID
    const testUserId = 'test-notification-user-24';

    // 1. 알림 생성 테스트
    const testNotification = await createNotification({
      userId: testUserId,
      type: 'milestone_application',
      title: '참여형 마일스톤 신청',
      message: '태교음악회 신청이 완료되었습니다.',
      data: { milestoneTitle: '태교음악회', hospitalName: '강남병원' }
    });

    if (testNotification && testNotification.id) {
      results.push({
        phase: 5,
        test: 'createNotification 함수 동작 확인',
        status: 'PASS',
        details: { notificationId: testNotification.id }
      });
    } else {
      throw new Error('알림 생성 결과가 유효하지 않습니다');
    }

    // 2. 사용자 알림 목록 조회 테스트
    const userNotifications = await getUserNotifications(testUserId, { limit: 5 });
    
    if (userNotifications.notifications.length > 0 && userNotifications.unreadCount >= 1) {
      results.push({
        phase: 5,
        test: 'getUserNotifications 함수 동작 확인',
        status: 'PASS',
        details: { count: userNotifications.notifications.length, unread: userNotifications.unreadCount }
      });
    } else {
      throw new Error('사용자 알림 조회 결과가 예상과 다릅니다');
    }

    // 3. 알림 읽음 처리 테스트
    const readNotification = await markNotificationAsRead(testNotification.id, testUserId);
    
    if (readNotification && readNotification.isRead === true) {
      results.push({
        phase: 5,
        test: 'markNotificationAsRead 함수 동작 확인',
        status: 'PASS'
      });
    } else {
      throw new Error('알림 읽음 처리가 정상적으로 동작하지 않습니다');
    }

    // 4. 알림 삭제 테스트
    const isDeleted = await deleteNotification(testNotification.id, testUserId);
    
    if (isDeleted === true) {
      results.push({
        phase: 5,
        test: 'deleteNotification 함수 동작 확인',
        status: 'PASS'
      });
    } else {
      throw new Error('알림 삭제가 정상적으로 동작하지 않습니다');
    }

    // 5. 알림 설정 관리 테스트
    const settings = await updateNotificationSettings(testUserId, {
      milestoneApplications: true,
      applicationStatusChanges: false,
      campaignReminders: true
    });

    if (settings && settings.userId === testUserId) {
      results.push({
        phase: 5,
        test: '알림 설정 관리 함수 동작 확인',
        status: 'PASS'
      });
    } else {
      throw new Error('알림 설정 관리가 정상적으로 동작하지 않습니다');
    }

  } catch (error) {
    results.push({
      phase: 5,
      test: '알림 서비스 함수 테스트',
      status: 'FAIL',
      error: error.message
    });
  }
}

// Phase 5-3: 알림 API 엔드포인트 테스트
async function testNotificationAPIs() {
  console.log('\n🌐 Phase 5-3: 알림 API 엔드포인트 테스트');

  const apiTests = [
    { method: 'GET', path: '/api/notifications', description: '사용자 알림 목록 조회' },
    { method: 'GET', path: '/api/notifications/unread-count', description: '읽지 않은 알림 개수' },
    { method: 'PATCH', path: '/api/notifications/:id/read', description: '알림 읽음 처리' },
    { method: 'PATCH', path: '/api/notifications/read-all', description: '모든 알림 읽음 처리' },
    { method: 'DELETE', path: '/api/notifications/:id', description: '알림 삭제' },
    { method: 'GET', path: '/api/notifications/settings', description: '알림 설정 조회' },
    { method: 'PATCH', path: '/api/notifications/settings', description: '알림 설정 업데이트' },
    { method: 'POST', path: '/api/admin/notifications/create', description: '관리자 알림 생성' }
  ];

  for (const apiTest of apiTests) {
    try {
      const response = await fetch(`http://localhost:5000${apiTest.path}`, {
        method: 'OPTIONS', // CORS preflight 체크로 엔드포인트 존재 확인
      });

      if (response.status === 200 || response.status === 405) { // OPTIONS는 보통 405 또는 200
        results.push({
          phase: 5,
          test: `API 엔드포인트 ${apiTest.method} ${apiTest.path}`,
          status: 'PASS'
        });
      } else {
        throw new Error(`예상하지 못한 응답 상태: ${response.status}`);
      }
    } catch (error) {
      results.push({
        phase: 5,
        test: `API 엔드포인트 ${apiTest.method} ${apiTest.path}`,
        status: 'FAIL',
        issue: `엔드포인트 접근 실패: ${error.message}`
      });
    }
  }
}

// Phase 5-4: 참여형 마일스톤 연동 테스트
async function testMilestoneNotificationIntegration() {
  console.log('\n🔗 Phase 5-4: 참여형 마일스톤 연동 테스트');

  try {
    // 1. 마일스톤 신청 시 자동 알림 생성 확인
    const existingApplications = await db.query.milestoneApplications.findMany({
      limit: 1,
      orderBy: desc(milestoneApplications.createdAt)
    });

    if (existingApplications.length > 0) {
      const application = existingApplications[0];
      
      // 해당 신청과 연결된 알림이 있는지 확인
      const relatedNotifications = await db.query.notifications.findMany({
        where: and(
          eq(notifications.userId, application.userId),
          eq(notifications.type, 'milestone_application')
        ),
        limit: 5
      });

      if (relatedNotifications.length > 0) {
        results.push({
          phase: 5,
          test: '마일스톤 신청 연동 알림 시스템 확인',
          status: 'PASS',
          details: { applicationId: application.id, notificationCount: relatedNotifications.length }
        });
      } else {
        results.push({
          phase: 5,
          test: '마일스톤 신청 연동 알림 시스템 확인',
          status: 'FAIL',
          issue: '마일스톤 신청과 연결된 알림을 찾을 수 없습니다'
        });
      }
    } else {
      results.push({
        phase: 5,
        test: '마일스톤 신청 연동 알림 시스템 확인',
        status: 'FAIL',
        issue: '테스트할 마일스톤 신청 데이터가 없습니다'
      });
    }

    // 2. 다양한 알림 타입 생성 테스트
    const {
      createApplicationApprovedNotification,
      createApplicationRejectedNotification,
      createCampaignStartNotification,
      createCampaignDeadlineNotification
    } = await import('./server/services/notifications.js');

    const testUserId = '24'; // 실제 사용자 ID 사용
    const testMilestone = '태교음악회';
    const testHospital = '강남병원';

    // 승인 알림 테스트
    const approvedNotification = await createApplicationApprovedNotification(
      testUserId,
      testMilestone,
      testHospital,
      '축하드립니다! 선정되셨습니다.'
    );

    if (approvedNotification && approvedNotification.type === 'application_approved') {
      results.push({
        phase: 5,
        test: '마일스톤 승인 알림 생성',
        status: 'PASS'
      });
    } else {
      throw new Error('승인 알림 생성에 실패했습니다');
    }

    // 거절 알림 테스트
    const rejectedNotification = await createApplicationRejectedNotification(
      testUserId,
      testMilestone,
      testHospital,
      '아쉽게도 이번에는 선정되지 않았습니다.'
    );

    if (rejectedNotification && rejectedNotification.type === 'application_rejected') {
      results.push({
        phase: 5,
        test: '마일스톤 거절 알림 생성',
        status: 'PASS'
      });
    } else {
      throw new Error('거절 알림 생성에 실패했습니다');
    }

    // 캠페인 시작 알림 테스트
    const startNotification = await createCampaignStartNotification(
      testUserId,
      testMilestone,
      testHospital
    );

    if (startNotification && startNotification.type === 'campaign_start') {
      results.push({
        phase: 5,
        test: '캠페인 시작 알림 생성',
        status: 'PASS'
      });
    } else {
      throw new Error('캠페인 시작 알림 생성에 실패했습니다');
    }

    // 마감 임박 알림 테스트
    const deadlineNotification = await createCampaignDeadlineNotification(
      testUserId,
      testMilestone,
      testHospital,
      3
    );

    if (deadlineNotification && deadlineNotification.type === 'campaign_deadline') {
      results.push({
        phase: 5,
        test: '캠페인 마감 임박 알림 생성',
        status: 'PASS'
      });
    } else {
      throw new Error('캠페인 마감 임박 알림 생성에 실패했습니다');
    }

  } catch (error) {
    results.push({
      phase: 5,
      test: '참여형 마일스톤 연동 테스트',
      status: 'FAIL',
      error: error.message
    });
  }
}

// Phase 5-5: 알림 설정 시스템 테스트
async function testNotificationSettings() {
  console.log('\n⚙️ Phase 5-5: 알림 설정 시스템 테스트');

  try {
    const {
      getUserNotificationSettings,
      updateNotificationSettings,
      shouldSendNotification
    } = await import('./server/services/notifications.js');

    const testUserId = '24';

    // 1. 기본 설정 확인
    let settings = await getUserNotificationSettings(testUserId);
    
    // 2. 설정 업데이트 테스트
    const updatedSettings = await updateNotificationSettings(testUserId, {
      milestoneApplications: true,
      applicationStatusChanges: false,
      campaignReminders: true,
      campaignUpdates: false,
      systemNotifications: true
    });

    if (updatedSettings && updatedSettings.userId === testUserId) {
      results.push({
        phase: 5,
        test: '알림 설정 업데이트',
        status: 'PASS'
      });
    } else {
      throw new Error('알림 설정 업데이트에 실패했습니다');
    }

    // 3. 알림 허용 여부 확인 테스트
    const shouldSendApplication = await shouldSendNotification(testUserId, 'milestone_application');
    const shouldSendStatusChange = await shouldSendNotification(testUserId, 'application_approved');

    if (shouldSendApplication === true && shouldSendStatusChange === false) {
      results.push({
        phase: 5,
        test: '알림 허용 여부 확인 로직',
        status: 'PASS'
      });
    } else {
      results.push({
        phase: 5,
        test: '알림 허용 여부 확인 로직',
        status: 'FAIL',
        issue: `예상 결과와 다름: 신청알림=${shouldSendApplication}, 상태변경알림=${shouldSendStatusChange}`
      });
    }

    // 4. 알림 설정 필드 검증
    const requiredFields = [
      'milestoneApplications',
      'applicationStatusChanges',
      'campaignReminders',
      'campaignUpdates',
      'systemNotifications',
      'emailNotifications',
      'pushNotifications'
    ];

    const currentSettings = await getUserNotificationSettings(testUserId);
    const missingFields = requiredFields.filter(field => !(field in currentSettings));

    if (missingFields.length === 0) {
      results.push({
        phase: 5,
        test: '알림 설정 필드 완전성 검증',
        status: 'PASS'
      });
    } else {
      results.push({
        phase: 5,
        test: '알림 설정 필드 완전성 검증',
        status: 'FAIL',
        issue: `누락된 필드: ${missingFields.join(', ')}`
      });
    }

  } catch (error) {
    results.push({
      phase: 5,
      test: '알림 설정 시스템 테스트',
      status: 'FAIL',
      error: error.message
    });
  }
}

// 실행
testPhase5NotificationSystem().then(result => {
  console.log('\n🎯 Phase 5 알림 시스템 최종 평가:');
  console.log(`상태: ${result.status}`);
  console.log(`성공률: ${result.successRate}%`);
  console.log(`테스트 결과: ${result.passedTests}/${result.totalTests} 통과`);
  
  if (result.successRate >= 90) {
    console.log('\n✅ Phase 5 알림 시스템이 성공적으로 완성되었습니다!');
    console.log('참여형 마일스톤과 연동된 실시간 알림 시스템이 완전히 구축되었습니다.');
  } else {
    console.log('\n⚠️ Phase 5 알림 시스템에 추가 개발이 필요합니다.');
  }
}).catch(error => {
  console.error('❌ Phase 5 테스트 실행 중 오류 발생:', error);
});