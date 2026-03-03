import 'dotenv/config';

async function testGeminiKey() {
  const apiKey = process.env.GEMINI_API_KEY;
  
  console.log('🔑 API 키 존재 여부:', apiKey ? '✅ 존재함' : '❌ 없음');
  console.log('🔑 API 키 길이:', apiKey?.length || 0);
  console.log('🔑 API 키 시작:', apiKey?.substring(0, 10) + '...');
  
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY가 설정되지 않았습니다.');
    process.exit(1);
  }
  
  // 간단한 텍스트 생성 테스트 - gemini-2.5-flash-image-preview 모델 사용
  const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image-preview:generateContent?key=${apiKey}`;
  
  try {
    console.log('\n📡 Gemini 2.5 Flash Image Preview API 테스트 중...');
    
    const response = await fetch(testUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: "Say 'API key is working!'"
          }]
        }]
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ API 호출 실패:', response.status, response.statusText);
      console.error('오류 상세:', errorText);
      
      // 에러 메시지 분석
      if (errorText.includes('PERMISSION_DENIED') || errorText.includes('leaked')) {
        console.error('\n⚠️  API 키가 유출로 감지되어 차단되었습니다!');
        console.error('⚠️  새로운 Google Cloud 프로젝트에서 새 API 키를 발급받아야 합니다.');
        console.error('⚠️  https://aistudio.google.com/app/apikey');
      }
      
      process.exit(1);
    }
    
    const data = await response.json();
    console.log('✅ API 호출 성공!');
    console.log('📨 응답:', JSON.stringify(data, null, 2).substring(0, 200) + '...');
    console.log('\n✅ Gemini API 키가 정상적으로 작동합니다!');
    
  } catch (error: any) {
    console.error('❌ 테스트 실패:', error.message);
    process.exit(1);
  }
}

testGeminiKey();
