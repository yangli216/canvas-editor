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
  IMedicalRecordArchiveItem,
  IMedicalRecordArchiveRevisionSummary,
  MedicalRecordArchiveStatus
} from './service'
export {
  createMedicalRecordArchiveCenterView
} from './view'
export type {
  IMedicalRecordArchiveCenterViewOptions
} from './view'
