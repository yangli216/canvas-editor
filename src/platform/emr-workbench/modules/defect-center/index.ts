import type {
  IMedicalRecordQualityDefect,
  IMedicalRecordTemplateFeedbackSummary
} from '../../domain'
import { buildMedicalRecordDefectCenterViewModel } from './service'
import {
  createMedicalRecordDefectCenterView,
  type IMedicalRecordDefectCenterViewOptions
} from './view'

export class MedicalRecordDefectCenterModule {
  createDialogContent(args: {
    defects: IMedicalRecordQualityDefect[]
    templateFeedback?: IMedicalRecordTemplateFeedbackSummary[]
    onReturnToDoctor?: IMedicalRecordDefectCenterViewOptions['onReturnToDoctor']
    onMarkRectified?: IMedicalRecordDefectCenterViewOptions['onMarkRectified']
    onClose?: IMedicalRecordDefectCenterViewOptions['onClose']
    onConvertToTemplateIssue?: IMedicalRecordDefectCenterViewOptions['onConvertToTemplateIssue']
    onOpenTrace?: IMedicalRecordDefectCenterViewOptions['onOpenTrace']
    onOpenField?: IMedicalRecordDefectCenterViewOptions['onOpenField']
    onOpenVersionCenter?: IMedicalRecordDefectCenterViewOptions['onOpenVersionCenter']
  }) {
    return createMedicalRecordDefectCenterView({
      model: buildMedicalRecordDefectCenterViewModel({
        defects: args.defects,
        templateFeedback: args.templateFeedback
      }),
      onReturnToDoctor: args.onReturnToDoctor,
      onMarkRectified: args.onMarkRectified,
      onClose: args.onClose,
      onConvertToTemplateIssue: args.onConvertToTemplateIssue,
      onOpenTrace: args.onOpenTrace,
      onOpenField: args.onOpenField,
      onOpenVersionCenter: args.onOpenVersionCenter
    })
  }
}

export {
  buildMedicalRecordDefectCenterViewModel
} from './service'
export type {
  IMedicalRecordDefectCenterItem,
  IMedicalRecordDefectCenterViewModel
} from './service'
export {
  createMedicalRecordDefectCenterView
} from './view'
export type {
  IMedicalRecordDefectCenterViewOptions
} from './view'
