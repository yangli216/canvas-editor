import type {
  IMedicalRecordQualityItem,
  IMedicalRecordQualityViewModel,
  MedicalRecordQualityLevel,
  MedicalRecordQualityStage
} from './service'

export interface IMedicalRecordQualityCenterViewOptions {
  model: IMedicalRecordQualityViewModel
  onOpenDocumentTrace?: (documentId: string) => void
  onOpenTemplate?: (templateId: string) => void
  onOpenVersionCenter?: (templateId: string) => void
  onOpenField?: (documentId: string, fieldId: string) => void
}

type StageFilter = 'all' | MedicalRecordQualityStage
type RiskFilter = 'all' | MedicalRecordQualityLevel
type StatusFilter = 'all' | IMedicalRecordQualityItem['status']

function getRiskBadgeClass(level: MedicalRecordQualityLevel) {
  return level === 'blocker'
    ? 'tm-center-badge tm-center-badge--danger'
    : level === 'warning'
      ? 'tm-center-badge tm-center-badge--warning'
      : 'tm-center-badge tm-center-badge--success'
}

function createEmptyState(): HTMLDivElement {
  const empty = document.createElement('div')
  empty.className = 'tm-empty'
  const title = document.createElement('strong')
  title.className = 'tm-empty__title'
  title.textContent = '当前没有匹配的病历质控任务'
  const detail = document.createElement('p')
  detail.className = 'tm-empty__detail'
  detail.textContent = '可调整阶段或风险筛选，或先使用已发布模板创建病历实例。'
  empty.append(title, detail)
  return empty
}

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

function createSelect(
  value: string,
  options: Array<{ value: string; label: string }>,
  onChange: (value: string) => void
) {
  const select = document.createElement('select')
  select.className = 'tm-center-toolbar__select'
  options.forEach(option => createOption(select, option.value, option.label))
  select.value = value
  select.onchange = () => onChange(select.value)
  return select
}

function createIssueRow(
  item: IMedicalRecordQualityItem,
  issue: IMedicalRecordQualityItem['issues'][number],
  options: IMedicalRecordQualityCenterViewOptions
) {
  const row = document.createElement('div')
  row.className = `tm-admission-report__item tm-admission-report__item--${issue.level === 'blocker' ? 'blocker' : 'warning'}`

  const badge = document.createElement('span')
  badge.textContent = issue.levelText
  const messageWrap = document.createElement('div')
  messageWrap.className = 'tm-center-list__info'
  const message = document.createElement('strong')
  message.textContent = issue.message
  const detail = document.createElement('small')
  detail.textContent = `${issue.category} / ${issue.actionHint}`
  messageWrap.append(message, detail)

  const actions = document.createElement('div')
  actions.className = 'tm-inline-actions'
  if (issue.fieldId && options.onOpenField) {
    const fieldBtn = document.createElement('button')
    fieldBtn.type = 'button'
    fieldBtn.className = 'td-designer__btn td-designer__btn--compact'
    fieldBtn.textContent = '定位字段'
    fieldBtn.onclick = () => options.onOpenField?.(item.id, issue.fieldId!)
    actions.append(fieldBtn)
  }
  if (options.onOpenDocumentTrace) {
    const traceBtn = document.createElement('button')
    traceBtn.type = 'button'
    traceBtn.className = 'td-designer__btn td-designer__btn--compact'
    traceBtn.textContent = '查看留痕'
    traceBtn.onclick = () => options.onOpenDocumentTrace?.(item.id)
    actions.append(traceBtn)
  }

  row.append(badge, messageWrap, actions)
  return row
}

