import React, { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { useAuthContext } from "@/lib/AuthProvider";
import { Loader2, QrCode as QrCodeIcon, Scan, CheckCircle, Camera, X } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { formatDateForInput } from "@/lib/dateUtils";

// 회원가입 폼 검증 스키마
const registerSchema = z.object({
  username: z.string().min(3, {
    message: "사용자명은 최소 3자 이상이어야 합니다.",
  }),
  password: z.string().min(6, {
    message: "비밀번호는 최소 6자 이상이어야 합니다.",
  }),
  email: z.string().email({
    message: "유효한 이메일 주소를 입력해주세요.",
  }).optional().or(z.literal('')),
  name: z.string().min(2, {
    message: "이름은 최소 2자 이상이어야 합니다.",
  }).optional().or(z.literal('')),
  phoneNumber: z.string()
    .regex(/^[0-9]+$/, "전화번호는 숫자만 입력 가능합니다")
    .min(10, "전화번호는 10자리 이상이어야 합니다")
    .max(11, "전화번호는 11자리를 초과할 수 없습니다"),
  birthdate: z.date().optional(),
  memberType: z.enum(["free", "membership"]),
  hospitalId: z.string().optional(), // 폼에서는 문자열로 유지 (select value가 문자열)
  hospitalCode: z.string().optional(), // 신규 추가: 병원 인증코드
});

type RegisterFormValues = z.infer<typeof registerSchema>;

const RegisterForm: React.FC = () => {
  const { registerAsync, isRegisterLoading } = useAuthContext();
  const [showHospitalSelect, setShowHospitalSelect] = useState(false);
  const [isRegistrationSuccess, setIsRegistrationSuccess] = useState(false);
  const [isQRAuthenticated, setIsQRAuthenticated] = useState(false);
  const [codeVerificationStatus, setCodeVerificationStatus] = useState<{
    verified: boolean;
    message: string;
    remainingSlots?: number;
  } | null>(null);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [qrScanText, setQrScanText] = useState('');
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  // 병원 목록 가져오기
  const { data: hospitals, isLoading: isHospitalsLoading, error: hospitalsError } = useQuery({
    queryKey: ["/api/auth/public/hospitals"],
    queryFn: async () => {
      const response = await fetch("/api/auth/public/hospitals", {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error("병원 목록을 가져오는데 실패했습니다.");
      }
      return response.json();
    },
    enabled: showHospitalSelect, // 멤버십 회원 선택 시에만 요청
    staleTime: 1000 * 60 * 10, // 10분 동안 데이터 캐시
    retry: 3, // 실패 시 3번 재시도
  });

  // React Hook Form 설정
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      name: "",
      phoneNumber: "",
      memberType: "free",
      hospitalCode: "",
    },
  });

  // 회원 유형 변경 시 병원 선택 표시 여부 결정
  const memberType = form.watch("memberType");
  const selectedHospitalId = form.watch("hospitalId");
  const hospitalCode = form.watch("hospitalCode");
  
  useEffect(() => {
    setShowHospitalSelect(memberType === "membership");
    if (memberType !== "membership") {
      form.setValue("hospitalId", "");
      form.setValue("hospitalCode", "");
      setCodeVerificationStatus(null);
    }
  }, [memberType, form]);

  // QR 파라미터 자동 처리
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('type') === 'qr') {
      const hospitalId = params.get('hospital');
      const code = params.get('code');
      
      if (hospitalId && code) {
        // 폼 자동 설정
        form.setValue('memberType', 'membership');
        form.setValue('hospitalId', hospitalId);
        form.setValue('hospitalCode', code);
        
        // QR 인증 완료 표시
        setIsQRAuthenticated(true);
        setShowHospitalSelect(true);
        
        // QR 코드 자동 검증
        verifyHospitalCode(hospitalId, code);
        
        console.log('QR 코드 회원가입 모드 활성화:', { hospitalId, code });
      }
    }
  }, [form]);

  // 회원가입 성공 감지 및 자동 리디렉션
  useEffect(() => {
    if (!isRegisterLoading && isRegistrationSuccess) {
      console.log('✅ 회원가입 성공! 3초 후 메인 페이지로 이동합니다.');
      
      const timer = setTimeout(() => {
        // 페이지 이동
        window.location.href = '/';
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [isRegisterLoading, isRegistrationSuccess]);

  // 병원 코드 검증 함수
  const verifyHospitalCode = async (hospitalId: string, code: string) => {
    if (!hospitalId || !code) {
      setCodeVerificationStatus(null);
      return;
    }

    try {
      const response = await fetch('/api/auth/verify-hospital-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hospitalId, code }),
      });

      const result = await response.json();
      
      setCodeVerificationStatus({
        verified: result.valid,
        message: result.message,
        remainingSlots: result.remainingSlots
      });

    } catch (error) {
      console.error('코드 검증 오류:', error);
      setCodeVerificationStatus({
        verified: false,
        message: '코드 검증 중 오류가 발생했습니다'
      });
    }
  };

  // 병원 코드 입력 시 실시간 검증
  useEffect(() => {
    if (selectedHospitalId && hospitalCode && hospitalCode.length >= 6) {
      const debounceTimer = setTimeout(() => {
        verifyHospitalCode(selectedHospitalId, hospitalCode);
      }, 500);

      return () => clearTimeout(debounceTimer);
    } else {
      setCodeVerificationStatus(null);
    }
  }, [selectedHospitalId, hospitalCode]);

  // 회원가입 폼 제출 핸들러
  const onSubmit = async (values: RegisterFormValues) => {
    console.log('🚀 회원가입 폼 제출 시작:', values);
    console.log('🔍 코드 검증 상태:', codeVerificationStatus);
    
    // 에러 상태 초기화
    setRegistrationError(null);
    
    try {
      // 멤버십 회원인 경우 코드 검증 상태 확인
      if (values.memberType === "membership" && (!codeVerificationStatus || !codeVerificationStatus.verified)) {
        console.log('❌ 코드 검증 실패 - 회원가입 중단');
        setCodeVerificationStatus({
          verified: false,
          message: "유효한 인증코드를 입력해주세요"
        });
        return;
      }

      // 타입 문제를 해결하기 위해 날짜 객체를 문자열로 변환
      const formattedValues = {
        ...values,
        birthdate: values.birthdate ? formatDateForInput(values.birthdate) : undefined,
        // 멤버십 회원이 아닌 경우 병원 관련 필드 제거
        hospitalId: values.memberType === "membership" ? values.hospitalId : undefined,
        hospitalCode: values.memberType === "membership" ? values.hospitalCode : undefined,
      };
      
      console.log('📤 최종 전송 데이터:', formattedValues);
      
      // registerAsync 사용하여 단일 API 호출 및 에러 처리
      await registerAsync(formattedValues);
      
      console.log('✅ 회원가입 성공');
      setIsRegistrationSuccess(true);
      
    } catch (error) {
      console.error("❌ 회원가입 오류:", error);
      
      // 더 자세한 오류 정보 로그
      if (error instanceof Error) {
        console.error("오류 메시지:", error.message);
        setRegistrationError(error.message || "회원가입에 실패했습니다.");
      } else {
        setRegistrationError("회원가입 중 오류가 발생했습니다.");
      }
    }
  };

  // QR 스캔 기능 (모바일/데스크톱용 텍스트 입력)
  const handleQRScan = async () => {
    if (!qrScanText.trim()) {
      return;
    }

    try {
      const response = await fetch('/api/qr/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrData: qrScanText })
      });

      if (response.ok) {
        const result = await response.json();
        
        // 폼 자동 완성
        form.setValue('memberType', 'membership');
        form.setValue('hospitalId', result.autoFill.hospitalId.toString());
        form.setValue('hospitalCode', result.autoFill.promoCode);

        // 상태 업데이트
        setIsQRAuthenticated(true);
        setShowHospitalSelect(true);
        setCodeVerificationStatus({
          verified: true,
          message: `${result.hospital.name} 인증 완료`
        });

        setShowQRScanner(false);
        setQrScanText('');
        
      } else {
        const error = await response.json();
        setCodeVerificationStatus({
          verified: false,
          message: error.error || "QR 코드를 인식할 수 없습니다"
        });
      }
    } catch (error) {
      setCodeVerificationStatus({
        verified: false,
        message: "QR 코드 처리 중 오류가 발생했습니다"
      });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID(이메일)*</FormLabel>
              <FormControl>
                <Input 
                  type="email" 
                  placeholder="이메일 입력" 
                  {...field} 
                  disabled={isRegisterLoading}
                />
              </FormControl>
              <FormDescription>알림 및 계정 복구에 사용됩니다</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>비밀번호*</FormLabel>
              <FormControl>
                <Input 
                  type="password" 
                  placeholder="비밀번호 입력" 
                  {...field} 
                  disabled={isRegisterLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>이름*</FormLabel>
              <FormControl>
                <Input placeholder="이름 입력" {...field} disabled={isRegisterLoading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>닉네임*</FormLabel>
              <FormControl>
                <Input 
                  placeholder="닉네임 입력 (최소 3자)" 
                  {...field} 
                  disabled={isRegisterLoading} 
                />
              </FormControl>
              <FormDescription>
                다른 사용자와 중복되지 않는 고유한 닉네임을 입력해주세요
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="phoneNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>전화번호*</FormLabel>
              <FormControl>
                <Input 
                  placeholder="01012345678" 
                  {...field}
                  onChange={(e) => {
                    // 숫자만 남기고 나머지 문자 제거
                    const value = e.target.value.replace(/[^0-9]/g, '');
                    field.onChange(value);
                  }}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  disabled={isRegisterLoading} 
                />
              </FormControl>
              <FormDescription>
                숫자만 입력 가능합니다 (하이픈 없이)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="birthdate"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>생년월일</FormLabel>
              <DatePicker 
                date={field.value} 
                setDate={field.onChange}
                disabled={isRegisterLoading}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* QR 인증이 아닌 경우에만 회원 유형 선택 표시 */}
        {!isQRAuthenticated && (
          <FormField
            control={form.control}
            name="memberType"
            render={({ field }) => (
              <FormItem className="space-y-3">
                <FormLabel>회원 유형*</FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-col space-y-1"
                  >
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="free" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        일반회원
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-3 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="membership" />
                      </FormControl>
                      <FormLabel className="font-normal">
                        멤버십회원 (병원 회원)
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* QR 인증 완료 안내 (QR 접속 시에만 표시) */}
        {isQRAuthenticated && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-sm font-medium text-green-900">QR 코드 인증 완료</h3>
            </div>
            <p className="mt-1 text-sm text-green-700">
              병원 회원으로 자동 설정되었습니다. 아래 정보를 확인해주세요.
            </p>
          </div>
        )}
        
        {/* 병원 인증 섹션 */}
        {showHospitalSelect && (
          <div className="space-y-4 p-4 border border-purple-300 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 shadow-sm">
            <h3 className="text-base font-semibold text-purple-900">병원 회원 인증</h3>
            
            {/* 병원 선택 */}
            <FormField
              control={form.control}
              name="hospitalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-slate-800 font-semibold">병원 선택*</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isRegisterLoading || isHospitalsLoading || isQRAuthenticated}
                  >
                    <FormControl>
                      <SelectTrigger>
                        {isHospitalsLoading ? (
                          <div className="flex items-center space-x-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>병원 목록 로딩중...</span>
                          </div>
                        ) : (
                          <SelectValue placeholder="병원을 선택하세요" />
                        )}
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hospitalsError ? (
                        <div className="p-2 text-red-500 text-center">
                          병원 목록을 불러오지 못했습니다
                        </div>
                      ) : hospitals && hospitals.length > 0 ? (
                        hospitals.map((hospital: any) => (
                          <SelectItem key={hospital.id} value={hospital.id.toString()}>
                            {hospital.name}
                          </SelectItem>
                        ))
                      ) : !isHospitalsLoading && (
                        <div className="p-2 text-center text-gray-500">
                          등록된 병원이 없습니다
                        </div>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 인증코드 입력 및 QR 스캔 */}
            {selectedHospitalId && (
              <FormField
                control={form.control}
                name="hospitalCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center justify-between text-slate-800 font-semibold">
                      <span>인증코드*</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowQRScanner(!showQRScanner)}
                        disabled={isRegisterLoading || isQRAuthenticated}
                        className="ml-2 text-purple-700 border-purple-300 hover:bg-purple-50 hover:text-purple-800"
                      >
                        <QrCodeIcon className="h-4 w-4 mr-1" />
                        QR 스캔
                      </Button>
                    </FormLabel>
                    
                    {/* QR 스캐너 */}
                    {showQRScanner && (
                      <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/90 backdrop-blur-sm space-y-3">
                        <div className="flex items-center space-x-2 text-sm text-slate-700 font-semibold">
                          <Camera className="h-4 w-4 text-indigo-600" />
                          <span>QR 코드 데이터를 입력하세요</span>
                        </div>
                        <div className="flex space-x-2">
                          <Input
                            placeholder="QR 코드를 스캔하거나 텍스트 데이터를 입력하세요"
                            value={qrScanText}
                            onChange={(e) => setQrScanText(e.target.value)}
                            className="flex-1"
                          />
                          <Button
                            type="button"
                            onClick={handleQRScan}
                            disabled={!qrScanText.trim()}
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                          >
                            인증
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setShowQRScanner(false);
                              setQrScanText('');
                            }}
                            size="sm"
                            className="text-slate-600 border-slate-300 hover:bg-slate-50 hover:text-slate-700"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="text-xs text-slate-700 bg-indigo-50 p-2 rounded border-l-2 border-indigo-400 font-medium">
                          병원에서 제공받은 QR 코드를 스캔하거나 QR 데이터를 직접 입력하세요
                        </div>
                      </div>
                    )}

                    <FormControl>
                      <Input
                        type="text"
                        placeholder="병원에서 제공받은 인증코드를 입력하세요"
                        {...field}
                        disabled={isRegisterLoading || isQRAuthenticated}
                        className={`${
                          codeVerificationStatus?.verified === true 
                            ? 'border-green-500 bg-green-50' 
                            : codeVerificationStatus?.verified === false 
                            ? 'border-red-500 bg-red-50' 
                            : ''
                        }`}
                      />
                    </FormControl>
                    
                    {/* 코드 검증 상태 표시 */}
                    {codeVerificationStatus && (
                      <div className={`text-sm mt-1 ${
                        codeVerificationStatus.verified ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {codeVerificationStatus.verified && '✅ '}
                        {!codeVerificationStatus.verified && '❌ '}
                        {codeVerificationStatus.message}
                        {codeVerificationStatus.remainingSlots && (
                          <span className="ml-2 text-blue-600">
                            (남은 자리: {codeVerificationStatus.remainingSlots}명)
                          </span>
                        )}
                      </div>
                    )}
                    
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {isQRAuthenticated && (
              <div className="text-center p-3 bg-green-100 rounded-md">
                <span className="text-green-800 text-sm font-medium">
                  QR코드로 병원 인증이 완료되었습니다
                </span>
              </div>
            )}
          </div>
        )}

        {/* 회원가입 에러 메시지 */}
        {registrationError && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <X className="h-5 w-5 text-red-600" />
              <h3 className="text-sm font-medium text-red-900">회원가입 실패</h3>
            </div>
            <p className="mt-1 text-sm text-red-700">
              {registrationError}
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={isRegisterLoading || isRegistrationSuccess}>
          {isRegisterLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              가입 중...
            </>
          ) : isRegistrationSuccess ? (
            <>
              <CheckCircle className="mr-2 h-4 w-4" />
              가입 완료!
            </>
          ) : (
            "회원가입"
          )}
        </Button>

        {/* 회원가입 성공 메시지 */}
        {isRegistrationSuccess && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <h3 className="text-sm font-medium text-green-900">회원가입이 완료되었습니다!</h3>
            </div>
            <p className="mt-1 text-sm text-green-700">
              자동으로 로그인되어 메인 페이지로 이동합니다...
            </p>
          </div>
        )}
      </form>
    </Form>
  );
};

export default RegisterForm;