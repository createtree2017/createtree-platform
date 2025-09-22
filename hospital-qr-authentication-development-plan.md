# 병원 멤버십 QR 인증 시스템 개발 계획서

## 📋 프로젝트 개요

**프로젝트명**: 병원 회원 QR 인증 시스템 v2.0  
**목표**: 병원코드 + QR코드 이중 인증으로 멤버십 회원 가입 보안성 및 편의성 극대화  
**예상 기간**: 3-4일 (22-30시간)  
**난이도**: ⭐⭐⭐☆☆ (중급)  

## 🎯 핵심 기능

### 1. 병원 인증코드 시스템
- **마스터 코드**: 무제한 사용 가능 (병원 전체 공통)
- **개별 코드**: 사용 인원 제한 (특정 이벤트/프로그램용)
- **실시간 코드 검증**: 만료일, 사용 한도 자동 체크

### 2. QR코드 자동 인증 시스템
- **QR 스캔 → 자동 가입**: 병원 + 인증코드 자동 입력
- **인원 제어**: QR별 가입 인원 무제한/제한 설정 가능
- **실시간 모니터링**: 현재 가입자 수 / 최대 인원 실시간 표시

### 3. 관리자 제어 시스템
- **QR코드 생성**: 병원별 맞춤 QR코드 생성 및 다운로드
- **인원 관리**: 실시간 가입 현황 모니터링
- **유연한 설정**: 무제한/제한 인원, 만료일 설정

## 🏗️ 시스템 아키텍처

### 데이터베이스 설계
```sql
-- 병원 인증 코드 테이블 (신규)
CREATE TABLE hospital_codes (
  id SERIAL PRIMARY KEY,
  hospitalId INTEGER REFERENCES hospitals(id),
  code VARCHAR(20) UNIQUE NOT NULL,
  codeType ENUM('master', 'limited', 'qr_unlimited', 'qr_limited'),
  
  -- 인원 제어
  maxUsage INTEGER NULL,           -- 최대 사용 가능 인원
  currentUsage INTEGER DEFAULT 0,  -- 현재 사용된 인원
  
  -- QR 전용 설정
  isQREnabled BOOLEAN DEFAULT false,
  qrDescription VARCHAR(100),      -- QR 설명
  
  -- 상태 관리
  isActive BOOLEAN DEFAULT true,
  expiresAt TIMESTAMP NULL,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW()
);

-- 인덱스 최적화
CREATE INDEX idx_hospital_codes_code ON hospital_codes(code);
CREATE INDEX idx_hospital_codes_hospital ON hospital_codes(hospitalId);
```

### API 엔드포인트 설계
```typescript
// 코드 검증
POST /api/auth/verify-hospital-code
Body: { hospitalId: number, code: string }
Response: { valid: boolean, message: string, remainingSlots?: number }

// QR코드 생성
GET /api/qr/hospital/:hospitalId/:codeId
Response: QR코드 이미지 (PNG/SVG)

// 관리자 코드 관리
GET /api/admin/hospital-codes        // 코드 목록
POST /api/admin/hospital-codes       // 코드 생성
PUT /api/admin/hospital-codes/:id    // 코드 수정
DELETE /api/admin/hospital-codes/:id // 코드 삭제
```

## 📱 사용자 플로우

### 일반 회원가입 플로우
```
1. 회원가입 페이지 접속
2. "멤버십 회원" 선택
3. 병원 선택 (드롭다운)
4. 인증코드 입력 필드 표시
5. 코드 입력 → 실시간 검증
6. 유효한 코드 확인 시 개인정보 입력
7. 회원가입 완료
```

### QR코드 회원가입 플로우
```
1. 병원 QR코드 스캔
2. 자동으로 회원가입 페이지 이동
   - 병원: 자동 선택 완료
   - 코드: 자동 입력 완료
   - 회원타입: "멤버십" 자동 선택
3. "✅ 인증 완료" 표시
4. 개인정보만 입력
5. 회원가입 완료
```

## 🔧 개발 단계별 계획

### Phase 1: 백엔드 기반 구축 (8-10시간)

**Step 1.1: 데이터베이스 스키마 생성**
- hospital_codes 테이블 생성
- 기존 users.promoCode 필드 활용
- 인덱스 최적화 적용

**Step 1.2: 코드 검증 API 구현**
```typescript
async function verifyHospitalCode(hospitalId: number, code: string) {
  // 1. 코드 존재 및 활성 상태 확인
  // 2. 만료일 체크
  // 3. 인원 제한 체크 (limited/qr_limited 타입)
  // 4. 동시성 제어로 정확한 카운팅
  // 5. 사용 횟수 업데이트
  return { 
    valid: boolean, 
    message: string, 
    remainingSlots?: number,
    codeType: string 
  }
}
```

**Step 1.3: 관리자 코드 관리 API**
- 코드 생성 (4가지 타입 지원)
- 코드 목록 조회 및 사용 통계
- 코드 활성화/비활성화
- 실시간 사용 현황 조회

### Phase 2: 프론트엔드 회원가입 수정 (4-6시간)

