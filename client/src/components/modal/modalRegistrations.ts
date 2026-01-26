import { registerModal } from './ModalRegistry';
import { TestModal } from './TestModal';
import { lazy } from 'react';

const FolderModal = lazy(() => import('./admin/FolderModal').then(m => ({ default: m.FolderModal })));
const ActionTypeModal = lazy(() => import('./admin/ActionTypeModal').then(m => ({ default: m.ActionTypeModal })));
const DeleteConfirmModal = lazy(() => import('./common/DeleteConfirmModal').then(m => ({ default: m.DeleteConfirmModal })));
const CategoryModal = lazy(() => import('./admin/CategoryModal').then(m => ({ default: m.CategoryModal })));
const ThemeMissionModal = lazy(() => import('./admin/ThemeMissionModal').then(m => ({ default: m.ThemeMissionModal })));
const SubMissionModal = lazy(() => import('./admin/SubMissionModal').then(m => ({ default: m.SubMissionModal })));
const TemplatePickerModal = lazy(() => import('./admin/TemplatePickerModal').then(m => ({ default: m.TemplatePickerModal })));
const ApprovedUsersModal = lazy(() => import('./admin/ApprovedUsersModal').then(m => ({ default: m.ApprovedUsersModal })));
const SubmissionDetailModal = lazy(() => import('./admin/SubmissionDetailModal').then(m => ({ default: m.SubmissionDetailModal })));
const ImageViewerModal = lazy(() => import('./common/ImageViewerModal').then(m => ({ default: m.ImageViewerModal })));

export function initializeModalRegistry() {
  registerModal('test', TestModal);
  
  registerModal('folder', FolderModal, { lazy: true });
  registerModal('actionType', ActionTypeModal, { lazy: true });
  registerModal('deleteConfirm', DeleteConfirmModal, { lazy: true });
  registerModal('category', CategoryModal, { lazy: true });
  registerModal('themeMission', ThemeMissionModal, { lazy: true });
  registerModal('subMission', SubMissionModal, { lazy: true });
  registerModal('templatePicker', TemplatePickerModal, { lazy: true });
  registerModal('approvedUsers', ApprovedUsersModal, { lazy: true });
  registerModal('submissionDetail', SubmissionDetailModal, { lazy: true });
  registerModal('imageViewer', ImageViewerModal, { lazy: true });
}
