/**
 * 음악 스타일 API 테스트 스크립트
 */

async function testMusicStylesAPI() {
  console.log('🎵 음악 스타일 API 테스트 시작');
  
  try {
    // 1. 직접 데이터베이스에서 음악 스타일 조회
    const { db } = await import('../../db/index');
    console.log('✅ 데이터베이스 연결 성공');
    
    const result = await db.execute(`
      SELECT style_id as id, name, description
      FROM music_styles 
      WHERE is_active = true 
      ORDER BY "order", id
    `);
    
    console.log('🎼 데이터베이스에서 조회된 음악 스타일:');
    console.log(JSON.stringify(result.rows, null, 2));
    
    // 2. TopMediai 서비스 함수 테스트
    const { getAvailableMusicStyles } = await import('../../server/services/topmedia-service');
    console.log('🔧 TopMediai 서비스 함수 테스트');
    
    const styles = await getAvailableMusicStyles();
    console.log('🎵 getAvailableMusicStyles() 결과:');
    console.log(JSON.stringify(styles, null, 2));
    
    // 3. HTTP 요청 테스트
    console.log('🌐 HTTP API 테스트');
    const response = await fetch('http://localhost:5173/api/music-styles');
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API 응답 성공:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log('❌ API 응답 실패:', response.status, response.statusText);
      const text = await response.text();
      console.log('응답 내용:', text);
    }
    
  } catch (error) {
    console.error('❌ 테스트 실패:', error);
  }
}

// 실행
testMusicStylesAPI();