**Step 2.1: 회원가입 폼 확장**
```typescript
// RegisterForm.tsx 스키마 확장
const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  email: z.string().email().optional(),
  phoneNumber: z.string().min(10),
  memberType: z.enum(["free", "membership"]),
  hospitalId: z.string().optional(),
  hospitalCode: z.string().optional(), // 신규 추가
});
```

**Step 2.2: 조건부 UI 구현**
- memberType "membership" 선택 시 병원 관련 필드 표시
- 병원 선택 후 인증코드 입력 필드 표시
- 실시간 코드 검증 및 피드백
- 인원 제한 코드의 경우 남은 자리 수 표시

**Step 2.3: QR 파라미터 자동 처리**
```typescript
// URL 파라미터 감지 및 자동 설정
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('type') === 'qr') {
    const hospitalId = params.get('hospital');
    const code = params.get('code');
    
    // 폼 자동 설정
    form.setValue('memberType', 'membership');
    form.setValue('hospitalId', hospitalId);
    form.setValue('hospitalCode', code);
    
    // QR 인증 완료 표시
    setIsQRAuthenticated(true);
  }
}, []);
```

### Phase 3: QR코드 시스템 구현 (6-8시간)

**Step 3.1: QR 라이브러리 설치 및 설정**
```bash
npm install qrcode @types/qrcode
npm install html2canvas jspdf  # PDF 다운로드용
```

**Step 3.2: QR코드 생성 컴포넌트**
```typescript
// QRCodeGenerator.tsx
interface QRCodeProps {
  hospitalId: number;
  codeId: number;
  description: string;
}

const QRCodeGenerator: React.FC<QRCodeProps> = ({ hospitalId, codeId, description }) => {
  const generateQRData = () => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup?hospital=${hospitalId}&code=${codeId}&type=qr`;
  };

  return (
    <div className="qr-container">
      <QRCode value={generateQRData()} size={256} />
      <p>{description}</p>
      <Button onClick={downloadQR}>다운로드</Button>
    </div>
  );
};
```

**Step 3.3: QR 다운로드 기능**
- PNG 이미지 다운로드
- PDF 포맷 (병원 정보 + QR코드)
- 프린트 최적화 템플릿

### Phase 4: 관리자 도구 개발 (6-8시간)

**Step 4.1: 코드 생성 인터페이스**
```typescript
// 코드 생성 폼
interface CodeCreationForm {
  hospitalId: number;
  codeType: 'master' | 'limited' | 'qr_unlimited' | 'qr_limited';
  maxUsage?: number;        // limited/qr_limited일 때만
  qrDescription?: string;   // QR 타입일 때만
  expiresAt?: Date;        // 선택사항
}
```

**Step 4.2: 실시간 모니터링 대시보드**
```typescript
// 병원별 코드 현황 표시
interface CodeStats {
  id: number;
  code: string;
  type: string;
  description?: string;
  currentUsage: number;
  maxUsage?: number;
  usagePercentage: number;
  isActive: boolean;
  expiresAt?: Date;
}
```

**Step 4.3: QR코드 관리 페이지**
- 생성된 QR코드 목록
- 각 QR의 사용 통계
- QR코드 활성화/비활성화
- 일괄 다운로드 기능

### Phase 5: 테스트 및 배포 (2-3시간)

**Step 5.1: 기능 테스트**
- 마스터 코드 무제한 사용 테스트
- 제한 코드 인원 한도 테스트
- QR코드 스캔 플로우 테스트
- 동시 가입자 처리 테스트

**Step 5.2: 성능 및 보안 테스트**
- 코드 브루트포스 방지 테스트
- 동시성 제어 정확성 검증
- QR코드 URL 보안 검증

## 🛡️ 보안 및 안전성

### 보안 강화 방안
- **코드 복잡도**: 최소 8자리, 대소문자+숫자 조합
- **브루트포스 방지**: 5회 실패 시 IP별 임시 차단
- **동시성 제어**: 인원 카운팅 정확성 보장
- **URL 검증**: QR 파라미터 변조 방지

### 데이터 무결성
- **트랜잭션 처리**: 코드 사용 시 원자성 보장
- **실시간 검증**: 만료/비활성 코드 즉시 차단
- **정합성 체크**: 주기적 사용 카운트 검증

## 📊 예상 성과

### 사용자 경험 개선
- **가입 완료율 향상**: 15-20% 증가 예상
- **QR 사용률**: 전체 멤버십 가입의 60-70% 예상
- **입력 오류 감소**: 90% 이상 감소
- **가입 소요시간**: 3분 → 30초로 단축

### 관리 효율성
- **병원 직원 안내시간**: 80% 단축
- **코드 관리 자동화**: 수동 작업 50% 감소
- **실시간 현황 파악**: 즉시 인원 현황 확인 가능

## 🎯 성공 지표

### 기술적 지표
- QR코드 스캔 성공률: 95% 이상
- 코드 검증 응답시간: 200ms 이하
- 동시 접속 처리: 100명 이상

### 비즈니스 지표
- 멤버십 회원 가입률 증가
- 병원별 QR 활용도
- 사용자 만족도 점수

---

**문서 작성일**: 2025-06-25  
**최종 업데이트**: 2025-06-25  
**담당자**: AI 우리병원 문화센터 개발팀