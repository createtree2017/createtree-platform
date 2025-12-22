import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Save,
  Trash2,
  Type,
  Image as ImageIcon,
  Palette,
  Layout,
  ChevronLeft,
  ChevronRight,
  Move,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  Layers,
  FolderOpen,
  FileText,
  PanelLeftClose,
  PanelRightClose,
  Download,
  Upload,
  Loader2,
  Eye,
  BookTemplate,
  Wand2,
  Grid,
} from "lucide-react";

interface CanvasObject {
  id: string;
  type: "image" | "text" | "icon";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  content: string;
  fontSize?: number;
  fontFamily?: string;
  fontColor?: string;
  fontWeight?: string;
  textAlign?: string;
  zIndex: number;
}

interface PageData {
  id: string;
  objects: CanvasObject[];
  backgroundColor: string;
  backgroundImage?: string;
}

interface PagesData {
  pages: PageData[];
}

interface Project {
  id: number;
  title: string;
  description?: string;
  pagesData: PagesData;
  pageCount: number;
  currentPage: number;
  canvasWidth: number;
  canvasHeight: number;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface Template {
  id: number;
  name: string;
  thumbnailUrl?: string;
  category: string;
  pagesData: PagesData;
}

interface Background {
  id: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  category: string;
}

interface Icon {
  id: number;
  name: string;
  imageUrl: string;
  thumbnailUrl?: string;
  category: string;
}

interface GalleryImage {
  id: number;
  title: string;
  type: string;
  url: string;
  transformedUrl: string;
  thumbnailUrl: string;
  originalUrl: string;
  style: string;
  userId: string;
  createdAt: string;
  isFavorite: boolean;
}

const GALLERY_CATEGORIES = [
  { value: "all", label: "전체" },
  { value: "maternity", label: "만삭" },
  { value: "family", label: "가족" },
  { value: "baby", label: "아기" },
  { value: "snapshot", label: "스냅" },
  { value: "sticker", label: "스티커" },
  { value: "collage", label: "콜라주" },
];

const TEMPLATE_CATEGORIES = [
  { value: "all", label: "전체" },
  { value: "general", label: "일반" },
  { value: "baby", label: "아기" },
  { value: "family", label: "가족" },
  { value: "maternity", label: "만삭" },
  { value: "anniversary", label: "기념일" },
];

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;

interface LayoutPreset {
  id: string;
  name: string;
  imageCount: number;
  positions: Array<{ x: number; y: number; width: number; height: number }>;
}

const LAYOUT_PRESETS: LayoutPreset[] = [
  {
    id: "full-1",
    name: "전체 화면",
    imageCount: 1,
    positions: [{ x: 20, y: 20, width: 760, height: 560 }],
  },
  {
    id: "horizontal-2",
    name: "수평 2분할",
    imageCount: 2,
    positions: [
      { x: 20, y: 20, width: 370, height: 560 },
      { x: 410, y: 20, width: 370, height: 560 },
    ],
  },
  {
    id: "vertical-2",
    name: "수직 2분할",
    imageCount: 2,
    positions: [
      { x: 20, y: 20, width: 760, height: 270 },
      { x: 20, y: 310, width: 760, height: 270 },
    ],
  },
  {
    id: "one-large-two-small-3",
    name: "1대 + 2소",
    imageCount: 3,
    positions: [
      { x: 20, y: 20, width: 500, height: 560 },
      { x: 540, y: 20, width: 240, height: 270 },
      { x: 540, y: 310, width: 240, height: 270 },
    ],
  },
  {
    id: "three-equal-3",
    name: "삼등분",
    imageCount: 3,
    positions: [
      { x: 20, y: 20, width: 240, height: 560 },
      { x: 280, y: 20, width: 240, height: 560 },
      { x: 540, y: 20, width: 240, height: 560 },
    ],
  },
  {
    id: "grid-2x2-4",
    name: "2x2 그리드",
    imageCount: 4,
    positions: [
      { x: 20, y: 20, width: 370, height: 270 },
      { x: 410, y: 20, width: 370, height: 270 },
      { x: 20, y: 310, width: 370, height: 270 },
      { x: 410, y: 310, width: 370, height: 270 },
    ],
  },
  {
    id: "collage-5",
    name: "콜라주 (5장)",
    imageCount: 5,
    positions: [
      { x: 20, y: 20, width: 370, height: 270 },
      { x: 410, y: 20, width: 370, height: 270 },
      { x: 20, y: 310, width: 240, height: 270 },
      { x: 280, y: 310, width: 240, height: 270 },
      { x: 540, y: 310, width: 240, height: 270 },
    ],
  },
  {
    id: "collage-6",
    name: "콜라주 (6장)",
    imageCount: 6,
    positions: [
      { x: 20, y: 20, width: 240, height: 270 },
      { x: 280, y: 20, width: 240, height: 270 },
      { x: 540, y: 20, width: 240, height: 270 },
      { x: 20, y: 310, width: 240, height: 270 },
      { x: 280, y: 310, width: 240, height: 270 },
      { x: 540, y: 310, width: 240, height: 270 },
    ],
  },
];

export default function PhotobookPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useMobile();
  const { user } = useAuth();
  const isAdmin = user?.memberType === "admin" || user?.memberType === "superadmin";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState("새 포토북");
  const [pagesData, setPagesData] = useState<PagesData>({
    pages: [{ id: "page-1", objects: [], backgroundColor: "#ffffff" }],
  });
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const [leftPanelOpen, setLeftPanelOpen] = useState(!isMobile);
  const [rightPanelOpen, setRightPanelOpen] = useState(!isMobile);
  const [showProjectsDialog, setShowProjectsDialog] = useState(false);
  const [showAddTextDialog, setShowAddTextDialog] = useState(false);
  const [newText, setNewText] = useState("");
  const [newTextFontSize, setNewTextFontSize] = useState(24);
  const [newTextColor, setNewTextColor] = useState("#000000");
  const [loadedImages, setLoadedImages] = useState<Map<string, HTMLImageElement>>(new Map());
  const [galleryCategory, setGalleryCategory] = useState<string>("all");
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("general");
  const [showAILayoutDialog, setShowAILayoutDialog] = useState(false);
  const [recommendedLayouts, setRecommendedLayouts] = useState<LayoutPreset[]>([]);
  const [selectedLayoutPreset, setSelectedLayoutPreset] = useState<LayoutPreset | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasUnsavedChanges = useRef(false);
  const previousPageIndex = useRef(currentPageIndex);

