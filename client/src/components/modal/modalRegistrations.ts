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

const ImageDetailModal = lazy(() => import('../ImageDetailModal').then(m => ({ default: m.default })));
const DownloadModal = lazy(() => import('../DownloadModal').then(m => ({ default: m.DownloadModal })));
const SaveChatDialog = lazy(() => import('../SaveChatDialog').then(m => ({ default: m.default })));
const UnsavedChangesDialog = lazy(() => import('../common/UnsavedChangesDialog').then(m => ({ default: m.UnsavedChangesDialog })));
const ImagePreviewDialog = lazy(() => import('../common/ImagePreviewDialog').then(m => ({ default: m.ImagePreviewDialog })));
const UserDetailDialog = lazy(() => import('../dialogs/UserDetailDialog').then(m => ({ default: m.default })));
const UserDeleteConfirmDialog = lazy(() => import('../dialogs/UserDeleteConfirmDialog').then(m => ({ default: m.default })));
const MaterialPickerModal = lazy(() => import('../photobook-v2/MaterialPickerModal').then(m => ({ default: m.default })));
const ImageExtractorModal = lazy(() => import('../ImageExtractor/ImageExtractorModal').then(m => ({ default: m.default })));

const PersonaModal = lazy(() => import('./admin/PersonaModal').then(m => ({ default: m.PersonaModal })));
const PersonaCategoryModal = lazy(() => import('./admin/PersonaCategoryModal').then(m => ({ default: m.PersonaCategoryModal })));
const BatchImportModal = lazy(() => import('./admin/BatchImportModal').then(m => ({ default: m.BatchImportModal })));
const ConceptCategoryModal = lazy(() => import('./admin/ConceptCategoryModal').then(m => ({ default: m.ConceptCategoryModal })));
const ApplicationDetailModal = lazy(() => import('./admin/ApplicationDetailModal').then(m => ({ default: m.ApplicationDetailModal })));
const PromptVariableModal = lazy(() => import('./admin/PromptVariableModal').then(m => ({ default: m.PromptVariableModal })));

const BannerFormModal = lazy(() => import('./admin/BannerFormModal').then(m => ({ default: m.BannerFormModal })));
const MilestoneFormModal = lazy(() => import('./admin/MilestoneFormModal').then(m => ({ default: m.MilestoneFormModal })));
const CategoryFormModal = lazy(() => import('./admin/CategoryFormModal').then(m => ({ default: m.CategoryFormModal })));
const ServiceItemFormModal = lazy(() => import('./admin/ServiceItemFormModal').then(m => ({ default: m.ServiceItemFormModal })));
const StyleCardFormModal = lazy(() => import('./admin/StyleCardFormModal').then(m => ({ default: m.StyleCardFormModal })));
const SmallBannerFormModal = lazy(() => import('./admin/SmallBannerFormModal').then(m => ({ default: m.SmallBannerFormModal })));
const HospitalFormModal = lazy(() => import('./admin/HospitalFormModal').then(m => ({ default: m.HospitalFormModal })));
const CampaignMilestoneFormModal = lazy(() => import('./admin/CampaignMilestoneFormModal').then(m => ({ default: m.CampaignMilestoneFormModal })));
const ConceptPickerDialogModal = lazy(() => import('./admin/ConceptPickerDialogModal').then(m => ({ default: m.ConceptPickerDialogModal })));

