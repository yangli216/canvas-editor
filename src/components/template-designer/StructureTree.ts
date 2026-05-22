import type {
  ITemplateBlock,
  ITemplateField,
  ITemplateSchema,
  ITemplateSectionBlock,
  ITemplateGroupBlock,
  ITemplateParagraphBlock,
  ITemplateFieldRowBlock,
  ITemplateStaticTextBlock,
  ITemplateTableBlock
} from '../../editor/template/index'
import { validateSchema } from '../../editor/template/index'
import type { SelectionTarget } from './SchemaCanvas'

type TreeZone = 'main' | 'header' | 'footer'

interface IStructureTreeOptions {
  onSelect: (zone: TreeZone, target: SelectionTarget) => void
  onDeleteBlock?: (
    zone: TreeZone,
    target: { kind: 'block'; blockIndex: number; parentIndex?: number }
  ) => void
}

const BLOCK_LABEL: Record<ITemplateBlock['type'], string> = {
  paragraph: '段落',
  fieldRow: '字段行',
  section: '分节',
  group: '组合',
  separator: '分隔线',
  table: '表格',
  staticText: '静态文本'
}

const RULE_TYPE_LABEL: Record<string, string> = {
  required: '必填',
  readonly: '只读',
  hidden: '隐藏',
  visibility: '显隐',
  cascade: '级联'
}

type ValidationCountMap = Map<string, number>

interface IFieldTreeItem {
  field: ITemplateField
  matches: boolean
}

interface IBlockMetadataSummary {
  boundFieldCount: number
  businessCodes: string[]
  dataSources: string[]
  permissions: string[]
  tags: string[]
}

interface IZoneMetadataSummary {
  boundBlockCount: number
  boundFieldCount: number
  businessCodeCount: number
  dataSourceCount: number
  listenerCount: number
}

function getBlockFields(block: ITemplateBlock): ITemplateField[] {
  if (block.type === 'fieldRow') return block.fields
  if (block.type === 'paragraph') {
    return block.segments
      .flatMap(segment => segment.type === 'field' ? [segment.field] : [])
  }
  if (block.type === 'table') {
    return block.columns
      .filter(column => column.field)
      .map(column => column.field!)
  }
  return []
}

function collectNestedFields(block: ITemplateBlock): ITemplateField[] {
  if (block.type === 'section' || block.type === 'group') {
    return block.blocks.flatMap(child => collectNestedFields(child))
  }
  return getBlockFields(block)
}

function collectNestedBlocks(blocks: ITemplateBlock[]): ITemplateBlock[] {
  return blocks.flatMap(block => {
    if (block.type === 'section' || block.type === 'group') {
      return [block, ...collectNestedBlocks(block.blocks)]
    }
    return [block]
  })
}

function getBlockMetadataSummary(block: ITemplateBlock): IBlockMetadataSummary {
  const metadataFields = collectNestedFields(block).filter(field => {
    const metadata = field.metadata
    return Boolean(
      metadata?.businessCode ||
      metadata?.group ||
      metadata?.permission ||
      metadata?.dataSource ||
      metadata?.listeners?.length ||
      metadata?.tags?.length
    )
  })

  return {
    boundFieldCount: metadataFields.length,
    businessCodes: [...new Set(metadataFields.map(field => field.metadata?.businessCode).filter(Boolean) as string[])],
    dataSources: [...new Set(metadataFields.map(field => field.metadata?.dataSource).filter(Boolean) as string[])],
    permissions: [...new Set(metadataFields.map(field => field.metadata?.permission).filter(Boolean) as string[])],
    tags: [...new Set(metadataFields.flatMap(field => field.metadata?.tags ?? []))]
  }
}

function getZoneMetadataSummary(blocks: ITemplateBlock[]): IZoneMetadataSummary {
  const blockSummaries = collectNestedBlocks(blocks).map(block => getBlockMetadataSummary(block))
  const fields = blocks.flatMap(block => collectNestedFields(block))
  const metadataFields = fields.filter(field => {
    const metadata = field.metadata
    return Boolean(
      metadata?.businessCode ||
      metadata?.group ||
      metadata?.permission ||
      metadata?.dataSource ||
      metadata?.listeners?.length ||
      metadata?.tags?.length
    )
  })

  return {
    boundBlockCount: blockSummaries.filter(summary => summary.boundFieldCount > 0).length,
    boundFieldCount: metadataFields.length,
    businessCodeCount: new Set(metadataFields.map(field => field.metadata?.businessCode).filter(Boolean)).size,
    dataSourceCount: new Set(metadataFields.map(field => field.metadata?.dataSource).filter(Boolean)).size,
    listenerCount: new Set(metadataFields.flatMap(field => field.metadata?.listeners ?? [])).size
  }
}