  const currentPage = pagesData.pages[currentPageIndex] || pagesData.pages[0];

  const { data: projectsData, isLoading: projectsLoading } = useQuery<{ success: boolean; data: Project[] }>({
    queryKey: ["/api/photobook/projects"],
    queryFn: async () => {
      const res = await fetch("/api/photobook/projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      const json = await res.json();
      return json;
    },
  });

  const { data: backgroundsData } = useQuery<{ success: boolean; data: Background[] }>({
    queryKey: ["/api/photobook/backgrounds"],
    queryFn: async () => {
      const res = await fetch("/api/photobook/backgrounds", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch backgrounds");
      const json = await res.json();
      return json;
    },
  });

  const { data: iconsData } = useQuery<{ success: boolean; data: Icon[] }>({
    queryKey: ["/api/photobook/icons"],
    queryFn: async () => {
      const res = await fetch("/api/photobook/icons", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch icons");
      const json = await res.json();
      return json;
    },
  });

  const { data: templatesData } = useQuery<{ success: boolean; data: Template[] }>({
    queryKey: ["/api/photobook/templates", templateCategory],
    queryFn: async () => {
      const categoryParam = templateCategory && templateCategory !== "all" ? `?category=${templateCategory}` : "";
      const res = await fetch(`/api/photobook/templates${categoryParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch templates");
      const json = await res.json();
      return json;
    },
  });

  const { data: galleryData, isLoading: galleryLoading } = useQuery<{ success: boolean; data: GalleryImage[] }>({
    queryKey: ["/api/gallery", galleryCategory],
    queryFn: async () => {
      const filterParam = galleryCategory && galleryCategory !== "all" ? `?filter=${galleryCategory}` : "";
      const res = await fetch(`/api/gallery${filterParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch gallery");
      const json = await res.json();
      return json;
    },
  });

  const projects = projectsData?.data || [];
  const galleryImages = Array.isArray(galleryData?.data) ? galleryData.data : [];
  const backgrounds = backgroundsData?.data || [];
  const icons = iconsData?.data || [];
  const templates = templatesData?.data || [];

  const createProjectMutation = useMutation({
    mutationFn: async (data: { title: string }) => {
      const res = await apiRequest("/api/photobook/projects", {
        method: "POST",
        data,
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setProjectId(data.data.id);
        setProjectTitle(data.data.title);
        setPagesData(data.data.pagesData || { pages: [{ id: "page-1", objects: [], backgroundColor: "#ffffff" }] });
        queryClient.invalidateQueries({ queryKey: ["/api/photobook/projects"] });
        toast({ title: "프로젝트 생성", description: "새 포토북이 생성되었습니다." });
      }
    },
    onError: () => {
      toast({ title: "오류", description: "프로젝트 생성에 실패했습니다.", variant: "destructive" });
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async () => {
      if (!projectId) {
        const res = await apiRequest("/api/photobook/projects", {
          method: "POST",
          data: { title: projectTitle },
        });
        const createData = await res.json();
        if (createData.success) {
          setProjectId(createData.data.id);
          const updateRes = await apiRequest(`/api/photobook/projects/${createData.data.id}`, {
            method: "PATCH",
            data: { title: projectTitle, pagesData },
          });
          return updateRes.json();
        }
        throw new Error("프로젝트 생성 실패");
      }
      const res = await apiRequest(`/api/photobook/projects/${projectId}`, {
        method: "PATCH",
        data: { title: projectTitle, pagesData },
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setLastSaved(new Date());
        hasUnsavedChanges.current = false;
        queryClient.invalidateQueries({ queryKey: ["/api/photobook/projects"] });
        toast({ title: "저장 완료", description: "포토북이 저장되었습니다." });
      }
    },
    onError: () => {
      toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
    },
  });

  const autoSave = useCallback(async () => {
    if (isAutoSaving || !hasUnsavedChanges.current || saveProjectMutation.isPending) return;
    
    setIsAutoSaving(true);
    try {
      if (!projectId) {
        const res = await apiRequest("/api/photobook/projects", {
          method: "POST",
          data: { title: projectTitle },
        });
        const createData = await res.json();
        if (createData.success) {
          setProjectId(createData.data.id);
          const updateRes = await apiRequest(`/api/photobook/projects/${createData.data.id}`, {
            method: "PATCH",
            data: { title: projectTitle, pagesData },
          });
          const updateData = await updateRes.json();
          if (updateData.success) {
            setLastSaved(new Date());
            hasUnsavedChanges.current = false;
            queryClient.invalidateQueries({ queryKey: ["/api/photobook/projects"] });
          }
        }
      } else {
        const res = await apiRequest(`/api/photobook/projects/${projectId}`, {
          method: "PATCH",
          data: { title: projectTitle, pagesData },
        });
        const data = await res.json();
        if (data.success) {
          setLastSaved(new Date());
          hasUnsavedChanges.current = false;
          queryClient.invalidateQueries({ queryKey: ["/api/photobook/projects"] });
        }
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [projectId, projectTitle, pagesData, isAutoSaving, saveProjectMutation.isPending]);

  useEffect(() => {
    hasUnsavedChanges.current = true;
  }, [pagesData, projectTitle]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (hasUnsavedChanges.current) {
        autoSave();
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [autoSave]);

  useEffect(() => {
    if (previousPageIndex.current !== currentPageIndex && hasUnsavedChanges.current) {
      autoSave();
    }
    previousPageIndex.current = currentPageIndex;
  }, [currentPageIndex, autoSave]);

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; category: string }) => {
      const res = await apiRequest("/api/admin/photobook/templates", {
        method: "POST",
        data: {
          name: data.name,
          category: data.category,
          pagesData,
          pageCount: pagesData.pages.length,
          canvasWidth: CANVAS_WIDTH,
          canvasHeight: CANVAS_HEIGHT,
          isPublic: true,
          isActive: true,
        },
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ 
          predicate: (query) => 
            Array.isArray(query.queryKey) && 
            query.queryKey[0] === "/api/photobook/templates"
        });
        setShowSaveTemplateDialog(false);
        setNewTemplateName("");
        setNewTemplateCategory("general");
        toast({ title: "템플릿 저장 완료", description: "현재 작업이 템플릿으로 저장되었습니다." });
      }
    },
    onError: () => {
      toast({ title: "오류", description: "템플릿 저장에 실패했습니다.", variant: "destructive" });
    },
  });

  const loadProject = (project: Project) => {
    setProjectId(project.id);
    setProjectTitle(project.title);
    setPagesData(project.pagesData || { pages: [{ id: "page-1", objects: [], backgroundColor: "#ffffff" }] });
    setCurrentPageIndex(0);
    setSelectedObjectId(null);
    setShowProjectsDialog(false);
    toast({ title: "프로젝트 로드", description: `"${project.title}" 프로젝트를 불러왔습니다.` });
  };

  const preloadImage = useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      if (loadedImages.has(url)) {
        resolve(loadedImages.get(url)!);
        return;
      }
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        setLoadedImages((prev) => new Map(prev).set(url, img));
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }, [loadedImages]);

  const drawCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    ctx.fillStyle = currentPage.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (currentPage.backgroundImage) {
      try {
        const bgImg = await preloadImage(currentPage.backgroundImage);
        ctx.drawImage(bgImg, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      } catch (e) {
        console.error("배경 이미지 로드 실패:", e);
      }
    }

    const sortedObjects = [...currentPage.objects].sort((a, b) => a.zIndex - b.zIndex);

    for (const obj of sortedObjects) {
      ctx.save();
      ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.translate(-obj.width / 2, -obj.height / 2);

      if (obj.type === "image" || obj.type === "icon") {
        try {
          const img = await preloadImage(obj.content);
          ctx.drawImage(img, 0, 0, obj.width, obj.height);
        } catch (e) {
          ctx.fillStyle = "#cccccc";
          ctx.fillRect(0, 0, obj.width, obj.height);
          ctx.fillStyle = "#666666";
          ctx.font = "14px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("이미지 로드 실패", obj.width / 2, obj.height / 2);
        }
      } else if (obj.type === "text") {
        ctx.font = `${obj.fontWeight || "normal"} ${obj.fontSize || 24}px ${obj.fontFamily || "sans-serif"}`;
        ctx.fillStyle = obj.fontColor || "#000000";
        ctx.textAlign = (obj.textAlign as CanvasTextAlign) || "left";
        ctx.textBaseline = "top";
        
        const lines = obj.content.split("\n");
        const lineHeight = (obj.fontSize || 24) * 1.2;
        lines.forEach((line, index) => {
          const xPos = obj.textAlign === "center" ? obj.width / 2 : obj.textAlign === "right" ? obj.width : 0;
          ctx.fillText(line, xPos, index * lineHeight);
        });
      }

      ctx.restore();

      if (obj.id === selectedObjectId) {
        ctx.save();
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(obj.x - 2, obj.y - 2, obj.width + 4, obj.height + 4);
        
        ctx.fillStyle = "#3b82f6";
        const handleSize = 8;
        ctx.fillRect(obj.x + obj.width - handleSize / 2, obj.y + obj.height - handleSize / 2, handleSize, handleSize);
        ctx.restore();
      }
    }
  }, [currentPage, selectedObjectId, preloadImage]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY;
    
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  const isPointInRotatedRect = (
    px: number,
    py: number,
    obj: CanvasObject
  ): boolean => {
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const radians = -(obj.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = px - centerX;
    const dy = py - centerY;
    const localX = dx * cos - dy * sin + obj.width / 2;
    const localY = dx * sin + dy * cos + obj.height / 2;
    return localX >= 0 && localX <= obj.width && localY >= 0 && localY <= obj.height;
  };

  const getLocalCoordinates = (
    px: number,
    py: number,
    obj: CanvasObject
  ): { localX: number; localY: number } => {
    const centerX = obj.x + obj.width / 2;
    const centerY = obj.y + obj.height / 2;
    const radians = -(obj.rotation * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const dx = px - centerX;
    const dy = py - centerY;
    return {
      localX: dx * cos - dy * sin + obj.width / 2,
      localY: dx * sin + dy * cos + obj.height / 2,
    };
  };

  const findObjectAtPosition = (x: number, y: number): CanvasObject | null => {
    const sortedObjects = [...currentPage.objects].sort((a, b) => b.zIndex - a.zIndex);
    for (const obj of sortedObjects) {
      if (isPointInRotatedRect(x, y, obj)) {
        return obj;
      }
    }
    return null;
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getCanvasCoordinates(e);
    const clickedObject = findObjectAtPosition(x, y);

    if (clickedObject) {
      setSelectedObjectId(clickedObject.id);
      
      const { localX, localY } = getLocalCoordinates(x, y, clickedObject);
      const handleSize = 8;
      const isOnResizeHandle =
        localX >= clickedObject.width - handleSize &&
        localY >= clickedObject.height - handleSize;

      if (isOnResizeHandle) {
        setIsResizing(true);
      } else {
        setIsDragging(true);
        setDragOffset({
          x: x - clickedObject.x,
          y: y - clickedObject.y,
        });
      }
    } else {
      setSelectedObjectId(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!selectedObjectId) return;

    const { x, y } = getCanvasCoordinates(e);
    const selectedObject = currentPage.objects.find((o) => o.id === selectedObjectId);
    if (!selectedObject) return;

    if (isDragging) {
      updateObject(selectedObjectId, {
        x: Math.max(0, Math.min(CANVAS_WIDTH - selectedObject.width, x - dragOffset.x)),
        y: Math.max(0, Math.min(CANVAS_HEIGHT - selectedObject.height, y - dragOffset.y)),
      });
    } else if (isResizing) {
      const newWidth = Math.max(20, x - selectedObject.x);
      const newHeight = Math.max(20, y - selectedObject.y);
      updateObject(selectedObjectId, { width: newWidth, height: newHeight });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
  };

  const updateObject = (objectId: string, updates: Partial<CanvasObject>) => {
    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.map((page, index) =>
        index === currentPageIndex
          ? {
              ...page,
              objects: page.objects.map((obj) =>
                obj.id === objectId ? { ...obj, ...updates } : obj
              ),
            }
          : page
      ),
    }));
  };

  const addPage = () => {
    const newPageId = `page-${Date.now()}`;
    setPagesData((prev) => ({
      ...prev,
      pages: [...prev.pages, { id: newPageId, objects: [], backgroundColor: "#ffffff" }],
    }));
    setCurrentPageIndex(pagesData.pages.length);
  };

  const deletePage = (index: number) => {
    if (pagesData.pages.length <= 1) {
      toast({ title: "삭제 불가", description: "최소 1개의 페이지가 필요합니다.", variant: "destructive" });
      return;
    }
    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.filter((_, i) => i !== index),
    }));
    if (currentPageIndex >= index && currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  const addTextObject = () => {
    if (!newText.trim()) return;

    const newObject: CanvasObject = {
      id: `text-${Date.now()}`,
      type: "text",
      x: 100,
      y: 100,
      width: 200,
      height: newTextFontSize * 1.5,
      rotation: 0,
      content: newText,
      fontSize: newTextFontSize,
      fontFamily: "sans-serif",
      fontColor: newTextColor,
      fontWeight: "normal",
      textAlign: "left",
      zIndex: currentPage.objects.length,
    };

    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.map((page, index) =>
        index === currentPageIndex ? { ...page, objects: [...page.objects, newObject] } : page
      ),
    }));

    setNewText("");
    setShowAddTextDialog(false);
    setSelectedObjectId(newObject.id);
  };

  const addImageObject = (imageUrl: string) => {
    const newObject: CanvasObject = {
      id: `image-${Date.now()}`,
      type: "image",
      x: 100,
      y: 100,
      width: 200,
      height: 150,
      rotation: 0,
      content: imageUrl,
      zIndex: currentPage.objects.length,
    };

    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.map((page, index) =>
        index === currentPageIndex ? { ...page, objects: [...page.objects, newObject] } : page
      ),
    }));

