import type { ITemplateDataAdapter } from '../../../../editor/template/TemplateDataAdapter'
import {
  buildBusinessFieldCenterViewModel,
  type IBusinessFieldCenterTemplateItem
} from './service'
import { createBusinessFieldCenterView } from './view'

export class BusinessFieldCenterModule {
  createDialogContent(args: {
    items: IBusinessFieldCenterTemplateItem[]
    adapters: ITemplateDataAdapter[]
  }) {
    return createBusinessFieldCenterView(buildBusinessFieldCenterViewModel(args))
  }
}

export {
  buildBusinessFieldCenterViewModel,
  type IBusinessFieldCenterTemplateItem,
  type IBusinessFieldCenterViewModel
} from './service'
export {
  createBusinessFieldCenterView
} from './view'