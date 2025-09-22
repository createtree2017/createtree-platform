/**
 * TopMediai 음악 스타일 전달 방식 확인
 * 
 * 이 스크립트는 다음을 확인합니다:
 * 1. 현재 music_styles 테이블의 데이터
 * 2. TopMediai API로 스타일이 어떤 형태로 전달되는지
 * 3. 프롬프트 vs 단순 키워드 전달 방식
 */

import { db } from './db/index.js';
import { eq } from 'drizzle-orm';

async function analyzeMusicStyleTransfer() {
  console.log('\n=== TopMediai 음악 스타일 전달 방식 분석 ===\n');

  try {
    // 1. 현재 music_styles 테이블 확인
    console.log('1. 현재 music_styles 테이블 데이터:');
    
    const result = await db.execute(`
      SELECT id, style_id, name, description, prompt, tags, is_active, "order"
      FROM music_styles 
      WHERE is_active = true 
      ORDER BY "order", id
    `);

    if (result.rows.length === 0) {
      console.log('❌ music_styles 테이블에 데이터가 없습니다.');
      return;
    }

    result.rows.forEach((row: any) => {
      console.log(`\n📝 스타일 ID: ${row.style_id}`);
      console.log(`   이름: ${row.name}`);
      console.log(`   설명: ${row.description}`);
      console.log(`   프롬프트: ${row.prompt}`);
      console.log(`   태그: ${row.tags}`);
      console.log(`   순서: ${row.order}`);
    });

    // 2. TopMediai API 전달 방식 분석
    console.log('\n2. TopMediai API 스타일 전달 방식 분석:');
    
    // music-engine-service.ts에서 suno와 topmedia 차이점 확인
    console.log(`
📋 코드 분석 결과:

1. Suno API 방식:
   - tags: request.style (단순 키워드)
   - 예: tags: "lullaby"

2. TopMediai API 방식:
   - style: request.style || 'lullaby' (단순 키워드)
   - prompt: request.prompt (사용자 입력 프롬프트)
   
3. 현재 구현에서 music_styles 테이블의 prompt 필드는:
   - TopMediai API에 직접 전달되지 않음
   - 프롬프트는 사용자가 입력한 내용이 사용됨
   - style 필드는 단순 키워드로 전달됨
    `);

    // 3. 개선 방안 제시
    console.log('\n3. 개선 방안:');
    console.log(`
💡 TopMediai 스타일 전달 방식을 개선하려면:

Option A: 단순 키워드 방식 유지
- music_styles.style_id를 TopMediai에 전달
- 예: "lullaby", "piano", "acoustic"

Option B: 프롬프트 방식으로 변경
- music_styles.prompt를 사용자 프롬프트와 결합
- 예: 사용자 프롬프트 + ", " + music_styles.prompt
- "아기를 위한 노래, gentle lullaby with soft piano melody"

Option C: 하이브리드 방식
- style로 키워드 전달하고 prompt에 스타일 힌트 추가
- style: "lullaby"
- prompt: 사용자입력 + " in gentle lullaby style"
    `);

    // 4. 현재 TopMediai 실제 API 호출 확인
    console.log('\n4. 실제 TopMediai API 호출 분석:');
    
    const sampleRequest = {
      prompt: "아기를 위한 따뜻한 노래",
      style: "lullaby",
      duration: 180,
      userId: "10",
      babyName: "테스트아기",
      generateLyrics: true,
      instrumental: false,
      gender: "female",
      title: "테스트 음악"
    };

    console.log('샘플 요청 데이터:');
    console.log(JSON.stringify(sampleRequest, null, 2));

  } catch (error: any) {
    console.error('❌ 분석 중 오류 발생:', error);
  }
}

// 실행
analyzeMusicStyleTransfer()
  .then(() => {
    console.log('\n✅ TopMediai 스타일 전달 방식 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });