import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { formatDateForInput } from "@/lib/dateUtils";

const campaignMilestoneFormSchema = z.object({
  milestoneId: z.string().min(3, "ID는 최소 3자 이상이어야 합니다"),
  title: z.string().min(2, "제목은 최소 2자 이상이어야 합니다"),
  description: z.string().min(10, "설명은 최소 10자 이상이어야 합니다"),
  content: z.string().min(20, "상세 내용은 최소 20자 이상이어야 합니다"),
  headerImageUrl: z.string().url("올바른 URL을 입력해주세요").optional().or(z.literal("")),
  badgeEmoji: z.string().min(1, "배지 이모지를 입력해주세요"),
  encouragementMessage: z.string().min(5, "응원 메시지는 최소 5자 이상이어야 합니다"),
  campaignStartDate: z.string().min(1, "참여 시작일을 선택해주세요"),
  campaignEndDate: z.string().min(1, "참여 종료일을 선택해주세요"),
  selectionStartDate: z.string().min(1, "선정 시작일을 선택해주세요"),
  selectionEndDate: z.string().min(1, "선정 종료일을 선택해주세요"),
  categoryId: z.string().min(1, "카테고리를 선택해주세요"),
  hospitalId: z.coerce.number().min(0),
  order: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true),
}).refine((data) => {
  const campaignStart = new Date(data.campaignStartDate);
  const campaignEnd = new Date(data.campaignEndDate);
  const selectionStart = new Date(data.selectionStartDate);
  const selectionEnd = new Date(data.selectionEndDate);
  return campaignStart < campaignEnd && campaignEnd < selectionStart && selectionStart < selectionEnd;
}, {
  message: "날짜 순서: 참여 시작 < 참여 종료 < 선정 시작 < 선정 종료",
  path: ["campaignEndDate"]
});

type CampaignMilestoneFormValues = z.infer<typeof campaignMilestoneFormSchema>;

interface CampaignMilestone {
  id?: number;
  milestoneId: string;
  title: string;
  description: string;
  content: string;
  headerImageUrl?: string;
  badgeEmoji?: string;
  encouragementMessage?: string;
  campaignStartDate: string;
  campaignEndDate: string;
  selectionStartDate: string;
  selectionEndDate: string;
  categoryId: string;
  hospitalId: number;
  order: number;
  isActive: boolean;
}

interface Category {
  categoryId: string;
  name: string;
}

interface Hospital {
  id: number;
  name: string;
}

interface CampaignMilestoneFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  milestone?: CampaignMilestone | null;
  categories: Category[];
  hospitals: Hospital[];
  onSubmit: (values: CampaignMilestoneFormValues) => void;
  isPending?: boolean;
}

export function CampaignMilestoneFormModal({ isOpen, onClose, mode, milestone, categories, hospitals, onSubmit, isPending }: CampaignMilestoneFormModalProps) {
  const { toast } = useToast();
  const [uploadingHeader, setUploadingHeader] = useState(false);

  const form = useForm<CampaignMilestoneFormValues>({
    resolver: zodResolver(campaignMilestoneFormSchema),
    defaultValues: mode === 'edit' && milestone ? {
      milestoneId: milestone.milestoneId || "",
      title: milestone.title || "",
      description: milestone.description || "",
      content: milestone.content || "",
      headerImageUrl: milestone.headerImageUrl || "",
      badgeEmoji: milestone.badgeEmoji || "🎯",
      encouragementMessage: milestone.encouragementMessage || "참여해주셔서 감사합니다!",
      campaignStartDate: formatDateForInput(milestone.campaignStartDate),
      campaignEndDate: formatDateForInput(milestone.campaignEndDate),
      selectionStartDate: formatDateForInput(milestone.selectionStartDate),
      selectionEndDate: formatDateForInput(milestone.selectionEndDate),
      categoryId: milestone.categoryId || "",
      hospitalId: milestone.hospitalId || 0,
      order: milestone.order || 0,
      isActive: milestone.isActive !== undefined ? milestone.isActive : true,
    } : {
      milestoneId: "",
      title: "",
      description: "",
      content: "",
      headerImageUrl: "",
      badgeEmoji: "🎯",
      encouragementMessage: "참여해주셔서 감사합니다!",
      campaignStartDate: "",
      campaignEndDate: "",
      selectionStartDate: "",
      selectionEndDate: "",
      categoryId: "",
      hospitalId: 0,
      order: 0,
      isActive: true,
    },
  });

  const uploadHeaderImage = async (file: File): Promise<string> => {
    setUploadingHeader(true);
    try {
      const formData = new FormData();
      formData.append('headerImage', file);
      
      const response = await fetch('/api/admin/milestones/upload-header', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('이미지 업로드에 실패했습니다');
      }
      
      const data = await response.json();
      return data.url;
    } catch (error) {
      toast({
        title: "업로드 실패",
        description: "이미지 업로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      throw error;
    } finally {
      setUploadingHeader(false);
    }
  };

  const handleSubmit = (values: CampaignMilestoneFormValues) => {
    onSubmit(values);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '참여형 마일스톤 수정' : '새 참여형 마일스톤 생성'}</DialogTitle>
          <DialogDescription>
            병원별 캠페인 마일스톤을 {mode === 'edit' ? '수정' : '생성'}합니다. 참여 기간과 선정 기간을 정확히 설정해주세요.
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="milestoneId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>마일스톤 ID</FormLabel>
                    <FormControl>
                      <Input placeholder="campaign-photo-contest" {...field} disabled={mode === 'edit'} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목</FormLabel>
                    <FormControl>
                      <Input placeholder="태교 사진 콘테스트" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>간단 설명</FormLabel>
                  <FormControl>
                    <Textarea placeholder="캠페인의 간단한 설명을 입력하세요" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>상세 내용</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="캠페인의 상세 내용, 참여 방법, 혜택 등을 입력하세요" 
                      className="min-h-[100px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="headerImageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>헤더 이미지 URL</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <Input placeholder="https://..." {...field} />
                    </FormControl>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingHeader}
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (file) {
                            try {
                              const url = await uploadHeaderImage(file);
                              form.setValue('headerImageUrl', url);
                            } catch {}
                          }
                        };
                        input.click();
                      }}
                    >
                      {uploadingHeader ? "업로드 중..." : "업로드"}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="badgeEmoji"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>배지 이모지</FormLabel>
                    <FormControl>
                      <Input placeholder="🎯" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="encouragementMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>응원 메시지</FormLabel>
                    <FormControl>
                      <Input placeholder="참여해주셔서 감사합니다!" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="campaignStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>참여 시작일</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="campaignEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>참여 종료일</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="selectionStartDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>선정 시작일</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="selectionEndDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>선정 종료일</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>카테고리</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="카테고리 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((category) => (
                          <SelectItem key={category.categoryId} value={category.categoryId}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hospitalId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>병원</FormLabel>
                    <Select onValueChange={(v) => field.onChange(parseInt(v))} value={String(field.value)}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="병원 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">전체</SelectItem>
                        {hospitals.map((hospital) => (
                          <SelectItem key={hospital.id} value={String(hospital.id)}>
                            {hospital.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>순서</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>활성화</FormLabel>
                    <FormDescription>마일스톤 표시 여부</FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>취소</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "저장 중..." : mode === 'edit' ? "수정" : "생성"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
