import type { ITemplateAdmissionReport } from '../../../../editor/template/TemplateGovernance'
import { buildAdmissionCenterViewModel } from './service'
import { createAdmissionCenterView } from './view'

export class AdmissionCenterModule {
  createReportView(
    report: ITemplateAdmissionReport,
    options?: {
      onOpenDesigner?: () => void
    }
  ) {
    return createAdmissionCenterView(
      buildAdmissionCenterViewModel(report),
      options
    )
  }
}

export {
  buildAdmissionCenterViewModel
} from './service'
export type {
  IAdmissionCenterViewModel
} from './service'
export {
  createAdmissionCenterView
} from './view'