import type {
  IQualityAnalyticsCenterViewModel,
  IQualityAnalyticsRankingItem
} from './service'

export interface IQualityAnalyticsCenterViewOptions {
  model: IQualityAnalyticsCenterViewModel
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

function createRankingCard(
  title: string,
  items: IQualityAnalyticsRankingItem[]
) {
  const card = document.createElement('div')
  card.className = 'tm-adapter-card'

  const header = document.createElement('div')
  header.className = 'tm-center-inline'
  const heading = document.createElement('strong')
  heading.textContent = title
  const count = document.createElement('span')
  count.className = 'tm-center-badge tm-center-badge--muted'
  count.textContent = `${items.length} 项`
  header.append(heading, count)
  card.append(header)

  if (!items.length) {
    const empty = document.createElement('small')
    empty.textContent = '暂无排行数据'
    card.append(empty)
    return card
  }

  const list = document.createElement('div')
  list.className = 'tm-admission-report__list'
  items.forEach(item => {
    const row = document.createElement('div')
    row.className = 'tm-admission-report__item tm-admission-report__item--info'
    const score = document.createElement('span')
    score.textContent = item.scoreText
    const info = document.createElement('div')
    info.className = 'tm-center-list__info'
    const name = document.createElement('strong')
    name.textContent = item.name
    const detail = document.createElement('small')
    detail.textContent = `病历 ${item.documentCount} 份 / 缺陷 ${item.defectCount} 个 / 逾期 ${item.overdueCount} 个`
    info.append(name, detail)
    row.append(score, info)
    list.append(row)
  })
  card.append(list)
  return card
}

export function createQualityAnalyticsCenterView(
  options: IQualityAnalyticsCenterViewOptions
): HTMLDivElement {
  const { model } = options
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  appendSummaryItem(summary, '终末质控覆盖率', model.summary.coverageRateText)
  appendSummaryItem(summary, '缺陷闭环率', model.summary.defectClosureRateText)
  appendSummaryItem(summary, '逾期率', model.summary.overdueRateText)
  appendSummaryItem(summary, 'A级率', model.summary.gradeARateText)
  appendSummaryItem(summary, '归档准入通过率', model.summary.archivePassRateText)
  content.append(summary)

  const list = document.createElement('div')
  list.className = 'tm-center-list'
  list.append(
    createRankingCard('科室风险排行', model.departmentRankings),
    createRankingCard('医生风险排行', model.doctorRankings)
  )
  content.append(list)

  return content
}