    setSelectedObjectId(newObject.id);
  };

  const addIconObject = (icon: Icon) => {
    const newObject: CanvasObject = {
      id: `icon-${Date.now()}`,
      type: "icon",
      x: 150,
      y: 150,
      width: 80,
      height: 80,
      rotation: 0,
      content: icon.imageUrl,
      zIndex: currentPage.objects.length,
    };

    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.map((page, index) =>
        index === currentPageIndex ? { ...page, objects: [...page.objects, newObject] } : page
      ),
    }));

    setSelectedObjectId(newObject.id);
  };

  const setBackground = (bg: Background) => {
    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.map((page, index) =>
        index === currentPageIndex ? { ...page, backgroundImage: bg.imageUrl } : page
      ),
    }));
  };

  const setBackgroundColor = (color: string) => {
    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.map((page, index) =>
        index === currentPageIndex ? { ...page, backgroundColor: color, backgroundImage: undefined } : page
      ),
    }));
  };

  const deleteSelectedObject = () => {
    if (!selectedObjectId) return;
    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.map((page, index) =>
        index === currentPageIndex
          ? { ...page, objects: page.objects.filter((obj) => obj.id !== selectedObjectId) }
          : page
      ),
    }));
    setSelectedObjectId(null);
  };

  const duplicateSelectedObject = () => {
    if (!selectedObjectId) return;
    const selectedObject = currentPage.objects.find((o) => o.id === selectedObjectId);
    if (!selectedObject) return;

    const newObject: CanvasObject = {
      ...selectedObject,
      id: `${selectedObject.type}-${Date.now()}`,
      x: selectedObject.x + 20,
      y: selectedObject.y + 20,
      zIndex: currentPage.objects.length,
    };

    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.map((page, index) =>
        index === currentPageIndex ? { ...page, objects: [...page.objects, newObject] } : page
      ),
    }));

    setSelectedObjectId(newObject.id);
  };

  const rotateSelectedObject = () => {
    if (!selectedObjectId) return;
    const selectedObject = currentPage.objects.find((o) => o.id === selectedObjectId);
    if (!selectedObject) return;
    updateObject(selectedObjectId, { rotation: (selectedObject.rotation + 15) % 360 });
  };

  const bringToFront = () => {
    if (!selectedObjectId) return;
    const maxZIndex = Math.max(...currentPage.objects.map((o) => o.zIndex), 0);
    updateObject(selectedObjectId, { zIndex: maxZIndex + 1 });
  };

  const sendToBack = () => {
    if (!selectedObjectId) return;
    const minZIndex = Math.min(...currentPage.objects.map((o) => o.zIndex), 0);
    updateObject(selectedObjectId, { zIndex: minZIndex - 1 });
  };

  const applyTemplate = (template: Template) => {
    if (template.pagesData) {
      setPagesData(template.pagesData);
      setCurrentPageIndex(0);
      setSelectedObjectId(null);
      setShowTemplatePreview(false);
      setShowNewProjectDialog(false);
      setSelectedTemplate(null);
      toast({ title: "템플릿 적용", description: `"${template.name}" 템플릿이 적용되었습니다.` });
    }
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplatePreview(true);
  };

  const handleNewProjectClick = () => {
    setShowNewProjectDialog(true);
  };

  const createEmptyProject = () => {
    setProjectId(null);
    setProjectTitle("새 포토북");
    setPagesData({ pages: [{ id: "page-1", objects: [], backgroundColor: "#ffffff" }] });
    setCurrentPageIndex(0);
    setSelectedObjectId(null);
    setLoadedImages(new Map());
    setShowNewProjectDialog(false);
    toast({ title: "새 프로젝트", description: "빈 포토북이 생성되었습니다." });
  };

  const createProjectFromTemplate = (template: Template) => {
    setProjectId(null);
    setProjectTitle("새 포토북");
    if (template.pagesData) {
      setPagesData(template.pagesData);
    } else {
      setPagesData({ pages: [{ id: "page-1", objects: [], backgroundColor: "#ffffff" }] });
    }
    setCurrentPageIndex(0);
    setSelectedObjectId(null);
    setLoadedImages(new Map());
    setShowNewProjectDialog(false);
    toast({ title: "새 프로젝트", description: `"${template.name}" 템플릿으로 새 포토북이 생성되었습니다.` });
  };

  const handleSaveAsTemplate = () => {
    if (!newTemplateName.trim()) {
      toast({ title: "오류", description: "템플릿 이름을 입력해주세요.", variant: "destructive" });
      return;
    }
    saveTemplateMutation.mutate({ name: newTemplateName, category: newTemplateCategory });
  };

  const getCurrentPageImages = useCallback(() => {
    return currentPage.objects.filter((obj) => obj.type === "image");
  }, [currentPage]);

  const getRecommendedLayouts = useCallback((imageCount: number): LayoutPreset[] => {
    if (imageCount === 0) return [];
    if (imageCount === 1) return LAYOUT_PRESETS.filter((l) => l.imageCount === 1);
    if (imageCount === 2) return LAYOUT_PRESETS.filter((l) => l.imageCount === 2);
    if (imageCount === 3) return LAYOUT_PRESETS.filter((l) => l.imageCount === 3);
    if (imageCount === 4) return LAYOUT_PRESETS.filter((l) => l.imageCount === 4);
    if (imageCount === 5) return LAYOUT_PRESETS.filter((l) => l.imageCount === 5);
    if (imageCount >= 6) return LAYOUT_PRESETS.filter((l) => l.imageCount === 6);
    return LAYOUT_PRESETS.filter((l) => l.imageCount <= imageCount).slice(-3);
  }, []);

  const handleOpenAILayoutDialog = () => {
    const images = getCurrentPageImages();
    if (images.length === 0) {
      toast({ 
        title: "이미지 없음", 
        description: "레이아웃을 적용할 이미지가 없습니다. 먼저 이미지를 추가해주세요.", 
        variant: "destructive" 
      });
      return;
    }
    const layouts = getRecommendedLayouts(images.length);
    setRecommendedLayouts(layouts);
    setSelectedLayoutPreset(layouts[0] || null);
    setShowAILayoutDialog(true);
  };

  const applyAILayout = () => {
    if (!selectedLayoutPreset) return;
    
    const images = getCurrentPageImages();
    if (images.length === 0) return;

    const positionsToUse = selectedLayoutPreset.positions.slice(0, images.length);
    
    const updatedObjects = currentPage.objects.map((obj) => {
      if (obj.type !== "image") return obj;
      const imageIndex = images.findIndex((img) => img.id === obj.id);
      if (imageIndex === -1 || imageIndex >= positionsToUse.length) return obj;
      
      const position = positionsToUse[imageIndex];
      return {
        ...obj,
        x: position.x,
        y: position.y,
        width: position.width,
        height: position.height,
        rotation: 0,
      };
    });

    setPagesData((prev) => ({
      ...prev,
      pages: prev.pages.map((page, index) =>
        index === currentPageIndex ? { ...page, objects: updatedObjects } : page
      ),
    }));

    setShowAILayoutDialog(false);
    setSelectedLayoutPreset(null);
    setSelectedObjectId(null);
    toast({ title: "레이아웃 적용", description: `"${selectedLayoutPreset.name}" 레이아웃이 적용되었습니다.` });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/photobook/images", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const data = await res.json();

      if (data.success && data.data?.url) {
        addImageObject(data.data.url);
        toast({ title: "업로드 완료", description: "이미지가 업로드되었습니다." });
      } else {
        throw new Error(data.error || "업로드 실패");
      }
    } catch (error) {
      console.error("이미지 업로드 오류:", error);
      toast({ title: "오류", description: "이미지 업로드에 실패했습니다.", variant: "destructive" });
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const exportCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `${projectTitle || "photobook"}-page-${currentPageIndex + 1}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const selectedObject = currentPage.objects.find((o) => o.id === selectedObjectId);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-background">
      <div className="flex items-center justify-between p-3 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <Input
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-48 md:w-64"
            placeholder="프로젝트 제목"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowProjectsDialog(true)}>
            <FolderOpen className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">불러오기</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleNewProjectClick}>
            <FileText className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">새로 만들기</span>
          </Button>
          <Button size="sm" onClick={() => saveProjectMutation.mutate()} disabled={saveProjectMutation.isPending || isAutoSaving}>
            <Save className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">{saveProjectMutation.isPending ? "저장 중..." : "저장"}</span>
          </Button>
          {(lastSaved || isAutoSaving) && (
            <span className="hidden md:inline text-xs text-muted-foreground">
              {isAutoSaving ? (
                <span className="flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  자동 저장 중...
                </span>
              ) : lastSaved ? (
                `마지막 저장: ${lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
              ) : null}
            </span>
          )}
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowSaveTemplateDialog(true)}>
              <BookTemplate className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">템플릿으로 저장</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {leftPanelOpen && (
          <div className="w-48 md:w-56 border-r border-border bg-card flex flex-col">
            <div className="p-2 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium">페이지 목록</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addPage}>
                  <Plus className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={() => setLeftPanelOpen(false)}>
                  <PanelLeftClose className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-2">
                {pagesData.pages.map((page, index) => (
                  <div
                    key={page.id}
                    className={`relative group cursor-pointer rounded-lg border-2 transition-colors ${
                      index === currentPageIndex ? "border-primary" : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => {
                      setCurrentPageIndex(index);
                      setSelectedObjectId(null);
                    }}
                  >
                    <div
                      className="aspect-[4/3] rounded-md"
                      style={{ backgroundColor: page.backgroundColor || "#ffffff" }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
                        {index + 1}
                      </div>
                    </div>
                    {pagesData.pages.length > 1 && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePage(index);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {!leftPanelOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10"
            onClick={() => setLeftPanelOpen(true)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}

        <div className="flex-1 flex flex-col items-center justify-center p-4 bg-muted/30 overflow-auto" ref={containerRef}>
          <div className="mb-2 flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.max(0.25, s - 0.1))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="outline" size="sm" onClick={() => setScale((s) => Math.min(2, s + 0.1))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportCanvas}>
              <Download className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">내보내기</span>
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleOpenAILayoutDialog}
              className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 hover:from-purple-500/20 hover:to-pink-500/20 border-purple-300"
            >
              <Wand2 className="w-4 h-4 mr-1 text-purple-500" />
              <span className="hidden sm:inline">AI 레이아웃</span>
            </Button>
          </div>

          <div
            className="bg-white shadow-lg rounded-lg overflow-hidden"
            style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}
          >
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="cursor-crosshair"
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseLeave={handleCanvasMouseUp}
            />
          </div>

          {selectedObject && (
            <div className="mt-2 flex items-center gap-1 flex-wrap justify-center">
              <Button variant="outline" size="sm" onClick={deleteSelectedObject}>
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={duplicateSelectedObject}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={rotateSelectedObject}>
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={bringToFront}>
                <Layers className="w-4 h-4" />
                <span className="ml-1 text-xs">앞</span>
              </Button>
              <Button variant="outline" size="sm" onClick={sendToBack}>
                <Layers className="w-4 h-4" />
                <span className="ml-1 text-xs">뒤</span>
              </Button>
            </div>
          )}
        </div>

        {rightPanelOpen && (
          <div className="w-56 md:w-64 border-l border-border bg-card flex flex-col">
            <div className="p-2 border-b border-border flex items-center justify-between">
              <span className="text-sm font-medium">도구</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 md:hidden" onClick={() => setRightPanelOpen(false)}>
                <PanelRightClose className="w-4 h-4" />
              </Button>
            </div>
            <Tabs defaultValue="elements" className="flex-1 flex flex-col">
              <TabsList className="w-full grid grid-cols-4 h-auto p-1">
                <TabsTrigger value="elements" className="text-xs py-1.5">
                  <ImageIcon className="w-3 h-3" />
                </TabsTrigger>
                <TabsTrigger value="text" className="text-xs py-1.5">
                  <Type className="w-3 h-3" />
                </TabsTrigger>
                <TabsTrigger value="background" className="text-xs py-1.5">
                  <Palette className="w-3 h-3" />
                </TabsTrigger>
                <TabsTrigger value="templates" className="text-xs py-1.5">
                  <Layout className="w-3 h-3" />
                </TabsTrigger>
              </TabsList>

              <TabsContent value="elements" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">디바이스에서 업로드</label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                      >
                        {isUploadingImage ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            업로드 중...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            이미지 선택
                          </>
                        )}
                      </Button>
                    </div>

                    <div className="border-t border-border pt-3">
                      <label className="text-xs font-medium mb-2 block">내 갤러리</label>
                      <Select value={galleryCategory} onValueChange={setGalleryCategory}>
                        <SelectTrigger className="w-full h-8 text-xs mb-2">
                          <SelectValue placeholder="카테고리 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          {GALLERY_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      
                      {galleryLoading ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : galleryImages.length > 0 ? (
                        <div className="grid grid-cols-3 gap-1">
                          {galleryImages.map((image) => (
                            <button
                              key={image.id}
                              className="aspect-square rounded border border-border hover:border-primary overflow-hidden bg-muted"
                              onClick={() => addImageObject(image.transformedUrl || image.url)}
                              title={image.title}
                            >
                              <img
                                src={image.thumbnailUrl || image.url}
                                alt={image.title}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-2">
                          갤러리에 이미지가 없습니다.
                        </p>
                      )}
                    </div>

                    <div className="border-t border-border pt-3">
                      <label className="text-xs font-medium mb-1 block">아이콘/스티커</label>
                      <div className="grid grid-cols-4 gap-1">
                        {icons.slice(0, 12).map((icon) => (
                          <button
                            key={icon.id}
                            className="aspect-square rounded border border-border hover:border-primary p-1 bg-background"
                            onClick={() => addIconObject(icon)}
                          >
                            <img
                              src={icon.thumbnailUrl || icon.imageUrl}
                              alt={icon.name}
                              className="w-full h-full object-contain"
                            />
                          </button>
                        ))}
                      </div>
                      {icons.length === 0 && (
                        <p className="text-xs text-muted-foreground">등록된 아이콘이 없습니다.</p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="text" className="flex-1 m-0 overflow-hidden">
                <div className="p-2 space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block">텍스트 추가</label>
                    <div className="space-y-2">
                      <Input
                        value={newText}
                        onChange={(e) => setNewText(e.target.value)}
                        placeholder="텍스트 입력"
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={newTextFontSize}
                          onChange={(e) => setNewTextFontSize(Number(e.target.value))}
                          min={8}
                          max={120}
                          className="w-20 text-xs"
                        />
                        <Input
                          type="color"
                          value={newTextColor}
                          onChange={(e) => setNewTextColor(e.target.value)}
                          className="w-12 p-1 h-9"
                        />
                      </div>
                      <Button size="sm" className="w-full" onClick={addTextObject} disabled={!newText.trim()}>
                        <Plus className="w-4 h-4 mr-1" />
                        텍스트 추가
                      </Button>
                    </div>
                  </div>

                  {selectedObject?.type === "text" && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      <label className="text-xs font-medium">선택된 텍스트 편집</label>
                      <Input
                        value={selectedObject.content}
                        onChange={(e) => updateObject(selectedObjectId!, { content: e.target.value })}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          value={selectedObject.fontSize || 24}
                          onChange={(e) => updateObject(selectedObjectId!, { fontSize: Number(e.target.value) })}
                          min={8}
                          max={120}
                          className="w-20 text-xs"
                        />
                        <Input
                          type="color"
                          value={selectedObject.fontColor || "#000000"}
                          onChange={(e) => updateObject(selectedObjectId!, { fontColor: e.target.value })}
                          className="w-12 p-1 h-9"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="background" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-3">
                    <div>
                      <label className="text-xs font-medium mb-1 block">단색 배경</label>
                      <div className="flex gap-1 flex-wrap">
                        {["#ffffff", "#f3f4f6", "#fef3c7", "#fce7f3", "#dbeafe", "#d1fae5", "#fee2e2", "#e0e7ff"].map(
                          (color) => (
                            <button
                              key={color}
                              className="w-8 h-8 rounded border border-border hover:ring-2 ring-primary"
                              style={{ backgroundColor: color }}
                              onClick={() => setBackgroundColor(color)}
                            />
                          )
                        )}
                        <Input
                          type="color"
                          value={currentPage.backgroundColor || "#ffffff"}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                          className="w-8 h-8 p-0.5"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">배경 이미지</label>
                      <div className="grid grid-cols-3 gap-1">
                        {backgrounds.map((bg) => (
                          <button
                            key={bg.id}
                            className="aspect-[4/3] rounded border border-border hover:border-primary overflow-hidden"
                            onClick={() => setBackground(bg)}
                          >
                            <img
                              src={bg.thumbnailUrl || bg.imageUrl}
                              alt={bg.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                      {backgrounds.length === 0 && (
                        <p className="text-xs text-muted-foreground">등록된 배경이 없습니다.</p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="templates" className="flex-1 m-0 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="p-2 space-y-2">
                    <label className="text-xs font-medium mb-1 block">템플릿 적용</label>
                    <Select value={templateCategory} onValueChange={setTemplateCategory}>
                      <SelectTrigger className="w-full h-8 text-xs mb-2">
                        <SelectValue placeholder="카테고리 선택" />
                      </SelectTrigger>
                      <SelectContent>
                        {TEMPLATE_CATEGORIES.map((cat) => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="grid grid-cols-2 gap-2">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          className="aspect-[4/3] rounded border border-border hover:border-primary overflow-hidden bg-muted flex items-center justify-center text-xs text-muted-foreground relative group"
                          onClick={() => handleTemplateClick(template)}
                        >
                          {template.thumbnailUrl ? (
                            <img
                              src={template.thumbnailUrl}
                              alt={template.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-center px-1">{template.name}</span>
                          )}
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                    {templates.length === 0 && (
                      <p className="text-xs text-muted-foreground">등록된 템플릿이 없습니다.</p>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {!rightPanelOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10"
            onClick={() => setRightPanelOpen(true)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
        )}
      </div>

      <Dialog open={showProjectsDialog} onOpenChange={setShowProjectsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>프로젝트 불러오기</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">저장된 프로젝트가 없습니다.</p>
              ) : (
                projects.map((project) => (
                  <Card
                    key={project.id}
                    className="p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => loadProject(project)}
                  >
                    <div className="font-medium">{project.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {project.pageCount}페이지 · {new Date(project.updatedAt).toLocaleDateString()}
                    </div>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 템플릿 미리보기 다이얼로그 */}
      <Dialog open={showTemplatePreview} onOpenChange={setShowTemplatePreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>템플릿 미리보기</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="aspect-[4/3] bg-muted rounded-lg overflow-hidden">
                {selectedTemplate.thumbnailUrl ? (
                  <img
                    src={selectedTemplate.thumbnailUrl}
                    alt={selectedTemplate.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    미리보기 없음
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">{selectedTemplate.name}</h3>
                <div className="flex gap-2 text-sm text-muted-foreground">
                  <span>{selectedTemplate.pageCount}페이지</span>
                  <span>·</span>
                  <span>{TEMPLATE_CATEGORIES.find(c => c.value === selectedTemplate.category)?.label || selectedTemplate.category}</span>
                </div>
                {selectedTemplate.description && (
                  <p className="text-sm text-muted-foreground">{selectedTemplate.description}</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowTemplatePreview(false)}>
                  취소
                </Button>
                <Button onClick={() => {
                  applyTemplate(selectedTemplate);
                  setShowTemplatePreview(false);
                }}>
                  적용
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 새 프로젝트 생성 다이얼로그 */}
      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>새 프로젝트 만들기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <button
                className="aspect-[4/3] border-2 border-dashed border-muted-foreground/30 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary hover:bg-muted/50 transition-colors"
                onClick={createEmptyProject}
              >
                <Plus className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">빈 프로젝트</span>
              </button>
              {templates.map((template) => (
                <button
                  key={template.id}
                  className="aspect-[4/3] border rounded-lg overflow-hidden hover:ring-2 ring-primary transition-all relative group"
                  onClick={() => createProjectFromTemplate(template)}
                >
                  {template.thumbnailUrl ? (
                    <img
                      src={template.thumbnailUrl}
                      alt={template.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <span className="text-xs text-center px-2">{template.name}</span>
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 text-center">
                    {template.name}
                  </div>
                </button>
              ))}
            </div>
            {templates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">등록된 템플릿이 없습니다. 빈 프로젝트로 시작하세요.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 템플릿으로 저장 다이얼로그 (관리자 전용) */}
      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>템플릿으로 저장</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">템플릿 이름</label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="템플릿 이름을 입력하세요"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">카테고리</label>
              <Select value={newTemplateCategory} onValueChange={setNewTemplateCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.filter(c => c.value !== 'all').map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>
                취소
              </Button>
              <Button 
                onClick={handleSaveAsTemplate}
                disabled={!newTemplateName.trim() || saveTemplateMutation.isPending}
              >
                {saveTemplateMutation.isPending ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI 레이아웃 추천 다이얼로그 */}
      <Dialog open={showAILayoutDialog} onOpenChange={setShowAILayoutDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-purple-500" />
              AI 레이아웃 추천
            </DialogTitle>
            <DialogDescription>
              현재 페이지의 이미지 {getCurrentPageImages().length}장에 맞는 레이아웃을 선택하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {recommendedLayouts.map((layout) => (
                <button
                  key={layout.id}
                  className={`relative aspect-[4/3] border-2 rounded-lg overflow-hidden transition-all ${
                    selectedLayoutPreset?.id === layout.id
                      ? "border-purple-500 ring-2 ring-purple-500/30"
                      : "border-border hover:border-purple-300"
                  }`}
                  onClick={() => setSelectedLayoutPreset(layout)}
                >
                  <div className="absolute inset-0 bg-muted p-2">
                    <svg
                      viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                      className="w-full h-full"
                      preserveAspectRatio="xMidYMid meet"
                    >
                      <rect
                        x="0"
                        y="0"
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        fill="white"
                        stroke="#e5e7eb"
                        strokeWidth="2"
                      />
                      {layout.positions.map((pos, idx) => (
                        <g key={idx}>
                          <rect
                            x={pos.x}
                            y={pos.y}
                            width={pos.width}
                            height={pos.height}
                            fill="#e0e7ff"
                            stroke="#6366f1"
                            strokeWidth="2"
                            rx="4"
                          />
                          <text
                            x={pos.x + pos.width / 2}
                            y={pos.y + pos.height / 2}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="#4f46e5"
                            fontSize="48"
                            fontWeight="bold"
                          >
                            {idx + 1}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs py-1 text-center">
                    {layout.name}
                  </div>
                  {selectedLayoutPreset?.id === layout.id && (
                    <div className="absolute top-1 right-1 w-5 h-5 bg-purple-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
            {recommendedLayouts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                현재 이미지 개수에 맞는 레이아웃이 없습니다.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setShowAILayoutDialog(false)}>
                취소
              </Button>
              <Button
                onClick={applyAILayout}
                disabled={!selectedLayoutPreset}
                className="bg-purple-500 hover:bg-purple-600"
              >
                <Grid className="w-4 h-4 mr-1" />
                레이아웃 적용
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
