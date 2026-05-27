import type { IAdmissionCenterViewModel } from './service'

export function createAdmissionCenterView(
  model: IAdmissionCenterViewModel,
  options?: {
    onOpenDesigner?: () => void
  }
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-admission-report'

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  summary.innerHTML = `
    <div><span>准入状态</span><strong>${model.summary.statusText}</strong></div>
    <div><span>阻断项</span><strong>${model.summary.blockerCount}</strong></div>
    <div><span>警告项</span><strong>${model.summary.warningCount}</strong></div>
    <div><span>数据覆盖</span><strong>${model.summary.dataBindingCoverage}%</strong></div>
    <div><span>病历引用</span><strong>${model.summary.boundDocumentCount}</strong></div>
  `
  content.append(summary)

  const list = document.createElement('div')
  list.className = 'tm-admission-report__list'
  if (!model.issues.length) {
    const empty = document.createElement('div')
    empty.className = 'tm-empty'
    const title = document.createElement('strong')
    title.className = 'tm-empty__title'
    title.textContent = '当前模板已通过发布准入检查'
    const detail = document.createElement('p')
    detail.className = 'tm-empty__detail'
    detail.textContent = '下一步：如内容已经过试运行验证，可直接进入发版流程送审或发布。'
    empty.append(title, detail)
    list.append(empty)
  }
  model.issues.forEach(issue => {
    const row = document.createElement('div')
    row.className = `tm-admission-report__item tm-admission-report__item--${issue.level}`
    const badge = document.createElement('span')
    badge.textContent = issue.levelText
    const message = document.createElement('strong')
    message.textContent = issue.message
    const category = document.createElement('small')
    category.textContent = issue.category
    row.append(badge, message, category)
    list.append(row)
  })
  content.append(list)

  if (options?.onOpenDesigner) {
    const actions = document.createElement('div')
    actions.className = 'tm-inline-actions'
    const repairBtn = document.createElement('button')
    repairBtn.type = 'button'
    repairBtn.className = 'td-designer__btn td-designer__btn--primary'
    repairBtn.textContent = '进入设计器修复'
    repairBtn.onclick = options.onOpenDesigner
    actions.append(repairBtn)
    content.append(actions)
  }

  return content
}