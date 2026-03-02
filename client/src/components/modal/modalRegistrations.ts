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
const SubMissionFormModal = lazy(() => import('./admin/SubMissionFormModal').then(m => ({ default: m.default })));
const ChildMissionModal = lazy(() => import('./admin/ChildMissionModal').then(m => ({ default: m.ChildMissionModal })));
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
const ConceptFormModal = lazy(() => import('./admin/ConceptFormModal').then(m => ({ default: m.ConceptFormModal })));
const SnapshotPromptModal = lazy(() => import('./admin/SnapshotPromptModal').then(m => ({ default: m.default })));
const PopularStyleFormModal = lazy(() => import('./admin/PopularStyleFormModal').then(m => ({ default: m.default })));
const PhotobookTemplateFormModal = lazy(() => import('./admin/PhotobookTemplateFormModal').then(m => ({ default: m.PhotobookTemplateFormModal })));
const PhotobookMaterialCategoryFormModal = lazy(() => import('./admin/PhotobookMaterialCategoryFormModal').then(m => ({ default: m.PhotobookMaterialCategoryFormModal })));
const PhotobookIconFormModal = lazy(() => import('./admin/PhotobookIconFormModal').then(m => ({ default: m.PhotobookIconFormModal })));
const MusicPromptModal = lazy(() => import('./admin/MusicPromptModal').then(m => ({ default: m.MusicPromptModal })));
const BigMissionFormModal = lazy(() => import('./admin/BigMissionModals').then(m => ({ default: m.BigMissionFormModal })));
const BigMissionTopicSheet = lazy(() => import('./admin/BigMissionModals').then(m => ({ default: m.BigMissionTopicSheet })));
const BigMissionTopicFormModal = lazy(() => import('./admin/BigMissionModals').then(m => ({ default: m.BigMissionTopicFormModal })));
const GlobalRuleModal = lazy(() => import('./admin/GlobalRuleModal').then(m => ({ default: m.GlobalRuleModal })));
const ReviewDetailModal = lazy(() => import('./hospital/ReviewDetailModal').then(m => ({ default: m.ReviewDetailModal })));
const CampaignMilestoneDetailModal = lazy(() => import('./user/CampaignMilestoneDetailModal').then(m => ({ default: m.CampaignMilestoneDetailModal })));
const MilestoneCompleteModal = lazy(() => import('./user/MilestoneCompleteModal').then(m => ({ default: m.MilestoneCompleteModal })));
const MilestoneNoteDetailModal = lazy(() => import('./user/MilestoneNoteDetailModal').then(m => ({ default: m.MilestoneNoteDetailModal })));
const MilestoneProfileSetupModal = lazy(() => import('./user/MilestoneProfileSetupModal').then(m => ({ default: m.MilestoneProfileSetupModal })));

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
const CancelApplicationConfirmModalLazy = lazy(() => import('./user/CancelApplicationConfirmModal').then(m => ({ default: m.CancelApplicationConfirmModal })));
const SnapshotGenerationModalLazy = lazy(() => import('./user/SnapshotGenerationModal').then(m => ({ default: m.SnapshotGenerationModal })));
const DreamBookCharacterModalLazy = lazy(() => import('./user/DreamBookCharacterModal').then(m => ({ default: m.CharacterGenerationModal })));

// 병원 코드 관리 모달
const CreateHospitalCodeModalLazy = lazy(() => import('./admin/CreateHospitalCodeModal').then(m => ({ default: m.CreateHospitalCodeModal })));
const EditHospitalCodeModalLazy = lazy(() => import('./admin/EditHospitalCodeModal').then(m => ({ default: m.EditHospitalCodeModal })));
const QrPreviewModalLazy = lazy(() => import('./admin/QrPreviewModal').then(m => ({ default: m.QrPreviewModal })));

export function initializeModalRegistry() {
  registerModal('test', TestModal);

  registerModal('folder', FolderModal, { lazy: true });
  registerModal('actionType', ActionTypeModal, { lazy: true });
  registerModal('deleteConfirm', DeleteConfirmModal, { lazy: true });
  registerModal('category', CategoryModal, { lazy: true });
  registerModal('themeMission', ThemeMissionModal, { lazy: true });
  registerModal('subMission', SubMissionModal, { lazy: true });
  registerModal('subMissionForm', SubMissionFormModal, { lazy: true });
  registerModal('childMission', ChildMissionModal, { lazy: true });
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
  registerModal('snapshotPrompt', SnapshotPromptModal, { lazy: true });
  registerModal('popularStyleForm', PopularStyleFormModal, { lazy: true });
  registerModal('photobookTemplateForm', PhotobookTemplateFormModal, { lazy: true });
  registerModal('photobookMaterialCategoryForm', PhotobookMaterialCategoryFormModal, { lazy: true });
  registerModal('photobookIconForm', PhotobookIconFormModal, { lazy: true });
  registerModal('conceptForm', ConceptFormModal, { lazy: true });
  registerModal('musicPrompt', MusicPromptModal, { lazy: true });
  registerModal('bigMissionForm', BigMissionFormModal, { lazy: true });
  registerModal('bigMissionTopicSheet', BigMissionTopicSheet, { lazy: true });
  registerModal('bigMissionTopicForm', BigMissionTopicFormModal, { lazy: true });
  registerModal('globalRuleForm', GlobalRuleModal, { lazy: true });
  registerModal('hospitalForm', HospitalFormModal, { lazy: true });
  registerModal('reviewDetail', ReviewDetailModal, { lazy: true });
  registerModal('campaignMilestoneDetail', CampaignMilestoneDetailModal, { lazy: true });
  registerModal('milestoneComplete', MilestoneCompleteModal, { lazy: true });
  registerModal('milestoneNoteDetail', MilestoneNoteDetailModal, { lazy: true });
  registerModal('milestoneProfileSetup', MilestoneProfileSetupModal, { lazy: true });

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
  registerModal('cancelApplicationConfirm', CancelApplicationConfirmModalLazy, { lazy: true });
  registerModal('snapshotGeneration', SnapshotGenerationModalLazy, { lazy: true });
  registerModal('dreamBookCharacter', DreamBookCharacterModalLazy, { lazy: true });
  registerModal('createHospitalCode', CreateHospitalCodeModalLazy, { lazy: true });
  registerModal('editHospitalCode', EditHospitalCodeModalLazy, { lazy: true });
  registerModal('qrPreview', QrPreviewModalLazy, { lazy: true });
}
