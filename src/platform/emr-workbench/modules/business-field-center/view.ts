import type {
  IBusinessFieldCenterPendingCandidate,
  IBusinessFieldCenterFieldAsset,
  IBusinessFieldCenterFilters,
  IBusinessFieldCenterViewModel
} from './service'

interface IBusinessFieldCenterViewOptions {
  getModel: () => IBusinessFieldCenterViewModel
  onUpdateFilters: (filters: Partial<IBusinessFieldCenterFilters>) => void
  onResetFilters: () => void
  onApplyCandidate: (
    candidate: IBusinessFieldCenterPendingCandidate,
    rerender: () => void
  ) => void
  onMaintainField: (
    field: IBusinessFieldCenterFieldAsset,
    rerender: () => void
  ) => void
  onOpenTemplate: (templateId: string) => void
}

export function createBusinessFieldCenterView(
  options: IBusinessFieldCenterViewOptions
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const createSelect = (
    values: string[],
    current: string,
    placeholder: string,
    onChange: (value: string) => void
  ) => {
    const select = document.createElement('select')
    select.className = 'tm-select tm-center-toolbar__select'
    const empty = document.createElement('option')
    empty.value = ''
    empty.textContent = placeholder
    select.append(empty)
    values.forEach(value => {
      const option = document.createElement('option')
      option.value = value
      option.textContent = value
      select.append(option)
    })
    select.value = current
    select.onchange = () => {
      onChange(select.value)
      render()
    }
    return select
  }

  const render = () => {
    const model = options.getModel()
    content.innerHTML = ''

    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>适配器</span><strong>${model.summary.adapterCount}</strong></div>
      <div><span>主数据</span><strong>${model.summary.masterFieldText}</strong></div>
      <div><span>已绑定</span><strong>${model.summary.boundFieldText}</strong></div>
      <div><span>风险 / 分组</span><strong>${model.summary.conflictCount}/${model.summary.groupCount}</strong></div>
    `
    content.append(summary)

    const toolbar = document.createElement('div')
    toolbar.className = 'tm-center-toolbar'
    const keyword = document.createElement('input')
    keyword.type = 'search'
    keyword.className = 'td-props__input tm-center-toolbar__input'
    keyword.placeholder = '搜索字段、模板、业务编码、导出路径'
    keyword.value = model.filters.keyword
    keyword.oninput = () => {
      options.onUpdateFilters({ keyword: keyword.value })
      render()
    }
    const group = createSelect(
      model.filters.groups,
      model.filters.group,
      '全部分组',
      value => options.onUpdateFilters({ group: value })
    )
    const dataSource = createSelect(
      model.filters.dataSources,
      model.filters.dataSource,
      '全部数据源',
      value => options.onUpdateFilters({ dataSource: value })
    )
    const permission = createSelect(
      model.filters.permissions,
      model.filters.permission,
      '全部权限',
      value => options.onUpdateFilters({ permission: value })
    )
    const scope = document.createElement('select')
    scope.className = 'tm-select tm-center-toolbar__select'
    ;[
      { value: 'all', label: '全部资产' },
      { value: 'editable', label: '仅可维护' },
      { value: 'builtin', label: '仅内置' }
    ].forEach(item => {
      const option = document.createElement('option')
      option.value = item.value
      option.textContent = item.label
      scope.append(option)
    })
    scope.value = model.filters.scope
    scope.onchange = () => {
      options.onUpdateFilters({ scope: scope.value as IBusinessFieldCenterFilters['scope'] })
      render()
    }
    const resetBtn = document.createElement('button')
    resetBtn.className = 'td-designer__btn td-designer__btn--compact'
    resetBtn.textContent = '重置筛选'
    resetBtn.onclick = () => {
      options.onResetFilters()
      render()
    }
    toolbar.append(keyword, group, dataSource, permission, scope, resetBtn)
    content.append(toolbar)

    model.adapters.forEach(adapter => {
      const item = document.createElement('div')
      item.className = 'tm-adapter-card'
      const name = document.createElement('div')
      name.className = 'tm-adapter-card__name'
      name.textContent = adapter.label
      const detail = document.createElement('div')
      detail.className = 'tm-adapter-card__sources'
      detail.textContent = `${adapter.description} / ${adapter.sourcesText}`
      item.append(name, detail)
      content.append(item)
    })

    if (model.pendingCandidates.length) {
      const candidateTitle = document.createElement('div')
      candidateTitle.className = 'tm-version-center__section-title'
      candidateTitle.textContent = '待处理候选主数据'
      content.append(candidateTitle)

      const candidateList = document.createElement('div')
      candidateList.className = 'tm-center-list'
      model.pendingCandidates.forEach(candidate => {
        const row = document.createElement('div')
        row.className = 'tm-center-list__row'

        const info = document.createElement('div')
        info.className = 'tm-center-list__info'
        const name = document.createElement('strong')
        name.textContent = `${candidate.name} · ${candidate.code}`
        const detail = document.createElement('small')
        detail.textContent = `分组 ${candidate.group || '未分组'} / 数据源 ${candidate.dataSource || '未绑定'} / 权限 ${candidate.permission || '未标记'} / 导出 ${candidate.exportPath || '未配置'}`
        const usage = document.createElement('small')
        usage.textContent = candidate.metadataFieldName
          ? `已命中主数据 ${candidate.metadataFieldName}，待补绑定 ${candidate.pendingUsageCount} 处 / 模板 ${candidate.templateNames.join('、')}`
          : `待生成主数据并绑定 ${candidate.pendingUsageCount} 处 / 模板 ${candidate.templateNames.join('、')}`
        info.append(name, detail, usage)

        const actions = document.createElement('div')
        actions.className = 'tm-center-inline'
        const badge = document.createElement('span')
        badge.className = 'tm-center-badge tm-center-badge--warning'
        badge.textContent = candidate.metadataFieldId
          ? `待绑定 ${candidate.pendingUsageCount}`
          : `待纳管 ${candidate.pendingUsageCount}`
        const applyBtn = document.createElement('button')
        applyBtn.className = 'td-designer__btn td-designer__btn--compact td-designer__btn--primary'
        applyBtn.textContent = candidate.metadataFieldId
          ? '绑定现有主数据'
          : '生成主数据并绑定'
        applyBtn.onclick = () => options.onApplyCandidate(candidate, render)
        actions.append(badge, applyBtn)

        row.append(info, actions)
        candidateList.append(row)
      })
      content.append(candidateList)
    }

    const fieldTitle = document.createElement('div')
    fieldTitle.className = 'tm-version-center__section-title'
    fieldTitle.textContent = '字段主数据清单'
    content.append(fieldTitle)

    if (!model.fields.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-center-empty'
      empty.textContent = '当前筛选条件下没有字段资产，可尝试调整检索词或筛选范围。'
      content.append(empty)
    } else {
      const fieldList = document.createElement('div')
      fieldList.className = 'tm-center-list'
      model.fields.forEach(field => {
        const row = document.createElement('div')
        row.className = 'tm-center-list__row'
        const info = document.createElement('div')
        info.className = 'tm-center-list__info'
        const name = document.createElement('strong')
        name.textContent = `${field.label} · ${field.businessCode}`
        const detail = document.createElement('small')
        detail.textContent = `分组 ${field.group || '未分组'} / 数据源 ${field.dataSource || '未绑定'} / 权限 ${field.permission || '未标记'} / 导出 ${field.exportPath || '未配置'}`
        const usage = document.createElement('small')
        usage.textContent = field.templateNames.length
          ? `引用模板：${field.templateNames.join('、')} / ${field.issueText}`
          : `引用模板：暂无 / ${field.issueText}`
        const mapping = document.createElement('small')
        mapping.textContent = `医院映射：${field.hospitalMappingText}`
        const recommendation = document.createElement('small')
        recommendation.textContent = field.recommendedPresetLabels.length
          ? `智能推荐：${field.recommendedPresetLabels.join('、')}`
          : '智能推荐：暂无明显命中，可手动选择字段快配'
        info.append(name, detail, usage, mapping, recommendation)

        const actions = document.createElement('div')
        actions.className = 'tm-center-inline'
        const badge = document.createElement('span')
        badge.className = field.issueCount
          ? 'tm-center-badge tm-center-badge--warning'
          : 'tm-center-badge tm-center-badge--success'
        badge.textContent = field.statusText
        const locateBtn = document.createElement('button')
        locateBtn.className = 'td-designer__btn td-designer__btn--compact'
        locateBtn.textContent = '定位模板'
        locateBtn.disabled = !field.templateIds.length
        locateBtn.onclick = () => {
          const templateId = field.templateIds[0]
          if (templateId) options.onOpenTemplate(templateId)
        }
        const maintainBtn = document.createElement('button')
        maintainBtn.className = 'td-designer__btn td-designer__btn--compact'
        maintainBtn.textContent = '维护主数据'
        maintainBtn.onclick = () => options.onMaintainField(field, render)
        actions.append(badge, locateBtn, maintainBtn)

        row.append(info, actions)
        fieldList.append(row)
      })
      content.append(fieldList)
    }

    if (model.risks.length) {
      const title = document.createElement('div')
      title.className = 'tm-version-center__section-title'
      title.textContent = '待修复绑定风险'
      content.append(title)

      const riskList = document.createElement('div')
      riskList.className = 'tm-admission-report__list'
      model.risks.forEach(risk => {
        const row = document.createElement('div')
        row.className = 'tm-admission-report__item tm-admission-report__item--warning'
        const badge = document.createElement('span')
        badge.textContent = risk.badgeText
        const name = document.createElement('strong')
        name.textContent = risk.code
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