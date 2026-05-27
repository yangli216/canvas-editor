import type {
  IMedicalRecordOperationsCenterViewModel,
  IMedicalRecordOperationsQueueItem
} from './service'

export interface IMedicalRecordOperationsCenterViewOptions {
  model: IMedicalRecordOperationsCenterViewModel
  onOpenTrace?: (documentId: string) => void
  onOpenDefectCenter?: () => void
  onOpenArchiveCenter?: () => void
}

function createActionButton(label: string, onClick: () => void, primary = false) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = primary
    ? 'td-designer__btn td-designer__btn--primary td-designer__btn--compact'
    : 'td-designer__btn td-designer__btn--compact'
  button.textContent = label
  button.onclick = onClick
  return button
}

function createQueueCard(
  item: IMedicalRecordOperationsQueueItem,
  options: IMedicalRecordOperationsCenterViewOptions
) {
  const card = document.createElement('div')
  card.className = 'tm-adapter-card'

  const header = document.createElement('div')
  header.className = 'tm-center-inline'
  const info = document.createElement('div')
  info.className = 'tm-center-list__info'
  const title = document.createElement('strong')
  title.textContent = item.title
  const meta = document.createElement('small')
  meta.textContent = `${item.patientText} / ${item.templateText}`
  info.append(title, meta)

  const actions = document.createElement('div')
  actions.className = 'tm-inline-actions'
  if (options.onOpenTrace) {
    actions.append(createActionButton('时间线', () => {
      options.onOpenTrace?.(item.documentId)
    }))
  }
  if (options.onOpenDefectCenter) {
    actions.append(createActionButton('缺陷整改', () => {
      options.onOpenDefectCenter?.()
    }))
  }
  if (options.onOpenArchiveCenter) {
    actions.append(createActionButton('归档质检', () => {
      options.onOpenArchiveCenter?.()
    }, true))
  }

  const status = document.createElement('span')
  status.className = item.blockerCount || item.openDefectCount
    ? 'tm-center-badge tm-center-badge--danger'
    : 'tm-center-badge tm-center-badge--warning'
  status.textContent = item.queueText
  actions.append(status)

  header.append(info, actions)

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  summary.innerHTML = `
    <div><span>病历状态</span><strong>${item.statusText}</strong></div>
    <div><span>风险等级</span><strong>${item.riskText}</strong></div>
    <div><span>阻断 / 警告</span><strong>${item.blockerCount}/${item.warningCount}</strong></div>
    <div><span>未关闭缺陷</span><strong>${item.openDefectCount}</strong></div>
    <div><span>阻断原因</span><strong>${item.blockerReasonText}</strong></div>
    <div><span>最近书写</span><strong>${item.latestWrittenText}</strong></div>
  `

  card.append(header, summary)
  return card
}

export function createMedicalRecordOperationsCenterView(
  options: IMedicalRecordOperationsCenterViewOptions
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'
  const { model } = options

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  summary.innerHTML = `
    <div><span>病历总量</span><strong>${model.summary.documentCount}</strong></div>
    <div><span>待质控</span><strong>${model.summary.pendingQualityCount}</strong></div>
    <div><span>退回整改</span><strong>${model.summary.returnedRectificationCount}</strong></div>
    <div><span>待归档</span><strong>${model.summary.pendingArchiveCount}</strong></div>
    <div><span>归档阻断</span><strong>${model.summary.archiveBlockedCount}</strong></div>
  `
  content.append(summary)

  const hint = document.createElement('div')
  hint.className = 'tm-center-toolbar'
  const text = document.createElement('span')
  text.textContent = '在一个工作台集中查看待质控、退回整改、待归档和归档阻断病历，并联动缺陷整改与归档质检。'
  hint.append(text)
  content.append(hint)

  model.queues.forEach(queue => {
    const section = document.createElement('div')
    section.className = 'tm-center-list__info'

    const title = document.createElement('strong')
    title.textContent = `${queue.queueText}（${queue.itemCount}）`
    section.append(title)

    if (!queue.items.length) {
      const empty = document.createElement('small')
      empty.textContent = '当前无病历'
      section.append(empty)
      content.append(section)
      return
    }

    queue.items.forEach(item => {
      section.append(createQueueCard(item, options))
    })

    content.append(section)
  })

  return content
}