function createDocumentCard(
  item: IMedicalRecordQualityItem,
  options: IMedicalRecordQualityCenterViewOptions
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
  meta.textContent = `${item.patientText} / ${item.departmentText} / ${item.documentTypeText}`
  const templateMeta = document.createElement('small')
  templateMeta.textContent = item.templateText
  titleWrap.append(title, meta, templateMeta)

  const risk = document.createElement('span')
  risk.className = getRiskBadgeClass(item.riskLevel)
  risk.textContent = item.riskText
  const headerActions = document.createElement('div')
  headerActions.className = 'tm-inline-actions'
  if (options.onOpenTemplate) {
    const templateBtn = document.createElement('button')
    templateBtn.type = 'button'
    templateBtn.className = 'td-designer__btn td-designer__btn--compact'
    templateBtn.textContent = '打开模板'
    templateBtn.onclick = () => options.onOpenTemplate?.(item.templateId)
    headerActions.append(templateBtn)
  }
  if (options.onOpenVersionCenter) {
    const versionBtn = document.createElement('button')
    versionBtn.type = 'button'
    versionBtn.className = 'td-designer__btn td-designer__btn--compact'
    versionBtn.textContent = '版本中心'
    versionBtn.onclick = () => options.onOpenVersionCenter?.(item.templateId)
    headerActions.append(versionBtn)
  }
  headerActions.append(risk)
  header.append(titleWrap, headerActions)

  const summary = document.createElement('div')
  summary.className = 'tm-version-center__summary'
  summary.innerHTML = `
    <div><span>质控阶段</span><strong>${item.stageText}</strong></div>
    <div><span>病历状态</span><strong>${item.statusText}</strong></div>
    <div><span>阻断 / 警告</span><strong>${item.blockerCount}/${item.warningCount}</strong></div>
    <div><span>责任人</span><strong>${item.ownerText}</strong></div>
    <div><span>最近书写</span><strong>${item.latestWrittenText}</strong></div>
  `

  const issueList = document.createElement('div')
  issueList.className = 'tm-admission-report__list'
  if (!item.issues.length) {
    const ok = document.createElement('div')
    ok.className = 'tm-admission-report__item tm-admission-report__item--info'
    const badge = document.createElement('span')
    badge.textContent = '通过'
    const message = document.createElement('strong')
    message.textContent = '当前病历未发现质控问题'
    const detail = document.createElement('small')
    detail.textContent = '可进入归档前质检或保持持续观察'
    ok.append(badge, message, detail)
    issueList.append(ok)
  }
  item.issues.slice(0, 4).forEach(issue => {
    issueList.append(createIssueRow(item, issue, options))
  })

  card.append(header, summary, issueList)
  return card
}

