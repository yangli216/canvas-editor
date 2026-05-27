import type {
  IMedicalRecordArchiveCenterViewModel,
  IMedicalRecordArchiveChecklistItem,
  IMedicalRecordArchiveItem,
  MedicalRecordArchiveStatus
} from './service'

export interface IMedicalRecordArchiveCenterViewOptions {
  model: IMedicalRecordArchiveCenterViewModel
  onArchive?: (documentId: string) => void
  onOpenTrace?: (documentId: string) => void
  onOpenReadonly?: (documentId: string) => void
  onRequestPostArchiveRevision?: (documentId: string) => void
  onOpenPostArchiveRevisions?: (documentId: string) => void
}

type ArchiveStatusFilter = 'all' | MedicalRecordArchiveStatus

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

function createChecklistRow(item: IMedicalRecordArchiveChecklistItem) {
  const row = document.createElement('div')
  row.className = `tm-admission-report__item tm-admission-report__item--${item.passed ? 'info' : item.level}`
  const badge = document.createElement('span')
  badge.textContent = item.passed ? '通过' : item.level === 'blocker' ? '阻断' : '警告'
  const info = document.createElement('div')
  info.className = 'tm-center-list__info'
  const label = document.createElement('strong')
  label.textContent = item.label
  const detail = document.createElement('small')
  detail.textContent = `${item.detail} / ${item.actionHint}`
  info.append(label, detail)
  row.append(badge, info)
  return row
}

function createArchiveCard(
  item: IMedicalRecordArchiveItem,
  options: IMedicalRecordArchiveCenterViewOptions
) {
  const card = document.createElement('div')
  card.className = 'tm-adapter-card'

  const header = document.createElement('div')
  header.className = 'tm-center-inline'
  const titleWrap = document.createElement('div')
  titleWrap.className = 'tm-center-list__info'
  const title = document.createElement('strong')
  title.textContent = item.title
  const meta = document.createElement('small')
  meta.textContent = `${item.patientText} / ${item.templateText}`
  titleWrap.append(title, meta)

  const actions = document.createElement('div')
  actions.className = 'tm-inline-actions'
  const status = document.createElement('span')
  status.className = item.canArchive
    ? 'tm-center-badge tm-center-badge--success'
    : item.archiveStatus === 'archived'
      ? 'tm-center-badge tm-center-badge--muted'
      : 'tm-center-badge tm-center-badge--warning'
  status.textContent = item.archiveStatusText

  if (options.onOpenReadonly) {
    const readonlyBtn = document.createElement('button')
    readonlyBtn.type = 'button'
    readonlyBtn.className = 'td-designer__btn td-designer__btn--compact'
    readonlyBtn.textContent = '只读回显'
    readonlyBtn.onclick = () => options.onOpenReadonly?.(item.id)
    actions.append(readonlyBtn)
  }
  if (options.onOpenTrace) {
    const traceBtn = document.createElement('button')
    traceBtn.type = 'button'
    traceBtn.className = 'td-designer__btn td-designer__btn--compact'
    traceBtn.textContent = '归档时间线'
    traceBtn.onclick = () => options.onOpenTrace?.(item.id)
    actions.append(traceBtn)
  }
  if (options.onOpenPostArchiveRevisions && item.revisionSummary.revisionCount > 0) {
    const revisionListBtn = document.createElement('button')
    revisionListBtn.type = 'button'
    revisionListBtn.className = 'td-designer__btn td-designer__btn--compact'
    revisionListBtn.textContent = '修订记录'
    revisionListBtn.onclick = () => options.onOpenPostArchiveRevisions?.(item.id)
    actions.append(revisionListBtn)
  }
  if (options.onRequestPostArchiveRevision && item.status === 'archived') {
    const revisionBtn = document.createElement('button')
    revisionBtn.type = 'button'
    revisionBtn.className = 'td-designer__btn td-designer__btn--compact'
    revisionBtn.textContent = '修订申请'
    revisionBtn.onclick = () => options.onRequestPostArchiveRevision?.(item.id)
    actions.append(revisionBtn)
  }
  if (options.onArchive && item.canArchive) {
    const archiveBtn = document.createElement('button')
    archiveBtn.type = 'button'
    archiveBtn.className = 'td-designer__btn td-designer__btn--primary td-designer__btn--compact'
    archiveBtn.textContent = '归档冻结'
    archiveBtn.onclick = () => options.onArchive?.(item.id)
    actions.append(archiveBtn)
  }
  actions.append(status)
  header.append(titleWrap, actions)

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  summary.innerHTML = `
    <div><span>阻断 / 警告</span><strong>${item.blockerCount}/${item.warningCount}</strong></div>
    <div><span>责任人</span><strong>${item.ownerText}</strong></div>
    <div><span>最近书写</span><strong>${item.latestWrittenText}</strong></div>
    <div><span>归档时间</span><strong>${item.archivedAtText}</strong></div>
    <div><span>修订申请</span><strong>${item.revisionSummary.revisionCount}</strong></div>
    <div><span>快照字段</span><strong>${item.snapshotSummary.fieldCount}</strong></div>
  `

  const revisionSection = document.createElement('div')
  revisionSection.className = 'tm-admission-report__list'
  if (item.revisionSummary.revisionCount > 0) {
    const row = document.createElement('div')
    row.className = 'tm-admission-report__item tm-admission-report__item--warning'
    const badge = document.createElement('span')
    badge.textContent = item.revisionSummary.latestStatusText || '修订'
    const info = document.createElement('div')
    info.className = 'tm-center-list__info'
    const label = document.createElement('strong')
    label.textContent = '归档后修订'
    const detail = document.createElement('small')
    detail.textContent = item.revisionSummary.latestReason || '暂无修订说明'
    info.append(label, detail)
    row.append(badge, info)
    revisionSection.append(row)
  }

  const checklist = document.createElement('div')
  checklist.className = 'tm-admission-report__list'
  item.checklist.forEach(check => checklist.append(createChecklistRow(check)))

  card.append(header, summary)
  if (item.revisionSummary.revisionCount > 0) {
    card.append(revisionSection)
  }
  card.append(checklist)
  return card
}

