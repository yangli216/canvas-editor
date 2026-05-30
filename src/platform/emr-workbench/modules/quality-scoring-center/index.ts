import type { IQualityInspectionResult } from '../../domain'
import { buildQualityScoringCenterViewModel } from './service'
import { createQualityScoringCenterView } from './view'

export class QualityScoringCenterModule {
  createDialogContent(result: IQualityInspectionResult) {
    return createQualityScoringCenterView({
      model: buildQualityScoringCenterViewModel(result)
    })
  }
}

export {
  buildQualityScoringCenterViewModel
} from './service'
export type {
  IQualityScoringCenterDetailViewModel,
  IQualityScoringCenterViewModel
} from './service'
export {
  createQualityScoringCenterView
} from './view'
export type {
  IQualityScoringCenterViewOptions
} from './view'