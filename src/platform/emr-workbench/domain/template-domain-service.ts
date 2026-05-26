import {
  templateRegistry,
  type ITemplateAssetMetadata,
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
import type { TemplateDocumentStore } from '../../../editor/template/TemplateDocumentStore'

export interface ITemplateReleaseActionResult {
  applied: boolean
  errors: string[]
}

export class TemplateDomainService {
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
    options?: { note?: string }
  ) {
    templateRegistry.register(schema, category, builtIn, options)
  }

  importSchema(json: string, category: string) {
    return templateRegistry.importSchema(json, category)
  }
}

export type {
  ITemplateAssetMetadata,
  ITemplateListItem,
  ITemplateRegistryEntry,
  ITemplateReleaseNote,
  ITemplateTrialRunRecord,
  ITemplateVersionRecord,
  TemplatePublishStatus
}