import type { ITemplateDocumentRecord } from '../../../../editor/template/TemplateDocumentStore'
import type { IMedicalRecordQualityDefect } from '../../domain'
import {
  buildMedicalRecordOperationsCenterViewModel,
  type IMedicalRecordOperationsDomain
} from './service'
import {
  createMedicalRecordOperationsCenterView,
  type IMedicalRecordOperationsCenterViewOptions
} from './view'

type OperationsCenterBuilderArgs = Parameters<
  typeof buildMedicalRecordOperationsCenterViewModel
>[0]

export class MedicalRecordOperationsCenterModule {
  createDialogContent(args: {
    documents: ITemplateDocumentRecord[]
    domain: IMedicalRecordOperationsDomain
    defects: IMedicalRecordQualityDefect[]
    rulePackages?: OperationsCenterBuilderArgs['rulePackages']
    terminalQualityResults?: OperationsCenterBuilderArgs['terminalQualityResults']
    archiveRequirements?: OperationsCenterBuilderArgs['archiveRequirements']
    now?: OperationsCenterBuilderArgs['now']
    onOpenTrace?: IMedicalRecordOperationsCenterViewOptions['onOpenTrace']
    onOpenDefectCenter?: IMedicalRecordOperationsCenterViewOptions['onOpenDefectCenter']
    onOpenArchiveCenter?: IMedicalRecordOperationsCenterViewOptions['onOpenArchiveCenter']
  }) {
    return createMedicalRecordOperationsCenterView({
      model: buildMedicalRecordOperationsCenterViewModel({
        documents: args.documents,
        domain: args.domain,
        defects: args.defects,
        rulePackages: args.rulePackages,
        terminalQualityResults: args.terminalQualityResults,
        archiveRequirements: args.archiveRequirements,
        now: args.now
      }),
      onOpenTrace: args.onOpenTrace,
      onOpenDefectCenter: args.onOpenDefectCenter,
      onOpenArchiveCenter: args.onOpenArchiveCenter
    })
  }
}

export {
  buildMedicalRecordOperationsCenterViewModel
} from './service'
export type {
  IMedicalRecordOperationsCenterViewModel,
  IMedicalRecordOperationsDomain,
  IMedicalRecordOperationsQueueGroup,
  IMedicalRecordOperationsQueueItem,
  MedicalRecordOperationQueue
} from './service'
export {
  createMedicalRecordOperationsCenterView
} from './view'
export type {
  IMedicalRecordOperationsCenterViewOptions
} from './view'
