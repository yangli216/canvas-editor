import {
  buildFieldIndex,
  type ITemplateField,
  type ITemplateSchema
} from '../../editor/template/index'
import {
  TemplateDocumentStore,
  type ITemplateDocumentRecord,
  type ITemplateDocumentTraceEvent
} from '../../editor/template/TemplateDocumentStore'

const WRITER_CONTEXT = {
  operator: '王医生',
  role: '住院医师',
  department: '呼吸内科',
  source: 'editor' as const
}

const REVIEW_CONTEXT = {
  operator: '李主任',
  role: '上级医师',
  department: '呼吸内科',
  source: 'editor' as const
}

function formatTime(timestamp?: number) {
  if (!timestamp) return '暂无'
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getActionLabel(event: ITemplateDocumentTraceEvent) {
  const labels: Record<ITemplateDocumentTraceEvent['action'], string> = {
    create: '创建实例',
    fork: '复制修订',
    writing_start: '开始书写',
    writing_update: '字段修订',
    writing_save: '提交保存',
    autosave: '自动暂存',
    save: '正式保存',
    sign: '医生签名',
    review: '上级复核',
    status_change: '状态变更',
    migrate: '模板迁移',
    manual: '手工记录'
  }
  return labels[event.action]
}

export class MedicalRecordTracePanel {
  private selectedFieldId = ''
  private currentDocumentId = ''
  private currentSchema: ITemplateSchema | null = null
  private hasStartedWriting = false

  constructor(
    private readonly container: HTMLElement,
    private readonly documentStore: TemplateDocumentStore
  ) {
    this.renderEmpty()
  }

  bindDocument(record: ITemplateDocumentRecord, schema: ITemplateSchema) {
    this.currentDocumentId = record.id
    this.currentSchema = schema
    this.selectedFieldId = this.selectedFieldId || this.getFields()[0]?.id || ''
    if (!this.hasStartedWriting) {
      this.documentStore.startWriting(record.id, {
        ...WRITER_CONTEXT,
        summary: `打开 ${record.title || schema.name} 开始书写`
      })
      this.hasStartedWriting = true
    }
    this.render()
  }

  private renderEmpty() {
    this.container.className = 'medical-record-trace'
    this.container.innerHTML = ''
    const card = document.createElement('div')
    card.className = 'mr-trace__empty'
    const title = document.createElement('strong')
    title.textContent = '病历书写留痕'
    const desc = document.createElement('span')
    desc.textContent = '从模板中心使用已发布模板后，这里会显示医生书写时间线、字段修订和签名复核记录。'
    card.append(title, desc)
    this.container.append(card)
  }

  private render() {
    const record = this.getCurrentRecord()
    if (!record || !this.currentSchema) {
      this.renderEmpty()
      return
    }
    this.container.className = 'medical-record-trace medical-record-trace--active'
    this.container.innerHTML = ''
    this.container.append(
      this.createHeader(record),
      this.createSummary(record),
      this.createWritingForm(record),
      this.createFieldTimeline(),
      this.createTimeline(record)
    )
  }

  private createHeader(record: ITemplateDocumentRecord) {
    const header = document.createElement('div')
    header.className = 'mr-trace__header'
    const title = document.createElement('div')
    const name = document.createElement('strong')
    name.textContent = record.title || '未命名病历'
    const meta = document.createElement('span')
    meta.textContent = `患者 ${record.patientId || '模拟患者'} · ${record.status}`
    title.append(name, meta)
    const badge = document.createElement('em')
    badge.textContent = `v${record.template.version}`
    header.append(title, badge)
    return header
  }

  private createSummary(record: ITemplateDocumentRecord) {
    const summary = this.documentStore.getWritingTraceSummary(record.id)
    const list = document.createElement('div')
    list.className = 'mr-trace__summary'
    ;[
      ['书写事件', summary?.writingEventCount ?? 0],
      ['变更字段', summary?.changedFieldIds.length ?? 0],
      ['签名', summary?.signCount ?? 0],
      ['复核', summary?.reviewCount ?? 0]
    ].forEach(([label, value]) => {
      const item = document.createElement('div')
      const valueEl = document.createElement('strong')
      valueEl.textContent = String(value)
      const labelEl = document.createElement('span')
      labelEl.textContent = String(label)
      item.append(valueEl, labelEl)
      list.append(item)
    })
    return list
  }

  private createWritingForm(record: ITemplateDocumentRecord) {
    const fields = this.getFields()
    const form = document.createElement('div')
    form.className = 'mr-trace__writer'

    const label = document.createElement('label')
    label.textContent = '当前字段'
    const select = document.createElement('select')
    fields.forEach(field => {
      const option = document.createElement('option')
      option.value = field.id
      option.textContent = `${field.label || field.id}（${field.id}）`
      select.append(option)
    })
    select.value = this.selectedFieldId
    select.addEventListener('change', () => {
      this.selectedFieldId = select.value
      this.render()
    })

    const input = document.createElement('textarea')
    input.placeholder = '输入本次医生书写内容'
    input.value = record.content.flatValues[this.selectedFieldId] ?? ''

    const actions = document.createElement('div')
    actions.className = 'mr-trace__actions'
    actions.append(
      this.createActionButton('记录书写', () => this.writeField(input.value)),
      this.createActionButton('提交保存', () => this.writeField(input.value, true)),
      this.createActionButton('签名', () => this.sign()),
      this.createActionButton('复核', () => this.review())
    )

    label.append(select)
    form.append(label, input, actions)
    return form
  }

  private createFieldTimeline() {
    const section = document.createElement('div')
    section.className = 'mr-trace__section'
    const title = document.createElement('h3')
    title.textContent = '字段修订轨迹'
    section.append(title)
    const events = this.currentDocumentId && this.selectedFieldId
      ? this.documentStore.getFieldTraceTimeline(this.currentDocumentId, this.selectedFieldId)
      : []
    if (!events.length) {
      const empty = document.createElement('p')
      empty.textContent = '当前字段暂无修订记录。'
      section.append(empty)
      return section
    }
    events.forEach(event => {
      const diff = event.changedFields?.find(item => item.fieldId === this.selectedFieldId)
      const row = document.createElement('div')
      row.className = 'mr-trace__field-diff'
      const meta = document.createElement('span')
      meta.textContent = `${event.operator || '系统'} · ${formatTime(event.timestamp)}`
      const before = document.createElement('del')
      before.textContent = diff?.before || '空值'
      const after = document.createElement('ins')
      after.textContent = diff?.after || '空值'
      row.append(meta, before, after)
      section.append(row)
    })
    return section
  }

  private createTimeline(record: ITemplateDocumentRecord) {
    const section = document.createElement('div')
    section.className = 'mr-trace__section mr-trace__timeline'
    const title = document.createElement('h3')
    title.textContent = '整份病历时间线'
    section.append(title)
    this.documentStore.getTraceTimeline(record.id).slice(0, 8).forEach(event => {
      const row = document.createElement('div')
      row.className = 'mr-trace__event'
      const action = document.createElement('strong')
      action.textContent = getActionLabel(event)
      const meta = document.createElement('span')
      meta.textContent = `${event.operator || '系统'} · ${formatTime(event.timestamp)}`
      const summary = document.createElement('em')
      summary.textContent = event.summary || `${event.changedFields?.length ?? 0} 个字段变更`
      row.append(action, meta, summary)
      section.append(row)
    })
    return section
  }

  private createActionButton(label: string, handler: () => void) {
    const button = document.createElement('button')
    button.type = 'button'
    button.textContent = label
    button.addEventListener('click', handler)
    return button
  }

  private writeField(value: string, commit = false) {
    if (!this.currentDocumentId || !this.selectedFieldId) return
    this.documentStore.write(this.currentDocumentId, {
      ...WRITER_CONTEXT,
      flatValues: {
        [this.selectedFieldId]: value
      },
      commit,
      summary: commit ? '医生提交保存病历内容' : '医生修订病历字段'
    })
    this.render()
  }

  private sign() {
    if (!this.currentDocumentId) return
    this.documentStore.signDocument(this.currentDocumentId, WRITER_CONTEXT)
    this.render()
  }

  private review() {
    if (!this.currentDocumentId) return
    this.documentStore.reviewWriting(this.currentDocumentId, {
      ...REVIEW_CONTEXT,
      summary: '上级医师已复核病历书写内容'
    })
    this.render()
  }

  private getCurrentRecord() {
    return this.currentDocumentId
      ? this.documentStore.get(this.currentDocumentId)
      : undefined
  }

  private getFields(): ITemplateField[] {
    if (!this.currentSchema) return []
    return Array.from(buildFieldIndex(this.currentSchema).values())
  }
}