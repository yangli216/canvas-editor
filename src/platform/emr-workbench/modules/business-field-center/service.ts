import type { ITemplateSchema } from '../../../../editor/template'
import type { ITemplateDataAdapter } from '../../../../editor/template/TemplateDataAdapter'
import { buildTemplateFieldRuntimeIndex } from '../../../../editor/template/TemplateRuntime'
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
  templateId: string
  templateName: string
  templateCategory: string
  builtIn: boolean
  owner: string
  fieldId: string
  label: string
  type: string
  businessCode: string
  group: string
  dataSource: string
  permission: string
  exportPath: string
  issueCount: number
  issueText: string
  statusText: string
  recommendedPresetLabels: string[]
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
  risks: Array<{
    name: string
    badgeText: string
    detail: string
  }>
}

function createFieldAssets(
  items: IBusinessFieldCenterTemplateItem[]
): IBusinessFieldCenterFieldAsset[] {
  return items.flatMap(item => {
    const index = buildTemplateFieldRuntimeIndex(item.entry.schema)
    return index.all.map(node => {
      const metadata = node.metadata ?? {}
      const issues: string[] = []
      if (!metadata.businessCode && !metadata.exportPath) {
        issues.push('缺少业务编码/导出路径')
      }
      if (!metadata.group) {
        issues.push('未分组')
      }
      if (!metadata.dataSource) {
        issues.push('缺少数据源')
      }
      if (!metadata.permission) {
        issues.push('未配置权限标签')
      }
      const recommendedPresetLabels = recommendBusinessFieldQuickPresets({
        id: node.field.id,
        label: node.field.label,
        placeholder: node.field.placeholder,
        type: node.field.type,
        metadata
      }).map(preset => preset.label)

      return {
        assetId: `${item.id}:${node.field.id}`,
        templateId: item.id,
        templateName: item.name,
        templateCategory: item.category,
        builtIn: item.builtIn,
        owner: item.entry.asset?.owner || '未指定负责人',
        fieldId: node.field.id,
        label: node.field.label || node.field.id,
        type: node.field.type,
        businessCode: metadata.businessCode || '',
        group: metadata.group || '',
        dataSource: metadata.dataSource || '',
        permission: metadata.permission || '',
        exportPath: metadata.exportPath || '',
        issueCount: issues.length,
        issueText: issues.length ? issues.join(' / ') : '字段资产配置完整',
        statusText: issues.length ? `${issues.length} 个待补项` : '可维护',
        recommendedPresetLabels
      }
    })
  })
}

export function buildBusinessFieldCenterViewModel(args: {
  items: IBusinessFieldCenterTemplateItem[]
  adapters: ITemplateDataAdapter[]
  filters: IBusinessFieldCenterFilters
}): IBusinessFieldCenterViewModel {
  const { items, adapters, filters } = args
  const allFields = createFieldAssets(items)
  const keyword = filters.keyword.trim().toLowerCase()
  const filteredFields = allFields.filter(field => {
    if (filters.scope === 'editable' && field.builtIn) return false
    if (filters.scope === 'builtin' && !field.builtIn) return false
    if (filters.group && field.group !== filters.group) return false
    if (filters.dataSource && field.dataSource !== filters.dataSource) return false
    if (filters.permission && field.permission !== filters.permission) return false
    if (!keyword) return true
    return [
      field.templateName,
      field.templateCategory,
      field.fieldId,
      field.label,
      field.businessCode,
      field.group,
      field.dataSource,
      field.permission,
      field.exportPath
    ].some(value => value.toLowerCase().includes(keyword))
  })

  const maintainedCount = allFields.filter(field => {
    return Boolean(
      field.group
      && field.dataSource
      && field.permission
      && (field.businessCode || field.exportPath)
    )
  }).length

  const groups = Array.from(
    new Set(allFields.map(field => field.group).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const dataSources = Array.from(
    new Set(allFields.map(field => field.dataSource).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'))
  const permissions = Array.from(
    new Set(allFields.map(field => field.permission).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b, 'zh-CN'))

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
      fieldAssetText: `${filteredFields.length}/${allFields.length}`,
      maintainedFieldText: `${maintainedCount}/${allFields.length}`,
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
        return left.templateName.localeCompare(right.templateName, 'zh-CN')
      })
      .slice(0, 24),
    risks: items
      .filter(item =>
        item.admissionReport.issues.some(issue => issue.category === 'dataBinding')
      )
      .slice(0, 8)
      .map(item => ({
        name: item.name,
        badgeText: `${item.admissionReport.dataBindingCoverage}%`,
        detail: `${item.admissionReport.issues.filter(issue => issue.category === 'dataBinding').length} 个绑定问题 / 平均覆盖 ${averageCoverage}%`
      }))
  }
}