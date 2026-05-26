import type { IBusinessFieldCenterViewModel } from './service'

export function createBusinessFieldCenterView(
  model: IBusinessFieldCenterViewModel
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  summary.innerHTML = `
    <div><span>适配器</span><strong>${model.summary.adapterCount}</strong></div>
    <div><span>业务字段</span><strong>${model.summary.businessFieldText}</strong></div>
    <div><span>平均覆盖</span><strong>${model.summary.averageCoverageText}</strong></div>
    <div><span>数据源</span><strong>${model.summary.dataSourceCount}</strong></div>
  `
  content.append(summary)

  model.adapters.forEach(adapter => {
    const item = document.createElement('div')
    item.className = 'tm-adapter-card'
    const name = document.createElement('div')
    name.className = 'tm-adapter-card__name'
    name.textContent = adapter.label
    const detail = document.createElement('div')
    detail.className = 'tm-adapter-card__sources'
    detail.textContent = `${adapter.description} / ${adapter.sourcesText}`
    item.append(name, detail)
    content.append(item)
  })

  if (model.risks.length) {
    const title = document.createElement('div')
    title.className = 'tm-version-center__section-title'
    title.textContent = '待修复绑定风险'
    content.append(title)

    const riskList = document.createElement('div')
    riskList.className = 'tm-admission-report__list'
    model.risks.forEach(risk => {
      const row = document.createElement('div')
      row.className = 'tm-admission-report__item tm-admission-report__item--warning'
      const badge = document.createElement('span')
      badge.textContent = risk.badgeText
      const name = document.createElement('strong')
      name.textContent = risk.name
      const detail = document.createElement('small')
      detail.textContent = risk.detail
      row.append(badge, name, detail)
      riskList.append(row)
    })
    content.append(riskList)
  }

  return content
}