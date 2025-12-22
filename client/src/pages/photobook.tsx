import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ChevronDown,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  Layers,
  FolderOpen,
  FileText,
  Download,
  Upload,
  Loader2,
  Eye,
  BookTemplate,
  History,
  Minus,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import * as fabric from "fabric";

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
  scaleX?: number;
  scaleY?: number;
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

interface Version {
  id: number;
  projectId: number;
  versionNumber: number;
  pagesDataSnapshot: PagesData;
  description?: string;
  isAutoSave: boolean;
  createdAt: string;
}

interface AlbumSize {
  id: string;
  name: string;
  label: string;
  widthCm: number;
  heightCm: number;
  widthPx: number;
  heightPx: number;
}

const DISPLAY_DPI = 96;
const EXPORT_DPI = 300;
const CM_TO_INCH = 0.393701;

const ALBUM_SIZES: AlbumSize[] = [
  {
    id: "8x8",
    name: "8 x 8",
    label: "8 x 8 (21.1cm x 21.1cm)",
    widthCm: 21.1,
    heightCm: 21.1,
    widthPx: Math.round(21.1 * CM_TO_INCH * DISPLAY_DPI),
    heightPx: Math.round(21.1 * CM_TO_INCH * DISPLAY_DPI),
  },
  {
    id: "8x10",
    name: "8 x 10",
    label: "8 x 10 (28.1cm x 21.1cm)",
    widthCm: 28.1,
    heightCm: 21.1,
    widthPx: Math.round(28.1 * CM_TO_INCH * DISPLAY_DPI),
    heightPx: Math.round(21.1 * CM_TO_INCH * DISPLAY_DPI),
  },
  {
    id: "10x10",
    name: "10 x 10",
    label: "10 x 10 (26.2cm x 26.2cm)",
    widthCm: 26.2,
    heightCm: 26.2,
    widthPx: Math.round(26.2 * CM_TO_INCH * DISPLAY_DPI),
    heightPx: Math.round(26.2 * CM_TO_INCH * DISPLAY_DPI),
  },
  {
    id: "12x12",
    name: "12 x 12",
    label: "12 x 12 (31.3cm x 31.3cm)",
    widthCm: 31.3,
    heightCm: 31.3,
    widthPx: Math.round(31.3 * CM_TO_INCH * DISPLAY_DPI),
    heightPx: Math.round(31.3 * CM_TO_INCH * DISPLAY_DPI),
  },
  {
    id: "a4",
    name: "A4",
    label: "A4 (21cm x 29.7cm)",
    widthCm: 21,
    heightCm: 29.7,
    widthPx: Math.round(21 * CM_TO_INCH * DISPLAY_DPI),
    heightPx: Math.round(29.7 * CM_TO_INCH * DISPLAY_DPI),
  },
];

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

const BLEED_MM = 5;
const SAFE_ZONE_MM = 10;
const MM_TO_PX = (mm: number) => Math.round(mm * 0.1 * CM_TO_INCH * DISPLAY_DPI);

