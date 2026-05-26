import type { MedicalRecordDomainService, TemplateDomainService } from '../../domain'
import {
  buildAuditCenterViewModel,
  type IAuditCenterTemplateItem
} from './service'
import { createAuditCenterView } from './view'

export class AuditCenterModule {
  constructor(
    private readonly templateDomain: TemplateDomainService,
    private readonly medicalRecordDomain: MedicalRecordDomainService
  ) {}

  listTemplateAudits(templateId: string) {
    return this.templateDomain.getAuditLogs(templateId)
  }

  listTemplateDocumentTraces(templateId: string) {
    return this.medicalRecordDomain.listByTemplate(templateId).map(record => ({
      documentId: record.id,
      title: record.title,
      status: record.status,
      templateVersion: record.template.version,
      traceTimeline: this.medicalRecordDomain.getTraceTimeline(record.id)
    }))
  }

  createDialogContent(items: IAuditCenterTemplateItem[]) {
    return createAuditCenterView(buildAuditCenterViewModel(this, items))
  }
}

export {
  buildAuditCenterViewModel,
  type IAuditCenterSource,
  type IAuditCenterTemplateItem,
  type IAuditCenterViewModel
} from './service'
export {
  createAuditCenterView
} from './view'