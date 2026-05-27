import type { ITemplateTrialRunRecord } from '../../domain'
import {
  buildTrialRunCenterViewModel,
  type ITrialRunCenterViewModel
} from './service'

export interface ITrialRunCenterDraft {
  scenario: string
  patientId: string
  department: string
  status: ITemplateTrialRunRecord['status']
  summary: string
}

export function createTrialRunCenterView(args: {
  defaultDepartment?: string
  getRecords: () => ITemplateTrialRunRecord[]
  onOpenPreview: () => void
  onSave: (draft: ITrialRunCenterDraft) => void
}): HTMLDivElement {
  const content = document.createElement('div')
  content.className = 'tm-version-center'

  const actions = document.createElement('div')
  actions.className = 'tm-inline-actions'
  const previewBtn = document.createElement('button')
  previewBtn.type = 'button'
  previewBtn.className = 'td-designer__btn'
  previewBtn.textContent = '打开预览'
  previewBtn.onclick = args.onOpenPreview
  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'td-designer__btn td-designer__btn--primary'
  saveBtn.textContent = '保存验证结果'
  actions.append(previewBtn, saveBtn)

  const form = document.createElement('div')
  form.className = 'tm-governance-form'
  const scenario = document.createElement('select')
  scenario.className = 'tm-select tm-governance-form__input'
  ;['住院入院记录', '门诊病历', '手术记录', '护理记录', '知情同意'].forEach(label => {
    const option = document.createElement('option')
    option.value = label
    option.textContent = label
    scenario.append(option)
  })
  const patientId = document.createElement('input')
  patientId.type = 'text'
  patientId.className = 'td-props__input tm-governance-form__input'
  patientId.value = 'P-1001'
  patientId.placeholder = '测试患者 ID'
  const department = document.createElement('input')
  department.type = 'text'
  department.className = 'td-props__input tm-governance-form__input'
  department.value = args.defaultDepartment ?? ''
  department.placeholder = '测试科室'
  const status = document.createElement('select')
  status.className = 'tm-select tm-governance-form__input'
  ;([
    { label: '通过', value: 'passed' },
    { label: '失败', value: 'failed' }
  ] as Array<{ label: string; value: ITemplateTrialRunRecord['status'] }>).forEach(item => {
    const option = document.createElement('option')
    option.value = item.value
    option.textContent = item.label
    status.append(option)
  })
  const summary = document.createElement('textarea')
  summary.className = 'tm-release-flow__note'
  summary.placeholder = '记录本次试运行的输入、规则触发、导出结果或待修复问题'

  const createRow = (label: string, control: HTMLElement) => {
    const row = document.createElement('div')
    row.className = 'tm-governance-form__row'
    const title = document.createElement('label')
    title.textContent = label
    row.append(title, control)
    return row
  }

  form.append(
    createRow('测试场景', scenario),
    createRow('测试患者', patientId),
    createRow('测试科室', department),
    createRow('验证结果', status),
    createRow('验证说明', summary)
  )

  const summaryWrap = document.createElement('div')
  const historyWrap = document.createElement('div')
  historyWrap.className = 'tm-trial-history'

  const renderHistory = () => {
    const model: ITrialRunCenterViewModel = buildTrialRunCenterViewModel(args.getRecords())
    summaryWrap.className = 'tm-version-center__summary'
    summaryWrap.innerHTML = `
      <div><span>验证记录</span><strong>${model.summary.total}</strong></div>
      <div><span>通过 / 失败</span><strong>${model.summary.passedCount}/${model.summary.failedCount}</strong></div>
      <div><span>最新状态</span><strong>${model.summary.latestStatusText}</strong></div>
      <div><span>最近时间</span><strong>${model.summary.latestTimeText}</strong></div>
    `
    historyWrap.innerHTML = ''
    if (!model.history.length) {
      const empty = document.createElement('div')
      empty.className = 'tm-empty'
      const title = document.createElement('strong')
      title.className = 'tm-empty__title'
      title.textContent = '暂无试运行记录'
      const detail = document.createElement('p')
      detail.className = 'tm-empty__detail'
      detail.textContent = '下一步：先打开预览核对数据回填和规则触发，再保存本次试运行结果。'
      empty.append(title, detail)
      historyWrap.append(empty)
      return
    }
    model.history.forEach(record => {
      const row = document.createElement('div')
      row.className = 'tm-version-center__record'
      const statusText = document.createElement('span')
      statusText.textContent = record.statusText
      const scenarioText = document.createElement('strong')
      scenarioText.textContent = record.scenario
      const noteText = document.createElement('em')
      noteText.textContent = record.note
      const timeText = document.createElement('small')
      timeText.textContent = record.timeText
      row.append(statusText, scenarioText, noteText, timeText)
      historyWrap.append(row)
    })
  }

  saveBtn.onclick = () => {
    args.onSave({
      scenario: scenario.value,
      patientId: patientId.value.trim(),
      department: department.value.trim(),
      status: status.value as ITemplateTrialRunRecord['status'],
      summary: summary.value.trim() || '试运行验证已完成'
    })
    renderHistory()
  }

  content.append(actions, form, summaryWrap, historyWrap)
  renderHistory()
  return content
}