export class StructureTree {
  private container: HTMLDivElement
  private options: IStructureTreeOptions
  private schema: ITemplateSchema | null = null
  private activeZone: TreeZone = 'main'
  private selection: SelectionTarget = null
  private keyword = ''
  private collapsedZones = new Set<TreeZone>()
  private collapsedNodes = new Set<string>()
  private onlyErrors = false
  private onlyRules = false

  constructor(options: IStructureTreeOptions) {
    this.options = options
    this.container = document.createElement('div')
    this.container.className = 'td-tree'
  }

  setData(
    schema: ITemplateSchema,
    activeZone: TreeZone,
    selection: SelectionTarget
  ) {
    this.schema = schema
    this.activeZone = activeZone
    this.selection = selection
    this._render()
  }

  getElement(): HTMLDivElement {
    return this.container
  }

  private _render() {
    this.container.innerHTML = ''

    this.container.append(this._renderToolbar())

    if (!this.schema) {
      const empty = document.createElement('div')
      empty.className = 'td-tree__empty'
      empty.textContent = '暂无结构'
      this.container.append(empty)
      return
    }

    const validationMap = this._buildValidationCountMap(this.schema)

    this.container.append(
      this._renderZone('页眉', 'header', this.schema.header ?? [], validationMap),
      this._renderZone('正文', 'main', this.schema.blocks, validationMap),
      this._renderZone('页脚', 'footer', this.schema.footer ?? [], validationMap)
    )
  }

  private _renderToolbar(): HTMLDivElement {
    const head = document.createElement('div')
    head.className = 'td-tree__toolbar'

    const titleRow = document.createElement('div')
    titleRow.className = 'td-tree__toolbar-head'

    const title = document.createElement('div')
    title.className = 'td-tree__title'
    title.textContent = '页面结构'

    const actions = document.createElement('div')
    actions.className = 'td-tree__toolbar-actions'

    const expandBtn = document.createElement('button')
    expandBtn.type = 'button'
    expandBtn.className = 'td-tree__toolbar-btn'
    expandBtn.textContent = '展开'
    expandBtn.addEventListener('click', () => {
      this.collapsedZones.clear()
      this.collapsedNodes.clear()
      this._render()
    })

    const collapseBtn = document.createElement('button')
    collapseBtn.type = 'button'
    collapseBtn.className = 'td-tree__toolbar-btn'
    collapseBtn.textContent = '收起'
    collapseBtn.addEventListener('click', () => {
      this.collapsedZones = new Set<TreeZone>(['header', 'main', 'footer'])
      this.collapsedNodes.clear()
      this._render()
    })

    actions.append(expandBtn, collapseBtn)
    titleRow.append(title, actions)

    const search = document.createElement('input')
    search.type = 'search'
    search.className = 'td-tree__search'
    search.placeholder = '搜索块、字段、规则或异常'
    search.value = this.keyword
    search.addEventListener('input', () => {
      this.keyword = search.value.trim()
      this._render()
    })

    const filters = document.createElement('div')
    filters.className = 'td-tree__filters'

    const errorBtn = document.createElement('button')
    errorBtn.type = 'button'
    errorBtn.className = `td-tree__filter-btn${this.onlyErrors ? ' td-tree__filter-btn--active' : ''}`
    errorBtn.textContent = '仅看异常'
    errorBtn.addEventListener('click', () => {
      this.onlyErrors = !this.onlyErrors
      this._render()
    })

    const ruleBtn = document.createElement('button')
    ruleBtn.type = 'button'
    ruleBtn.className = `td-tree__filter-btn${this.onlyRules ? ' td-tree__filter-btn--active' : ''}`
    ruleBtn.textContent = '仅看规则'
    ruleBtn.addEventListener('click', () => {
      this.onlyRules = !this.onlyRules
      this._render()
    })

    filters.append(errorBtn, ruleBtn)

    head.append(titleRow, search, filters)
    return head
  }

