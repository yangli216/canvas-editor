import {
  templateRegistry,
  type ITemplateAssetMetadata,
  type ITemplateImportResult,
  type ITemplateListItem,
  type ITemplateRegistryEntry,
  type ITemplateReleaseNote,
  type ITemplateTrialRunRecord,
  type ITemplateVersionRecord,
  type TemplatePublishStatus
} from '../../../editor/template/TemplateRegistry'
import {
  buildTemplateAdmissionReport,
  type ITemplateAdmissionReport
} from '../../../editor/template/TemplateGovernance'
import { templateDataAdapterRegistry } from '../../../editor/template/TemplateDataAdapter'
import type { ITemplateSchema } from '../../../editor/template'
import type {
  ITemplateDocumentRecord,
  TemplateDocumentStore
} from '../../../editor/template/TemplateDocumentStore'
import type { IMedicalRecordQualityDefect } from './medical-record-defect-domain-service'
import type { IMedicalRecordPostArchiveRevisionRequest } from './medical-record-domain-service'

export interface ITemplateReleaseActionResult {
  applied: boolean
  errors: string[]
}

export type MedicalRecordTemplateFeedbackStatus =
  | 'templateIssue'
  | 'revisionDraft'
  | 'trialRun'
  | 'published'

export interface IMedicalRecordTemplateFeedbackRecord {
  id: string
  defectId: string
  sourceType?: 'qualityDefect' | 'postArchiveRevision'
  sourceId?: string
  documentId: string
  documentTitle: string
  templateId: string
  templateVersion: string
  category: string
  fieldId?: string
  fieldLabel?: string
  message: string
  suggestion: string
  status: MedicalRecordTemplateFeedbackStatus
  statusText: string
  createdAt: number
  updatedAt: number
  revisionDraftVersion?: string
  revisionDraftAt?: number
  latestTrialRunId?: string
  latestTrialRunStatus?: ITemplateTrialRunRecord['status']
  latestTrialRunSummary?: string
  latestTrialRunAt?: number
  latestReleaseStatus?: TemplatePublishStatus
  latestReleaseNote?: string
  latestReleaseAt?: number
  trialRunStartIndex?: number
  versionHistoryStartIndex?: number
  impactedArchivedDocumentCount?: number
  impactScopeText?: string
}

const TEMPLATE_FEEDBACK_STATUS_TEXT: Record<MedicalRecordTemplateFeedbackStatus, string> = {
  templateIssue: '模板问题单',
  revisionDraft: '已生成修订草稿',
  trialRun: '已完成试运行验证',
  published: '已进入发布记录'
}

function cloneFeedbackRecord(record: IMedicalRecordTemplateFeedbackRecord) {
  return JSON.parse(JSON.stringify(record)) as IMedicalRecordTemplateFeedbackRecord
}

function createFeedbackRecordId(defectId: string) {
  return `medical-record-feedback:${defectId}`
}

function createPostArchiveFeedbackRecordId(revisionId: string) {
  return `medical-record-feedback:post-archive:${revisionId}`
}

export class TemplateDomainService {
  private readonly medicalRecordFeedbacks = new Map<
    string,
    IMedicalRecordTemplateFeedbackRecord
  >()

  constructor(
    private readonly documentStore: TemplateDocumentStore
  ) {}

  loadFromStorage() {
    templateRegistry.loadFromStorage()
  }

  getAll() {
    return templateRegistry.getAll()
  }

  getEntry(id: string) {
    return templateRegistry.getEntry(id)
  }

  getCategories() {
    return templateRegistry.getCategories()
  }

  listDataAdapters() {
    return templateDataAdapterRegistry.list()
  }

  buildAdmissionReport(entry: ITemplateRegistryEntry): ITemplateAdmissionReport {
    return buildTemplateAdmissionReport(entry, {
      documents: this.documentStore.list()
    })
  }

  getPublishedVersion(entry: ITemplateRegistryEntry): string {
    const record = entry.versionHistory
      .filter(item => item.status === 'published')
      .at(-1)
    return record ? `v${record.version}` : ''
  }

