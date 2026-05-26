import type { IQualityCenterViewModel } from './service'

interface IQualityCenterViewOptions {
  getModel: () => IQualityCenterViewModel
  onToggleRule: (ruleId: string) => void
  onResetRules: () => void
}

export function createQualityCenterView(
  options: IQualityCenterViewOptions
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const render = () => {
    const model = options.getModel()
    content.innerHTML = ''

    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>当前模板</span><strong>${model.summary.templateCount}</strong></div>
      <div><span>规则启停</span><strong>${model.summary.ruleStateText}</strong></div>
      <div><span>阻断问题</span><strong>${model.summary.blockerCount}</strong></div>
      <div><span>留痕缺口</span><strong>${model.summary.incompleteTraceCount}</strong></div>
    `
    content.append(summary)

    const toolbar = document.createElement('div')
    toolbar.className = 'tm-center-toolbar'
    const hint = document.createElement('span')
    hint.textContent = '规则停用后保留命中统计，仅从准入开关中排除。'
    const resetBtn = document.createElement('button')
    resetBtn.className = 'td-designer__btn td-designer__btn--compact'
    resetBtn.textContent = '恢复默认'
    resetBtn.onclick = () => {
      options.onResetRules()
      render()
    }
    toolbar.append(hint, resetBtn)
    content.append(toolbar)

    model.rules.forEach(rule => {
      const item = document.createElement('div')
      item.className = 'tm-adapter-card'
      const header = document.createElement('div')
      header.className = 'tm-center-inline'
      const name = document.createElement('div')
      name.className = 'tm-adapter-card__name'
      name.textContent = rule.label
      const status = document.createElement('span')
      status.className = rule.enabled
        ? 'tm-center-badge tm-center-badge--success'
        : 'tm-center-badge tm-center-badge--muted'
      status.textContent = rule.statusText
      header.append(name, status)
      const detail = document.createElement('div')
      detail.className = 'tm-adapter-card__sources'
      detail.textContent = `${rule.description} / 当前命中 ${rule.hitCount}`
      const action = document.createElement('button')
      action.className = 'td-designer__btn td-designer__btn--compact td-designer__btn--primary'
      action.textContent = rule.actionLabel
      action.onclick = () => {
        options.onToggleRule(rule.id)
        render()
      }
      item.append(header, detail, action)
      content.append(item)
    })

    if (model.risks.length) {
      const riskTitle = document.createElement('div')
      riskTitle.className = 'tm-version-center__section-title'
      riskTitle.textContent = '高风险模板'
      content.append(riskTitle)

      const riskList = document.createElement('div')
      riskList.className = 'tm-admission-report__list'
      model.risks.forEach(risk => {
        const row = document.createElement('div')
        row.className =
          risk.level === 'blocker'
            ? 'tm-admission-report__item tm-admission-report__item--blocker'
            : 'tm-admission-report__item tm-admission-report__item--warning'
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
  }

  render()

  return content
}