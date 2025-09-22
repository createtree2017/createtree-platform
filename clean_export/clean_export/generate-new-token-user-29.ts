/**
 * 사용자 29 (테스트200)의 새로운 JWT 토큰 생성
 * pro 등급으로 업데이트된 정보로 토큰 갱신
 */

import jwt from 'jsonwebtoken';
import { db } from './db/index.js';
import { users } from './shared/schema.js';
import { eq } from 'drizzle-orm';

async function generateNewTokenForUser29() {
  console.log('\n=== 사용자 29 새 JWT 토큰 생성 ===\n');

  try {
    // 1. 사용자 29의 최신 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, 29),
      with: {
        hospital: true
      }
    });

    if (!user) {
      console.log('❌ 사용자 29를 찾을 수 없습니다');
      return;
    }

    console.log('사용자 정보 확인:');
    console.log(`  - ID: ${user.id}`);
    console.log(`  - 사용자명: ${user.username}`);
    console.log(`  - 이메일: ${user.email}`);
    console.log(`  - 회원 등급: ${user.memberType}`);
    console.log(`  - 병원 ID: ${user.hospitalId}`);
    console.log(`  - 병원명: ${user.hospital?.name}`);
    console.log(`  - 병원 활성화: ${user.hospital?.isActive}`);

    // 2. JWT 시크릿 확인
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.log('❌ JWT_SECRET 환경변수가 설정되지 않았습니다');
      return;
    }

    // 3. 새로운 JWT 토큰 생성
    const tokenPayload = {
      id: user.id,
      userId: user.id,
      email: user.email,
      memberType: user.memberType, // 이제 'pro'
      roles: []
    };

    const token = jwt.sign(tokenPayload, jwtSecret, {
      expiresIn: '6h' // 6시간 유효
    });

    console.log('\n새로운 JWT 토큰 생성 완료:');
    console.log('토큰 페이로드:', tokenPayload);
    console.log('\n새 토큰:');
    console.log(token);

    // 4. 토큰 검증
    const decoded = jwt.verify(token, jwtSecret) as any;
    console.log('\n토큰 검증 결과:');
    console.log('  - 사용자 ID:', decoded.id);
    console.log('  - 회원 등급:', decoded.memberType);
    console.log('  - 발급 시간:', new Date(decoded.iat * 1000).toLocaleString());
    console.log('  - 만료 시간:', new Date(decoded.exp * 1000).toLocaleString());

    console.log('\n=== 토큰 교체 방법 ===');
    console.log('브라우저에서 다음 단계를 수행하세요:');
    console.log('1. F12 개발자 도구 열기');
    console.log('2. Application 탭 → Cookies 선택');
    console.log('3. auth_token 쿠키 값을 위의 새 토큰으로 교체');
    console.log('4. 페이지 새로고침 (F5)');
    console.log('5. 프리미엄 서비스 접근 시도');

  } catch (error) {
    console.error('❌ 토큰 생성 오류:', error);
  }
}

// 실행
generateNewTokenForUser29().catch(console.error);