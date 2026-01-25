import { Badge } from "@/components/ui/badge";
import { Gift } from "lucide-react";
import { getPeriodStatus } from "@/lib/dateUtils";

export type MissionPeriodStatus = 'upcoming' | 'active' | 'closed';

export function getMissionStatusBadge(startDate: string | undefined, endDate: string | undefined): JSX.Element {
  const periodStatus = getPeriodStatus(startDate, endDate);
  
  switch (periodStatus) {
    case 'upcoming':
      return <Badge className="bg-green-500 text-white hover:bg-green-600">준비 중</Badge>;
    case 'active':
      return <Badge className="bg-blue-500 text-white hover:bg-blue-600">진행 중</Badge>;
    case 'closed':
      return <Badge variant="destructive">마감</Badge>;
    default:
      return <Badge variant="outline">상태 없음</Badge>;
  }
}

export function getGiftBadge(hasGift: boolean | undefined): JSX.Element | null {
  if (!hasGift) return null;
  
  return (
    <Badge className="bg-amber-500 text-white hover:bg-amber-600">
      <Gift className="h-3 w-3 mr-1" />
      선물
    </Badge>
  );
}

interface MissionBadgesProps {
  startDate?: string;
  endDate?: string;
  hasGift?: boolean;
  className?: string;
}

export function MissionBadges({ startDate, endDate, hasGift, className = "" }: MissionBadgesProps): JSX.Element {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {getMissionStatusBadge(startDate, endDate)}
      {getGiftBadge(hasGift)}
    </div>
  );
}
