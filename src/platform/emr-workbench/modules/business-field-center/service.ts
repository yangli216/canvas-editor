import type {
  ITemplateMetadataFieldSnapshotMap,
  ITemplateSchema
} from '../../../../editor/template'
import type { ITemplateDataAdapter } from '../../../../editor/template/TemplateDataAdapter'
import { buildTemplateFieldRuntimeIndex } from '../../../../editor/template/TemplateRuntime'
import type {
  IBusinessMetadataConflict,
  IBusinessMetadataField,
  IBusinessMetadataFieldCandidate,
  IBusinessMetadataHospitalFieldMapping,
  IBusinessMetadataTemplateBinding,
  IBusinessMetadataTemplateFieldAsset
} from '../../domain/business-metadata-domain-service'
import { recommendBusinessFieldQuickPresets } from './presets'

export type BusinessFieldCenterScopeFilter = 'all' | 'editable' | 'builtin'

export interface IBusinessFieldCenterTemplateItem {
  id: string
  name: string
  category: string
  builtIn: boolean
  updatedAt: number
  entry: {
    schema: ITemplateSchema
    asset?: {
      owner?: string
    }
  }
  fieldCount: number
  businessFieldCount: number
  dataSourceCount: number
  admissionReport: {
    dataBindingCoverage: number
    issues: Array<{
      category: string
    }>
  }
}

export interface IBusinessFieldCenterFieldAsset {
  assetId: string
  label: string
  businessCode: string
  group: string
  dataSource: string
  permission: string
  exportPath: string
  issueCount: number
  issueText: string
  statusText: string
  bindingCount: number
  candidateCount: number
  hospitalMappingCount: number
  hospitalMappingText: string
  templateIds: string[]
  templateNames: string[]
  recommendedPresetLabels: string[]
}

export interface IBusinessFieldCenterPendingCandidate {
  code: string
  name: string
  group: string
  dataSource: string
  permission: string
  exportPath: string
  usageCount: number
  pendingUsageCount: number
  templateIds: string[]
  templateNames: string[]
  metadataFieldId?: string
  metadataFieldName?: string
}

export interface IBusinessFieldCenterFilters {
  keyword: string
  group: string
  dataSource: string
  permission: string
  scope: BusinessFieldCenterScopeFilter
}

export interface IBusinessFieldCenterViewModel {
  summary: {
    adapterCount: number
    masterFieldText: string
    boundFieldText: string
    candidateFieldCount: number
    conflictCount: number
    fieldAssetText: string
    maintainedFieldText: string
    dataSourceCount: number
    groupCount: number
  }
  filters: {
    keyword: string
    group: string
    dataSource: string
    permission: string
    scope: BusinessFieldCenterScopeFilter
    groups: string[]
    dataSources: string[]
    permissions: string[]
  }
  adapters: Array<{
    label: string
    description: string
    sourcesText: string
  }>
  fields: IBusinessFieldCenterFieldAsset[]
  pendingCandidates: IBusinessFieldCenterPendingCandidate[]
  risks: Array<{
    code: string
    badgeText: string
    detail: string
  }>
}

const CONFLICT_REASON_BADGE: Record<IBusinessMetadataConflict['reason'], string> = {
  dataSourceMismatch: '数据源冲突',
  permissionMismatch: '权限冲突',
  groupMismatch: '分组冲突',
  exportPathMismatch: '导出路径冲突'
}

export function collectBusinessFieldTemplateAssets(
  items: IBusinessFieldCenterTemplateItem[],
  metadataFieldsById?: ITemplateMetadataFieldSnapshotMap
): IBusinessMetadataTemplateFieldAsset[] {
  return items.flatMap(item => {
    const index = buildTemplateFieldRuntimeIndex(item.entry.schema, {
      metadataFieldsById
    })
    return index.all.map(node => ({
      templateId: item.id,
      templateName: item.name,
      templateCategory: item.category,
      fieldId: node.field.id,
      fieldLabel: node.field.label || node.field.id,
      metadata: node.metadata
    }))
  })
}

