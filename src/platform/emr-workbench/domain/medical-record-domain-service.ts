import type { TemplatePublishStatus } from '../../../editor/template/TemplateRegistry'
import type { ITemplateSchema } from '../../../editor/template'
import {
  TemplateDocumentStore,
  type ICreateTemplateDocumentOptions,
  type ITemplateDocumentMigrationOptions,
  type ITemplateDocumentRecord
} from '../../../editor/template/TemplateDocumentStore'

export type MedicalRecordPostArchiveRevisionStatus =
  | 'requested'
  | 'approved'
  | 'rejected'

export interface IMedicalRecordPostArchiveRevisionFieldDiff {
  fieldId: string
  before: string | null
  after: string | null
}

export interface IMedicalRecordPostArchiveRevisionRequest {
  id: string
  documentId: string
  documentTitle: string
  templateId: string
  templateVersion: string
  reason: string
  applicant: string
  affectedFieldIds: string[]
  fieldDiffs: IMedicalRecordPostArchiveRevisionFieldDiff[]
  status: MedicalRecordPostArchiveRevisionStatus
  statusText: string
  createdAt: number
  updatedAt: number
  reviewedAt?: number
  reviewer?: string
  reviewOpinion?: string
}

const POST_ARCHIVE_REVISION_STATUS_TEXT: Record<
  MedicalRecordPostArchiveRevisionStatus,
  string
> = {
  requested: '待审批',
  approved: '已批准',
  rejected: '已驳回'
}

function clonePostArchiveRevision(
  revision: IMedicalRecordPostArchiveRevisionRequest
) {
  return JSON.parse(JSON.stringify(revision)) as IMedicalRecordPostArchiveRevisionRequest
}

function createPostArchiveRevisionId(documentId: string) {
  return `post-archive-revision:${documentId}:${Date.now()}`
}

function createFieldDiffs(
  beforeValues: Record<string, string | null>,
  afterValues: Record<string, string | null>
): IMedicalRecordPostArchiveRevisionFieldDiff[] {
  return Object.entries(afterValues)
    .filter(([fieldId, after]) => beforeValues[fieldId] !== after)
    .map(([fieldId, after]) => ({
      fieldId,
      before: beforeValues[fieldId] ?? null,
      after
    }))
}

export class MedicalRecordDomainService {
  private readonly postArchiveRevisions = new Map<
    string,
    IMedicalRecordPostArchiveRevisionRequest
  >()

  constructor(
    private readonly documentStore: TemplateDocumentStore
  ) {}

  get store() {
    return this.documentStore
  }

  createFromTemplate(
    schema: ITemplateSchema,
    options: Omit<ICreateTemplateDocumentOptions, 'schema'> & {
      templateStatus?: TemplatePublishStatus
    }
  ) {
    return this.documentStore.create({
      ...options,
      schema
    })
  }

  list() {
    return this.documentStore.list()
  }

  listByTemplate(templateId: string) {
    return this.documentStore.list().filter(record => record.template.id === templateId)
  }

  getTraceTimeline(id: string) {
    return this.documentStore.getTraceTimeline(id)
  }

  getWritingSummary(id: string) {
    return this.documentStore.getWritingTraceSummary(id)
  }

  getBoundDocumentCount(templateId: string) {
    return this.listByTemplate(templateId).length
  }

  previewMigration(id: string, schema: ITemplateSchema) {
    return this.documentStore.previewMigration(id, schema)
  }

  migrate(
    id: string,
    schema: ITemplateSchema,
    options: ITemplateDocumentMigrationOptions = {}
  ) {
    return this.documentStore.migrate(id, schema, options)
  }

  findDocument(id: string): ITemplateDocumentRecord | undefined {
    return this.documentStore.get(id)
  }

  listArchivedByTemplateVersion(templateId: string, templateVersion?: string) {
    return this.documentStore.list().filter(record => (
      record.status === 'archived'
      && record.template.id === templateId
      && (!templateVersion || record.template.version === templateVersion)
    ))
  }

