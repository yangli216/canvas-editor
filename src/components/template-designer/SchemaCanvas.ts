import type {
  ITemplateBlock,
  ITemplateFieldRowBlock,
  ITemplateParagraphBlock,
  ITemplateSectionBlock,
  ITemplateGroupBlock,
  ITemplateTableBlock,
  ITemplateStaticTextBlock,
  ITemplateField
} from '../../editor/template/index'
import {
  canNestBlock,
  filterNestableBlocks,
  getAllowedNestedBlockTypes
} from './nesting'
import {
  getActivePaletteDragPayload,
  PALETTE_DRAG_MIME,
  type PaletteDragPayload
} from './paletteDragState'
import { TemplateFeedback } from './TemplateFeedback'

type BlockWithRules = ITemplateSectionBlock | ITemplateGroupBlock

export type SelectionTarget =
  | { kind: 'block'; blockIndex: number; parentIndex?: number }
  | { kind: 'field'; blockIndex: number; fieldId: string; parentIndex?: number }
  | null

export interface ISchemaCanvasOptions {
  onSelect: (target: SelectionTarget) => void
  onDelete: (blockIndex: number) => void
  onMoveUp: (blockIndex: number) => void
  onMoveDown: (blockIndex: number) => void
  onReorder?: (blocks: ITemplateBlock[]) => void
  onInsertAt?: (index: number, blocks: ITemplateBlock[]) => void
  onCopy?: (blockIndex: number, cloned: ITemplateBlock) => void
  onNestedInsert?: (parentIndex: number, block: ITemplateBlock) => void
  onNestedInsertAt?: (
    parentIndex: number,
    childIndex: number,
    blocks: ITemplateBlock[]
  ) => void
  onNestedDelete?: (parentIndex: number, childIndex: number) => void
  onNestedMoveUp?: (parentIndex: number, childIndex: number) => void
  onNestedMoveDown?: (parentIndex: number, childIndex: number) => void
  onNestedReorder?: (parentIndex: number, blocks: ITemplateBlock[]) => void
  onFieldRowReorder?: (blockIndex: number, fields: ITemplateField[]) => void
  onFieldRowDelete?: (blockIndex: number, fieldId: string) => void
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

const RULE_TYPE_COLOR: Record<string, string> = {
  visibility: '#4285f4',
  hidden: '#ff9800',
  readonly: '#9c27b0',
  required: '#e53935',
  cascade: '#2e7d32'
}

let idCounter = Date.now()
function genId(): string {
  return `field_${idCounter++}_${Math.random().toString(36).slice(2, 7)}`
}

function deepCloneBlock(block: ITemplateBlock): ITemplateBlock {
  const json = JSON.stringify(block)
  const cloned: ITemplateBlock = JSON.parse(json)
  remapFieldIds(cloned)
  return cloned
}

function remapFieldIds(block: ITemplateBlock) {
  if (block.type === 'fieldRow') {
    (block as ITemplateFieldRowBlock).fields.forEach(f => { f.id = genId() })
  } else if (block.type === 'paragraph') {
    for (const seg of (block as ITemplateParagraphBlock).segments) {
      if (seg.type === 'field') seg.field.id = genId()
    }
  } else if (block.type === 'section') {
    ;(block as ITemplateSectionBlock).blocks.forEach(remapFieldIds)
  } else if (block.type === 'group') {
    ;(block as ITemplateGroupBlock).blocks.forEach(remapFieldIds)
  } else if (block.type === 'table') {
    for (const col of (block as ITemplateTableBlock).columns) {
      if (col.field) col.field.id = genId()
    }
  }
  // staticText and separator have no fields
}

function fieldHasRules(field: ITemplateField): boolean {
  return (field.rules?.length ?? 0) > 0
}

function getFieldsFromBlock(block: ITemplateBlock): ITemplateField[] {
  if (block.type === 'fieldRow') return (block as ITemplateFieldRowBlock).fields
  if (block.type === 'paragraph') {
    return (block as ITemplateParagraphBlock).segments
      .filter(s => s.type === 'field')
      .map(s => (s as { type: 'field'; field: ITemplateField }).field)
  }
  if (block.type === 'table') {
    return (block as ITemplateTableBlock).columns
      .filter(c => c.field)
      .map(c => c.field!)
  }
  return [] // staticText, separator, section, group
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

export class SchemaCanvas {
  private container: HTMLDivElement
  private blocks: ITemplateBlock[] = []
  private selection: SelectionTarget = null
  private options: ISchemaCanvasOptions
  private expandedBlocks = new Set<number>()
  private dragFromIndex: number | null = null
  private lastInvalidDragHint: { message: string; at: number } | null = null

  constructor(options: ISchemaCanvasOptions) {
    this.options = options
    this.container = document.createElement('div')
    this.container.className = 'td-canvas'
  }

  setBlocks(blocks: ITemplateBlock[]) {
    this.blocks = blocks
    this._render()
  }

  setSelection(selection: SelectionTarget) {
    this.selection = selection
    if (selection) {
      if (selection.parentIndex != null) {
        this.expandedBlocks.add(selection.parentIndex)
      }
      const selectedBlock = this._getSelectedBlock(selection)
      if (selectedBlock?.type === 'section' || selectedBlock?.type === 'group') {
        this.expandedBlocks.add(selection.parentIndex ?? selection.blockIndex)
      }
    }
    this._render()
    this._revealSelection()
  }

  getBlocks(): ITemplateBlock[] {
    return this.blocks
  }

  addBlock(type: ITemplateBlock['type']) {
    const block = this.createDefaultBlock(type)
    this.blocks.push(block)
    this._render()
    this._selectBlock(this.blocks.length - 1)
  }

  private _getAllowedNestedTypes(parentIndex: number): Array<ITemplateBlock['type']> {
    const parent = this.blocks[parentIndex]
    if (parent?.type !== 'section' && parent?.type !== 'group') return []
    return getAllowedNestedBlockTypes(parent)
  }

  private _filterNestedInsertBlocks(
    parentIndex: number,
    blocks: ITemplateBlock[]
  ): ITemplateBlock[] {
    const parent = this.blocks[parentIndex]
    if (parent?.type !== 'section' && parent?.type !== 'group') return []
    return filterNestableBlocks(parent, blocks)
  }

  createDefaultBlock(type: ITemplateBlock['type']): ITemplateBlock {
    switch (type) {
      case 'fieldRow':
        return {
          type: 'fieldRow',
          fields: [this._createDefaultField()]
        }
      case 'paragraph':
        return {
          type: 'paragraph',
          segments: [{ type: 'text', value: '请输入文本' }]
        }
      case 'section':
        return {
          type: 'section',
          title: '新分节',
          blocks: []
        }
      case 'group':
        return {
          type: 'group',
          direction: 'column',
          blocks: []
        }
      case 'separator':
        return { type: 'separator' }
      case 'table':
        return {
          type: 'table',
          columns: [
            { header: '列1', field: { id: genId(), type: 'text', placeholder: '请输入' } },
            { header: '列2', field: { id: genId(), type: 'text', placeholder: '请输入' } }
          ],
          rows: 3
        }
      case 'staticText':
        return { type: 'staticText', text: '请输入静态文字内容' }
    }
  }

  private _createDefaultField(): ITemplateField {
    return {
      id: genId(),
      type: 'text',
      label: '新字段',
      placeholder: '请输入'
    }
  }

  private _selectBlock(blockIndex: number, parentIndex?: number) {
    this.selection = {
      kind: 'block',
      blockIndex,
      ...(parentIndex != null ? { parentIndex } : {})
    }
    this._render()
    this.options.onSelect(this.selection)
  }

  private _selectField(blockIndex: number, fieldId: string, parentIndex?: number) {
    this.selection = {
      kind: 'field',
      blockIndex,
      fieldId,
      ...(parentIndex != null ? { parentIndex } : {})
    }
    this._render()
    this.options.onSelect(this.selection)
  }

  private _render() {
    const scrollTop = this.container.scrollTop
    this.container.innerHTML = ''

    if (this.blocks.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'td-canvas__empty td-canvas__drop-target'
      empty.textContent = '从左侧拖入块类型，或点击添加'
      empty.addEventListener('dragover', event => {
        if (!hasPaletteDragPayload(event.dataTransfer)) return
        event.preventDefault()
        empty.classList.add('td-canvas__drop-target--active')
      })
      empty.addEventListener('dragleave', () => {
        empty.classList.remove('td-canvas__drop-target--active')
      })
      empty.addEventListener('drop', event => {
        const payload = parsePaletteDragPayload(event.dataTransfer)
        empty.classList.remove('td-canvas__drop-target--active')
        if (!payload) return
        event.preventDefault()
        const blocks = this._createBlocksFromPayload(payload)
        if (!blocks.length) return
        this.options.onInsertAt?.(0, blocks)
      })
      this.container.append(empty)
      this.container.scrollTop = scrollTop
      return
    }

    this.blocks.forEach((block, index) => {
      this.container.append(this._createDropSlot(index))
      const card = this._renderBlockCard(block, index)
      this.container.append(card)
    })
    this.container.append(this._createDropSlot(this.blocks.length, true))

    this.container.scrollTop = scrollTop
  }

  private _getSelectedBlock(selection: Exclude<SelectionTarget, null>) {
    if (selection.parentIndex != null) {
      const parent = this.blocks[selection.parentIndex]
      if (parent?.type === 'section' || parent?.type === 'group') {
        return parent.blocks[selection.blockIndex]
      }
      return undefined
    }
    return this.blocks[selection.blockIndex]
  }

  private _revealSelection() {
    const selection = this.selection
    if (!selection) return
    requestAnimationFrame(() => {
      const selector = selection.parentIndex != null
        ? `.td-canvas__nested-block[data-parent-index="${selection.parentIndex}"][data-child-index="${selection.blockIndex}"]`
        : `.td-canvas__block[data-block-index="${selection.blockIndex}"]`
      const target = this.container.querySelector(selector) as HTMLElement | null
      target?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
    })
  }

  private _createBlocksFromPayload(payload: PaletteDragPayload): ITemplateBlock[] {
    if (payload.kind === 'type') {
      return [this.createDefaultBlock(payload.type)]
    }
    return payload.blocks.map(block => deepCloneBlock(block))
  }

  private _clearDragOver(container: ParentNode = this.container) {
    container.querySelectorAll('.td-canvas__drop-slot--active').forEach(element =>
      element.classList.remove('td-canvas__drop-slot--active')
    )
    container.querySelectorAll('.td-canvas__drop-target--active').forEach(element =>
      element.classList.remove('td-canvas__drop-target--active')
    )
    container.querySelectorAll('.td-canvas__block--drop-before').forEach(element =>
      element.classList.remove('td-canvas__block--drop-before')
    )
    container.querySelectorAll('.td-canvas__block--drop-after').forEach(element =>
      element.classList.remove('td-canvas__block--drop-after')
    )
    container.querySelectorAll('.td-canvas__field-chip--drop-before').forEach(element =>
      element.classList.remove('td-canvas__field-chip--drop-before')
    )
    container.querySelectorAll('.td-canvas__field-chip--drop-after').forEach(element =>
      element.classList.remove('td-canvas__field-chip--drop-after')
    )
    container.querySelectorAll('.td-canvas__drop-target--invalid').forEach(element => {
      element.classList.remove('td-canvas__drop-target--invalid')
      delete (element as HTMLElement).dataset.invalidMessage
    })
    container.querySelectorAll('.td-canvas__drop-slot--invalid').forEach(element => {
      element.classList.remove('td-canvas__drop-slot--invalid')
      delete (element as HTMLElement).dataset.invalidMessage
    })
    container.querySelectorAll('.td-canvas__nested-block--invalid').forEach(element => {
      element.classList.remove('td-canvas__nested-block--invalid')
      delete (element as HTMLElement).dataset.invalidMessage
    })
  }

  private _getPaletteDragTypes(): ITemplateBlock['type'][] {
    const payload = getActivePaletteDragPayload()
    if (!payload) return []
    return payload.kind === 'type'
      ? [payload.type]
      : payload.blocks.map(block => block.type)
  }

  private _getInvalidNestedDropMessage(parentIndex: number): string | null {
    const parent = this.blocks[parentIndex]
    if (parent?.type !== 'section' && parent?.type !== 'group') return null
    const invalidTypes = [...new Set(this._getPaletteDragTypes().filter(type => !canNestBlock(parent, type)))]
    if (!invalidTypes.length) return null
    const parentLabel = parent.type === 'group' ? '组合' : '分节'
    return `${parentLabel}内不支持嵌套 ${invalidTypes.map(type => BLOCK_LABEL[type]).join('、')}`
  }

  private _markInvalidNestedTarget(
    target: HTMLElement,
    className: string,
    message: string
  ) {
    target.classList.add(className)
    target.dataset.invalidMessage = message
    this._notifyInvalidDragHint(message)
  }

  private _notifyInvalidDragHint(message: string) {
    const now = Date.now()
    if (
      this.lastInvalidDragHint?.message === message &&
      now - this.lastInvalidDragHint.at < 1200
    ) {
      return
    }
    this.lastInvalidDragHint = { message, at: now }
    TemplateFeedback.toast(message, 'warning')
  }

  private _getDropPlacement(target: HTMLElement, clientValue: number, axis: 'x' | 'y') {
    const rect = target.getBoundingClientRect()
    return axis === 'x'
      ? clientValue >= rect.left + rect.width / 2 ? 'after' : 'before'
      : clientValue >= rect.top + rect.height / 2 ? 'after' : 'before'
  }

  private _createDropSlot(index: number, isEnd = false): HTMLDivElement {
    const slot = document.createElement('div')
    slot.className = `td-canvas__drop-slot${isEnd ? ' td-canvas__drop-slot--end' : ''}`
    slot.title = isEnd ? '拖到这里追加到末尾' : `拖到这里插入到第 ${index + 1} 位前`

    slot.addEventListener('dragover', event => {
      const hasPalettePayload = hasPaletteDragPayload(event.dataTransfer)
      if (this.dragFromIndex === null && !hasPalettePayload) return
      event.preventDefault()
      this._clearDragOver()
      slot.classList.add('td-canvas__drop-slot--active')
    })

    slot.addEventListener('dragleave', () => {
      slot.classList.remove('td-canvas__drop-slot--active')
    })

    slot.addEventListener('drop', event => {
      const payload = parsePaletteDragPayload(event.dataTransfer)
      const sourceIndex = this.dragFromIndex
      this._clearDragOver()
      if (sourceIndex == null && !payload) return
      event.preventDefault()

      if (sourceIndex != null) {
        const blocks = [...this.blocks]
        const [moved] = blocks.splice(sourceIndex, 1)
        const targetIndex = index > sourceIndex ? index - 1 : index
        blocks.splice(targetIndex, 0, moved)
        this.options.onReorder?.(blocks)
        return
      }

      if (!payload) return
      const blocks = this._createBlocksFromPayload(payload)
      if (!blocks.length) return
      this.options.onInsertAt?.(index, blocks)
    })

    return slot
  }

  private _renderBlockCard(block: ITemplateBlock, index: number): HTMLDivElement {
    const isSelected =
      this.selection?.kind === 'block' && this.selection.blockIndex === index

    const card = document.createElement('div')
    card.className = `td-canvas__block${isSelected ? ' td-canvas__block--selected' : ''}`
    card.draggable = true
    card.dataset.blockIndex = String(index)

    card.addEventListener('click', e => {
      e.stopPropagation()
      this._selectBlock(index)
    })

    card.addEventListener('dragover', event => {
      const hasPalettePayload = hasPaletteDragPayload(event.dataTransfer)
      if (this.dragFromIndex === null && !hasPalettePayload) return
      event.preventDefault()
      this._clearDragOver()
      const placement = this._getDropPlacement(card, event.clientY, 'y')
      card.classList.add(
        placement === 'after'
          ? 'td-canvas__block--drop-after'
          : 'td-canvas__block--drop-before'
      )
    })

    card.addEventListener('dragleave', event => {
      if (!card.contains(event.relatedTarget as Node)) {
        card.classList.remove('td-canvas__block--drop-before')
        card.classList.remove('td-canvas__block--drop-after')
      }
    })

    card.addEventListener('drop', event => {
      const payload = parsePaletteDragPayload(event.dataTransfer)
      const sourceIndex = this.dragFromIndex
      if (sourceIndex == null && !payload) return
      event.preventDefault()
      event.stopPropagation()

      const placement = this._getDropPlacement(card, event.clientY, 'y')
      this._clearDragOver()
      let targetIndex = index + (placement === 'after' ? 1 : 0)

      if (sourceIndex != null) {
        const blocks = [...this.blocks]
        const [moved] = blocks.splice(sourceIndex, 1)
        if (targetIndex > sourceIndex) targetIndex -= 1
        blocks.splice(targetIndex, 0, moved)
        this.options.onReorder?.(blocks)
        return
      }

      if (!payload) return
      const blocks = this._createBlocksFromPayload(payload)
      if (!blocks.length) return
      this.options.onInsertAt?.(targetIndex, blocks)
    })

    // Drag events
    card.addEventListener('dragstart', e => {
      this.dragFromIndex = index
      card.classList.add('td-canvas__block--dragging')
      e.dataTransfer!.effectAllowed = 'move'
    })
    card.addEventListener('dragend', () => {
      this.dragFromIndex = null
      card.classList.remove('td-canvas__block--dragging')
      this._clearDragOver()
    })

    const header = document.createElement('div')
    header.className = 'td-canvas__block-header'

    const typeTag = document.createElement('span')
    typeTag.className = 'td-canvas__block-type'
    typeTag.textContent = BLOCK_LABEL[block.type]
    header.append(typeTag)

    if (block.type === 'section') {
      const sectionTitle = document.createElement('span')
      sectionTitle.className = 'td-canvas__block-title'
      sectionTitle.textContent = (block as ITemplateSectionBlock).title
      header.append(sectionTitle)

      const secAlign = (block as ITemplateSectionBlock).align
      if (secAlign && secAlign !== 'left') {
        const alignTag = document.createElement('span')
        alignTag.className = 'td-canvas__layout-tag'
        alignTag.textContent = secAlign === 'center' ? '居中' : '右对齐'
        header.append(alignTag)
      }
    }

    if (block.type === 'group') {
      const directionTag = document.createElement('span')
      directionTag.className = `td-canvas__group-direction td-canvas__group-direction--${block.direction || 'column'}`
      directionTag.textContent = block.direction === 'row' ? '横向编排' : '纵向堆叠'
      header.append(directionTag)
    }

    // Rule indicator badge on block header (field-level)
    const allFields = getFieldsFromBlock(block)
    const fieldsWithRules = allFields.filter(fieldHasRules)
    if (fieldsWithRules.length > 0) {
      const badge = document.createElement('span')
      badge.className = 'td-canvas__rule-badge'
      badge.title = `${fieldsWithRules.length} 个字段有条件规则`
      badge.textContent = `⚑ ${fieldsWithRules.length}`
      header.append(badge)
    }

    // Block-level rules badge (section / group)
    if (block.type === 'section' || block.type === 'group') {
      const blkRules = (block as BlockWithRules).rules
      if (blkRules?.length) {
        const blkBadge = document.createElement('span')
        blkBadge.className = 'td-canvas__rule-badge td-canvas__rule-badge--block'
        blkBadge.title = `${blkRules.length} 条块级条件规则`
        blkBadge.textContent = `⚑ 块`
        header.append(blkBadge)
      }
    }

    const actions = document.createElement('div')
    actions.className = 'td-canvas__block-actions'

    if (block.type === 'section' || block.type === 'group') {
      const isExpanded = this.expandedBlocks.has(index)
      const toggleBtn = this._actionButton(isExpanded ? '▼' : '▶', isExpanded ? '收起' : '展开子块', e => {
        e.stopPropagation()
        if (this.expandedBlocks.has(index)) {
          this.expandedBlocks.delete(index)
        } else {
          this.expandedBlocks.add(index)
        }
        this._render()
      })
      toggleBtn.className += ' td-canvas__action--toggle'
      actions.append(toggleBtn)
    }

    const copyBtn = this._actionButton('⊕', '复制', e => {
      e.stopPropagation()
      const cloned = deepCloneBlock(block)
      this.options.onCopy?.(index, cloned)
    })

    const upBtn = this._actionButton('↑', '上移', e => {
      e.stopPropagation()
      this.options.onMoveUp(index)
    })
    const downBtn = this._actionButton('↓', '下移', e => {
      e.stopPropagation()
      this.options.onMoveDown(index)
    })
    const delBtn = this._actionButton('×', '删除', e => {
      e.stopPropagation()
      this.options.onDelete(index)
    })
    delBtn.className += ' td-canvas__action--danger'
    actions.append(copyBtn, upBtn, downBtn, delBtn)
    header.append(actions)
    card.append(header)

    const body = this._renderBlockBody(block, index)
    if (body) card.append(body)

    return card
  }

  private _renderBlockBody(
    block: ITemplateBlock,
    blockIndex: number,
    parentIndex?: number
  ): HTMLDivElement | null {
    if (block.type === 'fieldRow') {
      const fr = block as ITemplateFieldRowBlock
      const body = this._renderFieldChips(fr.fields, blockIndex, {
        editable: true,
        parentIndex
      })
      if (fr.align || fr.equalWidth) {
        const bar = document.createElement('div')
        bar.className = 'td-canvas__layout-bar'
        if (fr.align && fr.align !== 'left') {
          const t = document.createElement('span')
          t.className = 'td-canvas__layout-tag'
          const labels: Record<string, string> = { center: '居中', right: '右对齐', justify: '两端对齐' }
          t.textContent = labels[fr.align] ?? fr.align
          bar.append(t)
        }
        if (fr.equalWidth) {
          const t = document.createElement('span')
          t.className = 'td-canvas__layout-tag td-canvas__layout-tag--grid'
          t.textContent = `等宽 (~${Math.floor(460 / fr.fields.length)}px)`
          bar.append(t)
        }
        body.append(bar)
      }
      return body
    }
    if (block.type === 'paragraph') {
      const para = block as ITemplateParagraphBlock
      const fieldSegs = para.segments.filter(s => s.type === 'field')
      if (fieldSegs.length === 0 && !para.align) return null
      const fields = fieldSegs.map(s => (s as { type: 'field'; field: ITemplateField }).field)
      const body = fields.length > 0
        ? this._renderFieldChips(fields, blockIndex, { parentIndex })
        : document.createElement('div') as HTMLDivElement
      if (para.align && para.align !== 'left') {
        const bar = document.createElement('div')
        bar.className = 'td-canvas__layout-bar'
        const t = document.createElement('span')
        t.className = 'td-canvas__layout-tag'
        const labels: Record<string, string> = { center: '居中', right: '右对齐', justify: '两端对齐' }
        t.textContent = labels[para.align] ?? para.align
        bar.append(t)
        body.append(bar)
      }
      return body
    }
    if (block.type === 'table') {
      return this._renderTablePreview(block as ITemplateTableBlock, blockIndex, parentIndex)
    }
    if (block.type === 'staticText') {
      return this._renderStaticTextPreview(block as ITemplateStaticTextBlock)
    }
    if (block.type === 'section' || block.type === 'group') {
      const isExpanded = this.expandedBlocks.has(blockIndex)
      const nestedBlock = block as ITemplateSectionBlock | ITemplateGroupBlock
      if (isExpanded) {
        return this._renderNestedBlocks(
          nestedBlock.blocks,
          blockIndex,
          block.type === 'group'
            ? (block as ITemplateGroupBlock).direction || 'column'
            : null
        )
      }
      const body = document.createElement('div')
      body.className = 'td-canvas__block-body td-canvas__block-nested'
      const info = document.createElement('span')
      info.className = 'td-canvas__nested-info'
      const count = nestedBlock.blocks.length
      if (block.type === 'group') {
        const dir = (block as ITemplateGroupBlock).direction || 'column'
        const dirIcon = dir === 'row' ? '⊟' : '≡'
        info.textContent = `${dirIcon} ${count} 个子块 (${dir})`
        body.classList.add(`td-canvas__block-nested--${dir}`)
      } else {
        info.textContent = `${count} 个子块`
      }
      body.append(info)
      return body
    }
    return null
  }

  private _renderStaticTextPreview(block: ITemplateStaticTextBlock): HTMLDivElement {
    const body = document.createElement('div')
    body.className = 'td-canvas__static-text-preview'
    const text = block.text || ''
    const preview = text.length > 80 ? text.slice(0, 80) + '…' : text
    body.textContent = preview || '（空文本）'
    if (block.style?.bold) body.style.fontWeight = 'bold'
    if (block.style?.italic) body.style.fontStyle = 'italic'
    if (block.align === 'center') body.style.textAlign = 'center'
    else if (block.align === 'right') body.style.textAlign = 'right'
    return body
  }

  private _renderTablePreview(
    block: ITemplateTableBlock,
    blockIndex: number,
    parentIndex?: number
  ): HTMLDivElement {
    const wrap = document.createElement('div')
    wrap.className = 'td-canvas__table-preview'
    wrap.addEventListener('click', e => e.stopPropagation())

    const table = document.createElement('table')
    table.className = 'td-canvas__table-mini'

    const thead = document.createElement('thead')
    const headRow = document.createElement('tr')
    for (const col of block.columns) {
      const th = document.createElement('th')
      th.textContent = col.header
      if (col.width) th.style.width = `${col.width}px`
      headRow.append(th)
    }
    thead.append(headRow)
    table.append(thead)

    const tbody = document.createElement('tbody')
    const dataRows = block.rows ?? 1
    for (let r = 0; r < Math.min(dataRows, 2); r++) {
      const tr = document.createElement('tr')
      for (const col of block.columns) {
        const td = document.createElement('td')
        if (col.field) {
          const chip = document.createElement('span')
          chip.className = 'td-canvas__table-field-chip'
          chip.textContent = col.field.label || col.field.id
          chip.addEventListener('click', event => {
            event.stopPropagation()
            this._selectField(blockIndex, col.field!.id, parentIndex)
          })
          td.append(chip)
        }
        tr.append(td)
      }
      tbody.append(tr)
    }
    if (dataRows > 2) {
      const tr = document.createElement('tr')
      const td = document.createElement('td')
      td.colSpan = block.columns.length
      td.className = 'td-canvas__table-more'
      td.textContent = `... 共 ${dataRows} 行`
      tr.append(td)
      tbody.append(tr)
    }
    table.append(tbody)
    wrap.append(table)
    return wrap
  }

  private _renderNestedBlocks(
    children: ITemplateBlock[],
    parentIndex: number,
    groupDirection: 'row' | 'column' | null
  ): HTMLDivElement {
    const body = document.createElement('div')
    const isRow = groupDirection === 'row'
    body.className = `td-canvas__nested-body${isRow ? ' td-canvas__nested-body--row' : ''}${groupDirection ? ` td-canvas__nested-body--${groupDirection}` : ''}`
    body.addEventListener('click', e => e.stopPropagation())

    if (groupDirection) {
      const guide = document.createElement('div')
      guide.className = `td-canvas__group-preview td-canvas__group-preview--${groupDirection}`
      guide.textContent = groupDirection === 'row'
        ? '横向组合：子块会在同一行内排列'
        : '纵向组合：子块会按上下顺序堆叠'
      body.append(guide)
    }

    if (children.length === 0) {
      const empty = document.createElement('div')
      empty.className = 'td-canvas__nested-empty td-canvas__drop-target'
      empty.textContent = '暂无子块'
      empty.addEventListener('dragover', event => {
        if (!hasPaletteDragPayload(event.dataTransfer)) return
        const invalidMessage = this._getInvalidNestedDropMessage(parentIndex)
        if (invalidMessage) {
          clearNestedDragOver()
          this._markInvalidNestedTarget(
            empty,
            'td-canvas__drop-target--invalid',
            invalidMessage
          )
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
          event.stopPropagation()
          return
        }
        event.preventDefault()
        event.stopPropagation()
        empty.classList.add('td-canvas__drop-target--active')
      })
      empty.addEventListener('dragleave', () => {
        empty.classList.remove('td-canvas__drop-target--active')
      })
      empty.addEventListener('drop', event => {
        const payload = parsePaletteDragPayload(event.dataTransfer)
        empty.classList.remove('td-canvas__drop-target--active')
        if (!payload) return
        event.preventDefault()
        event.stopPropagation()
        const blocks = this._filterNestedInsertBlocks(
          parentIndex,
          this._createBlocksFromPayload(payload)
        )
        if (!blocks.length) return
        this.options.onNestedInsertAt?.(parentIndex, 0, blocks)
      })
      body.append(empty)
    }

    let nestedDragFrom: number | null = null

    const clearNestedDragOver = () => this._clearDragOver(body)

    const createNestedDropSlot = (
      childIndex: number,
      isEnd = false
    ): HTMLDivElement => {
      const slot = document.createElement('div')
      slot.className = `td-canvas__drop-slot td-canvas__drop-slot--nested${isEnd ? ' td-canvas__drop-slot--end' : ''}`
      slot.title = isEnd ? '拖到这里追加到容器末尾' : `拖到这里插入到第 ${childIndex + 1} 位前`

      slot.addEventListener('dragover', event => {
        const hasPalettePayload = hasPaletteDragPayload(event.dataTransfer)
        if (nestedDragFrom === null && !hasPalettePayload) return
        const invalidMessage = this._getInvalidNestedDropMessage(parentIndex)
        if (invalidMessage) {
          clearNestedDragOver()
          this._markInvalidNestedTarget(
            slot,
            'td-canvas__drop-slot--invalid',
            invalidMessage
          )
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
          event.stopPropagation()
          return
        }
        event.preventDefault()
        event.stopPropagation()
        clearNestedDragOver()
        slot.classList.add('td-canvas__drop-slot--active')
      })

      slot.addEventListener('dragleave', () => {
        slot.classList.remove('td-canvas__drop-slot--active')
      })

      slot.addEventListener('drop', event => {
        const payload = parsePaletteDragPayload(event.dataTransfer)
        const sourceIndex = nestedDragFrom
        clearNestedDragOver()
        if (sourceIndex == null && !payload) return
        event.preventDefault()
        event.stopPropagation()

        if (sourceIndex != null) {
          const newChildren = [...children]
          const [moved] = newChildren.splice(sourceIndex, 1)
          const targetIndex = childIndex > sourceIndex ? childIndex - 1 : childIndex
          newChildren.splice(targetIndex, 0, moved)
          this.options.onNestedReorder?.(parentIndex, newChildren)
          return
        }

        if (!payload) return
        const blocks = this._filterNestedInsertBlocks(
          parentIndex,
          this._createBlocksFromPayload(payload)
        )
        if (!blocks.length) return
        this.options.onNestedInsertAt?.(parentIndex, childIndex, blocks)
      })

      return slot
    }

    children.forEach((child, childIndex) => {
      body.append(createNestedDropSlot(childIndex))

      const isChildSelected =
        this.selection?.kind === 'block' &&
        this.selection.blockIndex === childIndex &&
        this.selection.parentIndex === parentIndex

      const childCard = document.createElement('div')
      childCard.className = `td-canvas__nested-block${isChildSelected ? ' td-canvas__block--selected' : ''}${isRow ? ' td-canvas__nested-block--row' : ''}`
      childCard.draggable = true
      childCard.dataset.parentIndex = String(parentIndex)
      childCard.dataset.childIndex = String(childIndex)

      childCard.addEventListener('click', event => {
        event.stopPropagation()
        this._selectBlock(childIndex, parentIndex)
      })

      childCard.addEventListener('dragover', event => {
        const hasPalettePayload = hasPaletteDragPayload(event.dataTransfer)
        if (nestedDragFrom === null && !hasPalettePayload) return
        const invalidMessage = this._getInvalidNestedDropMessage(parentIndex)
        if (invalidMessage) {
          clearNestedDragOver()
          this._markInvalidNestedTarget(
            childCard,
            'td-canvas__nested-block--invalid',
            invalidMessage
          )
          if (event.dataTransfer) event.dataTransfer.dropEffect = 'none'
          event.stopPropagation()
          return
        }
        event.preventDefault()
        event.stopPropagation()
        clearNestedDragOver()
        const placement = this._getDropPlacement(childCard, event.clientY, 'y')
        childCard.classList.add(
          placement === 'after'
            ? 'td-canvas__block--drop-after'
            : 'td-canvas__block--drop-before'
        )
      })

      childCard.addEventListener('dragleave', event => {
        if (!childCard.contains(event.relatedTarget as Node)) {
          childCard.classList.remove('td-canvas__block--drop-before')
          childCard.classList.remove('td-canvas__block--drop-after')
        }
      })

      childCard.addEventListener('drop', event => {
        const payload = parsePaletteDragPayload(event.dataTransfer)
        const sourceIndex = nestedDragFrom
        if (sourceIndex == null && !payload) return
        event.preventDefault()
        event.stopPropagation()

        const placement = this._getDropPlacement(childCard, event.clientY, 'y')
        clearNestedDragOver()
        let targetIndex = childIndex + (placement === 'after' ? 1 : 0)

        if (sourceIndex != null) {
          const newChildren = [...children]
          const [moved] = newChildren.splice(sourceIndex, 1)
          if (targetIndex > sourceIndex) targetIndex -= 1
          newChildren.splice(targetIndex, 0, moved)
          this.options.onNestedReorder?.(parentIndex, newChildren)
          return
        }

        if (!payload) return
        const blocks = this._filterNestedInsertBlocks(
          parentIndex,
          this._createBlocksFromPayload(payload)
        )
        if (!blocks.length) return
        this.options.onNestedInsertAt?.(parentIndex, targetIndex, blocks)
      })

      childCard.addEventListener('dragstart', e => {
        nestedDragFrom = childIndex
        childCard.classList.add('td-canvas__block--dragging')
        e.dataTransfer!.effectAllowed = 'move'
        e.stopPropagation()
      })
      childCard.addEventListener('dragend', () => {
        nestedDragFrom = null
        childCard.classList.remove('td-canvas__block--dragging')
        clearNestedDragOver()
      })

      const childHeader = document.createElement('div')
      childHeader.className = 'td-canvas__nested-block-header'

      const label = document.createElement('span')
      label.className = 'td-canvas__block-type'
      label.textContent = BLOCK_LABEL[child.type]

      const summary = document.createElement('span')
      summary.className = 'td-canvas__nested-summary'
      if (child.type === 'fieldRow') {
        summary.textContent = (child as ITemplateFieldRowBlock).fields
          .map(f => f.label || f.id)
          .join(', ')
      } else if (child.type === 'paragraph') {
        summary.textContent = (child as ITemplateParagraphBlock).segments
          .map(s => (s.type === 'text' ? s.value : `[${s.field.label || s.field.id}]`))
          .join('')
      } else if (child.type === 'section') {
        summary.textContent = (child as ITemplateSectionBlock).title
      } else if (child.type === 'table') {
        summary.textContent = `${(child as ITemplateTableBlock).columns.length} 列`
      } else if (child.type === 'staticText') {
        const t = (child as ITemplateStaticTextBlock).text || ''
        summary.textContent = t.length > 30 ? t.slice(0, 30) + '…' : t
      }

      const childActions = document.createElement('div')
      childActions.className = 'td-canvas__block-actions'

      const upBtn = this._actionButton('↑', '上移', e => {
        e.stopPropagation()
        this.options.onNestedMoveUp?.(parentIndex, childIndex)
      })
      const downBtn = this._actionButton('↓', '下移', e => {
        e.stopPropagation()
        this.options.onNestedMoveDown?.(parentIndex, childIndex)
      })
      const delBtn = this._actionButton('×', '删除', e => {
        e.stopPropagation()
        this.options.onNestedDelete?.(parentIndex, childIndex)
      })
      delBtn.className += ' td-canvas__action--danger'
      childActions.append(upBtn, downBtn, delBtn)

      childHeader.append(label, summary, childActions)
      childCard.append(childHeader)
      const childBody = this._renderBlockBody(child, childIndex, parentIndex)
      if (childBody) childCard.append(childBody)
      body.append(childCard)
    })

    if (children.length > 0) {
      body.append(createNestedDropSlot(children.length, true))
    }

    if (this.options.onNestedInsert) {
      const addRow = document.createElement('div')
      addRow.className = 'td-canvas__nested-add'

      const addSel = document.createElement('select')
      addSel.className = 'td-props__select td-props__select--sm'

      const emptyOpt = document.createElement('option')
      emptyOpt.value = ''
      emptyOpt.textContent = '+ 添加子块'
      addSel.append(emptyOpt)

      const childTypes = this._getAllowedNestedTypes(parentIndex)
      for (const type of childTypes) {
        const o = document.createElement('option')
        o.value = type
        o.textContent = BLOCK_LABEL[type]
        addSel.append(o)
      }
      addSel.addEventListener('change', () => {
        const type = addSel.value as ITemplateBlock['type']
        if (!type || !childTypes.includes(type)) return
        const newBlock = this.createDefaultBlock(type)
        this.options.onNestedInsert?.(parentIndex, newBlock)
        addSel.value = ''
      })
      addRow.append(addSel)
      body.append(addRow)
    }

    return body
  }

  private _renderFieldChips(
    fields: ITemplateField[],
    blockIndex: number,
    options?: { editable?: boolean; parentIndex?: number }
  ): HTMLDivElement {
    const body = document.createElement('div')
    body.className = 'td-canvas__block-body'
    let dragFieldIndex: number | null = null

    fields.forEach((field, fieldIndex) => {
      const isFieldSelected =
        this.selection?.kind === 'field' &&
        this.selection.blockIndex === blockIndex &&
        this.selection.parentIndex === options?.parentIndex &&
        this.selection.fieldId === field.id

      const chip = document.createElement('div')
      chip.className = `td-canvas__field-chip${isFieldSelected ? ' td-canvas__field-chip--selected' : ''}`
      chip.title = `ID: ${field.id}`
      chip.addEventListener('click', e => {
        e.stopPropagation()
        this._selectField(blockIndex, field.id, options?.parentIndex)
      })

      if (options?.editable) {
        chip.draggable = true
        chip.classList.add('td-canvas__field-chip--editable')
        chip.addEventListener('dragstart', event => {
          dragFieldIndex = fieldIndex
          chip.classList.add('td-canvas__field-chip--dragging')
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
        })
        chip.addEventListener('dragend', () => {
          dragFieldIndex = null
          chip.classList.remove('td-canvas__field-chip--dragging')
          this._clearDragOver(body)
        })
        chip.addEventListener('dragover', event => {
          if (dragFieldIndex === null) return
          event.preventDefault()
          this._clearDragOver(body)
          const placement = this._getDropPlacement(chip, event.clientX, 'x')
          chip.classList.add(
            placement === 'after'
              ? 'td-canvas__field-chip--drop-after'
              : 'td-canvas__field-chip--drop-before'
          )
        })
        chip.addEventListener('drop', event => {
          if (dragFieldIndex === null) return
          event.preventDefault()
          event.stopPropagation()
          const nextFields = [...fields]
          const [moving] = nextFields.splice(dragFieldIndex, 1)
          let targetIndex = fieldIndex + (
            this._getDropPlacement(chip, event.clientX, 'x') === 'after' ? 1 : 0
          )
          if (targetIndex > dragFieldIndex) targetIndex -= 1
          nextFields.splice(targetIndex, 0, moving)
          dragFieldIndex = null
          this._clearDragOver(body)
          this.options.onFieldRowReorder?.(blockIndex, nextFields)
        })
      }

      const label = document.createElement('span')
      label.className = 'td-canvas__field-label'
      label.textContent = field.label || field.id

      const typeTag = document.createElement('span')
      typeTag.className = 'td-canvas__field-type'
      typeTag.textContent = field.type

      chip.append(label, typeTag)

      // Signature icon
      if (field.type === 'signature') {
        const sigIcon = document.createElement('span')
        sigIcon.className = 'td-canvas__sig-icon'
        sigIcon.textContent = '✍'
        chip.append(sigIcon)
      }

      // Number range badge
      if (field.type === 'number' && (field.min != null || field.max != null)) {
        const rangeBadge = document.createElement('span')
        rangeBadge.className = 'td-canvas__range-badge'
        const minStr = field.min != null ? String(field.min) : '−∞'
        const maxStr = field.max != null ? String(field.max) : '+∞'
        rangeBadge.textContent = `[${minStr}~${maxStr}]`
        chip.append(rangeBadge)
      }

      // Rule indicator dots
      if (field.rules?.length) {
        const dotWrap = document.createElement('span')
        dotWrap.className = 'td-canvas__rule-dots'
        const ruleTypes = [...new Set(field.rules.map(r => r.type))]
        ruleTypes.slice(0, 3).forEach(rt => {
          const dot = document.createElement('span')
          dot.className = 'td-canvas__rule-dot'
          dot.style.backgroundColor = RULE_TYPE_COLOR[rt] || '#888'
          const ruleDescs = field.rules!
            .filter(r => r.type === rt)
            .map(r => {
              if (r.condition) {
                return `当 ${r.condition.field} ${r.condition.operator} ${r.condition.value} 时 ${rt}`
              }
              return rt
            })
          dot.title = ruleDescs.join('\n')
          dotWrap.append(dot)
        })
        chip.append(dotWrap)
      }

      if (options?.editable) {
        const deleteBtn = document.createElement('button')
        deleteBtn.type = 'button'
        deleteBtn.className = 'td-canvas__field-chip-action'
        deleteBtn.textContent = '×'
        deleteBtn.title = '删除字段'
        deleteBtn.addEventListener('click', event => {
          event.stopPropagation()
          this.options.onFieldRowDelete?.(blockIndex, field.id)
        })
        chip.append(deleteBtn)
      }

      body.append(chip)
    })

    return body
  }

  private _actionButton(
    text: string,
    title: string,
    handler: (e: MouseEvent) => void
  ): HTMLButtonElement {
    const btn = document.createElement('button')
    btn.className = 'td-canvas__action'
    btn.textContent = text
    btn.title = title
    btn.type = 'button'
    btn.addEventListener('click', handler)
    return btn
  }

  getElement(): HTMLDivElement {
    return this.container
  }
}
