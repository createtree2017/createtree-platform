/**
 * TopMediai 가사 생성 시스템 완전 테스트
 * 새로 구축된 가사 추출 기능 검증
 */

import { generateLyricsOnly } from "../../server/services/topmedia-lyrics-service";

async function testTopMediaiLyricsSystem() {
  console.log("🎵 TopMediai 가사 생성 시스템 테스트 시작");
  
  try {
    // 1. 기본 자장가 가사 테스트
    console.log("\n1️⃣ 기본 자장가 가사 생성 테스트");
    const basicLyrics = await generateLyricsOnly("사랑하는 아기를 위한 따뜻한 자장가");
    console.log("생성된 가사:", basicLyrics);
    
    // 2. 특별한 태교 음악 가사 테스트  
    console.log("\n2️⃣ 태교 음악 가사 생성 테스트");
    const prenatalLyrics = await generateLyricsOnly("태아와 엄마를 위한 평화로운 태교 음악");
    console.log("생성된 가사:", prenatalLyrics);
    
    // 3. 개인화된 가사 테스트 (아기 이름 포함)
    console.log("\n3️⃣ 개인화된 가사 테스트");
    const personalizedLyrics = await generateLyricsOnly("우리 아기 민준이를 위한 특별한 자장가");
    console.log("생성된 가사:", personalizedLyrics);
    
    console.log("\n✅ TopMediai 가사 시스템 테스트 완료!");
    
  } catch (error) {
    console.error("❌ 가사 생성 테스트 실패:", error);
  }
}

// 실행
testTopMediaiLyricsSystem();