import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ExtendedCampaign } from "./CampaignEditorForHospital";

export default function CampaignTableForHospital() {
  const [, setLocation] = useLocation();

  const { data: campaigns = [], isLoading, error } = useQuery<ExtendedCampaign[]>({
    queryKey: ["/api/hospital/campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/hospital/campaigns", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("병원 캠페인 목록을 불러오지 못했습니다.");
      }

      return response.json();
    },
  });

  if (isLoading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">캠페인 목록을 불러오는 중입니다.</div>;
  }

  if (error) {
    return <div className="py-10 text-center text-sm text-red-600">캠페인 목록을 불러오지 못했습니다.</div>;
  }

  if (campaigns.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">등록된 캠페인이 없습니다.</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>캠페인</TableHead>
          <TableHead>상태</TableHead>
          <TableHead>신청 기간</TableHead>
          <TableHead className="text-right">관리</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {campaigns.map((campaign) => (
          <TableRow key={campaign.id}>
            <TableCell>
              <div className="font-medium">{campaign.title}</div>
              {campaign.description && (
                <div className="text-xs text-muted-foreground line-clamp-1">{campaign.description}</div>
              )}
            </TableCell>
            <TableCell>{campaign.status || (campaign.isPublic ? "공개" : "비공개")}</TableCell>
            <TableCell>
              {[campaign.startDate, campaign.endDate].filter(Boolean).join(" ~ ") || "-"}
            </TableCell>
            <TableCell className="text-right">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/hospital/campaigns/edit/${campaign.id}`)}
              >
                수정
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
