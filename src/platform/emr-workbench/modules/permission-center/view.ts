import type { IPermissionCenterViewModel } from './service'

interface IPermissionCenterViewOptions {
  getModel: () => IPermissionCenterViewModel
  onCycleAssignment: (assignmentId: string) => void
  onResetAssignments: () => void
}

export function createPermissionCenterView(
  options: IPermissionCenterViewOptions
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const render = () => {
    const model = options.getModel()
    content.innerHTML = ''

    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>角色预置</span><strong>${model.summary.roleCount}</strong></div>
      <div><span>权限范围</span><strong>${model.summary.uniqueScopeCount}</strong></div>
      <div><span>可发布角色</span><strong>${model.summary.publishRoleCount}</strong></div>
      <div><span>已分配岗位</span><strong>${model.summary.assignmentCount}</strong></div>
    `
    content.append(summary)

    model.roles.forEach(role => {
      const item = document.createElement('div')
      item.className = 'tm-adapter-card'
      const name = document.createElement('div')
      name.className = 'tm-adapter-card__name'
      name.textContent = role.label
      const detail = document.createElement('div')
      detail.className = 'tm-adapter-card__sources'
      detail.textContent = `${role.description} / ${role.scopesText}`
      const badge = document.createElement('div')
      badge.className = 'tm-center-badge'
      badge.textContent = `${role.scopeCount} 个权限范围`
      item.append(name, detail, badge)
      content.append(item)
    })

    const title = document.createElement('div')
    title.className = 'tm-version-center__section-title'
    title.textContent = '角色分配'
    content.append(title)

    const toolbar = document.createElement('div')
    toolbar.className = 'tm-center-toolbar'
    const hint = document.createElement('span')
    hint.textContent = '点击切换岗位即可模拟分配流转。'
    const resetBtn = document.createElement('button')
    resetBtn.className = 'td-designer__btn td-designer__btn--compact'
    resetBtn.textContent = '重置分配'
    resetBtn.onclick = () => {
      options.onResetAssignments()
      render()
    }
    toolbar.append(hint, resetBtn)
    content.append(toolbar)

    const assignmentList = document.createElement('div')
    assignmentList.className = 'tm-center-list'
    model.assignments.forEach(assignment => {
      const row = document.createElement('div')
      row.className = 'tm-center-list__row'
      const info = document.createElement('div')
      info.className = 'tm-center-list__info'
      const name = document.createElement('strong')
      name.textContent = `${assignment.scopeLabel} · ${assignment.owner}`
      const detail = document.createElement('small')
      detail.textContent = `当前岗位：${assignment.roleLabel} / 更新时间：${assignment.updatedText}`
      info.append(name, detail)
      const action = document.createElement('button')
      action.className = 'td-designer__btn td-designer__btn--compact td-designer__btn--primary'
      action.textContent = `切换为 ${assignment.nextRoleLabel}`
      action.onclick = () => {
        options.onCycleAssignment(assignment.id)
        render()
      }
      row.append(info, action)
      assignmentList.append(row)
    })
    content.append(assignmentList)
  }

  render()

  return content
}