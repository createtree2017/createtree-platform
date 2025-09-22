/**
 * 배너 이미지 업로드 및 교체 기능 실시간 테스트
 * 문제점 진단 및 해결책 제시
 */

import fs from 'fs';
import path from 'path';
import { db } from './db/index.js';
import { banners, smallBanners } from './shared/schema.js';

async function testBannerUploadSystem() {
  console.log("🔍 배너 업로드 시스템 진단 시작...");
  
  // 1. 폴더 구조 확인
  console.log("\n📁 1. 폴더 구조 확인");
  
  const staticBannerDir = path.join(process.cwd(), 'static', 'banner');
  const slideBannersDir = path.join(staticBannerDir, 'slide-banners');
  const smallBannersDir = path.join(staticBannerDir, 'small-banners');
  
  console.log(`staticBannerDir 존재: ${fs.existsSync(staticBannerDir)}`);
  console.log(`slideBannersDir 존재: ${fs.existsSync(slideBannersDir)}`);
  console.log(`smallBannersDir 존재: ${fs.existsSync(smallBannersDir)}`);
  
  if (fs.existsSync(slideBannersDir)) {
    const slideFiles = fs.readdirSync(slideBannersDir);
    console.log(`슬라이드 배너 파일 개수: ${slideFiles.length}`);
    slideFiles.forEach(file => console.log(`  - ${file}`));
  }
  
  if (fs.existsSync(smallBannersDir)) {
    const smallFiles = fs.readdirSync(smallBannersDir);
    console.log(`작은 배너 파일 개수: ${smallFiles.length}`);
    smallFiles.forEach(file => console.log(`  - ${file}`));
  }
  
  // 2. 데이터베이스 현재 상태 확인
  console.log("\n📊 2. 데이터베이스 현재 상태");
  
  const currentSlideBanners = await db.select().from(banners);
  const currentSmallBanners = await db.select().from(smallBanners);
  
  console.log(`DB 슬라이드 배너 개수: ${currentSlideBanners.length}`);
  currentSlideBanners.forEach(banner => {
    console.log(`  ID: ${banner.id}, 이미지: ${banner.imageSrc}`);
    const filePath = path.join(process.cwd(), banner.imageSrc);
    console.log(`    파일 존재: ${fs.existsSync(filePath)}`);
  });
  
  console.log(`DB 작은 배너 개수: ${currentSmallBanners.length}`);
  currentSmallBanners.forEach(banner => {
    console.log(`  ID: ${banner.id}, 이미지: ${banner.imageUrl}`);
    const filePath = path.join(process.cwd(), banner.imageUrl);
    console.log(`    파일 존재: ${fs.existsSync(filePath)}`);
  });
  
  // 3. 업로드 API 테스트 시뮬레이션
  console.log("\n🧪 3. 업로드 API 동작 시뮬레이션");
  
  // 슬라이드 배너 업로드 시뮬레이션
  const mockSlideFile = {
    originalname: 'test-slide.jpg',
    filename: `banner-${Date.now()}-${Math.floor(Math.random() * 1000000)}.jpg`,
    bannerType: 'slide'
  };
  
  const slideBannerType = mockSlideFile.bannerType === 'small' ? 'small-banners' : 'slide-banners';
  const slideRelativePath = `/static/banner/${slideBannerType}/${mockSlideFile.filename}`;
  console.log(`슬라이드 배너 저장 경로: ${slideRelativePath}`);
  
  // 작은 배너 업로드 시뮬레이션
  const mockSmallFile = {
    originalname: 'test-small.png',
    filename: `banner-${Date.now()}-${Math.floor(Math.random() * 1000000)}.png`,
    bannerType: 'small'
  };
  
  const smallBannerType = mockSmallFile.bannerType === 'small' ? 'small-banners' : 'slide-banners';
  const smallRelativePath = `/static/banner/${smallBannerType}/${mockSmallFile.filename}`;
  console.log(`작은 배너 저장 경로: ${smallRelativePath}`);
  
  // 4. 기존 파일 정리 상태 확인
  console.log("\n🗑️ 4. 기존 파일 정리 상태 확인");
  
  const allSlideFiles = fs.existsSync(slideBannersDir) ? fs.readdirSync(slideBannersDir) : [];
  const allSmallFiles = fs.existsSync(smallBannersDir) ? fs.readdirSync(smallBannersDir) : [];
  
  // DB에 없는 고아 파일 찾기
  const orphanSlideFiles = allSlideFiles.filter(file => {
    const filePath = `/static/banner/slide-banners/${file}`;
    return !currentSlideBanners.some(banner => banner.imageSrc === filePath);
  });
  
  const orphanSmallFiles = allSmallFiles.filter(file => {
    const filePath = `/static/banner/small-banners/${file}`;
    return !currentSmallBanners.some(banner => banner.imageUrl === filePath);
  });
  
  console.log(`고아 슬라이드 파일 (DB에 없음): ${orphanSlideFiles.length}개`);
  orphanSlideFiles.forEach(file => console.log(`  - ${file}`));
  
  console.log(`고아 작은 배너 파일 (DB에 없음): ${orphanSmallFiles.length}개`);
  orphanSmallFiles.forEach(file => console.log(`  - ${file}`));
  
  // 5. 배너 수정 시나리오 분석
  console.log("\n🔄 5. 배너 수정 시나리오 분석");
  
  if (currentSlideBanners.length > 0) {
    const firstBanner = currentSlideBanners[0];
    console.log(`\n슬라이드 배너 수정 시나리오 (ID: ${firstBanner.id})`);
    console.log(`현재 이미지: ${firstBanner.imageSrc}`);
    console.log(`새 이미지 업로드 시:`);
    console.log(`  1. 새 이미지 저장: /static/banner/slide-banners/banner-${Date.now()}-*.jpg`);
    console.log(`  2. DB 업데이트: imageSrc 필드 변경`);
    console.log(`  3. ❌ 문제: 기존 이미지 파일이 삭제되지 않음`);
    console.log(`  4. 결과: 고아 파일 누적`);
  }
  
  if (currentSmallBanners.length > 0) {
    const firstSmallBanner = currentSmallBanners[0];
    console.log(`\n작은 배너 수정 시나리오 (ID: ${firstSmallBanner.id})`);
    console.log(`현재 이미지: ${firstSmallBanner.imageUrl}`);
    console.log(`새 이미지 업로드 시:`);
    console.log(`  1. 새 이미지 저장: /static/banner/small-banners/banner-${Date.now()}-*.png`);
    console.log(`  2. DB 업데이트: imageUrl 필드 변경`);
    console.log(`  3. ❌ 문제: 기존 이미지 파일이 삭제되지 않음`);
    console.log(`  4. 결과: 고아 파일 누적`);
  }
  
  // 6. 해결책 제시
  console.log("\n💡 6. 문제 해결책");
  
  console.log(`\n현재 문제점:`);
  console.log(`  1. 배너 수정 시 기존 이미지 파일이 삭제되지 않음`);
  console.log(`  2. 고아 파일이 static 폴더에 누적됨`);
  console.log(`  3. 저장소 용량 낭비 및 보안 위험`);
  
  console.log(`\n해결 방안:`);
  console.log(`  1. 배너 수정 API에서 기존 이미지 파일 삭제 로직 추가`);
  console.log(`  2. 배너 삭제 API에서 실제 파일 삭제 로직 추가`);
  console.log(`  3. 주기적인 고아 파일 정리 기능 구현`);
  
  console.log(`\n구현 필요 기능:`);
  console.log(`  1. updateBanner() - 기존 파일 삭제 + 새 파일 저장`);
  console.log(`  2. deleteBanner() - DB 삭제 + 파일 삭제`);
  console.log(`  3. cleanupOrphanFiles() - 주기적 정리`);
  
  // 7. 즉시 적용 가능한 임시 해결책
  console.log("\n⚡ 7. 즉시 적용 가능한 해결책");
  
  if (orphanSlideFiles.length > 0 || orphanSmallFiles.length > 0) {
    console.log(`\n고아 파일 정리 권장:`);
    console.log(`  고아 슬라이드 파일: ${orphanSlideFiles.length}개`);
    console.log(`  고아 작은 배너 파일: ${orphanSmallFiles.length}개`);
    console.log(`  총 절약 가능 용량: 예상 ${(orphanSlideFiles.length + orphanSmallFiles.length) * 0.5}MB`);
  } else {
    console.log(`\n현재 고아 파일 없음 - 시스템 정상 상태`);
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("🎯 배너 이미지 업로드 시스템 진단 완료");
  console.log("=".repeat(60));
  
  const hasIssues = orphanSlideFiles.length > 0 || orphanSmallFiles.length > 0;
  if (hasIssues) {
    console.log("❌ 이슈 발견: 파일 정리 로직 구현 필요");
  } else {
    console.log("✅ 기본 기능 정상: 파일 정리 로직 예방 구현 권장");
  }
}

// 실행
testBannerUploadSystem().catch(console.error);