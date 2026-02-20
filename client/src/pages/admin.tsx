import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import ErrorBoundary from "@/components/ErrorBoundary";
import { t } from "@/lib/i18n";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

// 마일스톤 탭 컴포넌트
import MilestoneManagement from "@/components/admin/MilestoneManagement";
import MilestoneCategoryManagement from "@/components/admin/MilestoneCategoryManagement";
import CampaignMilestoneManagement from "@/components/admin/CampaignMilestoneManagement";
import ApplicationManagement from "@/components/admin/ApplicationManagement";

// 회원관리 탭 컴포넌트
import { MemberManagement } from "@/components/admin/MemberManagement";
import HospitalManagement from "@/pages/admin/HospitalManagement";
import HospitalCodeManagement from "@/components/admin/HospitalCodeManagement";

// 기타 탭 컴포넌트
import SystemSettings from "@/components/admin/SystemSettings";
import LanguageSettings from "@/components/admin/LanguageSettings";

// 메뉴관리 탭 (통합 관리 포함)
import MenuManagement from "@/components/admin/MenuManagement";

// Main admin component
export default function AdminPage() {
  const [, navigate] = useLocation();

  // 각 메인 탭의 유효한 서브탭 목록
  const validSubTabs: Record<string, string[]> = {
    'menu-management': [],
    'milestones': ['milestone-items', 'campaign-milestones', 'milestone-categories', 'application-management'],
    'member-management': ['members', 'hospitals', 'hospital-codes'],
  };

  // 각 메인 탭의 기본 서브탭
  const defaultSubTabs: Record<string, string> = {
    'milestones': 'milestone-items',
    'member-management': 'members',
  };

  // URL 쿼리 파라미터에서 탭 상태 읽기
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'menu-management';
  };

  const getSubTabFromUrl = (mainTab?: string) => {
    const params = new URLSearchParams(window.location.search);
    const subTab = params.get('sub') || '';
    const currentMainTab = mainTab || getTabFromUrl();

    // 서브탭이 현재 메인탭에 유효한지 확인
    const validSubs = validSubTabs[currentMainTab];
    if (validSubs && subTab && validSubs.includes(subTab)) {
      return subTab;
    }
    // 유효하지 않으면 기본값 반환
    return defaultSubTabs[currentMainTab] || '';
  };

  // 검수 대시보드 계층 탐색용 파라미터
  const getMissionIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mission') || null;
  };

  const getSubmissionIdFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('submission') || null;
  };

  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  const [activeSubTab, setActiveSubTab] = useState(() => getSubTabFromUrl(getTabFromUrl()));
  const [activeMissionId, setActiveMissionId] = useState<string | null>(getMissionIdFromUrl);
  const [activeSubmissionId, setActiveSubmissionId] = useState<string | null>(getSubmissionIdFromUrl);

  // URL 빌더 헬퍼
  const buildUrl = (params: { tab: string; sub?: string; mission?: string | null; submission?: string | null }) => {
    const urlParams = new URLSearchParams();
    urlParams.set('tab', params.tab);
    if (params.sub) urlParams.set('sub', params.sub);
    if (params.mission) urlParams.set('mission', params.mission);
    if (params.submission) urlParams.set('submission', params.submission);
    return `/admin?${urlParams.toString()}`;
  };

  // 탭 변경 시 URL 업데이트 (히스토리에 추가)
  const handleTabChange = (newTab: string) => {
    const newSubTab = defaultSubTabs[newTab] || '';
    setActiveTab(newTab);
    setActiveSubTab(newSubTab);
    setActiveMissionId(null);
    setActiveSubmissionId(null);
    const newUrl = buildUrl({ tab: newTab, sub: newSubTab });
    window.history.pushState({}, '', newUrl);
  };

  // 서브 탭 변경 시 URL 업데이트
  const handleSubTabChange = (newSubTab: string) => {
    setActiveSubTab(newSubTab);
    setActiveMissionId(null);
    setActiveSubmissionId(null);
    const newUrl = buildUrl({ tab: activeTab, sub: newSubTab });
    window.history.pushState({}, '', newUrl);
  };

  // 검수 대시보드 계층 탐색 핸들러
  const handleMissionSelect = (missionId: string | null) => {
    setActiveMissionId(missionId);
    setActiveSubmissionId(null);
    const newUrl = buildUrl({ tab: activeTab, sub: activeSubTab, mission: missionId });
    window.history.pushState({}, '', newUrl);
  };

  const handleSubmissionSelect = (submissionId: string | null, missionId?: string | null) => {
    setActiveSubmissionId(submissionId);
    // 미션 ID가 명시적으로 전달되면 사용, 아니면 현재 값 유지
    const effectiveMissionId = missionId !== undefined ? missionId : activeMissionId;
    if (missionId !== undefined) {
      setActiveMissionId(missionId);
    }
    const newUrl = buildUrl({ tab: activeTab, sub: activeSubTab, mission: effectiveMissionId, submission: submissionId });
    window.history.pushState({}, '', newUrl);
  };

  // 브라우저 뒤로/앞으로 버튼 감지
  useEffect(() => {
    const handlePopState = () => {
      const newMainTab = getTabFromUrl();
      const newSubTab = getSubTabFromUrl(newMainTab);
      const newMissionId = getMissionIdFromUrl();
      const newSubmissionId = getSubmissionIdFromUrl();
      setActiveTab(newMainTab);
      setActiveSubTab(newSubTab);
      setActiveMissionId(newMissionId);
      setActiveSubmissionId(newSubmissionId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  return (
    <div className="w-full py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-4xl font-bold">{t('admin.title')}</h1>
        <Button
          variant="outline"
          onClick={() => window.location.href = '/'}
          className="flex items-center gap-2"
        >
          <Home className="h-4 w-4" />
          홈페이지로 이동
        </Button>
      </div>
      <p className="text-gray-500 mb-8">
        {t('admin.subtitle')}
      </p>

      <Tabs defaultValue="menu-management" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full flex flex-wrap mb-8">
          <TabsTrigger value="menu-management">메뉴관리</TabsTrigger>
          <TabsTrigger value="milestones">마일스톤</TabsTrigger>
          <TabsTrigger value="member-management">회원관리</TabsTrigger>
          <TabsTrigger value="system-settings">시스템 설정</TabsTrigger>
          <TabsTrigger value="languages">언어 설정</TabsTrigger>
        </TabsList>

        <TabsContent value="menu-management">
          <MenuManagement />
        </TabsContent>

        <TabsContent value="milestones">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">마일스톤 관리</h2>

            <Tabs value={activeSubTab || 'milestone-items'} onValueChange={handleSubTabChange}>
              <TabsList>
                <TabsTrigger value="milestone-items">정보형 마일스톤</TabsTrigger>
                <TabsTrigger value="campaign-milestones">참여형 마일스톤</TabsTrigger>
                <TabsTrigger value="milestone-categories">카테고리</TabsTrigger>
                <TabsTrigger value="application-management">신청내역관리</TabsTrigger>
              </TabsList>

              <TabsContent value="milestone-items">
                <div className="mt-4">
                  <ErrorBoundary>
                    <MilestoneManagement />
                  </ErrorBoundary>
                </div>
              </TabsContent>

              <TabsContent value="campaign-milestones">
                <div className="mt-4">
                  <ErrorBoundary>
                    <CampaignMilestoneManagement />
                  </ErrorBoundary>
                </div>
              </TabsContent>

              <TabsContent value="milestone-categories">
                <div className="mt-4">
                  <ErrorBoundary>
                    <MilestoneCategoryManagement />
                  </ErrorBoundary>
                </div>
              </TabsContent>

              <TabsContent value="application-management">
                <div className="mt-4">
                  <ErrorBoundary>
                    <ApplicationManagement />
                  </ErrorBoundary>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="member-management">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">회원관리</h2>

            <Tabs value={activeSubTab || 'members'} onValueChange={handleSubTabChange}>
              <TabsList>
                <TabsTrigger value="members">회원관리</TabsTrigger>
                <TabsTrigger value="hospitals">병원관리</TabsTrigger>
                <TabsTrigger value="hospital-codes">병원 코드 관리</TabsTrigger>
              </TabsList>

              <TabsContent value="members">
                <div className="mt-6">
                  <MemberManagement />
                </div>
              </TabsContent>

              <TabsContent value="hospitals">
                <div className="mt-6">
                  <HospitalManagement />
                </div>
              </TabsContent>

              <TabsContent value="hospital-codes">
                <div className="mt-6">
                  <HospitalCodeManagement />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        <TabsContent value="system-settings">
          <SystemSettings />
        </TabsContent>



        <TabsContent value="languages">
          <LanguageSettings />
        </TabsContent>

      </Tabs>
    </div>
  );
}
