import { EDITOR_COMPONENT, EditorComponent } from '../../editor'
import Editor from '../../editor'
import { PaperDirection } from '../../editor/dataset/enum/Editor'
import type { ITemplateSchema, ITemplateBlock, ITemplateField, ITemplateLayout } from '../../editor/template/index'
import {
  compileTemplate,
  getPageConfig,
  getResolvedTemplateBlocks,
  getTemplatePageNumberOptions,
  TEMPLATE_SYSTEM_VARIABLES,
  validateSchema
} from '../../editor/template/index'
import { getTemplatePageDecorationPreset } from '../../editor/template/TemplatePageDecoration'
import { buildTemplateFieldRuntimeIndex } from '../../editor/template/TemplateRuntime'
import { templateRegistry } from '../../editor/template/TemplateRegistry'
import type { ITemplateRegistryEntry } from '../../editor/template/TemplateRegistry'
import { TemplateRuleEngine } from '../../editor/template/TemplateRuleEngine'
import { BlockPalette } from './BlockPalette'
import { SchemaCanvas } from './SchemaCanvas'
import { PropertiesPanel } from './PropertiesPanel'
import type { PropertiesChangePhase } from './PropertiesPanel'
import { StructureTree } from './StructureTree'
import { TemplateFeedback } from './TemplateFeedback'
import type { SelectionTarget } from './SchemaCanvas'
import { canNestBlock, filterNestableBlocks } from './nesting'
import './template-designer.css'

export interface ITemplateDesignerOptions {
  onSave: (schema: ITemplateSchema, category: string) => void
  onClose: () => void
  closeText?: string
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
  section: '分节',
  group: '组合',
  staticText: '静态文本',
  paragraph: '段落',
  fieldRow: '字段行',
  separator: '分隔线',
  table: '表格'
}

const PAGE_DECORATION_MODE_LABEL: Record<'replace' | 'prepend' | 'append', string> = {
  replace: '替换当前区块',
  prepend: '前置合并',
  append: '后置合并'
}

const PALETTE_DRAG_MIME = 'application/x-canvas-editor-blocks'

type ZoneKey = 'header' | 'footer'
type ZonePresetId =
  | 'signatureFooter'
  | 'doubleSignatureFooter'
  | 'printInfoFooter'
  | 'copyrightFooter'

type PaletteDragPayload =
  | { kind: 'type'; type: ITemplateBlock['type'] }
  | { kind: 'blocks'; blocks: ITemplateBlock[] }

const FOOTER_PRESET_OPTIONS: Array<{ id: ZonePresetId; label: string; description: string }> = [
  { id: 'signatureFooter', label: '签名页脚', description: '医师签名 + 日期' },
  { id: 'doubleSignatureFooter', label: '双签名页脚', description: '医生 / 患者双签名' },
  { id: 'printInfoFooter', label: '打印信息', description: '打印时间 + 操作者' },
  { id: 'copyrightFooter', label: '版权说明', description: '版权与内部使用说明' }
]

function remapBlockFieldIds(block: ITemplateBlock) {
  if (block.type === 'fieldRow') {
    block.fields.forEach(field => {
      field.id = genFieldId()
    })
  } else if (block.type === 'paragraph') {
    block.segments.forEach(segment => {
      if (segment.type === 'field') segment.field.id = genFieldId()
    })
  } else if (block.type === 'table') {
    block.columns.forEach(column => {
      if (column.field) column.field.id = genFieldId()
    })
  }
}

function cloneTemplateBlock(block: ITemplateBlock): ITemplateBlock {
  const cloned = JSON.parse(JSON.stringify(block)) as ITemplateBlock
  remapBlockFieldIds(cloned)
  return cloned
}

function cloneTemplateBlocks(blocks: ITemplateBlock[]): ITemplateBlock[] {
  return blocks.map(cloneTemplateBlock)
}

function parsePaletteDragPayload(
  dataTransfer: DataTransfer | null
): PaletteDragPayload | null {
  const raw = dataTransfer?.getData(PALETTE_DRAG_MIME)
  if (!raw) return null
  try {
    const payload = JSON.parse(raw) as PaletteDragPayload
    if (payload.kind === 'type' && payload.type) return payload
    if (payload.kind === 'blocks' && Array.isArray(payload.blocks)) return payload
  } catch {
    return null
  }
  return null
}

function hasPaletteDragPayload(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types).includes(PALETTE_DRAG_MIME)
}

