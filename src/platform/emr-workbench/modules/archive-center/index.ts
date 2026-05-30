import type { ITemplateDocumentRecord } from '../../../../editor/template/TemplateDocumentStore'
import { buildMedicalRecordArchiveCenterViewModel } from './service'
import {
  createMedicalRecordArchiveCenterView,
  type IMedicalRecordArchiveCenterViewOptions
} from './view'

export class MedicalRecordArchiveCenterModule {
  createDialogContent(args: {
    documents: ITemplateDocumentRecord[]
    domain: Parameters<typeof buildMedicalRecordArchiveCenterViewModel>[0]['domain']
    rulePackages?: Parameters<typeof buildMedicalRecordArchiveCenterViewModel>[0]['rulePackages']
    terminalQualityResults?: Parameters<typeof buildMedicalRecordArchiveCenterViewModel>[0]['terminalQualityResults']
    archiveRequirements?: Parameters<typeof buildMedicalRecordArchiveCenterViewModel>[0]['archiveRequirements']
    now?: Parameters<typeof buildMedicalRecordArchiveCenterViewModel>[0]['now']
    onArchive?: IMedicalRecordArchiveCenterViewOptions['onArchive']
    onOpenTrace?: IMedicalRecordArchiveCenterViewOptions['onOpenTrace']
    onOpenReadonly?: IMedicalRecordArchiveCenterViewOptions['onOpenReadonly']
    onRequestPostArchiveRevision?: IMedicalRecordArchiveCenterViewOptions['onRequestPostArchiveRevision']
    onOpenPostArchiveRevisions?: IMedicalRecordArchiveCenterViewOptions['onOpenPostArchiveRevisions']
  }) {
    return createMedicalRecordArchiveCenterView({
      model: buildMedicalRecordArchiveCenterViewModel({
        documents: args.documents,
        domain: args.domain,
        rulePackages: args.rulePackages,
        terminalQualityResults: args.terminalQualityResults,
        archiveRequirements: args.archiveRequirements,
        now: args.now
      }),
      onArchive: args.onArchive,
      onOpenTrace: args.onOpenTrace,
      onOpenReadonly: args.onOpenReadonly,
      onRequestPostArchiveRevision: args.onRequestPostArchiveRevision,
      onOpenPostArchiveRevisions: args.onOpenPostArchiveRevisions
    })
  }
}

export {
  buildMedicalRecordArchiveCenterViewModel
} from './service'
export type {
  IMedicalRecordArchiveCenterViewModel,
  IMedicalRecordArchiveChecklistItem,
  IMedicalRecordArchiveDomain,
  IMedicalRecordArchiveRequirements,
  IMedicalRecordArchiveItem,
  IMedicalRecordArchiveRevisionSummary,
  IMedicalRecordTerminalQualitySummary,
  MedicalRecordArchiveStatus
} from './service'
export {
  createMedicalRecordArchiveCenterView
} from './view'
export type {
  IMedicalRecordArchiveCenterViewOptions
} from './view'