export function createMedicalRecordArchiveCenterView(
  options: IMedicalRecordArchiveCenterViewOptions
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'
  let statusFilter: ArchiveStatusFilter = 'all'

  const render = () => {
    content.innerHTML = ''
    const { model } = options

    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>病历实例</span><strong>${model.summary.documentCount}</strong></div>
      <div><span>待归档</span><strong>${model.summary.pendingArchiveCount}</strong></div>
      <div><span>可归档</span><strong>${model.summary.canArchiveCount}</strong></div>
      <div><span>阻断病历</span><strong>${model.summary.blockedCount}</strong></div>
      <div><span>已归档</span><strong>${model.summary.archivedCount}</strong></div>
      <div><span>归档后修订</span><strong>${model.summary.postArchiveRevisionCount}</strong></div>
    `
    content.append(summary)

    const toolbar = document.createElement('div')
    toolbar.className = 'tm-center-toolbar'
    const hint = document.createElement('span')
    hint.textContent = '归档前检查模板快照、结构化字段值、签名复核、质控阻断项和归档状态。'
    const statusSelect = document.createElement('select')
    statusSelect.className = 'tm-center-toolbar__select'
    createOption(statusSelect, 'all', '全部状态')
    createOption(statusSelect, 'qualityReturned', '质控退回')
    createOption(statusSelect, 'pendingQuality', '待质控')
    createOption(statusSelect, 'pendingArchive', '待归档')
    createOption(statusSelect, 'archived', '已归档')
    createOption(statusSelect, 'postArchiveRevision', '归档后修订')
    statusSelect.value = statusFilter
    statusSelect.onchange = () => {
      statusFilter = statusSelect.value as ArchiveStatusFilter
      render()
    }
    toolbar.append(hint, statusSelect)
    content.append(toolbar)

    const filteredItems = model.items.filter(item => (
      statusFilter === 'all' || item.archiveStatus === statusFilter
    ))

    if (!filteredItems.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      const title = document.createElement('strong')
      title.className = 'tm-empty__title'
      title.textContent = '当前没有匹配的归档质检病历'
      const detail = document.createElement('p')
      detail.className = 'tm-empty__detail'
      detail.textContent = '可切换归档状态筛选，或先完成病历签名与质控复核。'
      empty.append(title, detail)
      content.append(empty)
      return
    }

    filteredItems.forEach(item => {
      content.append(createArchiveCard(item, options))
    })
  }

  render()
  return content
}
