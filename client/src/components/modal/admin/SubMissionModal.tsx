import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useModal } from '@/hooks/useModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { sanitizeHtml } from '@/lib/utils';
import {
  Loader2,
  Plus,
  GripVertical,
  Upload,
  ImagePlus,
  Globe,
  FileText,
  MessageSquare,
  Palette,
  CheckSquare,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';

// Sortable Sub-Mission Item for drag-and-drop reordering
interface SortableSubMissionItemProps {
  subMission: any;
  getSubmissionTypeIcon: (type: string) => React.ReactNode;
  getSubmissionTypeName: (type: string) => string;
  toggleActiveMutation: any;
  handleOpenDialog: (subMission?: any) => void;
  deleteSubMissionMutation: any;
  modal: ReturnType<typeof useModal>;
}

function SortableSubMissionItem({
  subMission,
  getSubmissionTypeIcon,
  getSubmissionTypeName,
  toggleActiveMutation,
  handleOpenDialog,
  deleteSubMissionMutation,
  modal,
}: SortableSubMissionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `submission-${subMission.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? "z-50 shadow-lg" : ""}>
      <CardContent className="pt-4">
        <div className="flex items-center gap-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded touch-none"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </button>

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
  );
}

export interface SubMissionModalProps {
  themeMissionId: number;
  missionId: string; // UUID
  themeMissionTitle: string;
  isOpen?: boolean; // Provided by ModalContext
  onClose?: () => void; // Provided by ModalContext
}

export function SubMissionModal({ themeMissionId, missionId, themeMissionTitle, isOpen = true, onClose = () => { } }: SubMissionModalProps) {
  const queryClient = useQueryClient();
  const modal = useModal();
  const { toast } = useToast();

  const { data: subMissions = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/admin/missions', missionId, 'sub-missions'],
    queryFn: async () => {
      const response = await apiRequest(`/api/admin/missions/${missionId}/sub-missions`);
      return await response.json();
    },
    enabled: isOpen && !!missionId,
  });

  const deleteSubMissionMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/admin/missions/${missionId}/sub-missions/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
      toast({ title: "세부 미션이 삭제되었습니다" });
      modal.close(); // Close delete confirm modal
    },
    onError: (error: any) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
      modal.close(); // Close delete confirm modal
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

  // DnD sensors for drag-and-drop reordering
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor)
  );

  // Handle drag end for reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = subMissions.findIndex((sm: any) => `submission-${sm.id}` === active.id);
    const newIndex = subMissions.findIndex((sm: any) => `submission-${sm.id}` === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newOrder = arrayMove(subMissions, oldIndex, newIndex);
    const newOrderIds = newOrder.map((sm: any) => sm.id);

    reorderMutation.mutate(newOrderIds);
  };

  // Helper functions for display
  const getSubmissionTypeIcon = (type: string) => {
    switch (type) {
      case "file": return <Upload className="h-3 w-3" />;
      case "image": return <ImagePlus className="h-3 w-3" />;
      case "link": return <Globe className="h-3 w-3" />;
      case "text": return <FileText className="h-3 w-3" />;
      case "review": return <MessageSquare className="h-3 w-3" />;
      case "studio_submit": return <Palette className="h-3 w-3" />;
      case "attendance": return <CheckSquare className="h-3 w-3" />;
      default: return <FileText className="h-3 w-3" />;
    }
  };

  const getSubmissionTypeName = (type: string) => {
    switch (type) {
      case "file": return "파일";
      case "image": return "이미지";
      case "link": return "링크";
      case "text": return "텍스트";
      case "review": return "리뷰";
      case "studio_submit": return "제작소";
      case "attendance": return "출석";
      default: return type;
    }
  };

  const handleOpenDialog = (subMission?: any) => {
    modal.open('subMissionForm', {
      missionId,
      editingSubMission: subMission, // null implies create mode
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['/api/admin/missions', missionId, 'sub-missions'] });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full sm:max-w-3xl overflow-y-auto max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>세부 미션 관리</DialogTitle>
          <DialogDescription>
            {themeMissionTitle}의 세부 미션을 설정합니다
          </DialogDescription>
        </DialogHeader>

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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={subMissions.map((sm: any) => `submission-${sm.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {subMissions.map((subMission: any) => (
                    <SortableSubMissionItem
                      key={subMission.id}
                      subMission={subMission}
                      getSubmissionTypeIcon={getSubmissionTypeIcon}
                      getSubmissionTypeName={getSubmissionTypeName}
                      toggleActiveMutation={toggleActiveMutation}
                      handleOpenDialog={handleOpenDialog}
                      deleteSubMissionMutation={deleteSubMissionMutation}
                      modal={modal}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
