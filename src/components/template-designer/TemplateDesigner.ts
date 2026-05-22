import { EDITOR_COMPONENT, EditorComponent } from '../../editor'
import Editor from '../../editor'
import { PaperDirection } from '../../editor/dataset/enum/Editor'
import type { ITemplateSchema, ITemplateBlock, ITemplateField, ITemplateLayout } from '../../editor/template/index'
import { compileTemplate, getPageConfig } from '../../editor/template/index'
import type { ITemplateRegistryEntry } from '../../editor/template/TemplateRegistry'
import { TemplateRuleEngine } from '../../editor/template/TemplateRuleEngine'
import { BlockPalette } from './BlockPalette'
import { SchemaCanvas } from './SchemaCanvas'
import { PropertiesPanel } from './PropertiesPanel'
import { TemplatePreviewDialog } from './TemplatePreviewDialog'
import type { SelectionTarget } from './SchemaCanvas'
import './template-designer.css'

export interface ITemplateDesignerOptions {
  onSave: (schema: ITemplateSchema, category: string) => void
  onClose: () => void
}

function generateId(): string {
  return `tpl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function genFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

const ZONE_BLOCK_TYPES: Array<ITemplateBlock['type']> = [
  'staticText', 'paragraph', 'fieldRow', 'separator', 'table'
]

const ZONE_BLOCK_LABEL: Record<string, string> = {
  staticText: '静态文本',
  paragraph: '段落',
  fieldRow: '字段行',
  separator: '分隔线',
  table: '表格'
}

export class TemplateDesigner {
  private mask: HTMLDivElement
  private container: HTMLDivElement
  private schema: ITemplateSchema
  private headerBlocks: ITemplateBlock[] = []
  private footerBlocks: ITemplateBlock[] = []
  private activeZone: 'main' | 'header' | 'footer' = 'main'
  private canvas: SchemaCanvas
  private props: PropertiesPanel
  private options: ITemplateDesignerOptions
  private selection: SelectionTarget = null
  private nameInput!: HTMLInputElement
  private descInput!: HTMLInputElement
  private categoryInput!: HTMLInputElement
  private initialCategory: string = ''
  private _savedSchemaJSON: string = ''
  private headerZoneBodyEl!: HTMLDivElement
  private footerZoneBodyEl!: HTMLDivElement
  private headerZoneCountEl!: HTMLSpanElement
  private footerZoneCountEl!: HTMLSpanElement
  // inline preview
  private previewEditorEl!: HTMLDivElement
  private previewContentEl!: HTMLDivElement
  private designContentEl!: HTMLDivElement
  private tabDesignBtn!: HTMLButtonElement
  private tabPreviewBtn!: HTMLButtonElement
  private activeTab: 'design' | 'preview' = 'design'
  private previewEditorInstance: InstanceType<typeof Editor> | null = null
  private previewRuleEngine: TemplateRuleEngine | null = null
  private previewDebounceTimer: ReturnType<typeof setTimeout> | null = null
  private resizeObserver: ResizeObserver | null = null

  constructor(options: ITemplateDesignerOptions, initial?: Partial<ITemplateSchema> | ITemplateRegistryEntry) {
    this.options = options

    const entry = initial as ITemplateRegistryEntry | undefined
    const schema = entry?.schema ?? (initial as ITemplateSchema | undefined)
    this.initialCategory = entry?.category ?? ''

    this.schema = {
      version: '1.0.0',
      id: generateId(),
      name: '新模板',
      description: '',
      blocks: [],
      ...schema
    }

    this.headerBlocks = this.schema.header ? [...this.schema.header] : []
    this.footerBlocks = this.schema.footer ? [...this.schema.footer] : []

    this._savedSchemaJSON = JSON.stringify(this.schema)

    this.canvas = new SchemaCanvas({
      onSelect: target => this._handleCanvasSelect(target),
      onDelete: index => this._handleDeleteBlock(index),
      onMoveUp: index => this._handleMoveBlock(index, -1),
      onMoveDown: index => this._handleMoveBlock(index, 1),
      onReorder: blocks => this._handleReorder(blocks),
      onCopy: (index, cloned) => this._handleCopy(index, cloned),
      onNestedInsert: (parentIndex, block) => this._handleNestedInsert(parentIndex, block),
      onNestedDelete: (parentIndex, childIndex) => this._handleNestedDelete(parentIndex, childIndex),
      onNestedMoveUp: (parentIndex, childIndex) => this._handleNestedMove(parentIndex, childIndex, -1),
      onNestedMoveDown: (parentIndex, childIndex) => this._handleNestedMove(parentIndex, childIndex, 1),
      onNestedReorder: (parentIndex, children) => this._handleNestedReorder(parentIndex, children)
    })

    this.props = new PropertiesPanel({
      onBlockChange: (blockIndex, updated) => this._handleBlockChange(blockIndex, updated),
      onFieldChange: (blockIndex, fieldId, updated) =>
        this._handleFieldChange(blockIndex, fieldId, updated),
      onAddField: blockIndex => this._handleAddField(blockIndex),
      onLayoutChange: layout => this._handleLayoutChange(layout)
    })

    const { mask, container } = this._render()
    this.mask = mask
    this.container = container
    this.canvas.setBlocks(this.schema.blocks)
    this.props.setLayout(this.schema.layout)
    this.props.update(this.schema.blocks, null)
  }

  // ── Zone-aware block access ───────────────────────────────────────────────

  private _getActiveBlocks(): ITemplateBlock[] {
    if (this.activeZone === 'header') return this.headerBlocks
    if (this.activeZone === 'footer') return this.footerBlocks
    return this.schema.blocks
  }

  private _setActiveBlocks(blocks: ITemplateBlock[]) {
    if (this.activeZone === 'header') {
      this.headerBlocks = blocks
      this._rebuildZoneBody('header')
    } else if (this.activeZone === 'footer') {
      this.footerBlocks = blocks
      this._rebuildZoneBody('footer')
    } else {
      this.schema = { ...this.schema, blocks }
      this.canvas.setBlocks(blocks)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  private _render() {
    const mask = document.createElement('div')
    mask.className = 'td-mask'
    mask.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)
    document.body.append(mask)

    const container = document.createElement('div')
    container.className = 'td-overlay'
    container.setAttribute(EDITOR_COMPONENT, EditorComponent.COMPONENT)

    const designer = document.createElement('div')
    designer.className = 'td-designer'

    designer.append(this._renderHeader(), this._renderBody())
    container.append(designer)
    document.body.append(container)

    // Wide mode: show design + preview side by side when screen is wide enough
    this.resizeObserver = new ResizeObserver(entries => {
      const width = entries[0].contentRect.width
      const isWide = width >= 1300
      designer.classList.toggle('td-designer--wide', isWide)
      if (isWide && this.activeTab === 'design') {
        this._schedulePreviewRefresh()
      }
    })
    this.resizeObserver.observe(designer)

    return { mask, container }
  }

  private _renderHeader(): HTMLDivElement {
    const header = document.createElement('div')
    header.className = 'td-designer__header'

    const left = document.createElement('div')
    left.className = 'td-designer__header-left'

    const nameLabel = document.createElement('label')
    nameLabel.textContent = '模板名称：'
    this.nameInput = document.createElement('input')
    this.nameInput.className = 'td-designer__name-input'
    this.nameInput.type = 'text'
    this.nameInput.value = this.schema.name
    this.nameInput.placeholder = '请输入模板名称'
    left.append(nameLabel, this.nameInput)

    const descLabel = document.createElement('label')
    descLabel.textContent = '描述：'
    this.descInput = document.createElement('input')
    this.descInput.className = 'td-designer__desc-input'
    this.descInput.type = 'text'
    this.descInput.value = this.schema.description ?? ''
    this.descInput.placeholder = '可选描述'
    left.append(descLabel, this.descInput)

    const catLabel = document.createElement('label')
    catLabel.textContent = '分类：'
    this.categoryInput = document.createElement('input')
    this.categoryInput.className = 'td-designer__cat-input'
    this.categoryInput.type = 'text'
    this.categoryInput.value = this.initialCategory
    this.categoryInput.placeholder = '如：住院记录'
    left.append(catLabel, this.categoryInput)

    const right = document.createElement('div')
    right.className = 'td-designer__header-right'

    const previewBtn = document.createElement('button')
    previewBtn.className = 'td-designer__btn td-designer__btn--preview'
    previewBtn.textContent = '预览'
    previewBtn.type = 'button'
    previewBtn.addEventListener('click', () => this._handlePreview())

    const saveBtn = document.createElement('button')
    saveBtn.className = 'td-designer__btn td-designer__btn--primary'
    saveBtn.textContent = '保存'
    saveBtn.type = 'button'
    saveBtn.addEventListener('click', () => this._handleSave())

    const closeBtn = document.createElement('button')
    closeBtn.className = 'td-designer__btn'
    closeBtn.textContent = '关闭'
    closeBtn.type = 'button'
    closeBtn.addEventListener('click', () => this._handleClose())

    right.append(previewBtn, saveBtn, closeBtn)
    header.append(left, right)
    return header
  }

  private _renderBody(): HTMLDivElement {
    const body = document.createElement('div')
    body.className = 'td-designer__body'

    const palette = new BlockPalette(
      type => {
        this.activeZone = 'main'
        this.canvas.addBlock(type)
        this.schema = { ...this.schema, blocks: this.canvas.getBlocks() }
        this.props.update(this.schema.blocks, this.selection)
        this._schedulePreviewRefresh()
      },
      blocks => this._handlePresetInsert(blocks)
    )

    const paletteWrap = document.createElement('div')
    paletteWrap.className = 'td-designer__left'
    paletteWrap.append(palette.getElement())

    const canvasWrap = document.createElement('div')
    canvasWrap.className = 'td-designer__center'

    // Tab row
    const tabRow = document.createElement('div')
    tabRow.className = 'td-designer__tab-row'

    this.tabDesignBtn = document.createElement('button')
    this.tabDesignBtn.className = 'td-designer__tab td-designer__tab--active'
    this.tabDesignBtn.textContent = '设计'
    this.tabDesignBtn.type = 'button'
    this.tabDesignBtn.addEventListener('click', () => this._switchTab('design'))

    this.tabPreviewBtn = document.createElement('button')
    this.tabPreviewBtn.className = 'td-designer__tab'
    this.tabPreviewBtn.textContent = '预览'
    this.tabPreviewBtn.type = 'button'
    this.tabPreviewBtn.addEventListener('click', () => this._switchTab('preview'))

    tabRow.append(this.tabDesignBtn, this.tabPreviewBtn)

    // Design content
    this.designContentEl = document.createElement('div')
    this.designContentEl.className = 'td-designer__tab-content'

    const centerColumn = document.createElement('div')
    centerColumn.className = 'td-designer__center-column'

    const headerZoneEl = this._renderZonePanel('header')
    const footerZoneEl = this._renderZonePanel('footer')

    centerColumn.append(headerZoneEl, this.canvas.getElement(), footerZoneEl)
    this.designContentEl.append(centerColumn)

    // Preview content
    this.previewContentEl = document.createElement('div')
    this.previewContentEl.className = 'td-designer__tab-content td-designer__preview-content'

    this.previewEditorEl = document.createElement('div')
    this.previewEditorEl.className = 'td-designer__preview-editor'
    this.previewContentEl.append(this.previewEditorEl)

    canvasWrap.append(tabRow, this.designContentEl, this.previewContentEl)

    const propsWrap = document.createElement('div')
    propsWrap.className = 'td-designer__right'
    propsWrap.append(this.props.getElement())

    body.append(paletteWrap, canvasWrap, propsWrap)
    return body
  }

  // ── Zone panel ────────────────────────────────────────────────────────────

  private _renderZonePanel(zone: 'header' | 'footer'): HTMLDivElement {
    const label = zone === 'header' ? '页眉 (Header)' : '页脚 (Footer)'

    const zoneEl = document.createElement('div')
    zoneEl.className = `td-zone td-zone--${zone}`

    const zoneHeader = document.createElement('div')
    zoneHeader.className = 'td-zone__header'

    const toggleBtn = document.createElement('button')
    toggleBtn.type = 'button'
    toggleBtn.className = 'td-zone__toggle'
    toggleBtn.textContent = '▶'

    const labelEl = document.createElement('span')
    labelEl.className = 'td-zone__label'
    labelEl.textContent = label

    const countEl = document.createElement('span')
    countEl.className = 'td-zone__count'
    if (zone === 'header') this.headerZoneCountEl = countEl
    else this.footerZoneCountEl = countEl

    const addBtn = document.createElement('button')
    addBtn.type = 'button'
    addBtn.className = 'td-zone__add-btn'
    addBtn.textContent = '+ 添加块'
    addBtn.style.display = 'none'
    addBtn.addEventListener('click', () => this._showZoneAddMenu(addBtn, zone))

    zoneHeader.append(toggleBtn, labelEl, countEl, addBtn)

    const body = document.createElement('div')
    body.className = 'td-zone__body'
    body.style.display = 'none'
    if (zone === 'header') this.headerZoneBodyEl = body
    else this.footerZoneBodyEl = body

    this._rebuildZoneBody(zone)

    let expanded = false
    toggleBtn.addEventListener('click', () => {
      expanded = !expanded
      toggleBtn.textContent = expanded ? '▼' : '▶'
      body.style.display = expanded ? 'block' : 'none'
      addBtn.style.display = expanded ? 'inline-flex' : 'none'
    })

    zoneEl.append(zoneHeader, body)
    return zoneEl
  }

  private _rebuildZoneBody(zone: 'header' | 'footer') {
    const bodyEl = zone === 'header' ? this.headerZoneBodyEl : this.footerZoneBodyEl
    const blocks = zone === 'header' ? this.headerBlocks : this.footerBlocks
    const countEl = zone === 'header' ? this.headerZoneCountEl : this.footerZoneCountEl

    if (!bodyEl) return
    bodyEl.innerHTML = ''
    if (countEl) {
      countEl.textContent = blocks.length ? `(${blocks.length})` : '(空)'
    }

    if (blocks.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'td-zone__empty'
      empty.textContent = '暂无内容，点击"+ 添加块"开始'
      bodyEl.append(empty)
      return
    }

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]
      const row = document.createElement('div')
      row.className = 'td-zone__block-row'

      const badge = document.createElement('span')
      badge.className = 'td-zone__block-type'
      badge.textContent = ZONE_BLOCK_LABEL[block.type] ?? block.type

      const summary = document.createElement('span')
      summary.className = 'td-zone__block-summary'
      summary.textContent = this._getZoneBlockSummary(block)
      summary.title = summary.textContent

      const delBtn = document.createElement('button')
      delBtn.type = 'button'
      delBtn.className = 'td-zone__action td-zone__action--del'
      delBtn.textContent = '×'
      delBtn.title = '删除'
      delBtn.addEventListener('click', e => {
        e.stopPropagation()
        const zBlocks = zone === 'header' ? [...this.headerBlocks] : [...this.footerBlocks]
        zBlocks.splice(i, 1)
        if (zone === 'header') this.headerBlocks = zBlocks
        else this.footerBlocks = zBlocks
        this._rebuildZoneBody(zone)
        if (this.activeZone === zone) {
          this.selection = null
          this.props.update(zone === 'header' ? this.headerBlocks : this.footerBlocks, null)
        }
      })

      row.append(badge, summary, delBtn)

      row.addEventListener('click', () => {
        this.activeZone = zone
        this.selection = { kind: 'block', blockIndex: i }
        const zBlocks = zone === 'header' ? this.headerBlocks : this.footerBlocks
        this.props.update(zBlocks, this.selection)
        bodyEl.querySelectorAll('.td-zone__block-row').forEach(r =>
          r.classList.remove('td-zone__block-row--selected')
        )
        row.classList.add('td-zone__block-row--selected')
      })

      bodyEl.append(row)
    }
  }

  private _getZoneBlockSummary(block: ITemplateBlock): string {
    switch (block.type) {
      case 'staticText':
        return block.text.slice(0, 50) || '（空文本）'
      case 'fieldRow':
        return `字段：${block.fields.map(f => f.label || f.id).join('、')}`
      case 'paragraph': {
        const parts = block.segments.map(s =>
          s.type === 'text' ? s.value : `[${s.field.label || s.field.id}]`
        )
        return parts.join('').slice(0, 50) || '（空段落）'
      }
      case 'separator':
        return '水平分隔线'
      case 'table':
        return `表格：${block.columns.map(c => c.header).join('、')}`
      default:
        return block.type
    }
  }

  private _showZoneAddMenu(anchor: HTMLButtonElement, zone: 'header' | 'footer') {
    document.querySelector('.td-zone__add-menu')?.remove()

    const menu = document.createElement('div')
    menu.className = 'td-zone__add-menu'

    for (const type of ZONE_BLOCK_TYPES) {
      const item = document.createElement('div')
      item.className = 'td-zone__add-menu-item'
      item.textContent = ZONE_BLOCK_LABEL[type]
      item.addEventListener('click', () => {
        menu.remove()
        this._addZoneBlock(zone, type)
      })
      menu.append(item)
    }

    const rect = anchor.getBoundingClientRect()
    menu.style.top = `${rect.bottom + 4}px`
    menu.style.left = `${rect.left}px`
    document.body.append(menu)

    const closeMenu = (e: MouseEvent) => {
      if (!menu.contains(e.target as Node) && e.target !== anchor) {
        menu.remove()
        document.removeEventListener('mousedown', closeMenu)
      }
    }
    document.addEventListener('mousedown', closeMenu)
  }

  private _addZoneBlock(zone: 'header' | 'footer', type: ITemplateBlock['type']) {
    const block = this._createDefaultZoneBlock(type)
    if (zone === 'header') this.headerBlocks = [...this.headerBlocks, block]
    else this.footerBlocks = [...this.footerBlocks, block]
    this._rebuildZoneBody(zone)
  }

  private _createDefaultZoneBlock(type: ITemplateBlock['type']): ITemplateBlock {
    switch (type) {
      case 'staticText':
        return { type: 'staticText', text: '静态文本内容', align: 'center' }
      case 'fieldRow':
        return { type: 'fieldRow', fields: [{ id: genFieldId(), type: 'text', label: '字段', placeholder: '请输入' }] }
      case 'paragraph':
        return { type: 'paragraph', segments: [{ type: 'text', value: '段落内容' }] }
      case 'separator':
        return { type: 'separator' }
      case 'table':
        return { type: 'table', columns: [{ header: '列1' }, { header: '列2' }], rows: 2 }
      default:
        return { type: 'staticText', text: '' }
    }
  }

  // ── Event handlers ────────────────────────────────────────────────────────

  private _handleCanvasSelect(target: SelectionTarget) {
    this.activeZone = 'main'
    this.selection = target
    // Clear zone row highlights
    document.querySelectorAll('.td-zone__block-row--selected').forEach(r =>
      r.classList.remove('td-zone__block-row--selected')
    )
    this.props.update(this.schema.blocks, target)
  }

  private _handleDeleteBlock(blockIndex: number) {
    const blocks = [...this.schema.blocks]
    blocks.splice(blockIndex, 1)
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.selection = null
    this.props.update(blocks, null)
  }

  private _handleMoveBlock(blockIndex: number, delta: -1 | 1) {
    const blocks = [...this.schema.blocks]
    const targetIndex = blockIndex + delta
    if (targetIndex < 0 || targetIndex >= blocks.length) return
    ;[blocks[blockIndex], blocks[targetIndex]] = [blocks[targetIndex], blocks[blockIndex]]
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.props.update(blocks, this.selection)
  }

  private _handleReorder(blocks: ITemplateBlock[]) {
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.selection = null
    this.props.update(blocks, null)
  }

  private _handleCopy(blockIndex: number, cloned: ITemplateBlock) {
    const blocks = [...this.schema.blocks]
    blocks.splice(blockIndex + 1, 0, cloned)
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.props.update(blocks, this.selection)
  }

  private _handlePresetInsert(newBlocks: ITemplateBlock[]) {
    this.activeZone = 'main'
    const blocks = [...this.schema.blocks, ...newBlocks]
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.selection = null
    this.props.update(blocks, null)
  }

  private _handleBlockChange(blockIndex: number, updated: ITemplateBlock) {
    const blocks = [...this._getActiveBlocks()]
    blocks[blockIndex] = updated
    this._setActiveBlocks(blocks)
    const active = this._getActiveBlocks()
    if (this.activeZone !== 'main') {
      this._rebuildZoneBody(this.activeZone as 'header' | 'footer')
    }
    this.props.update(active, this.selection)
  }

  private _handleFieldChange(blockIndex: number, fieldId: string, updated: ITemplateField) {
    const blocks = [...this._getActiveBlocks()]
    const block = blocks[blockIndex]

    if (block.type === 'fieldRow') {
      blocks[blockIndex] = {
        ...block,
        fields: block.fields.map(f => (f.id === fieldId ? updated : f))
      }
    } else if (block.type === 'paragraph') {
      blocks[blockIndex] = {
        ...block,
        segments: block.segments.map(s =>
          s.type === 'field' && s.field.id === fieldId ? { ...s, field: updated } : s
        )
      }
    } else if (block.type === 'table') {
      blocks[blockIndex] = {
        ...block,
        columns: block.columns.map(c =>
          c.field?.id === fieldId ? { ...c, field: updated } : c
        )
      }
    }

    this._setActiveBlocks(blocks)
    if (this.activeZone !== 'main') {
      this._rebuildZoneBody(this.activeZone as 'header' | 'footer')
    }
    if (this.selection?.kind === 'field') {
      this.selection = { ...this.selection, fieldId: updated.id }
    }
    this.props.update(this._getActiveBlocks(), this.selection)
  }

  private _handleAddField(blockIndex: number) {
    const blocks = [...this._getActiveBlocks()]
    const block = blocks[blockIndex]
    const newField: ITemplateField = {
      id: genFieldId(),
      type: 'text',
      label: '新字段',
      placeholder: '请输入'
    }
    if (block.type === 'fieldRow') {
      blocks[blockIndex] = { ...block, fields: [...block.fields, newField] }
    }
    this._setActiveBlocks(blocks)
    this.props.update(this._getActiveBlocks(), this.selection)
  }

  private _handleNestedInsert(parentIndex: number, block: ITemplateBlock) {
    const blocks = [...this.schema.blocks]
    const parent = blocks[parentIndex]
    if (parent.type !== 'section' && parent.type !== 'group') return
    blocks[parentIndex] = { ...parent, blocks: [...parent.blocks, block] }
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.props.update(blocks, this.selection)
  }

  private _handleNestedDelete(parentIndex: number, childIndex: number) {
    const blocks = [...this.schema.blocks]
    const parent = blocks[parentIndex]
    if (parent.type !== 'section' && parent.type !== 'group') return
    const children = [...parent.blocks]
    children.splice(childIndex, 1)
    blocks[parentIndex] = { ...parent, blocks: children }
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.props.update(blocks, this.selection)
  }

  private _handleNestedMove(parentIndex: number, childIndex: number, delta: -1 | 1) {
    const blocks = [...this.schema.blocks]
    const parent = blocks[parentIndex]
    if (parent.type !== 'section' && parent.type !== 'group') return
    const children = [...parent.blocks]
    const targetIndex = childIndex + delta
    if (targetIndex < 0 || targetIndex >= children.length) return
    ;[children[childIndex], children[targetIndex]] = [children[targetIndex], children[childIndex]]
    blocks[parentIndex] = { ...parent, blocks: children }
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.props.update(blocks, this.selection)
  }

  private _handleNestedReorder(parentIndex: number, children: ITemplateBlock[]) {
    const blocks = [...this.schema.blocks]
    const parent = blocks[parentIndex]
    if (parent.type !== 'section' && parent.type !== 'group') return
    blocks[parentIndex] = { ...parent, blocks: children }
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.props.update(blocks, this.selection)
  }

  private _buildFullSchema(): ITemplateSchema {
    return {
      ...this.schema,
      name: this.nameInput.value || this.schema.name,
      description: this.descInput.value || undefined,
      header: this.headerBlocks.length ? this.headerBlocks : undefined,
      footer: this.footerBlocks.length ? this.footerBlocks : undefined
    }
  }

  private _handleLayoutChange(layout: ITemplateLayout) {
    this.schema = { ...this.schema, layout }
  }

  private _handlePreview() {
    new TemplatePreviewDialog(this._buildFullSchema())
  }

  private _handleSave() {
    const updatedSchema = this._buildFullSchema()
    const category = this.categoryInput.value.trim() || '自定义'
    this.options.onSave(updatedSchema, category)
    this._savedSchemaJSON = JSON.stringify(updatedSchema)
    this._dispose()
  }

  private _handleClose() {
    const current = this._buildFullSchema()
    const isDirty = JSON.stringify(current) !== this._savedSchemaJSON
    if (isDirty && !confirm('有未保存的更改，确定关闭吗？')) return
    this.options.onClose()
    this._dispose()
  }

  private _switchTab(tab: 'design' | 'preview') {
    this.activeTab = tab
    this.tabDesignBtn.classList.toggle('td-designer__tab--active', tab === 'design')
    this.tabPreviewBtn.classList.toggle('td-designer__tab--active', tab === 'preview')
    this.designContentEl.classList.toggle('td-designer__tab-content--hidden', tab === 'preview')
    this.previewContentEl.classList.toggle('td-designer__tab-content--hidden', tab === 'design')
    if (tab === 'preview') this._doRefreshPreview()
  }

  private _schedulePreviewRefresh() {
    // Only refresh if preview is currently visible (tab active or wide mode)
    const isVisible = this.activeTab === 'preview' ||
      this.designContentEl.closest('.td-designer--wide') !== null
    if (!isVisible) return
    if (this.previewDebounceTimer) clearTimeout(this.previewDebounceTimer)
    this.previewDebounceTimer = setTimeout(() => this._doRefreshPreview(), 400)
  }

  private _doRefreshPreview() {
    const schema = this._buildFullSchema()
    const pageConfig = getPageConfig(schema)
    const data = compileTemplate(schema)

    if (this.previewEditorInstance) {
      this.previewRuleEngine?.dispose()
      this.previewRuleEngine = null
      this.previewEditorInstance.destroy()
      this.previewEditorInstance = null
      this.previewEditorEl.innerHTML = ''
    }

    this.previewEditorInstance = new Editor(
      this.previewEditorEl,
      data,
      {
        width: pageConfig.width,
        height: pageConfig.height,
        margins: pageConfig.margins,
        paperDirection: pageConfig.orientation === 'landscape'
          ? PaperDirection.HORIZONTAL
          : PaperDirection.VERTICAL
      }
    )
    this.previewRuleEngine = new TemplateRuleEngine(this.previewEditorInstance, schema)
  }

  private _dispose() {
    this.mask.remove()
    this.container.remove()
  }
}