function matchKeyword(field: IBusinessFieldCenterFieldAsset, keyword: string): boolean {
  if (!keyword) return true
  return [
    field.label,
    field.businessCode,
    field.group,
    field.dataSource,
    field.permission,
    field.exportPath,
    ...field.templateNames
  ].some(value => value.toLowerCase().includes(keyword))
}

function createFieldAsset(args: {
  metadataField: IBusinessMetadataField
  bindings: IBusinessMetadataTemplateBinding[]
  candidates: IBusinessMetadataFieldCandidate[]
  conflicts: IBusinessMetadataConflict[]
  hospitalMappings: IBusinessMetadataHospitalFieldMapping[]
}): IBusinessFieldCenterFieldAsset {
  const { metadataField, bindings, candidates, conflicts, hospitalMappings } = args
  const bindingCount = bindings.length
  const hospitalMappingCount = hospitalMappings.length
  const candidate = candidates.find(item => item.code === metadataField.code)
  const candidateCount = Math.max((candidate?.usageCount ?? bindingCount) - bindingCount, 0)
  const fieldConflicts = conflicts.filter(item => item.code === metadataField.code)
  const issueText = fieldConflicts.length
    ? fieldConflicts.map(item => CONFLICT_REASON_BADGE[item.reason]).join(' / ')
    : '主数据配置完整'

  return {
    assetId: metadataField.id,
    label: metadataField.name,
    businessCode: metadataField.code,
    group: metadataField.group,
    dataSource: metadataField.dataSource,
    permission: metadataField.permission,
    exportPath: metadataField.exportPath,
    issueCount: fieldConflicts.length,
    issueText,
    statusText: bindingCount ? `${bindingCount} 处引用` : '未绑定模板字段',
    bindingCount,
    candidateCount,
    hospitalMappingCount,
    hospitalMappingText: hospitalMappingCount
      ? `${hospitalMappingCount} 个医院映射`
      : '未配置医院映射',
    templateIds: Array.from(new Set(bindings.map(item => item.templateId))),
    templateNames: Array.from(new Set(bindings.map(item => item.templateName))),
    recommendedPresetLabels: recommendBusinessFieldQuickPresets({
      id: metadataField.code,
      label: metadataField.name,
      metadata: {
        metadataFieldId: metadataField.id,
        businessCode: metadataField.code,
        group: metadataField.group,
        dataSource: metadataField.dataSource,
        permission: metadataField.permission,
        exportPath: metadataField.exportPath,
        tags: metadataField.tags
      }
    }).map(item => item.label)
  }
}

