import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { sanitizeHtml } from "@/lib/utils";
import { useModal } from "@/hooks/useModal";
import { formatDateTime, formatDateForInput, formatSimpleDate, getPeriodStatus } from "@/lib/dateUtils";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  useDndContext,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/hooks/use-toast";
import { 
  Plus, Edit, Trash2, Eye, EyeOff, GripVertical, 
  CheckCircle, XCircle, Clock, Loader2, AlertCircle, Settings,
  Globe, Building2, Calendar, ChevronUp, ChevronDown, Image, FileText, Heart,
  Download, Printer, X as CloseIcon, ImagePlus, Upload, Check, FolderTree, Users,
  Palette, CheckSquare, Lock, Code, FolderPlus, Folder, FolderOpen, ChevronRight, FolderInput
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ThemeMission, MissionCategory } from "@shared/schema";

// MissionFolder 인터페이스
interface MissionFolder {
  id: number;
  name: string;
  color: string;
  order: number;
  isCollapsed: boolean;
}

// SortableMissionRow 컴포넌트 (드래그 가능한 미션 행)
interface SortableMissionRowProps {
  mission: any;
  depth: number;
  categories: MissionCategory[];
  hospitals: any[];
  folders: MissionFolder[];
  getMissionStatusBadge: (mission: ThemeMission) => JSX.Element;
  toggleActiveMutation: any;
  setSubMissionBuilder: (data: { themeMissionId: number; missionId: string; title: string } | null) => void;
  setChildMissionManager: (data: { parentId: number; title: string } | null) => void;
  handleOpenDialog: (mission?: ThemeMission) => void;
  deleteMissionMutation: any;
  onMoveToFolder: (missionId: number, folderId: number | null) => void;
}

