import type { IAuditCenterViewModel } from './service'

function createRecordRow(record: {
  kind: 'template' | 'document'
  templateName: string
  action: string
  detail: string
  timeText: string
}) {
  const row = document.createElement('div')
  row.className = 'tm-version-center__record'

  const template = document.createElement('span')
  template.textContent = record.templateName
  const action = document.createElement('span')
  action.textContent = record.action
  const detail = document.createElement('em')
  detail.textContent = record.detail
  const time = document.createElement('small')
  time.textContent = record.timeText
  const kind = document.createElement('span')
  kind.className = 'tm-center-badge tm-center-badge--muted'
  kind.textContent = record.kind === 'template' ? '模板' : '病历'

  row.append(template, action, detail, time, kind)
  return row
}

export function createAuditCenterView(
  model: IAuditCenterViewModel
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  summary.innerHTML = `
    <div><span>模板审计记录</span><strong>${model.summary.auditCount}</strong></div>
    <div><span>病历追溯实例</span><strong>${model.summary.traceCount}</strong></div>
    <div><span>已签名病历</span><strong>${model.summary.signedCount}</strong></div>
    <div><span>待复核病历</span><strong>${model.summary.pendingReviewCount}</strong></div>
  `
  content.append(summary)

  const toolbar = document.createElement('div')
  toolbar.className = 'tm-center-toolbar'
  const typeSelect = document.createElement('select')
  typeSelect.className = 'tm-select tm-center-toolbar__select'
  ;[
    { label: '全部记录', value: 'all' },
    { label: '模板操作', value: 'template' },
    { label: '病历追溯', value: 'document' }
  ].forEach(option => {
    const el = document.createElement('option')
    el.value = option.value
    el.textContent = option.label
    typeSelect.append(el)
  })
  const keywordInput = document.createElement('input')
  keywordInput.className = 'tm-input tm-center-toolbar__input'
  keywordInput.placeholder = '按模板名、动作或详情筛选'
  const exportBtn = document.createElement('button')
  exportBtn.className = 'td-designer__btn td-designer__btn--compact td-designer__btn--primary'
  exportBtn.textContent = '导出筛选结果'
  toolbar.append(typeSelect, keywordInput, exportBtn)
  content.append(toolbar)

  const auditTitle = document.createElement('div')
  auditTitle.className = 'tm-version-center__section-title'
  auditTitle.textContent = '模板操作'
  content.append(auditTitle)

  const auditHistory = document.createElement('div')
  auditHistory.className = 'tm-version-center__history'
  content.append(auditHistory)

  const traceTitle = document.createElement('div')
  traceTitle.className = 'tm-version-center__section-title'
  traceTitle.textContent = '病历追溯'
  content.append(traceTitle)

  const traceHistory = document.createElement('div')
  traceHistory.className = 'tm-version-center__history'
  content.append(traceHistory)

  const emptyState = document.createElement('div')
  emptyState.className = 'tm-center-empty'
  emptyState.textContent = '当前筛选条件下暂无记录'

  const getKeyword = () => keywordInput.value.trim().toLowerCase()
  const matchesKeyword = (record: {
    templateName: string
    action: string
    detail: string
  }) => {
    const keyword = getKeyword()
    if (!keyword) return true
    return [record.templateName, record.action, record.detail]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  }

  const exportRecords = (records: Array<{
    kind: 'template' | 'document'
    templateName: string
    action: string
    detail: string
    timeText: string
    timestamp: number
  }>) => {
    const blob = new Blob([JSON.stringify(records, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `audit-center-export-${Date.now()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const render = () => {
    auditHistory.innerHTML = ''
    traceHistory.innerHTML = ''
    emptyState.remove()

    const filterType = typeSelect.value
    const filteredAudits = model.templateAudits.filter(record => {
      return (filterType === 'all' || filterType === 'template') &&
        matchesKeyword(record)
    })
    const filteredTraces = model.documentTraces.filter(record => {
      return (filterType === 'all' || filterType === 'document') &&
        matchesKeyword(record)
    })

    filteredAudits.forEach(record => {
      auditHistory.append(createRecordRow(record))
    })
    filteredTraces.forEach(record => {
      traceHistory.append(createRecordRow(record))
    })

    if (!filteredAudits.length && !filteredTraces.length) {
      content.append(emptyState)
    }

    exportBtn.onclick = () => {
      exportRecords([...filteredAudits, ...filteredTraces])
    }
  }

  typeSelect.onchange = render
  keywordInput.oninput = render
  render()

  return content
}