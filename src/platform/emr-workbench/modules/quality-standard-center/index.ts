import type { IQualityRulePackage } from '../../domain'
import { buildQualityStandardCenterViewModel } from './service'
import { createQualityStandardCenterView } from './view'

export class QualityStandardCenterModule {
  createDialogContent(args: {
    packages: IQualityRulePackage[]
  }) {
    return createQualityStandardCenterView({
      model: buildQualityStandardCenterViewModel(args)
    })
  }
}

export {
  buildQualityStandardCenterViewModel
} from './service'
export type {
  IQualityStandardCenterViewModel
} from './service'
export {
  createQualityStandardCenterView
} from './view'
export type {
  IQualityStandardCenterViewOptions
} from './view'