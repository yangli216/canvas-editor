import type { IQualityStandardCenterViewModel } from './service'

export interface IQualityStandardCenterViewOptions {
  model: IQualityStandardCenterViewModel
}

function appendSummaryItem(
  summary: HTMLDivElement,
  label: string,
  value: string | number
) {
  const item = document.createElement('div')
  const labelEl = document.createElement('span')
  labelEl.textContent = label
  const valueEl = document.createElement('strong')
  valueEl.textContent = String(value)
  item.append(labelEl, valueEl)
  summary.append(item)
}

export function createQualityStandardCenterView(
  options: IQualityStandardCenterViewOptions
): HTMLDivElement {
  const model = options.model
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  appendSummaryItem(summary, '规则包', model.summary.packageCount)
  appendSummaryItem(summary, '已启用', model.summary.enabledCount)
  appendSummaryItem(summary, '已停用', model.summary.disabledCount)
  appendSummaryItem(summary, '阻断规则', model.summary.blockerRuleCount)
  content.append(summary)

  const list = document.createElement('div')
  list.className = 'tm-center-list'

  if (!model.packages.length) {
    const empty = document.createElement('div')
    empty.className = 'tm-empty'
    const title = document.createElement('strong')
    title.className = 'tm-empty__title'
    title.textContent = '当前没有规则包'
    empty.append(title)
    list.append(empty)
  }

  model.packages.forEach(rulePackage => {
    const row = document.createElement('div')
    row.className = 'tm-center-list__row'
    const info = document.createElement('div')
    info.className = 'tm-center-list__info'
    const title = document.createElement('strong')
    title.textContent = rulePackage.name
    const meta = document.createElement('small')
    meta.textContent = [
      rulePackage.stage,
      `v${rulePackage.version}`,
      `${rulePackage.ruleCount} 条规则`,
      `${rulePackage.blockerRuleCount} 条阻断`,
      rulePackage.scoringPolicyText
    ].join(' / ')
    info.append(title, meta)

    const status = document.createElement('span')
    status.className = rulePackage.enabled
      ? 'tm-center-badge tm-center-badge--success'
      : 'tm-center-badge tm-center-badge--muted'
    status.textContent = rulePackage.statusText

    row.append(info, status)
    list.append(row)
  })

  content.append(list)
  return content
}