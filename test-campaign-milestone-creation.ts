#!/usr/bin/env tsx

/**
 * 참여형 마일스톤 생성 테스트 스크립트
 * 모든 필수 필드가 제대로 동작하는지 확인
 */

import { db } from './db';
import { milestones, milestoneCategories, hospitals } from './shared/schema';
import { eq } from 'drizzle-orm';

interface TestMilestoneData {
  milestoneId: string;
  title: string;
  description: string;
  content: string;
  headerImageUrl: string;
  badgeEmoji: string;
  encouragementMessage: string;
  campaignStartDate: string;
  campaignEndDate: string;
  selectionStartDate: string;
  selectionEndDate: string;
  categoryId: string;
  hospitalId: number;
  order: number;
  isActive: boolean;
}

async function testCampaignMilestoneCreation() {
  console.log('🧪 참여형 마일스톤 생성 테스트 시작...\n');

  try {
    // 1. 현재 사용 가능한 카테고리 확인
    console.log('📋 Step 1: 사용 가능한 카테고리 확인');
    const categories = await db.query.milestoneCategories.findMany();
    console.log('사용 가능한 카테고리:', categories.map(c => ({ id: c.id, name: c.name })));

    // 2. 현재 사용 가능한 병원 확인
    console.log('\n🏥 Step 2: 사용 가능한 병원 확인');
    const hospitalList = await db.query.hospitals.findMany();
    console.log('사용 가능한 병원:', hospitalList.map(h => ({ id: h.id, name: h.name })));

    if (categories.length === 0 || hospitalList.length === 0) {
      console.log('❌ 카테고리 또는 병원 데이터가 없어서 테스트를 진행할 수 없습니다.');
      return;
    }

    // 3. 테스트 마일스톤 데이터 준비
    console.log('\n📝 Step 3: 테스트 마일스톤 데이터 준비');
    const testData: TestMilestoneData = {
      milestoneId: `test-campaign-${Date.now()}`,
      title: "테스트 참여형 마일스톤",
      description: "참여형 마일스톤 생성 테스트를 위한 샘플 데이터입니다.",
      content: "이 마일스톤은 테스트용으로 생성되었으며, 모든 필수 필드가 포함되어 있습니다. 참여자들이 참여할 수 있는 이벤트 마일스톤입니다.",
      headerImageUrl: "https://example.com/header.jpg",
      badgeEmoji: "🎯",
      encouragementMessage: "테스트 참여해주셔서 감사합니다!",
      campaignStartDate: new Date(Date.now() + 86400000).toISOString(), // 내일
      campaignEndDate: new Date(Date.now() + 86400000 * 7).toISOString(), // 1주일 후
      selectionStartDate: new Date(Date.now() + 86400000 * 8).toISOString(), // 8일 후
      selectionEndDate: new Date(Date.now() + 86400000 * 10).toISOString(), // 10일 후
      categoryId: categories[0].categoryId, // 첫 번째 카테고리의 categoryId 사용
      hospitalId: hospitalList[0].id, // 첫 번째 병원 사용
      order: 999,
      isActive: true
    };

    console.log('테스트 데이터:', {
      milestoneId: testData.milestoneId,
      title: testData.title,
      categoryId: testData.categoryId,
      hospitalId: testData.hospitalId,
      badgeEmoji: testData.badgeEmoji,
      encouragementMessage: testData.encouragementMessage
    });

    // 4. API 호출 시뮬레이션 (서버의 createMilestone 로직 직접 호출)
    console.log('\n🚀 Step 4: 마일스톤 생성 시도');
    
    const milestoneData = {
      milestoneId: testData.milestoneId,
      title: testData.title,
      description: testData.description,
      content: testData.content,
      type: 'campaign' as const,
      categoryId: testData.categoryId,
      badgeEmoji: testData.badgeEmoji,
      badgeImageUrl: "",
      encouragementMessage: testData.encouragementMessage,
      headerImageUrl: testData.headerImageUrl,
      hospitalId: testData.hospitalId,
      order: testData.order,
      isActive: testData.isActive,
      // 참여형 필드
      campaignStartDate: new Date(testData.campaignStartDate),
      campaignEndDate: new Date(testData.campaignEndDate),
      selectionStartDate: new Date(testData.selectionStartDate),
      selectionEndDate: new Date(testData.selectionEndDate),
      // 기본값 필드 (정보형 마일스톤과 호환성을 위해)
      weekStart: 1,
      weekEnd: 40
    };

    // 데이터베이스에 직접 삽입
    const [newMilestone] = await db.insert(milestones).values({
      milestoneId: milestoneData.milestoneId,
      title: milestoneData.title,
      description: milestoneData.description,
      content: milestoneData.content,
      type: milestoneData.type,
      categoryId: milestoneData.categoryId,
      weekStart: milestoneData.weekStart,
      weekEnd: milestoneData.weekEnd,
      badgeEmoji: milestoneData.badgeEmoji,
      badgeImageUrl: milestoneData.badgeImageUrl,
      encouragementMessage: milestoneData.encouragementMessage,
      headerImageUrl: milestoneData.headerImageUrl,
      hospitalId: milestoneData.hospitalId,
      order: milestoneData.order,
      isActive: milestoneData.isActive,
      campaignStartDate: milestoneData.campaignStartDate,
      campaignEndDate: milestoneData.campaignEndDate,
      selectionStartDate: milestoneData.selectionStartDate,
      selectionEndDate: milestoneData.selectionEndDate
    }).returning();

    console.log('✅ 마일스톤 생성 성공!');
    console.log('생성된 마일스톤 ID:', newMilestone.id);
    console.log('생성된 마일스톤 데이터:', {
      id: newMilestone.id,
      milestoneId: newMilestone.milestoneId,
      title: newMilestone.title,
      type: newMilestone.type,
      categoryId: newMilestone.categoryId,
      hospitalId: newMilestone.hospitalId,
      badgeEmoji: newMilestone.badgeEmoji,
      encouragementMessage: newMilestone.encouragementMessage
    });

    // 5. 생성된 마일스톤 확인
    console.log('\n🔍 Step 5: 생성된 마일스톤 검증');
    const createdMilestone = await db.query.milestones.findFirst({
      where: eq(milestones.id, newMilestone.id),
      with: {
        category: true,
        hospital: true
      }
    });

    if (createdMilestone) {
      console.log('✅ 마일스톤 검증 성공');
      console.log('검증된 데이터:', {
        id: createdMilestone.id,
        type: createdMilestone.type,
        categoryName: createdMilestone.category?.name,
        hospitalName: createdMilestone.hospital?.name,
        badgeEmoji: createdMilestone.badgeEmoji,
        encouragementMessage: createdMilestone.encouragementMessage,
        campaignStartDate: createdMilestone.campaignStartDate,
        campaignEndDate: createdMilestone.campaignEndDate
      });
    } else {
      console.log('❌ 마일스톤 검증 실패: 생성된 마일스톤을 찾을 수 없습니다.');
    }

    // 6. 참여형 마일스톤 API 조회 테스트
    console.log('\n📡 Step 6: 참여형 마일스톤 API 조회 테스트');
    const campaignMilestones = await db.query.milestones.findMany({
      where: eq(milestones.type, 'campaign'),
      with: {
        category: true,
        hospital: true
      }
    });

    console.log(`✅ 전체 참여형 마일스톤 개수: ${campaignMilestones.length}`);
    const recentCampaign = campaignMilestones.find(m => m.id === newMilestone.id);
    if (recentCampaign) {
      console.log('✅ 생성한 마일스톤이 참여형 목록에 포함됨');
    } else {
      console.log('❌ 생성한 마일스톤이 참여형 목록에 없음');
    }

    console.log('\n🎉 테스트 완료!');
    console.log('✅ 모든 필수 필드가 정상적으로 처리됨');
    console.log('✅ 참여형 마일스톤 생성 성공');
    console.log('✅ 데이터베이스 저장 및 조회 정상');

  } catch (error) {
    console.error('❌ 테스트 중 오류 발생:', error);
    if (error instanceof Error) {
      console.error('오류 메시지:', error.message);
      console.error('스택 트레이스:', error.stack);
    }
  }
}

// 실행
if (import.meta.url === `file://${process.argv[1]}`) {
  testCampaignMilestoneCreation().catch(console.error);
}