export function createMedicalRecordQualityCenterView(
  options: IMedicalRecordQualityCenterViewOptions
): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  let stageFilter: StageFilter = 'all'
  let riskFilter: RiskFilter = 'all'
  let departmentFilter = 'all'
  let documentTypeFilter = 'all'
  let ownerFilter = 'all'
  let statusFilter: StatusFilter = 'all'

  const render = () => {
    content.innerHTML = ''
    const model = options.model

    const summary = document.createElement('div')
    summary.className = 'tm-version-center__summary'
    summary.innerHTML = `
      <div><span>病历实例</span><strong>${model.summary.documentCount}</strong></div>
      <div><span>阻断病历</span><strong>${model.summary.blockerDocumentCount}</strong></div>
      <div><span>待确认</span><strong>${model.summary.warningDocumentCount}</strong></div>
      <div><span>待归档</span><strong>${model.summary.pendingArchiveCount}</strong></div>
      <div><span>已签名 / 已归档</span><strong>${model.summary.signedCount}/${model.summary.archivedCount}</strong></div>
    `
    content.append(summary)

    const analytics = document.createElement('div')
    analytics.className = 'tm-center-list'
    const topCategory = model.analytics.hitStats.byCategory[0]
    const topTemplate = model.analytics.hitStats.byTemplate[0]
    const topDocumentType = model.analytics.hitStats.byDocumentType[0]
    const topPackage = model.analytics.hitStats.byRulePackage[0]
    ;[
      {
        label: '高频问题类型',
        value: topCategory
          ? `${topCategory.label}（${topCategory.hitCount} 次）`
          : '暂无命中'
      },
      {
        label: '高风险模板',
        value: topTemplate
          ? `${topTemplate.label}（${topTemplate.blockerCount} 阻断）`
          : '暂无命中'
      },
      {
        label: '高风险文书类型',
        value: topDocumentType
          ? `${topDocumentType.label}（${topDocumentType.hitCount} 次）`
          : '暂无命中'
      },
      {
        label: '高频规则包',
        value: topPackage
          ? `${topPackage.label}（${topPackage.hitCount} 次）`
          : '暂无命中'
      }
    ].forEach(item => {
      const row = document.createElement('div')
      row.className = 'tm-center-list__row'
      const info = document.createElement('div')
      info.className = 'tm-center-list__info'
      const label = document.createElement('strong')
      label.textContent = item.label
      const detail = document.createElement('small')
      detail.textContent = item.value
      info.append(label, detail)
      row.append(info)
      analytics.append(row)
    })
    content.append(analytics)

    if (model.analytics.impactAssessment) {
      const impact = model.analytics.impactAssessment
      const impactCard = document.createElement('div')
      impactCard.className = 'tm-adapter-card'
      const title = document.createElement('strong')
      title.textContent = '规则变更影响评估'
      const detail = document.createElement('small')
      detail.textContent = [
        `新增命中病历 ${impact.newlyHitDocumentCount} 份`,
        `新增阻断 ${impact.newlyHitBlockerIssueCount} 项`,
        `新增警告 ${impact.newlyHitWarningIssueCount} 项`,
        `风险文书类型：${impact.newlyHitDocumentTypeTexts.join('、') || '暂无'}`
      ].join(' / ')
      impactCard.append(title, detail)
      content.append(impactCard)
    }

    const toolbar = document.createElement('div')
    toolbar.className = 'tm-center-toolbar'
    const hint = document.createElement('span')
    hint.textContent = '按病历实例汇总必填、签名、复核、保存留痕与归档前阻断项。'
    const departmentSelect = createSelect(
      departmentFilter,
      [
        { value: 'all', label: '全部科室' },
        ...model.filterOptions.departments.map(value => ({ value, label: value }))
      ],
      value => {
        departmentFilter = value
        render()
      }
    )

    const documentTypeSelect = createSelect(
      documentTypeFilter,
      [
        { value: 'all', label: '全部文书' },
        ...model.filterOptions.documentTypes.map(value => ({ value, label: value }))
      ],
      value => {
        documentTypeFilter = value
        render()
      }
    )

    const ownerSelect = createSelect(
      ownerFilter,
      [
        { value: 'all', label: '全部医生' },
        ...model.filterOptions.owners.map(value => ({ value, label: value }))
      ],
      value => {
        ownerFilter = value
        render()
      }
    )

    const statusSelect = createSelect(
      statusFilter,
      [
        { value: 'all', label: '全部状态' },
        ...model.filterOptions.statuses
      ],
      value => {
        statusFilter = value as StatusFilter
        render()
      }
    )

    const stageSelect = createSelect(
      stageFilter,
      [
        { value: 'all', label: '全部阶段' },
        { value: 'writing', label: '书写中质控' },
        { value: 'submit', label: '提交前质控' },
        { value: 'archive', label: '归档前质控' }
      ],
      value => {
        stageFilter = value as StageFilter
        render()
      }
    )

    const riskSelect = createSelect(
      riskFilter,
      [
        { value: 'all', label: '全部风险' },
        { value: 'blocker', label: '高风险' },
        { value: 'warning', label: '待确认' },
        { value: 'info', label: '可归档' }
      ],
      value => {
        riskFilter = value as RiskFilter
        render()
      }
    )
    toolbar.append(
      hint,
      departmentSelect,
      documentTypeSelect,
      ownerSelect,
      statusSelect,
      stageSelect,
      riskSelect
    )
    content.append(toolbar)

    const filteredItems = model.items.filter(item => {
      const matchedDepartment = departmentFilter === 'all'
        || item.departmentText === departmentFilter
      const matchedDocumentType = documentTypeFilter === 'all'
        || item.documentTypeText === documentTypeFilter
      const matchedOwner = ownerFilter === 'all' || item.ownerText === ownerFilter
      const matchedStatus = statusFilter === 'all' || item.status === statusFilter
      const matchedStage = stageFilter === 'all' || item.stage === stageFilter
      const matchedRisk = riskFilter === 'all' || item.riskLevel === riskFilter
      return matchedDepartment
        && matchedDocumentType
        && matchedOwner
        && matchedStatus
        && matchedStage
        && matchedRisk
    })

    if (!filteredItems.length) {
      content.append(createEmptyState())
      return
    }

    filteredItems.forEach(item => {
      content.append(createDocumentCard(item, options))
    })
  }

  render()
  return content
}