function createFooterPresetBlocks(presetId: ZonePresetId): ITemplateBlock[] {
  switch (presetId) {
    case 'signatureFooter':
      return [
        { type: 'separator', width: 180, align: 'right' },
        {
          type: 'fieldRow',
          align: 'right',
          fields: [
            { id: genFieldId(), type: 'signature', label: '医师签名', placeholder: '签名' },
            { id: genFieldId(), type: 'date', label: '日期', placeholder: '选择日期' }
          ]
        }
      ]
    case 'doubleSignatureFooter':
      return [
        { type: 'separator', width: 240, align: 'center' },
        {
          type: 'fieldRow',
          equalWidth: true,
          fields: [
            { id: genFieldId(), type: 'signature', label: '医师签名', placeholder: '签名' },
            { id: genFieldId(), type: 'signature', label: '患者签名', placeholder: '签名' },
            { id: genFieldId(), type: 'date', label: '日期', placeholder: '选择日期' }
          ]
        }
      ]
    case 'printInfoFooter':
      return [
        {
          type: 'staticText',
          align: 'right',
          text: `打印时间：${TEMPLATE_SYSTEM_VARIABLES.PRINT_TIME}    操作者：${TEMPLATE_SYSTEM_VARIABLES.OPERATOR_NAME}`,
          style: { size: 12, italic: true }
        }
      ]
    case 'copyrightFooter':
      return [
        {
          type: 'staticText',
          align: 'center',
          text: '© Canvas Editor 医疗文书模板平台 · 仅限院内授权使用',
          style: { size: 12 }
        }
      ]
  }
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
  private structureTree: StructureTree
  private options: ITemplateDesignerOptions
  private selection: SelectionTarget = null
  private nameInput!: HTMLInputElement
  private descInput!: HTMLTextAreaElement
  private categoryInput!: HTMLSelectElement
  private initialCategory: string = ''
  private _savedSchemaJSON: string = ''
  private activeParentIndex: number | null = null
  private statusMetricsEl!: HTMLDivElement
  private workspaceStatusEl!: HTMLDivElement
  private workspaceSelectionEl!: HTMLDivElement
  private workspaceTemplateSummaryEl!: HTMLDivElement
  private workspaceMetaEl!: HTMLDivElement
  private workspaceContextEl!: HTMLDivElement
  private workspacePaperBtn!: HTMLButtonElement
  private workspaceMarginsBtn!: HTMLButtonElement
  private workspaceDecorationsBtn!: HTMLButtonElement
  private workspaceDetailsEl!: HTMLDivElement
  private workspaceDetailsToggleBtn!: HTMLButtonElement
  private palettePanelEl!: HTMLDivElement
  private treePanelEl!: HTMLDivElement
  private materialTabBtn!: HTMLButtonElement
  private treeTabBtn!: HTMLButtonElement
  private headerZoneEl!: HTMLDivElement
  private footerZoneEl!: HTMLDivElement
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
  private propsWrapEl!: HTMLDivElement
  private workspaceDetailsExpanded = false
  private workspaceZoneButtons: Partial<Record<'main' | 'header' | 'footer', HTMLButtonElement>> = {}
  private previousBodyOverflow = ''
  private previousHtmlOverflow = ''
  private zoneDragFrom: { zone: ZoneKey; index: number } | null = null

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
      onInsertAt: (index, blocks) => this._handleInsertAt(index, blocks),
      onCopy: (index, cloned) => this._handleCopy(index, cloned),
      onNestedInsert: (parentIndex, block) => this._handleNestedInsert(parentIndex, block),
      onNestedInsertAt: (parentIndex, childIndex, blocks) =>
        this._handleNestedInsertAt(parentIndex, childIndex, blocks),
      onNestedDelete: (parentIndex, childIndex) => this._handleNestedDelete(parentIndex, childIndex),
      onNestedMoveUp: (parentIndex, childIndex) => this._handleNestedMove(parentIndex, childIndex, -1),
      onNestedMoveDown: (parentIndex, childIndex) => this._handleNestedMove(parentIndex, childIndex, 1),
      onNestedReorder: (parentIndex, children) => this._handleNestedReorder(parentIndex, children),
      onFieldRowReorder: (blockIndex, fields) =>
        this._handleFieldRowReorder(blockIndex, fields),
      onFieldRowDelete: (blockIndex, fieldId) =>
        this._handleFieldRowDelete(blockIndex, fieldId)
    })

    this.props = new PropertiesPanel({
      onBlockChange: (blockIndex, updated, phase) =>
        this._handleBlockChange(blockIndex, updated, phase),
      onFieldChange: (blockIndex, fieldId, updated, phase) =>
        this._handleFieldChange(blockIndex, fieldId, updated, phase),
      onAddField: blockIndex => this._handleAddField(blockIndex),
      onLayoutChange: (layout, phase) => this._handleLayoutChange(layout, phase)
    })

    this.structureTree = new StructureTree({
      onSelect: (zone, target) => this._handleTreeSelect(zone, target),
      onDeleteBlock: (zone, target) => void this._handleTreeDelete(zone, target)
    })

    const { mask, container } = this._render()
    this.mask = mask
    this.container = container
    this.canvas.setBlocks(this.schema.blocks)
    this.props.setLayout(this.schema.layout)
    this.props.update(this.schema.blocks, null)
    this._refreshDesignerState()
  }

  // ── Zone-aware block access ───────────────────────────────────────────────

  private _getActiveBlocks(): ITemplateBlock[] {
    if (this.activeZone === 'main' && this.activeParentIndex != null) {
      const parent = this.schema.blocks[this.activeParentIndex]
      if (parent?.type === 'section' || parent?.type === 'group') {
        return parent.blocks
      }
    }
    if (this.activeZone === 'header') return this.headerBlocks
    if (this.activeZone === 'footer') return this.footerBlocks
    return this.schema.blocks
  }

  private _setActiveBlocks(blocks: ITemplateBlock[]) {
    if (this.activeZone === 'main' && this.activeParentIndex != null) {
      const nextBlocks = [...this.schema.blocks]
      const parent = nextBlocks[this.activeParentIndex]
      if (parent?.type === 'section' || parent?.type === 'group') {
        nextBlocks[this.activeParentIndex] = { ...parent, blocks }
        this.schema = { ...this.schema, blocks: nextBlocks }
        this.canvas.setBlocks(nextBlocks)
      }
    } else if (this.activeZone === 'header') {
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
    this._lockRootScroll()

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

    const titleWrap = document.createElement('div')
    titleWrap.className = 'td-designer__title-wrap'
    const title = document.createElement('div')
    title.className = 'td-designer__title'
    title.textContent = '可视化模板设计器'
    const subtitle = document.createElement('div')
    subtitle.className = 'td-designer__subtitle'
    subtitle.textContent = '低代码病历文书工作台'
    titleWrap.append(title, subtitle)

    left.append(titleWrap)

    const right = document.createElement('div')
    right.className = 'td-designer__header-right'

    const browseGroup = document.createElement('div')
    browseGroup.className = 'td-designer__action-group'

    const previewBtn = document.createElement('button')
    previewBtn.className = 'td-designer__btn td-designer__btn--compact'
    previewBtn.textContent = '预览'
    previewBtn.type = 'button'
    previewBtn.addEventListener('click', () => this._handlePreview())

    const sourceBtn = document.createElement('button')
    sourceBtn.className = 'td-designer__btn td-designer__btn--compact'
    sourceBtn.textContent = '源码'
    sourceBtn.type = 'button'
    sourceBtn.addEventListener('click', () => this._handleViewSource())

    const saveBtn = document.createElement('button')
    saveBtn.className = 'td-designer__btn td-designer__btn--primary'
    saveBtn.textContent = '保存'
    saveBtn.type = 'button'
    saveBtn.addEventListener('click', () => this._handleSave())

    const closeBtn = document.createElement('button')
    closeBtn.className = 'td-designer__btn td-designer__btn--ghost'
    closeBtn.textContent = this.options.closeText ?? '返回'
    closeBtn.type = 'button'
    closeBtn.addEventListener('click', () => this._handleClose())

    browseGroup.append(sourceBtn, previewBtn)
    right.append(browseGroup, saveBtn, closeBtn)
    header.append(left, right)
    return header
  }

  private _renderBody(): HTMLDivElement {
    const body = document.createElement('div')
    body.className = 'td-designer__body'

    const palette = new BlockPalette(
      type => {
        this.activeZone = 'main'
        this.activeParentIndex = null
        this.canvas.addBlock(type)
        this.schema = { ...this.schema, blocks: this.canvas.getBlocks() }
        this._syncDesignerAfterChange()
      },
      blocks => this._handlePresetInsert(blocks)
    )

    const paletteWrap = document.createElement('div')
    paletteWrap.className = 'td-designer__left'

    const leftTabs = document.createElement('div')
    leftTabs.className = 'td-designer__left-tabs'
    this.materialTabBtn = document.createElement('button')
    this.materialTabBtn.type = 'button'
    this.materialTabBtn.className = 'td-designer__left-tab td-designer__left-tab--active'
    this.materialTabBtn.textContent = '物料'
    this.materialTabBtn.addEventListener('click', () => this._switchLeftTab('material'))
    this.treeTabBtn = document.createElement('button')
    this.treeTabBtn.type = 'button'
    this.treeTabBtn.className = 'td-designer__left-tab'
    this.treeTabBtn.textContent = '结构树'
    this.treeTabBtn.addEventListener('click', () => this._switchLeftTab('tree'))
    leftTabs.append(this.materialTabBtn, this.treeTabBtn)

    this.palettePanelEl = document.createElement('div')
    this.palettePanelEl.className = 'td-designer__left-panel'
    this.palettePanelEl.append(palette.getElement())
    this.treePanelEl = document.createElement('div')
    this.treePanelEl.className = 'td-designer__left-panel td-designer__left-panel--hidden'
    this.treePanelEl.append(this.structureTree.getElement())
    paletteWrap.append(leftTabs, this.palettePanelEl, this.treePanelEl)

    const canvasWrap = document.createElement('div')
    canvasWrap.className = 'td-designer__center'

    const workspaceHeader = this._renderWorkspaceToolbar()

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

    const workspaceStage = document.createElement('div')
    workspaceStage.className = 'td-workspace__stage'

    const workspaceViewport = document.createElement('div')
    workspaceViewport.className = 'td-workspace__viewport'

    const centerColumn = document.createElement('div')
    centerColumn.className = 'td-designer__center-column'

    this.headerZoneEl = this._renderZonePanel('header')
    this.footerZoneEl = this._renderZonePanel('footer')

    centerColumn.append(
      this.headerZoneEl,
      this.canvas.getElement(),
      this.footerZoneEl
    )
    workspaceViewport.append(centerColumn)
    workspaceStage.append(workspaceViewport)
    this.designContentEl.append(workspaceStage)

    // Preview content
    this.previewContentEl = document.createElement('div')
    this.previewContentEl.className = 'td-designer__tab-content td-designer__preview-content td-designer__tab-content--hidden'

    this.previewEditorEl = document.createElement('div')
    this.previewEditorEl.className = 'td-designer__preview-editor'
    this.previewContentEl.append(this.previewEditorEl)

    canvasWrap.append(
      workspaceHeader,
      tabRow,
      this.designContentEl,
      this.previewContentEl
    )

    const propsWrap = document.createElement('div')
    propsWrap.className = 'td-designer__right'
    propsWrap.append(this.props.getElement())
    this.propsWrapEl = propsWrap

    body.append(paletteWrap, canvasWrap, propsWrap)
    return body
  }

  private _getCategoryOptions(): string[] {
    const categories = [
      ...templateRegistry.getCategories(),
      this.initialCategory,
      '住院记录',
      '门诊记录',
      '护理记录',
      '知情同意',
      '自定义'
    ].filter(Boolean) as string[]
    return [...new Set(categories)]
  }

  private _switchLeftTab(tab: 'material' | 'tree') {
    this.materialTabBtn.classList.toggle('td-designer__left-tab--active', tab === 'material')
    this.treeTabBtn.classList.toggle('td-designer__left-tab--active', tab === 'tree')
    this.palettePanelEl.classList.toggle('td-designer__left-panel--hidden', tab !== 'material')
    this.treePanelEl.classList.toggle('td-designer__left-panel--hidden', tab !== 'tree')
    if (tab === 'tree') this._refreshDesignerState()
  }

  private _refreshDesignerState() {
    const schema = this._buildFullSchema()
    this.structureTree.setData(schema, this.activeZone, this.selection)
    this._renderStatusMetrics(schema)
  }

  private _renderWorkspaceToolbar(): HTMLDivElement {
    const toolbar = document.createElement('div')
    toolbar.className = 'td-workspace__toolbar td-workspace__toolbar--merged'

    const topRow = document.createElement('div')
    topRow.className = 'td-workspace__top-row'

    const titleBlock = document.createElement('div')
    titleBlock.className = 'td-workspace__title-block'

    this.workspaceSelectionEl = document.createElement('div')
    this.workspaceSelectionEl.className = 'td-workspace__selection'

    this.workspaceTemplateSummaryEl = document.createElement('div')
    this.workspaceTemplateSummaryEl.className = 'td-workspace__template-summary'

    this.workspaceMetaEl = document.createElement('div')
    this.workspaceMetaEl.className = 'td-workspace__meta'

    titleBlock.append(
      this.workspaceSelectionEl,
      this.workspaceTemplateSummaryEl,
      this.workspaceMetaEl
    )

    const actionBar = document.createElement('div')
    actionBar.className = 'td-workspace__action-bar'

    this.workspaceStatusEl = document.createElement('div')
    this.workspaceStatusEl.className = 'td-workspace__status'

    const quickActions = document.createElement('div')
    quickActions.className = 'td-workspace__quick-actions'

    this.workspacePaperBtn = document.createElement('button')
    this.workspacePaperBtn.type = 'button'
    this.workspacePaperBtn.className = 'td-workspace__quick-btn'
    this.workspacePaperBtn.addEventListener('click', () =>
      this.focusLayoutSection('paper')
    )

    this.workspaceMarginsBtn = document.createElement('button')
    this.workspaceMarginsBtn.type = 'button'
    this.workspaceMarginsBtn.className = 'td-workspace__quick-btn'
    this.workspaceMarginsBtn.addEventListener('click', () =>
      this.focusLayoutSection('margins')
    )

    this.workspaceDecorationsBtn = document.createElement('button')
    this.workspaceDecorationsBtn.type = 'button'
    this.workspaceDecorationsBtn.className = 'td-workspace__quick-btn'
    this.workspaceDecorationsBtn.addEventListener('click', () =>
      this.focusLayoutSection('decorations')
    )

    quickActions.append(
      this.workspacePaperBtn,
      this.workspaceMarginsBtn,
      this.workspaceDecorationsBtn
    )

    const tools = document.createElement('div')
    tools.className = 'td-workspace__tools'

    const zoneGroup = document.createElement('div')
    zoneGroup.className = 'td-workspace__tool-group'
    ;([
      ['header', '页眉'],
      ['main', '正文'],
      ['footer', '页脚']
    ] as Array<[TemplateDesigner['activeZone'], string]>).forEach(
      ([zone, label]) => {
        const button = document.createElement('button')
        button.type = 'button'
        button.className = 'td-workspace__btn'
        button.textContent = label
        button.addEventListener('click', () => this._focusZone(zone))
        this.workspaceZoneButtons[zone] = button
        zoneGroup.append(button)
      }
    )

    tools.append(zoneGroup)

    this.workspaceDetailsToggleBtn = document.createElement('button')
    this.workspaceDetailsToggleBtn.type = 'button'
    this.workspaceDetailsToggleBtn.className = 'td-workspace__details-btn'
    this.workspaceDetailsToggleBtn.addEventListener('click', () =>
      this._setWorkspaceDetailsExpanded(!this.workspaceDetailsExpanded)
    )

    actionBar.append(
      this.workspaceStatusEl,
      quickActions,
      tools,
      this.workspaceDetailsToggleBtn
    )

    topRow.append(titleBlock, actionBar)

    this.workspaceDetailsEl = document.createElement('div')
    this.workspaceDetailsEl.className = 'td-workspace__details td-workspace__details--collapsed'

    const detailsInsights = document.createElement('div')
    detailsInsights.className = 'td-workspace__details-insights'

    this.workspaceContextEl = document.createElement('div')
    this.workspaceContextEl.className = 'td-workspace__details-context'

    this.statusMetricsEl = document.createElement('div')
    this.statusMetricsEl.className = 'td-designer__status-metrics td-designer__status-metrics--details'

    const template = document.createElement('div')
    template.className = 'td-workspace__template'

    const nameField = document.createElement('label')
    nameField.className = 'td-workspace__field td-workspace__field--name'
    const nameLabel = document.createElement('span')
    nameLabel.className = 'td-workspace__field-label'
    nameLabel.textContent = '名称'
    this.nameInput = document.createElement('input')
    this.nameInput.className = 'td-workspace__field-input'
    this.nameInput.type = 'text'
    this.nameInput.value = this.schema.name
    this.nameInput.placeholder = '请输入模板名称'
    this.nameInput.addEventListener('input', () => {
      this.schema = { ...this.schema, name: this.nameInput.value || this.schema.name }
      this._refreshWorkspaceHeaderSummary()
    })
    nameField.append(nameLabel, this.nameInput)

    const categoryField = document.createElement('label')
    categoryField.className = 'td-workspace__field td-workspace__field--category'
    const categoryLabel = document.createElement('span')
    categoryLabel.className = 'td-workspace__field-label'
    categoryLabel.textContent = '分类'
    this.categoryInput = document.createElement('select')
    this.categoryInput.className = 'td-workspace__field-select'
    this._getCategoryOptions().forEach(category => {
      const option = document.createElement('option')
      option.value = category
      option.textContent = category
      if (category === (this.initialCategory || '自定义')) option.selected = true
      this.categoryInput.append(option)
    })
    this.categoryInput.addEventListener('change', () => {
      this._refreshWorkspaceHeaderSummary()
    })
    categoryField.append(categoryLabel, this.categoryInput)

    const infoRow = document.createElement('div')
    infoRow.className = 'td-workspace__template-row'
    infoRow.append(nameField, categoryField)

    const descField = document.createElement('label')
    descField.className = 'td-workspace__field td-workspace__field--desc'
    const descLabel = document.createElement('span')
    descLabel.className = 'td-workspace__field-label'
    descLabel.textContent = '描述'
    this.descInput = document.createElement('textarea')
    this.descInput.className = 'td-workspace__field-textarea'
    this.descInput.value = this.schema.description ?? ''
    this.descInput.placeholder = '描述模板用途或适用场景'
    this.descInput.rows = 2
    this.descInput.addEventListener('input', () => {
      this.schema = { ...this.schema, description: this.descInput.value || undefined }
    })
    descField.append(descLabel, this.descInput)

    template.append(infoRow, descField)
    detailsInsights.append(this.workspaceContextEl, this.statusMetricsEl)
    this.workspaceDetailsEl.append(detailsInsights, template)
    toolbar.append(topRow, this.workspaceDetailsEl)
    this._setWorkspaceDetailsExpanded(false)
    return toolbar
  }

  private _setWorkspaceDetailsExpanded(expanded: boolean) {
    this.workspaceDetailsExpanded = expanded
    if (this.workspaceDetailsEl) {
      this.workspaceDetailsEl.classList.toggle(
        'td-workspace__details--collapsed',
        !expanded
      )
    }
    if (this.workspaceDetailsToggleBtn) {
      this.workspaceDetailsToggleBtn.textContent = '模板详情'
      this.workspaceDetailsToggleBtn.classList.toggle(
        'td-workspace__details-btn--active',
        expanded
      )
      this.workspaceDetailsToggleBtn.setAttribute('aria-expanded', String(expanded))
    }
  }

  private _refreshWorkspaceHeaderSummary() {
    if (!this.workspaceTemplateSummaryEl || !this.workspaceSelectionEl) return
    const name = this.nameInput?.value?.trim() || this.schema.name || '未命名模板'
    const category = this.categoryInput?.value?.trim() || this.initialCategory || '自定义'
    this.workspaceSelectionEl.textContent = name
    this.workspaceTemplateSummaryEl.textContent = category
  }

  public focusLayoutSection(section: 'paper' | 'margins' | 'decorations') {
    this.selection = null
    this.canvas.setSelection(null)
    this.props.update(this._getActiveBlocks(), null)
    this._refreshDesignerState()
    this.propsWrapEl.scrollTop = 0
    requestAnimationFrame(() => this.props.focusLayoutSection(section))
  }

  private _focusZone(zone: TemplateDesigner['activeZone']) {
    this.activeZone = zone
    this.activeParentIndex = null
    this.selection = null
    this.canvas.setSelection(null)
    this.props.update(this._getActiveBlocks(), null)
    this._refreshDesignerState()

    const target = zone === 'main'
      ? this.canvas.getElement()
      : zone === 'header'
        ? this.headerZoneEl
        : this.footerZoneEl
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  private _refreshWorkspaceChrome(schema: ITemplateSchema) {
    if (!this.workspaceStatusEl) return
    const isDirty = JSON.stringify(schema) !== this._savedSchemaJSON
    const issues = validateSchema(schema).length
    const pageConfig = getPageConfig(schema)
    const allBlocks = [
      ...(schema.header ?? []),
      ...schema.blocks,
      ...(schema.footer ?? [])
    ]
    const fieldIndex = buildTemplateFieldRuntimeIndex(schema)
    const zoneLabel = this.activeZone === 'main'
      ? '正文'
      : this.activeZone === 'header'
        ? '页眉'
        : '页脚'
    const orientationLabel = pageConfig.orientation === 'landscape' ? '横向' : '纵向'
    const pageSizeLabel = schema.layout?.pageSize ?? `${pageConfig.width}×${pageConfig.height}`

    this.workspaceStatusEl.innerHTML = ''
    ;([
      { label: isDirty ? '未保存' : '已保存', tone: isDirty ? 'warn' : 'ok' },
      { label: `问题 ${issues}`, tone: issues ? 'warn' : 'ok' }
    ] as Array<{ label: string; tone?: 'ok' | 'warn' }>).forEach(item => {
      const chip = document.createElement('span')
      chip.className = `td-workspace__chip${item.tone ? ` td-workspace__chip--${item.tone}` : ''}`
      chip.textContent = item.label
      this.workspaceStatusEl.append(chip)
    })

    this._refreshWorkspaceHeaderSummary()
    this.workspaceMetaEl.textContent = `${zoneLabel}区域-${orientationLabel}`
    this.workspaceContextEl.textContent = `当前定位：${this._getSelectionSummary()}`
    this.workspacePaperBtn.textContent = `纸张 ${pageSizeLabel} · ${orientationLabel}`
    this.workspaceMarginsBtn.textContent = `边距 ${pageConfig.margins.join(' / ')}`
    this.workspaceDecorationsBtn.textContent = '页眉页脚'
    this.statusMetricsEl.innerHTML = ''
    ;([
      { label: '结构', value: this._countBlocks(allBlocks) },
      { label: '字段', value: fieldIndex.all.length },
      { label: '规则', value: this._countRules(allBlocks) },
      { label: '页眉', value: schema.header?.length ?? 0 },
      { label: '页脚', value: schema.footer?.length ?? 0 },
      { label: '问题', value: issues, tone: issues ? 'warn' : 'ok' }
    ]).forEach(metric => {
      const item = document.createElement('span')
      item.className = `td-designer__metric${metric.tone ? ` td-designer__metric--${metric.tone}` : ''}`
      item.textContent = `${metric.label} ${metric.value}`
      this.statusMetricsEl.append(item)
    })
    ;(['header', 'main', 'footer'] as const).forEach(zone => {
      this.workspaceZoneButtons[zone]?.classList.toggle(
        'td-workspace__btn--active',
        this.activeZone === zone
      )
    })
  }

  private _getSelectionSummary(): string {
    const zoneLabel = this.activeZone === 'main'
      ? this.activeParentIndex == null
        ? '正文'
        : '正文容器'
      : this.activeZone === 'header'
        ? '页眉'
        : '页脚'
    if (!this.selection) {
      return `${zoneLabel} · 未选中内容，可从左侧拖入物料或从结构树快速定位`
    }

    const block = this._getActiveBlocks()[this.selection.blockIndex]
    const blockLabel = block
      ? ZONE_BLOCK_LABEL[block.type] ?? block.type
      : `块 ${this.selection.blockIndex + 1}`

    if (this.selection.kind === 'block') {
      return `${zoneLabel} / ${blockLabel} · 第 ${this.selection.blockIndex + 1} 块`
    }

    return `${zoneLabel} / ${blockLabel} / 字段 ${this._getFieldSummary(block, this.selection.fieldId)}`
  }

  private _getFieldSummary(
    block: ITemplateBlock | undefined,
    fieldId: string
  ): string {
    if (!block) return fieldId
    if (block.type === 'fieldRow') {
      const field = block.fields.find(item => item.id === fieldId)
      return field?.label || field?.id || fieldId
    }
    if (block.type === 'paragraph') {
      const segment = block.segments.find(
        item => item.type === 'field' && item.field.id === fieldId
      )
      return segment?.type === 'field'
        ? segment.field.label || segment.field.id
        : fieldId
    }
    if (block.type === 'table') {
      const column = block.columns.find(item => item.field?.id === fieldId)
      return column?.field?.label || column?.header || fieldId
    }
    return fieldId
  }

  private _renderStatusMetrics(schema: ITemplateSchema) {
    if (!this.statusMetricsEl) return
    this._refreshWorkspaceChrome(schema)
  }

  private _countBlocks(blocks: ITemplateBlock[]): number {
    return blocks.reduce((count, block) => {
      if (block.type === 'section' || block.type === 'group') {
        return count + 1 + this._countBlocks(block.blocks)
      }
      return count + 1
    }, 0)
  }

  private _countRules(blocks: ITemplateBlock[]): number {
    return blocks.reduce((count, block) => {
      let next = count
      if (block.type === 'section' || block.type === 'group') {
        next += block.rules?.length ?? 0
        next += this._countRules(block.blocks)
      } else if (block.type === 'fieldRow') {
        next += block.fields.reduce((sum, field) => sum + (field.rules?.length ?? 0), 0)
      } else if (block.type === 'paragraph') {
        next += block.segments.reduce((sum, segment) => {
          return segment.type === 'field' ? sum + (segment.field.rules?.length ?? 0) : sum
        }, 0)
      } else if (block.type === 'table') {
        next += block.columns.reduce((sum, column) => sum + (column.field?.rules?.length ?? 0), 0)
      }
      return next
    }, 0)
  }

  private _getPropsSelection(): SelectionTarget {
    if (!this.selection) return null
    if (this.selection.parentIndex == null) return this.selection
    if (this.selection.kind === 'block') {
      return { kind: 'block', blockIndex: this.selection.blockIndex }
    }
    return {
      kind: 'field',
      blockIndex: this.selection.blockIndex,
      fieldId: this.selection.fieldId
    }
  }

  private _syncDesignerAfterChange(refreshPreview = true) {
    const blocks = this._getActiveBlocks()
    this.canvas.setSelection(this.activeZone === 'main' ? this.selection : null)
    this.props.update(blocks, this._getPropsSelection())
    this._refreshDesignerState()
    if (refreshPreview) this._schedulePreviewRefresh()
  }

  private _handleTreeSelect(
    zone: 'main' | 'header' | 'footer',
    target: SelectionTarget
  ) {
    this.activeZone = zone
    this.activeParentIndex = target?.parentIndex ?? null
    this.selection = target
    this.canvas.setSelection(zone === 'main' ? target : null)
    const blocks = this._getActiveBlocks()
    this.props.update(blocks, this._getPropsSelection())
    this._refreshDesignerState()
  }

  private _handleViewSource() {
    const pre = document.createElement('pre')
    pre.className = 'td-source-viewer'
    pre.textContent = JSON.stringify(this._buildFullSchema(), null, 2)
    TemplateFeedback.openDialog({
      title: '实时 JSON 结构',
      content: pre,
      width: 760,
      actions: [{ label: '关闭', variant: 'primary' }]
    })
  }

  private _lockRootScroll() {
    this.previousBodyOverflow = document.body.style.overflow
    this.previousHtmlOverflow = document.documentElement.style.overflow
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflow = 'hidden'
  }

  private _unlockRootScroll() {
    document.body.style.overflow = this.previousBodyOverflow
    document.documentElement.style.overflow = this.previousHtmlOverflow
  }

  // ── Zone panel ────────────────────────────────────────────────────────────

  private _getZoneBlocks(zone: ZoneKey): ITemplateBlock[] {
    return zone === 'header' ? this.headerBlocks : this.footerBlocks
  }

  private _setZoneBlocks(zone: ZoneKey, blocks: ITemplateBlock[]) {
    if (zone === 'header') this.headerBlocks = blocks
    else this.footerBlocks = blocks
  }

  private _getZoneBody(zone: ZoneKey): HTMLDivElement {
    return zone === 'header' ? this.headerZoneBodyEl : this.footerZoneBodyEl
  }

  private _clearZoneDropIndicators(zone: ZoneKey) {
    const body = this._getZoneBody(zone)
    body?.querySelectorAll('.td-zone__drop-slot--active').forEach(element =>
      element.classList.remove('td-zone__drop-slot--active')
    )
    body?.querySelectorAll('.td-zone__empty--active').forEach(element =>
      element.classList.remove('td-zone__empty--active')
    )
  }

  private _selectZoneBlock(zone: ZoneKey, index: number) {
    this.activeZone = zone
    this.activeParentIndex = null
    this.selection = { kind: 'block', blockIndex: index }
    this.canvas.setSelection(null)
    this.props.update(this._getZoneBlocks(zone), this.selection)
    this._refreshDesignerState()
  }

  private _createZoneBlocksFromPayload(payload: PaletteDragPayload): ITemplateBlock[] {
    if (payload.kind === 'type') {
      return [this._createDefaultZoneBlock(payload.type)]
    }
    return cloneTemplateBlocks(payload.blocks)
  }

  private _insertZoneBlocksAt(zone: ZoneKey, index: number, insertedBlocks: ITemplateBlock[]) {
    if (!insertedBlocks.length) return
    const blocks = [...this._getZoneBlocks(zone)]
    blocks.splice(index, 0, ...insertedBlocks)
    this._setZoneBlocks(zone, blocks)
    this._rebuildZoneBody(zone)
    this._refreshDesignerState()
    this._schedulePreviewRefresh()
  }

  private _deleteZoneBlock(zone: ZoneKey, index: number) {
    const blocks = [...this._getZoneBlocks(zone)]
    blocks.splice(index, 1)
    this._setZoneBlocks(zone, blocks)
    this._rebuildZoneBody(zone)
    if (this.activeZone === zone) {
      this.selection = null
      this.activeParentIndex = null
      this.props.update(blocks, null)
    }
    this._refreshDesignerState()
    this._schedulePreviewRefresh()
  }

  private _moveZoneBlock(zone: ZoneKey, index: number, delta: -1 | 1) {
    const blocks = [...this._getZoneBlocks(zone)]
    const target = index + delta
    if (target < 0 || target >= blocks.length) return
    const moving = blocks[index]
    blocks[index] = blocks[target]
    blocks[target] = moving
    this._setZoneBlocks(zone, blocks)
    this._rebuildZoneBody(zone)
    if (this.activeZone === zone && this.selection?.kind === 'block') {
      this.selection = { ...this.selection, blockIndex: target }
      this.props.update(blocks, this.selection)
    }
    this._refreshDesignerState()
    this._schedulePreviewRefresh()
  }

  private _copyZoneBlock(zone: ZoneKey, index: number) {
    const blocks = [...this._getZoneBlocks(zone)]
    const cloned = cloneTemplateBlock(blocks[index])
    blocks.splice(index + 1, 0, cloned)
    this._setZoneBlocks(zone, blocks)
    this._rebuildZoneBody(zone)
    this._refreshDesignerState()
    this._schedulePreviewRefresh()
  }

  private _createZoneDropSlot(zone: ZoneKey, index: number, isEnd = false): HTMLDivElement {
    const slot = document.createElement('div')
    slot.className = `td-zone__drop-slot${isEnd ? ' td-zone__drop-slot--end' : ''}`
    slot.title = isEnd ? '拖到这里追加到末尾' : `拖到这里插入到第 ${index + 1} 位前`

    slot.addEventListener('dragover', event => {
      const hasPalettePayload = hasPaletteDragPayload(event.dataTransfer)
      if ((!this.zoneDragFrom || this.zoneDragFrom.zone !== zone) && !hasPalettePayload) return
      event.preventDefault()
      this._clearZoneDropIndicators(zone)
      slot.classList.add('td-zone__drop-slot--active')
    })

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('td-zone__drop-slot--active')
    })

    slot.addEventListener('drop', event => {
      const payload = parsePaletteDragPayload(event.dataTransfer)
      const dragFrom = this.zoneDragFrom
      this._clearZoneDropIndicators(zone)
      if ((!dragFrom || dragFrom.zone !== zone) && !payload) return
      event.preventDefault()

      if (dragFrom?.zone === zone) {
        const blocks = [...this._getZoneBlocks(zone)]
        const [moved] = blocks.splice(dragFrom.index, 1)
        const targetIndex = index > dragFrom.index ? index - 1 : index
        blocks.splice(targetIndex, 0, moved)
        this.zoneDragFrom = null
        this._setZoneBlocks(zone, blocks)
        this._rebuildZoneBody(zone)
        this._refreshDesignerState()
        this._schedulePreviewRefresh()
        return
      }

      if (!payload) return
      this._insertZoneBlocksAt(zone, index, this._createZoneBlocksFromPayload(payload))
    })

    return slot
  }

  private _renderZoneCard(zone: ZoneKey, block: ITemplateBlock, index: number): HTMLDivElement {
    const card = document.createElement('div')
    const isSelected = this.activeZone === zone &&
      this.selection?.kind === 'block' &&
      this.selection.blockIndex === index
    card.className = `td-zone__card${isSelected ? ' td-zone__card--selected' : ''}`
    card.draggable = true

    card.addEventListener('click', () => this._selectZoneBlock(zone, index))
    card.addEventListener('dragstart', event => {
      this.zoneDragFrom = { zone, index }
      card.classList.add('td-zone__card--dragging')
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    })
    card.addEventListener('dragend', () => {
      this.zoneDragFrom = null
      card.classList.remove('td-zone__card--dragging')
      this._clearZoneDropIndicators(zone)
    })

    const header = document.createElement('div')
    header.className = 'td-zone__card-header'

    const badge = document.createElement('span')
    badge.className = 'td-zone__block-type'
    badge.textContent = ZONE_BLOCK_LABEL[block.type] ?? block.type

    const actions = document.createElement('div')
    actions.className = 'td-zone__card-actions'

    const copyBtn = document.createElement('button')
    copyBtn.type = 'button'
    copyBtn.className = 'td-zone__action'
    copyBtn.textContent = '⊕'
    copyBtn.title = '复制'
    copyBtn.addEventListener('click', event => {
      event.stopPropagation()
      this._copyZoneBlock(zone, index)
    })

    const upBtn = document.createElement('button')
    upBtn.type = 'button'
    upBtn.className = 'td-zone__action'
    upBtn.textContent = '↑'
    upBtn.title = '上移'
    upBtn.addEventListener('click', event => {
      event.stopPropagation()
      this._moveZoneBlock(zone, index, -1)
    })

    const downBtn = document.createElement('button')
    downBtn.type = 'button'
    downBtn.className = 'td-zone__action'
    downBtn.textContent = '↓'
    downBtn.title = '下移'
    downBtn.addEventListener('click', event => {
      event.stopPropagation()
      this._moveZoneBlock(zone, index, 1)
    })

    const delBtn = document.createElement('button')
    delBtn.type = 'button'
    delBtn.className = 'td-zone__action td-zone__action--del'
    delBtn.textContent = '×'
    delBtn.title = '删除'
    delBtn.addEventListener('click', event => {
      event.stopPropagation()
      this._deleteZoneBlock(zone, index)
    })

    actions.append(copyBtn, upBtn, downBtn, delBtn)
    header.append(badge, actions)

    const summary = document.createElement('div')
    summary.className = 'td-zone__card-summary'
    summary.textContent = this._getZoneBlockSummary(block)
    summary.title = summary.textContent

    card.append(header, summary)
    return card
  }

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

    const presetBtn = document.createElement('button')
    presetBtn.type = 'button'
    presetBtn.className = 'td-zone__preset-btn'
    presetBtn.textContent = '预设'
    presetBtn.style.display = 'none'
    presetBtn.addEventListener('click', () => this._showZonePresetMenu(presetBtn, zone))

    zoneHeader.append(toggleBtn, labelEl, countEl, presetBtn, addBtn)

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
      presetBtn.style.display = expanded && zone === 'footer' ? 'inline-flex' : 'none'
    })

    zoneEl.append(zoneHeader, body)
    return zoneEl
  }

  private _rebuildZoneBody(zone: 'header' | 'footer') {
    const bodyEl = zone === 'header' ? this.headerZoneBodyEl : this.footerZoneBodyEl
    const blocks = this._getZoneBlocks(zone)
    const countEl = zone === 'header' ? this.headerZoneCountEl : this.footerZoneCountEl
    const presetRef = zone === 'header'
      ? this.schema.layout?.pageDecorations?.header
      : this.schema.layout?.pageDecorations?.footer

    if (!bodyEl) return
    bodyEl.innerHTML = ''
    if (countEl) {
      countEl.textContent = blocks.length
        ? `(${blocks.length})`
        : presetRef?.id
          ? '(预设)'
          : '(空)'
    }

    const decorationNotice = this._createZoneDecorationNotice(zone)
    if (decorationNotice) {
      bodyEl.append(decorationNotice)
    }

    if (blocks.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'td-zone__empty'
      empty.textContent = zone === 'footer'
        ? '拖入物料、使用预设或点击“添加块”开始配置页脚'
        : '拖入物料或点击“添加块”开始配置页眉'
      empty.addEventListener('dragover', event => {
        if (!hasPaletteDragPayload(event.dataTransfer)) return
        event.preventDefault()
        empty.classList.add('td-zone__empty--active')
      })
      empty.addEventListener('dragleave', () => {
        empty.classList.remove('td-zone__empty--active')
      })
      empty.addEventListener('drop', event => {
        const payload = parsePaletteDragPayload(event.dataTransfer)
        empty.classList.remove('td-zone__empty--active')
        if (!payload) return
        event.preventDefault()
        this._insertZoneBlocksAt(zone, 0, this._createZoneBlocksFromPayload(payload))
      })
      bodyEl.append(empty)
      return
    }

    for (let i = 0; i < blocks.length; i++) {
      bodyEl.append(this._createZoneDropSlot(zone, i), this._renderZoneCard(zone, blocks[i], i))
    }
    bodyEl.append(this._createZoneDropSlot(zone, blocks.length, true))
  }

  private _createZoneDecorationNotice(zone: 'header' | 'footer'): HTMLDivElement | null {
    const presetRef = zone === 'header'
      ? this.schema.layout?.pageDecorations?.header
      : this.schema.layout?.pageDecorations?.footer
    if (!presetRef?.id) return null

    const preset = getTemplatePageDecorationPreset(presetRef.id)
    const notice = document.createElement('div')
    notice.className = 'td-zone__decoration-notice'

    const copy = document.createElement('div')
    copy.className = 'td-zone__decoration-copy'

    const title = document.createElement('strong')
    title.textContent = `${zone === 'header' ? '页眉' : '页脚'}当前使用通用模板`

    const desc = document.createElement('span')
    desc.textContent = `已套用“${preset?.name ?? presetRef.id}” · ${PAGE_DECORATION_MODE_LABEL[presetRef.mode ?? 'replace']}。如需改具体内容，请先转为当前模板自己的可编辑区块。`

    copy.append(title, desc)

    const action = document.createElement('button')
    action.type = 'button'
    action.className = 'td-zone__decoration-action'
    action.textContent = `转为可编辑${zone === 'header' ? '页眉' : '页脚'}`
    action.addEventListener('click', () => {
      void this._materializeZonePreset(zone)
    })

    notice.append(copy, action)
    return notice
  }

  private async _materializeZonePreset(zone: 'header' | 'footer') {
    const presetRef = zone === 'header'
      ? this.schema.layout?.pageDecorations?.header
      : this.schema.layout?.pageDecorations?.footer
    if (!presetRef?.id) {
      TemplateFeedback.toast(`当前${zone === 'header' ? '页眉' : '页脚'}未使用通用模板`, 'info')
      return
    }

    const preset = getTemplatePageDecorationPreset(presetRef.id)
    const confirmed = await TemplateFeedback.confirm({
      title: `转为可编辑${zone === 'header' ? '页眉' : '页脚'}`,
      message: `将把“${preset?.name ?? presetRef.id}”按当前合并模式展开为当前模板的${zone === 'header' ? '页眉' : '页脚'}区块。转换后可直接编辑，但不会再跟随后续通用模板变化。`,
      tone: 'warning',
      confirmText: '转为可编辑'
    })
    if (!confirmed) return

    const fullSchema = this._buildFullSchema()
    const resolved = getResolvedTemplateBlocks(fullSchema)
    const nextBlocks = cloneTemplateBlocks(
      zone === 'header' ? resolved.header : resolved.footer
    )

    const currentLayout = { ...(this.schema.layout ?? {}) }
    const pageDecorations = currentLayout.pageDecorations
      ? { ...currentLayout.pageDecorations }
      : undefined
    if (pageDecorations) {
      delete pageDecorations[zone]
    }

    if (pageDecorations?.header || pageDecorations?.footer) {
      currentLayout.pageDecorations = pageDecorations
    } else {
      delete currentLayout.pageDecorations
    }

    this.schema = {
      ...this.schema,
      layout: currentLayout
    }
    if (zone === 'header') {
      this.headerBlocks = nextBlocks
      this._rebuildZoneBody('header')
    } else {
      this.footerBlocks = nextBlocks
      this._rebuildZoneBody('footer')
    }
    this.props.setLayout(currentLayout)
    this._refreshDesignerState()
    this._schedulePreviewRefresh()
    TemplateFeedback.toast(`已转为可编辑${zone === 'header' ? '页眉' : '页脚'}区块`, 'success')
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
    document.querySelector('.td-zone__preset-menu')?.remove()

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

  private _showZonePresetMenu(anchor: HTMLButtonElement, zone: ZoneKey) {
    if (zone !== 'footer') return
    document.querySelector('.td-zone__preset-menu')?.remove()
    document.querySelector('.td-zone__add-menu')?.remove()

    const menu = document.createElement('div')
    menu.className = 'td-zone__add-menu td-zone__preset-menu'

    FOOTER_PRESET_OPTIONS.forEach(option => {
      const item = document.createElement('div')
      item.className = 'td-zone__add-menu-item td-zone__add-menu-item--preset'
      const label = document.createElement('strong')
      label.textContent = option.label
      const desc = document.createElement('span')
      desc.textContent = option.description
      item.append(label, desc)
      item.addEventListener('click', () => {
        menu.remove()
        this._insertZoneBlocksAt('footer', this.footerBlocks.length, createFooterPresetBlocks(option.id))
      })
      menu.append(item)
    })

    const rect = anchor.getBoundingClientRect()
    menu.style.top = `${rect.bottom + 4}px`
    menu.style.left = `${rect.left}px`
    document.body.append(menu)

    const closeMenu = (event: MouseEvent) => {
      if (!menu.contains(event.target as Node) && event.target !== anchor) {
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
    this._refreshDesignerState()
    this._schedulePreviewRefresh()
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
    this.activeParentIndex = target?.parentIndex ?? null
    this.selection = target
    // Clear zone row highlights
    document.querySelectorAll('.td-zone__block-row--selected').forEach(r =>
      r.classList.remove('td-zone__block-row--selected')
    )
    this.props.update(this._getActiveBlocks(), this._getPropsSelection())
    this._refreshDesignerState()
  }

  private _handleDeleteBlock(blockIndex: number) {
    const blocks = [...this.schema.blocks]
    blocks.splice(blockIndex, 1)
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.selection = null
    this.activeParentIndex = null
    this._syncDesignerAfterChange()
  }

  private _handleMoveBlock(blockIndex: number, delta: -1 | 1) {
    const blocks = [...this.schema.blocks]
    const targetIndex = blockIndex + delta
    if (targetIndex < 0 || targetIndex >= blocks.length) return
    const moving = blocks[blockIndex]
    blocks[blockIndex] = blocks[targetIndex]
    blocks[targetIndex] = moving
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this._syncDesignerAfterChange()
  }

  private _handleReorder(blocks: ITemplateBlock[]) {
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.selection = null
    this.activeParentIndex = null
    this._syncDesignerAfterChange()
  }

  private _handleInsertAt(index: number, insertedBlocks: ITemplateBlock[]) {
    if (!insertedBlocks.length) return
    this.activeZone = 'main'
    const blocks = [...this.schema.blocks]
    blocks.splice(index, 0, ...insertedBlocks)
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.selection = { kind: 'block', blockIndex: index }
    this.activeParentIndex = null
    this._syncDesignerAfterChange()
  }

  private _handleCopy(blockIndex: number, cloned: ITemplateBlock) {
    const blocks = [...this.schema.blocks]
    blocks.splice(blockIndex + 1, 0, cloned)
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this._syncDesignerAfterChange()
  }

  private _handlePresetInsert(newBlocks: ITemplateBlock[]) {
    this.activeZone = 'main'
    const blocks = [...this.schema.blocks, ...newBlocks]
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.selection = newBlocks.length
      ? { kind: 'block', blockIndex: blocks.length - newBlocks.length }
      : null
    this.activeParentIndex = null
    this._syncDesignerAfterChange()
  }

  private _handleBlockChange(
    blockIndex: number,
    updated: ITemplateBlock,
    phase: PropertiesChangePhase = 'commit'
  ) {
    const blocks = [...this._getActiveBlocks()]
    blocks[blockIndex] = updated
    this._setActiveBlocks(blocks)
    const active = this._getActiveBlocks()
    if (this.activeZone !== 'main') {
      this._rebuildZoneBody(this.activeZone as 'header' | 'footer')
    }
    if (phase === 'input') {
      this._refreshDesignerState()
      return
    }
    this.props.update(active, this._getPropsSelection())
    this._refreshDesignerState()
    this._schedulePreviewRefresh()
  }

  private _handleFieldChange(
    blockIndex: number,
    fieldId: string,
    updated: ITemplateField,
    phase: PropertiesChangePhase = 'commit'
  ) {
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
    if (phase === 'input') {
      this._refreshDesignerState()
      return
    }
    this._syncDesignerAfterChange()
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
    this._syncDesignerAfterChange()
  }

  private _handleFieldRowReorder(blockIndex: number, fields: ITemplateField[]) {
    const blocks = [...this._getActiveBlocks()]
    const block = blocks[blockIndex]
    if (block.type !== 'fieldRow') return
    blocks[blockIndex] = { ...block, fields }
    this._setActiveBlocks(blocks)
    this._syncDesignerAfterChange()
  }

  private _handleFieldRowDelete(blockIndex: number, fieldId: string) {
    const blocks = [...this._getActiveBlocks()]
    const block = blocks[blockIndex]
    if (block.type !== 'fieldRow') return
    blocks[blockIndex] = {
      ...block,
      fields: block.fields.filter(field => field.id !== fieldId)
    }
    this._setActiveBlocks(blocks)
    if (this.selection?.kind === 'field' && this.selection.fieldId === fieldId) {
      this.selection = { kind: 'block', blockIndex }
    }
    this._syncDesignerAfterChange()
  }

  private _handleNestedInsert(parentIndex: number, block: ITemplateBlock) {
    const blocks = [...this.schema.blocks]
    const parent = blocks[parentIndex]
    if (parent.type !== 'section' && parent.type !== 'group') return
    if (!canNestBlock(parent, block.type)) return
    const childIndex = parent.blocks.length
    blocks[parentIndex] = { ...parent, blocks: [...parent.blocks, block] }
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.selection = { kind: 'block', blockIndex: childIndex, parentIndex }
    this.activeZone = 'main'
    this.activeParentIndex = parentIndex
    this._syncDesignerAfterChange()
  }

  private _handleNestedInsertAt(
    parentIndex: number,
    childIndex: number,
    insertedBlocks: ITemplateBlock[]
  ) {
    if (!insertedBlocks.length) return
    const blocks = [...this.schema.blocks]
    const parent = blocks[parentIndex]
    if (parent.type !== 'section' && parent.type !== 'group') return
    const nestableBlocks = filterNestableBlocks(parent, insertedBlocks)
    if (!nestableBlocks.length) return
    const children = [...parent.blocks]
    children.splice(childIndex, 0, ...nestableBlocks)
    blocks[parentIndex] = { ...parent, blocks: children }
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this.selection = { kind: 'block', blockIndex: childIndex, parentIndex }
    this.activeZone = 'main'
    this.activeParentIndex = parentIndex
    this._syncDesignerAfterChange()
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
    this.selection = null
    this.activeParentIndex = parentIndex
    this._syncDesignerAfterChange()
  }

  private async _handleTreeDelete(
    zone: 'main' | 'header' | 'footer',
    target: { kind: 'block'; blockIndex: number; parentIndex?: number }
  ) {
    const block = this._getTreeBlock(zone, target)
    if (!block) return

    let confirmed = true
    if ((block.type === 'section' || block.type === 'group') && block.blocks.length > 0) {
      confirmed = await TemplateFeedback.confirm({
        title: '删除结构节点',
        message: `该${ZONE_BLOCK_LABEL[block.type]}包含 ${block.blocks.length} 个子块，删除后将一并移除，确定继续吗？`,
        tone: 'warning',
        confirmText: '删除'
      })
    }
    if (!confirmed) return

    if (zone === 'main') {
      if (target.parentIndex != null) {
        this._handleNestedDelete(target.parentIndex, target.blockIndex)
      } else {
        this._handleDeleteBlock(target.blockIndex)
      }
      return
    }

    this._deleteZoneBlock(zone, target.blockIndex)
  }

  private _getTreeBlock(
    zone: 'main' | 'header' | 'footer',
    target: { kind: 'block'; blockIndex: number; parentIndex?: number }
  ): ITemplateBlock | undefined {
    if (zone === 'main') {
      if (target.parentIndex != null) {
        const parent = this.schema.blocks[target.parentIndex]
        if (parent?.type === 'section' || parent?.type === 'group') {
          return parent.blocks[target.blockIndex]
        }
        return undefined
      }
      return this.schema.blocks[target.blockIndex]
    }
    return this._getZoneBlocks(zone)[target.blockIndex]
  }

  private _handleNestedMove(parentIndex: number, childIndex: number, delta: -1 | 1) {
    const blocks = [...this.schema.blocks]
    const parent = blocks[parentIndex]
    if (parent.type !== 'section' && parent.type !== 'group') return
    const children = [...parent.blocks]
    const targetIndex = childIndex + delta
    if (targetIndex < 0 || targetIndex >= children.length) return
    const moving = children[childIndex]
    children[childIndex] = children[targetIndex]
    children[targetIndex] = moving
    blocks[parentIndex] = { ...parent, blocks: children }
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this._syncDesignerAfterChange()
  }

  private _handleNestedReorder(parentIndex: number, children: ITemplateBlock[]) {
    const blocks = [...this.schema.blocks]
    const parent = blocks[parentIndex]
    if (parent.type !== 'section' && parent.type !== 'group') return
    blocks[parentIndex] = { ...parent, blocks: children }
    this.schema = { ...this.schema, blocks }
    this.canvas.setBlocks(blocks)
    this._syncDesignerAfterChange()
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

  private _handleLayoutChange(
    layout: ITemplateLayout,
    phase: PropertiesChangePhase = 'commit'
  ) {
    this.schema = { ...this.schema, layout }
    this._rebuildZoneBody('header')
    this._rebuildZoneBody('footer')
    this._refreshDesignerState()
    if (phase === 'input') return
    if (this._isPreviewVisible()) {
      this._doRefreshPreview()
      return
    }
  }

  private _handlePreview() {
    const isWide = this.designContentEl.closest('.td-designer--wide') !== null
    if (isWide) {
      this._doRefreshPreview()
      return
    }
    this._switchTab('preview')
  }

  private _handleSave() {
    const updatedSchema = this._buildFullSchema()
    const category = this.categoryInput.value.trim() || '自定义'
    this.options.onSave(updatedSchema, category)
    this._savedSchemaJSON = JSON.stringify(updatedSchema)
    this._dispose()
  }

  private async _handleClose() {
    const current = this._buildFullSchema()
    const isDirty = JSON.stringify(current) !== this._savedSchemaJSON
    if (isDirty) {
      const confirmed = await TemplateFeedback.confirm({
        title: '关闭设计器',
        message: '有未保存的更改，确定关闭吗？',
        tone: 'warning',
        confirmText: '关闭'
      })
      if (!confirmed) return
    }
    this.options.onClose()
    this._dispose()
  }

  private _isPreviewVisible() {
    return this.activeTab === 'preview' ||
      this.designContentEl.closest('.td-designer--wide') !== null
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
    if (!this._isPreviewVisible()) return
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
        pageNumber: getTemplatePageNumberOptions(schema),
        paperDirection: pageConfig.orientation === 'landscape'
          ? PaperDirection.HORIZONTAL
          : PaperDirection.VERTICAL
      }
    )
    this.previewRuleEngine = new TemplateRuleEngine(this.previewEditorInstance, schema)
  }

  private _dispose() {
    if (this.previewDebounceTimer) clearTimeout(this.previewDebounceTimer)
    this.previewRuleEngine?.dispose()
    this.previewEditorInstance?.destroy()
    this.resizeObserver?.disconnect()
    this._unlockRootScroll()
    this.mask.remove()
    this.container.remove()
  }
}