  updateAssetMetadata(
    id: string,
    asset: Partial<ITemplateAssetMetadata>,
    operator?: string
  ) {
    templateRegistry.updateAssetMetadata(id, asset, operator)
  }

  getTrialRuns(id: string) {
    return templateRegistry.getTrialRuns(id)
  }

  getLatestPublishedRecord(id: string) {
    return templateRegistry.getLatestPublishedRecord(id)
  }

  createRevisionDraftFromPublished(
    id: string,
    operator?: string,
    note = '基于线上版本生成修订草稿'
  ) {
    return templateRegistry.createRevisionDraftFromPublished(id, {
      note,
      operator
    })
  }

  recordMedicalRecordDefectFeedback(defect: IMedicalRecordQualityDefect) {
    const now = Date.now()
    const id = createFeedbackRecordId(defect.id)
    const current = this.medicalRecordFeedbacks.get(id)
    const entry = templateRegistry.getEntry(defect.templateId)
    const next: IMedicalRecordTemplateFeedbackRecord = {
      id,
      defectId: defect.id,
      sourceType: 'qualityDefect',
      sourceId: defect.id,
      documentId: defect.documentId,
      documentTitle: defect.documentTitle,
      templateId: defect.templateId,
      templateVersion: defect.templateVersion,
      category: defect.category,
      fieldId: defect.fieldId,
      fieldLabel: defect.fieldLabel,
      message: defect.message,
      suggestion: defect.templateIssueSuggestion
        || defect.actionHint
        || '由病历缺陷反哺模板修订',
      status: current?.status ?? 'templateIssue',
      statusText: current?.statusText ?? TEMPLATE_FEEDBACK_STATUS_TEXT.templateIssue,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      revisionDraftVersion: current?.revisionDraftVersion,
      revisionDraftAt: current?.revisionDraftAt,
      latestTrialRunId: current?.latestTrialRunId,
      latestTrialRunStatus: current?.latestTrialRunStatus,
      latestTrialRunSummary: current?.latestTrialRunSummary,
      latestTrialRunAt: current?.latestTrialRunAt,
      latestReleaseStatus: current?.latestReleaseStatus,
      latestReleaseNote: current?.latestReleaseNote,
      latestReleaseAt: current?.latestReleaseAt,
      trialRunStartIndex: current?.trialRunStartIndex ?? entry?.trialRuns.length ?? 0,
      versionHistoryStartIndex: current?.versionHistoryStartIndex
        ?? entry?.versionHistory.length
        ?? 0,
      impactedArchivedDocumentCount: current?.impactedArchivedDocumentCount,
      impactScopeText: current?.impactScopeText
    }
    this.medicalRecordFeedbacks.set(id, next)
    return cloneFeedbackRecord(next)
  }

  createRevisionDraftFromDefect(
    defect: IMedicalRecordQualityDefect,
    operator = '模板管理员'
  ) {
    const feedback = this.recordMedicalRecordDefectFeedback(defect)
    if (feedback.revisionDraftAt) return feedback
    const note = `病历缺陷反哺修订：${defect.category} - ${defect.message}`
    const draft = this.createRevisionDraftFromPublished(
      defect.templateId,
      operator,
      note
    )
    const current = this.medicalRecordFeedbacks.get(feedback.id)
    if (draft && current) {
      const now = Date.now()
      const entry = templateRegistry.getEntry(defect.templateId)
      const next: IMedicalRecordTemplateFeedbackRecord = {
        ...current,
        status: 'revisionDraft',
        statusText: TEMPLATE_FEEDBACK_STATUS_TEXT.revisionDraft,
        updatedAt: now,
        revisionDraftVersion: draft.version,
        revisionDraftAt: now,
        trialRunStartIndex: entry?.trialRuns.length ?? current.trialRunStartIndex,
        versionHistoryStartIndex: entry?.versionHistory.length
          ?? current.versionHistoryStartIndex
      }
      this.medicalRecordFeedbacks.set(feedback.id, next)
      return cloneFeedbackRecord(next)
    }
    return feedback
  }