  private _renderZone(
    label: string,
    zone: TreeZone,
    blocks: ITemplateBlock[],
    validationMap: ValidationCountMap
  ): HTMLDivElement {
    const section = document.createElement('div')
    section.className = 'td-tree__section'

    const header = document.createElement('div')
    header.className = 'td-tree__section-header'
    const visibleNodes = this.keyword
      ? blocks
        .map((block, index) => this._createVisibleNode(zone, block, index, validationMap))
        .filter(Boolean).length
      : blocks.length

    const toggle = document.createElement('button')
    toggle.type = 'button'
    toggle.className = 'td-tree__section-toggle'
    const collapsed = this.collapsedZones.has(zone) && !this.keyword
    toggle.textContent = collapsed ? '▶' : '▼'
    toggle.addEventListener('click', () => {
      if (this.collapsedZones.has(zone)) this.collapsedZones.delete(zone)
      else this.collapsedZones.add(zone)
      this._render()
    })

    const text = document.createElement('span')
    text.textContent = `${label} (${visibleNodes}/${blocks.length})`
    header.append(toggle, text)

    const zoneSummary = getZoneMetadataSummary(blocks)
    if (zoneSummary.boundFieldCount > 0) {
      const meta = document.createElement('span')
      meta.className = 'td-tree__section-meta'
      meta.textContent = `业务块 ${zoneSummary.boundBlockCount} · 字段 ${zoneSummary.boundFieldCount} · 编码 ${zoneSummary.businessCodeCount} · 数据源 ${zoneSummary.dataSourceCount} · 监听 ${zoneSummary.listenerCount}`
      header.append(meta)
    }

    section.append(header)

    if (collapsed) return section

    const visible = blocks
      .map((block, index) => this._createVisibleNode(zone, block, index, validationMap))
      .filter((node): node is HTMLDivElement => Boolean(node))

    if (!visible.length) {
      const empty = document.createElement('div')
      empty.className = 'td-tree__empty td-tree__empty--inline'
      empty.textContent = blocks.length ? '无匹配结果' : '暂无内容'
      section.append(empty)
      return section
    }

    const list = document.createElement('div')
    list.className = 'td-tree__list'
    visible.forEach(node => list.append(node))
    section.append(list)
    return section
  }

  private _createVisibleNode(
    zone: TreeZone,
    block: ITemplateBlock,
    index: number,
    validationMap: ValidationCountMap,
    parentIndex?: number
  ): HTMLDivElement | null {
    const fields = getBlockFields(block)
    const matchedFields = fields
      .map(field => ({ field, matches: this._fieldMatches(field) }))
      .filter(item => this._fieldVisible(item.field, validationMap, item.matches))

    const children = zone === 'main' && (block.type === 'section' || block.type === 'group')
      ? (block as ITemplateSectionBlock | ITemplateGroupBlock).blocks
        .map((child, childIndex) => this._createVisibleNode(zone, child, childIndex, validationMap, index))
        .filter((node): node is HTMLDivElement => Boolean(node))
      : []

    const selfMatches = this._blockMatches(block)
    const hasVisibleFields = matchedFields.length > 0
    const hasChildren = children.length > 0
    const selfPassesFilters = this._blockPassesActiveFilters(block)

    if ((this.keyword && !selfMatches && !hasVisibleFields && !hasChildren) ||
      (this._hasActiveFilter() && !selfPassesFilters && !hasVisibleFields && !hasChildren)) {
      return null
    }

    return this._renderNode(
      zone,
      block,
      index,
      validationMap,
      parentIndex,
      matchedFields,
      children
    )
  }