export default function PhotobookPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useMobile();
  const { user } = useAuth();
  const isAdmin = user?.memberType === "admin" || user?.memberType === "superadmin";
  
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);

  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectTitle, setProjectTitle] = useState("새 포토북");
  const [pagesData, setPagesData] = useState<PagesData>({
    pages: [
      { id: "page-1", objects: [], backgroundColor: "#ffffff" },
      { id: "page-2", objects: [], backgroundColor: "#ffffff" },
    ],
  });
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const [selectedAlbumSize, setSelectedAlbumSize] = useState<AlbumSize>(ALBUM_SIZES[0]);
  const [scale, setScale] = useState(0.15);
  const [showProjectsDialog, setShowProjectsDialog] = useState(false);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [showVersionHistoryDialog, setShowVersionHistoryDialog] = useState(false);
  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateCategory, setNewTemplateCategory] = useState("general");
  const [galleryCategory, setGalleryCategory] = useState<string>("all");
  const [templateCategory, setTemplateCategory] = useState<string>("all");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [newText, setNewText] = useState("");
  const [newTextFontSize, setNewTextFontSize] = useState(48);
  const [newTextColor, setNewTextColor] = useState("#000000");
  const [uploadedImages, setUploadedImages] = useState<{ id: string; url: string; name: string }[]>([]);
  const [showGalleryPicker, setShowGalleryPicker] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasUnsavedChanges = useRef(false);
  const suppressDirtyFlag = useRef(false);
  const isInitializedRef = useRef(false);
  const pagesDataRef = useRef(pagesData);
  
  // pagesData 변경 시 ref 동기화
  useEffect(() => {
    pagesDataRef.current = pagesData;
  }, [pagesData]);

  const spreadWidth = selectedAlbumSize.widthPx * 2;
  const spreadHeight = selectedAlbumSize.heightPx;
  const pageWidth = selectedAlbumSize.widthPx;

  const leftPageIndex = currentSpreadIndex * 2;
  const rightPageIndex = currentSpreadIndex * 2 + 1;
  const leftPage = pagesData.pages[leftPageIndex];
  const rightPage = pagesData.pages[rightPageIndex];

  const { data: projectsData, isLoading: projectsLoading } = useQuery<{ success: boolean; data: Project[] }>({
    queryKey: ["/api/photobook/projects"],
    queryFn: async () => {
      const res = await fetch("/api/photobook/projects", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch projects");
      return res.json();
    },
  });

  const { data: backgroundsData } = useQuery<{ success: boolean; data: Background[] }>({
    queryKey: ["/api/photobook/backgrounds"],
    queryFn: async () => {
      const res = await fetch("/api/photobook/backgrounds", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch backgrounds");
      return res.json();
    },
  });

  const { data: iconsData } = useQuery<{ success: boolean; data: Icon[] }>({
    queryKey: ["/api/photobook/icons"],
    queryFn: async () => {
      const res = await fetch("/api/photobook/icons", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch icons");
      return res.json();
    },
  });

  const { data: templatesData } = useQuery<{ success: boolean; data: Template[] }>({
    queryKey: ["/api/photobook/templates", templateCategory],
    queryFn: async () => {
      const categoryParam = templateCategory && templateCategory !== "all" ? `?category=${templateCategory}` : "";
      const res = await fetch(`/api/photobook/templates${categoryParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch templates");
      return res.json();
    },
  });

  const { data: galleryData, isLoading: galleryLoading } = useQuery<{ success: boolean; data: GalleryImage[] }>({
    queryKey: ["/api/gallery", galleryCategory],
    queryFn: async () => {
      const filterParam = galleryCategory && galleryCategory !== "all" ? `?filter=${galleryCategory}` : "";
      const res = await fetch(`/api/gallery${filterParam}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch gallery");
      return res.json();
    },
  });

  const { data: versionsData, isLoading: versionsLoading } = useQuery<{ success: boolean; data: Version[] }>({
    queryKey: ["/api/photobook/projects", projectId, "versions"],
    queryFn: async () => {
      const res = await fetch(`/api/photobook/projects/${projectId}/versions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch versions");
      return res.json();
    },
    enabled: !!projectId && showVersionHistoryDialog,
  });

  const versions = versionsData?.data || [];
  const projects = projectsData?.data || [];
  const galleryImages = Array.isArray(galleryData?.data) ? galleryData.data : [];
  const backgrounds = backgroundsData?.data || [];
  const icons = iconsData?.data || [];
  const templates = templatesData?.data || [];

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

  const saveTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; category: string }) => {
      const res = await apiRequest("/api/admin/photobook/templates", {
        method: "POST",
        data: {
          name: data.name,
          category: data.category,
          pagesData,
          pageCount: pagesData.pages.length,
          canvasWidth: spreadWidth,
          canvasHeight: spreadHeight,
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

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionId: number) => {
      const res = await apiRequest(`/api/photobook/projects/${projectId}/restore/${versionId}`, {
        method: "POST",
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.data) {
        const restoredPagesData = data.data.pagesData || { 
          pages: [
            { id: "page-1", objects: [], backgroundColor: "#ffffff" },
            { id: "page-2", objects: [], backgroundColor: "#ffffff" },
          ] 
        };
        suppressDirtyFlag.current = true;
        setPagesData(restoredPagesData);
        setCurrentSpreadIndex(0);
        setShowVersionHistoryDialog(false);
        hasUnsavedChanges.current = false;
        setLastSaved(new Date());
        queryClient.invalidateQueries({ queryKey: ["/api/photobook/projects", projectId, "versions"] });
        queryClient.invalidateQueries({ queryKey: ["/api/photobook/projects"] });
        toast({ title: "버전 복원 완료", description: data.message || "이전 버전으로 복원되었습니다." });
      }
    },
    onError: () => {
      toast({ title: "오류", description: "버전 복원에 실패했습니다.", variant: "destructive" });
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
    if (suppressDirtyFlag.current) {
      suppressDirtyFlag.current = false;
      return;
    }
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

  const prevSpreadIndexRef = useRef(currentSpreadIndex);
  useEffect(() => {
    if (prevSpreadIndexRef.current !== currentSpreadIndex && fabricCanvasRef.current) {
      renderSpread();
    }
    prevSpreadIndexRef.current = currentSpreadIndex;
  }, [currentSpreadIndex]);

  const initializeFabricCanvas = useCallback(() => {
    if (!canvasElRef.current || fabricCanvasRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: spreadWidth,
      height: spreadHeight,
      backgroundColor: "#e5e5e5",
      selection: true,
      preserveObjectStacking: true,
    });

    fabricCanvasRef.current = canvas;
    isInitializedRef.current = true;

    canvas.on("object:modified", () => {
      syncCanvasToState();
    });

    canvas.on("object:added", () => {
      if (isInitializedRef.current) {
        syncCanvasToState();
      }
    });

    canvas.on("object:removed", () => {
      syncCanvasToState();
    });

    renderSpread();
  }, [spreadWidth, spreadHeight]);

  const syncCanvasToState = useCallback((targetSpreadIndex?: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const spreadIdx = targetSpreadIndex !== undefined ? targetSpreadIndex : currentSpreadIndex;
    const targetLeftPageIndex = spreadIdx * 2;
    const targetRightPageIndex = spreadIdx * 2 + 1;

    const objects = canvas.getObjects().filter(obj => {
      const customData = (obj as any).customData;
      return customData && customData.type !== "guide" && customData.type !== "page-bg";
    });

    const leftObjects: CanvasObject[] = [];
    const rightObjects: CanvasObject[] = [];

    objects.forEach((obj, index) => {
      const customData = (obj as any).customData;
      if (!customData) return;

      const canvasObj: CanvasObject = {
        id: customData.id || `obj-${Date.now()}-${index}`,
        type: customData.objectType || "image",
        x: obj.left || 0,
        y: obj.top || 0,
        width: (obj.width || 100) * (obj.scaleX || 1),
        height: (obj.height || 100) * (obj.scaleY || 1),
        rotation: obj.angle || 0,
        content: customData.content || "",
        zIndex: index,
        scaleX: obj.scaleX || 1,
        scaleY: obj.scaleY || 1,
        fontSize: customData.fontSize,
        fontFamily: customData.fontFamily,
        fontColor: customData.fontColor,
        textAlign: customData.textAlign,
      };

      const centerX = (obj.left || 0) + (obj.width || 0) * (obj.scaleX || 1) / 2;
      if (centerX < pageWidth) {
        leftObjects.push(canvasObj);
      } else {
        rightObjects.push({ ...canvasObj, x: canvasObj.x - pageWidth });
      }
    });

    // ref 먼저 업데이트 (동기적) - 페이지 전환 시 즉시 반영
    const newPages = [...pagesDataRef.current.pages];
    if (newPages[targetLeftPageIndex]) {
      newPages[targetLeftPageIndex] = { ...newPages[targetLeftPageIndex], objects: leftObjects };
    }
    if (newPages[targetRightPageIndex]) {
      newPages[targetRightPageIndex] = { ...newPages[targetRightPageIndex], objects: rightObjects };
    }
    pagesDataRef.current = { pages: newPages };
    
    // 상태도 업데이트 (비동기) - React 리렌더링용
    setPagesData({ pages: newPages });
  }, [currentSpreadIndex, pageWidth]);

  const renderSpread = useCallback(async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // ref에서 최신 페이지 데이터 읽기 (동기적으로 업데이트된 값 사용)
    const currentPagesData = pagesDataRef.current;
    const currentLeftPageIndex = currentSpreadIndex * 2;
    const currentRightPageIndex = currentSpreadIndex * 2 + 1;
    const currentLeftPage = currentPagesData.pages[currentLeftPageIndex];
    const currentRightPage = currentPagesData.pages[currentRightPageIndex];

    canvas.clear();
    canvas.setDimensions({ width: spreadWidth, height: spreadHeight });

    const leftBg = new fabric.Rect({
      left: 0,
      top: 0,
      width: pageWidth,
      height: spreadHeight,
      fill: currentLeftPage?.backgroundColor || "#ffffff",
      selectable: false,
      evented: false,
    });
    (leftBg as any).customData = { type: "page-bg" };
    canvas.add(leftBg);

    const rightBg = new fabric.Rect({
      left: pageWidth,
      top: 0,
      width: pageWidth,
      height: spreadHeight,
      fill: currentRightPage?.backgroundColor || "#ffffff",
      selectable: false,
      evented: false,
    });
    (rightBg as any).customData = { type: "page-bg" };
    canvas.add(rightBg);

    if (currentLeftPage?.backgroundImage) {
      try {
        const img = await loadImage(currentLeftPage.backgroundImage);
        img.set({
          left: 0,
          top: 0,
          scaleX: pageWidth / (img.width || 1),
          scaleY: spreadHeight / (img.height || 1),
          selectable: false,
          evented: false,
        });
        (img as any).customData = { type: "page-bg" };
        canvas.add(img);
      } catch (e) {
        console.error("Failed to load left background:", e);
      }
    }

    if (currentRightPage?.backgroundImage) {
      try {
        const img = await loadImage(currentRightPage.backgroundImage);
        img.set({
          left: pageWidth,
          top: 0,
          scaleX: pageWidth / (img.width || 1),
          scaleY: spreadHeight / (img.height || 1),
          selectable: false,
          evented: false,
        });
        (img as any).customData = { type: "page-bg" };
        canvas.add(img);
      } catch (e) {
        console.error("Failed to load right background:", e);
      }
    }

    if (currentLeftPage?.objects) {
      for (const obj of currentLeftPage.objects) {
        await addObjectToCanvas(canvas, obj, 0);
      }
    }

    if (currentRightPage?.objects) {
      for (const obj of currentRightPage.objects) {
        await addObjectToCanvas(canvas, obj, pageWidth);
      }
    }

    if (showGuides) {
      renderGuides(canvas);
    }

    canvas.renderAll();
  }, [spreadWidth, spreadHeight, pageWidth, currentSpreadIndex, showGuides]);

  const loadImage = (url: string): Promise<fabric.Image> => {
    return new Promise((resolve, reject) => {
      const proxyUrl = url.startsWith("/") ? url : `/api/image-proxy?url=${encodeURIComponent(url)}`;
      
      fabric.Image.fromURL(proxyUrl, { crossOrigin: "anonymous" })
        .then((img) => resolve(img))
        .catch(() => {
          fabric.Image.fromURL(url, { crossOrigin: "anonymous" })
            .then((img) => resolve(img))
            .catch(reject);
        });
    });
  };

  const addObjectToCanvas = async (canvas: fabric.Canvas, obj: CanvasObject, offsetX: number) => {
    if (obj.type === "image" || obj.type === "icon") {
      try {
        const img = await loadImage(obj.content);
        const scaleX = obj.width / (img.width || 100);
        const scaleY = obj.height / (img.height || 100);
        
        img.set({
          left: obj.x + offsetX,
          top: obj.y,
          scaleX,
          scaleY,
          angle: obj.rotation || 0,
          selectable: true,
          hasControls: true,
          hasBorders: true,
          cornerStyle: "circle",
          cornerColor: "#6366f1",
          cornerStrokeColor: "#ffffff",
          borderColor: "#6366f1",
          borderScaleFactor: 2,
          transparentCorners: false,
          padding: 5,
        });
        (img as any).customData = {
          id: obj.id,
          objectType: obj.type,
          content: obj.content,
        };
        canvas.add(img);
      } catch (e) {
        console.error("Failed to load image:", obj.content, e);
        const placeholder = new fabric.Rect({
          left: obj.x + offsetX,
          top: obj.y,
          width: obj.width,
          height: obj.height,
          fill: "#cccccc",
          stroke: "#999999",
          strokeWidth: 1,
        });
        (placeholder as any).customData = {
          id: obj.id,
          objectType: obj.type,
          content: obj.content,
        };
        canvas.add(placeholder);
      }
    } else if (obj.type === "text") {
      const text = new fabric.Textbox(obj.content, {
        left: obj.x + offsetX,
        top: obj.y,
        width: obj.width,
        fontSize: obj.fontSize || 48,
        fontFamily: obj.fontFamily || "sans-serif",
        fill: obj.fontColor || "#000000",
        angle: obj.rotation || 0,
        selectable: true,
        hasControls: true,
        hasBorders: true,
        cornerStyle: "circle",
        cornerColor: "#6366f1",
        cornerStrokeColor: "#ffffff",
        borderColor: "#6366f1",
        borderScaleFactor: 2,
        transparentCorners: false,
        padding: 5,
      });
      (text as any).customData = {
        id: obj.id,
        objectType: "text",
        content: obj.content,
        fontSize: obj.fontSize,
        fontFamily: obj.fontFamily,
        fontColor: obj.fontColor,
        textAlign: obj.textAlign,
      };
      canvas.add(text);
    }
  };

  const renderGuides = (canvas: fabric.Canvas) => {
    const bleedPx = MM_TO_PX(BLEED_MM);
    const safePx = MM_TO_PX(SAFE_ZONE_MM);

    const centerLine = new fabric.Line([pageWidth, 0, pageWidth, spreadHeight], {
      stroke: "#6366f1",
      strokeWidth: 2,
      strokeDashArray: [10, 5],
      selectable: false,
      evented: false,
    });
    (centerLine as any).customData = { type: "guide" };
    canvas.add(centerLine);

    const bleedLines = [
      new fabric.Rect({
        left: 0,
        top: 0,
        width: spreadWidth,
        height: bleedPx,
        fill: "rgba(255, 0, 0, 0.1)",
        selectable: false,
        evented: false,
      }),
      new fabric.Rect({
        left: 0,
        top: spreadHeight - bleedPx,
        width: spreadWidth,
        height: bleedPx,
        fill: "rgba(255, 0, 0, 0.1)",
        selectable: false,
        evented: false,
      }),
      new fabric.Rect({
        left: 0,
        top: 0,
        width: bleedPx,
        height: spreadHeight,
        fill: "rgba(255, 0, 0, 0.1)",
        selectable: false,
        evented: false,
      }),
      new fabric.Rect({
        left: spreadWidth - bleedPx,
        top: 0,
        width: bleedPx,
        height: spreadHeight,
        fill: "rgba(255, 0, 0, 0.1)",
        selectable: false,
        evented: false,
      }),
    ];

    bleedLines.forEach(line => {
      (line as any).customData = { type: "guide" };
      canvas.add(line);
    });

    const safeZoneLeft = new fabric.Rect({
      left: safePx,
      top: safePx,
      width: pageWidth - safePx * 2,
      height: spreadHeight - safePx * 2,
      fill: "transparent",
      stroke: "#22c55e",
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    });
    (safeZoneLeft as any).customData = { type: "guide" };
    canvas.add(safeZoneLeft);

    const safeZoneRight = new fabric.Rect({
      left: pageWidth + safePx,
      top: safePx,
      width: pageWidth - safePx * 2,
      height: spreadHeight - safePx * 2,
      fill: "transparent",
      stroke: "#22c55e",
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    });
    (safeZoneRight as any).customData = { type: "guide" };
    canvas.add(safeZoneRight);
  };

  useEffect(() => {
    initializeFabricCanvas();
    return () => {
      if (fabricCanvasRef.current) {
        fabricCanvasRef.current.dispose();
        fabricCanvasRef.current = null;
        isInitializedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (fabricCanvasRef.current && isInitializedRef.current) {
      renderSpread();
    }
  }, [currentSpreadIndex, selectedAlbumSize, pagesData.pages.length, showGuides]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        const containerWidth = canvasContainerRef.current.clientWidth - 40;
        const containerHeight = canvasContainerRef.current.clientHeight - 100;
        const scaleX = containerWidth / spreadWidth;
        const scaleY = containerHeight / spreadHeight;
        const newScale = Math.min(scaleX, scaleY, 0.3);
        setScale(newScale);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [spreadWidth, spreadHeight]);

  const addImageToCanvas = async (imageUrl: string) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      const img = await loadImage(imageUrl);
      const maxSize = Math.min(pageWidth * 0.5, spreadHeight * 0.5);
      const aspectRatio = (img.width || 1) / (img.height || 1);
      let width, height;
      
      if (aspectRatio > 1) {
        width = maxSize;
        height = maxSize / aspectRatio;
      } else {
        height = maxSize;
        width = maxSize * aspectRatio;
      }

      img.set({
        left: pageWidth / 2 - width / 2,
        top: spreadHeight / 2 - height / 2,
        scaleX: width / (img.width || 1),
        scaleY: height / (img.height || 1),
        selectable: true,
        hasControls: true,
        hasBorders: true,
        cornerStyle: "circle",
        cornerColor: "#6366f1",
        cornerStrokeColor: "#ffffff",
        borderColor: "#6366f1",
        borderScaleFactor: 2,
        transparentCorners: false,
        padding: 5,
      });

      (img as any).customData = {
        id: `image-${Date.now()}`,
        objectType: "image",
        content: imageUrl,
      };

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
      
      toast({ title: "이미지 추가", description: "이미지가 캔버스에 추가되었습니다." });
    } catch (e) {
      console.error("Failed to add image:", e);
      toast({ title: "오류", description: "이미지 로드에 실패했습니다.", variant: "destructive" });
    }
  };

  const addIconToCanvas = async (icon: Icon) => {
    await addImageToCanvas(icon.imageUrl);
  };

  const addTextToCanvas = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas || !newText.trim()) return;

    const text = new fabric.Textbox(newText, {
      left: pageWidth / 2,
      top: spreadHeight / 2,
      width: 400,
      fontSize: newTextFontSize,
      fontFamily: "sans-serif",
      fill: newTextColor,
      selectable: true,
      hasControls: true,
      hasBorders: true,
      cornerStyle: "circle",
      cornerColor: "#6366f1",
      cornerStrokeColor: "#ffffff",
      borderColor: "#6366f1",
      borderScaleFactor: 2,
      transparentCorners: false,
      padding: 5,
    });

    (text as any).customData = {
      id: `text-${Date.now()}`,
      objectType: "text",
      content: newText,
      fontSize: newTextFontSize,
      fontColor: newTextColor,
    };

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
    setNewText("");
    
    toast({ title: "텍스트 추가", description: "텍스트가 캔버스에 추가되었습니다." });
  };

  const setPageBackgroundColor = (color: string, pageIndex: number) => {
    setPagesData(prev => {
      const newPages = [...prev.pages];
      if (newPages[pageIndex]) {
        newPages[pageIndex] = { 
          ...newPages[pageIndex], 
          backgroundColor: color,
          backgroundImage: undefined,
        };
      }
      return { pages: newPages };
    });
    setTimeout(() => renderSpread(), 0);
  };

  const setPageBackgroundImage = (bg: Background, pageIndex: number) => {
    setPagesData(prev => {
      const newPages = [...prev.pages];
      if (newPages[pageIndex]) {
        newPages[pageIndex] = { 
          ...newPages[pageIndex], 
          backgroundImage: bg.imageUrl,
        };
      }
      return { pages: newPages };
    });
    setTimeout(() => renderSpread(), 0);
  };

  const deleteSelectedObject = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.remove(activeObject);
      canvas.renderAll();
    }
  };

  const duplicateSelectedObject = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      activeObject.clone().then((cloned: fabric.FabricObject) => {
        cloned.set({
          left: (activeObject.left || 0) + 50,
          top: (activeObject.top || 0) + 50,
        });
        (cloned as any).customData = {
          ...(activeObject as any).customData,
          id: `${(activeObject as any).customData?.objectType || "obj"}-${Date.now()}`,
        };
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.renderAll();
      });
    }
  };

  const rotateSelectedObject = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      activeObject.rotate((activeObject.angle || 0) + 15);
      canvas.renderAll();
    }
  };

  const bringToFront = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      canvas.bringObjectToFront(activeObject);
      canvas.renderAll();
    }
  };

  const sendToBack = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;
    
    const activeObject = canvas.getActiveObject();
    if (activeObject) {
      const bgObjects = canvas.getObjects().filter(obj => 
        (obj as any).customData?.type === "page-bg" || 
        (obj as any).customData?.type === "guide"
      );
      canvas.sendObjectToBack(activeObject);
      bgObjects.forEach(obj => canvas.sendObjectToBack(obj));
      canvas.renderAll();
    }
  };

  const addSpread = () => {
    setPagesData(prev => ({
      pages: [
        ...prev.pages,
        { id: `page-${Date.now()}`, objects: [], backgroundColor: "#ffffff" },
        { id: `page-${Date.now() + 1}`, objects: [], backgroundColor: "#ffffff" },
      ],
    }));
    toast({ title: "스프레드 추가", description: "새로운 스프레드가 추가되었습니다." });
  };

  const deleteSpread = () => {
    if (pagesData.pages.length <= 2) {
      toast({ title: "삭제 불가", description: "최소 1개의 스프레드가 필요합니다.", variant: "destructive" });
      return;
    }

    setPagesData(prev => {
      const newPages = [...prev.pages];
      newPages.splice(leftPageIndex, 2);
      return { pages: newPages };
    });

    if (currentSpreadIndex > 0) {
      setCurrentSpreadIndex(currentSpreadIndex - 1);
    }
    
    toast({ title: "스프레드 삭제", description: "스프레드가 삭제되었습니다." });
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
        setUploadedImages(prev => [
          { id: `upload-${Date.now()}`, url: data.data.url, name: file.name },
          ...prev
        ]);
        toast({ title: "업로드 완료", description: "이미지가 추가되었습니다. 클릭하여 캔버스에 넣으세요." });
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

  const addGalleryImageToUploaded = (image: GalleryImage) => {
    const url = image.transformedUrl || image.url;
    const exists = uploadedImages.some(img => img.url === url);
    if (!exists) {
      setUploadedImages(prev => [
        { id: `gallery-${image.id}`, url, name: image.title },
        ...prev
      ]);
      toast({ title: "추가 완료", description: "이미지가 추가되었습니다. 클릭하여 캔버스에 넣으세요." });
    } else {
      toast({ title: "이미 추가됨", description: "이 이미지는 이미 목록에 있습니다." });
    }
    setShowGalleryPicker(false);
  };

  const removeUploadedImage = (id: string) => {
    setUploadedImages(prev => prev.filter(img => img.id !== id));
  };

  const loadProject = (project: Project) => {
    suppressDirtyFlag.current = true;
    setProjectId(project.id);
    setProjectTitle(project.title);
    let loadedPages = project.pagesData?.pages || [
      { id: "page-1", objects: [], backgroundColor: "#ffffff" },
      { id: "page-2", objects: [], backgroundColor: "#ffffff" },
    ];
    if (loadedPages.length % 2 !== 0) {
      loadedPages.push({ id: `page-${Date.now()}`, objects: [], backgroundColor: "#ffffff" });
    }
    setPagesData({ pages: loadedPages });
    setCurrentSpreadIndex(0);
    setShowProjectsDialog(false);
    hasUnsavedChanges.current = false;
    setTimeout(() => renderSpread(), 100);
    toast({ title: "프로젝트 로드", description: `"${project.title}" 프로젝트를 불러왔습니다.` });
  };

  const createEmptyProject = () => {
    setProjectId(null);
    setProjectTitle("새 포토북");
    setPagesData({ 
      pages: [
        { id: "page-1", objects: [], backgroundColor: "#ffffff" },
        { id: "page-2", objects: [], backgroundColor: "#ffffff" },
      ] 
    });
    setCurrentSpreadIndex(0);
    setShowNewProjectDialog(false);
    setTimeout(() => renderSpread(), 100);
    toast({ title: "새 프로젝트", description: "빈 포토북이 생성되었습니다." });
  };

  const handleTemplateClick = (template: Template) => {
    setSelectedTemplate(template);
    setShowTemplatePreview(true);
  };

  const applyTemplate = (template: Template) => {
    if (template.pagesData) {
      let templatePages = template.pagesData.pages || [];
      if (templatePages.length % 2 !== 0) {
        templatePages.push({ id: `page-${Date.now()}`, objects: [], backgroundColor: "#ffffff" });
      }
      setPagesData({ pages: templatePages });
      setCurrentSpreadIndex(0);
      setShowTemplatePreview(false);
      setShowNewProjectDialog(false);
      setSelectedTemplate(null);
      setTimeout(() => renderSpread(), 100);
      toast({ title: "템플릿 적용", description: `"${template.name}" 템플릿이 적용되었습니다.` });
    }
  };

  const exportCanvas = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const guides = canvas.getObjects().filter(obj => (obj as any).customData?.type === "guide");
    guides.forEach(obj => canvas.remove(obj));
    canvas.renderAll();

    const dataUrl = canvas.toDataURL({ format: "png", quality: 1, multiplier: 1 });
    
    if (showGuides) {
      renderGuides(canvas);
      canvas.renderAll();
    }

    const link = document.createElement("a");
    link.download = `${projectTitle || "photobook"}-spread-${currentSpreadIndex + 1}.png`;
    link.href = dataUrl;
    link.click();
  };

  const handleAlbumSizeChange = (sizeId: string) => {
    const newSize = ALBUM_SIZES.find(s => s.id === sizeId);
    if (newSize) {
      setSelectedAlbumSize(newSize);
      setTimeout(() => {
        if (fabricCanvasRef.current) {
          fabricCanvasRef.current.setDimensions({
            width: newSize.widthPx * 2,
            height: newSize.heightPx,
          });
          renderSpread();
        }
      }, 0);
    }
  };

  const totalSpreads = Math.ceil(pagesData.pages.length / 2);

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-background">
      <div className="flex items-center justify-between p-2 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="min-w-[180px] justify-between">
                <span>{selectedAlbumSize.label}</span>
                <ChevronDown className="w-4 h-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ALBUM_SIZES.map(size => (
                <DropdownMenuItem 
                  key={size.id} 
                  onClick={() => handleAlbumSizeChange(size.id)}
                  className={selectedAlbumSize.id === size.id ? "bg-accent" : ""}
                >
                  {size.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Input
            value={projectTitle}
            onChange={(e) => setProjectTitle(e.target.value)}
            className="w-40 md:w-56"
            placeholder="프로젝트 제목"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={addSpread}>
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">스프레드 추가</span>
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={deleteSpread}
            disabled={pagesData.pages.length <= 2}
          >
            <Trash2 className="w-4 h-4 mr-1 text-destructive" />
            <span className="hidden sm:inline">스프레드 삭제</span>
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowProjectsDialog(true)}>
            <FolderOpen className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">불러오기</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowNewProjectDialog(true)}>
            <FileText className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">새로 만들기</span>
          </Button>
          <Button size="sm" onClick={() => saveProjectMutation.mutate()} disabled={saveProjectMutation.isPending || isAutoSaving}>
            <Save className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">{saveProjectMutation.isPending ? "저장 중..." : "저장"}</span>
          </Button>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setShowSaveTemplateDialog(true)}>
              <BookTemplate className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">템플릿 저장</span>
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-56 md:w-64 border-r border-border bg-card flex flex-col">
          <Tabs defaultValue="photos" className="flex-1 flex flex-col">
            <TabsList className="w-full grid grid-cols-3 h-auto p-1">
              <TabsTrigger value="photos" className="text-xs py-1.5">
                <ImageIcon className="w-3 h-3 mr-1" />
                사진
              </TabsTrigger>
              <TabsTrigger value="layouts" className="text-xs py-1.5">
                <Layout className="w-3 h-3 mr-1" />
                레이아웃
              </TabsTrigger>
              <TabsTrigger value="text" className="text-xs py-1.5">
                <Type className="w-3 h-3 mr-1" />
                텍스트
              </TabsTrigger>
            </TabsList>

            <TabsContent value="photos" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-3">
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          className="w-full h-16 border-dashed"
                          disabled={isUploadingImage}
                        >
                          {isUploadingImage ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              업로드 중...
                            </>
                          ) : (
                            <div className="flex flex-col items-center">
                              <Upload className="w-5 h-5 mb-1" />
                              <span className="text-xs">사진 추가</span>
                              <span className="text-[10px] text-muted-foreground">디바이스 또는 갤러리</span>
                            </div>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="center" className="w-48">
                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                          <Upload className="w-4 h-4 mr-2" />
                          디바이스에서 업로드
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowGalleryPicker(true)}>
                          <ImageIcon className="w-4 h-4 mr-2" />
                          갤러리에서 선택
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-2 block flex items-center justify-between">
                      <span>내 사진 ({uploadedImages.length})</span>
                      {uploadedImages.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">클릭하여 캔버스에 추가</span>
                      )}
                    </label>
                    {uploadedImages.length > 0 ? (
                      <div className="grid grid-cols-2 gap-1">
                        {uploadedImages.map((image) => (
                          <div
                            key={image.id}
                            className="aspect-square rounded border border-border hover:border-primary overflow-hidden bg-muted relative group"
                          >
                            <button
                              className="w-full h-full"
                              onClick={() => addImageToCanvas(image.url)}
                              title={image.name}
                            >
                              <img
                                src={image.url}
                                alt={image.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Plus className="w-6 h-6 text-white" />
                              </div>
                            </button>
                            <button
                              className="absolute top-0.5 right-0.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeUploadedImage(image.id);
                              }}
                              title="삭제"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-4 border border-dashed border-border rounded">
                        사진 추가 버튼을 눌러<br />이미지를 추가하세요
                      </p>
                    )}
                  </div>

                  {icons.length > 0 && (
                    <div className="border-t border-border pt-3">
                      <label className="text-xs font-medium mb-1 block">아이콘/스티커</label>
                      <div className="grid grid-cols-4 gap-1">
                        {icons.slice(0, 12).map((icon) => (
                          <button
                            key={icon.id}
                            className="aspect-square rounded border border-border hover:border-primary p-1 bg-background"
                            onClick={() => addIconToCanvas(icon)}
                          >
                            <img
                              src={icon.thumbnailUrl || icon.imageUrl}
                              alt={icon.name}
                              className="w-full h-full object-contain"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="layouts" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-2 space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-2 block">배경색 (왼쪽 페이지)</label>
                    <div className="flex gap-1 flex-wrap">
                      {["#ffffff", "#f3f4f6", "#fef3c7", "#fce7f3", "#dbeafe", "#d1fae5"].map(color => (
                        <button
                          key={color}
                          className="w-7 h-7 rounded border border-border hover:ring-2 ring-primary"
                          style={{ backgroundColor: color }}
                          onClick={() => setPageBackgroundColor(color, leftPageIndex)}
                        />
                      ))}
                      <Input
                        type="color"
                        value={leftPage?.backgroundColor || "#ffffff"}
                        onChange={(e) => setPageBackgroundColor(e.target.value, leftPageIndex)}
                        className="w-7 h-7 p-0.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-2 block">배경색 (오른쪽 페이지)</label>
                    <div className="flex gap-1 flex-wrap">
                      {["#ffffff", "#f3f4f6", "#fef3c7", "#fce7f3", "#dbeafe", "#d1fae5"].map(color => (
                        <button
                          key={color}
                          className="w-7 h-7 rounded border border-border hover:ring-2 ring-primary"
                          style={{ backgroundColor: color }}
                          onClick={() => setPageBackgroundColor(color, rightPageIndex)}
                        />
                      ))}
                      <Input
                        type="color"
                        value={rightPage?.backgroundColor || "#ffffff"}
                        onChange={(e) => setPageBackgroundColor(e.target.value, rightPageIndex)}
                        className="w-7 h-7 p-0.5"
                      />
                    </div>
                  </div>

                  {backgrounds.length > 0 && (
                    <div className="border-t border-border pt-3">
                      <label className="text-xs font-medium mb-1 block">배경 이미지</label>
                      <div className="grid grid-cols-2 gap-1">
                        {backgrounds.map((bg) => (
                          <button
                            key={bg.id}
                            className="aspect-[4/3] rounded border border-border hover:border-primary overflow-hidden"
                            onClick={() => setPageBackgroundImage(bg, leftPageIndex)}
                          >
                            <img
                              src={bg.thumbnailUrl || bg.imageUrl}
                              alt={bg.name}
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t border-border pt-3">
                    <label className="text-xs font-medium mb-2 block">템플릿</label>
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
                    <div className="grid grid-cols-2 gap-1">
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
                            <Eye className="w-4 h-4 text-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                    {templates.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center">등록된 템플릿이 없습니다.</p>
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
                        min={12}
                        max={200}
                        className="w-20 text-xs"
                      />
                      <Input
                        type="color"
                        value={newTextColor}
                        onChange={(e) => setNewTextColor(e.target.value)}
                        className="w-12 p-1 h-9"
                      />
                    </div>
                    <Button size="sm" className="w-full" onClick={addTextToCanvas} disabled={!newText.trim()}>
                      <Plus className="w-4 h-4 mr-1" />
                      텍스트 추가
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex-1 flex flex-col bg-slate-200 overflow-hidden" ref={canvasContainerRef}>
          <div className="flex items-center justify-center gap-2 p-2 bg-white/80 border-b">
            <Button variant="outline" size="sm" onClick={() => setScale(s => Math.max(0.05, s - 0.05))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm w-16 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="outline" size="sm" onClick={() => setScale(s => Math.min(1, s + 0.05))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-2" />
            <Button 
              variant={showGuides ? "default" : "outline"} 
              size="sm"
              onClick={() => {
                setShowGuides(!showGuides);
                setTimeout(() => renderSpread(), 0);
              }}
            >
              <Eye className="w-4 h-4 mr-1" />
              가이드
            </Button>
            <Button variant="outline" size="sm" onClick={exportCanvas}>
              <Download className="w-4 h-4 mr-1" />
              내보내기
            </Button>
            <div className="h-4 w-px bg-border mx-2" />
            <Button variant="outline" size="sm" onClick={deleteSelectedObject}>
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={duplicateSelectedObject}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={rotateSelectedObject}>
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={bringToFront} title="앞으로">
              <ArrowUp className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={sendToBack} title="뒤로">
              <ArrowDown className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-auto p-4">
            <div 
              className="shadow-2xl" 
              style={{ 
                transform: `scale(${scale})`,
                transformOrigin: "center center",
              }}
            >
              <canvas ref={canvasElRef} />
            </div>
          </div>
        </div>
      </div>

      <div className="h-24 border-t border-border bg-card flex items-center px-4">
        <div className="flex-1 flex items-center gap-2">
          <span className="text-sm font-medium mr-2">PAGES</span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              syncCanvasToState(currentSpreadIndex);
              setCurrentSpreadIndex(Math.max(0, currentSpreadIndex - 1));
            }}
            disabled={currentSpreadIndex === 0}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          
          <ScrollArea className="flex-1">
            <div className="flex gap-2 py-1">
              {Array.from({ length: totalSpreads }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    syncCanvasToState(currentSpreadIndex);
                    setCurrentSpreadIndex(index);
                  }}
                  className={`flex-shrink-0 w-28 h-16 rounded border-2 transition-colors overflow-hidden ${
                    index === currentSpreadIndex 
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="w-full h-full flex">
                    <div 
                      className="w-1/2 h-full border-r border-dashed border-gray-300"
                      style={{ 
                        backgroundColor: pagesData.pages[index * 2]?.backgroundColor || "#ffffff" 
                      }}
                    >
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                        {index * 2 + 1}
                      </div>
                    </div>
                    <div 
                      className="w-1/2 h-full"
                      style={{ 
                        backgroundColor: pagesData.pages[index * 2 + 1]?.backgroundColor || "#ffffff" 
                      }}
                    >
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                        {index * 2 + 2}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={addSpread}
                className="flex-shrink-0 w-16 h-16 rounded border-2 border-dashed border-border hover:border-primary flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </ScrollArea>

          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => {
              syncCanvasToState(currentSpreadIndex);
              setCurrentSpreadIndex(Math.min(totalSpreads - 1, currentSpreadIndex + 1));
            }}
            disabled={currentSpreadIndex >= totalSpreads - 1}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <span className="text-xs text-muted-foreground ml-2">
            {pagesData.pages.length} PAGES TOTAL
          </span>
        </div>

        {(lastSaved || isAutoSaving) && (
          <div className="text-xs text-muted-foreground">
            {isAutoSaving ? (
              <span className="flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                자동 저장 중...
              </span>
            ) : lastSaved ? (
              `마지막 저장: ${lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
            ) : null}
          </div>
        )}
      </div>

      <Dialog open={showProjectsDialog} onOpenChange={setShowProjectsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>프로젝트 불러오기</DialogTitle>
            <DialogDescription>저장된 포토북 프로젝트를 선택하세요.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {projectsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : projects.length > 0 ? (
                projects.map((project) => (
                  <button
                    key={project.id}
                    className="w-full p-3 rounded-lg border border-border hover:border-primary text-left transition-colors"
                    onClick={() => loadProject(project)}
                  >
                    <div className="font-medium">{project.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(project.updatedAt).toLocaleDateString('ko-KR')} · {project.pageCount || 2}페이지
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">저장된 프로젝트가 없습니다.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewProjectDialog} onOpenChange={setShowNewProjectDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>새 포토북 만들기</DialogTitle>
            <DialogDescription>빈 프로젝트로 시작하거나 템플릿을 선택하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button className="w-full h-16" variant="outline" onClick={createEmptyProject}>
              <FileText className="w-5 h-5 mr-2" />
              빈 프로젝트로 시작
            </Button>
            {templates.length > 0 && (
              <div>
                <label className="text-sm font-medium">또는 템플릿 선택</label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {templates.slice(0, 6).map((template) => (
                    <button
                      key={template.id}
                      className="aspect-[4/3] rounded border border-border hover:border-primary overflow-hidden"
                      onClick={() => applyTemplate(template)}
                    >
                      {template.thumbnailUrl ? (
                        <img src={template.thumbnailUrl} alt={template.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-muted">
                          {template.name}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showTemplatePreview} onOpenChange={setShowTemplatePreview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTemplate?.name}</DialogTitle>
            <DialogDescription>이 템플릿을 현재 프로젝트에 적용하시겠습니까?</DialogDescription>
          </DialogHeader>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
            {selectedTemplate?.thumbnailUrl ? (
              <img src={selectedTemplate.thumbnailUrl} alt={selectedTemplate.name} className="max-w-full max-h-full object-contain" />
            ) : (
              <span className="text-muted-foreground">미리보기 없음</span>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplatePreview(false)}>취소</Button>
            <Button onClick={() => selectedTemplate && applyTemplate(selectedTemplate)}>적용</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>템플릿으로 저장</DialogTitle>
            <DialogDescription>현재 작업을 템플릿으로 저장합니다.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">템플릿 이름</label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="템플릿 이름 입력"
              />
            </div>
            <div>
              <label className="text-sm font-medium">카테고리</label>
              <Select value={newTemplateCategory} onValueChange={setNewTemplateCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.filter(c => c.value !== "all").map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveTemplateDialog(false)}>취소</Button>
            <Button 
              onClick={() => saveTemplateMutation.mutate({ name: newTemplateName, category: newTemplateCategory })}
              disabled={!newTemplateName.trim() || saveTemplateMutation.isPending}
            >
              {saveTemplateMutation.isPending ? "저장 중..." : "저장"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVersionHistoryDialog} onOpenChange={setShowVersionHistoryDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>버전 이력</DialogTitle>
            <DialogDescription>이전 버전으로 복원할 수 있습니다.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-96">
            <div className="space-y-2">
              {versionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : versions.length > 0 ? (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border"
                  >
                    <div>
                      <div className="font-medium">버전 {version.versionNumber}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(version.createdAt).toLocaleString('ko-KR')}
                        {version.isAutoSave && " · 자동 저장"}
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => restoreVersionMutation.mutate(version.id)}
                      disabled={restoreVersionMutation.isPending}
                    >
                      <History className="w-4 h-4 mr-1" />
                      복원
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-4">버전 이력이 없습니다.</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={showGalleryPicker} onOpenChange={setShowGalleryPicker}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>갤러리에서 사진 선택</DialogTitle>
            <DialogDescription>포토북에 추가할 사진을 선택하세요.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={galleryCategory} onValueChange={setGalleryCategory}>
              <SelectTrigger className="w-full">
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
            <ScrollArea className="h-[400px]">
              {galleryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : galleryImages.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {galleryImages.map((image) => (
                    <button
                      key={image.id}
                      className="aspect-square rounded border border-border hover:border-primary overflow-hidden bg-muted relative group"
                      onClick={() => addGalleryImageToUploaded(image)}
                      title={image.title}
                    >
                      <img
                        src={image.thumbnailUrl || image.url}
                        alt={image.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Plus className="w-6 h-6 text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  갤러리에 이미지가 없습니다.
                </p>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