function SortableMissionRow({
  mission,
  depth,
  categories,
  hospitals,
  folders,
  getMissionStatusBadge,
  toggleActiveMutation,
  setSubMissionBuilder,
  setChildMissionManager,
  handleOpenDialog,
  deleteMissionMutation,
  onMoveToFolder,
}: SortableMissionRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `mission-${mission.id}`, disabled: depth > 0 });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const category = categories.find(c => c.categoryId === mission.categoryId);
  const hospital = hospitals.find(h => h.id === mission.hospitalId);
  const childCount = mission.childMissions?.length || mission.childMissionCount || 0;
  const subCount = mission.subMissions?.length || mission.subMissionCount || 0;

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      className={`${depth > 0 ? "bg-muted/30" : ""} ${isDragging ? "z-50" : ""}`}
    >
      <TableCell className="w-10">
        {depth === 0 && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </TableCell>
      <TableCell>{getMissionStatusBadge(mission)}</TableCell>
      <TableCell className="font-medium">
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 24}px` }}>
          {depth > 0 && (
            <span className="text-muted-foreground mr-1">└</span>
          )}
          {mission.title}
          {depth > 0 && (
            <Badge variant="outline" className="ml-2 text-xs">
              {depth + 1}차
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell>
        {category ? (
          <Badge variant="outline">
            {category.emoji} {category.name}
          </Badge>
        ) : (
          <span className="text-gray-400">미분류</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <span className="text-sm font-medium text-gray-700">{subCount}개</span>
      </TableCell>
      <TableCell className="text-center">
        <span className="text-sm font-medium text-gray-700">{childCount}개</span>
      </TableCell>
      <TableCell>
        {mission.visibilityType === "public" ? (
          <Badge variant="secondary">
            <Globe className="h-3 w-3 mr-1" />
            전체 공개
          </Badge>
        ) : mission.visibilityType === "dev" ? (
          <Badge variant="destructive">
            <Code className="h-3 w-3 mr-1" />
            개발전용
          </Badge>
        ) : (
          <Badge variant="default">
            <Building2 className="h-3 w-3 mr-1" />
            {hospital?.name || "병원 전용"}
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-sm">
        {mission.startDate && mission.endDate ? (
          <div className="flex items-center gap-1 text-gray-600">
            <Calendar className="h-3 w-3" />
            {formatSimpleDate(mission.startDate)} ~ {formatSimpleDate(mission.endDate)}
          </div>
        ) : (
          <span className="text-gray-400">기간 없음</span>
        )}
      </TableCell>
      <TableCell>
        <Switch
          checked={mission.isActive}
          onCheckedChange={(checked) => {
            toggleActiveMutation.mutate({ id: mission.id, isActive: checked });
          }}
        />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          {depth === 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  title="폴더 이동"
                >
                  <FolderInput className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onMoveToFolder(mission.id, null)}
                  className="flex items-center gap-2"
                >
                  <Folder className="h-4 w-4 text-gray-400" />
                  <span>미분류</span>
                  {mission.folderId === null && (
                    <Check className="h-4 w-4 ml-auto text-primary" />
                  )}
                </DropdownMenuItem>
                {folders.map((folder) => (
                  <DropdownMenuItem
                    key={folder.id}
                    onClick={() => onMoveToFolder(mission.id, folder.id)}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: folder.color }}
                    />
                    <span>{folder.name}</span>
                    {mission.folderId === folder.id && (
                      <Check className="h-4 w-4 ml-auto text-primary" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSubMissionBuilder({ themeMissionId: mission.id, missionId: mission.missionId, title: mission.title })}
            title="세부미션 관리"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChildMissionManager({ parentId: mission.id, title: mission.title })}
            title="하부미션 관리"
          >
            <FolderTree className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenDialog(mission)}
            title="수정"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm('정말 삭제하시겠습니까? 모든 세부 미션 및 하부 미션도 함께 삭제됩니다.')) {
                deleteMissionMutation.mutate(mission.id);
              }
            }}
            title="삭제"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// SortableFolderSection 컴포넌트 (드래그 가능한 폴더 섹션)
interface SortableFolderSectionProps {
  folder: MissionFolder | null;
  missions: any[];
  categories: MissionCategory[];
  hospitals: any[];
  folders: MissionFolder[];
  getMissionStatusBadge: (mission: ThemeMission) => JSX.Element;
  toggleActiveMutation: any;
  setSubMissionBuilder: (data: { themeMissionId: number; missionId: string; title: string } | null) => void;
  setChildMissionManager: (data: { parentId: number; title: string } | null) => void;
  handleOpenDialog: (mission?: ThemeMission) => void;
  deleteMissionMutation: any;
  onToggleCollapse: (folderId: number) => void;
  onEditFolder: (folder: MissionFolder) => void;
  onDeleteFolder: (folderId: number) => void;
  flattenMissionsWithDepth: (missionList: any[], depth?: number) => Array<{ mission: any; depth: number }>;
  onMoveToFolder: (missionId: number, folderId: number | null) => void;
}

function SortableFolderSection({
  folder,
  missions,
  categories,
  hospitals,
  folders,
  getMissionStatusBadge,
  toggleActiveMutation,
  setSubMissionBuilder,
  setChildMissionManager,
  handleOpenDialog,
  deleteMissionMutation,
  onToggleCollapse,
  onEditFolder,
  onDeleteFolder,
  flattenMissionsWithDepth,
  onMoveToFolder,
}: SortableFolderSectionProps) {
  const isUncategorized = folder === null;
  const folderId = folder?.id || 0;
  const isCollapsed = folder?.isCollapsed || false;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `folder-${folderId}`, disabled: isUncategorized });

  // useDndContext를 사용해 드래그 상태 감지
  const { active, over } = useDndContext();
  
  // 현재 드래그 중인 아이템이 미션이고 이 폴더 헤더 위에 있는지 확인
  const isDropTarget = active?.id?.toString().startsWith('mission-') && over?.id === `folder-${folderId}`;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const flattenedMissions = useMemo(() => {
    const result: Array<{ mission: any; depth: number }> = [];
    for (const m of missions) {
      result.push(...flattenMissionsWithDepth([m], 0));
    }
    return result;
  }, [missions, flattenMissionsWithDepth]);

  const missionIds = flattenedMissions.map(({ mission }) => `mission-${mission.id}`);

  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <div
        className={`flex items-center gap-2 py-2 px-3 rounded-t-lg ${
          isUncategorized ? "bg-gray-100" : "bg-muted"
        } ${isDragging ? "z-50" : ""} ${
          isDropTarget ? "ring-2 ring-blue-400 bg-blue-50/50" : ""
        }`}
      >
        {!isUncategorized && (
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted-foreground/10 rounded touch-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        {!isUncategorized && folder && (
          <div
            className="w-1 h-5 rounded-full"
            style={{ backgroundColor: folder.color }}
          />
        )}
        <button
          onClick={() => !isUncategorized && folder && onToggleCollapse(folder.id)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          {isCollapsed ? (
            <Folder className="h-4 w-4 text-muted-foreground" />
          ) : (
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium">
            {isUncategorized ? "미분류" : folder?.name}
          </span>
          <Badge variant="secondary" className="ml-2">
            {missions.length}
          </Badge>
          {!isUncategorized && (
            <ChevronRight
              className={`h-4 w-4 text-muted-foreground transition-transform ${
                isCollapsed ? "" : "rotate-90"
              }`}
            />
          )}
        </button>
        {!isUncategorized && folder && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEditFolder(folder)}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (confirm('폴더를 삭제하시겠습니까? 폴더 내 미션은 미분류로 이동됩니다.')) {
                  onDeleteFolder(folder.id);
                }
              }}
            >
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        )}
      </div>

      {!isCollapsed && (
        <div className="border border-t-0 rounded-b-lg overflow-hidden">
          <SortableContext items={missionIds} strategy={verticalListSortingStrategy}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead className="w-24">상태</TableHead>
                  <TableHead>제목</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead className="w-20 text-center">세부</TableHead>
                  <TableHead className="w-20 text-center">하부</TableHead>
                  <TableHead>공개 범위</TableHead>
                  <TableHead>기간</TableHead>
                  <TableHead className="w-16">활성화</TableHead>
                  <TableHead className="text-right w-52">작업</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flattenedMissions.map(({ mission, depth }) => (
                  <SortableMissionRow
                    key={mission.id}
                    mission={mission}
                    depth={depth}
                    categories={categories}
                    hospitals={hospitals}
                    folders={folders}
                    getMissionStatusBadge={getMissionStatusBadge}
                    toggleActiveMutation={toggleActiveMutation}
                    setSubMissionBuilder={setSubMissionBuilder}
                    setChildMissionManager={setChildMissionManager}
                    handleOpenDialog={handleOpenDialog}
                    deleteMissionMutation={deleteMissionMutation}
                    onMoveToFolder={onMoveToFolder}
                  />
                ))}
                {flattenedMissions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      이 폴더에 미션이 없습니다
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </SortableContext>
        </div>
      )}
    </div>
  );
}

// 간단한 리치 텍스트 에디터 컴포넌트
interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const internalValueRef = useRef<string>('');
  const isInitializedRef = useRef(false);
  const [lastCustomColor, setLastCustomColor] = useState<string | null>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  
  // value prop이 변경될 때마다 동기화
  useEffect(() => {
    if (editorRef.current) {
      const newValue = value || '';
      
      // 초기화 시 또는 외부에서 value가 변경된 경우 업데이트
      if (!isInitializedRef.current || newValue !== internalValueRef.current) {
        editorRef.current.innerHTML = newValue;
        internalValueRef.current = newValue;
        isInitializedRef.current = true;
      }
    }
  }, [value]);
  
  const applyFormat = (command: string, cmdValue?: string) => {
    // styleWithCSS를 활성화하여 span style로 색상 적용
    if (command === 'foreColor') {
      document.execCommand('styleWithCSS', false, 'true');
    }
    document.execCommand(command, false, cmdValue);
    editorRef.current?.focus();
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      internalValueRef.current = html;
      onChange(html);
    }
  };
  
  const handleCustomColorChange = (color: string) => {
    setLastCustomColor(color);
    applyFormat('foreColor', color);
  };
  
  const handleInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      internalValueRef.current = html;
      onChange(html);
    }
  };
  
  return (
    <div className="border rounded-md">
      <div className="flex items-center gap-1 p-2 border-b bg-muted/30 flex-wrap">
        <button
          type="button"
          className="h-8 px-2 rounded hover:bg-accent"
          onClick={() => applyFormat('bold')}
          title="굵게"
        >
          <span className="font-bold">B</span>
        </button>
        <div className="w-px h-6 bg-border mx-1" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-1">색상:</span>
          {['#ffffff', '#000000', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6'].map((color) => (
            <button
              key={color}
              type="button"
              className={`w-6 h-6 rounded border hover:scale-110 transition-transform ${color === '#ffffff' ? 'border-gray-400 bg-white' : 'border-gray-300'}`}
              style={{ backgroundColor: color }}
              onClick={() => applyFormat('foreColor', color)}
              title={color === '#ffffff' ? '흰색 (기본)' : `색상: ${color}`}
            />
          ))}
          <div className="w-px h-5 bg-border mx-1" />
          {lastCustomColor && (
            <button
              type="button"
              className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
              style={{ backgroundColor: lastCustomColor }}
              onClick={() => applyFormat('foreColor', lastCustomColor)}
              title={`직전 선택 색상: ${lastCustomColor}`}
            />
          )}
          <label className="relative cursor-pointer" title="직접 색상 선택">
            <input
              ref={colorInputRef}
              type="color"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              value={lastCustomColor || '#000000'}
              onChange={(e) => handleCustomColorChange(e.target.value)}
            />
            <div className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform flex items-center justify-center bg-gradient-to-br from-red-400 via-green-400 to-blue-400">
              <span className="text-[10px] text-white font-bold drop-shadow">+</span>
            </div>
          </label>
        </div>
      </div>
      <div
        ref={editorRef}
        contentEditable
        className="min-h-[80px] p-3 text-sm focus:outline-none whitespace-pre-wrap [&:empty]:before:content-[attr(data-placeholder)] [&:empty]:before:text-muted-foreground"
        onInput={handleInput}
        onBlur={handleInput}
        data-placeholder={placeholder}
      />
    </div>
  );
}

// 액션 타입 관리
function ActionTypeManagement() {
  const queryClient = useQueryClient();
  const modal = useModal();
  const [editingActionType, setEditingActionType] = useState<any>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // 액션 타입 목록 조회
  const { data: actionTypes = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/action-types'],
  });

  // 액션 타입 생성/수정 mutation
  const saveActionTypeMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingActionType) {
        return apiRequest(`/api/action-types/${editingActionType.id}`, {
          method: 'PATCH',
          body: JSON.stringify(data)
        });
      }
      return apiRequest('/api/action-types', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/action-types'] });
      toast({ title: "액션 타입이 저장되었습니다" });
      modal.close();
      setEditingActionType(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 액션 타입 삭제 mutation
  const deleteActionTypeMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/action-types/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/action-types'] });
      toast({ title: "액션 타입이 삭제되었습니다" });
      modal.close();
      setPendingDeleteId(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
      modal.close();
      setPendingDeleteId(null);
    },
  });

  const formSchema = z.object({
    name: z.string().min(1, "이름을 입력하세요"),
    isActive: z.boolean().default(true),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      isActive: true,
    },
  });

  const handleOpenDialog = (actionType?: any) => {
    const currentEditingType = actionType || null;
    setEditingActionType(currentEditingType);
    modal.open('actionType', {
      editingActionType: currentEditingType,
      onSave: async (data: { name: string; isActive: boolean }) => {
        saveActionTypeMutation.mutate(data);
      },
      isPending: saveActionTypeMutation.isPending,
    });
  };

  const handleDeleteClick = (id: number) => {
    setPendingDeleteId(id);
    modal.open('deleteConfirm', {
      title: '액션 타입 삭제',
      description: '정말로 이 액션 타입을 삭제하시겠습니까? 사용 중인 액션 타입은 삭제할 수 없습니다.',
      onConfirm: async () => {
        deleteActionTypeMutation.mutate(id);
      },
      isPending: deleteActionTypeMutation.isPending,
    });
  };

  const onSubmit = (data: any) => {
    saveActionTypeMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>액션 타입 관리</CardTitle>
            <CardDescription>세부 미션에 사용할 액션 타입을 관리합니다 (신청, 제출, 출석, 리뷰 등)</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            액션 타입 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>순서</TableHead>
              <TableHead>시스템 여부</TableHead>
              <TableHead>활성 여부</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actionTypes.map((actionType) => (
              <TableRow key={actionType.id}>
                <TableCell className="font-mono text-sm">{actionType.id}</TableCell>
                <TableCell className="font-medium">{actionType.name}</TableCell>
                <TableCell>{actionType.order}</TableCell>
                <TableCell>
                  {actionType.isSystem ? (
                    <Badge variant="secondary">시스템</Badge>
                  ) : (
                    <Badge variant="outline">사용자</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {actionType.isActive ? (
                    <Badge className="bg-green-500 text-white">활성</Badge>
                  ) : (
                    <Badge variant="secondary">비활성</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(actionType)}
                      disabled={actionType.isSystem}
                      title={actionType.isSystem ? "시스템 타입은 수정할 수 없습니다" : "수정"}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(actionType.id)}
                      disabled={actionType.isSystem}
                      title={actionType.isSystem ? "시스템 타입은 삭제할 수 없습니다" : "삭제"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

      </CardContent>
    </Card>
  );
}

// 미션 카테고리 관리
function MissionCategoryManagement() {
  const queryClient = useQueryClient();
  const modal = useModal();
  const [editingCategory, setEditingCategory] = useState<any>(null);

  // 카테고리 목록 조회
  const { data: categories = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/mission-categories'],
  });

  // 카테고리 생성/수정 mutation
  const saveCategoryMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingCategory) {
        return apiRequest(`/api/admin/mission-categories/${editingCategory.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }
      return apiRequest('/api/admin/mission-categories', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mission-categories'] });
      toast({ title: "카테고리가 저장되었습니다" });
      modal.close();
      setEditingCategory(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 카테고리 삭제 mutation
  const deleteCategoryMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/admin/mission-categories/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mission-categories'] });
      toast({ title: "카테고리가 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const formSchema = z.object({
    categoryId: z.string().min(1, "ID를 입력하세요"),
    name: z.string().min(1, "이름을 입력하세요"),
    description: z.string().optional(),
    emoji: z.string().optional(),
    order: z.number().int().min(0),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      categoryId: "",
      name: "",
      description: "",
      emoji: "📋",
      order: 0,
    },
  });

  const handleOpenDialog = (category?: any) => {
    const currentEditingCategory = category || null;
    setEditingCategory(currentEditingCategory);
    modal.open('category', {
      editingCategory: currentEditingCategory,
      onSave: async (data: any) => {
        saveCategoryMutation.mutate(data);
      },
      isPending: saveCategoryMutation.isPending,
      defaultOrder: categories.length,
    });
  };

  const handleDeleteClick = (id: number) => {
    modal.open('deleteConfirm', {
      title: '카테고리 삭제',
      description: '정말 삭제하시겠습니까?',
      onConfirm: async () => {
        deleteCategoryMutation.mutate(id);
        modal.close();
      },
      isPending: deleteCategoryMutation.isPending,
    });
  };

  const onSubmit = (data: any) => {
    saveCategoryMutation.mutate(data);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>미션 카테고리 관리</CardTitle>
            <CardDescription>미션을 분류할 카테고리를 관리합니다</CardDescription>
          </div>
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="h-4 w-4 mr-2" />
            카테고리 추가
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>이모지</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>이름</TableHead>
              <TableHead>설명</TableHead>
              <TableHead>순서</TableHead>
              <TableHead className="text-right">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="text-2xl">{category.emoji}</TableCell>
                <TableCell className="font-mono text-sm">{category.categoryId}</TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-sm text-gray-500">{category.description}</TableCell>
                <TableCell>{category.order}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDialog(category)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteClick(category.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

      </CardContent>
    </Card>
  );
}

// 세부 미션 빌더
interface SubMissionBuilderProps {
  themeMissionId: number;
  missionId: string; // UUID
  themeMissionTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

function SubMissionBuilder({ themeMissionId, missionId, themeMissionTitle, isOpen, onClose }: SubMissionBuilderProps) {
  const queryClient = useQueryClient();
  const modal = useModal();
  const [editingSubMission, setEditingSubMission] = useState<any>(null);

  const { data: subMissions = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/missions', missionId, 'sub-missions'],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/missions/${missionId}/sub-missions`);
      return await response.json();
    },
    enabled: isOpen && !!missionId,
  });

  const saveSubMissionMutation = useMutation({
    mutationFn: ({ data, subMissionId }: { data: any; subMissionId: number | null }) => {
      const url = subMissionId
        ? `/api/admin/missions/${missionId}/sub-missions/${subMissionId}`
        : `/api/admin/missions/${missionId}/sub-missions`;
      const method = subMissionId ? 'PUT' : 'POST';
      
      return apiRequest(url, { method, body: JSON.stringify(data) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
      toast({ title: "세부 미션이 저장되었습니다" });
      modal.close();
      setEditingSubMission(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const deleteSubMissionMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/admin/missions/${missionId}/sub-missions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
      toast({ title: "세부 미션이 삭제되었습니다" });
      modal.close();
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
      modal.close();
    },
  });

  const reorderMutation = useMutation({
    mutationFn: (newOrder: number[]) =>
      apiRequest(`/api/admin/missions/${missionId}/sub-missions/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ subMissionIds: newOrder })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest(`/api/admin/missions/${missionId}/sub-missions/${id}/toggle-active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
    },
  });

  const formSchema = z.object({
    title: z.string().min(1, "제목을 입력하세요"),
    description: z.string().optional(),
    submissionTypes: z.array(z.enum(["file", "image", "link", "text", "review", "studio_submit", "attendance"])).min(1, "최소 1개의 제출 타입이 필요합니다"),
    submissionLabels: z.record(z.string(), z.string()).optional(),
    requireReview: z.boolean().optional(),
    studioFileFormat: z.enum(["webp", "jpeg", "pdf"]).optional(),
    studioDpi: z.number().optional(),
    partyTemplateProjectId: z.number().nullable().optional(),
    partyMaxPages: z.number().nullable().optional(),
    actionTypeId: z.number().nullable().optional(),
    sequentialLevel: z.number().optional(),
    attendanceType: z.enum(["password", "qrcode"]).nullable().optional(),
    attendancePassword: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  });

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      submissionTypes: ["file"] as ("file" | "image" | "link" | "text" | "review" | "studio_submit" | "attendance")[],
      submissionLabels: {} as Record<string, string>,
      requireReview: false,
      studioFileFormat: "pdf" as "webp" | "jpeg" | "pdf",
      studioDpi: 300,
      partyTemplateProjectId: null as number | null,
      partyMaxPages: null as number | null,
      actionTypeId: null as number | null,
      sequentialLevel: 0,
      attendanceType: null as "password" | "qrcode" | null,
      attendancePassword: "",
      startDate: "",
      endDate: "",
    },
  });

  const { data: activeActionTypes = [] } = useQuery<any[]>({
    queryKey: ['/api/action-types/active'],
    enabled: isOpen,
  });

  const attendanceType = form.watch("attendanceType");

  const [partyTemplates, setPartyTemplates] = useState<any[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const loadPartyTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const response = await apiRequest('/api/products/templates/party');
      const data = await response.json();
      setPartyTemplates(data.data || []);
      return data.data || [];
    } catch (error) {
      console.error('Failed to load party templates:', error);
      toast({ title: "오류", description: "템플릿 목록을 불러올 수 없습니다", variant: "destructive" });
      return [];
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleOpenTemplateModal = async () => {
    const templates = await loadPartyTemplates();
    modal.open('templatePicker', {
      templates,
      isLoading: templatesLoading,
      onSelect: (template: any) => {
        form.setValue('externalProductCode', template.partyProductCode);
        form.setValue('externalProductName', template.productName);
        modal.close();
      }
    });
  };

  const handleSelectTemplate = (template: any) => {
    form.setValue('partyTemplateProjectId', template.id);
    modal.close();
  };

  const handleClearTemplate = () => {
    form.setValue('partyTemplateProjectId', null);
  };

  const selectedTemplateId = form.watch('partyTemplateProjectId');
  const selectedTemplate = partyTemplates.find(t => t.id === selectedTemplateId);

  const convertLegacyLabelsToIndexed = (
    labels: Record<string, string> | undefined, 
    types: string[]
  ): Record<string, string> => {
    if (!labels || Object.keys(labels).length === 0) return {};
    
    const hasNumericKeys = Object.keys(labels).some(key => !isNaN(parseInt(key)));
    if (hasNumericKeys) {
      const indexedLabels: Record<string, string> = {};
      Object.entries(labels).forEach(([key, value]) => {
        if (!isNaN(parseInt(key))) {
          indexedLabels[key] = value;
        }
      });
      return indexedLabels;
    }
    
    const indexedLabels: Record<string, string> = {};
    const typeCount: Record<string, number> = {};
    
    types.forEach((type, index) => {
      if (labels[type]) {
        if (typeCount[type] === undefined) {
          typeCount[type] = 0;
          indexedLabels[String(index)] = labels[type];
        }
        typeCount[type]++;
      }
    });
    
    return indexedLabels;
  };

  const handleOpenDialog = (subMission?: any) => {
    console.log('[Dialog 열기] subMission:', subMission ? `ID=${subMission.id}` : 'null (신규 생성 모드)');
    
    if (subMission) {
      setEditingSubMission(subMission);
      const types = subMission.submissionTypes || (subMission.submissionType ? [subMission.submissionType] : ["file"]);
      const indexedLabels = convertLegacyLabelsToIndexed(subMission.submissionLabels, types);
      form.reset({
        title: subMission.title,
        description: subMission.description || "",
        submissionTypes: types,
        submissionLabels: indexedLabels,
        requireReview: subMission.requireReview || false,
        studioFileFormat: subMission.studioFileFormat || "pdf",
        studioDpi: subMission.studioDpi || 300,
        partyTemplateProjectId: subMission.partyTemplateProjectId || null,
        partyMaxPages: subMission.partyMaxPages || null,
        actionTypeId: subMission.actionTypeId || null,
        sequentialLevel: subMission.sequentialLevel || 0,
        attendanceType: subMission.attendanceType || null,
        attendancePassword: subMission.attendancePassword || "",
        startDate: formatDateForInput(subMission.startDate) || "",
        endDate: formatDateForInput(subMission.endDate) || "",
      });
      if (subMission.partyTemplateProjectId && types.includes("studio_submit")) {
        loadPartyTemplates();
      }
    } else {
      setEditingSubMission(null);
      form.reset({
        title: "",
        description: "",
        submissionTypes: ["file"],
        submissionLabels: {},
        requireReview: false,
        studioFileFormat: "pdf",
        studioDpi: 300,
        partyTemplateProjectId: null,
        partyMaxPages: null,
        actionTypeId: null,
        sequentialLevel: 0,
        attendanceType: null,
        attendancePassword: "",
        startDate: "",
        endDate: "",
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: any) => {
    const subMissionId = editingSubMission?.id || null;
    console.log('[세부미션 저장] 모드:', subMissionId ? '수정' : '생성', 'ID:', subMissionId);
    
    const cleanedLabels: Record<string, string> = {};
    if (data.submissionLabels) {
      Object.entries(data.submissionLabels).forEach(([key, value]) => {
        if (!isNaN(parseInt(key)) && typeof value === 'string' && value.trim()) {
          cleanedLabels[key] = value;
        }
      });
    }
    
    const cleanedData = { ...data, submissionLabels: cleanedLabels };
    saveSubMissionMutation.mutate({ data: cleanedData, subMissionId });
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = subMissions.map((sm: any) => sm.id);
    [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
    reorderMutation.mutate(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === subMissions.length - 1) return;
    const newOrder = subMissions.map((sm: any) => sm.id);
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    reorderMutation.mutate(newOrder);
  };

  const getSubmissionTypeIcon = (type: string) => {
    switch (type) {
      case "file": return <Image className="h-4 w-4" />;
      case "link": return <Globe className="h-4 w-4" />;
      case "text": return <FileText className="h-4 w-4" />;
      case "image": return <ImagePlus className="h-4 w-4" />;
      case "studio_submit": return <Palette className="h-4 w-4" />;
      case "attendance": return <CheckSquare className="h-4 w-4" />;
      default: return null;
    }
  };

  const getSubmissionTypeName = (type: string) => {
    switch (type) {
      case "file": return "파일 제출";
      case "link": return "링크 제출";
      case "text": return "텍스트 제출";
      case "image": return "이미지 제출";
      case "studio_submit": return "제작소 제출";
      case "attendance": return "출석인증";
      default: return type;
    }
  };

  const handleSheetClose = (open: boolean) => {
    if (!open) {
      console.log('[Sheet 닫힘] editingSubMission 초기화');
      setEditingSubMission(null);
      setIsDialogOpen(false);
      onClose();
    }
  };

  const handleDialogClose = (open: boolean) => {
    console.log('[Dialog 상태 변경]', open ? '열림' : '닫힘', 'editingSubMission:', editingSubMission);
    if (!open) {
      setEditingSubMission(null);
    }
    setIsDialogOpen(open);
  };

  return (
    <>
      <Sheet open={isOpen} onOpenChange={handleSheetClose}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>세부 미션 관리</SheetTitle>
            <SheetDescription>
              {themeMissionTitle}의 세부 미션을 설정합니다
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-muted-foreground">
                총 {subMissions.length}개의 세부 미션
              </div>
              <Button onClick={() => handleOpenDialog()} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                세부 미션 추가
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : subMissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                세부 미션이 없습니다
              </div>
            ) : (
              <div className="space-y-2">
                {subMissions.map((subMission: any, index: number) => (
                  <Card key={subMission.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveUp(index)}
                            disabled={index === 0 || reorderMutation.isPending}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => moveDown(index)}
                            disabled={index === subMissions.length - 1 || reorderMutation.isPending}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </Button>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            {(subMission.submissionTypes || (subMission.submissionType ? [subMission.submissionType] : [])).map((type: string, idx: number) => (
                              <Badge key={idx} variant="outline">
                                {getSubmissionTypeIcon(type)}
                                <span className="ml-1">
                                  {getSubmissionTypeName(type)}
                                </span>
                              </Badge>
                            ))}
                            <span className="text-sm font-medium">{subMission.title}</span>
                            {subMission.sequentialLevel && subMission.sequentialLevel > 0 && (
                              <Badge variant="outline" className="text-purple-600 border-purple-300">
                                Lv.{subMission.sequentialLevel}
                              </Badge>
                            )}
                            {subMission.requireReview && (
                              <Badge variant="secondary">
                                <Eye className="h-3 w-3 mr-1" />
                                검수 필요
                              </Badge>
                            )}
                          </div>
                          {subMission.description && (
                            <div 
                              className="text-sm text-muted-foreground whitespace-pre-wrap"
                              dangerouslySetInnerHTML={{ __html: sanitizeHtml(subMission.description) }}
                            />
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center space-x-2">
                            <Switch
                              checked={subMission.isActive}
                              onCheckedChange={(checked) =>
                                toggleActiveMutation.mutate({
                                  id: subMission.id,
                                  isActive: checked,
                                })
                              }
                            />
                            <Label className="text-sm">
                              {subMission.isActive ? "활성" : "비활성"}
                            </Label>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(subMission)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => modal.open('deleteConfirm', {
                              title: '세부 미션 삭제',
                              description: '정말로 이 세부 미션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                              isLoading: deleteSubMissionMutation.isPending,
                              onConfirm: () => deleteSubMissionMutation.mutate(subMission.id)
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSubMission ? "세부 미션 수정" : "세부 미션 추가"}
            </DialogTitle>
            <DialogDescription>
              세부 미션 정보를 입력하세요
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>제목</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="파일을 업로드해주세요" />
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
                    <FormLabel>설명 (선택)</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        key={`editor-${editingSubMission?.id || 'new'}`}
                        value={field.value || ''}
                        onChange={field.onChange}
                        placeholder="세부 미션에 대한 설명을 입력하세요"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 세부미션 기간 설정 */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>시작일 (선택)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>종료일 (선택)</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground -mt-2">
                기간 설정 시 해당 기간에만 세부미션 수행이 가능합니다. 미설정 시 항상 수행 가능합니다.
              </p>

              <FormField
                control={form.control}
                name="submissionTypes"
                render={({ field }) => {
                  const submissionTypes = field.value || ["file"];
                  const submissionLabels = form.watch("submissionLabels") || {};
                  
                  const getDefaultLabel = (type: string) => {
                    switch (type) {
                      case "file": return "파일 URL";
                      case "image": return "이미지 URL";
                      case "link": return "링크 URL";
                      case "text": return "텍스트 내용";
                      case "review": return "리뷰 내용";
                      case "studio_submit": return "제작소 작업물";
                      default: return "";
                    }
                  };
                  
                  const addType = () => {
                    field.onChange([...submissionTypes, "file"]);
                  };
                  
                  const removeType = (index: number) => {
                    if (submissionTypes.length > 1) {
                      const newTypes = submissionTypes.filter((_: string, i: number) => i !== index);
                      field.onChange(newTypes);
                      const newLabels: Record<string, string> = {};
                      Object.keys(submissionLabels).forEach((key) => {
                        const keyIndex = parseInt(key);
                        if (!isNaN(keyIndex)) {
                          if (keyIndex < index) {
                            newLabels[String(keyIndex)] = submissionLabels[key];
                          } else if (keyIndex > index) {
                            newLabels[String(keyIndex - 1)] = submissionLabels[key];
                          }
                        }
                      });
                      form.setValue("submissionLabels", newLabels);
                    }
                  };
                  
                  const updateType = (index: number, newValue: string) => {
                    const newTypes = [...submissionTypes] as string[];
                    newTypes[index] = newValue;
                    field.onChange(newTypes);
                  };
                  
                  const updateLabel = (index: number, label: string) => {
                    const newLabels = { ...submissionLabels };
                    if (label.trim()) {
                      newLabels[String(index)] = label;
                    } else {
                      delete newLabels[String(index)];
                    }
                    form.setValue("submissionLabels", newLabels);
                  };
                  
                  return (
                    <FormItem>
                      <FormLabel>제출 타입</FormLabel>
                      <div className="space-y-3">
                        {submissionTypes.map((type: string, index: number) => (
                          <div key={index} className="space-y-2 p-3 border rounded-lg bg-muted/30">
                            <div className="flex items-center gap-2">
                              <Select 
                                value={type} 
                                onValueChange={(value) => updateType(index, value)}
                              >
                                <FormControl>
                                  <SelectTrigger className="flex-1">
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="file">
                                    <div className="flex items-center gap-2">
                                      <Upload className="h-4 w-4" />
                                      파일 제출
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="image">
                                    <div className="flex items-center gap-2">
                                      <ImagePlus className="h-4 w-4" />
                                      이미지 제출
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="link">
                                    <div className="flex items-center gap-2">
                                      <Globe className="h-4 w-4" />
                                      링크 제출
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="text">
                                    <div className="flex items-center gap-2">
                                      <FileText className="h-4 w-4" />
                                      텍스트 제출
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="studio_submit">
                                    <div className="flex items-center gap-2">
                                      <Palette className="h-4 w-4" />
                                      제작소 제출
                                    </div>
                                  </SelectItem>
                                  <SelectItem value="attendance">
                                    <span className="flex items-center gap-2">
                                      <CheckSquare className="h-4 w-4" />
                                      <span>출석인증</span>
                                    </span>
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeType(index)}
                                disabled={submissionTypes.length <= 1}
                                className="shrink-0"
                              >
                                <CloseIcon className="h-4 w-4" />
                              </Button>
                            </div>
                            <Input
                              placeholder={`라벨명 (기본: ${getDefaultLabel(type)})`}
                              value={submissionLabels[String(index)] || ""}
                              onChange={(e) => updateLabel(index, e.target.value)}
                              className="text-sm"
                            />
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addType}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          제출 타입 추가
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="requireReview"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        검수 필요
                      </FormLabel>
                      <FormDescription>
                        제출 후 관리자 검수가 필요한 미션입니다
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

              {/* 제작소 제출 설정 - studio_submit이 선택된 경우에만 표시 */}
              {form.watch("submissionTypes")?.includes("studio_submit") && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <h4 className="text-base font-medium">제작소 제출 설정</h4>
                    <p className="text-sm text-muted-foreground">
                      제작소 작업물 제출 시 파일 형식과 해상도를 설정하세요
                    </p>
                  </div>
                  
                  {/* 파일 형식 선택 */}
                  <FormField
                    control={form.control}
                    name="studioFileFormat"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>파일 형식</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={field.value || "pdf"}
                            onValueChange={(value) => field.onChange(value)}
                            className="flex flex-col space-y-1"
                          >
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="webp" id="format-webp" />
                              <Label htmlFor="format-webp" className="font-normal cursor-pointer">
                                WEBP - 고화질, 작은 용량 (웹 최적화)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="jpeg" id="format-jpeg" />
                              <Label htmlFor="format-jpeg" className="font-normal cursor-pointer">
                                JPEG - 범용 포맷 (높은 호환성)
                              </Label>
                            </div>
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="pdf" id="format-pdf" />
                              <Label htmlFor="format-pdf" className="font-normal cursor-pointer">
                                PDF - 인쇄용 (모든 디자인 한 파일)
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  
                  {/* DPI 선택 */}
                  <FormField
                    control={form.control}
                    name="studioDpi"
                    render={({ field }) => (
                      <FormItem className="space-y-3">
                        <FormLabel>해상도 (DPI)</FormLabel>
                        <FormControl>
                          <RadioGroup
                            value={String(field.value || 300)}
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            className="flex flex-col space-y-1"
                          >
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="150" id="dpi-150" />
                              <Label htmlFor="dpi-150" className="font-normal cursor-pointer">
                                고화질 (150 DPI) - 일반 용도
                              </Label>
                            </div>
                            <div className="flex items-center space-x-3">
                              <RadioGroupItem value="300" id="dpi-300" />
                              <Label htmlFor="dpi-300" className="font-normal cursor-pointer">
                                인쇄용 (300 DPI) - 고품질 인쇄
                              </Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* 출석인증 비밀번호 설정 - attendance가 선택된 경우에만 표시 */}
              {form.watch("submissionTypes")?.includes("attendance") && (
                <FormField
                  control={form.control}
                  name="attendancePassword"
                  render={({ field }) => (
                    <FormItem className="space-y-3 rounded-lg border p-4">
                      <FormLabel className="text-base">출석인증 비밀번호</FormLabel>
                      <FormDescription>
                        현장에서 참가자에게 안내할 출석 인증 비밀번호를 설정하세요
                      </FormDescription>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="현장에서 안내할 비밀번호"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}

              {/* 행사 에디터 템플릿 설정 - studio_submit이 선택된 경우에만 표시 */}
              {form.watch("submissionTypes")?.includes("studio_submit") && (
                <div className="space-y-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <Label className="text-base font-medium">행사 에디터 템플릿</Label>
                    <p className="text-sm text-muted-foreground">
                      사용자가 에디터를 열 때 사용할 기본 템플릿을 설정합니다
                    </p>
                  </div>
                  
                  {selectedTemplateId && selectedTemplate ? (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      {selectedTemplate.thumbnailUrl ? (
                        <img 
                          src={selectedTemplate.thumbnailUrl} 
                          alt={selectedTemplate.title}
                          className="w-16 h-16 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-16 h-16 flex items-center justify-center bg-muted-foreground/10 rounded border">
                          <Image className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-medium">{selectedTemplate.title}</p>
                        <p className="text-sm text-muted-foreground">ID: {selectedTemplate.id}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleOpenTemplateModal}
                        >
                          변경
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearTemplate}
                        >
                          <CloseIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : selectedTemplateId && !selectedTemplate ? (
                    <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div className="w-16 h-16 flex items-center justify-center bg-muted-foreground/10 rounded border">
                        <Image className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-muted-foreground">템플릿 ID: {selectedTemplateId}</p>
                        <p className="text-sm text-muted-foreground">(템플릿 정보를 불러오려면 "변경" 클릭)</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleOpenTemplateModal}
                        >
                          변경
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleClearTemplate}
                        >
                          <CloseIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleOpenTemplateModal}
                      className="w-full"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      에디터 템플릿 설정하기
                    </Button>
                  )}

                  <FormField
                    control={form.control}
                    name="partyMaxPages"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>최대 페이지 수</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="비워두면 제한 없음"
                            value={field.value ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              field.onChange(val === '' ? null : parseInt(val, 10));
                            }}
                            min={1}
                          />
                        </FormControl>
                        <FormDescription>
                          사용자가 만들 수 있는 최대 페이지 수를 제한합니다 (비워두면 제한 없음)
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>
              )}

              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-4">액션 타입 및 잠금 설정</h4>
                
                <FormField
                  control={form.control}
                  name="actionTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>액션 타입</FormLabel>
                      <Select 
                        onValueChange={(value) => field.onChange(value === "none" ? null : Number(value))} 
                        value={field.value?.toString() || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="액션 타입 선택 (선택사항)" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">선택 안함</SelectItem>
                          {activeActionTypes.map((actionType: any) => (
                            <SelectItem key={actionType.id} value={actionType.id.toString()}>
                              {actionType.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        세부 미션의 액션 타입을 지정합니다 (신청, 제출, 출석, 리뷰 등)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="sequentialLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>순차 등급</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="0 (순차진행 안함)"
                          value={field.value || 0}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>
                        0=순차진행 안함, 1,2,3...=등급 (이전 등급의 모든 미션 완료 시 다음 등급 열림)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>


              <DialogFooter>
                <Button 
                  type="submit" 
                  disabled={saveSubMissionMutation.isPending}
                >
                  {saveSubMissionMutation.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  저장
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </>
  );
}

// 하부 미션 관리자 컴포넌트
function ChildMissionManager({ 
  parentId, 
  parentTitle, 
  isOpen, 
  onClose,
  onAddChildMission,
  onEditChildMission
}: { 
  parentId: number; 
  parentTitle: string; 
  isOpen: boolean; 
  onClose: () => void;
  onAddChildMission: (parentId: number) => void;
  onEditChildMission: (mission: any) => void;
}) {
  const queryClient = useQueryClient();
  const modal = useModal();

  // 하부미션 목록 조회
  const { data: childMissions = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/missions', parentId, 'child-missions'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/missions/${parentId}/child-missions`, { credentials: 'include' });
      if (!response.ok) throw new Error('하부미션 조회 실패');
      return response.json();
    },
    enabled: isOpen
  });

  // 승인된 사용자 목록 조회
  const { data: approvedUsersData } = useQuery<any>({
    queryKey: ['/api/admin/missions', parentId, 'approved-users'],
    queryFn: async () => {
      const response = await fetch(`/api/admin/missions/${parentId}/approved-users`, { credentials: 'include' });
      if (!response.ok) throw new Error('승인된 사용자 조회 실패');
      return response.json();
    },
    enabled: approvedUsersDialogOpen
  });

  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery<MissionCategory[]>({
    queryKey: ['/api/admin/mission-categories'],
  });

  // 하부미션 삭제 mutation
  const deleteChildMissionMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/admin/missions/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', parentId, 'child-missions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
      toast({ title: "하부미션이 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            하부미션 관리
          </SheetTitle>
          <SheetDescription>
            "{parentTitle}" 미션의 하부미션을 관리합니다
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* 승인된 사용자 정보 */}
          <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-600" />
              <span className="text-sm text-blue-700">
                승인된 사용자만 하부미션에 접근할 수 있습니다
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => modal.open('approvedUsers', { 
                users: approvedUsersData?.users || [],
                isLoading: !approvedUsersData 
              })}
            >
              사용자 보기
            </Button>
          </div>

          {/* 하부미션 추가 버튼 */}
          <div className="flex justify-between items-center">
            <h3 className="font-medium">하부미션 목록</h3>
            <Button size="sm" onClick={() => onAddChildMission(parentId)}>
              <Plus className="h-4 w-4 mr-1" />
              하부미션 추가
            </Button>
          </div>

          {/* 하부미션 목록 */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : childMissions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              아직 하부미션이 없습니다
            </div>
          ) : (
            <div className="space-y-3">
              {childMissions.map((mission: any) => {
                const category = categories.find(c => c.categoryId === mission.categoryId);
                return (
                  <div
                    key={mission.id}
                    className="p-4 border rounded-lg hover:bg-gray-50 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{mission.title}</span>
                        {category && (
                          <Badge variant="outline" className="text-xs">
                            {category.emoji} {category.name}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        세부미션: {mission.subMissionCount || 0}개 | 
                        승인된 사용자: {mission.approvedUserCount || 0}명
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditChildMission(mission)}
                        title="수정"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm('정말 삭제하시겠습니까?')) {
                            deleteChildMissionMutation.mutate(mission.id);
                          }
                        }}
                        title="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </SheetContent>
    </Sheet>
  );
}

// 로컬 시간을 datetime-local input에 맞는 형식으로 변환
const toLocalDateTimeString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// 주제 미션 관리
function ThemeMissionManagement() {
  const queryClient = useQueryClient();
  const modal = useModal();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMission, setEditingMission] = useState<ThemeMission | null>(null);
  const [creatingParentId, setCreatingParentId] = useState<number | null>(null);
  const [subMissionBuilder, setSubMissionBuilder] = useState<{ themeMissionId: number; missionId: string; title: string } | null>(null);
  const [childMissionManager, setChildMissionManager] = useState<{ parentId: number; title: string } | null>(null);
  const [uploadingHeader, setUploadingHeader] = useState(false);
  const [uploadingGift, setUploadingGift] = useState(false);
  const [uploadingVenue, setUploadingVenue] = useState(false);
  const headerImageInputRef = useRef<HTMLInputElement>(null);
  const giftImageInputRef = useRef<HTMLInputElement>(null);
  const venueImageInputRef = useRef<HTMLInputElement>(null);

  // 폴더 관련 상태 - useModal for dialog
  const [editingFolder, setEditingFolder] = useState<MissionFolder | null>(null);
  const [localFolders, setLocalFolders] = useState<MissionFolder[]>([]);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] = useState("#6366f1");

  // DnD 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 기간 기반 상태 계산 함수 - dateUtils의 getPeriodStatus 사용
  const getMissionPeriodStatus = (startDate?: string | null, endDate?: string | null) => {
    return getPeriodStatus(startDate, endDate);
  };

  // 상태 배지 렌더링
  const getMissionStatusBadge = (mission: ThemeMission) => {
    const startDateStr = mission.startDate ? (mission.startDate instanceof Date ? mission.startDate.toISOString() : String(mission.startDate)) : undefined;
    const endDateStr = mission.endDate ? (mission.endDate instanceof Date ? mission.endDate.toISOString() : String(mission.endDate)) : undefined;
    const periodStatus = getMissionPeriodStatus(startDateStr, endDateStr);
    
    if (periodStatus === 'upcoming') {
      return <Badge className="bg-red-500 text-white hover:bg-red-600">준비 중</Badge>;
    }
    if (periodStatus === 'closed') {
      return <Badge variant="destructive">마감</Badge>;
    }
    return <Badge className="bg-blue-500 text-white hover:bg-blue-600">진행 중</Badge>;
  };

  // 카테고리 목록 조회
  const { data: categories = [] } = useQuery<MissionCategory[]>({
    queryKey: ['/api/admin/mission-categories'],
  });

  // 병원 목록 조회
  const { data: hospitals = [] } = useQuery<any[]>({
    queryKey: ['/api/hospitals'],
  });

  // 주제 미션 목록 조회
  const { data: missions = [], isLoading } = useQuery<ThemeMission[]>({
    queryKey: ['/api/admin/missions'],
  });

  // 폴더 목록 조회
  const { data: folders = [] } = useQuery<MissionFolder[]>({
    queryKey: ['/api/admin/mission-folders'],
  });

  // 폴더 목록이 변경되면 로컬 상태 업데이트
  useEffect(() => {
    setLocalFolders(folders);
  }, [folders]);

  // 폴더 생성 mutation
  const createFolderMutation = useMutation({
    mutationFn: (data: { name: string; color: string }) =>
      apiRequest('/api/admin/mission-folders', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mission-folders'] });
      toast({ title: "폴더가 생성되었습니다" });
      modal.close();
      setNewFolderName("");
      setNewFolderColor("#6366f1");
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 폴더 수정 mutation
  const updateFolderMutation = useMutation({
    mutationFn: ({ id, silent, ...data }: { id: number; name?: string; color?: string; isCollapsed?: boolean; silent?: boolean }) =>
      apiRequest(`/api/admin/mission-folders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onMutate: async (variables) => {
      return { silent: variables.silent };
    },
    onSuccess: (_, __, context) => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mission-folders'] });
      if (!context?.silent) {
        toast({ title: "폴더가 수정되었습니다" });
        modal.close();
        setEditingFolder(null);
      }
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 폴더 삭제 mutation
  const deleteFolderMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/admin/mission-folders/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mission-folders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
      toast({ title: "폴더가 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 폴더 순서 변경 mutation
  const reorderFoldersMutation = useMutation({
    mutationFn: (folderIds: number[]) =>
      apiRequest('/api/admin/mission-folders/reorder', {
        method: 'PUT',
        body: JSON.stringify({ folderIds }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/mission-folders'] });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
      setLocalFolders(folders);
    },
  });

  // 미션 순서/폴더 변경 mutation
  const reorderMissionsMutation = useMutation({
    mutationFn: (missionOrders: { id: number; order: number; folderId: number | null }[]) =>
      apiRequest('/api/admin/missions/reorder', {
        method: 'PUT',
        body: JSON.stringify({ missionOrders }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 미션 폴더 이동 mutation
  const moveMissionToFolderMutation = useMutation({
    mutationFn: ({ missionId, folderId }: { missionId: number; folderId: number | null }) =>
      apiRequest(`/api/admin/missions/${missionId}/folder`, {
        method: 'PUT',
        body: JSON.stringify({ folderId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 폴더별 미션 그룹화
  const missionsByFolder = useMemo(() => {
    const result: Map<number | null, any[]> = new Map();
    result.set(null, []);

    for (const folder of localFolders) {
      result.set(folder.id, []);
    }

    for (const mission of missions) {
      const missionWithFolder = mission as any;
      const folderId = missionWithFolder.folderId ?? null;
      if (!result.has(folderId)) {
        result.set(null, [...(result.get(null) || []), mission]);
      } else {
        result.get(folderId)?.push(mission);
      }
    }

    return result;
  }, [missions, localFolders]);

  // 드래그 시작 핸들러
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  // 드래그 종료 핸들러
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // 폴더 순서 변경
    if (activeId.startsWith('folder-') && overId.startsWith('folder-')) {
      const activeFolderId = parseInt(activeId.replace('folder-', ''));
      const overFolderId = parseInt(overId.replace('folder-', ''));

      if (activeFolderId === 0 || overFolderId === 0) return;

      const oldIndex = localFolders.findIndex(f => f.id === activeFolderId);
      const newIndex = localFolders.findIndex(f => f.id === overFolderId);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newFolders = arrayMove(localFolders, oldIndex, newIndex);
        setLocalFolders(newFolders);
        reorderFoldersMutation.mutate(newFolders.map(f => f.id));
      }
    }

    // 미션을 폴더로 이동 (미션을 폴더 헤더로 드래그)
    if (activeId.startsWith('mission-') && overId.startsWith('folder-')) {
      const activeMissionId = parseInt(activeId.replace('mission-', ''));
      const targetFolderId = parseInt(overId.replace('folder-', ''));
      
      const activeMission = missions.find((m: any) => m.id === activeMissionId) as any;
      if (!activeMission) return;
      
      // 미분류(folder-0)로 이동 시 folderId를 null로 설정
      const newFolderId = targetFolderId === 0 ? null : targetFolderId;
      
      // 이미 같은 폴더에 있으면 무시
      if ((activeMission.folderId ?? null) === newFolderId) return;
      
      moveMissionToFolderMutation.mutate({ missionId: activeMissionId, folderId: newFolderId });
      return;
    }

    // 미션 순서 변경
    if (activeId.startsWith('mission-') && overId.startsWith('mission-')) {
      const activeMissionId = parseInt(activeId.replace('mission-', ''));
      const overMissionId = parseInt(overId.replace('mission-', ''));

      const activeMission = missions.find((m: any) => m.id === activeMissionId) as any;
      const overMission = missions.find((m: any) => m.id === overMissionId) as any;

      if (!activeMission || !overMission) return;

      const sourceFolderId = activeMission.folderId ?? null;
      const targetFolderId = overMission.folderId ?? null;

      const sourceMissions = missionsByFolder.get(sourceFolderId) || [];
      const targetMissions = missionsByFolder.get(targetFolderId) || [];

      if (sourceFolderId === targetFolderId) {
        const oldIndex = sourceMissions.findIndex((m: any) => m.id === activeMissionId);
        const newIndex = sourceMissions.findIndex((m: any) => m.id === overMissionId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const newMissions = arrayMove(sourceMissions, oldIndex, newIndex);
          const missionOrders = newMissions.map((m: any, idx) => ({
            id: m.id,
            order: idx,
            folderId: sourceFolderId,
          }));
          reorderMissionsMutation.mutate(missionOrders);
        }
      } else {
        const newIndex = targetMissions.findIndex((m: any) => m.id === overMissionId);
        const missionOrders: { id: number; order: number; folderId: number | null }[] = [];

        const newSourceMissions = sourceMissions.filter((m: any) => m.id !== activeMissionId);
        newSourceMissions.forEach((m: any, idx) => {
          missionOrders.push({ id: m.id, order: idx, folderId: sourceFolderId });
        });

        const newTargetMissions = [...targetMissions];
        newTargetMissions.splice(newIndex, 0, activeMission);
        newTargetMissions.forEach((m: any, idx) => {
          missionOrders.push({ id: m.id, order: idx, folderId: targetFolderId });
        });

        reorderMissionsMutation.mutate(missionOrders);
      }
    }
  };

  // 폴더 접기/펼치기 토글
  const handleToggleFolderCollapse = (folderId: number) => {
    const folder = localFolders.find(f => f.id === folderId);
    if (folder) {
      updateFolderMutation.mutate({ id: folderId, isCollapsed: !folder.isCollapsed, silent: true });
      setLocalFolders(prev =>
        prev.map(f => (f.id === folderId ? { ...f, isCollapsed: !f.isCollapsed } : f))
      );
    }
  };

  // 폴더 편집 시작
  const handleEditFolder = (folder: MissionFolder) => {
    setEditingFolder(folder);
    setNewFolderName(folder.name);
    setNewFolderColor(folder.color);
    modal.open('folder', {
      folder,
      onSave: (data: { name: string; color: string }) => {
        updateFolderMutation.mutate({ id: folder.id, name: data.name, color: data.color });
      }
    });
  };

  // 폴더 저장
  const handleSaveFolder = () => {
    if (!newFolderName.trim()) {
      toast({ title: "오류", description: "폴더 이름을 입력하세요", variant: "destructive" });
      return;
    }

    if (editingFolder) {
      updateFolderMutation.mutate({
        id: editingFolder.id,
        name: newFolderName,
        color: newFolderColor,
      });
    } else {
      createFolderMutation.mutate({ name: newFolderName, color: newFolderColor });
    }
  };

  // 폴더 다이얼로그 열기
  const handleOpenFolderDialog = () => {
    setEditingFolder(null);
    setNewFolderName("");
    setNewFolderColor("#6366f1");
    modal.open('folder', {
      folder: null,
      onSave: (data: { name: string; color: string }) => {
        createFolderMutation.mutate(data);
      }
    });
  };

  // 미션을 다른 폴더로 이동
  const handleMoveToFolder = (missionId: number, folderId: number | null) => {
    moveMissionToFolderMutation.mutate({ missionId, folderId });
  };

  // 미션을 부모-자식 계층 구조로 평탄화 (depth 포함)
  const flattenMissionsWithDepth = (missionList: any[], depth = 0): Array<{ mission: any; depth: number }> => {
    const result: Array<{ mission: any; depth: number }> = [];
    for (const mission of missionList) {
      result.push({ mission, depth });
      if (mission.childMissions && mission.childMissions.length > 0) {
        result.push(...flattenMissionsWithDepth(mission.childMissions, depth + 1));
      }
    }
    return result;
  };

  const flattenedMissions = flattenMissionsWithDepth(missions);

  // 주제 미션 생성/수정 mutation
  const saveMissionMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editingMission) {
        return apiRequest(`/api/admin/missions/${editingMission.id}`, {
          method: 'PUT',
          body: JSON.stringify(data)
        });
      }
      return apiRequest('/api/admin/missions', {
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
      toast({ title: "미션이 저장되었습니다" });
      setIsDialogOpen(false);
      setEditingMission(null);
      setCreatingParentId(null);
      setChildMissionManager(null);
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 주제 미션 삭제 mutation
  const deleteMissionMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest(`/api/admin/missions/${id}`, {
        method: 'DELETE'
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
      toast({ title: "미션이 삭제되었습니다" });
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  // 활성화 토글 mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest(`/api/admin/missions/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ isActive })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions'] });
    },
  });

  const formSchema = z.object({
    missionId: z.string().min(1, "미션 ID를 입력하세요"),
    title: z.string().min(1, "제목을 입력하세요"),
    description: z.string().min(1, "설명을 입력하세요"),
    categoryId: z.string().optional(),
    headerImageUrl: z.string().url("올바른 URL을 입력하세요").optional().or(z.literal("")),
    visibilityType: z.enum(["public", "hospital", "dev"]),
    hospitalId: z.number().optional().nullable(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    order: z.number().int().min(0),
    eventDate: z.string().optional(),
    eventEndTime: z.string().optional(),
    capacity: z.number().int().min(0).optional().nullable(),
    isFirstCome: z.boolean().optional(),
    noticeItems: z.array(z.object({
      title: z.string(),
      content: z.string(),
    })).optional(),
    giftImageUrl: z.string().url("올바른 URL을 입력하세요").optional().or(z.literal("")),
    giftDescription: z.string().optional(),
    venueImageUrl: z.string().url("올바른 URL을 입력하세요").optional().or(z.literal("")),
  }).refine(
    (data) => {
      if (data.visibilityType === "hospital") {
        return data.hospitalId !== null && data.hospitalId !== undefined;
      }
      return true;
    },
    {
      message: "병원 전용 미션은 병원을 선택해야 합니다",
      path: ["hospitalId"]
    }
  );

  const form = useForm({
    resolver: zodResolver(formSchema),
    defaultValues: {
      missionId: "",
      title: "",
      description: "",
      categoryId: "none",
      headerImageUrl: "",
      visibilityType: "public" as "public" | "hospital" | "dev",
      hospitalId: null as number | null,
      startDate: "",
      endDate: "",
      order: 0,
      eventDate: "",
      eventEndTime: "",
      capacity: null as number | null,
      isFirstCome: false,
      noticeItems: [] as { title: string; content: string }[],
      giftImageUrl: "",
      giftDescription: "",
      venueImageUrl: "",
    },
  });

  const visibilityType = form.watch("visibilityType");

  const handleOpenDialog = (mission?: ThemeMission, parentId?: number) => {
    if (mission) {
      setEditingMission(mission);
      setCreatingParentId(null);
      const m = mission as any;
      form.reset({
        missionId: mission.missionId,
        title: mission.title,
        description: mission.description,
        categoryId: mission.categoryId || "none",
        headerImageUrl: mission.headerImageUrl || "",
        visibilityType: (mission.visibilityType || "public") as "public" | "hospital" | "dev",
        hospitalId: mission.hospitalId,
        startDate: formatDateForInput(mission.startDate) || "",
        endDate: formatDateForInput(mission.endDate) || "",
        order: mission.order || 0,
        eventDate: formatDateForInput(m.eventDate) || "",
        eventEndTime: formatDateForInput(m.eventEndTime) || "",
        capacity: m.capacity ?? null,
        isFirstCome: m.isFirstCome ?? false,
        noticeItems: m.noticeItems ?? [],
        giftImageUrl: m.giftImageUrl || "",
        giftDescription: m.giftDescription || "",
        venueImageUrl: m.venueImageUrl || "",
      });
    } else {
      setEditingMission(null);
      setCreatingParentId(parentId || null);
      
      // 부모 미션이 있으면 부모의 설정을 기본값으로
      const parentMission = parentId ? flattenedMissions.find(m => m.mission.id === parentId)?.mission : null;
      
      form.reset({
        missionId: "",
        title: "",
        description: "",
        categoryId: parentMission?.categoryId || "none",
        headerImageUrl: "",
        visibilityType: (parentMission?.visibilityType || "public") as "public" | "hospital" | "dev",
        hospitalId: parentMission?.hospitalId || null,
        startDate: "",
        endDate: "",
        order: parentMission?.childMissions?.length || missions.length,
        eventDate: "",
        eventEndTime: "",
        capacity: null,
        isFirstCome: false,
        noticeItems: [],
        giftImageUrl: "",
        giftDescription: "",
        venueImageUrl: "",
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = (data: any) => {
    // 수정 시 기존 parentMissionId 유지를 위해 flattenedMissions에서 찾기
    let preservedParentMissionId: number | null = null;
    if (editingMission) {
      const foundMission = flattenedMissions.find(m => m.mission.id === editingMission.id);
      preservedParentMissionId = foundMission?.mission?.parentMissionId ?? editingMission.parentMissionId ?? null;
    }
    
    const payload = {
      ...data,
      headerImageUrl: data.headerImageUrl || null,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      categoryId: data.categoryId === "none" ? null : data.categoryId,
      hospitalId: data.visibilityType === "hospital" ? data.hospitalId : null,
      // 수정 시 기존 parentMissionId 유지, 새로 생성 시만 creatingParentId 사용
      parentMissionId: editingMission ? preservedParentMissionId : (creatingParentId || null),
      eventDate: data.eventDate || null,
      eventEndTime: data.eventEndTime || null,
      capacity: data.capacity ?? null,
      isFirstCome: data.isFirstCome ?? false,
      noticeItems: data.noticeItems || [],
      giftImageUrl: data.giftImageUrl || null,
      giftDescription: data.giftDescription || null,
      venueImageUrl: data.venueImageUrl || null,
    };
    saveMissionMutation.mutate(payload);
  };

  const handleHeaderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingHeader(true);
    const formData = new FormData();
    formData.append('headerImage', file);
    
    try {
      const response = await fetch('/api/admin/missions/upload-header', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        form.setValue('headerImageUrl', data.imageUrl);
        toast({ title: "이미지가 업로드되었습니다" });
      } else {
        toast({ title: "업로드 실패", description: data.error, variant: "destructive" });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast({ title: "업로드 실패", description: "이미지 업로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setUploadingHeader(false);
      if (headerImageInputRef.current) {
        headerImageInputRef.current.value = '';
      }
    }
  };

  const handleGiftImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingGift(true);
    const formData = new FormData();
    formData.append('headerImage', file);
    
    try {
      const response = await fetch('/api/admin/missions/upload-header', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        form.setValue('giftImageUrl', data.imageUrl);
        toast({ title: "선물 이미지가 업로드되었습니다" });
      } else {
        toast({ title: "업로드 실패", description: data.error, variant: "destructive" });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast({ title: "업로드 실패", description: "이미지 업로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setUploadingGift(false);
      if (giftImageInputRef.current) {
        giftImageInputRef.current.value = '';
      }
    }
  };

  const handleVenueImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploadingVenue(true);
    const formData = new FormData();
    formData.append('headerImage', file);
    
    try {
      const response = await fetch('/api/admin/missions/upload-header', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        form.setValue('venueImageUrl', data.imageUrl);
        toast({ title: "장소 이미지가 업로드되었습니다" });
      } else {
        toast({ title: "업로드 실패", description: data.error, variant: "destructive" });
      }
    } catch (error) {
      console.error('Upload failed:', error);
      toast({ title: "업로드 실패", description: "이미지 업로드 중 오류가 발생했습니다", variant: "destructive" });
    } finally {
      setUploadingVenue(false);
      if (venueImageInputRef.current) {
        venueImageInputRef.current.value = '';
      }
    }
  };

  const noticeItems = form.watch("noticeItems");

  const addNoticeItem = () => {
    const current = form.getValues("noticeItems") || [];
    form.setValue("noticeItems", [...current, { title: "", content: "" }]);
  };

  const removeNoticeItem = (index: number) => {
    const current = form.getValues("noticeItems") || [];
    form.setValue("noticeItems", current.filter((_, i) => i !== index));
  };

  const updateNoticeItem = (index: number, field: 'title' | 'content', value: string) => {
    const current = form.getValues("noticeItems") || [];
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    form.setValue("noticeItems", updated);
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>주제 미션 관리</CardTitle>
            <CardDescription>미션을 생성하고 세부 미션을 설정합니다. 드래그하여 순서를 변경하거나 폴더 간 이동할 수 있습니다.</CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleOpenFolderDialog}>
              <FolderPlus className="h-4 w-4 mr-2" />
              폴더 추가
            </Button>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              미션 추가
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={[
              ...localFolders.map(f => `folder-${f.id}`),
              'folder-0'
            ]}
            strategy={verticalListSortingStrategy}
          >
            {localFolders.map((folder) => (
              <SortableFolderSection
                key={folder.id}
                folder={folder}
                missions={missionsByFolder.get(folder.id) || []}
                categories={categories}
                hospitals={hospitals}
                folders={localFolders}
                getMissionStatusBadge={getMissionStatusBadge}
                toggleActiveMutation={toggleActiveMutation}
                setSubMissionBuilder={setSubMissionBuilder}
                setChildMissionManager={setChildMissionManager}
                handleOpenDialog={handleOpenDialog}
                deleteMissionMutation={deleteMissionMutation}
                onToggleCollapse={handleToggleFolderCollapse}
                onEditFolder={handleEditFolder}
                onDeleteFolder={(id) => deleteFolderMutation.mutate(id)}
                flattenMissionsWithDepth={flattenMissionsWithDepth}
                onMoveToFolder={handleMoveToFolder}
              />
            ))}

            <SortableFolderSection
              key="uncategorized"
              folder={null}
              missions={missionsByFolder.get(null) || []}
              categories={categories}
              hospitals={hospitals}
              folders={localFolders}
              getMissionStatusBadge={getMissionStatusBadge}
              toggleActiveMutation={toggleActiveMutation}
              setSubMissionBuilder={setSubMissionBuilder}
              setChildMissionManager={setChildMissionManager}
              handleOpenDialog={handleOpenDialog}
              deleteMissionMutation={deleteMissionMutation}
              onToggleCollapse={() => {}}
              onEditFolder={() => {}}
              onDeleteFolder={() => {}}
              flattenMissionsWithDepth={flattenMissionsWithDepth}
              onMoveToFolder={handleMoveToFolder}
            />
          </SortableContext>
        </DndContext>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingMission ? '미션 수정' : '미션 추가'}
              </DialogTitle>
              <DialogDescription>
                주제 미션 정보를 입력하세요. 세부 미션은 생성 후 관리할 수 있습니다.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="missionId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>미션 ID</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="daily_mission_1" disabled={!!editingMission} />
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
                        <FormLabel>카테고리</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="선택하세요" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">카테고리 없음</SelectItem>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.categoryId}>
                                {cat.emoji} {cat.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>미션 제목</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="첫 태교 일기 작성하기" />
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
                      <FormLabel>미션 설명</FormLabel>
                      <FormControl>
                        <RichTextEditor 
                          value={field.value || ''} 
                          onChange={field.onChange}
                          placeholder="아기에게 첫 편지를 써보세요"
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
                      <FormLabel>헤더 이미지 (선택)</FormLabel>
                      <div className="space-y-3">
                        {field.value && (
                          <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                            <img 
                              src={field.value} 
                              alt="헤더 이미지 미리보기"
                              className="w-full h-full object-cover"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={() => field.onChange('')}
                            >
                              <CloseIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2 items-center">
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/gif,image/webp"
                            onChange={handleHeaderImageUpload}
                            hidden
                            ref={headerImageInputRef}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => headerImageInputRef.current?.click()}
                            disabled={uploadingHeader}
                          >
                            {uploadingHeader ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                업로드 중...
                              </>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                이미지 업로드
                              </>
                            )}
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            JPG, PNG, GIF, WebP (최대 5MB)
                          </span>
                        </div>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="또는 이미지 URL 직접 입력" 
                            className="text-sm"
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="visibilityType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>공개 범위</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            // visibilityType이 public으로 변경되면 hospitalId 초기화
                            if (value === "public") {
                              form.setValue("hospitalId", null);
                            }
                          }} 
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="public">
                              <div className="flex items-center gap-2">
                                <Globe className="h-4 w-4" />
                                전체 공개
                              </div>
                            </SelectItem>
                            <SelectItem value="hospital">
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                병원 전용
                              </div>
                            </SelectItem>
                            <SelectItem value="dev">
                              <div className="flex items-center gap-2">
                                <Code className="h-4 w-4" />
                                개발전용 (슈퍼관리자만)
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {visibilityType === "hospital" && (
                    <FormField
                      control={form.control}
                      name="hospitalId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>병원 선택</FormLabel>
                          <Select 
                            onValueChange={(value) => field.onChange(Number(value))} 
                            value={field.value?.toString() || ""}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="병원을 선택하세요" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {hospitals.map(hospital => (
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>시작일 (선택)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>종료일 (선택)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="order"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>정렬 순서</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormDescription>낮은 숫자가 먼저 표시됩니다</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">행사 정보 (선택)</h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="eventDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>행사 시작일</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="eventEndTime"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>행사 종료일</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <FormField
                      control={form.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>모집 인원</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="0 = 무제한"
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="isFirstCome"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-end space-x-3 space-y-0 rounded-md border p-4 h-fit">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>선착순</FormLabel>
                            <FormDescription className="text-xs">선착순으로 인원을 제한합니다</FormDescription>
                          </div>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">안내사항</h4>
                    <Button type="button" variant="outline" size="sm" onClick={addNoticeItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      추가
                    </Button>
                  </div>
                  
                  {noticeItems && noticeItems.length > 0 && (
                    <div className="space-y-3">
                      {noticeItems.map((item, index) => (
                        <div key={index} className="border rounded-lg p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">안내 {index + 1}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeNoticeItem(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <Input
                            placeholder="제목"
                            value={item.title}
                            onChange={(e) => updateNoticeItem(index, 'title', e.target.value)}
                          />
                          <Textarea
                            placeholder="내용"
                            value={item.content}
                            onChange={(e) => updateNoticeItem(index, 'content', e.target.value)}
                            rows={2}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">선물 정보 (선택)</h4>

                  <FormField
                    control={form.control}
                    name="giftImageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>선물 이미지</FormLabel>
                        <div className="space-y-3">
                          {field.value && (
                            <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                              <img 
                                src={field.value} 
                                alt="선물 이미지 미리보기"
                                className="w-full h-full object-cover"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => field.onChange('')}
                              >
                                <CloseIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          <div className="flex gap-2 items-center">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              onChange={handleGiftImageUpload}
                              hidden
                              ref={giftImageInputRef}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => giftImageInputRef.current?.click()}
                              disabled={uploadingGift}
                            >
                              {uploadingGift ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  업로드 중...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  이미지 업로드
                                </>
                              )}
                            </Button>
                          </div>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="또는 이미지 URL 직접 입력" 
                              className="text-sm"
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="giftDescription"
                    render={({ field }) => (
                      <FormItem className="mt-4">
                        <FormLabel>선물 설명</FormLabel>
                        <FormControl>
                          <Textarea 
                            {...field} 
                            placeholder="선물에 대한 설명을 입력하세요"
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">장소 정보 (선택)</h4>

                  <FormField
                    control={form.control}
                    name="venueImageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>장소 이미지</FormLabel>
                        <div className="space-y-3">
                          {field.value && (
                            <div className="relative w-full h-32 rounded-lg overflow-hidden border">
                              <img 
                                src={field.value} 
                                alt="장소 이미지 미리보기"
                                className="w-full h-full object-cover"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => field.onChange('')}
                              >
                                <CloseIcon className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                          <div className="flex gap-2 items-center">
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/gif,image/webp"
                              onChange={handleVenueImageUpload}
                              hidden
                              ref={venueImageInputRef}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => venueImageInputRef.current?.click()}
                              disabled={uploadingVenue}
                            >
                              {uploadingVenue ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  업로드 중...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  이미지 업로드
                                </>
                              )}
                            </Button>
                          </div>
                          <FormControl>
                            <Input 
                              {...field} 
                              placeholder="또는 이미지 URL 직접 입력" 
                              className="text-sm"
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <DialogFooter>
                  <Button 
                    type="submit" 
                    disabled={saveMissionMutation.isPending}
                  >
                    {saveMissionMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    저장
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* 세부 미션 빌더 */}
        {subMissionBuilder && (
          <SubMissionBuilder
            themeMissionId={subMissionBuilder.themeMissionId}
            missionId={subMissionBuilder.missionId}
            themeMissionTitle={subMissionBuilder.title}
            isOpen={true}
            onClose={() => setSubMissionBuilder(null)}
          />
        )}

        {/* 하부 미션 관리자 */}
        {childMissionManager && (
          <ChildMissionManager
            parentId={childMissionManager.parentId}
            parentTitle={childMissionManager.title}
            isOpen={true}
            onClose={() => setChildMissionManager(null)}
            onAddChildMission={(parentId) => handleOpenDialog(undefined, parentId)}
            onEditChildMission={(mission) => handleOpenDialog(mission)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// 검수 대시보드
interface ReviewDashboardProps {
  activeMissionId?: string | null;
  activeSubmissionId?: string | null;
  onMissionSelect?: (missionId: string | null) => void;
  onSubmissionSelect?: (submissionId: string | null, missionId?: string | null) => void;
}

function ReviewDashboard({ 
  activeMissionId, 
  activeSubmissionId, 
  onMissionSelect, 
  onSubmissionSelect 
}: ReviewDashboardProps) {
  const queryClient = useQueryClient();
  
  // URL 기반 상태와 내부 상태 연동
  const [internalMissionId, setInternalMissionId] = useState<string | null>(null);
  const [internalSubmissionId, setInternalSubmissionId] = useState<string | null>(null);
  
  // props가 있으면 props 사용, 없으면 내부 상태 사용
  const currentMissionId = activeMissionId !== undefined ? activeMissionId : internalMissionId;
  const currentSubmissionId = activeSubmissionId !== undefined ? activeSubmissionId : internalSubmissionId;
  
  // 현재 뷰 상태 계산
  const currentView: 'theme-missions' | 'sub-missions' | 'submissions' = 
    currentSubmissionId ? 'submissions' : 
    currentMissionId ? 'sub-missions' : 
    'theme-missions';
  
  const modal = useModal();
  const [selectedThemeMission, setSelectedThemeMission] = useState<{id: number, missionId: string, title: string} | null>(null);
  const [selectedSubMission, setSelectedSubMission] = useState<{id: number, title: string} | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'approved' | 'rejected'>('all');
  
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [collapsedFolderIds, setCollapsedFolderIds] = useState<Set<number | 'uncategorized'>>(new Set());
  const [hasInitializedCollapsed, setHasInitializedCollapsed] = useState(false);
  
  // 폴더 접기/펼치기 토글 함수
  const toggleFolderCollapse = (folderId: number | 'uncategorized') => {
    setCollapsedFolderIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };
  
  // 미션 선택 핸들러 (URL 히스토리 연동)
  const handleThemeMissionSelect = (mission: {id: number, missionId: string, title: string} | null) => {
    setSelectedThemeMission(mission);
    setSelectedSubMission(null);
    const missionIdStr = mission ? mission.missionId : null;
    if (onMissionSelect) {
      onMissionSelect(missionIdStr);
    } else {
      setInternalMissionId(missionIdStr);
    }
  };
  
  // 서브미션 선택 시 제출 목록으로 이동 (히스토리 연동)
  // 참고: submission은 실제로는 sub-mission을 의미 (제출 목록을 보기 위한 세부미션 선택)
  const handleSubMissionSelect = (subMission: {id: number, title: string} | null) => {
    setSelectedSubMission(subMission);
    const subMissionIdStr = subMission ? subMission.id.toString() : null;
    const currentMissionIdStr = selectedThemeMission?.missionId || currentMissionId || null;
    
    // 세부미션 선택 시 부모 미션 ID도 함께 전달
    if (onSubmissionSelect) {
      onSubmissionSelect(subMissionIdStr, currentMissionIdStr);
    } else {
      setInternalSubmissionId(subMissionIdStr);
    }
  };
  
  // 뒤로가기: 서브미션 → 미션 목록
  const handleBackToThemeMissions = () => {
    setSelectedThemeMission(null);
    setSelectedSubMission(null);
    if (onMissionSelect) {
      onMissionSelect(null);
    } else {
      setInternalMissionId(null);
    }
  };
  
  // 뒤로가기: 제출 목록 → 서브미션 목록
  const handleBackToSubMissions = () => {
    setSelectedSubMission(null);
    if (onSubmissionSelect) {
      onSubmissionSelect(null);
    } else {
      setInternalSubmissionId(null);
    }
  };
  
  // URL 파라미터 변경 시 선택 해제만 처리 (데이터는 API 응답 후 업데이트)
  useEffect(() => {
    if (!currentMissionId) {
      setSelectedThemeMission(null);
      setSelectedSubMission(null);
    }
  }, [currentMissionId]);
  
  useEffect(() => {
    if (!currentSubmissionId) {
      setSelectedSubMission(null);
    }
  }, [currentSubmissionId]);

  // ⚠️ CRITICAL: 별도의 캐시 키 사용하여 useAuth 캐시 오염 방지
  const { data: authResponse } = useQuery<any>({ 
    queryKey: ['/api/admin/auth-check'],  // 다른 키 사용!
    queryFn: async () => {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      if (!response.ok) return null;
      return response.json();
    }
  });
  const user = authResponse?.user || authResponse;
  const { data: hospitals = [] } = useQuery<any[]>({ queryKey: ['/api/hospitals'] });
  const isSuperAdmin = user?.memberType === 'superadmin';
  
  const hospitalFilter = isSuperAdmin ? "all" : (user?.hospitalId?.toString() || "all");
  const [selectedHospitalFilter, setSelectedHospitalFilter] = useState<string>("all");
  const effectiveHospitalFilter = isSuperAdmin ? selectedHospitalFilter : hospitalFilter;

  const { data: stats, isLoading: statsLoading } = useQuery<any>({
    queryKey: ['/api/admin/review/stats', effectiveHospitalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveHospitalFilter !== 'all') {
        params.set('hospitalId', effectiveHospitalFilter);
      }
      const response = await fetch(`/api/admin/review/stats?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('통계 조회 실패');
      return response.json();
    },
    enabled: !!user,
  });

  // 폴더 데이터 가져오기
  const { data: missionFolders = [] } = useQuery<MissionFolder[]>({
    queryKey: ['/api/admin/mission-folders'],
    enabled: !!user,
  });

  // 폴더 isCollapsed 상태를 DB 값으로 초기화 (첫 로드 시에만)
  useEffect(() => {
    if (missionFolders.length > 0 && !hasInitializedCollapsed) {
      const collapsedIds = new Set<number | 'uncategorized'>();
      missionFolders.forEach((folder) => {
        if (folder.isCollapsed) {
          collapsedIds.add(folder.id);
        }
      });
      setCollapsedFolderIds(collapsedIds);
      setHasInitializedCollapsed(true);
    }
  }, [missionFolders, hasInitializedCollapsed]);

  // 항상 themeMissions 로드 (브레드크럼 표시를 위해 필요)
  const { data: themeMissions = [], isLoading: themeMissionsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/review/theme-missions', effectiveHospitalFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (effectiveHospitalFilter !== 'all') {
        params.set('hospitalId', effectiveHospitalFilter);
      }
      const response = await fetch(`/api/admin/review/theme-missions?${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('주제 미션 조회 실패');
      return response.json();
    },
    enabled: !!user,
  });

  // themeMissions를 폴더별로 그룹화 (폴더 order 순서 → 미션 order 순서, 미분류는 마지막)
  const groupedThemeMissions = useMemo(() => {
    if (!themeMissions.length) return [];

    const sortedFolders = [...missionFolders].sort((a, b) => a.order - b.order);
    const groups: Array<{ folder: MissionFolder | null; missions: any[] }> = [];

    // 폴더별 미션 그룹화
    for (const folder of sortedFolders) {
      const folderMissions = themeMissions
        .filter((m: any) => m.folderId === folder.id)
        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      if (folderMissions.length > 0) {
        groups.push({ folder, missions: folderMissions });
      }
    }

    // 미분류 미션 (folderId: null)은 마지막에
    const uncategorizedMissions = themeMissions
      .filter((m: any) => m.folderId === null || m.folderId === undefined)
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    if (uncategorizedMissions.length > 0) {
      groups.push({ folder: null, missions: uncategorizedMissions });
    }

    return groups;
  }, [themeMissions, missionFolders]);
  
  // themeMissions 로드 후 selectedThemeMission 정보 업데이트
  useEffect(() => {
    if (currentMissionId && themeMissions.length > 0) {
      const foundMission = themeMissions.find((m: any) => m.missionId === currentMissionId);
      if (foundMission && selectedThemeMission?.id !== foundMission.id) {
        setSelectedThemeMission({
          id: foundMission.id,
          missionId: foundMission.missionId,
          title: foundMission.title
        });
      }
    }
  }, [currentMissionId, themeMissions]);

  const { data: subMissions = [], isLoading: subMissionsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/review/theme-missions', selectedThemeMission?.missionId || currentMissionId, 'sub-missions'],
    queryFn: async () => {
      const missionId = selectedThemeMission?.missionId || currentMissionId;
      if (!missionId) return [];
      const response = await apiRequest(`/api/admin/review/theme-missions/${missionId}/sub-missions`);
      return await response.json();
    },
    enabled: !!(selectedThemeMission?.missionId || currentMissionId),
  });
  
  // subMissions 로드 후 selectedSubMission 정보 업데이트
  useEffect(() => {
    if (currentSubmissionId && subMissions.length > 0) {
      const foundSubMission = subMissions.find((s: any) => s.id.toString() === currentSubmissionId);
      if (foundSubMission && selectedSubMission?.id !== foundSubMission.id) {
        setSelectedSubMission({
          id: foundSubMission.id,
          title: foundSubMission.title
        });
      }
    }
  }, [currentSubmissionId, subMissions]);

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/review/submissions', selectedSubMission?.id || currentSubmissionId, statusFilter],
    queryFn: async () => {
      const subMissionId = selectedSubMission?.id?.toString() || currentSubmissionId;
      if (!subMissionId) return [];
      const params = new URLSearchParams({
        subMissionId: subMissionId,
        ...(statusFilter !== 'all' && { status: statusFilter }),
      });
      const response = await fetch(`/api/admin/review/submissions?${params}`);
      if (!response.ok) throw new Error('제출 내역 조회 실패');
      return response.json();
    },
    enabled: !!(selectedSubMission?.id || currentSubmissionId),
  });

  const approveMutation = useMutation({
    mutationFn: (submissionId: number) =>
      apiRequest(`/api/admin/review/submissions/${submissionId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ reviewerNote: reviewNotes })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/theme-missions'] });
      toast({ title: "승인되었습니다" });
      setSelectedSubmission(null);
      setReviewNotes("");
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (submissionId: number) =>
      apiRequest(`/api/admin/review/submissions/${submissionId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewerNote: reviewNotes })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/review/theme-missions'] });
      toast({ title: "보류되었습니다" });
      setSelectedSubmission(null);
      setReviewNotes("");
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
  });

  const handleApprove = () => {
    if (selectedSubmission) {
      approveMutation.mutate(selectedSubmission.id);
    }
  };

  const handleReject = () => {
    if (!reviewNotes.trim()) {
      toast({ title: "보류 사유를 입력하세요", variant: "destructive" });
      return;
    }
    if (selectedSubmission) {
      rejectMutation.mutate(selectedSubmission.id);
    }
  };


  const getSubmissionTypeLabel = (type: string) => {
    const types: Record<string, string> = {
      file: '파일',
      link: '링크',
      text: '텍스트',
      review: '검수',
      image: '이미지',
      studio_submit: '제작소',
      attendance: '출석인증'
    };
    return types[type] || type;
  };

  const isImageMimeType = (mimeType: string) => {
    if (!mimeType) return false;
    return mimeType.startsWith('image/');
  };

  const handleDownloadImage = async (url: string) => {
    try {
      // fetch로 이미지를 blob으로 받아옴
      const response = await fetch(url);
      const blob = await response.blob();
      
      // blob URL 생성
      const blobUrl = window.URL.createObjectURL(blob);
      
      // 다운로드 링크 생성
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = url.split('/').pop()?.split('?')[0] || 'image.webp';
      document.body.appendChild(link);
      link.click();
      
      // 정리
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('다운로드 실패:', error);
      // 실패 시 새 탭으로 열기 (백업)
      window.open(url, '_blank');
    }
  };

  const handlePrintImage = (url: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>인쇄</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;">
            <img src="${url}" style="max-width:100%;height:auto;" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  const renderSubmissionContent = (submissionData: any) => {
    if (!submissionData) {
      return <p className="text-muted-foreground">제출 내용이 없습니다</p>;
    }

    // 슬롯 배열이 있으면 슬롯별로 표시
    if (submissionData.slots && Array.isArray(submissionData.slots) && submissionData.slots.length > 0) {
      const slots = submissionData.slots;
      const submissionTypes = submissionData.submissionTypes || [];
      const filledCount = submissionData.filledSlotsCount || slots.filter((s: any) => 
        s.fileUrl || s.imageUrl || s.linkUrl || s.textContent || s.rating
      ).length;
      const totalCount = submissionData.totalSlotsCount || slots.length;

      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">제출 현황</Label>
            <Badge variant={filledCount === totalCount ? "default" : "secondary"}>
              {filledCount}/{totalCount} 완료
            </Badge>
          </div>
          
          <div className="grid gap-4">
            {slots.map((slot: any, index: number) => {
              const slotType = submissionTypes[index] || 'unknown';
              const displayUrl = slot.imageUrl || slot.fileUrl;
              const isImage = slotType === 'image' || (slot.mimeType ? isImageMimeType(slot.mimeType) : false);
              const hasContent = displayUrl || slot.linkUrl || slot.textContent || slot.rating;
              
              const typeLabels: Record<string, string> = {
                file: '파일',
                image: '이미지',
                link: '링크',
                text: '텍스트',
                review: '리뷰',
                studio_submit: '제작소'
              };

              return (
                <Card key={index} className={`p-3 ${hasContent ? 'bg-muted/30' : 'bg-muted/10 border-dashed'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium">
                      {typeLabels[slotType] || slotType} {slots.length > 1 ? `#${index + 1}` : ''}
                    </Label>
                    {hasContent ? (
                      <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/30">
                        <Check className="h-3 w-3 mr-1" />
                        제출됨
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        미제출
                      </Badge>
                    )}
                  </div>
                  
                  {displayUrl && isImage && (
                    <div 
                      className="relative w-full aspect-video rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => modal.open('imageViewer', { imageUrl: displayUrl })}
                    >
                      <img 
                        src={displayUrl} 
                        alt={`제출 이미지 ${index + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-muted');
                          const errorText = document.createElement('span');
                          errorText.className = 'text-sm text-muted-foreground';
                          errorText.textContent = '이미지 로드 실패';
                          target.parentElement?.appendChild(errorText);
                        }}
                      />
                    </div>
                  )}
                  
                  {displayUrl && !isImage && (
                    <a 
                      href={displayUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:underline break-all"
                    >
                      {slot.fileName || displayUrl}
                    </a>
                  )}
                  
                  {slot.linkUrl && (
                    <a 
                      href={slot.linkUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="block text-sm text-blue-600 hover:underline break-all"
                    >
                      {slot.linkUrl}
                    </a>
                  )}
                  
                  {slot.textContent && (
                    <p className="text-sm whitespace-pre-wrap bg-background/50 p-2 rounded">
                      {slot.textContent}
                    </p>
                  )}
                  
                  {slot.rating !== undefined && slot.rating !== null && (
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <Heart
                          key={i}
                          className={`h-4 w-4 ${
                            i < slot.rating
                              ? 'fill-pink-500 text-pink-500'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                      <span className="ml-1 text-xs text-muted-foreground">{slot.rating}/5</span>
                    </div>
                  )}
                  
                  {slot.memo && (
                    <p className="text-xs text-muted-foreground mt-1">{slot.memo}</p>
                  )}
                  
                  {!hasContent && (
                    <p className="text-sm text-muted-foreground italic">내용 없음</p>
                  )}
                </Card>
              );
            })}
          </div>
          
          {submissionData?.studioProjectId && (
            <div className="space-y-3 mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4" />
                <span className="font-medium">제작소 제출</span>
              </div>
              {submissionData.studioPreviewUrl && (
                <div 
                  className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => modal.open('imageViewer', { imageUrl: submissionData.studioPreviewUrl })}
                >
                  <img 
                    src={submissionData.studioPreviewUrl} 
                    alt={submissionData.studioProjectTitle || '제작소 작업물'} 
                    className="object-cover w-full h-full"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      target.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-muted');
                      const errorText = document.createElement('span');
                      errorText.className = 'text-sm text-muted-foreground';
                      errorText.textContent = '미리보기 로드 실패';
                      target.parentElement?.appendChild(errorText);
                    }}
                  />
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                작업물: {submissionData.studioProjectTitle || '제목 없음'}
              </div>
              {submissionData.studioPdfUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(submissionData.studioPdfUrl, '_blank')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF 다운로드
                </Button>
              )}
            </div>
          )}
        </div>
      );
    }

    // 레거시 단일 데이터 처리
    const { submissionType, fileUrl, linkUrl, textContent, rating, memo, imageUrl, mimeType } = submissionData;
    const displayUrl = fileUrl || imageUrl;
    const isImage = submissionType === 'image' || (mimeType ? isImageMimeType(mimeType) : false);

    return (
      <div className="space-y-3">
        {displayUrl && isImage && (
          <div>
            <Label className="text-xs text-muted-foreground">
              {submissionType === 'image' ? '이미지' : '파일 (이미지)'}
            </Label>
            <div 
              className="relative w-full aspect-video rounded-lg overflow-hidden border cursor-pointer hover:opacity-90 transition-opacity mt-2"
              onClick={() => modal.open('imageViewer', { imageUrl: displayUrl })}
            >
              <img 
                src={displayUrl} 
                alt="제출 이미지"
                className="w-full h-full object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                  target.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-muted');
                  const errorText = document.createElement('span');
                  errorText.className = 'text-sm text-muted-foreground';
                  errorText.textContent = '이미지 로드 실패';
                  target.parentElement?.appendChild(errorText);
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              클릭하여 크게 보기
            </p>
          </div>
        )}
        
        {displayUrl && !isImage && (
          <div>
            <Label className="text-xs text-muted-foreground">파일</Label>
            <a 
              href={displayUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-sm text-blue-600 hover:underline break-all mt-1"
            >
              {displayUrl}
            </a>
            <p className="text-xs text-muted-foreground mt-1">
              파일을 다운로드하려면 링크를 클릭하세요
            </p>
          </div>
        )}
        
        {linkUrl && (
          <div>
            <Label className="text-xs text-muted-foreground">링크 URL</Label>
            <a 
              href={linkUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-sm text-blue-600 hover:underline break-all mt-1"
            >
              {linkUrl}
            </a>
          </div>
        )}
        
        {textContent && (
          <div>
            <Label className="text-xs text-muted-foreground">텍스트 내용</Label>
            <p className="text-sm whitespace-pre-wrap bg-muted/30 p-3 rounded-md mt-1">
              {textContent}
            </p>
          </div>
        )}
        
        {rating !== undefined && rating !== null && (
          <div>
            <Label className="text-xs text-muted-foreground">별점</Label>
            <div className="flex items-center gap-1 mt-1">
              {Array.from({ length: 5 }, (_, i) => (
                <Heart
                  key={i}
                  className={`h-5 w-5 ${
                    i < rating
                      ? 'fill-pink-500 text-pink-500'
                      : 'text-gray-300'
                  }`}
                />
              ))}
              <span className="ml-2 text-sm font-medium">{rating}/5</span>
            </div>
          </div>
        )}
        
        {memo && (
          <div>
            <Label className="text-xs text-muted-foreground">메모</Label>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
              {memo}
            </p>
          </div>
        )}
        
        {submissionData?.studioProjectId && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="font-medium">제작소 제출</span>
            </div>
            {submissionData.studioPreviewUrl && (
              <div 
                className="relative aspect-video w-full max-w-md overflow-hidden rounded-lg border cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => modal.open('imageViewer', { imageUrl: submissionData.studioPreviewUrl })}
              >
                <img 
                  src={submissionData.studioPreviewUrl} 
                  alt={submissionData.studioProjectTitle || '제작소 작업물'} 
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    target.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-muted');
                    const errorText = document.createElement('span');
                    errorText.className = 'text-sm text-muted-foreground';
                    errorText.textContent = '미리보기 로드 실패';
                    target.parentElement?.appendChild(errorText);
                  }}
                />
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              작업물: {submissionData.studioProjectTitle || '제목 없음'}
            </div>
            {submissionData.studioPdfUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(submissionData.studioPdfUrl, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                다운로드
              </Button>
            )}
          </div>
        )}
      </div>
    );
  };

  const navigateToThemeMissions = () => {
    handleBackToThemeMissions();
  };

  const navigateToSubMissions = (themeMission?: {id: number, missionId: string, title: string}) => {
    if (themeMission) {
      handleThemeMissionSelect(themeMission);
    } else if (selectedThemeMission) {
      // 현재 선택된 미션의 서브미션 목록으로 이동 (submission 파라미터만 해제)
      handleSubMissionSelect(null);
    }
  };

  const navigateToSubmissions = (subMission: {id: number, title: string}) => {
    handleSubMissionSelect(subMission);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <div>
            <CardTitle>검수 대시보드</CardTitle>
            <CardDescription>사용자가 제출한 미션을 검수하세요</CardDescription>
          </div>
          {isSuperAdmin && (
            <Select value={selectedHospitalFilter} onValueChange={setSelectedHospitalFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 병원</SelectItem>
                {hospitals.map((hospital: any) => (
                  <SelectItem key={hospital.id} value={hospital.id.toString()}>
                    {hospital.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center justify-between">
          <nav className="flex items-center gap-2 text-sm">
            <button
              onClick={navigateToThemeMissions}
              className={`hover:underline ${currentView === 'theme-missions' ? 'font-semibold' : 'text-muted-foreground'}`}
            >
              검수 대시보드
            </button>
            {selectedThemeMission && (
              <>
                <span className="text-muted-foreground">/</span>
                <button
                  onClick={() => navigateToSubMissions()}
                  className={`hover:underline ${currentView === 'sub-missions' ? 'font-semibold' : 'text-muted-foreground'}`}
                >
                  {selectedThemeMission.title}
                </button>
              </>
            )}
            {selectedSubMission && (
              <>
                <span className="text-muted-foreground">/</span>
                <span className="font-semibold">{selectedSubMission.title}</span>
              </>
            )}
          </nav>

          {currentView === 'submissions' && (
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="submitted">검수 대기</SelectItem>
                <SelectItem value="approved">승인</SelectItem>
                <SelectItem value="rejected">보류</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {statsLoading ? (
          <div className="text-center py-4">통계 로딩 중...</div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>검수 대기</CardDescription>
                <CardTitle className="text-3xl text-orange-500">
                  {stats?.pending || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>승인</CardDescription>
                <CardTitle className="text-3xl text-green-500">
                  {stats?.approved || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>보류</CardDescription>
                <CardTitle className="text-3xl text-red-500">
                  {stats?.rejected || 0}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>전체</CardDescription>
                <CardTitle className="text-3xl">
                  {stats?.total || 0}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>
        )}

        {currentView === 'theme-missions' && (
          <>
            {themeMissionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : themeMissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                주제 미션이 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>상태</TableHead>
                    <TableHead>주제미션명</TableHead>
                    <TableHead>카테고리</TableHead>
                    <TableHead className="text-center">세부미션</TableHead>
                    <TableHead>기간</TableHead>
                    <TableHead className="text-center">검수 대기</TableHead>
                    <TableHead className="text-center">승인</TableHead>
                    <TableHead className="text-center">보류</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const renderReviewMissionRow = (mission: any, depth: number = 0): JSX.Element[] => {
                      const periodStatus = getPeriodStatus(mission.startDate, mission.endDate);
                      
                      const statusBadge = periodStatus === 'upcoming' 
                        ? <Badge className="bg-red-500 text-white hover:bg-red-600">준비 중</Badge>
                        : periodStatus === 'closed'
                        ? <Badge variant="destructive">마감</Badge>
                        : <Badge className="bg-blue-500 text-white hover:bg-blue-600">진행 중</Badge>;
                      
                      const rows: JSX.Element[] = [
                        <TableRow 
                          key={mission.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigateToSubMissions({
                            id: mission.id,
                            missionId: mission.missionId,
                            title: mission.title
                          })}
                        >
                          <TableCell>{statusBadge}</TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 20}px` }}>
                              {depth > 0 && <span className="text-muted-foreground">└</span>}
                              {mission.title}
                            </div>
                          </TableCell>
                          <TableCell>
                            {mission.category ? (
                              <Badge variant="outline">{mission.category.name}</Badge>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {mission.subMissions?.length || 0}개
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {mission.startDate && mission.endDate ? (
                              <>
                                {formatSimpleDate(mission.startDate)}
                                {' ~ '}
                                {formatSimpleDate(mission.endDate)}
                              </>
                            ) : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                              {mission.stats?.pending || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              {mission.stats?.approved || 0}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="bg-red-100 text-red-700">
                              {mission.stats?.rejected || 0}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ];

                      if (mission.childMissions && mission.childMissions.length > 0) {
                        for (const child of mission.childMissions) {
                          rows.push(...renderReviewMissionRow(child, depth + 1));
                        }
                      }

                      return rows;
                    };

                    // 폴더별로 그룹화하여 렌더링
                    return groupedThemeMissions.flatMap(({ folder, missions }) => {
                      const folderRows: JSX.Element[] = [];
                      const folderId = folder?.id || 'uncategorized';
                      const isCollapsed = collapsedFolderIds.has(folderId);
                      
                      // 폴더 헤더 행 추가
                      folderRows.push(
                        <TableRow 
                          key={`folder-${folderId}`} 
                          className="bg-muted/30 hover:bg-muted/40 cursor-pointer"
                          onClick={() => toggleFolderCollapse(folderId)}
                        >
                          <TableCell colSpan={8} className="py-2">
                            <div className="flex items-center gap-2">
                              {isCollapsed ? (
                                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              {folder ? (
                                <>
                                  <div
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: folder.color }}
                                  />
                                  <Folder className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{folder.name}</span>
                                </>
                              ) : (
                                <>
                                  <Folder className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium text-muted-foreground">미분류</span>
                                </>
                              )}
                              <Badge variant="secondary" className="ml-1">
                                {missions.length}
                              </Badge>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                      
                      // 폴더가 펼쳐진 상태일 때만 미션들 렌더링
                      if (!isCollapsed) {
                        for (const mission of missions) {
                          folderRows.push(...renderReviewMissionRow(mission, 0));
                        }
                      }
                      
                      return folderRows;
                    });
                  })()}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {currentView === 'sub-missions' && (
          <>
            {subMissionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : subMissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                세부 미션이 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>세부미션명</TableHead>
                    <TableHead>제출 타입</TableHead>
                    <TableHead className="text-center">검수 대기</TableHead>
                    <TableHead className="text-center">승인</TableHead>
                    <TableHead className="text-center">보류</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subMissions.map((subMission: any) => (
                    <TableRow 
                      key={subMission.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigateToSubmissions({
                        id: subMission.id,
                        title: subMission.title
                      })}
                    >
                      <TableCell className="font-medium">{subMission.title}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(subMission.submissionTypes || (subMission.submissionType ? [subMission.submissionType] : [])).map((type: string, idx: number) => (
                            <Badge key={idx} variant="outline">
                              {getSubmissionTypeLabel(type)}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          {subMission.stats?.pending || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-green-100 text-green-700">
                          {subMission.stats?.approved || 0}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="bg-red-100 text-red-700">
                          {subMission.stats?.rejected || 0}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        {currentView === 'submissions' && (
          <>
            {submissionsLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : submissions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                제출 내역이 없습니다
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름 (닉네임)</TableHead>
                    <TableHead>전화번호</TableHead>
                    <TableHead>제출일시</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead>액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submissions.map((submission: any) => (
                    <TableRow key={submission.id}>
                      <TableCell>
                        <div>
                          <span>{submission.user?.fullName || '-'}</span>
                          <span className="text-xs text-gray-500 ml-1">({submission.user?.username || submission.user?.email || '-'})</span>
                        </div>
                      </TableCell>
                      <TableCell>{submission.user?.phoneNumber || '-'}</TableCell>
                      <TableCell>{formatDateTime(submission.submittedAt)}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            submission.status === 'approved' ? 'default' :
                            submission.status === 'rejected' ? 'destructive' :
                            'secondary'
                          }
                        >
                          {submission.status === 'approved' ? '승인' :
                           submission.status === 'rejected' ? '보류' :
                           '검수 대기'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSubmission(submission)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          검수
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}

        <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>제출 내용 검수</DialogTitle>
              <DialogDescription>
                사용자가 제출한 내용을 확인하고 승인 또는 보류하세요
              </DialogDescription>
            </DialogHeader>
            {selectedSubmission && (
              <div className="space-y-4 overflow-y-auto flex-1 pr-2">
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">사용자</Label>
                    <p className="font-medium">
                      <span>{selectedSubmission.user?.fullName || '-'}</span>
                      <span className="text-sm text-gray-500 ml-1">({selectedSubmission.user?.username || selectedSubmission.user?.email || '-'})</span>
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">전화번호</Label>
                    <p className="font-medium">{selectedSubmission.user?.phoneNumber || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">제출일시</Label>
                    <p className="font-medium">{formatDateTime(selectedSubmission.submittedAt)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">상태</Label>
                    <p className="font-medium">
                      {selectedSubmission.status === 'approved' ? '승인' :
                       selectedSubmission.status === 'rejected' ? '보류' : '검수 대기'}
                    </p>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">주제 미션</Label>
                  <p className="font-medium">{selectedThemeMission?.title || '-'}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">세부 미션</Label>
                  <p className="font-medium">{selectedSubMission?.title || '-'}</p>
                  {selectedSubmission.subMission?.description && (
                    <div 
                      className="text-sm text-muted-foreground mt-1"
                      dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedSubmission.subMission.description) }}
                    />
                  )}
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">제출 내용</Label>
                  <Card className="mt-2 p-4 bg-muted/50">
                    {renderSubmissionContent(selectedSubmission.submissionData)}
                  </Card>
                </div>
                <div>
                  <Label htmlFor="review-notes">검수 의견 (선택)</Label>
                  <Textarea
                    id="review-notes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="검수 의견을 입력하세요..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => setSelectedSubmission(null)}>
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={rejectMutation.isPending}
              >
                {rejectMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                보류
              </Button>
              <Button
                onClick={handleApprove}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                승인
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </CardContent>
    </Card>
  );
}

// 메인 컴포넌트
interface MissionManagementProps {
  activeSubTab?: string;
  onSubTabChange?: (tab: string) => void;
  activeMissionId?: string | null;
  activeSubmissionId?: string | null;
  onMissionSelect?: (missionId: string | null) => void;
  onSubmissionSelect?: (submissionId: string | null, missionId?: string | null) => void;
}

export default function MissionManagement({ 
  activeSubTab, 
  onSubTabChange,
  activeMissionId,
  activeSubmissionId,
  onMissionSelect,
  onSubmissionSelect
}: MissionManagementProps) {
  // URL 기반 탭 상태 관리 (props가 없으면 내부 상태 사용)
  const [internalTab, setInternalTab] = useState('categories');
  
  const currentTab = activeSubTab || internalTab;
  const handleTabChange = (tab: string) => {
    if (onSubTabChange) {
      onSubTabChange(tab);
    } else {
      setInternalTab(tab);
    }
  };
  
  return (
    <div className="w-full space-y-6">
      <h2 className="text-2xl font-bold">미션 시스템 관리</h2>
      
      <Tabs value={currentTab || 'categories'} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="categories">카테고리</TabsTrigger>
          <TabsTrigger value="action-types">액션 타입 관리</TabsTrigger>
          <TabsTrigger value="missions">주제 미션</TabsTrigger>
          <TabsTrigger value="review">검수 대기</TabsTrigger>
        </TabsList>
        
        <TabsContent value="categories" className="mt-6">
          <MissionCategoryManagement />
        </TabsContent>
        
        <TabsContent value="action-types" className="mt-6">
          <ActionTypeManagement />
        </TabsContent>
        
        <TabsContent value="missions" className="mt-6">
          <ThemeMissionManagement />
        </TabsContent>
        
        <TabsContent value="review" className="mt-6">
          <ReviewDashboard 
            activeMissionId={activeMissionId}
            activeSubmissionId={activeSubmissionId}
            onMissionSelect={onMissionSelect}
            onSubmissionSelect={onSubmissionSelect}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
