/**
 * QR 코드 회원가입 테스트 스크립트
 * 실제 QR 코드를 생성하고 회원가입 플로우를 테스트
 */

async function testQRRegistration() {
  console.log('🔍 QR 코드 회원가입 테스트 시작');
  
  try {
    // 1. 병원 코드 조회
    const codesResponse = await fetch('/api/admin/hospital-codes', {
      credentials: 'include'
    });
    
    if (!codesResponse.ok) {
      console.log('❌ 관리자 인증이 필요합니다. 브라우저에서 관리자 로그인 후 다시 시도하세요.');
      return;
    }
    
    const codes = await codesResponse.json();
    const qrEnabledCode = codes.find((code: any) => code.isQREnabled);
    
    if (!qrEnabledCode) {
      console.log('❌ QR 활성화된 병원 코드가 없습니다.');
      return;
    }
    
    console.log('✅ QR 활성화 코드 발견:', {
      code: qrEnabledCode.code,
      hospital: qrEnabledCode.hospitalName,
      hospitalId: qrEnabledCode.hospitalId
    });
    
    // 2. QR 코드 URL 생성
    const baseUrl = window.location.origin;
    const qrUrl = `${baseUrl}/signup?type=qr&hospital=${qrEnabledCode.hospitalId}&code=${qrEnabledCode.code}`;
    
    console.log('🔗 QR 코드 URL:', qrUrl);
    
    // 3. QR 코드 이미지 생성 테스트
    const qrResponse = await fetch(`/api/admin/hospital-codes/${qrEnabledCode.id}/qr-code`, {
      credentials: 'include'
    });
    
    if (qrResponse.ok) {
      console.log('✅ QR 코드 이미지 생성 성공');
    } else {
      console.log('❌ QR 코드 이미지 생성 실패');
    }
    
    // 4. 회원가입 폼 테스트 (시뮬레이션)
    console.log('\n📋 회원가입 테스트 데이터:');
    const testUser = {
      username: `qrtest_${Date.now()}`,
      password: 'test123456',
      name: 'QR테스트사용자',
      phoneNumber: '01012345678',
      memberType: 'membership',
      hospitalId: qrEnabledCode.hospitalId.toString(),
      hospitalCode: qrEnabledCode.code
    };
    
    console.log('사용자 데이터:', testUser);
    
    // 5. 실제 회원가입 API 호출
    const registerResponse = await fetch('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testUser),
      credentials: 'include'
    });
    
    const registerResult = await registerResponse.json();
    
    if (registerResponse.ok) {
      console.log('✅ QR 코드 회원가입 성공!');
      console.log('등록된 사용자:', registerResult);
    } else {
      console.log('❌ 회원가입 실패:', registerResult.message);
    }
    
    // 6. 브라우저 테스트 링크 제공
    console.log('\n🌐 브라우저 테스트:');
    console.log('다음 링크를 새 탭에서 열어 QR 코드 회원가입 UI를 확인하세요:');
    console.log(qrUrl);
    
  } catch (error) {
    console.error('❌ 테스트 실행 오류:', error);
  }
}

// 브라우저 환경에서 실행
if (typeof window !== 'undefined') {
  testQRRegistration();
}

export { testQRRegistration };