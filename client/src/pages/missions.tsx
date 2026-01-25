import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { sanitizeHtml } from "@/lib/utils";
import { getPeriodStatus, formatSimpleDate } from "@/lib/dateUtils";
import { MissionBadges } from "@/lib/missionUtils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Target, Calendar, Building2, ChevronRight, Loader2, FolderTree } from "lucide-react";

interface ThemeMission {
  id: number;
  missionId: string;
  title: string;
  description: string;
  categoryId?: string;
  headerImageUrl?: string;
  visibilityType: string;
  hospitalId?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  order: number;
  category?: {
    categoryId: string;
    name: string;
  };
  hospital?: {
    id: number;
    name: string;
  };
  userProgress?: {
    status: string;
    progressPercent: number;
    completedSubMissions: number;
    totalSubMissions: number;
  };
  hasChildMissions?: boolean;
  childMissionCount?: number;
  totalMissionCount?: number;
  isApprovedForChildAccess?: boolean;
  hasGift?: boolean;
}

interface MissionCategory {
  categoryId: string;
  name: string;
  description?: string;
}

export default function MissionsPage() {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");

  const { data: missions = [], isLoading: missionsLoading } = useQuery<ThemeMission[]>({
    queryKey: ['/api/missions'],
  });

  // 미션 데이터에서 unique categories 추출
  const categories = missions
    .filter(m => m.category)
    .reduce<MissionCategory[]>((acc, mission) => {
      if (mission.category && !acc.some(c => c.categoryId === mission.category!.categoryId)) {
        acc.push(mission.category);
      }
      return acc;
    }, []);

  const filteredMissions = missions.filter(m => {
    // Apply category filter
    const categoryMatch = categoryFilter === 'all' 
      ? true 
      : (m.category?.categoryId === categoryFilter || m.categoryId === categoryFilter);
    
    // Apply status filter
    const missionStatus = getPeriodStatus(m.startDate, m.endDate);
    const statusMatch = statusFilter === 'all' ? true : missionStatus === statusFilter;
    
    return categoryMatch && statusMatch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <div className="w-full px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            미션
          </h1>
          <p className="text-muted-foreground">
            다양한 미션을 완료하고 특별한 혜택을 받아보세요
          </p>
        </div>

        {/* Status Tabs */}
        <div className="mb-6">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="grid w-full max-w-xs grid-cols-3">
              <TabsTrigger value="active">진행중</TabsTrigger>
              <TabsTrigger value="upcoming">준비중</TabsTrigger>
              <TabsTrigger value="closed">마감</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Category Filter */}
        <div className="mb-6 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">카테고리:</span>
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.categoryId} value={category.categoryId}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-muted-foreground">
            총 {filteredMissions.length}개 미션
          </div>
        </div>

        {/* Missions Grid */}
        {missionsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : filteredMissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              해당하는 미션이 없습니다
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMissions.map((mission) => (
              <Card key={mission.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  {mission.headerImageUrl && (
                    <div className="w-full h-40 rounded-md overflow-hidden mb-4">
                      <img 
                        src={mission.headerImageUrl} 
                        alt={mission.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="space-y-2 mb-2">
                    <MissionBadges 
                      startDate={mission.startDate} 
                      endDate={mission.endDate} 
                      hasGift={mission.hasGift} 
                    />
                    <CardTitle className="text-lg">{mission.title}</CardTitle>
                  </div>
                  <div 
                    className="text-sm text-muted-foreground line-clamp-2"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(mission.description || '') }}
                  />
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress */}
                  {mission.userProgress && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">진행률</span>
                        <span className="font-medium">
                          {mission.userProgress.completedSubMissions} / {mission.userProgress.totalSubMissions}
                        </span>
                      </div>
                      <Progress value={mission.userProgress.progressPercent} />
                    </div>
                  )}

                  {/* Meta info */}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {mission.category && (
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        <span>{mission.category.name}</span>
                      </div>
                    )}
                    {mission.hospital && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{mission.hospital.name}</span>
                      </div>
                    )}
                    {(mission.startDate || mission.endDate) && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatSimpleDate(mission.startDate)} ~ {formatSimpleDate(mission.endDate) || '제한 없음'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Total Missions Count */}
                  {(mission.totalMissionCount ?? 1) > 1 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FolderTree className="h-4 w-4" />
                      <span>전체미션 {mission.totalMissionCount}개</span>
                    </div>
                  )}

                  {/* CTA */}
                  <Link href={`/missions/${mission.missionId}`} className="block mt-4">
                    <Button className="w-full" variant="outline">
                      자세히 보기
                      <ChevronRight className="h-4 w-4 ml-2" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
