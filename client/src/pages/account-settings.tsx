import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, User, Lock, Bell, Shield, Mail, Settings, Download } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { getMemberTypeLabel, getMemberTypeBadgeColor } from "@/lib/auth-utils";

// 폼 스키마 정의
const profileSchema = z.object({
  fullName: z.string().min(2, "이름은 2글자 이상이어야 합니다"),
  email: z.string().email("유효한 이메일을 입력해주세요"),
  phoneNumber: z.string().optional(),
  dueDate: z.string().optional(),
  birthdate: z.string().optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "현재 비밀번호를 입력해주세요"),
  newPassword: z.string().min(6, "새 비밀번호는 6글자 이상이어야 합니다"),
  confirmPassword: z.string().min(1, "비밀번호 확인을 입력해주세요"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "비밀번호가 일치하지 않습니다",
  path: ["confirmPassword"],
});

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

export default function AccountSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 사용자 정보 조회 (별도 캐시 키 사용하여 useAuth 캐시 오염 방지)
  const { data: authResponse, isLoading } = useQuery({
    queryKey: ["/api/account/auth-check"],  // 다른 키 사용!
    queryFn: async () => {
      const response = await apiRequest("/api/auth/me");
      return response.json();
    },
  });
  const user = authResponse?.user || authResponse;

  // 알림 설정 조회
  const { data: notificationData } = useQuery({
    queryKey: ["/api/notification-settings"],
    queryFn: async () => {
      const response = await apiRequest("/api/notification-settings");
      return response.json();
    },
    enabled: !!user,
  });

  // 사용자 설정 조회
  const { data: userSettingsData } = useQuery({
    queryKey: ["/api/user-settings"],
    queryFn: async () => {
      const response = await apiRequest("/api/user-settings");
      return response.json();
    },
    enabled: !!user,
  });

  // 알림 설정 상태
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    pregnancyReminders: true,
    weeklyUpdates: true,
    promotionalEmails: false,
  });

  // 사용자 설정 상태
  const [userSettings, setUserSettings] = useState({
    theme: "light",
    language: "ko",
    timezone: "Asia/Seoul",
    dateFormat: "YYYY-MM-DD",
    autoSave: true,
    showTutorials: true,
  });

  // 프로필 폼
  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
      phoneNumber: user?.phoneNumber || "",
      dueDate: user?.dueDate ? new Date(user.dueDate).toISOString().split('T')[0] : "",
      birthdate: user?.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : "",
    },
  });

  // 비밀번호 폼
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // 프로필 업데이트 뮤테이션
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await apiRequest("/api/auth/profile", {
        method: "PUT",
        data: data,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "프로필이 업데이트되었습니다",
        description: "변경사항이 성공적으로 저장되었습니다.",
      });
      
      // ✅ 캐시 무효화만 수행 (setQueryData 제거로 캐시 오염 방지)
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/auth-check"] });
    },
    onError: (error: any) => {
      toast({
        title: "프로필 업데이트 실패",
        description: error.message || "오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 비밀번호 변경 뮤테이션
  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordFormData) =>
      apiRequest("/api/auth/change-password", {
        method: "PUT",
        data: data,
      }),
    onSuccess: () => {
      toast({
        title: "비밀번호가 변경되었습니다",
        description: "새 비밀번호로 다시 로그인해주세요.",
      });
      passwordForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "비밀번호 변경 실패",
        description: error.message || "오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 폼 제출 핸들러
  const handleProfileSubmit = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const handlePasswordSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  // 알림 설정 업데이트 뮤테이션
  const updateNotificationMutation = useMutation({
    mutationFn: (settings: typeof notificationSettings) =>
      apiRequest("/api/notification-settings", {
        method: "PUT",
        data: settings,
      }),
    onSuccess: () => {
      toast({
        title: "알림 설정이 저장되었습니다",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notification-settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "알림 설정 저장 실패",
        description: error.message || "오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 사용자 설정 업데이트 뮤테이션
  const updateUserSettingsMutation = useMutation({
    mutationFn: (settings: typeof userSettings) =>
      apiRequest("/api/user-settings", {
        method: "PUT",
        data: settings,
      }),
    onSuccess: () => {
      toast({
        title: "설정이 저장되었습니다",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-settings"] });
    },
    onError: (error: any) => {
      toast({
        title: "설정 저장 실패",
        description: error.message || "오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 이메일 인증 발송 뮤테이션
  const sendVerificationMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/auth/send-verification-email", {
        method: "POST",
      }),
    onSuccess: () => {
      toast({
        title: "인증 이메일이 발송되었습니다",
        description: "이메일을 확인해주세요.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "이메일 발송 실패",
        description: error.message || "오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  // 백엔드에서 로드된 알림 설정으로 초기화
  useEffect(() => {
    if (notificationData?.success && notificationData.settings) {
      setNotificationSettings({
        emailNotifications: notificationData.settings.emailNotifications,
        pushNotifications: notificationData.settings.pushNotifications,
        pregnancyReminders: notificationData.settings.pregnancyReminders,
        weeklyUpdates: notificationData.settings.weeklyUpdates,
        promotionalEmails: notificationData.settings.promotionalEmails,
      });
    }
  }, [notificationData]);

  // 백엔드에서 로드된 사용자 설정으로 초기화
  useEffect(() => {
    if (userSettingsData?.success && userSettingsData.settings) {
      setUserSettings({
        theme: userSettingsData.settings.theme,
        language: userSettingsData.settings.language,
        timezone: userSettingsData.settings.timezone,
        dateFormat: userSettingsData.settings.dateFormat,
        autoSave: userSettingsData.settings.autoSave,
        showTutorials: userSettingsData.settings.showTutorials,
      });
    }
  }, [userSettingsData]);

  // 알림 설정 변경 핸들러
  const handleNotificationChange = (key: keyof typeof notificationSettings, value: boolean) => {
    const newSettings = { ...notificationSettings, [key]: value };
    setNotificationSettings(newSettings);
    updateNotificationMutation.mutate(newSettings);
  };

  // 사용자 설정 변경 핸들러
  const handleUserSettingChange = (key: keyof typeof userSettings, value: string | boolean) => {
    const newSettings = { ...userSettings, [key]: value };
    setUserSettings(newSettings);
    updateUserSettingsMutation.mutate(newSettings);
  };

  // 사용자 데이터가 로드되면 폼 기본값 업데이트 (useEffect로 이동하여 렌더링 중 상태 업데이트 방지)
  useEffect(() => {
    if (user && !profileForm.getValues("fullName")) {
      profileForm.reset({
        fullName: user.fullName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        dueDate: user.dueDate ? new Date(user.dueDate).toISOString().split('T')[0] : "",
        birthdate: user.birthdate ? new Date(user.birthdate).toISOString().split('T')[0] : "",
      });
    }
  }, [user, profileForm]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      <div className="container mx-auto px-4 py-6">
        {/* 헤더 */}
        <div className="flex items-center gap-4 mb-6">
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              돌아가기
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">계정 설정</h1>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="max-w-4xl mx-auto">
          <Tabs defaultValue="profile" className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="profile" className="gap-2">
                <User className="w-4 h-4" />
                프로필
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <Lock className="w-4 h-4" />
                보안
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2">
                <Bell className="w-4 h-4" />
                알림
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2">
                <Mail className="w-4 h-4" />
                이메일
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="w-4 h-4" />
                설정
              </TabsTrigger>
            </TabsList>

            {/* 프로필 탭 */}
            <TabsContent value="profile" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>기본 정보</CardTitle>
                  <CardDescription>
                    개인정보와 연락처 정보를 관리할 수 있습니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={profileForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>이름</FormLabel>
                              <FormControl>
                                <Input placeholder="이름을 입력하세요" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>이메일</FormLabel>
                              <FormControl>
                                <Input type="email" placeholder="이메일을 입력하세요" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="phoneNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>전화번호</FormLabel>
                              <FormControl>
                                <Input placeholder="전화번호를 입력하세요" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="birthdate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>생년월일</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="dueDate"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>출산예정일</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button 
                          type="submit" 
                          disabled={updateProfileMutation.isPending}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          {updateProfileMutation.isPending ? "저장 중..." : "저장하기"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>

              {/* 멤버십 정보 */}
              <Card>
                <CardHeader>
                  <CardTitle>멤버십 정보</CardTitle>
                  <CardDescription>
                    현재 회원 등급과 혜택을 확인할 수 있습니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-purple-50 rounded-lg">
                      <div>
                        <h3 className="font-medium text-purple-900">현재 등급</h3>
                        <p className="text-sm text-purple-700">
                          {getMemberTypeLabel(user?.memberType)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600">가입일</p>
                        <p className="text-sm font-medium">
                          {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 보안 탭 */}
            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>비밀번호 변경</CardTitle>
                  <CardDescription>
                    계정 보안을 위해 정기적으로 비밀번호를 변경해주세요.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)} className="space-y-4">
                      <FormField
                        control={passwordForm.control}
                        name="currentPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>현재 비밀번호</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="현재 비밀번호를 입력하세요" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={passwordForm.control}
                        name="newPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>새 비밀번호</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="새 비밀번호를 입력하세요" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={passwordForm.control}
                        name="confirmPassword"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>비밀번호 확인</FormLabel>
                            <FormControl>
                              <Input type="password" placeholder="새 비밀번호를 다시 입력하세요" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex justify-end pt-4">
                        <Button 
                          type="submit" 
                          disabled={changePasswordMutation.isPending}
                          className="bg-purple-600 hover:bg-purple-700"
                        >
                          {changePasswordMutation.isPending ? "변경 중..." : "비밀번호 변경"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 알림 탭 */}
            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>알림 설정</CardTitle>
                  <CardDescription>
                    원하는 알림을 선택해주세요.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* 이메일 알림 */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">이메일 알림</Label>
                        <p className="text-sm text-gray-500">중요한 업데이트를 이메일로 받습니다</p>
                      </div>
                      <Switch
                        checked={notificationSettings.emailNotifications}
                        onCheckedChange={(checked) => 
                          handleNotificationChange('emailNotifications', checked)
                        }
                      />
                    </div>

                    {/* 푸시 알림 */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">푸시 알림</Label>
                        <p className="text-sm text-gray-500">브라우저 푸시 알림을 받습니다</p>
                      </div>
                      <Switch
                        checked={notificationSettings.pushNotifications}
                        onCheckedChange={(checked) => 
                          handleNotificationChange('pushNotifications', checked)
                        }
                      />
                    </div>

                    {/* 임신 리마인더 */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">임신 리마인더</Label>
                        <p className="text-sm text-gray-500">임신 관련 중요한 일정을 알려드립니다</p>
                      </div>
                      <Switch
                        checked={notificationSettings.pregnancyReminders}
                        onCheckedChange={(checked) => 
                          handleNotificationChange('pregnancyReminders', checked)
                        }
                      />
                    </div>

                    {/* 주간 업데이트 */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">주간 업데이트</Label>
                        <p className="text-sm text-gray-500">매주 임신 진행 상황을 알려드립니다</p>
                      </div>
                      <Switch
                        checked={notificationSettings.weeklyUpdates}
                        onCheckedChange={(checked) => 
                          handleNotificationChange('weeklyUpdates', checked)
                        }
                      />
                    </div>

                    {/* 홍보 이메일 */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">홍보 이메일</Label>
                        <p className="text-sm text-gray-500">새로운 기능과 이벤트 소식을 받습니다</p>
                      </div>
                      <Switch
                        checked={notificationSettings.promotionalEmails}
                        onCheckedChange={(checked) => 
                          handleNotificationChange('promotionalEmails', checked)
                        }
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 이메일 인증 탭 */}
            <TabsContent value="email" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>이메일 인증</CardTitle>
                  <CardDescription>
                    이메일 주소를 인증하여 계정 보안을 강화하세요.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <h3 className="font-medium text-gray-900">현재 이메일</h3>
                        <p className="text-sm text-gray-600">{user?.email || '이메일 없음'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {user?.emailVerified ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            인증됨
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            인증 필요
                          </span>
                        )}
                      </div>
                    </div>

                    {!user?.emailVerified && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="text-sm font-medium text-yellow-800 mb-2">이메일 인증이 필요합니다</h4>
                        <p className="text-sm text-yellow-700 mb-3">
                          계정 보안을 위해 이메일 주소를 인증해주세요. 인증 이메일을 발송하시겠습니까?
                        </p>
                        <Button
                          onClick={() => sendVerificationMutation.mutate()}
                          disabled={sendVerificationMutation.isPending}
                          className="bg-yellow-600 hover:bg-yellow-700 text-white"
                        >
                          {sendVerificationMutation.isPending ? "발송 중..." : "인증 이메일 발송"}
                        </Button>
                      </div>
                    )}

                    {user?.emailVerified && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h4 className="text-sm font-medium text-green-800 mb-2">이메일이 인증되었습니다</h4>
                        <p className="text-sm text-green-700">
                          이메일 주소가 성공적으로 인증되었습니다. 모든 기능을 안전하게 이용하실 수 있습니다.
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 개인정보 탭 */}
            <TabsContent value="privacy" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>개인정보 관리</CardTitle>
                  <CardDescription>
                    개인정보 처리 및 계정 관리 옵션입니다.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <p className="text-gray-600">개인정보 관리 기능은 곧 추가될 예정입니다.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 설정 탭 */}
            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    사용자 설정
                  </CardTitle>
                  <CardDescription>
                    테마, 언어, 시간대 등 개인화 설정을 관리하세요.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* 테마 설정 */}
                  <div className="space-y-3">
                    <Label htmlFor="theme" className="text-sm font-medium">
                      테마 설정
                    </Label>
                    <Select 
                      value={userSettings.theme} 
                      onValueChange={(value) => handleUserSettingChange('theme', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="테마를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">라이트 모드</SelectItem>
                        <SelectItem value="dark">다크 모드</SelectItem>
                        <SelectItem value="system">시스템 설정</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 언어 설정 */}
                  <div className="space-y-3">
                    <Label htmlFor="language" className="text-sm font-medium">
                      언어 설정
                    </Label>
                    <Select 
                      value={userSettings.language} 
                      onValueChange={(value) => handleUserSettingChange('language', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="언어를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ko">한국어</SelectItem>
                        <SelectItem value="en">English</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 시간대 설정 */}
                  <div className="space-y-3">
                    <Label htmlFor="timezone" className="text-sm font-medium">
                      시간대 설정
                    </Label>
                    <Select 
                      value={userSettings.timezone} 
                      onValueChange={(value) => handleUserSettingChange('timezone', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="시간대를 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Seoul">한국 표준시 (KST)</SelectItem>
                        <SelectItem value="America/New_York">동부 표준시 (EST)</SelectItem>
                        <SelectItem value="America/Los_Angeles">태평양 표준시 (PST)</SelectItem>
                        <SelectItem value="Europe/London">그리니치 표준시 (GMT)</SelectItem>
                        <SelectItem value="Asia/Tokyo">일본 표준시 (JST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 날짜 형식 */}
                  <div className="space-y-3">
                    <Label htmlFor="dateFormat" className="text-sm font-medium">
                      날짜 형식
                    </Label>
                    <Select 
                      value={userSettings.dateFormat} 
                      onValueChange={(value) => handleUserSettingChange('dateFormat', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="날짜 형식을 선택하세요" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="YYYY-MM-DD">2024-01-15</SelectItem>
                        <SelectItem value="MM/DD/YYYY">01/15/2024</SelectItem>
                        <SelectItem value="DD/MM/YYYY">15/01/2024</SelectItem>
                        <SelectItem value="YYYY년 MM월 DD일">2024년 01월 15일</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 자동 저장 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">자동 저장</Label>
                      <p className="text-sm text-gray-500">
                        작업 내용을 자동으로 저장합니다
                      </p>
                    </div>
                    <Switch
                      checked={userSettings.autoSave}
                      onCheckedChange={(checked) => handleUserSettingChange('autoSave', checked)}
                    />
                  </div>

                  {/* 튜토리얼 표시 */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">튜토리얼 표시</Label>
                      <p className="text-sm text-gray-500">
                        처음 사용하는 기능에 대한 가이드를 표시합니다
                      </p>
                    </div>
                    <Switch
                      checked={userSettings.showTutorials}
                      onCheckedChange={(checked) => handleUserSettingChange('showTutorials', checked)}
                    />
                  </div>

                  {/* 데이터 내보내기 */}
                  <div className="pt-4 border-t">
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium mb-2">데이터 관리</h3>
                        <p className="text-sm text-gray-500 mb-4">
                          계정 데이터를 내보내거나 관리할 수 있습니다.
                        </p>
                      </div>
                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            // 데이터 내보내기 기능 구현 예정
                            toast({
                              title: "데이터 내보내기",
                              description: "곧 지원될 예정입니다.",
                            });
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          데이터 내보내기
                        </Button>
                      </div>
                    </div>
                  </div>

                  {updateUserSettingsMutation.isPending && (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                      설정을 저장하는 중...
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}