import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { transformImage, getImageList, downloadMedia, shareMedia, getMusicList } from "@/lib/api";
import ErrorBoundary from "@/components/ErrorBoundary";

import { format } from "date-fns";
import { 
  InsertPersona, 
  InsertPersonaCategory, 
  InsertConcept, 
  InsertConceptCategory,
  MusicStyle,
  MusicStyleInsert,
  Music 
} from "@shared/schema";
import { FileUpload } from "@/components/ui/file-upload";
import BatchImportDialog from "@/components/BatchImportDialog";
import { getLanguage, loadTranslations, setLanguage, t } from "@/lib/i18n";
import BannerManagement from "@/components/admin/BannerManagement";

import CategoryManagement from "@/components/admin/CategoryManagement";
import ServiceItemManagement from "@/components/admin/ServiceItemManagement";
import ConceptManagement from "@/components/admin/ConceptManagement";
import SnapshotPromptManagement from "@/components/admin/SnapshotPromptManagement";


import MilestoneManagement from "@/components/admin/MilestoneManagement";
import MilestoneCategoryManagement from "@/components/admin/MilestoneCategoryManagement";
import CampaignMilestoneManagement from "@/components/admin/CampaignMilestoneManagement";
import MissionManagement from "@/components/admin/MissionManagement";
import { MemberManagement } from "@/components/admin/MemberManagement";
import HospitalManagement from "@/pages/admin/HospitalManagement";
import HospitalCodeManagement from "@/components/admin/HospitalCodeManagement";
import SmallBannerManagement from "@/components/admin/SmallBannerManagement";
import PopularStyleManagement from "@/components/admin/PopularStyleManagement";
import MainGalleryManagement from "@/components/admin/MainGalleryManagement";
import SystemSettings from "@/components/admin/SystemSettings";
import BackgroundRemovalManagement from "@/components/admin/BackgroundRemovalManagement";
import PhotobookTemplateManagement from "@/components/admin/PhotobookTemplateManagement";
import PhotobookBackgroundManagement from "@/components/admin/PhotobookBackgroundManagement";
import PhotobookIconManagement from "@/components/admin/PhotobookIconManagement";
import PhotobookMaterialCategoryManagement from "@/components/admin/PhotobookMaterialCategoryManagement";
import { getQueryFn } from '@/lib/queryClient';


import { 
  getLanguages, 
  uploadTranslations,
  uploadThumbnail,
  getAbTests,
  getAbTest,
  createAbTest,
  recordAbTestResult
} from "@/lib/api";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  CheckCircle, Edit, PlusCircle, Trash2, X, Upload, Globe, Download, 
  PaintbrushVertical, Image as ImageIcon, Share2, Eye, RefreshCw, Plus, Loader2, 
  Info, ChevronLeft, ChevronRight, Home, Music as MusicIcon, Play, Pause, Volume2,
  Building2, Book 
} from "lucide-react";

// Define form validation schemas using Zod
const personaFormSchema = z.object({
  personaId: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  avatarEmoji: z.string().min(1, "Avatar emoji is required"),
  description: z.string().min(1, "Description is required"),
  welcomeMessage: z.string().min(1, "Welcome message is required"),
  systemPrompt: z.string().min(1, "System prompt is required"),
  primaryColor: z.string().min(1, "Primary color is required"),
  secondaryColor: z.string().min(1, "Secondary color is required"),
  personality: z.string().optional(),
  tone: z.string().optional(),
  usageContext: z.string().optional(),
  emotionalKeywords: z.array(z.string()).optional(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "night", "all"]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  order: z.number().int().default(0),
  categories: z.array(z.string()).optional(),
});