  private _renderNode(
    zone: TreeZone,
    block: ITemplateBlock,
    index: number,
    validationMap: ValidationCountMap,
    parentIndex?: number,
    visibleFields: IFieldTreeItem[] = [],
    visibleChildren: HTMLDivElement[] = []
  ): HTMLDivElement {
    const node = document.createElement('div')
    const isSelected = this.activeZone === zone &&
      this.selection?.kind === 'block' &&
      this.selection.blockIndex === index &&
      this.selection.parentIndex === parentIndex
    const nodeKey = this._getNodeKey(zone, index, parentIndex)
    const canCollapse = visibleFields.length > 0 || visibleChildren.length > 0
    const expanded = this.keyword ? true : !this.collapsedNodes.has(nodeKey)
    node.className = `td-tree__node${isSelected ? ' td-tree__node--active' : ''}${parentIndex != null ? ' td-tree__node--nested' : ''}`

    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'td-tree__node-btn'
    button.addEventListener('click', () => {
      this.options.onSelect(zone, {
        kind: 'block',
        blockIndex: index,
        ...(parentIndex != null ? { parentIndex } : {})
      })
    })

    const ordinal = document.createElement('span')
    ordinal.className = 'td-tree__node-order'
    ordinal.textContent = parentIndex != null
      ? `${parentIndex + 1}.${index + 1}`
      : String(index + 1).padStart(2, '0')

    const type = document.createElement('span')
    type.className = `td-tree__node-type td-tree__node-type--${block.type}`
    type.textContent = BLOCK_LABEL[block.type]

    const text = document.createElement('span')
    text.className = 'td-tree__node-text'
    text.textContent = this._getSummary(block)
    text.title = text.textContent

    if (canCollapse) {
      const expander = document.createElement('span')
      expander.className = 'td-tree__node-expander'
      expander.textContent = expanded ? '▼' : '▶'
      expander.addEventListener('click', event => {
        event.preventDefault()
        event.stopPropagation()
        if (this.collapsedNodes.has(nodeKey)) this.collapsedNodes.delete(nodeKey)
        else this.collapsedNodes.add(nodeKey)
        this._render()
      })
      button.append(expander)
    } else {
      const spacer = document.createElement('span')
      spacer.className = 'td-tree__node-expander td-tree__node-expander--placeholder'
      spacer.textContent = '•'
      button.append(spacer)
    }

    button.append(ordinal, type, text)

    const metadataSummary = getBlockMetadataSummary(block)
    if (metadataSummary.boundFieldCount > 0) {
      const badge = document.createElement('span')
      badge.className = 'td-tree__node-badge'
      badge.textContent = `业务 ${metadataSummary.boundFieldCount}`
      badge.title = [
        metadataSummary.businessCodes.length ? `业务编码: ${metadataSummary.businessCodes.join('、')}` : '',
        metadataSummary.dataSources.length ? `数据源: ${metadataSummary.dataSources.join('、')}` : '',
        metadataSummary.permissions.length ? `权限: ${metadataSummary.permissions.join('、')}` : '',
        metadataSummary.tags.length ? `标签: ${metadataSummary.tags.join('、')}` : ''
      ].filter(Boolean).join('\n')
      button.append(badge)
    }

    if ((block.type === 'section' || block.type === 'group') && block.rules?.length) {
      const badge = document.createElement('span')
      badge.className = 'td-tree__node-badge'
      badge.textContent = `规 ${block.rules.length}`
      button.append(badge)
    }
    const row = document.createElement('div')
    row.className = 'td-tree__node-row'
    row.append(button)

    const deleteBtn = document.createElement('button')
    deleteBtn.type = 'button'
    deleteBtn.className = 'td-tree__node-action td-tree__node-action--danger'
    deleteBtn.textContent = '×'
    deleteBtn.title = '删除节点'
    deleteBtn.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      this.options.onDeleteBlock?.(zone, {
        kind: 'block',
        blockIndex: index,
        ...(parentIndex != null ? { parentIndex } : {})
      })
    })
    row.append(deleteBtn)

    node.append(row)

    if (expanded && visibleFields.length) {
      const fieldWrap = document.createElement('div')
      fieldWrap.className = 'td-tree__fields'
      visibleFields.forEach(({ field, matches }) => {
        fieldWrap.append(this._renderFieldNode(zone, field, index, validationMap, parentIndex, matches))
      })
      node.append(fieldWrap)
    }

    if (expanded && visibleChildren.length) {
      const childWrap = document.createElement('div')
      childWrap.className = 'td-tree__children'
      visibleChildren.forEach(child => childWrap.append(child))
      node.append(childWrap)
    }

    return node
  }

  private _renderFieldNode(
    zone: TreeZone,
    field: ITemplateField,
    blockIndex: number,
    validationMap: ValidationCountMap,
    parentIndex?: number,
    matches = false
  ): HTMLButtonElement {
    const button = document.createElement('button')
    const isSelected = this.activeZone === zone &&
      this.selection?.kind === 'field' &&
      this.selection.blockIndex === blockIndex &&
      this.selection.parentIndex === parentIndex &&
      this.selection.fieldId === field.id

    button.type = 'button'
    button.className = `td-tree__field-btn${isSelected ? ' td-tree__field-btn--active' : ''}${matches ? ' td-tree__field-btn--matched' : ''}`
    button.title = `${field.label || field.id} · ${field.type}`
    button.addEventListener('click', () => {
      this.options.onSelect(zone, {
        kind: 'field',
        blockIndex,
        fieldId: field.id,
        ...(parentIndex != null ? { parentIndex } : {})
      })
    })

    const chip = document.createElement('span')
    chip.className = 'td-tree__field-type'
    chip.textContent = field.type

    const text = document.createElement('span')
    text.className = 'td-tree__field-text'
    text.textContent = field.label || field.id

    button.append(chip, text)

    if (field.metadata?.businessCode) {
      const badge = document.createElement('span')
      badge.className = 'td-tree__field-badge td-tree__field-badge--meta'
      badge.textContent = '业务'
      badge.title = `业务编码: ${field.metadata.businessCode}`
      button.append(badge)
    }

    if (field.metadata?.dataSource) {
      const badge = document.createElement('span')
      badge.className = 'td-tree__field-badge td-tree__field-badge--meta-subtle'
      badge.textContent = field.metadata.dataSource
      badge.title = `数据源: ${field.metadata.dataSource}`
      button.append(badge)
    }

    const ruleCount = field.rules?.length ?? 0
    if (ruleCount > 0) {
      const badge = document.createElement('span')
      badge.className = 'td-tree__field-badge td-tree__field-badge--rule'
      badge.textContent = `规 ${ruleCount}`
      const ruleLabels = [...new Set((field.rules ?? []).map(rule => RULE_TYPE_LABEL[rule.type] || rule.type))]
      badge.title = `规则: ${ruleLabels.join('、')}`
      button.append(badge)
    }

    const issueCount = validationMap.get(field.id) ?? 0
    if (issueCount > 0) {
      const badge = document.createElement('span')
      badge.className = 'td-tree__field-badge td-tree__field-badge--error'
      badge.textContent = `异常 ${issueCount}`
      badge.title = `${field.label || field.id} 存在 ${issueCount} 个结构问题`
      button.append(badge)
    }

    return button
  }

  private _getNodeKey(
    zone: TreeZone,
    index: number,
    parentIndex?: number
  ): string {
    return `${zone}:${parentIndex ?? 'root'}:${index}`
  }

  private _buildValidationCountMap(schema: ITemplateSchema): ValidationCountMap {
    const map: ValidationCountMap = new Map()
    for (const error of validateSchema(schema)) {
      if (!error.fieldId) continue
      map.set(error.fieldId, (map.get(error.fieldId) ?? 0) + 1)
    }
    return map
  }

  private _blockMatches(block: ITemplateBlock): boolean {
    if (!this.keyword) return true
    const metadataSummary = getBlockMetadataSummary(block)
    const text = [
      BLOCK_LABEL[block.type],
      this._getSummary(block),
      ...metadataSummary.businessCodes,
      ...metadataSummary.dataSources,
      ...metadataSummary.permissions,
      ...metadataSummary.tags
    ].join(' ').toLowerCase()
    return text.includes(this.keyword.toLowerCase())
  }

  private _fieldMatches(field: ITemplateField): boolean {
    if (!this.keyword) return true
    const text = [
      field.id,
      field.label ?? '',
      field.type,
      field.metadata?.businessCode ?? '',
      field.metadata?.group ?? '',
      field.metadata?.permission ?? '',
      field.metadata?.dataSource ?? '',
      ...(field.metadata?.listeners ?? []),
      ...(field.metadata?.tags ?? []),
      ...(field.rules ?? []).map(rule => RULE_TYPE_LABEL[rule.type] || rule.type)
    ].join(' ').toLowerCase()
    return text.includes(this.keyword.toLowerCase())
  }

  private _hasActiveFilter(): boolean {
    return this.onlyErrors || this.onlyRules
  }

  private _blockPassesActiveFilters(block: ITemplateBlock): boolean {
    if (!this._hasActiveFilter()) return true
    if (this.onlyErrors) return false
    if (this.onlyRules && (block.type === 'section' || block.type === 'group')) {
      return (block.rules?.length ?? 0) > 0
    }
    return false
  }

  private _fieldVisible(
    field: ITemplateField,
    validationMap: ValidationCountMap,
    keywordMatch: boolean
  ): boolean {
    if (this.keyword && !keywordMatch) return false
    if (this.onlyErrors && (validationMap.get(field.id) ?? 0) === 0) return false
    if (this.onlyRules && (field.rules?.length ?? 0) === 0) return false
    return true
  }

  private _getSummary(block: ITemplateBlock): string {
    if (block.type === 'section') return (block as ITemplateSectionBlock).title || '未命名分节'
    if (block.type === 'fieldRow') {
      const labels = (block as ITemplateFieldRowBlock).fields.map(field => field.label || field.id)
      return labels.join('、') || '字段行'
    }
    if (block.type === 'paragraph') {
      return (block as ITemplateParagraphBlock).segments
        .map(segment => segment.type === 'text' ? segment.value : `[${segment.field.label || segment.field.id}]`)
        .join('') || '段落'
    }
    if (block.type === 'group') {
      const group = block as ITemplateGroupBlock
      return `${group.direction || 'column'} · ${group.blocks.length} 个子块`
    }
    if (block.type === 'table') {
      return (block as ITemplateTableBlock).columns.map(column => column.header).join('、') || '表格'
    }
    if (block.type === 'staticText') {
      const text = (block as ITemplateStaticTextBlock).text || ''
      return text.slice(0, 28) || '静态文本'
    }
    return BLOCK_LABEL[block.type]
  }
}