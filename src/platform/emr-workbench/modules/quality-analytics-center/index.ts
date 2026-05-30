import { buildQualityAnalyticsCenterViewModel } from './service'
import { createQualityAnalyticsCenterView } from './view'

export class QualityAnalyticsCenterModule {
  createDialogContent(args: Parameters<typeof buildQualityAnalyticsCenterViewModel>[0]) {
    return createQualityAnalyticsCenterView({
      model: buildQualityAnalyticsCenterViewModel(args)
    })
  }
}

export {
  buildQualityAnalyticsCenterViewModel
} from './service'
export type {
  IQualityAnalyticsArchiveItemInput,
  IQualityAnalyticsCenterViewModel,
  IQualityAnalyticsDefectInput,
  IQualityAnalyticsDocumentInput,
  IQualityAnalyticsQualityResultInput,
  IQualityAnalyticsRankingItem,
  QualityAnalyticsQualityResultsInput
} from './service'
export {
  createQualityAnalyticsCenterView
} from './view'
export type {
  IQualityAnalyticsCenterViewOptions
} from './view'