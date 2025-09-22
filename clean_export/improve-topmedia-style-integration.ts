/**
 * TopMediai 음악 스타일 통합 개선
 * 
 * music_styles 테이블의 prompt 필드를 TopMediai API에 활용하도록 수정
 */

import { db } from './db/index.js';

async function improveTopMediaStyleIntegration() {
  console.log('\n=== TopMediai 음악 스타일 통합 개선 ===\n');

  try {
    // 1. 현재 music_styles 테이블 확인
    const styles = await db.execute(`
      SELECT id, style_id, name, description, prompt, tags, is_active, "order"
      FROM music_styles 
      WHERE is_active = true 
      ORDER BY "order", id
    `);

    console.log('1. 현재 음악 스타일 데이터:');
    styles.rows.forEach((row: any) => {
      console.log(`   ${row.style_id}: ${row.name} -> "${row.prompt}"`);
    });

    // 2. TopMediai 스타일 전달 방식 개선 방안
    console.log('\n2. TopMediai 스타일 통합 개선 방안:');
    
    console.log(`
🎯 현재 문제점:
- music_styles.prompt가 TopMediai API에 활용되지 않음
- 단순 키워드(lullaby, piano)만 전달되어 스타일 정보 부족

💡 해결 방안:
Option A: 프롬프트 결합 방식
- 사용자 프롬프트 + music_styles.prompt 결합
- 예: "아기를 위한 노래" + ", " + "gentle lullaby with soft piano melody"

Option B: 스타일 힌트 추가 방식  
- 사용자 프롬프트에 스타일 힌트 자동 추가
- 예: "아기를 위한 노래 in gentle lullaby style"

Option C: 별도 스타일 필드 활용
- TopMediai API에 style과 style_prompt를 모두 전달
    `);

    // 3. 추천 솔루션 제시
    console.log('\n3. 추천 솔루션 (Option A - 프롬프트 결합):');
    
    const samplePrompt = "아기를 위한 따뜻한 노래";
    const selectedStyle = styles.rows.find((row: any) => row.style_id === 'lullaby');
    
    if (selectedStyle) {
      const enhancedPrompt = `${samplePrompt}, ${selectedStyle.prompt}`;
      console.log(`
원본 프롬프트: "${samplePrompt}"
스타일 프롬프트: "${selectedStyle.prompt}"
결합된 프롬프트: "${enhancedPrompt}"
      `);
    }

    // 4. 구현 가이드
    console.log('\n4. 구현 가이드:');
    console.log(`
📝 수정할 파일들:
1. server/services/music-engine-service.ts
   - tryEngine 메서드의 topmedia 케이스 수정
   - 스타일 프롬프트 조회 및 결합 로직 추가

2. server/services/topmedia-service.ts  
   - generateAiMusic 함수에서 스타일 프롬프트 활용

3. client/src/components/music/MusicForm.tsx
   - 스타일 선택 시 프롬프트 미리보기 기능 추가 (선택적)

🔧 핵심 로직:
async function getStylePrompt(styleId: string): Promise<string> {
  const style = await db.execute(
    'SELECT prompt FROM music_styles WHERE style_id = $1 AND is_active = true',
    [styleId]
  );
  return style.rows[0]?.prompt || '';
}

function combinePrompts(userPrompt: string, stylePrompt: string): string {
  if (!stylePrompt) return userPrompt;
  return userPrompt + ', ' + stylePrompt;
}
    `);

  } catch (error: any) {
    console.error('❌ 개선 방안 분석 중 오류:', error);
  }
}

// 실행
improveTopMediaStyleIntegration()
  .then(() => {
    console.log('\n✅ TopMediai 스타일 통합 개선 방안 분석 완료');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ 스크립트 실행 오류:', error);
    process.exit(1);
  });