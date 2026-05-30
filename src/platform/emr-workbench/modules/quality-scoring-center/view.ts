import type { IQualityScoringCenterViewModel } from './service'

export interface IQualityScoringCenterViewOptions {
  model: IQualityScoringCenterViewModel
}

function appendSummaryItem(
  summary: HTMLDivElement,
  label: string,
  value: string
) {
  const item = document.createElement('div')
  const labelEl = document.createElement('span')
  labelEl.textContent = label
  const valueEl = document.createElement('strong')
  valueEl.textContent = value
  item.append(labelEl, valueEl)
  summary.append(item)
}

export function createQualityScoringCenterView(
  options: IQualityScoringCenterViewOptions
): HTMLDivElement {
  const model = options.model
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  appendSummaryItem(summary, '评分', model.scoreText)
  appendSummaryItem(summary, '等级', model.gradeText)
  appendSummaryItem(summary, '结论', model.conclusionText)
  appendSummaryItem(summary, '质控员', model.inspectedBy)
  content.append(summary)

  const list = document.createElement('div')
  list.className = 'tm-center-list'

  if (!model.details.length) {
    const empty = document.createElement('div')
    empty.className = 'tm-empty'
    const title = document.createElement('strong')
    title.className = 'tm-empty__title'
    title.textContent = '当前病历未产生扣分明细'
    empty.append(title)
    list.append(empty)
  }

  model.details.forEach(detail => {
    const item = document.createElement('div')
    item.className = 'tm-adapter-card'

    const header = document.createElement('div')
    header.className = 'tm-center-inline'
    const title = document.createElement('div')
    title.className = 'tm-adapter-card__name'
    title.textContent = detail.ruleName
    const deduction = document.createElement('span')
    deduction.className = 'tm-center-badge tm-center-badge--danger'
    deduction.textContent = detail.deductionText
    header.append(title, deduction)

    const reason = document.createElement('div')
    reason.className = 'tm-adapter-card__sources'
    reason.textContent = `${detail.category} / ${detail.reason}`

    item.append(header, reason)
    if (detail.evidenceText) {
      const evidence = document.createElement('small')
      evidence.textContent = detail.evidenceText
      item.append(evidence)
    }
    list.append(item)
  })

  content.append(list)
  return content
}