  requestPostArchiveRevision(
    documentId: string,
    options: {
      applicant?: string
      reason: string
      proposedValues: Record<string, string | null>
      affectedFieldIds?: string[]
    }
  ) {
    const current = this.documentStore.get(documentId)
    if (!current || current.status !== 'archived') return null
    const fieldDiffs = createFieldDiffs(
      current.content.flatValues,
      options.proposedValues
    )
    const affectedFieldIds = options.affectedFieldIds?.length
      ? options.affectedFieldIds
      : fieldDiffs.map(diff => diff.fieldId)
    const now = Date.now()
    const revision: IMedicalRecordPostArchiveRevisionRequest = {
      id: createPostArchiveRevisionId(documentId),
      documentId,
      documentTitle: current.title || current.id,
      templateId: current.template.id,
      templateVersion: current.template.version,
      reason: options.reason,
      applicant: options.applicant ?? '病案室',
      affectedFieldIds,
      fieldDiffs,
      status: 'requested',
      statusText: POST_ARCHIVE_REVISION_STATUS_TEXT.requested,
      createdAt: now,
      updatedAt: now
    }
    this.postArchiveRevisions.set(revision.id, revision)
    this.documentStore.appendTrace(documentId, {
      action: 'manual',
      source: 'api',
      operator: revision.applicant,
      title: '归档后修订申请',
      summary: options.reason,
      changedFields: fieldDiffs,
      metadata: {
        revisionId: revision.id,
        revisionStatus: revision.status,
        affectedFieldIds,
        templateId: current.template.id,
        templateVersion: current.template.version
      }
    })
    return clonePostArchiveRevision(revision)
  }

  reviewPostArchiveRevision(
    revisionId: string,
    options: {
      status: Extract<MedicalRecordPostArchiveRevisionStatus, 'approved' | 'rejected'>
      reviewer?: string
      opinion?: string
    }
  ) {
    const current = this.postArchiveRevisions.get(revisionId)
    if (!current) return null
    const now = Date.now()
    const next: IMedicalRecordPostArchiveRevisionRequest = {
      ...current,
      status: options.status,
      statusText: POST_ARCHIVE_REVISION_STATUS_TEXT[options.status],
      updatedAt: now,
      reviewedAt: now,
      reviewer: options.reviewer ?? '病案室',
      reviewOpinion: options.opinion ?? POST_ARCHIVE_REVISION_STATUS_TEXT[options.status]
    }
    this.postArchiveRevisions.set(revisionId, next)
    this.documentStore.appendTrace(current.documentId, {
      action: 'manual',
      source: 'api',
      operator: next.reviewer,
      title: '归档后修订审批',
      summary: next.reviewOpinion,
      changedFields: current.fieldDiffs,
      metadata: {
        revisionId,
        revisionStatus: options.status,
        templateId: current.templateId,
        templateVersion: current.templateVersion
      }
    })
    return clonePostArchiveRevision(next)
  }

  getPostArchiveRevisions(documentId?: string) {
    return Array.from(this.postArchiveRevisions.values())
      .filter(revision => !documentId || revision.documentId === documentId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(clonePostArchiveRevision)
  }

  getPostArchiveRevisionSummary(documentId: string) {
    const revisions = this.getPostArchiveRevisions(documentId)
    const latest = revisions[0]
    return {
      revisionCount: revisions.length,
      pendingCount: revisions.filter(item => item.status === 'requested').length,
      approvedCount: revisions.filter(item => item.status === 'approved').length,
      rejectedCount: revisions.filter(item => item.status === 'rejected').length,
      latestStatusText: latest?.statusText,
      latestReason: latest?.reason,
      latestUpdatedAt: latest?.updatedAt
    }
  }

  archiveDocument(
    id: string,
    options: {
      operator?: string
      summary?: string
      qualityConclusion?: string
    } = {}
  ) {
    const current = this.documentStore.get(id)
    return this.documentStore.setStatus(id, 'archived', {
      source: 'api',
      operator: options.operator ?? '病案室',
      title: '病历归档',
      summary: options.summary ?? '归档时冻结模板快照、字段值、结构化导出和质控结论',
      metadata: {
        qualityConclusion: options.qualityConclusion ?? '归档前质检通过',
        templateId: current?.template.id,
        templateVersion: current?.template.version,
        fieldCount: Object.keys(current?.content.flatValues ?? {}).length,
        structuredValueCount: Object.keys(current?.content.structuredValues ?? {}).length
      }
    })
  }
}

export { TemplateDocumentStore }