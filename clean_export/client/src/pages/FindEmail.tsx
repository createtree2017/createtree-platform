import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

// 아이디 찾기 폼 검증 스키마
const findEmailSchema = z.object({
  fullName: z.string().min(2, "이름은 2자 이상 입력해주세요"),
  phoneNumber: z.string().min(10, "올바른 전화번호를 입력해주세요")
    .regex(/^[0-9-]+$/, "전화번호는 숫자와 하이픈만 입력 가능합니다"),
});

type FindEmailForm = z.infer<typeof findEmailSchema>;

export default function FindEmail() {
  const [isLoading, setIsLoading] = useState(false);
  const [foundEmail, setFoundEmail] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<FindEmailForm>({
    resolver: zodResolver(findEmailSchema),
    defaultValues: {
      fullName: "",
      phoneNumber: "",
    },
  });

  const onSubmit = async (data: FindEmailForm) => {
    setIsLoading(true);
    setFoundEmail(null);
    
    try {
      const response = await fetch('/api/auth/find-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('FindEmail API Response:', result);

      if (result.success) {
        if (result.email) {
          console.log('Found email:', result.email);
          setFoundEmail(result.email);
          toast({
            title: "아이디를 찾았습니다",
            description: "회원님의 아이디(이메일)를 확인해주세요.",
          });
        } else {
          toast({
            title: "아이디를 찾을 수 없습니다",
            description: "입력하신 정보와 일치하는 회원 정보가 없습니다.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      toast({
        title: "오류가 발생했습니다",
        description: "잠시 후 다시 시도해주세요.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>아이디 찾기</CardTitle>
          <CardDescription>
            회원가입 시 입력한 이름과 전화번호로 아이디를 찾을 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!foundEmail ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름</FormLabel>
                      <FormControl>
                        <Input placeholder="홍길동" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>전화번호</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="010-1234-5678" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        확인 중...
                      </>
                    ) : (
                      "아이디 찾기"
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => window.history.back()}
                  >
                    돌아가기
                  </Button>
                </div>
              </form>
            </Form>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">회원님의 아이디는</p>
                <p className="text-lg font-semibold text-green-700">{foundEmail}</p>
                <p className="text-sm text-gray-600 mt-2">입니다.</p>
              </div>
              
              <div className="space-y-2">
                <Link href="/auth">
                  <Button className="w-full">
                    로그인하기
                  </Button>
                </Link>
                
                <Link href="/forgot-password">
                  <Button variant="outline" className="w-full">
                    비밀번호 찾기
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}