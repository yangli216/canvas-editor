import type { IQualityTaskCenterViewModel } from './service'

export interface IQualityTaskCenterViewOptions {
  model: IQualityTaskCenterViewModel
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

export function createQualityTaskCenterView(
  options: IQualityTaskCenterViewOptions
): HTMLDivElement {
  const model = options.model
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  appendSummaryItem(summary, '质控任务', model.summary.taskCount)
  appendSummaryItem(summary, '待分派', model.summary.pendingAssignCount)
  appendSummaryItem(summary, '质控中', model.summary.checkingCount)
  appendSummaryItem(summary, '待复核', model.summary.pendingReviewCount)
  appendSummaryItem(summary, '已完成', model.summary.completedCount)
  appendSummaryItem(summary, '已逾期', model.summary.overdueCount)
  content.append(summary)

  const list = document.createElement('div')
  list.className = 'tm-center-list'

  if (!model.items.length) {
    const empty = document.createElement('div')
    empty.className = 'tm-empty'
    const title = document.createElement('strong')
    title.className = 'tm-empty__title'
    title.textContent = '当前没有质控任务'
    empty.append(title)
    list.append(empty)
  }

  model.items.forEach(item => {
    const row = document.createElement('div')
    row.className = 'tm-center-list__row'
    const info = document.createElement('div')
    info.className = 'tm-center-list__info'
    const title = document.createElement('strong')
    title.textContent = item.title
    const meta = document.createElement('small')
    meta.textContent = [
      item.sourceText,
      item.strategyText,
      `${item.documentCount} 份病历`,
      item.assigneeText,
      item.dueText
    ].join(' / ')
    info.append(title, meta)

    const status = document.createElement('span')
    status.className = item.overdue
      ? 'tm-center-badge tm-center-badge--danger'
      : item.status === 'completed'
        ? 'tm-center-badge tm-center-badge--success'
        : 'tm-center-badge tm-center-badge--warning'
    status.textContent = item.overdue
      ? `${item.statusText} · 逾期`
      : item.statusText

    row.append(info, status)
    list.append(row)
  })

  content.append(list)
  return content
}