export function buildBusinessFieldCenterViewModel(args: {
  items: IBusinessFieldCenterTemplateItem[]
  adapters: ITemplateDataAdapter[]
  filters: IBusinessFieldCenterFilters
  metadataFields?: IBusinessMetadataField[]
  bindings?: IBusinessMetadataTemplateBinding[]
  hospitalMappings?: IBusinessMetadataHospitalFieldMapping[]
  candidates?: IBusinessMetadataFieldCandidate[]
  conflicts?: IBusinessMetadataConflict[]
}): IBusinessFieldCenterViewModel {
  const {
    items,
    adapters,
    filters,
    metadataFields = [],
    bindings = [],
    hospitalMappings = [],
    candidates = [],
    conflicts = []
  } = args

  const allFields = metadataFields.map(metadataField => {
    return createFieldAsset({
      metadataField,
      bindings: bindings.filter(item => item.metadataFieldId === metadataField.id),
      candidates,
      conflicts,
      hospitalMappings: hospitalMappings.filter(
        item => item.metadataFieldId === metadataField.id
      )
    })
  })

  const keyword = filters.keyword.trim().toLowerCase()
  const itemById = new Map(items.map(item => [item.id, item]))
  const filteredFields = allFields.filter(field => {
    if (filters.group && field.group !== filters.group) return false
    if (filters.dataSource && field.dataSource !== filters.dataSource) return false
    if (filters.permission && field.permission !== filters.permission) return false
    return matchKeyword(field, keyword)
  })

  const pendingCandidates = candidates
    .map(candidate => {
      const linkedField = metadataFields.find(field => field.code === candidate.code)
      const editableTemplateIds = candidate.templateIds.filter(templateId => {
        const item = itemById.get(templateId)
        return item ? !item.builtIn : true
      })
      const templateNames = editableTemplateIds.map(templateId => {
        return itemById.get(templateId)?.name || templateId
      })
      const bindingCount = linkedField
        ? bindings.filter(item => item.metadataFieldId === linkedField.id).length
        : 0
      const pendingUsageCount = linkedField
        ? Math.max(editableTemplateIds.length - bindingCount, 0)
        : editableTemplateIds.length

      return {
        code: candidate.code,
        name: candidate.name,
        group: candidate.group,
        dataSource: candidate.dataSource,
        permission: candidate.permission,
        exportPath: candidate.exportPath,
        usageCount: candidate.usageCount,
        pendingUsageCount,
        templateIds: editableTemplateIds,
        templateNames,
        metadataFieldId: linkedField?.id,
        metadataFieldName: linkedField?.name
      }
    })
    .filter(candidate => {
      if (!candidate.pendingUsageCount) return false
      if (filters.group && candidate.group !== filters.group) return false
      if (filters.dataSource && candidate.dataSource !== filters.dataSource) {
        return false
      }
      if (filters.permission && candidate.permission !== filters.permission) {
        return false
      }
      if (!keyword) return true

      return [
        candidate.name,
        candidate.code,
        candidate.group,
        candidate.dataSource,
        candidate.permission,
        candidate.exportPath,
        ...candidate.templateNames
      ].some(value => value.toLowerCase().includes(keyword))
    })
    .sort((left, right) => {
      if (left.pendingUsageCount !== right.pendingUsageCount) {
        return right.pendingUsageCount - left.pendingUsageCount
      }
      return left.name.localeCompare(right.name, 'zh-CN')
    })

  const groups = Array.from(
    new Set(metadataFields.map(field => field.group).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const dataSources = Array.from(
    new Set(metadataFields.map(field => field.dataSource).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const permissions = Array.from(
    new Set(metadataFields.map(field => field.permission).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'))

  const totalUsageCount = candidates.reduce((sum, item) => sum + item.usageCount, 0)
  const averageCoverage = items.length
    ? Math.round(
        items.reduce(
          (sum, item) => sum + item.admissionReport.dataBindingCoverage,
          0
        ) / items.length
      )
    : 100

  return {
    summary: {
      adapterCount: adapters.length,
      masterFieldText: `${filteredFields.length}/${allFields.length}`,
      boundFieldText: `${bindings.length}/${totalUsageCount || bindings.length}`,
      candidateFieldCount: candidates.length,
      conflictCount: conflicts.length,
      fieldAssetText: `${filteredFields.length}/${allFields.length}`,
      maintainedFieldText: `${bindings.length}/${totalUsageCount || bindings.length}`,
      dataSourceCount: dataSources.length,
      groupCount: groups.length
    },
    filters: {
      keyword: filters.keyword,
      group: filters.group,
      dataSource: filters.dataSource,
      permission: filters.permission,
      scope: filters.scope,
      groups,
      dataSources,
      permissions
    },
    adapters: adapters.map(adapter => ({
      label: adapter.label,
      description: adapter.description || '未配置额外说明',
      sourcesText: adapter.dataSources.join(' / ')
    })),
    fields: filteredFields
      .slice()
      .sort((left, right) => {
        if (left.issueCount !== right.issueCount) {
          return right.issueCount - left.issueCount
        }
        return left.label.localeCompare(right.label, 'zh-CN')
      }),
    pendingCandidates,
    risks: conflicts.map(conflict => ({
      code: conflict.code,
      badgeText: CONFLICT_REASON_BADGE[conflict.reason],
      detail: `${conflict.templateIds.length} 个模板字段命中 / 平均覆盖 ${averageCoverage}%`
    }))
  }
}