  recordPostArchiveRevisionFeedback(
    revision: IMedicalRecordPostArchiveRevisionRequest,
    options: {
      impactedArchivedDocuments?: ITemplateDocumentRecord[]
      impactScopeText?: string
    } = {}
  ) {
    const now = Date.now()
    const id = createPostArchiveFeedbackRecordId(revision.id)
    const current = this.medicalRecordFeedbacks.get(id)
    const entry = templateRegistry.getEntry(revision.templateId)
    const impactedCount = options.impactedArchivedDocuments?.length
      ?? current?.impactedArchivedDocumentCount
      ?? 0
    const impactScopeText = options.impactScopeText
      ?? current?.impactScopeText
      ?? (impactedCount
        ? `影响 ${impactedCount} 份已归档病历`
        : '待评估影响范围')
    const next: IMedicalRecordTemplateFeedbackRecord = {
      id,
      defectId: revision.id,
      sourceType: 'postArchiveRevision',
      sourceId: revision.id,
      documentId: revision.documentId,
      documentTitle: revision.documentTitle,
      templateId: revision.templateId,
      templateVersion: revision.templateVersion,
      category: '归档后修订',
      fieldId: revision.affectedFieldIds[0],
      fieldLabel: revision.affectedFieldIds.join('、') || undefined,
      message: revision.reason,
      suggestion: revision.reviewOpinion
        || '归档后修订暴露模板或字段配置问题，建议生成修订草稿验证后发布',
      status: current?.status ?? 'templateIssue',
      statusText: current?.statusText ?? TEMPLATE_FEEDBACK_STATUS_TEXT.templateIssue,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      revisionDraftVersion: current?.revisionDraftVersion,
      revisionDraftAt: current?.revisionDraftAt,
      latestTrialRunId: current?.latestTrialRunId,
      latestTrialRunStatus: current?.latestTrialRunStatus,
      latestTrialRunSummary: current?.latestTrialRunSummary,
      latestTrialRunAt: current?.latestTrialRunAt,
      latestReleaseStatus: current?.latestReleaseStatus,
      latestReleaseNote: current?.latestReleaseNote,
      latestReleaseAt: current?.latestReleaseAt,
      trialRunStartIndex: current?.trialRunStartIndex ?? entry?.trialRuns.length ?? 0,
      versionHistoryStartIndex: current?.versionHistoryStartIndex
        ?? entry?.versionHistory.length
        ?? 0,
      impactedArchivedDocumentCount: impactedCount,
      impactScopeText
    }
    this.medicalRecordFeedbacks.set(id, next)
    return cloneFeedbackRecord(next)
  }

  createRevisionDraftFromPostArchiveRevision(
    revision: IMedicalRecordPostArchiveRevisionRequest,
    options: {
      operator?: string
      impactedArchivedDocuments?: ITemplateDocumentRecord[]
      impactScopeText?: string
    } = {}
  ) {
    const feedback = this.recordPostArchiveRevisionFeedback(revision, {
      impactedArchivedDocuments: options.impactedArchivedDocuments,
      impactScopeText: options.impactScopeText
    })
    if (feedback.revisionDraftAt) return feedback
    const note = `归档后修订反哺模板：${revision.reason}`
    const draft = this.createRevisionDraftFromPublished(
      revision.templateId,
      options.operator ?? '模板管理员',
      note
    )
    const current = this.medicalRecordFeedbacks.get(feedback.id)
    if (draft && current) {
      const now = Date.now()
      const entry = templateRegistry.getEntry(revision.templateId)
      const next: IMedicalRecordTemplateFeedbackRecord = {
        ...current,
        status: 'revisionDraft',
        statusText: TEMPLATE_FEEDBACK_STATUS_TEXT.revisionDraft,
        updatedAt: now,
        revisionDraftVersion: draft.version,
        revisionDraftAt: now,
        trialRunStartIndex: entry?.trialRuns.length ?? current.trialRunStartIndex,
        versionHistoryStartIndex: entry?.versionHistory.length
          ?? current.versionHistoryStartIndex
      }
      this.medicalRecordFeedbacks.set(feedback.id, next)
      return cloneFeedbackRecord(next)
    }
    return feedback
  }

