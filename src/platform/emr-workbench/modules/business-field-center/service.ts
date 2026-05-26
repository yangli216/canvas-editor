import type { ITemplateDataAdapter } from '../../../../editor/template/TemplateDataAdapter'

export interface IBusinessFieldCenterTemplateItem {
  name: string
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

export interface IBusinessFieldCenterViewModel {
  summary: {
    adapterCount: number
    businessFieldText: string
    averageCoverageText: string
    dataSourceCount: number
  }
  adapters: Array<{
    label: string
    description: string
    sourcesText: string
  }>
  risks: Array<{
    name: string
    badgeText: string
    detail: string
  }>
}

export function buildBusinessFieldCenterViewModel(args: {
  items: IBusinessFieldCenterTemplateItem[]
  adapters: ITemplateDataAdapter[]
}): IBusinessFieldCenterViewModel {
  const { items, adapters } = args
  const totalFields = items.reduce((sum, item) => sum + item.fieldCount, 0)
  const totalBusinessFields = items.reduce(
    (sum, item) => sum + item.businessFieldCount,
    0
  )
  const totalDataSources = items.reduce(
    (sum, item) => sum + item.dataSourceCount,
    0
  )
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
      businessFieldText: `${totalBusinessFields}/${totalFields}`,
      averageCoverageText: `${averageCoverage}%`,
      dataSourceCount: totalDataSources
    },
    adapters: adapters.map(adapter => ({
      label: adapter.label,
      description: adapter.description || '未配置额外说明',
      sourcesText: adapter.dataSources.join(' / ')
    })),
    risks: items
      .filter(item =>
        item.admissionReport.issues.some(issue => issue.category === 'dataBinding')
      )
      .slice(0, 8)
      .map(item => ({
        name: item.name,
        badgeText: `${item.admissionReport.dataBindingCoverage}%`,
        detail: `${item.admissionReport.issues.filter(issue => issue.category === 'dataBinding').length} 个绑定问题`
      }))
  }
}