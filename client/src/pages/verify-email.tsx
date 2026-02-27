import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

export default function VerifyEmailPage() {
    const [location, navigate] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        // URL에서 토큰 파라미터 추출
        const searchParams = new URLSearchParams(window.location.search);
        const token = searchParams.get("token");

        if (!token) {
            setStatus("error");
            setErrorMessage("유효하지 않은 접근입니다. 인증 토큰이 없습니다.");
            return;
        }

        const verifyToken = async () => {
            try {
                const response = await fetch("/api/auth/verify-email", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ token }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    setStatus("success");
                    toast({
                        title: "이메일 인증 성공",
                        description: "성공적으로 이메일 인증이 완료되었습니다.",
                    });

                    // 인증이 성공했으므로 사용자 정보 새로고침
                    queryClient.invalidateQueries({ queryKey: ["/api/user"] });
                } else {
                    setStatus("error");
                    setErrorMessage(data.message || "이메일 인증에 실패했습니다.");
                    toast({
                        variant: "destructive",
                        title: "인증 실패",
                        description: data.message || "이메일 인증에 실패했습니다.",
                    });
                }
            } catch (error) {
                setStatus("error");
                setErrorMessage("서버 통신 중 오류가 발생했습니다.");
                toast({
                    variant: "destructive",
                    title: "인증 오류",
                    description: "서버 통신 중 오류가 발생했습니다.",
                });
            }
        };

        verifyToken();
    }, [toast, queryClient]);

    const handleComplete = () => {
        if (user) {
            navigate('/account-settings'); // 로그인 상태면 설정으로
        } else {
            navigate('/auth'); // 비회원이면 로그인으로
        }
    };

    return (
        <div className="flex min-h-[80vh] items-center justify-center p-4">
            <Card className="w-full max-w-md shadow-lg border-primary/20">
                <CardHeader className="text-center space-y-4 pb-6">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                        {status === "loading" && <Loader2 className="h-8 w-8 text-primary animate-spin" />}
                        {status === "success" && <CheckCircle2 className="h-8 w-8 text-green-500" />}
                        {status === "error" && <XCircle className="h-8 w-8 text-destructive" />}
                    </div>
                    <CardTitle className="text-2xl">이메일 인증</CardTitle>
                    <CardDescription className="text-base">
                        {status === "loading" && "이메일 인증 링크를 확인하는 중입니다..."}
                        {status === "success" && "이메일 주소가 성공적으로 확인되었습니다!"}
                        {status === "error" && "이메일 주소 확인에 실패했습니다."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-6">
                    {status === "error" && (
                        <div className="bg-destructive/10 p-4 rounded-lg text-sm text-center text-destructive">
                            {errorMessage}
                        </div>
                    )}

                    {status === "success" && (
                        <div className="bg-green-500/10 p-4 rounded-lg text-sm text-center text-green-700 dark:text-green-400">
                            이제 우리병원 문화센터의 모든 기능을 정상적으로 이용하실 수 있습니다.
                        </div>
                    )}

                    {status !== "loading" && (
                        <Button onClick={handleComplete} className="w-full font-bold" size="lg">
                            {user ? '설정으로 돌아가기' : '로그인 화면으로 이동'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