const SubMissionDetailModalLazy = lazy(() => import('./user/SubMissionDetailModal').then(m => ({ default: m.SubMissionDetailModal })));
const GalleryPickerModalLazy = lazy(() => import('./user/GalleryPickerModal').then(m => ({ default: m.GalleryPickerModal })));
const GiftModalLazy = lazy(() => import('./user/GiftModal').then(m => ({ default: m.GiftModal })));
const StudioPickerModalLazy = lazy(() => import('./user/StudioPickerModal').then(m => ({ default: m.StudioPickerModal })));
const ConfirmModalLazy = lazy(() => import('./user/ConfirmModal').then(m => ({ default: m.ConfirmModal })));
const AutoArrangeConfirmModalLazy = lazy(() => import('./user/AutoArrangeConfirmModal').then(m => ({ default: m.AutoArrangeConfirmModal })));
const GalleryViewerModalLazy = lazy(() => import('./user/GalleryViewerModal').then(m => ({ default: m.GalleryViewerModal })));
const StylePickerModalLazy = lazy(() => import('./user/StylePickerModal').then(m => ({ default: m.StylePickerModal })));
const MilestoneDetailModalLazy = lazy(() => import('./user/MilestoneDetailModal').then(m => ({ default: m.MilestoneDetailModal })));
const MilestoneCompletionModalLazy = lazy(() => import('./user/MilestoneCompletionModal').then(m => ({ default: m.MilestoneCompletionModal })));
const MilestoneNotesModalLazy = lazy(() => import('./user/MilestoneNotesModal').then(m => ({ default: m.MilestoneNotesModal })));

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
  
  registerModal('persona', PersonaModal, { lazy: true });
  registerModal('personaCategory', PersonaCategoryModal, { lazy: true });
  registerModal('batchImport', BatchImportModal, { lazy: true });
  registerModal('conceptCategory', ConceptCategoryModal, { lazy: true });
  registerModal('applicationDetail', ApplicationDetailModal, { lazy: true });
  registerModal('promptVariable', PromptVariableModal, { lazy: true });
  
  registerModal('bannerForm', BannerFormModal, { lazy: true });
  registerModal('milestoneForm', MilestoneFormModal, { lazy: true });
  registerModal('categoryForm', CategoryFormModal, { lazy: true });
  registerModal('serviceItemForm', ServiceItemFormModal, { lazy: true });
  registerModal('styleCardForm', StyleCardFormModal, { lazy: true });
  registerModal('smallBannerForm', SmallBannerFormModal, { lazy: true });
  registerModal('hospitalForm', HospitalFormModal, { lazy: true });
  registerModal('campaignMilestoneForm', CampaignMilestoneFormModal, { lazy: true });
  registerModal('conceptPicker', ConceptPickerDialogModal, { lazy: true });
  
  registerModal('imageDetail', ImageDetailModal, { lazy: true });
  registerModal('download', DownloadModal, { lazy: true });
  registerModal('saveChat', SaveChatDialog, { lazy: true });
  registerModal('unsavedChanges', UnsavedChangesDialog, { lazy: true });
  registerModal('imagePreview', ImagePreviewDialog, { lazy: true });
  registerModal('userDetail', UserDetailDialog, { lazy: true });
  registerModal('userDeleteConfirm', UserDeleteConfirmDialog, { lazy: true });
  registerModal('materialPicker', MaterialPickerModal, { lazy: true });
  registerModal('imageExtractor', ImageExtractorModal, { lazy: true });
  
  registerModal('subMissionDetail', SubMissionDetailModalLazy, { lazy: true });
  registerModal('galleryPicker', GalleryPickerModalLazy, { lazy: true });
  registerModal('giftModal', GiftModalLazy, { lazy: true });
  registerModal('studioPicker', StudioPickerModalLazy, { lazy: true });
  registerModal('resubmitConfirm', ConfirmModalLazy, { lazy: true });
  registerModal('studioSubmitConfirm', ConfirmModalLazy, { lazy: true });
  registerModal('autoArrangeConfirm', AutoArrangeConfirmModalLazy, { lazy: true });
  registerModal('galleryViewer', GalleryViewerModalLazy, { lazy: true });
  registerModal('styleDialog', StylePickerModalLazy, { lazy: true });
  registerModal('milestoneDetail', MilestoneDetailModalLazy, { lazy: true });
  registerModal('milestoneDialog', MilestoneCompletionModalLazy, { lazy: true });
  registerModal('milestoneDetails', MilestoneNotesModalLazy, { lazy: true });
}
