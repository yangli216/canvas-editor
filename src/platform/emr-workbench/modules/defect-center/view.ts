import type {
  IMedicalRecordDefectCenterItem,
  IMedicalRecordDefectCenterViewModel
} from './service'
import type { MedicalRecordDefectStatus } from '../../domain'

export interface IMedicalRecordDefectCenterViewOptions {
  model: IMedicalRecordDefectCenterViewModel
  onReturnToDoctor?: (defectId: string) => void
  onMarkRectified?: (defectId: string) => void
  onClose?: (defectId: string) => void
  onConvertToTemplateIssue?: (defectId: string) => void
  onOpenTrace?: (documentId: string) => void
  onOpenField?: (documentId: string, fieldId?: string) => void
  onOpenVersionCenter?: (templateId: string) => void
}

type DefectStatusFilter = 'all' | MedicalRecordDefectStatus

function createOption(
  select: HTMLSelectElement,
  value: string,
  label: string
) {
  const option = document.createElement('option')
  option.value = value
  option.textContent = label
  select.append(option)
}

function appendTextRow(parent: HTMLElement, label: string, value?: string) {
  if (!value) return
  const row = document.createElement('small')
  row.textContent = `${label}：${value}`
  parent.append(row)
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

function createDefectCard(
  item: IMedicalRecordDefectCenterItem,
  options: IMedicalRecordDefectCenterViewOptions
) {
  const card = document.createElement('div')
  card.className = 'tm-adapter-card'

  const header = document.createElement('div')
  header.className = 'tm-center-inline'
  const titleWrap = document.createElement('div')
  titleWrap.className = 'tm-center-list__info'
  const title = document.createElement('strong')
  title.textContent = item.documentTitle
  const meta = document.createElement('small')
  meta.textContent = `${item.templateText} / ${item.fieldLabel} / ${item.owner}`
  titleWrap.append(title, meta)

  const actions = document.createElement('div')
  actions.className = 'tm-inline-actions'
  const status = document.createElement('span')
  status.className = item.status === 'closed'
    ? 'tm-center-badge tm-center-badge--success'
    : item.status === 'templateIssue'
      ? 'tm-center-badge tm-center-badge--warning'
      : 'tm-center-badge tm-center-badge--danger'
  status.textContent = item.statusText

  if (options.onOpenTrace) {
    actions.append(createActionButton('留痕', () => options.onOpenTrace?.(item.documentId)))
  }
  if (options.onOpenField) {
    actions.append(createActionButton('定位字段', () => {
      options.onOpenField?.(item.documentId, item.fieldId)
    }))
  }
  if (options.onReturnToDoctor && item.status === 'open') {
    actions.append(createActionButton('退回医生', () => {
      options.onReturnToDoctor?.(item.id)
    }, true))
  }
  if (
    options.onMarkRectified
    && (item.status === 'returned' || item.status === 'open')
  ) {
    actions.append(createActionButton('医生整改', () => {
      options.onMarkRectified?.(item.id)
    }))
  }
  if (options.onClose && item.status === 'rectified') {
    actions.append(createActionButton('复核关闭', () => {
      options.onClose?.(item.id)
    }, true))
  }
  if (
    options.onConvertToTemplateIssue
    && item.status !== 'closed'
    && item.status !== 'templateIssue'
  ) {
    actions.append(createActionButton('反哺模板', () => {
      options.onConvertToTemplateIssue?.(item.id)
    }))
  }
  actions.append(status)
  header.append(titleWrap, actions)

  const info = document.createElement('div')
  info.className = 'tm-admission-report__list'
  const issue = document.createElement('div')
  issue.className = 'tm-admission-report__item tm-admission-report__item--blocker'
  const badge = document.createElement('span')
  badge.textContent = item.levelText
  const detail = document.createElement('div')
  detail.className = 'tm-center-list__info'
  const message = document.createElement('strong')
  message.textContent = `${item.category}：${item.message}`
  const hint = document.createElement('small')
  hint.textContent = item.actionHint
  appendTextRow(detail, '最近流转', item.latestEventText)
  appendTextRow(detail, '退回说明', item.returnReason)
  appendTextRow(detail, '整改说明', item.rectificationNote)
  appendTextRow(detail, '复核意见', item.reviewOpinion)
  appendTextRow(detail, '更新时间', item.updatedAtText)
  detail.prepend(message, hint)
  issue.append(badge, detail)
  info.append(issue)

  card.append(header, info)
  return card
}

function createFeedbackCard(
  feedback: IMedicalRecordDefectCenterViewModel['templateFeedback'][number],
  options: IMedicalRecordDefectCenterViewOptions
) {
  const card = document.createElement('div')
  card.className = 'tm-adapter-card'
  const header = document.createElement('div')
  header.className = 'tm-center-inline'
  const titleWrap = document.createElement('div')
  titleWrap.className = 'tm-center-list__info'
  const title = document.createElement('strong')
  title.textContent = feedback.templateText
  const meta = document.createElement('small')
  meta.textContent = `${feedback.category} / ${feedback.count} 次 / 阻断 ${feedback.blockerCount}`
  titleWrap.append(title, meta)
  const actions = document.createElement('div')
  actions.className = 'tm-inline-actions'
  if (options.onOpenVersionCenter) {
    actions.append(createActionButton('版本中心', () => {
      options.onOpenVersionCenter?.(feedback.templateId)
    }, true))
  }
  header.append(titleWrap, actions)

  const body = document.createElement('div')
  body.className = 'tm-center-list__info'
  appendTextRow(body, '关联字段', feedback.fieldLabels.join('、') || '整份病历')
  appendTextRow(body, '典型问题', feedback.messages.join('；'))
  appendTextRow(body, '处理建议', feedback.suggestion)
  card.append(header, body)
  return card
}

export function createMedicalRecordDefectCenterView(
  options: IMedicalRecordDefectCenterViewOptions
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'
  let statusFilter: DefectStatusFilter = 'all'

  const render = () => {
    content.innerHTML = ''
    const { model } = options

    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>缺陷总数</span><strong>${model.summary.totalCount}</strong></div>
      <div><span>已退回</span><strong>${model.summary.returnedCount}</strong></div>
      <div><span>待复核</span><strong>${model.summary.rectifiedCount}</strong></div>
      <div><span>已关闭</span><strong>${model.summary.closedCount}</strong></div>
      <div><span>模板反哺</span><strong>${model.summary.templateFeedbackCount}</strong></div>
    `
    content.append(summary)

    const toolbar = document.createElement('div')
    toolbar.className = 'tm-center-toolbar'
    const hint = document.createElement('span')
    hint.textContent = '按缺陷状态推进退回、整改、复核关闭，并将高频问题反哺模板修订。'
    const statusSelect = document.createElement('select')
    statusSelect.className = 'tm-center-toolbar__select'
    createOption(statusSelect, 'all', '全部状态')
    createOption(statusSelect, 'open', '待分派')
    createOption(statusSelect, 'returned', '已退回医生')
    createOption(statusSelect, 'rectified', '医生已整改')
    createOption(statusSelect, 'closed', '复核已关闭')
    createOption(statusSelect, 'templateIssue', '已转模板问题')
    statusSelect.value = statusFilter
    statusSelect.onchange = () => {
      statusFilter = statusSelect.value as DefectStatusFilter
      render()
    }
    toolbar.append(hint, statusSelect)
    content.append(toolbar)

    if (model.templateFeedback.length) {
      const section = document.createElement('div')
      section.className = 'tm-center-list__info'
      const title = document.createElement('strong')
      title.textContent = '高频缺陷反哺模板'
      section.append(title)
      model.templateFeedback.forEach(feedback => {
        section.append(createFeedbackCard(feedback, options))
      })
      content.append(section)
    }

    const filteredItems = model.items.filter(item => (
      statusFilter === 'all' || item.status === statusFilter
    ))

    if (!filteredItems.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      const title = document.createElement('strong')
      title.className = 'tm-empty__title'
      title.textContent = '当前没有匹配的缺陷'
      const detail = document.createElement('p')
      detail.className = 'tm-empty__detail'
      detail.textContent = '可先进入病历质控生成问题，或切换状态筛选查看已关闭缺陷。'
      empty.append(title, detail)
      content.append(empty)
      return
    }

    filteredItems.forEach(item => {
      content.append(createDefectCard(item, options))
    })
  }

  render()
  return content
}
