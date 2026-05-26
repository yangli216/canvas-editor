import type { TemplatePublishStatus } from '../../../editor/template/TemplateRegistry'
import type { ITemplateSchema } from '../../../editor/template'
import {
  TemplateDocumentStore,
  type ICreateTemplateDocumentOptions,
  type ITemplateDocumentMigrationOptions,
  type ITemplateDocumentRecord
} from '../../../editor/template/TemplateDocumentStore'

export class MedicalRecordDomainService {
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
}

export { TemplateDocumentStore }