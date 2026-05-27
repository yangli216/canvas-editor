import type { ITemplateDocumentRecord } from '../../../../editor/template/TemplateDocumentStore'
import { buildMedicalRecordQualityViewModel } from './service'
import {
  createMedicalRecordQualityCenterView,
  type IMedicalRecordQualityCenterViewOptions
} from './view'

export class MedicalRecordQualityCenterModule {
  createDialogContent(args: {
    documents: ITemplateDocumentRecord[]
    domain: Parameters<typeof buildMedicalRecordQualityViewModel>[0]['domain']
    rulePackages?: Parameters<typeof buildMedicalRecordQualityViewModel>[0]['rulePackages']
    now?: Parameters<typeof buildMedicalRecordQualityViewModel>[0]['now']
    onOpenDocumentTrace?: IMedicalRecordQualityCenterViewOptions['onOpenDocumentTrace']
    onOpenTemplate?: IMedicalRecordQualityCenterViewOptions['onOpenTemplate']
    onOpenVersionCenter?: IMedicalRecordQualityCenterViewOptions['onOpenVersionCenter']
    onOpenField?: IMedicalRecordQualityCenterViewOptions['onOpenField']
  }) {
    return createMedicalRecordQualityCenterView({
      model: buildMedicalRecordQualityViewModel({
        documents: args.documents,
        domain: args.domain,
        rulePackages: args.rulePackages,
        now: args.now
      }),
      onOpenDocumentTrace: args.onOpenDocumentTrace,
      onOpenTemplate: args.onOpenTemplate,
      onOpenVersionCenter: args.onOpenVersionCenter,
      onOpenField: args.onOpenField
    })
  }
}

export {
  DEFAULT_MEDICAL_RECORD_QUALITY_RULE_PACKAGES,
  assessMedicalRecordQualityRuleImpact,
  buildMedicalRecordQualityRuleHitStats,
  buildMedicalRecordQualityViewModel
} from './service'
export type {
  IMedicalRecordContentQualityRule,
  IMedicalRecordQualityIssue,
  IMedicalRecordQualityItem,
  IMedicalRecordQualityRuleHitStat,
  IMedicalRecordQualityRuleHitStats,
  IMedicalRecordQualityRuleImpactAssessment,
  IMedicalRecordQualityRulePackage,
  IMedicalRecordQualityRuleTarget,
  IMedicalRecordQualityTraceDomain,
  IMedicalRecordQualityViewModel,
  IMedicalRecordTimelinessQualityRule,
  MedicalRecordQualityLevel,
  MedicalRecordQualityStage,
  MedicalRecordQualityTimeAnchor,
  MedicalRecordQualityTimeTarget
} from './service'
export {
  createMedicalRecordQualityCenterView
} from './view'
export type {
  IMedicalRecordQualityCenterViewOptions
} from './view'
