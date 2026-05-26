import type { ITemplateDataAdapter } from '../../../../editor/template/TemplateDataAdapter'
import {
  buildBusinessFieldCenterViewModel,
  type IBusinessFieldCenterFieldAsset,
  type IBusinessFieldCenterFilters,
  type IBusinessFieldCenterTemplateItem
} from './service'
import { createBusinessFieldCenterView } from './view'

export class BusinessFieldCenterModule {
  private filters: IBusinessFieldCenterFilters = {
    keyword: '',
    group: '',
    dataSource: '',
    permission: '',
    scope: 'all'
  }

  updateFilters(filters: Partial<IBusinessFieldCenterFilters>) {
    this.filters = {
      ...this.filters,
      ...filters
    }
  }

  resetFilters() {
    this.filters = {
      keyword: '',
      group: '',
      dataSource: '',
      permission: '',
      scope: 'all'
    }
  }

  createDialogContent(args: {
    getItems: () => IBusinessFieldCenterTemplateItem[]
    getAdapters: () => ITemplateDataAdapter[]
    onQuickApplyField: (field: IBusinessFieldCenterFieldAsset, rerender: () => void) => void
    onMaintainField: (
      field: IBusinessFieldCenterFieldAsset,
      rerender: () => void
    ) => void
    onOpenTemplate: (templateId: string) => void
  }) {
    return createBusinessFieldCenterView({
      getModel: () =>
        buildBusinessFieldCenterViewModel({
          items: args.getItems(),
          adapters: args.getAdapters(),
          filters: this.filters
        }),
      onUpdateFilters: filters => this.updateFilters(filters),
      onResetFilters: () => this.resetFilters(),
      onQuickApplyField: args.onQuickApplyField,
      onMaintainField: args.onMaintainField,
      onOpenTemplate: args.onOpenTemplate
    })
  }
}

export {
  buildBusinessFieldCenterViewModel,
  type IBusinessFieldCenterFieldAsset,
  type IBusinessFieldCenterFilters,
  type IBusinessFieldCenterTemplateItem,
  type IBusinessFieldCenterViewModel
} from './service'
export {
  createBusinessFieldCenterView
} from './view'
export {
  applyBusinessFieldQuickPreset,
  getBusinessFieldQuickPresets
  ,recommendBusinessFieldQuickPresets
} from './presets'
export type {
  IBusinessFieldQuickPreset,
  IBusinessFieldQuickPresetTarget
} from './presets'