const categoryFormSchema = z.object({
  categoryId: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  emoji: z.string().min(1, "Emoji is required"),
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

// Define validation schemas for concept management
const conceptCategorySchema = z.object({
  categoryId: z.string().min(1, "ID is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().min(1, "Description is required"),
  systemPrompt: z.string().optional(),  // GPT-4o에게 줄 이미지 분석 지침
  order: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

const conceptSchema = z.object({
  conceptId: z.string().min(1, "ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  promptTemplate: z.string().min(1, "Prompt template is required"),
  systemPrompt: z.string().optional(),  // 이미지 분석 및 변환을 위한 시스템 프롬프트 추가
  thumbnailUrl: z.string().optional(),
  tagSuggestions: z.array(z.string()).optional().default([]),
  variables: z.array(z.object({
    name: z.string().min(1, "Variable name is required"),
    description: z.string().min(1, "Variable description is required"),
    type: z.enum(["text", "select", "number", "boolean"]),
    required: z.boolean().default(true),
    options: z.array(z.string()).optional(),
    defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })).optional().default([]),
  categoryId: z.string().min(1, "Category is required"),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  order: z.number().int().default(0),
});



// Image Gallery Component
interface ImageItem {
  id: number;
  title: string;
  url?: string;
  transformedUrl?: string;
  originalUrl?: string;
  thumbnailUrl?: string;
  createdAt: string;
  type?: string;
  style?: string;
  isFavorite?: boolean;
}

function ImageGallery() {
  // 페이지네이션 상태
  const [currentPage, setCurrentPage] = useState(1);
  const [totalImages, setTotalImages] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const imagesPerPage = 10;
  
  // 페이지 변경 시 쿼리 갱신
  useEffect(() => {
    // 페이지가 변경되면 쿼리가 자동으로 다시 실행됨 (queryKey에 currentPage가 포함되어 있음)
    console.log(`페이지 변경: ${currentPage}`);
  }, [currentPage]);
  
  // 새로운 캐시 키 생성용 카운터
  const [refreshCounter, setRefreshCounter] = useState(0);
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/admin/images", currentPage], 
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지
    refetchOnWindowFocus: false, // 자동 갱신 제거
    refetchOnMount: true, // 마운트 시에만 새로 불러오기
    
    // API 요청 함수
    queryFn: async () => {
      const response = await fetch(`/api/admin/images?page=${currentPage}&limit=${imagesPerPage}`, {
        credentials: 'include',
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        }
      });
      
      if (!response.ok) {
        throw new Error("이미지 목록을 불러오는 데 실패했습니다");
      }
      
      const result = await response.json();
      // API 응답에서 페이지네이션 정보 업데이트
      if (result.pagination) {
        setTotalImages(result.pagination.totalItems || result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      }
      
      return result;
    }
  });
  
  // 이미지 데이터 추출
  const images = data?.images || [];
  
  const queryClient = useQueryClient();

  const [viewImageDialog, setViewImageDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImageItem | null>(null);

  const handleViewImage = (image: ImageItem) => {
    setSelectedImage(image);
    setViewImageDialog(true);
  };

  // 이미지 형식 선택 상태 (기본값은 PNG)
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png');
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);

  const handleDownloadClick = (image: ImageItem) => {
    setSelectedImage(image);
    setDownloadDialogOpen(true);
  };

  const handleDownload = async (image: ImageItem, format: 'png' | 'jpeg' = 'png') => {
    try {
      // 이미지 URL 가져오기
      const imageUrl = image.transformedUrl || image.url;
      if (!imageUrl) {
        throw new Error("이미지 URL이 유효하지 않습니다.");
      }
      
      // 이미지 다운로드 링크 생성 및 자동 클릭
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `${image.title || 'image'}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // 다운로드 대화상자 닫기
      setDownloadDialogOpen(false);
      
      toast({
        title: "다운로드 중",
        description: `이미지가 ${format.toUpperCase()} 형식으로 다운로드됩니다.`,
      });
      
      // 백엔드 API도 호출하여 로그 기록
      try {
        await downloadMedia(image.id, 'image');
      } catch (backendError) {
        console.warn("백엔드 다운로드 로깅 실패:", backendError);
      }
    } catch (error) {
      console.error("Error downloading image:", error);
      toast({
        title: "다운로드 실패",
        description: "이미지 다운로드 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async (image: ImageItem) => {
    try {
      const result = await shareMedia(image.id, 'image');
      console.log("공유 응답:", result);
      
      if (result.shareUrl) {
        // Copy to clipboard
        try {
          await navigator.clipboard.writeText(result.shareUrl);
          toast({
            title: "공유 링크 생성됨",
            description: "공유 링크가 클립보드에 복사되었습니다.",
          });
          // URL 열기
          window.open(result.shareUrl, '_blank');
        } catch (clipboardErr) {
          console.error("클립보드 복사 실패:", clipboardErr);
          toast({
            title: "공유 링크 생성됨",
            description: `공유 URL: ${result.shareUrl}`,
          });
          // URL 열기
          window.open(result.shareUrl, '_blank');
        }
      } else {
        toast({
          title: "공유 실패",
          description: "유효한 공유 링크를 얻지 못했습니다.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error sharing image:", error);
      toast({
        title: "공유 실패",
        description: "이미지 공유 링크 생성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold">전체 이미지 갤러리 (관리자 모니터링)</h2>
          <p className="text-sm text-gray-600 mt-1">
            {totalImages > 0 && `총 ${totalImages}개 이미지 • 썸네일 우선 로딩으로 최적화됨`}
          </p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => refetch()} 
            size="sm" 
            variant="outline"
            disabled={isLoading}
          >
            {isLoading ? "새로고침 중..." : "새로고침"}
          </Button>
        </div>
      </div>
      
      {isLoading && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-600">이미지 로딩 중...</p>
        </div>
      )}
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-medium">이미지 로딩 실패</p>
          <p className="text-sm">{(error as Error).message}</p>
        </div>
      )}
      
      {images.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-lg font-medium">아직 생성된 이미지가 없습니다</p>
          <p className="text-sm">사용자들이 이미지를 생성하면 여기에 표시됩니다</p>
        </div>
      )}
      
      {images.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
            {images.map((image: ImageItem) => (
              <div key={image.id} className="relative group">
                <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden border-2 border-transparent hover:border-blue-300 transition-colors">
                  <img
                    src={image.url || ''} // 썸네일 우선 URL (서버에서 resolveImageUrl 적용됨)
                    alt={image.title || `이미지 ${image.id}`}
                    className="w-full h-full object-cover cursor-pointer transition-transform hover:scale-105"
                    onClick={() => handleViewImage(image)}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      // 인라인 SVG fallback (네트워크 요청 없음)
                      target.src = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23f0f0f0'/%3E%3Ctext x='200' y='200' font-family='Arial' font-size='16' fill='%23999' text-anchor='middle' dominant-baseline='middle'%3EError%3C/text%3E%3C/svg%3E`;
                      target.onerror = null; // 무한 루프 방지
                    }}
                    loading="lazy" // 브라우저 네이티브 lazy loading
                  />
                  
                  {/* 사용자 정보 오버레이 */}
                  <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs">
                    {(image as any).username || '알 수 없음'}
                  </div>
                  
                  {/* 이미지 정보 오버레이 */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent text-white p-3">
                    <div className="font-medium text-sm truncate">{image.title || `이미지 ${image.id}`}</div>
                    <div className="text-xs text-gray-300 flex justify-between items-center">
                      <span>{new Date(image.createdAt).toLocaleDateString()}</span>
                      <span className="bg-blue-500 px-2 py-0.5 rounded-full text-xs">
                        ID: {image.id}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-4 py-4 border-t">
              <Button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                size="sm"
                variant="outline"
              >
                처음
              </Button>
              <Button
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
                size="sm"
                variant="outline"
              >
                이전
              </Button>
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">
                  페이지 {currentPage} / {totalPages}
                </span>
                <span className="text-xs text-gray-500">
                  (총 {totalImages}개 이미지)
                </span>
              </div>
              <Button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
                size="sm"
                variant="outline"
              >
                다음
              </Button>
              <Button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                size="sm"
                variant="outline"
              >
                마지막
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function LanguageSettings() {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h2 className="text-xl font-semibold mb-6">언어 설정</h2>
      <p className="text-gray-600">언어 설정 기능은 곧 추가될 예정입니다.</p>
    </div>
  );
}

// Main admin component
export default function AdminPage() {
  const [, navigate] = useLocation();
  
  // 각 메인 탭의 유효한 서브탭 목록
  const validSubTabs: Record<string, string[]> = {
    'chat-menu': ['chat-characters', 'chat-categories'],
    'image-menu': ['image-concepts', 'image-categories', 'snapshot-prompts', 'bg-removal', 'image-gallery'],
    'milestones': ['milestone-items', 'campaign-milestones', 'milestone-categories', 'application-management'],
    'missions': ['categories', 'missions', 'review'],
    'ui-content': ['banners', 'style-cards', 'categories', 'service-items'],
    'member-management': ['members', 'hospitals', 'hospital-codes'],
    'photobook-management': ['photobook-templates', 'photobook-backgrounds', 'photobook-icons', 'photobook-categories'],
  };
  
  // 각 메인 탭의 기본 서브탭
  const defaultSubTabs: Record<string, string> = {
    'chat-menu': 'chat-characters',
    'image-menu': 'image-concepts',
    'milestones': 'milestone-items',
    'missions': 'categories',
    'ui-content': 'banners',
    'member-management': 'members',
    'photobook-management': 'photobook-templates',
  };
  
  // URL 쿼리 파라미터에서 탭 상태 읽기
  const getTabFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'chat-menu';
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
      
      <Tabs defaultValue="chat-menu" value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="w-full flex flex-wrap mb-8">
          <TabsTrigger value="chat-menu">채팅 메뉴</TabsTrigger>
          <TabsTrigger value="image-menu">이미지 생성</TabsTrigger>
          <TabsTrigger value="music-prompts">음악 프롬프트</TabsTrigger>
          <TabsTrigger value="milestones">마일스톤</TabsTrigger>
          <TabsTrigger value="missions">미션 시스템</TabsTrigger>
          <TabsTrigger value="photobook-management">포토북 관리</TabsTrigger>
          <TabsTrigger value="ui-content">UI 컨텐츠 관리</TabsTrigger>
          <TabsTrigger value="member-management">회원관리</TabsTrigger>
          <TabsTrigger value="system-settings">시스템 설정</TabsTrigger>
          <TabsTrigger value="languages">언어 설정</TabsTrigger>

        </TabsList>
        
        <TabsContent value="chat-menu">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">채팅 메뉴</h2>
            
            <Tabs value={activeSubTab || 'chat-characters'} onValueChange={handleSubTabChange}>
              <TabsList>
                <TabsTrigger value="chat-characters">채팅 캐릭터</TabsTrigger>
                <TabsTrigger value="chat-categories">채팅 카테고리</TabsTrigger>
              </TabsList>
              
              <TabsContent value="chat-characters">
                <div className="mt-6">
                  <PersonaManager />
                </div>
              </TabsContent>
              
              <TabsContent value="chat-categories">
                <div className="mt-6">
                  <CategoryManager />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
        
        <TabsContent value="image-menu">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">이미지 생성</h2>
            
            <Tabs value={activeSubTab || 'image-concepts'} onValueChange={handleSubTabChange}>
              <TabsList>
                <TabsTrigger value="image-concepts">이미지 컨셉</TabsTrigger>
                <TabsTrigger value="image-categories">이미지 카테고리</TabsTrigger>
                <TabsTrigger value="snapshot-prompts">스냅샷 프롬프트</TabsTrigger>
                <TabsTrigger value="bg-removal">배경제거</TabsTrigger>
                <TabsTrigger value="image-gallery">이미지 갤러리</TabsTrigger>
              </TabsList>
              
              <TabsContent value="image-concepts">
                <div className="mt-6">
                  <ConceptManagement />
                </div>
              </TabsContent>
              
              <TabsContent value="image-categories">
                <div className="mt-6">
                  <ConceptCategoryManager />
                </div>
              </TabsContent>
              
              <TabsContent value="snapshot-prompts">
                <div className="mt-6">
                  <SnapshotPromptManagement />
                </div>
              </TabsContent>
              
              <TabsContent value="bg-removal">
                <div className="mt-6">
                  <BackgroundRemovalManagement />
                </div>
              </TabsContent>
              
              <TabsContent value="image-gallery">
                <div className="mt-6">
                  <ImageGallery />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
        
        <TabsContent value="music-prompts">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">음악 프롬프트 관리</h2>
            <MusicStylePromptManager />
          </div>
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
        
        <TabsContent value="missions">
          <div className="mt-4">
            <ErrorBoundary>
              <MissionManagement 
                activeSubTab={activeSubTab || 'categories'} 
                onSubTabChange={handleSubTabChange}
                activeMissionId={activeMissionId}
                activeSubmissionId={activeSubmissionId}
                onMissionSelect={handleMissionSelect}
                onSubmissionSelect={handleSubmissionSelect}
              />
            </ErrorBoundary>
          </div>
        </TabsContent>
        
        <TabsContent value="ui-content">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">UI 컨텐츠 관리</h2>
            
            <Tabs value={activeSubTab || 'banners'} onValueChange={handleSubTabChange}>
              <TabsList>
                <TabsTrigger value="banners">슬라이드 배너</TabsTrigger>
                <TabsTrigger value="style-cards">간단 배너 관리</TabsTrigger>
                <TabsTrigger value="popular-styles">인기스타일</TabsTrigger>
                <TabsTrigger value="main-gallery">메인갤러리</TabsTrigger>
                <TabsTrigger value="categories">카테고리</TabsTrigger>
                <TabsTrigger value="service-items">하위 메뉴</TabsTrigger>
              </TabsList>
              
              <TabsContent value="banners">
                <div className="mt-6">
                  <BannerManagement />
                </div>
              </TabsContent>
              
              <TabsContent value="style-cards">
                <div className="mt-6">
                  <SmallBannerManagement />
                </div>
              </TabsContent>

              <TabsContent value="popular-styles">
                <div className="mt-6">
                  <PopularStyleManagement />
                </div>
              </TabsContent>

              <TabsContent value="main-gallery">
                <div className="mt-6">
                  <MainGalleryManagement />
                </div>
              </TabsContent>

              <TabsContent value="categories">
                <div className="mt-6">
                  <CategoryManagement />
                </div>
              </TabsContent>
              
              <TabsContent value="service-items">
                <div className="mt-6">
                  <ServiceItemManagement />
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
        
        <TabsContent value="photobook-management">
          <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Book className="h-6 w-6" />
              포토북 관리
            </h2>
            
            <Tabs value={activeSubTab || 'photobook-templates'} onValueChange={handleSubTabChange}>
              <TabsList>
                <TabsTrigger value="photobook-templates">템플릿 관리</TabsTrigger>
                <TabsTrigger value="photobook-backgrounds">배경 관리</TabsTrigger>
                <TabsTrigger value="photobook-icons">아이콘 관리</TabsTrigger>
                <TabsTrigger value="photobook-categories">카테고리 관리</TabsTrigger>
              </TabsList>
              
              <TabsContent value="photobook-templates">
                <div className="mt-4">
                  <ErrorBoundary>
                    <PhotobookTemplateManagement />
                  </ErrorBoundary>
                </div>
              </TabsContent>
              
              <TabsContent value="photobook-backgrounds">
                <div className="mt-4">
                  <ErrorBoundary>
                    <PhotobookBackgroundManagement />
                  </ErrorBoundary>
                </div>
              </TabsContent>
              
              <TabsContent value="photobook-icons">
                <div className="mt-4">
                  <ErrorBoundary>
                    <PhotobookIconManagement />
                  </ErrorBoundary>
                </div>
              </TabsContent>
              
              <TabsContent value="photobook-categories">
                <div className="mt-4">
                  <ErrorBoundary>
                    <PhotobookMaterialCategoryManagement />
                  </ErrorBoundary>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>
        
        <TabsContent value="languages">
          <LanguageSettings />
        </TabsContent>

      </Tabs>
    </div>
  );
}

// PersonaManager component for managing chat characters
function PersonaManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBatchImportOpen, setIsBatchImportOpen] = useState(false);
  const [editingPersona, setEditingPersona] = useState<InsertPersona | null>(null);
  const queryClient = useQueryClient();
  
  // Fetch personas
  const { data: personas, isLoading, error } = useQuery({
    queryKey: ["/api/admin/personas"],
  });
  
  // Fetch categories for select dropdown
  const { data: categories } = useQuery({
    queryKey: ["/api/admin/categories"],
  });
  
  // Handler for editing a persona
  const handleEditPersona = (persona: InsertPersona) => {
    setEditingPersona(persona);
    setIsEditDialogOpen(true);
  };
  
  // Delete persona mutation
  const deletePersonaMutation = useMutation({
    mutationFn: (personaId: string) => apiRequest(`/api/admin/personas/${personaId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      toast({
        title: "Character deleted",
        description: "The character has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete character. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting persona:", error);
    },
  });
  
  // Handler for deleting a persona
  const handleDeletePersona = (personaId: string) => {
    if (window.confirm("Are you sure you want to delete this character? This action cannot be undone.")) {
      deletePersonaMutation.mutate(personaId);
    }
  };
  
  // Toggle persona active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ personaId, isActive }: { personaId: string; isActive: boolean }) => {
      const persona = personas.find(p => p.personaId === personaId);
      return apiRequest(`/api/admin/personas/${personaId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...persona,
          isActive,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update character status. Please try again.",
        variant: "destructive",
      });
      console.error("Error toggling persona status:", error);
    },
  });
  
  // Toggle featured status mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ personaId, isFeatured }: { personaId: string; isFeatured: boolean }) => {
      const persona = personas.find(p => p.personaId === personaId);
      return apiRequest(`/api/admin/personas/${personaId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...persona,
          isFeatured,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update featured status. Please try again.",
        variant: "destructive",
      });
      console.error("Error toggling featured status:", error);
    },
  });
  
  if (isLoading) {
    return <div className="text-center py-10">Loading characters...</div>;
  }
  
  if (error) {
    return <div className="text-center py-10 text-red-500">Error loading characters. Please refresh the page.</div>;
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">채팅 캐릭터</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBatchImportOpen(true)}>
            <Download className="h-4 w-4 mr-2" />
            일괄 가져오기
          </Button>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            새 캐릭터 추가
          </Button>
        </div>
      </div>
      
      {personas && personas.length > 0 ? (
        <Card className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>캐릭터</TableHead>
                <TableHead>카테고리</TableHead>
                <TableHead>시간대</TableHead>
                <TableHead>활성화</TableHead>
                <TableHead>추천</TableHead>
                <TableHead>작업</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {personas.map((persona) => (
                <TableRow key={persona.personaId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{persona.avatarEmoji}</span>
                      <div>
                        <div>{persona.name}</div>
                        <div className="text-xs text-gray-500">{persona.description.substring(0, 50)}...</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {persona.categories && Array.isArray(persona.categories) && persona.categories.map((categoryId) => {
                        const category = categories?.find(c => c.categoryId === categoryId);
                        return category ? (
                          <Badge key={categoryId} variant="outline" className="text-xs">
                            {category.emoji} {category.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {persona.timeOfDay}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={persona.isActive} 
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ personaId: persona.personaId, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Switch 
                      checked={persona.isFeatured} 
                      onCheckedChange={(checked) => 
                        toggleFeaturedMutation.mutate({ personaId: persona.personaId, isFeatured: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditPersona(persona)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeletePersona(persona.personaId)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">캐릭터가 없습니다. 첫 번째 캐릭터를 만들어보세요!</p>
        </div>
      )}
      
      {/* Create Persona Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>새 캐릭터 만들기</DialogTitle>
            <DialogDescription>
              시스템에 새 AI 채팅 캐릭터를 추가합니다.
            </DialogDescription>
          </DialogHeader>
          
          <PersonaForm 
            categories={categories || []} 
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* Edit Persona Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>캐릭터 편집</DialogTitle>
            <DialogDescription>
              이 AI 채팅 캐릭터의 세부 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          
          {editingPersona && (
            <PersonaForm 
              categories={categories || []} 
              initialData={editingPersona}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Batch Import Dialog */}
      <Dialog open={isBatchImportOpen} onOpenChange={setIsBatchImportOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>캐릭터 일괄 가져오기</DialogTitle>
            <DialogDescription>
              JSON 형식에서 여러 캐릭터를 가져옵니다.
            </DialogDescription>
          </DialogHeader>
          
          {isBatchImportOpen && (
            <BatchImportDialog 
              onSuccess={() => {
                setIsBatchImportOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
              }}
              categories={categories || []}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form component for creating/editing personas
interface PersonaFormProps {
  initialData?: InsertPersona;
  categories: InsertPersonaCategory[];
  onSuccess: () => void;
}

function PersonaForm({ initialData, categories, onSuccess }: PersonaFormProps) {
  const queryClient = useQueryClient();
  const [emotionalKeyword, setEmotionalKeyword] = useState("");
  
  // Set up form
  const form = useForm<z.infer<typeof personaFormSchema>>({
    resolver: zodResolver(personaFormSchema),
    defaultValues: initialData || {
      personaId: "",
      name: "",
      avatarEmoji: "😊",
      description: "",
      welcomeMessage: "",
      systemPrompt: "",
      primaryColor: "#7c3aed",
      secondaryColor: "#ddd6fe",
      personality: "",
      tone: "",
      usageContext: "",
      emotionalKeywords: [],
      timeOfDay: "all",
      isActive: true,
      isFeatured: false,
      order: 0,
      categories: [],
    },
  });
  
  // Create/update persona mutation
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof personaFormSchema>) => {
      if (initialData) {
        // Update existing persona
        return apiRequest(`/api/admin/personas/${initialData.personaId}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
      } else {
        // Create new persona
        return apiRequest("/api/admin/personas", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
    },
    onSuccess: () => {
      toast({
        title: initialData ? "Character updated" : "Character created",
        description: initialData 
          ? "The character has been updated successfully." 
          : "The new character has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/personas"] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: initialData 
          ? "Failed to update character. Please try again." 
          : "Failed to create character. Please try again.",
        variant: "destructive",
      });
      console.error("Error saving persona:", error);
    },
  });
  
  // Submit handler
  function onSubmit(values: z.infer<typeof personaFormSchema>) {
    mutation.mutate(values);
  }
  
  // Add emotional keyword
  const addEmotionalKeyword = () => {
    if (emotionalKeyword.trim() && !form.getValues("emotionalKeywords")?.includes(emotionalKeyword.trim())) {
      const currentKeywords = form.getValues("emotionalKeywords") || [];
      form.setValue("emotionalKeywords", [...currentKeywords, emotionalKeyword.trim()]);
      setEmotionalKeyword("");
    }
  };
  
  // Remove emotional keyword
  const removeEmotionalKeyword = (keyword: string) => {
    const currentKeywords = form.getValues("emotionalKeywords") || [];
    form.setValue(
      "emotionalKeywords", 
      currentKeywords.filter(k => k !== keyword)
    );
  };
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column */}
          <div className="space-y-4">
            {/* Basic info */}
            <div className="space-y-4">
              <h3 className="text-md font-semibold">기본 정보</h3>
              
              <FormField
                control={form.control}
                name="personaId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ID</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="unique-id" 
                        {...field} 
                        disabled={!!initialData}
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
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Character name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="avatarEmoji"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Avatar Emoji</FormLabel>
                    <FormControl>
                      <Input placeholder="Emoji" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Short description of this character" 
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Messages & prompts */}
            <div className="space-y-4 pt-4">
              <h3 className="text-md font-semibold">Messages & Prompts</h3>
              
              <FormField
                control={form.control}
                name="welcomeMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Welcome Message</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Message shown when this character is selected" 
                        className="resize-none" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="systemPrompt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>System Prompt</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Instructions for AI on how to behave as this character" 
                        className="resize-none h-40" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
          
          {/* Right column */}
          <div className="space-y-4">
            {/* Colors */}
            <div className="space-y-4">
              <h3 className="text-md font-semibold">Theme Colors</h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="primaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Color</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <Input 
                            type="color" 
                            className="w-12 h-10 p-1 mr-2" 
                            {...field} 
                          />
                          <Input 
                            type="text" 
                            placeholder="#000000" 
                            value={field.value} 
                            onChange={field.onChange}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="secondaryColor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Secondary Color</FormLabel>
                      <FormControl>
                        <div className="flex">
                          <Input 
                            type="color" 
                            className="w-12 h-10 p-1 mr-2" 
                            {...field} 
                          />
                          <Input 
                            type="text" 
                            placeholder="#000000" 
                            value={field.value} 
                            onChange={field.onChange}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Character attributes */}
            <div className="space-y-4 pt-4">
              <h3 className="text-md font-semibold">Character Attributes</h3>
              
              <FormField
                control={form.control}
                name="personality"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personality</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Warm, empathetic, gentle" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tone</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Reassuring and calm" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="usageContext"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usage Context</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., For moms struggling emotionally after birth" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="emotionalKeywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emotional Keywords</FormLabel>
                    <div className="flex mb-2">
                      <Input 
                        placeholder="e.g., anxious, overwhelmed" 
                        value={emotionalKeyword}
                        onChange={(e) => setEmotionalKeyword(e.target.value)}
                        className="mr-2"
                      />
                      <Button 
                        type="button"
                        onClick={addEmotionalKeyword}
                        variant="outline"
                        disabled={!emotionalKeyword.trim()}
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {form.watch("emotionalKeywords")?.map((keyword) => (
                        <Badge key={keyword} variant="secondary" className="flex items-center gap-1">
                          {keyword}
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            className="h-4 w-4 p-0 ml-1"
                            onClick={() => removeEmotionalKeyword(keyword)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </Badge>
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="timeOfDay"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Time of Day Relevance</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a time of day" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="morning">Morning</SelectItem>
                        <SelectItem value="afternoon">Afternoon</SelectItem>
                        <SelectItem value="evening">Evening</SelectItem>
                        <SelectItem value="night">Night</SelectItem>
                        <SelectItem value="all">All Day</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            {/* Categories */}
            <div className="space-y-4 pt-4">
              <h3 className="text-md font-semibold">Categories & Admin</h3>
              
              <FormField
                control={form.control}
                name="categories"
                render={() => (
                  <FormItem>
                    <FormLabel>Categories</FormLabel>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {categories.map((category) => (
                        <FormField
                          key={category.categoryId}
                          control={form.control}
                          name="categories"
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={category.categoryId}
                                className="flex flex-row items-start space-x-3 space-y-0"
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={(field.value || []).includes(category.categoryId)}
                                    onCheckedChange={(checked) => {
                                      const currentValues = field.value || [];
                                      if (checked) {
                                        form.setValue("categories", [
                                          ...currentValues,
                                          category.categoryId,
                                        ]);
                                      } else {
                                        form.setValue(
                                          "categories",
                                          currentValues.filter(
                                            (value) => value !== category.categoryId
                                          )
                                        );
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="font-normal cursor-pointer">
                                  {category.emoji} {category.name}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4 pt-4">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <FormLabel>Active</FormLabel>
                        <FormDescription className="text-xs">
                          Show in user interface
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
                
                <FormField
                  control={form.control}
                  name="isFeatured"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-0.5">
                        <FormLabel>Featured</FormLabel>
                        <FormDescription className="text-xs">
                          Promote to users
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
              </div>
              
              <FormField
                control={form.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display Order</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
        
        <DialogFooter>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              "Saving..."
            ) : initialData ? (
              "Update Character"
            ) : (
              "Create Character"
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// CategoryManager component for managing categories
function CategoryManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InsertPersonaCategory | null>(null);
  const queryClient = useQueryClient();
  
  // Fetch categories
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ["/api/admin/categories"],
  });
  
  // Handler for editing a category
  const handleEditCategory = (category: InsertPersonaCategory) => {
    setEditingCategory(category);
    setIsEditDialogOpen(true);
  };
  
  // Delete category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => apiRequest(`/api/admin/categories/${categoryId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      toast({
        title: "Category deleted",
        description: "The category has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete category. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting category:", error);
    },
  });
  
  // Handler for deleting a category
  const handleDeleteCategory = (categoryId: string) => {
    if (window.confirm("Are you sure you want to delete this category? This may affect characters assigned to it.")) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };
  
  // Toggle category active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) => {
      const category = categories.find(c => c.categoryId === categoryId);
      return apiRequest(`/api/admin/categories/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...category,
          isActive,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update category status. Please try again.",
        variant: "destructive",
      });
      console.error("Error toggling category status:", error);
    },
  });
  
  if (isLoading) {
    return <div className="text-center py-10">Loading categories...</div>;
  }
  
  if (error) {
    return <div className="text-center py-10 text-red-500">Error loading categories. Please refresh the page.</div>;
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Categories</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add New Category
        </Button>
      </div>
      
      {categories && categories.length > 0 ? (
        <Card className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category) => (
                <TableRow key={category.categoryId}>
                  <TableCell className="font-medium">
                    <div className="flex items-center space-x-2">
                      <span className="text-2xl">{category.emoji}</span>
                      <div>{category.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>{category.description}</TableCell>
                  <TableCell>{category.order}</TableCell>
                  <TableCell>
                    <Switch 
                      checked={category.isActive} 
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ categoryId: category.categoryId, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.categoryId)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">No categories found. Create your first category!</p>
        </div>
      )}
      
      {/* Create Category Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Add a new category for organizing chat characters.
            </DialogDescription>
          </DialogHeader>
          
          <CategoryForm 
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
            <DialogDescription>
              Modify this category's details.
            </DialogDescription>
          </DialogHeader>
          
          {editingCategory && (
            <CategoryForm 
              initialData={editingCategory}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form component for creating/editing categories
interface CategoryFormProps {
  initialData?: InsertPersonaCategory;
  onSuccess: () => void;
}

function CategoryForm({ initialData, onSuccess }: CategoryFormProps) {
  const queryClient = useQueryClient();
  
  // Set up form
  const form = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: initialData || {
      categoryId: "",
      name: "",
      description: "",
      emoji: "✨",
      order: 0,
      isActive: true,
    },
  });
  
  // Create/update category mutation
  const mutation = useMutation({
    mutationFn: (values: z.infer<typeof categoryFormSchema>) => {
      if (initialData) {
        // Update existing category
        return apiRequest(`/api/admin/categories/${initialData.categoryId}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
      } else {
        // Create new category
        return apiRequest("/api/admin/categories", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
    },
    onSuccess: () => {
      toast({
        title: initialData ? "Category updated" : "Category created",
        description: initialData 
          ? "The category has been updated successfully." 
          : "The new category has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/categories"] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: initialData 
          ? "Failed to update category. Please try again." 
          : "Failed to create category. Please try again.",
        variant: "destructive",
      });
      console.error("Error saving category:", error);
    },
  });
  
  // Submit handler
  function onSubmit(values: z.infer<typeof categoryFormSchema>) {
    mutation.mutate(values);
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ID</FormLabel>
              <FormControl>
                <Input 
                  placeholder="unique-id" 
                  {...field} 
                  disabled={!!initialData}
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
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="Category name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Input placeholder="Short description" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="emoji"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Emoji</FormLabel>
              <FormControl>
                <Input placeholder="Category emoji" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Order</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between p-4 border rounded-lg">
                <div className="space-y-0.5">
                  <FormLabel>Active</FormLabel>
                  <FormDescription className="text-xs">
                    Show in user interface
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
        </div>
        
        <DialogFooter>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              "Saving..."
            ) : initialData ? (
              "Update Category"
            ) : (
              "Create Category"
            )}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
// ConceptCategoryManager component
function ConceptCategoryManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InsertConceptCategory | null>(null);
  const queryClient = useQueryClient();
  
  // Fetch concept categories
  const { data: categories, isLoading, error } = useQuery({
    queryKey: ["/api/admin/concept-categories"],
    queryFn: getQueryFn()
  });
  
  // Handler for editing a category
  const handleEditCategory = (category: InsertConceptCategory) => {
    setEditingCategory(category);
    setIsEditDialogOpen(true);
  };
  
  // Delete concept category mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => apiRequest(`/api/admin/concept-categories/${categoryId}`, {
      method: "DELETE"
    }),
    onSuccess: () => {
      toast({
        title: "Category deleted",
        description: "The image concept category has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/concept-categories"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete category. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting concept category:", error);
    },
  });
  
  // Handler for deleting a category
  const handleDeleteCategory = (categoryId: string) => {
    if (window.confirm("Are you sure you want to delete this category? This action cannot be undone and may affect associated concepts.")) {
      deleteCategoryMutation.mutate(categoryId);
    }
  };
  
  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ categoryId, isActive }: { categoryId: string; isActive: boolean }) => {
      const category = categories.find((c: any) => c.categoryId === categoryId);
      return apiRequest(`/api/admin/concept-categories/${categoryId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...category,
          isActive,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/concept-categories"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update category status. Please try again.",
        variant: "destructive",
      });
      console.error("Error toggling category status:", error);
    },
  });
  
  if (isLoading) {
    return <div className="text-center py-10">Loading concept categories...</div>;
  }
  
  if (error) {
    return <div className="text-center py-10 text-red-500">Error loading concept categories. Please refresh the page.</div>;
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Image Generation Categories</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Add New Category
        </Button>
      </div>
      
      {categories && categories.length > 0 ? (
        <Card className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((category: any) => (
                <TableRow key={category.categoryId}>
                  <TableCell className="font-medium">
                    {category.name}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {category.description}
                  </TableCell>
                  <TableCell>{category.order}</TableCell>
                  <TableCell>
                    <Switch 
                      checked={category.isActive} 
                      onCheckedChange={(checked) => 
                        toggleActiveMutation.mutate({ categoryId: category.categoryId, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEditCategory(category)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(category.categoryId)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">No concept categories found. Create your first category!</p>
        </div>
      )}
      
      {/* Create Category Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Concept Category</DialogTitle>
            <DialogDescription>
              Add a new category for AI image generation concepts.
            </DialogDescription>
          </DialogHeader>
          
          <ConceptCategoryForm 
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/admin/concept-categories"] });
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* Edit Category Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Concept Category</DialogTitle>
            <DialogDescription>
              Modify this concept category's details.
            </DialogDescription>
          </DialogHeader>
          
          {editingCategory && (
            <ConceptCategoryForm 
              initialData={editingCategory}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/admin/concept-categories"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form component for creating/editing concept categories
interface ConceptCategoryFormProps {
  initialData?: InsertConceptCategory;
  onSuccess: () => void;
}

function ConceptCategoryForm({ initialData, onSuccess }: ConceptCategoryFormProps) {
  const queryClient = useQueryClient();
  
  // Set up form
  const form = useForm({
    resolver: zodResolver(conceptCategorySchema),
    defaultValues: initialData || {
      categoryId: "",
      name: "",
      description: "",
      systemPrompt: "",
      order: 0,
      isActive: true,
    },
  });
  
  // Create/update mutation
  const submitMutation = useMutation({
    mutationFn: (values: z.infer<typeof conceptCategorySchema>) => {
      if (initialData) {
        return apiRequest(`/api/admin/concept-categories/${initialData.categoryId}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
      } else {
        return apiRequest("/api/admin/concept-categories", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
    },
    onSuccess: () => {
      toast({
        title: initialData ? "Category updated" : "Category created",
        description: initialData ? 
          "The concept category has been updated successfully" : 
          "The concept category has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/concept-categories"] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${initialData ? 'update' : 'create'} concept category. Please try again.`,
        variant: "destructive",
      });
      console.error(`Error ${initialData ? 'updating' : 'creating'} concept category:`, error);
    },
  });
  
  function onSubmit(values: z.infer<typeof conceptCategorySchema>) {
    submitMutation.mutate(values);
  }
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category ID</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="unique-id" 
                    {...field} 
                    disabled={!!initialData}
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
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Category name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Order</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="isActive"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <Checkbox
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Active</FormLabel>
                  <p className="text-sm text-gray-500">
                    Enable or disable this category
                  </p>
                </div>
              </FormItem>
            )}
          />
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe this concept category" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="systemPrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GPT-4o 이미지 분석 지침</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="GPT-4o에게 이미지 분석 시 어떤 지침을 제공할지 입력하세요. 예: '이미지 속 인물의 얼굴, 포즈, 배경을 자세히 분석하고 인물의 특징을 유지하세요.'" 
                  className="min-h-[150px]"
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                이 지침은 이미지를 분석할 때 GPT-4o가 이미지의 어떤 부분을 우선적으로 분석할지, 어떤 특징을 유지할지 결정합니다.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {initialData ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>{initialData ? "Update" : "Create"} Category</>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// ConceptManager component for managing image generation concepts
function ConceptManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingConcept, setEditingConcept] = useState<InsertConcept | null>(null);
  const queryClient = useQueryClient();
  
  // Fetch concepts
  const { data: concepts, isLoading, error } = useQuery({
    queryKey: ["/api/admin/concepts"],
    queryFn: getQueryFn()
  });
  
  // Fetch concept categories for select dropdown
  const { data: categories } = useQuery({
    queryKey: ["/api/admin/concept-categories"],
    queryFn: getQueryFn()
  });
  
  // Handler for editing a concept
  const handleEditConcept = (concept: InsertConcept) => {
    setEditingConcept(concept);
    setIsEditDialogOpen(true);
  };
  
  // Delete concept mutation
  const deleteConceptMutation = useMutation({
    mutationFn: (conceptId: string) => apiRequest(`/api/admin/concepts/${conceptId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      toast({
        title: "Concept deleted",
        description: "The concept has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/concepts"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete concept. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting concept:", error);
    },
  });
  
  // Handler for deleting a concept
  const handleDeleteConcept = (conceptId: string) => {
    if (window.confirm("Are you sure you want to delete this concept? This action cannot be undone.")) {
      deleteConceptMutation.mutate(conceptId);
    }
  };
  
  // Toggle active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ conceptId, isActive }: { conceptId: string; isActive: boolean }) => {
      const concept = concepts.find((c: Concept) => c.conceptId === conceptId);
      
      // 디버깅용 로그 추가
      console.log("Toggling active status for concept:", concept);
      
      return apiRequest(`/api/admin/concepts/${conceptId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...concept,
          isActive,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/concepts"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update concept status. Please try again.",
        variant: "destructive",
      });
      console.error("Error toggling concept status:", error);
    },
  });
  
  // Toggle featured status mutation
  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ conceptId, isFeatured }: { conceptId: string; isFeatured: boolean }) => {
      const concept = concepts.find((c: Concept) => c.conceptId === conceptId);
      
      // 디버깅용 로그 추가
      console.log("Toggling featured status for concept:", concept);
      
      return apiRequest(`/api/admin/concepts/${conceptId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...concept,
          isFeatured,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/concepts"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update featured status. Please try again.",
        variant: "destructive",
      });
      console.error("Error toggling featured status:", error);
    },
  });
  
  // A/B Test tab state
  const [abTestTabActive, setAbTestTabActive] = useState(false);
  
  if (isLoading) {
    return <div className="text-center py-10">Loading concepts...</div>;
  }
  
  if (error) {
    return <div className="text-center py-10 text-red-500">Error loading concepts. Please refresh the page.</div>;
  }
  
  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h2 className="text-2xl font-bold">Image Generation Concepts</h2>
        
        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-2">
          <Tabs value={abTestTabActive ? "ab-test" : "concepts"} onValueChange={(val) => setAbTestTabActive(val === "ab-test")} className="w-full md:w-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="concepts">Concepts</TabsTrigger>
              <TabsTrigger value="ab-test">A/B Testing</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <Button onClick={() => setIsCreateDialogOpen(true)} className="w-full sm:w-auto">
            <PlusCircle className="h-4 w-4 mr-2" />
            Add New Concept
          </Button>
        </div>
      </div>
      
      {abTestTabActive ? (
        <Card className="py-12">
          <div className="text-center flex flex-col items-center justify-center gap-4 px-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-2">
              <PlusCircle className="h-8 w-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold">Coming Soon: A/B Testing For Image Prompts</h3>
            <p className="text-gray-500 max-w-xl">
              Track image performance by prompt variation. Compare different prompts for the same concept and see which performs better with your users.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
              <div className="border border-dashed rounded-lg p-4 bg-gray-50">
                <p className="font-medium mb-2">Prompt A</p>
                <p className="text-sm text-gray-500">Compare performance metrics for different prompt variations</p>
              </div>
              <div className="border border-dashed rounded-lg p-4 bg-gray-50">
                <p className="font-medium mb-2">Prompt B</p>
                <p className="text-sm text-gray-500">See which prompt generates images that users prefer</p>
              </div>
            </div>
          </div>
        </Card>
      ) : concepts && concepts.length > 0 ? (
        <Card className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {concepts.map((concept: Concept) => {
                const category = categories?.find((c: ConceptCategory) => c.categoryId === concept.categoryId);
                console.log('Concept thumbnail URL:', concept.conceptId, concept.thumbnailUrl);
                
                return (
                  <TableRow key={concept.conceptId}>
                    <TableCell className="font-medium">
                      <div className="flex items-start space-x-2">
                        {concept.thumbnailUrl ? (
                          <div className="group relative">
                            <img 
                              src={concept.thumbnailUrl}
                              alt={concept.title} 
                              className="w-10 h-10 rounded object-cover cursor-pointer"
                              onError={(e) => {
                                console.error('Failed to load concept thumbnail:', concept.thumbnailUrl);
                                e.currentTarget.src = 'https://placehold.co/100x100/F5F5F5/AAAAAA?text=No+Image';
                              }}
                            />
                            <div className="absolute left-0 -top-24 transform scale-0 group-hover:scale-100 transition-transform origin-bottom z-50 pointer-events-none">
                              <img 
                                src={concept.thumbnailUrl}
                                alt={concept.title} 
                                className="w-40 h-40 rounded-md object-cover shadow-lg"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                            <span className="text-gray-400 text-xs">No img</span>
                          </div>
                        )}
                        <div>
                          <div>{concept.title}</div>
                          <div className="text-xs text-gray-500 truncate max-w-xs">{concept.description}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {category ? category.name : concept.categoryId}
                    </TableCell>
                    <TableCell>
                      {concept.variables && Array.isArray(concept.variables) ? (
                        <Badge variant="outline">{concept.variables.length} vars</Badge>
                      ) : (
                        <Badge variant="outline">0 vars</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                        DALL-E
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch 
                        checked={concept.isActive} 
                        onCheckedChange={(checked) => 
                          toggleActiveMutation.mutate({ conceptId: concept.conceptId, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Switch 
                        checked={concept.isFeatured} 
                        onCheckedChange={(checked) => 
                          toggleFeaturedMutation.mutate({ conceptId: concept.conceptId, isFeatured: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditConcept(concept)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteConcept(concept.conceptId)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">No concepts found. Create your first concept!</p>
        </div>
      )}
      
      {/* Create Concept Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Concept</DialogTitle>
            <DialogDescription>
              Add a new AI image generation concept.
            </DialogDescription>
          </DialogHeader>
          
          <ConceptForm 
            categories={categories || []} 
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/admin/concepts"] });
            }}
          />
        </DialogContent>
      </Dialog>
      
      {/* Edit Concept Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Concept</DialogTitle>
            <DialogDescription>
              Modify this concept's details.
            </DialogDescription>
          </DialogHeader>
          
          {editingConcept && (
            <ConceptForm 
              categories={categories || []} 
              initialData={editingConcept}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/admin/concepts"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form component for creating/editing concepts
interface ConceptFormProps {
  initialData?: InsertConcept;
  categories: any[];
  onSuccess: () => void;
}

function ConceptForm({ initialData, categories, onSuccess }: ConceptFormProps) {
  const queryClient = useQueryClient();
  const [variableDialogOpen, setVariableDialogOpen] = useState(false);
  const [editingVariableIndex, setEditingVariableIndex] = useState<number | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewValues, setPreviewValues] = useState<{[key: string]: string}>({});
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(initialData?.thumbnailUrl || null);
  const [uploadingReferenceImage, setUploadingReferenceImage] = useState(false);
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(initialData?.referenceImageUrl || null);

  // 병원 목록 조회
  const { data: hospitals } = useQuery({
    queryKey: ["/api/admin/hospitals"],
  });
  
  // Set up form
  const form = useForm({
    resolver: zodResolver(conceptSchema),
    defaultValues: initialData || {
      conceptId: "",
      title: "",
      description: "",
      promptTemplate: "",
      systemPrompt: "",
      thumbnailUrl: "",
      tagSuggestions: [],
      variables: [],
      categoryId: "",
      isActive: true,
      isFeatured: false,
      order: 0,
      visibilityType: "public",
      hospitalId: null,
    },
  });
  
  // Watch form values for prompt preview
  const promptTemplate = form.watch("promptTemplate");
  const variables = form.watch("variables") || [];
  
  // Extract variable names from the prompt template
  const extractVariables = (template: string) => {
    const regex = /\{([^{}]+)\}/g;
    const matches = template.match(regex) || [];
    return matches.map(match => match.slice(1, -1).trim());
  };
  
  const promptVariables = extractVariables(promptTemplate);
  
  const sampleValues: {[key: string]: string} = {
    baby_name: "Minjun",
    mother_name: "Jiyoung",
    father_name: "Sungho",
    birth_month: "May",
    birth_year: "2024",
    pregnancy_week: "28",
    gender: "boy",
    zodiac_sign: "Taurus",
    nickname: "Little Dragon",
    taemyeong: "하늘이", // Korean nickname for unborn baby
    color: "pastel blue",
    season: "spring",
    emotion: "joyful",
    animal: "rabbit"
  };
  
  // Update preview values when variables change
  useEffect(() => {
    const newPreviewValues: {[key: string]: string} = {};
    promptVariables.forEach(varName => {
      // First check if we have a sample value
      if (sampleValues[varName]) {
        newPreviewValues[varName] = sampleValues[varName];
        return;
      }
      
      // Find the variable in the variables array
      const varDef = variables.find((v: any) => v.name === varName);
      
      // Set default preview value based on variable type
      if (varDef) {
        if (varDef.defaultValue !== undefined) {
          newPreviewValues[varName] = String(varDef.defaultValue);
        } else if (varDef.type === 'select' && varDef.options && varDef.options.length > 0) {
          newPreviewValues[varName] = varDef.options[0];
        } else if (varDef.type === 'number') {
          newPreviewValues[varName] = '5';
        } else if (varDef.type === 'boolean') {
          newPreviewValues[varName] = 'true';
        } else {
          newPreviewValues[varName] = `[${varName}]`;
        }
      } else {
        // For variables not defined yet, try to use a sample value or a placeholder
        newPreviewValues[varName] = `[${varName}]`;
      }
    });
    
    setPreviewValues(newPreviewValues);
  }, [promptTemplate, variables]);
  
  // Generate prompt preview with replaced variables
  const getPromptPreview = () => {
    let preview = promptTemplate;
    
    Object.entries(previewValues).forEach(([varName, value]) => {
      preview = preview.replace(new RegExp(`\\{\\s*${varName}\\s*\\}`, 'g'), value);
    });
    
    return preview;
  };
  
  // Handle thumbnail image upload
  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingThumbnail(true);
    
    try {
      const formData = new FormData();
      formData.append("thumbnail", file);
      
      const response = await fetch("/api/admin/upload/thumbnail", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload thumbnail");
      }
      
      const data = await response.json();
      setThumbnailUrl(data.url);
      form.setValue("thumbnailUrl", data.url);
      
      toast({
        title: "Thumbnail uploaded",
        description: "The thumbnail has been uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading thumbnail:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload thumbnail image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingThumbnail(false);
    }
  };
  
  // Handle reference image upload for concept thumbnails
  const handleReferenceImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingReferenceImage(true);
    
    try {
      const formData = new FormData();
      formData.append("thumbnail", file);  // "reference"에서 "thumbnail"로 변경
      
      // 서버가 기대하는 필드명으로 업로드
      const response = await fetch("/api/admin/upload/thumbnail", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload reference image");
      }
      
      const data = await response.json();
      setReferenceImageUrl(data.url);
      form.setValue("referenceImageUrl", data.url);
      
      toast({
        title: "Reference image uploaded",
        description: "The reference image has been uploaded successfully",
      });
    } catch (error) {
      console.error("Error uploading reference image:", error);
      toast({
        title: "Upload failed",
        description: "Failed to upload reference image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploadingReferenceImage(false);
    }
  };
  
  // Create/update mutation
  const submitMutation = useMutation({
    mutationFn: (values: z.infer<typeof conceptSchema>) => {
      if (initialData) {
        return apiRequest(`/api/admin/concepts/${initialData.conceptId}`, {
          method: "PUT",
          body: JSON.stringify(values),
        });
      } else {
        return apiRequest("/api/admin/concepts", {
          method: "POST",
          body: JSON.stringify(values),
        });
      }
    },
    onSuccess: () => {
      toast({
        title: initialData ? "Concept updated" : "Concept created",
        description: initialData ? 
          "The concept has been updated successfully" : 
          "The concept has been created successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/concepts"] });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${initialData ? 'update' : 'create'} concept. Please try again.`,
        variant: "destructive",
      });
      console.error(`Error ${initialData ? 'updating' : 'creating'} concept:`, error);
    },
  });
  
  function onSubmit(values: z.infer<typeof conceptSchema>) {
    // 문제 해결을 위한 디버깅 정보 추가
    console.log("Concept form values before submission:", values);
    console.log("SystemPrompt value:", values.systemPrompt);
    
    submitMutation.mutate(values);
  }
  
  // Update variable form values and add missing variable definitions
  useEffect(() => {
    // For each variable found in the prompt
    promptVariables.forEach(varName => {
      // Check if it exists in the current variables array
      const exists = variables.some((v: any) => v.name === varName);
      
      // If it doesn't exist, add it as a new variable
      if (!exists) {
        const newVariables = [...variables];
        newVariables.push({
          name: varName,
          description: `Description for ${varName}`,
          type: "text",
          required: true
        });
        form.setValue("variables", newVariables);
      }
    });
  }, [promptTemplate]);
  
  // Handle variable preview value change
  const handlePreviewValueChange = (varName: string, value: string) => {
    setPreviewValues({
      ...previewValues,
      [varName]: value
    });
  };
  
  // 탭 관리를 위한 상태
  const [activeTab, setActiveTab] = useState("main");
  
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="main">기본 설정</TabsTrigger>
          </TabsList>
          
          <TabsContent value="main">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="conceptId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Concept ID</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="unique-id" 
                    {...field} 
                    disabled={!!initialData}
                  />
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
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Concept name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select 
                  onValueChange={field.onChange} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {categories.map((category: any) => (
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
            name="visibilityType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>공개 범위</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (value === "public") {
                      form.setValue("hospitalId", null);
                    }
                  }}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="공개 범위 선택" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="public">전체 공개</SelectItem>
                    <SelectItem value="hospital">병원 선택 공개</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.watch("visibilityType") === "hospital" && (
            <FormField
              control={form.control}
              name="hospitalId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    병원 선택
                  </FormLabel>
                  <Select 
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    defaultValue={field.value?.toString()}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="병원을 선택하세요" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hospitals?.data?.map((hospital: any) => (
                        <SelectItem key={hospital.id} value={hospital.id.toString()}>
                          {hospital.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          <FormField
            control={form.control}
            name="thumbnailUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Thumbnail</FormLabel>
                <div className="space-y-3">
                  {field.value && (
                    <div className="border rounded-md overflow-hidden w-32 h-32 relative">
                      <img 
                        src={field.value.startsWith('http') ? field.value : field.value}
                        alt="Concept thumbnail"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.error('Failed to load image:', field.value);
                          e.currentTarget.src = 'https://placehold.co/200x200/F5F5F5/AAAAAA?text=Image+Error';
                        }}
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 rounded-full w-6 h-6"
                        onClick={() => field.onChange("")}
                        type="button"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  )}
                  
                  <div className="flex flex-col space-y-2">
                    <FormControl>
                      <Input 
                        placeholder="https://example.com/image.jpg" 
                        {...field} 
                        value={field.value || ""}
                      />
                    </FormControl>
                    <div className="text-sm text-muted-foreground">
                      Or upload a file:
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            const result = await uploadThumbnail(file);
                            if (result.url) {
                              field.onChange(result.url);
                            }
                          } catch (error) {
                            toast({
                              title: "Upload failed",
                              description: error instanceof Error ? error.message : "Failed to upload image",
                              variant: "destructive"
                            });
                          }
                        }
                      }}
                    />
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="order"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Order</FormLabel>
                <FormControl>
                  <Input type="number" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="flex gap-2">
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex-1 flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Active</FormLabel>
                    <p className="text-sm text-gray-500">
                      Enable or disable this concept
                    </p>
                  </div>
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="isFeatured"
              render={({ field }) => (
                <FormItem className="flex-1 flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Featured</FormLabel>
                    <p className="text-sm text-gray-500">
                      Show in featured section
                    </p>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </div>
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe this concept" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="promptTemplate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Prompt Template</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Create a watercolor style image of {{object}} with {{style_details}}" 
                  className="min-h-32" 
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                Use double curly braces <code className="bg-gray-100 px-1 rounded">{'{{variable_name}}'}</code> to define variables that will be replaced.
                Variables will be automatically added to the variables list below.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="systemPrompt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>GPT-4o 이미지 분석 지침</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="GPT-4o에게 이미지 분석 시 어떤 지침을 제공할지 입력하세요. 예: '이미지 속 인물의 얼굴, 포즈, 배경을 자세히 분석하고 인물의 특징을 유지하세요.'" 
                  className="min-h-[150px]"
                  {...field} 
                />
              </FormControl>
              <FormDescription>
                이 지침은 이미지를 분석할 때 GPT-4o가 이미지의 어떤 부분을 우선적으로 분석할지, 어떤 특징을 유지할지 결정합니다.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {/* Prompt Preview Section */}
        {promptTemplate && (
          <div className="border rounded-md p-4 bg-gray-50">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium">Prompt Preview</h3>
              <Button type="button" variant="outline" size="sm" onClick={() => setPreviewVisible(!previewVisible)}>
                {previewVisible ? "Hide Preview" : "Show Preview"}
              </Button>
            </div>
            
            {previewVisible && (
              <>
                <div className="border bg-white rounded-md p-3 mb-3">
                  <p className="whitespace-pre-wrap">{getPromptPreview()}</p>
                </div>
                
                {promptVariables.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Customize Preview Values:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {promptVariables.map(varName => {
                        const varDef = variables.find((v: any) => v.name === varName);
                        
                        return (
                          <div key={varName} className="flex items-center gap-2">
                            <span className="text-sm font-medium min-w-24">{varName}:</span>
                            {varDef && varDef.type === 'select' ? (
                              <select 
                                className="flex-1 px-2 py-1 border rounded text-sm"
                                value={previewValues[varName] || ''}
                                onChange={(e) => handlePreviewValueChange(varName, e.target.value)}
                              >
                                {(varDef.options || []).map((option: string) => (
                                  <option key={option} value={option}>{option}</option>
                                ))}
                              </select>
                            ) : varDef && varDef.type === 'boolean' ? (
                              <select 
                                className="flex-1 px-2 py-1 border rounded text-sm"
                                value={previewValues[varName] || 'true'}
                                onChange={(e) => handlePreviewValueChange(varName, e.target.value)}
                              >
                                <option value="true">Yes</option>
                                <option value="false">No</option>
                              </select>
                            ) : (
                              <input 
                                type={varDef && varDef.type === 'number' ? 'number' : 'text'}
                                className="flex-1 px-2 py-1 border rounded text-sm"
                                value={previewValues[varName] || ''}
                                onChange={(e) => handlePreviewValueChange(varName, e.target.value)}
                                placeholder={`Value for ${varName}`}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <FormLabel>Variables</FormLabel>
            <Button 
              type="button" 
              variant="outline" 
              size="sm"
              onClick={() => {
                setEditingVariableIndex(null);
                setVariableDialogOpen(true);
              }}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              Add Variable
            </Button>
          </div>
          
          {variables.length > 0 ? (
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Required</TableHead>
                    <TableHead>Used in Prompt</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {variables.map((variable: any, index: number) => {
                    const isUsedInPrompt = promptVariables.includes(variable.name);
                    
                    return (
                      <TableRow key={index} className={!isUsedInPrompt ? "bg-gray-50" : ""}>
                        <TableCell className="font-medium">
                          <div>
                            <div>{variable.name}</div>
                            <div className="text-xs text-gray-500">{variable.description}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{variable.type}</Badge>
                          {variable.type === 'select' && variable.options?.length > 0 && (
                            <div className="text-xs text-gray-500 mt-1">
                              {variable.options.length} options
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {variable.required ? 
                            <CheckCircle className="h-4 w-4 text-green-500" /> : 
                            <X className="h-4 w-4 text-gray-300" />
                          }
                        </TableCell>
                        <TableCell>
                          {isUsedInPrompt ? 
                            <CheckCircle className="h-4 w-4 text-green-500" /> : 
                            <Badge variant="outline" className="text-yellow-600 bg-yellow-50">Unused</Badge>
                          }
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              type="button"
                              onClick={(e) => {
                                // 이벤트 버블링 방지
                                e.stopPropagation();
                                e.preventDefault();
                                // 상태 변경을 비동기로 설정하여 React 렌더링 사이클과 충돌 방지
                                setTimeout(() => {
                                  setEditingVariableIndex(index);
                                  setVariableDialogOpen(true);
                                }, 0);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              onClick={() => {
                                const newVariables = [...variables];
                                newVariables.splice(index, 1);
                                form.setValue("variables", newVariables);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed rounded-md text-gray-500">
              No variables defined. Add variables to make your concept customizable.
            </div>
          )}
        </div>
        
          </TabsContent>
          
        </Tabs>
        
        <div className="flex gap-2 justify-end">
          <Button type="submit" disabled={submitMutation.isPending}>
            {submitMutation.isPending ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {initialData ? "Updating..." : "Creating..."}
              </>
            ) : (
              <>{initialData ? "Update" : "Create"} Concept</>
            )}
          </Button>
        </div>
      </form>
      
      {/* Variable Dialog */}
      <Dialog open={variableDialogOpen} onOpenChange={(state) => {
        // false만 받았을 때 닫히도록 처리
        if (state === false) {
          setVariableDialogOpen(false);
        }
      }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {editingVariableIndex !== null ? "Edit Variable" : "Add Variable"}
            </DialogTitle>
            <DialogDescription>
              Define a variable for the prompt template.
            </DialogDescription>
          </DialogHeader>
          
          <VariableForm 
            initialData={editingVariableIndex !== null ? variables[editingVariableIndex] : undefined}
            onSave={(variable) => {
              // 비동기로 처리하여 상태 업데이트 충돌 방지
              setTimeout(() => {
                const newVariables = [...variables];
                if (editingVariableIndex !== null) {
                  newVariables[editingVariableIndex] = variable;
                } else {
                  newVariables.push(variable);
                }
                form.setValue("variables", newVariables);
                setVariableDialogOpen(false);
              }, 0);
            }}
          />
        </DialogContent>
      </Dialog>
    </Form>
  );
}

// Form for variable editing
interface VariableFormProps {
  initialData?: any;
  onSave: (variable: any) => void;
}

function VariableForm({ initialData, onSave }: VariableFormProps) {
  // React state to track the variable form state properly
  const [variableType, setVariableType] = useState(initialData?.type || "text");
  const [newOption, setNewOption] = useState("");
  
  const variableForm = useForm({
    defaultValues: initialData || {
      name: "",
      description: "",
      type: "text",
      required: true,
      options: [],
      defaultValue: ""
    }
  });
  
  // Watch for type changes and update state
  useEffect(() => {
    const subscription = variableForm.watch((value, { name }) => {
      if (name === 'type') {
        setVariableType(value.type as string);
      }
    });
    return () => subscription.unsubscribe();
  }, [variableForm.watch]);
  
  function handleSubmit(values: any) {
    // 이벤트 버블링 방지
    try {
      // For select type, ensure options array is available
      if (values.type === "select" && (!values.options || !Array.isArray(values.options))) {
        values.options = [];
      }
      
      // Convert defaultValue to the appropriate type
      if (values.type === "number" && values.defaultValue !== undefined) {
        values.defaultValue = Number(values.defaultValue);
      } else if (values.type === "boolean" && values.defaultValue !== undefined) {
        values.defaultValue = values.defaultValue === "true";
      }
      
      // 직접 함수 호출 대신 비동기로 처리 
      setTimeout(() => {
        onSave(values);
      }, 0);
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    }
  }
  
  return (
    <form onSubmit={variableForm.handleSubmit(handleSubmit)} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Name</label>
          <Input 
            placeholder="variable_name" 
            {...variableForm.register("name", { required: true })}
          />
          {variableForm.formState.errors.name && (
            <p className="text-red-500 text-xs">Name is required</p>
          )}
          <p className="text-xs text-gray-500">
            Use only letters, numbers, and underscores (e.g., baby_name, bg_color)
          </p>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">Type</label>
          <select 
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            {...variableForm.register("type")}
          >
            <option value="text">Text</option>
            <option value="select">Select (Dropdown)</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean (Yes/No)</option>
          </select>
          <p className="text-xs text-gray-500">
            Controls how users will input this value
          </p>
        </div>
      </div>
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Input 
          placeholder="Describe what this variable is for" 
          {...variableForm.register("description", { required: true })}
        />
        {variableForm.formState.errors.description && (
          <p className="text-red-500 text-xs">Description is required</p>
        )}
        <p className="text-xs text-gray-500">
          This will be shown to users as a tooltip or helper text
        </p>
      </div>
      
      {variableType === "select" && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Options</label>
          <div className="flex space-x-2">
            <Input 
              placeholder="New option" 
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
            />
            <Button 
              type="button"
              onClick={() => {
                if (newOption.trim()) {
                  const currentOptions = variableForm.getValues("options") || [];
                  variableForm.setValue("options", [...currentOptions, newOption.trim()]);
                  setNewOption("");
                }
              }}
            >
              Add
            </Button>
          </div>
          
          <div className="border rounded-md p-2 min-h-[100px] space-y-1">
            {(variableForm.watch("options") || []).map((option: string, index: number) => (
              <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                <span>{option}</span>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    const currentOptions = variableForm.getValues("options") || [];
                    variableForm.setValue(
                      "options", 
                      currentOptions.filter((_, i) => i !== index)
                    );
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {(!variableForm.watch("options") || variableForm.watch("options").length === 0) && (
              <p className="text-gray-400 text-center py-2">No options added yet</p>
            )}
          </div>
          <p className="text-xs text-gray-500">
            Users will select from these options in a dropdown menu
          </p>
        </div>
      )}
      
      <div className="space-y-2">
        <label className="text-sm font-medium">Default Value</label>
        {variableType === "text" && (
          <Input 
            placeholder="Default text" 
            {...variableForm.register("defaultValue")}
          />
        )}
        {variableType === "number" && (
          <Input 
            type="number" 
            placeholder="0" 
            {...variableForm.register("defaultValue")}
          />
        )}
        {variableType === "select" && (
          <select 
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            {...variableForm.register("defaultValue")}
          >
            <option value="">Select a default option</option>
            {(variableForm.watch("options") || []).map((option: string, index: number) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        )}
        {variableType === "boolean" && (
          <select 
            className="w-full rounded-md border border-input bg-background px-3 py-2"
            {...variableForm.register("defaultValue")}
          >
            <option value="">No default</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        )}
        <p className="text-xs text-gray-500">
          Optional pre-filled value for this variable
        </p>
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox
          id="required"
          checked={variableForm.watch("required")}
          onCheckedChange={(checked) => 
            variableForm.setValue("required", checked === true)
          }
        />
        <label 
          htmlFor="required"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Required field
        </label>
      </div>
      
      <DialogFooter>
        <Button type="submit">Save Variable</Button>
      </DialogFooter>
    </form>
  );
}

// A/B Test Manager Component
function ABTestManager() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<any>(null);
  const queryClient = useQueryClient();

  // Fetch A/B tests
  const { data: tests, isLoading, error } = useQuery({
    queryKey: ["/api/admin/abtests"],
  });

  // Fetch concepts for dropdown
  const { data: concepts } = useQuery({
    queryKey: ["/api/admin/concepts"],
  });

  // Delete test mutation
  const deleteTestMutation = useMutation({
    mutationFn: (testId: string) => apiRequest(`/api/admin/abtests/${testId}`, {
      method: "DELETE",
    }),
    onSuccess: () => {
      toast({
        title: "Test deleted",
        description: "The A/B test has been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/abtests"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to delete A/B test. Please try again.",
        variant: "destructive",
      });
      console.error("Error deleting A/B test:", error);
    },
  });

  // Handle deleting a test
  const handleDeleteTest = (testId: string) => {
    if (window.confirm("Are you sure you want to delete this A/B test? This action cannot be undone.")) {
      deleteTestMutation.mutate(testId);
    }
  };

  // Toggle test active status mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ testId, isActive }: { testId: string; isActive: boolean }) => {
      const test = tests?.find((t: any) => t.testId === testId);
      return apiRequest(`/api/admin/abtests/${testId}`, {
        method: "PUT",
        body: JSON.stringify({
          ...test,
          isActive,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/abtests"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update test status. Please try again.",
        variant: "destructive",
      });
      console.error("Error toggling test status:", error);
    },
  });

  if (isLoading) {
    return <div className="text-center py-10">Loading A/B tests...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">Error loading A/B tests. Please refresh the page.</div>;
  }

  // Format date to a readable string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">A/B Testing</h2>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <PlusCircle className="h-4 w-4 mr-2" />
          Create New Test
        </Button>
      </div>

      {tests && tests.length > 0 ? (
        <Card className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Test Name</TableHead>
                <TableHead>Concept</TableHead>
                <TableHead>Variants</TableHead>
                <TableHead>Start Date</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tests.map((test: any) => (
                <TableRow key={test.testId}>
                  <TableCell className="font-medium">
                    <div>
                      <div>{test.name}</div>
                      {test.description && (
                        <div className="text-xs text-gray-500">{test.description.substring(0, 50)}{test.description.length > 50 ? '...' : ''}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {concepts?.find((c: Concept) => c.conceptId === test.conceptId)?.title || test.conceptId}
                  </TableCell>
                  <TableCell>
                    <Badge>{test.variantCount || 'N/A'} variants</Badge>
                  </TableCell>
                  <TableCell>
                    {test.startDate ? formatDate(test.startDate) : 'Not started'}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={test.isActive}
                      onCheckedChange={(checked) =>
                        toggleActiveMutation.mutate({ testId: test.testId, isActive: checked })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setSelectedTest(test);
                        setIsEditDialogOpen(true);
                      }}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteTest(test.testId)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">No A/B tests found. Create your first test!</p>
        </div>
      )}

      {/* Create AB Test Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New A/B Test</DialogTitle>
            <DialogDescription>
              Create a new A/B test to compare different prompt versions for a concept.
            </DialogDescription>
          </DialogHeader>

          <ABTestForm
            concepts={concepts || []}
            onSuccess={() => {
              setIsCreateDialogOpen(false);
              queryClient.invalidateQueries({ queryKey: ["/api/admin/abtests"] });
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Edit AB Test Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit A/B Test</DialogTitle>
            <DialogDescription>
              Modify this A/B test's settings and variants.
            </DialogDescription>
          </DialogHeader>

          {selectedTest && (
            <ABTestForm
              concepts={concepts || []}
              initialData={selectedTest}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                queryClient.invalidateQueries({ queryKey: ["/api/admin/abtests"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Form component for creating/editing A/B tests
interface ABTestFormProps {
  initialData?: any;
  concepts: Concept[];
  onSuccess: () => void;
}

function ABTestForm({ initialData, concepts, onSuccess }: ABTestFormProps) {
  const queryClient = useQueryClient();
  const [variants, setVariants] = useState<any[]>(initialData?.variants || [
    { variantId: 'variant-a', name: 'Variant A', promptTemplate: '', variables: [] },
    { variantId: 'variant-b', name: 'Variant B', promptTemplate: '', variables: [] }
  ]);

  // Fetch selected test with variants if we have an initialData
  const { data: testWithVariants } = useQuery({
    queryKey: ["/api/admin/abtests", initialData?.testId],
    enabled: !!initialData?.testId,
  });

  // Update variants when test data is loaded
  useEffect(() => {
    if (testWithVariants?.variants && testWithVariants.variants.length > 0) {
      setVariants(testWithVariants.variants);
    }
  }, [testWithVariants]);

  // Set up form
  const form = useForm({
    defaultValues: initialData || {
      testId: '',
      name: '',
      description: '',
      conceptId: '',
      isActive: true,
    },
  });

  // Create/update A/B test mutation
  const mutation = useMutation({
    mutationFn: (values: any) => {
      // Add variants to the submission
      const dataToSubmit = {
        ...values,
        variants,
      };

      if (initialData) {
        // Update existing test
        return apiRequest(`/api/admin/abtests/${initialData.testId}`, {
          method: "PUT",
          body: JSON.stringify(dataToSubmit),
        });
      } else {
        // Create new test
        return apiRequest('/api/admin/abtests', {
          method: "POST",
          body: JSON.stringify(dataToSubmit),
        });
      }
    },
    onSuccess: () => {
      toast({
        title: initialData ? "A/B Test updated" : "A/B Test created",
        description: initialData 
          ? "The A/B test has been updated successfully" 
          : "A new A/B test has been created successfully",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${initialData ? 'update' : 'create'} A/B test. Please try again.`,
        variant: "destructive",
      });
      console.error(`Error ${initialData ? 'updating' : 'creating'} A/B test:`, error);
    },
  });

  function onSubmit(values: any) {
    if (variants.length < 2) {
      toast({
        title: "Error",
        description: "You need at least two variants for an A/B test.",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate(values);
  }

  // Add a new variant
  const addVariant = () => {
    const newVariantId = `variant-${String.fromCharCode(97 + variants.length)}`;
    const newVariantName = `Variant ${String.fromCharCode(65 + variants.length)}`;
    
    setVariants([
      ...variants,
      { variantId: newVariantId, name: newVariantName, promptTemplate: '', variables: [] }
    ]);
  };

  // Remove a variant
  const removeVariant = (index: number) => {
    if (variants.length <= 2) {
      toast({
        title: "Error",
        description: "A/B tests require at least two variants.",
        variant: "destructive",
      });
      return;
    }
    
    const newVariants = [...variants];
    newVariants.splice(index, 1);
    setVariants(newVariants);
  };

  // Update a variant
  const updateVariant = (index: number, field: string, value: any) => {
    const newVariants = [...variants];
    newVariants[index] = {
      ...newVariants[index],
      [field]: value
    };
    setVariants(newVariants);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="testId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Test ID</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., lullaby-comparison" {...field} disabled={!!initialData} />
                </FormControl>
                <FormDescription>
                  A unique identifier for this test.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Test Name</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Lullaby Prompt Comparison" {...field} />
                </FormControl>
                <FormDescription>
                  A descriptive name for this A/B test.
                </FormDescription>
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
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g., Testing different prompt structures for generating lullabies"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional description explaining what this test is comparing.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="conceptId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Concept</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={!!initialData}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a concept" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {concepts.map((concept: Concept) => (
                    <SelectItem key={concept.conceptId} value={concept.conceptId}>
                      {concept.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                The concept for which you're testing different prompt variations.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Active</FormLabel>
                <FormDescription>
                  When active, this test will be used in the application.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />

        {/* Variants Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Variants</h3>
            <Button type="button" variant="outline" size="sm" onClick={addVariant}>
              <Plus className="h-4 w-4 mr-2" />
              Add Variant
            </Button>
          </div>

          {variants.map((variant, index) => (
            <Card key={index} className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                  <h4 className="font-medium">{variant.name}</h4>
                  <Input
                    placeholder="Variant ID"
                    value={variant.variantId}
                    onChange={(e) => updateVariant(index, 'variantId', e.target.value)}
                    className="w-[200px]"
                    disabled={!!initialData}
                  />
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder="Variant Name"
                    value={variant.name}
                    onChange={(e) => updateVariant(index, 'name', e.target.value)}
                    className="w-[200px]"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => removeVariant(index)}
                    disabled={variants.length <= 2}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor={`variant-${index}-prompt`}>Prompt Template</Label>
                <Textarea
                  id={`variant-${index}-prompt`}
                  placeholder="Enter the prompt template..."
                  className="min-h-[150px] font-mono text-sm"
                  value={variant.promptTemplate}
                  onChange={(e) => updateVariant(index, 'promptTemplate', e.target.value)}
                />
                <p className="text-xs text-gray-500">
                  Use variable placeholders like {'{baby_name}'} that will be replaced when the prompt is used.
                </p>
              </div>
            </Card>
          ))}
        </div>

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : initialData ? "Update A/B Test" : "Create A/B Test"}
        </Button>
      </form>
    </Form>
  );
}

// ImageTester component for admin image transformation testing
function ImageTester() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [transformedImage, setTransformedImage] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [imagesPerPage] = useState<number>(10);
  const queryClient = useQueryClient();

  // Get list of previously transformed images with pagination
  const { data: paginatedImages, isLoading: isLoadingImages, refetch: refetchImages } = useQuery({
    queryKey: ["/api/image", currentPage, imagesPerPage],
    queryFn: () => getImageList(currentPage, imagesPerPage, false), // 관리자는 모든 이미지를 볼 수 있도록 사용자 필터링 비활성화
  });
  
  // Extract image list and pagination information
  const images = paginatedImages?.images || [];
  const totalImages = paginatedImages?.totalCount || 0;
  const totalPages = paginatedImages?.totalPages || 1;

  // Fetch concepts for style selection
  const { data: concepts = [] } = useQuery({
    queryKey: ["/api/concepts"],
  });

  // Transform image mutation
  const { mutate: transformImageMutation, isPending: isTransforming } = useMutation({
    // 관리자 페이지에서는 isAdmin=true로 호출하여 이미지를 영구 저장
    mutationFn: (data: FormData) => transformImage(data, true),
    onSuccess: (data) => {
      setTransformedImage(data);
      queryClient.invalidateQueries({ queryKey: ["/api/image"] });
      toast({
        title: "이미지 변환 완료",
        description: "이미지가 성공적으로 변환되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "이미지 변환 실패",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileSelected = (file: File) => {
    setSelectedFile(file);
    
    // Create a preview URL for the selected image
    const fileReader = new FileReader();
    fileReader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    fileReader.readAsDataURL(file);
  };

  const handleTransformImage = () => {
    if (!selectedFile || !selectedStyle) {
      toast({
        title: "누락된 정보",
        description: selectedFile ? "스타일을 선택해주세요" : "이미지를 업로드해주세요",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("style", selectedStyle);

    // 관리자 페이지에서 변환 (자동으로 저장됨)
    transformImageMutation(formData);
  };

  const handleDownload = async (id: number) => {
    try {
      await downloadMedia(id, "image");
      toast({
        title: "다운로드 시작",
        description: "이미지 다운로드가 시작되었습니다."
      });
    } catch (error) {
      toast({
        title: "다운로드 실패",
        description: "다시 시도해주세요",
        variant: "destructive"
      });
    }
  };

  const handleShare = async (id: number) => {
    try {
      const shareData = await shareMedia(id, "image");
      toast({
        title: "공유 링크 생성됨",
        description: "작품을 공유할 준비가 완료되었습니다!",
      });
    } catch (error) {
      toast({
        title: "공유 링크 생성 실패",
        description: "나중에 다시 시도해주세요",
        variant: "destructive",
      });
    }
  };

  const handleViewImage = (image: any) => {
    setTransformedImage(image);
  };

  // Define expected concept shape
  interface Concept {
    id: number;
    conceptId: string;
    title: string;
    description?: string;
    promptTemplate: string;
    thumbnailUrl?: string;
    categoryId?: string;
    isActive: boolean;
    isFeatured: boolean;
    order: number;
    createdAt: string;
    updatedAt: string;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">이미지 테스트</h2>
        <p className="text-sm text-gray-500">관리자 모드: 모든 이미지가 데이터베이스에 저장됩니다</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>이미지 업로드</CardTitle>
              <CardDescription>테스트할 이미지를 업로드하고 스타일을 선택하세요</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Image upload */}
              <div>
                <Label htmlFor="image-upload">이미지</Label>
                <div className="mt-2">
                  <FileUpload 
                    onFileSelect={handleFileSelected} 
                    accept="image/*"
                    maxSize={10 * 1024 * 1024} // 10MB
                  />
                </div>
              </div>

              {/* Preview */}
              {previewUrl && (
                <div className="mt-4 border rounded-md overflow-hidden">
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full max-h-[300px] object-contain"
                  />
                </div>
              )}

              {/* Style selection */}
              <div className="mt-6">
                <Label htmlFor="style-select">스타일</Label>
                <Select value={selectedStyle || ""} onValueChange={setSelectedStyle}>
                  <SelectTrigger id="style-select">
                    <SelectValue placeholder="스타일 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.isArray(concepts) && concepts.map((concept: Concept) => (
                      <SelectItem key={concept.conceptId} value={concept.conceptId}>
                        {concept.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Transform button */}
              <Button 
                onClick={handleTransformImage} 
                className="w-full mt-6"
                disabled={!selectedFile || !selectedStyle || isTransforming}
              >
                {isTransforming ? (
                  <span className="flex items-center">
                    <PaintbrushVertical className="mr-2 h-4 w-4 animate-spin" />
                    변환 중...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <PaintbrushVertical className="mr-2 h-4 w-4" />
                    이미지 변환하기
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>이미지 목록</CardTitle>
              <CardDescription>이전에 변환된 이미지들</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingImages ? (
                <div className="flex justify-center p-8">
                  <p>이미지 로딩 중...</p>
                </div>
              ) : images.length > 0 ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {images.map((image: any) => (
                      <div 
                        key={image.id} 
                        className="relative border rounded-md overflow-hidden cursor-pointer group"
                        onClick={() => handleViewImage(image)}
                      >
                        <img 
                          src={image.transformedUrl} 
                          alt={image.title || "변환된 이미지"} 
                          className="w-full h-24 object-cover"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Eye className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 페이지네이션 컨트롤 */}
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-500">
                      총 {totalImages}개 이미지 중 {(currentPage - 1) * imagesPerPage + 1}-{Math.min(currentPage * imagesPerPage, totalImages)}개 표시
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        이전
                      </Button>
                      <div className="flex items-center space-x-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                          let pageNum;
                          if (totalPages <= 5) {
                            // 전체 페이지가 5개 이하면 모든 페이지 표시
                            pageNum = i + 1;
                          } else if (currentPage <= 3) {
                            // 현재 페이지가 3 이하면 1~5 표시
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - 2) {
                            // 현재 페이지가 마지막 2페이지면 마지막 5페이지 표시
                            pageNum = totalPages - 4 + i;
                          } else {
                            // 그 외에는 현재 페이지 중심으로 표시
                            pageNum = currentPage - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        다음
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p>변환된 이미지가 없습니다</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>변환 결과</CardTitle>
              <CardDescription>이미지 변환 결과를 확인하세요</CardDescription>
            </CardHeader>
            <CardContent>
              {transformedImage ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium mb-2">원본 이미지</p>
                      <div className="border rounded-md overflow-hidden h-[200px]">
                        <img 
                          src={transformedImage.originalUrl} 
                          alt="원본 이미지" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">변환된 이미지</p>
                      <div className="border rounded-md overflow-hidden h-[200px]">
                        <img 
                          src={transformedImage.transformedUrl} 
                          alt="변환된 이미지" 
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between mt-4">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDownload(transformedImage.id)}
                    >
                      <Download className="mr-2 h-4 w-4" />
                      다운로드
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleShare(transformedImage.id)}
                    >
                      <Share2 className="mr-2 h-4 w-4" />
                      공유하기
                    </Button>
                  </div>
                  
                  <div className="mt-6">
                    <h4 className="text-sm font-medium mb-2">정보</h4>
                    <div className="text-sm space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500">스타일:</span>
                        <span>{transformedImage.style}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">생성 시간:</span>
                        <span>{new Date(transformedImage.createdAt).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">이미지 ID:</span>
                        <span>{transformedImage.id}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[400px] text-center text-gray-500">
                  <PaintbrushVertical className="h-12 w-12 text-gray-400 mb-3" />
                  <p>이미지를 변환하거나 기존 이미지를 선택하세요</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// 사용자 UI와 동일한 음악 스타일 단어 관리
function MusicStylePromptManager() {
  const [newStyleName, setNewStyleName] = useState("");
  const queryClient = useQueryClient();

  // 음악 스타일 조회
  const { data: musicStyles = [], isLoading, error } = useQuery({
    queryKey: ["/api/admin/music-styles"],
  });

  // 새 스타일 단어 추가
  const createMutation = useMutation({
    mutationFn: (styleName: string) =>
      apiRequest("/api/admin/music-styles", {
        method: "POST",
        body: JSON.stringify({
          styleId: styleName.toLowerCase().replace(/[^a-z0-9]/g, '_'),
          name: styleName,
          description: styleName,
          prompt: styleName,
          isActive: true,
          order: musicStyles.length + 1
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music-styles"] });
      setNewStyleName("");
      toast({
        title: "성공",
        description: "새 스타일이 추가되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "스타일 추가에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  // 스타일 삭제
  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/admin/music-styles/${id}`, {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/music-styles"] });
      toast({
        title: "성공",
        description: "스타일이 삭제되었습니다.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "오류",
        description: error.message || "스타일 삭제에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleAddStyle = () => {
    if (newStyleName.trim().length < 2) {
      toast({
        title: "입력 오류",
        description: "스타일 이름은 최소 2글자 이상 입력해주세요.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate(newStyleName.trim());
  };

  const handleDeleteStyle = (id: number, name: string) => {
    if (window.confirm(`"${name}" 스타일을 삭제하시겠습니까?`)) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">스타일을 불러오는 중...</div>;
  }

  if (error) {
    return <div className="text-center py-10 text-red-500">오류가 발생했습니다. 페이지를 새로고침해주세요.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold">스타일 프롬프트</h3>
        <p className="text-gray-600 mt-1">클릭하여 음악 분위기를 선택할 수 있습니다</p>
      </div>

      {/* 새 스타일 추가 */}
      <Card className="p-4">
        <div className="flex gap-3">
          <Input
            placeholder="예: Cheerful, Sad, Peaceful..."
            value={newStyleName}
            onChange={(e) => setNewStyleName(e.target.value)}
            className="flex-1"
          />
          <Button 
            onClick={handleAddStyle}
            disabled={!newStyleName.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? "추가 중..." : "추가"}
          </Button>
        </div>
      </Card>

      {/* 현재 스타일들 - 사용자 UI와 동일한 형태 */}
      <div className="space-y-4">
        {musicStyles.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {musicStyles.map((style: any) => (
              <div key={style.id} className="relative group">
                <Button
                  variant="outline"
                  className="bg-gray-700 text-white border-gray-600 hover:bg-gray-600"
                >
                  {style.name}
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDeleteStyle(style.id, style.name)}
                  disabled={deleteMutation.isPending}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <Card className="p-8 text-center">
            <MusicIcon className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold mb-2">스타일이 없습니다</h3>
            <p className="text-gray-500">첫 번째 음악 스타일을 추가해보세요</p>
          </Card>
        )}
      </div>

      <p className="text-sm text-gray-500">
        클릭하여 음악 분위기를 추가할 수 있습니다
      </p>
    </div>
  );
}

// Phase 7-1: 신청 내역 관리 컴포넌트
function ApplicationManagement() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedApplication, setSelectedApplication] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const queryClient = useQueryClient();

  // 신청 목록 조회
  const { data: applications = [], isLoading, error } = useQuery({
    queryKey: ["/api/admin/milestone-applications", statusFilter],
    queryFn: async () => {
      const url = statusFilter === "all" 
        ? "/api/admin/milestone-applications"
        : `/api/admin/milestone-applications?status=${statusFilter}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("신청 목록을 불러오는데 실패했습니다.");
      }
      return response.json();
    }
  });

  // 신청 상세 조회
  const handleViewDetail = async (applicationId: number) => {
    try {
      const response = await fetch(`/api/admin/milestone-applications/${applicationId}`);
      if (!response.ok) {
        throw new Error("신청 상세 정보를 불러오는데 실패했습니다.");
      }
      const applicationDetail = await response.json();
      setSelectedApplication(applicationDetail);
      setIsDetailDialogOpen(true);
    } catch (error) {
      console.error("신청 상세 조회 오류:", error);
      toast({
        title: "오류",
        description: "신청 상세 정보를 불러오는데 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  // 신청 승인/거절/취소 처리
  const handleApproval = async (applicationId: number, status: 'approved' | 'rejected' | 'cancelled') => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/admin/milestone-applications/${applicationId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status })
      });

      if (!response.ok) {
        throw new Error(`신청 ${status === 'approved' ? '승인' : status === 'rejected' ? '거절' : '취소'}에 실패했습니다.`);
      }

      // 성공 시 토스트 표시
      const statusMessage = status === 'approved' ? '승인' : status === 'rejected' ? '거절' : '취소';
      toast({
        title: "처리 완료",
        description: `신청이 ${statusMessage}되었습니다.`,
      });

      // 신청 목록 새로고침
      queryClient.invalidateQueries({ queryKey: ["/api/admin/milestone-applications"] });
      
      // 상세 다이얼로그 닫기
      setIsDetailDialogOpen(false);
      setSelectedApplication(null);

    } catch (error) {
      console.error("신청 처리 오류:", error);
      toast({
        title: "오류",
        description: error instanceof Error ? error.message : "신청 처리에 실패했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 상태별 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      case 'expired': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // 상태 한글명 반환
  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return '대기중';
      case 'approved': return '승인됨';
      case 'rejected': return '거절됨';
      case 'cancelled': return '취소됨';
      case 'expired': return '만료됨';
      default: return status;
    }
  };

  if (isLoading) {
    return <div className="text-center py-10">신청 목록을 불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-500">신청 목록을 불러오는데 실패했습니다.</p>
        <Button 
          variant="outline" 
          onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/admin/milestone-applications"] })}
          className="mt-4"
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 필터 영역 */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          <Label htmlFor="status-filter">상태별 필터:</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="pending">대기중</SelectItem>
              <SelectItem value="approved">승인됨</SelectItem>
              <SelectItem value="rejected">거절됨</SelectItem>
              <SelectItem value="cancelled">취소됨</SelectItem>
              <SelectItem value="expired">만료됨</SelectItem>
            </SelectContent>
          </Select>
          <div className="ml-auto text-sm text-gray-500">
            총 {applications.length}개의 신청
          </div>
        </div>
      </Card>

      {/* 신청 목록 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle>참여형 마일스톤 신청 내역</CardTitle>
          <CardDescription>
            사용자들의 참여형 마일스톤 신청을 검토하고 승인/거절 처리할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-500">
                {statusFilter === "all" ? "신청 내역이 없습니다." : `${getStatusLabel(statusFilter)} 상태의 신청이 없습니다.`}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>신청 ID</TableHead>
                  <TableHead>마일스톤</TableHead>
                  <TableHead>신청자</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>신청일시</TableHead>
                  <TableHead>처리일시</TableHead>
                  <TableHead>작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applications.map((app: any) => (
                  <TableRow key={app.id}>
                    <TableCell className="font-mono">#{app.id}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{app.milestone?.title}</div>
                        <div className="text-sm text-gray-500">{app.milestone?.description?.slice(0, 50)}...</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{app.user?.username}</div>
                        <div className="text-sm text-gray-500">{app.user?.email}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(app.status)}>
                        {getStatusLabel(app.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(app.appliedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {app.processedAt ? new Date(app.processedAt).toLocaleString() : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewDetail(app.id)}
                        >
                          상세보기
                        </Button>
                        
                        {/* 상태별 처리 버튼 */}
                        {app.status === 'pending' && (
                          <>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleApproval(app.id, 'approved')}
                              disabled={isProcessing}
                            >
                              승인
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleApproval(app.id, 'rejected')}
                              disabled={isProcessing}
                            >
                              거절
                            </Button>
                          </>
                        )}
                        
                        {app.status === 'approved' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApproval(app.id, 'cancelled')}
                            disabled={isProcessing}
                            className="border-orange-300 text-orange-600 hover:bg-orange-50"
                          >
                            승인 취소
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 신청 상세 다이얼로그 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>신청 상세 정보</DialogTitle>
            <DialogDescription>
              신청 ID: #{selectedApplication?.id}
            </DialogDescription>
          </DialogHeader>
          
          {selectedApplication && (
            <div className="space-y-6">
              {/* 기본 정보 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">신청자</Label>
                  <div className="mt-1">
                    <div className="font-medium">{selectedApplication.user?.username}</div>
                    <div className="text-sm text-gray-500">{selectedApplication.user?.email}</div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">상태</Label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(selectedApplication.status)}>
                      {getStatusLabel(selectedApplication.status)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">신청일시</Label>
                  <div className="mt-1 text-sm">
                    {new Date(selectedApplication.appliedAt).toLocaleString()}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">처리일시</Label>
                  <div className="mt-1 text-sm">
                    {selectedApplication.processedAt 
                      ? new Date(selectedApplication.processedAt).toLocaleString() 
                      : '미처리'}
                  </div>
                </div>
              </div>

              {/* 마일스톤 정보 */}
              <div>
                <Label className="text-sm font-medium">마일스톤 정보</Label>
                <Card className="mt-2 p-4">
                  <div className="space-y-2">
                    <div className="font-medium">{selectedApplication.milestone?.title}</div>
                    <div className="text-sm text-gray-600">{selectedApplication.milestone?.description}</div>
                    <div className="text-xs text-gray-500">
                      카테고리: {selectedApplication.milestone?.category?.name}
                    </div>
                  </div>
                </Card>
              </div>

              {/* 신청 데이터 */}
              {selectedApplication.applicationData && (
                <div>
                  <Label className="text-sm font-medium">신청 내용</Label>
                  <Card className="mt-2 p-4">
                    <pre className="text-sm whitespace-pre-wrap">
                      {typeof selectedApplication.applicationData === 'string' 
                        ? selectedApplication.applicationData 
                        : JSON.stringify(selectedApplication.applicationData, null, 2)}
                    </pre>
                  </Card>
                </div>
              )}

              {/* 첨부 파일 */}
              {selectedApplication.files && selectedApplication.files.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">첨부 파일 ({selectedApplication.files.length}개)</Label>
                  <div className="mt-2 space-y-2">
                    {selectedApplication.files.map((file: any) => (
                      <Card key={file.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{file.fileName}</div>
                            <div className="text-xs text-gray-500">
                              {file.fileType} • {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                          <Button variant="outline" size="sm">
                            다운로드
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* 처리 노트 */}
              {selectedApplication.notes && (
                <div>
                  <Label className="text-sm font-medium">처리 노트</Label>
                  <Card className="mt-2 p-4">
                    <div className="text-sm">{selectedApplication.notes}</div>
                  </Card>
                </div>
              )}

              {/* 승인/거절/취소 버튼 */}
              {(selectedApplication?.status === 'pending' || selectedApplication?.status === 'approved') && (
                <div className="border-t pt-6">
                  <Label className="text-sm font-medium">신청 처리</Label>
                  <div className="mt-2 flex gap-3">
                    {selectedApplication?.status === 'pending' && (
                      <>
                        <Button
                          onClick={() => handleApproval(selectedApplication.id, 'approved')}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          승인
                        </Button>
                        <Button
                          onClick={() => handleApproval(selectedApplication.id, 'rejected')}
                          variant="destructive"
                        >
                          거절
                        </Button>
                      </>
                    )}
                    {selectedApplication?.status === 'approved' && (
                      <Button
                        onClick={() => handleApproval(selectedApplication.id, 'cancelled')}
                        variant="outline"
                        className="border-orange-300 text-orange-700 hover:bg-orange-50"
                      >
                        승인 취소
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {selectedApplication?.status === 'pending' 
                      ? '승인 또는 거절 후에도 승인 취소가 가능합니다.'
                      : '승인을 취소하면 신청자가 다시 신청할 수 있습니다.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


