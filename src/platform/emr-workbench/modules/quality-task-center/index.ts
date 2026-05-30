import type { IQualityInspectionTask } from '../../domain'
import { buildQualityTaskCenterViewModel } from './service'
import { createQualityTaskCenterView } from './view'

export class QualityTaskCenterModule {
  createDialogContent(args: {
    tasks: IQualityInspectionTask[]
    now?: number
  }) {
    return createQualityTaskCenterView({
      model: buildQualityTaskCenterViewModel(args)
    })
  }
}

export {
  buildQualityTaskCenterViewModel
} from './service'
export type {
  IQualityTaskCenterViewModel
} from './service'
export {
  createQualityTaskCenterView
} from './view'
export type {
  IQualityTaskCenterViewOptions
} from './view'