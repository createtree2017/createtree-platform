import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Loader2, Search, Circle } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

// 🎯 Lucide 아이콘 목록 (한글 태그 포함 - 검색용)
const LUCIDE_ICON_OPTIONS: { name: string; label: string; tags: string[] }[] = [
  { name: "Search", label: "검색", tags: ["검색", "찾기", "돋보기", "탐색"] },
  { name: "Send", label: "보내기", tags: ["보내기", "전송", "제출", "발송"] },
  { name: "MessageCircle", label: "메시지", tags: ["메시지", "채팅", "대화", "리뷰", "후기", "댓글"] },
  { name: "CheckSquare", label: "체크", tags: ["체크", "확인", "완료", "출석", "인증"] },
  { name: "ClipboardCheck", label: "클립보드", tags: ["클립보드", "신청", "접수", "등록", "신청서"] },
  { name: "UserCheck", label: "사용자확인", tags: ["사용자", "확인", "출석", "참가", "인증"] },
  { name: "MapPin", label: "위치", tags: ["위치", "장소", "지도", "핀", "방문"] },
  { name: "Upload", label: "업로드", tags: ["업로드", "올리기", "파일", "첨부"] },
  { name: "Camera", label: "카메라", tags: ["카메라", "사진", "촬영", "인증샷"] },
  { name: "Image", label: "이미지", tags: ["이미지", "사진", "그림", "갤러리"] },
  { name: "Video", label: "비디오", tags: ["비디오", "영상", "동영상", "촬영"] },
  { name: "FileText", label: "문서", tags: ["문서", "파일", "텍스트", "글쓰기", "작성"] },
  { name: "Star", label: "별", tags: ["별", "평점", "리뷰", "즐겨찾기", "평가"] },
  { name: "Heart", label: "하트", tags: ["하트", "좋아요", "관심", "찜"] },
  { name: "ThumbsUp", label: "좋아요", tags: ["좋아요", "추천", "승인", "응원"] },
  { name: "Award", label: "상", tags: ["상", "수상", "트로피", "완료", "달성"] },
  { name: "Gift", label: "선물", tags: ["선물", "보상", "리워드", "경품"] },
  { name: "Calendar", label: "달력", tags: ["달력", "일정", "날짜", "스케줄", "예약"] },
  { name: "Clock", label: "시계", tags: ["시계", "시간", "기한", "마감"] },
  { name: "Bell", label: "알림", tags: ["알림", "벨", "통보", "공지"] },
  { name: "BookOpen", label: "책", tags: ["책", "학습", "교육", "읽기", "공부"] },
  { name: "Pen", label: "펜", tags: ["펜", "쓰기", "작성", "서명", "글"] },
  { name: "Link", label: "링크", tags: ["링크", "연결", "URL", "공유"] },
  { name: "Share2", label: "공유", tags: ["공유", "나누기", "전파", "SNS"] },
  { name: "Users", label: "그룹", tags: ["그룹", "팀", "모임", "사람들", "참여자"] },
  { name: "Mic", label: "마이크", tags: ["마이크", "녹음", "음성", "발표"] },
  { name: "Music", label: "음악", tags: ["음악", "노래", "멜로디", "사운드"] },
  { name: "Palette", label: "팔레트", tags: ["팔레트", "그리기", "미술", "디자인", "제작소"] },
  { name: "Sparkles", label: "반짝이", tags: ["반짝이", "AI", "생성", "마법", "특별"] },
  { name: "Zap", label: "번개", tags: ["번개", "빠른", "즉시", "에너지", "파워"] },
  { name: "Target", label: "타겟", tags: ["타겟", "목표", "미션", "도전"] },
  { name: "Trophy", label: "트로피", tags: ["트로피", "우승", "1등", "달성", "완료"] },
  { name: "Flag", label: "깃발", tags: ["깃발", "시작", "출발", "목표"] },
  { name: "Smile", label: "웃음", tags: ["웃음", "이모지", "기분", "감정", "행복"] },
  { name: "Eye", label: "눈", tags: ["눈", "보기", "관찰", "미리보기", "확인"] },
  { name: "ShieldCheck", label: "보안", tags: ["보안", "인증", "안전", "보호", "확인"] },
  { name: "Compass", label: "나침반", tags: ["나침반", "방향", "탐험", "가이드"] },
  { name: "Rocket", label: "로켓", tags: ["로켓", "출발", "시작", "성장", "도약"] },
  { name: "Lightbulb", label: "전구", tags: ["전구", "아이디어", "생각", "팁", "제안"] },
  { name: "HandHeart", label: "나눔", tags: ["나눔", "기부", "봉사", "돌봄", "사랑"] },
  { name: "Footprints", label: "발자국", tags: ["발자국", "걸음", "여행", "산책", "운동"] },
  { name: "Megaphone", label: "확성기", tags: ["확성기", "홍보", "공지", "알림", "발표"] },
  { name: "QrCode", label: "QR코드", tags: ["QR", "코드", "스캔", "인증"] },
  { name: "Ticket", label: "티켓", tags: ["티켓", "입장권", "쿠폰", "예매"] },
  { name: "Store", label: "매장", tags: ["매장", "가게", "쇼핑", "구매"] },
  { name: "Baby", label: "아기", tags: ["아기", "태아", "임신", "출산", "육아"] },
  { name: "Stethoscope", label: "청진기", tags: ["청진기", "병원", "의사", "건강", "진료"] },
  { name: "GraduationCap", label: "졸업모", tags: ["졸업", "교육", "학습", "수료"] },
  { name: "Briefcase", label: "서류가방", tags: ["서류가방", "업무", "비즈니스", "직장"] },
  { name: "Coffee", label: "커피", tags: ["커피", "카페", "음료", "휴식"] },
];

