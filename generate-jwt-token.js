/**
 * 현재 로그인된 슈퍼관리자를 위한 JWT 토큰 생성 스크립트
 */
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-jwt-secret-key';

// 슈퍼관리자 사용자 정보 (서버 로그에서 확인된 정보)
const superAdminUser = {
  id: 10, // id로 통일
  userId: 10, // 하위 호환성 유지
  email: 'ct.createtree@gmail.com', // 실제 이메일로 수정 필요
  memberType: 'superadmin'
};

// JWT 토큰 생성
const jwtToken = jwt.sign(superAdminUser, JWT_SECRET, { expiresIn: '30d' });

console.log('🔑 생성된 JWT 토큰:');
console.log(jwtToken);
console.log('\n📋 브라우저 콘솔에서 실행할 명령어:');
console.log(`localStorage.setItem('auth_token', '${jwtToken}');`);
console.log('\n✅ 토큰 저장 후 슈퍼관리자 페이지를 새로고침하세요.');