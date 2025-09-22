/**
 * 실시간 권한 미들웨어 테스트
 * 현재 로그인된 사용자(테스트200)로 실제 API 호출하여 권한 체크 과정 확인
 */

import fetch from 'node-fetch';

async function testPermissionMiddlewareLive() {
  console.log('\n=== 실시간 권한 미들웨어 테스트 ===\n');

  try {
    // 1. 현재 로그인된 사용자 정보 확인
    console.log('1. 현재 로그인 상태 확인:');
    
    const authResponse = await fetch('http://localhost:5000/api/auth/me', {
      method: 'GET',
      headers: {
        'Cookie': 'auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjksInVzZXJJZCI6MjksImVtYWlsIjoidGVzdDIwMEBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoibWVtYmVyc2hpcCIsInJvbGVzIjpbXSwiaWF0IjoxNzUwNjQ3MTk3LCJleHAiOjE3NTA2Njg3OTd9.2M9r56WmlAj6KbHYEftRxXDhghcUBD65ZVd10q1BoNo'
      }
    });

    if (authResponse.ok) {
      const authData = await authResponse.json();
      console.log('   - 인증 상태: 성공');
      console.log(`   - 사용자 ID: ${authData.user.id}`);
      console.log(`   - 회원 등급: ${authData.user.memberType}`);
      console.log(`   - 병원 ID: ${authData.user.hospitalId}`);
      
      if (authData.user.hospital) {
        console.log(`   - 병원명: ${authData.user.hospital.name}`);
        console.log(`   - 병원 활성화: ${authData.user.hospital.isActive}`);
      }
    } else {
      console.log('   - 인증 상태: 실패');
      return;
    }

    console.log('\n2. 프리미엄 서비스 API 테스트:');

    // 2. 이미지 생성 API 테스트 (권한 미들웨어 적용됨)
    console.log('\n   a) 이미지 생성 API 테스트 (POST /api/generate-image):');
    
    const imageFormData = new FormData();
    imageFormData.append('style', 'test-style');
    
    // 가짜 이미지 파일 생성
    const fakeImageBuffer = Buffer.from('fake-image-data');
    const blob = new Blob([fakeImageBuffer], { type: 'image/jpeg' });
    imageFormData.append('image', blob, 'test.jpg');

    try {
      const imageResponse = await fetch('http://localhost:5000/api/generate-image', {
        method: 'POST',
        headers: {
          'Cookie': 'auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjksInVzZXJJZCI6MjksImVtYWlsIjoidGVzdDIwMEBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoibWVtYmVyc2hpcCIsInJvbGVzIjpbXSwiaWF0IjoxNzUwNjQ3MTk3LCJleHAiOjE3NTA2Njg3OTd9.2M9r56WmlAj6KbHYEftRxXDhghcUBD65ZVd10q1BoNo'
        },
        body: imageFormData
      });

      console.log(`     - 응답 상태: ${imageResponse.status} ${imageResponse.statusText}`);
      
      if (imageResponse.status === 403) {
        const errorData = await imageResponse.json();
        console.log('     ✅ 403 Forbidden - 권한 미들웨어 정상 작동');
        console.log(`     - 에러 메시지: ${errorData.message}`);
        console.log(`     - 세부 정보: ${JSON.stringify(errorData.details, null, 2)}`);
      } else if (imageResponse.status === 200 || imageResponse.status === 201) {
        console.log('     ❌ 200/201 Success - 권한 미들웨어 우회됨!');
        const responseData = await imageResponse.json();
        console.log(`     - 응답: ${JSON.stringify(responseData, null, 2)}`);
      } else {
        const errorData = await imageResponse.json();
        console.log(`     - 기타 응답: ${JSON.stringify(errorData, null, 2)}`);
      }
    } catch (error) {
      console.log(`     - 요청 오류: ${error.message}`);
    }

    // 3. 음악 생성 API 테스트
    console.log('\n   b) 음악 생성 API 테스트 (POST /api/music-engine/generate):');
    
    try {
      const musicResponse = await fetch('http://localhost:5000/api/music-engine/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjksInVzZXJJZCI6MjksImVtYWlsIjoidGVzdDIwMEBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoibWVtYmVyc2hpcCIsInJvbGVzIjpbXSwiaWF0IjoxNzUwNjQ3MTk3LCJleHAiOjE3NTA2Njg3OTd9.2M9r56WmlAj6KbHYEftRxXDhghcUBD65ZVd10q1BoNo'
        },
        body: JSON.stringify({
          prompt: '테스트 음악',
          title: '권한 테스트'
        })
      });

      console.log(`     - 응답 상태: ${musicResponse.status} ${musicResponse.statusText}`);
      
      if (musicResponse.status === 403) {
        const errorData = await musicResponse.json();
        console.log('     ✅ 403 Forbidden - 권한 미들웨어 정상 작동');
        console.log(`     - 에러 메시지: ${errorData.message}`);
      } else if (musicResponse.status === 200 || musicResponse.status === 201) {
        console.log('     ❌ 200/201 Success - 권한 미들웨어 우회됨!');
        const responseData = await musicResponse.json();
        console.log(`     - 응답: ${JSON.stringify(responseData, null, 2)}`);
      } else {
        const errorData = await musicResponse.json();
        console.log(`     - 기타 응답: ${JSON.stringify(errorData, null, 2)}`);
      }
    } catch (error) {
      console.log(`     - 요청 오류: ${error.message}`);
    }

    // 4. 권한 테스트 API 호출
    console.log('\n   c) 권한 테스트 API (POST /api/test-permissions):');
    
    try {
      const permissionTestResponse = await fetch('http://localhost:5000/api/test-permissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': 'auth_token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjksInVzZXJJZCI6MjksImVtYWlsIjoidGVzdDIwMEBnbWFpbC5jb20iLCJtZW1iZXJUeXBlIjoibWVtYmVyc2hpcCIsInJvbGVzIjpbXSwiaWF0IjoxNzUwNjQ3MTk3LCJleHAiOjE3NTA2Njg3OTd9.2M9r56WmlAj6KbHYEftRxXDhghcUBD65ZVd10q1BoNo'
        },
        body: JSON.stringify({})
      });

      console.log(`     - 응답 상태: ${permissionTestResponse.status} ${permissionTestResponse.statusText}`);
      
      if (permissionTestResponse.status === 403) {
        const errorData = await permissionTestResponse.json();
        console.log('     ✅ 403 Forbidden - 권한 미들웨어 정상 작동');
        console.log(`     - 에러 메시지: ${errorData.message}`);
      } else if (permissionTestResponse.status === 200) {
        console.log('     ❌ 200 Success - 권한 미들웨어 우회됨!');
        const responseData = await permissionTestResponse.json();
        console.log(`     - 응답: ${JSON.stringify(responseData, null, 2)}`);
      } else {
        const errorData = await permissionTestResponse.json();
        console.log(`     - 기타 응답: ${JSON.stringify(errorData, null, 2)}`);
      }
    } catch (error) {
      console.log(`     - 요청 오류: ${error.message}`);
    }

    console.log('\n3. 테스트 결과 요약:');
    console.log('   예상: 모든 프리미엄 API에서 403 Forbidden');
    console.log('   이유: membership 회원이 비활성화된 병원 소속');
    console.log('   만약 200/201 응답이 나온다면 권한 미들웨어가 우회되고 있음');

  } catch (error) {
    console.error('테스트 중 오류:', error);
  }
}

// 실행
testPermissionMiddlewareLive().catch(console.error);