  getMedicalRecordTemplateFeedbackRecords(templateId?: string) {
    return Array.from(this.medicalRecordFeedbacks.values())
      .filter(record => !templateId || record.templateId === templateId)
      .map(record => this._resolveMedicalRecordFeedbackState(record))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(cloneFeedbackRecord)
  }

  rollbackToVersion(id: string, historyIndex: number, operator?: string) {
    return templateRegistry.rollbackToVersion(id, historyIndex, operator)
  }

  addTrialRun(
    id: string,
    record: Omit<ITemplateTrialRunRecord, 'id' | 'timestamp' | 'diagnostics'> & {
      diagnostics?: string[]
    },
    operator?: string
  ) {
    templateRegistry.addTrialRun(id, record, operator)
  }

  getAuditLogs(id: string) {
    return templateRegistry.getAuditLogs(id)
  }

  runReleaseAction(
    status: Extract<TemplatePublishStatus, 'review' | 'published' | 'archived'>,
    itemId: string,
    admissionReport: ITemplateAdmissionReport,
    releaseNote: ITemplateReleaseNote
  ): ITemplateReleaseActionResult {
    if (status !== 'archived' && admissionReport.blockerCount > 0) {
      return {
        applied: false,
        errors: admissionReport.issues
          .filter(issue => issue.level === 'blocker')
          .map(issue => issue.message)
      }
    }
    const errors = status === 'review'
      ? templateRegistry.submitForReview(itemId, releaseNote)
      : status === 'published'
        ? templateRegistry.publish(itemId, releaseNote)
        : templateRegistry.withdraw(itemId)
    return {
      applied: errors.length === 0,
      errors
    }
  }

  delete(id: string) {
    templateRegistry.delete(id)
  }

  register(
    schema: ITemplateSchema,
    category: string,
    builtIn = false,
    options?: { note?: string; operator?: string; asset?: ITemplateAssetMetadata }
  ) {
    templateRegistry.register(schema, category, builtIn, options)
  }

  importSchema(json: string, category: string) {
    return templateRegistry.importSchema(json, category)
  }

  importSchemas(json: string, category: string): ITemplateImportResult {
    return templateRegistry.importSchemas(json, category)
  }

  private _resolveMedicalRecordFeedbackState(
    record: IMedicalRecordTemplateFeedbackRecord
  ): IMedicalRecordTemplateFeedbackRecord {
    const entry = templateRegistry.getEntry(record.templateId)
    if (!entry) return record
    const trialRun = entry.trialRuns
      .slice(record.trialRunStartIndex ?? 0)
      .at(-1)
    const release = entry.versionHistory
      .slice(record.versionHistoryStartIndex ?? 0)
      .filter(item => item.status === 'review' || item.status === 'published')
      .at(-1)
    const status: MedicalRecordTemplateFeedbackStatus = release
      ? 'published'
      : trialRun
        ? 'trialRun'
        : record.revisionDraftAt
          ? 'revisionDraft'
          : 'templateIssue'
    const next: IMedicalRecordTemplateFeedbackRecord = {
      ...record,
      status,
      statusText: TEMPLATE_FEEDBACK_STATUS_TEXT[status],
      updatedAt: Math.max(
        record.updatedAt,
        trialRun?.timestamp ?? 0,
        release?.timestamp ?? 0
      ),
      latestTrialRunId: trialRun?.id ?? record.latestTrialRunId,
      latestTrialRunStatus: trialRun?.status ?? record.latestTrialRunStatus,
      latestTrialRunSummary: trialRun?.summary ?? record.latestTrialRunSummary,
      latestTrialRunAt: trialRun?.timestamp ?? record.latestTrialRunAt,
      latestReleaseStatus: release?.status ?? record.latestReleaseStatus,
      latestReleaseNote: release?.note ?? record.latestReleaseNote,
      latestReleaseAt: release?.timestamp ?? record.latestReleaseAt
    }
    this.medicalRecordFeedbacks.set(record.id, next)
    return next
  }
}

export type {
  ITemplateAssetMetadata,
  ITemplateImportResult,
  ITemplateListItem,
  ITemplateRegistryEntry,
  ITemplateReleaseNote,
  ITemplateTrialRunRecord,
  ITemplateVersionRecord,
  TemplatePublishStatus
}