const formSchema = z.object({
  name: z.string().min(1, "이름을 입력하세요"),
  iconUrl: z.string().nullable().optional(),
  isActive: z.boolean(),
});

type FormValues = z.infer<typeof formSchema>;

interface ActionTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingActionType?: { id: number; name: string; iconUrl?: string | null; isActive: boolean } | null;
  onSave: (data: FormValues) => Promise<void>;
  isPending?: boolean;
}

export function ActionTypeModal({ isOpen, onClose, editingActionType, onSave, isPending = false }: ActionTypeModalProps) {
  const [iconSearch, setIconSearch] = useState("");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      iconUrl: null,
      isActive: true,
    },
  });

  const selectedIcon = form.watch("iconUrl");

  useEffect(() => {
    if (isOpen) {
      setIconSearch("");
      if (editingActionType) {
        form.reset({
          name: editingActionType.name,
          iconUrl: editingActionType.iconUrl || null,
          isActive: editingActionType.isActive,
        });
      } else {
        form.reset({
          name: "",
          iconUrl: null,
          isActive: true,
        });
      }
    }
  }, [editingActionType, isOpen, form]);

  // 한글/영문 아이콘 검색
  const filteredIcons = useMemo(() => {
    if (!iconSearch.trim()) return LUCIDE_ICON_OPTIONS;
    const query = iconSearch.toLowerCase().trim();
    return LUCIDE_ICON_OPTIONS.filter(icon =>
      icon.name.toLowerCase().includes(query) ||
      icon.label.includes(query) ||
      icon.tags.some(tag => tag.includes(query))
    );
  }, [iconSearch]);

  const handleSubmit = async (data: FormValues) => {
    await onSave(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>
            {editingActionType ? '액션 타입 수정' : '액션 타입 추가'}
          </DialogTitle>
          <DialogDescription>
            세부 미션에 사용할 액션 타입 정보를 입력하세요
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>이름</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="예: 참석확인, 사진제출" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 아이콘 선택기 */}
            <FormField
              control={form.control}
              name="iconUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>아이콘</FormLabel>
                  <FormDescription>
                    하단 탭바에 표시될 아이콘을 선택하세요
                  </FormDescription>

                  {/* 선택된 아이콘 미리보기 */}
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                    {(() => {
                      const SelectedIcon = field.value ? (LucideIcons as any)[field.value] : null;
                      return SelectedIcon ? (
                        <SelectedIcon className="h-8 w-8 text-purple-500" />
                      ) : (
                        <Circle className="h-8 w-8 text-gray-400" />
                      );
                    })()}
                    <div className="text-sm">
                      <div className="font-medium">
                        {field.value
                          ? LUCIDE_ICON_OPTIONS.find(i => i.name === field.value)?.label || field.value
                          : "선택 안함"}
                      </div>
                      <div className="text-muted-foreground text-xs">
                        {field.value || "아래에서 아이콘을 선택하세요"}
                      </div>
                    </div>
                    {field.value && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => field.onChange(null)}
                      >
                        해제
                      </Button>
                    )}
                  </div>

                  {/* 검색 입력 */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={iconSearch}
                      onChange={(e) => setIconSearch(e.target.value)}
                      placeholder="아이콘 검색 (예: 제출, 카메라, 리뷰)"
                      className="pl-9"
                    />
                  </div>

                  {/* 아이콘 그리드 */}
                  <div className="grid grid-cols-6 gap-1.5 max-h-[200px] overflow-y-auto p-1 rounded-lg border">
                    {filteredIcons.map((iconOption) => {
                      const IconComp = (LucideIcons as any)[iconOption.name];
                      if (!IconComp) return null;
                      const isSelected = field.value === iconOption.name;
                      return (
                        <button
                          key={iconOption.name}
                          type="button"
                          onClick={() => field.onChange(iconOption.name)}
                          className={`flex flex-col items-center justify-center p-2 rounded-md transition-all hover:bg-accent ${
                            isSelected
                              ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                          title={`${iconOption.label} (${iconOption.name})`}
                        >
                          <IconComp className={`h-5 w-5 ${isSelected ? 'text-purple-600 dark:text-purple-400' : 'text-gray-600 dark:text-gray-400'}`} />
                          <span className={`text-[10px] mt-0.5 truncate w-full text-center ${isSelected ? 'text-purple-600 dark:text-purple-400 font-medium' : 'text-muted-foreground'}`}>
                            {iconOption.label}
                          </span>
                        </button>
                      );
                    })}
                    {filteredIcons.length === 0 && (
                      <div className="col-span-6 py-6 text-center text-sm text-muted-foreground">
                        검색 결과가 없습니다
                      </div>
                    )}
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">활성화</FormLabel>
                    <FormDescription>
                      비활성화하면 새 세부 미션에서 선택할 수 없습니다
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button 
                type="submit" 
                disabled={isPending}
              >
                {isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                저장
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
