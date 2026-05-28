import type { ITemplateDataAdapter } from '../../../../editor/template/TemplateDataAdapter'
import {
  buildBusinessFieldCenterViewModel,
  type IBusinessFieldCenterPendingCandidate,
  type IBusinessFieldCenterFieldAsset,
  type IBusinessFieldCenterFilters,
  type IBusinessFieldCenterTemplateItem
} from './service'
import { createBusinessFieldCenterView } from './view'
import type {
  IBusinessMetadataConflict,
  IBusinessMetadataField,
  IBusinessMetadataFieldCandidate,
  IBusinessMetadataHospitalFieldMapping,
  IBusinessMetadataTemplateBinding
} from '../../domain/business-metadata-domain-service'

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
    getMetadataFields: () => IBusinessMetadataField[]
    getBindings: () => IBusinessMetadataTemplateBinding[]
    getHospitalMappings: () => IBusinessMetadataHospitalFieldMapping[]
    getCandidates: () => IBusinessMetadataFieldCandidate[]
    getConflicts: () => IBusinessMetadataConflict[]
    onApplyCandidate: (
      candidate: IBusinessFieldCenterPendingCandidate,
      rerender: () => void
    ) => void
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
          metadataFields: args.getMetadataFields(),
          bindings: args.getBindings(),
          hospitalMappings: args.getHospitalMappings(),
          candidates: args.getCandidates(),
          conflicts: args.getConflicts(),
          filters: this.filters
        }),
      onUpdateFilters: filters => this.updateFilters(filters),
      onResetFilters: () => this.resetFilters(),
      onApplyCandidate: args.onApplyCandidate,
      onMaintainField: args.onMaintainField,
      onOpenTemplate: args.onOpenTemplate
    })
  }
}

export {
  buildBusinessFieldCenterViewModel,
  collectBusinessFieldTemplateAssets,
  type IBusinessFieldCenterPendingCandidate,
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
  getBusinessFieldQuickPresets,
  recommendBusinessFieldQuickPresets
} from './presets'
export type {
  IBusinessFieldQuickPreset,
  IBusinessFieldQuickPresetTarget
} from './presets'