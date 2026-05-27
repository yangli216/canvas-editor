export {
  MedicalRecordDomainService,
  TemplateDocumentStore,
  type IMedicalRecordPostArchiveRevisionFieldDiff,
  type IMedicalRecordPostArchiveRevisionRequest,
  type MedicalRecordPostArchiveRevisionStatus
} from './medical-record-domain-service'
export {
  MedicalRecordDefectDomainService,
  type IMedicalRecordDefectEvent,
  type IMedicalRecordDefectSourceIssue,
  type IMedicalRecordDefectSourceItem,
  type IMedicalRecordQualityDefect,
  type IMedicalRecordTemplateFeedbackSummary,
  type MedicalRecordDefectEventAction,
  type MedicalRecordDefectLevel,
  type MedicalRecordDefectStatus
} from './medical-record-defect-domain-service'
export {
  TemplateDomainService,
  type ITemplateReleaseActionResult,
  type ITemplateAssetMetadata,
  type ITemplateImportResult,
  type ITemplateListItem,
  type IMedicalRecordTemplateFeedbackRecord,
  type ITemplateRegistryEntry,
  type ITemplateReleaseNote,
  type ITemplateTrialRunRecord,
  type ITemplateVersionRecord,
  type MedicalRecordTemplateFeedbackStatus,
  type TemplatePublishStatus
} from './template-domain-service'