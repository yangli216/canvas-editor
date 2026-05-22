import type {
  ITemplateBlock,
  ITemplateField,
  ITemplateFieldRowBlock,
  ITemplateParagraphBlock,
  ITemplateSectionBlock,
  ITemplateGroupBlock,
  ITemplateTableBlock,
  ITemplateTableColumn,
  ITemplateStaticTextBlock,
  ITemplateRule,
  ITemplateCondition,
  ITemplateOption,
  ITemplateSegment,
  ITemplateLayout
} from '../../editor/template/index'
import { PAGE_SIZE_PRESETS } from '../../editor/template/index'
import type { PageSizePreset } from '../../editor/template/index'
import type { SelectionTarget } from './SchemaCanvas'

export interface IPropertiesPanelOptions {
  onBlockChange: (blockIndex: number, updated: ITemplateBlock) => void
  onFieldChange: (blockIndex: number, fieldId: string, updated: ITemplateField) => void
  onAddField: (blockIndex: number) => void
  onLayoutChange?: (layout: ITemplateLayout) => void
}

const RULE_TYPE_COLORS: Record<string, string> = {
  visibility: '#4285f4',
  hidden: '#ff9800',
  readonly: '#9c27b0',
  required: '#e53935',
  cascade: '#2e7d32'
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  return e
}

function row(label: string, input: HTMLElement): HTMLDivElement {
  const wrap = el('div', 'td-props__row')
  const lbl = el('label', 'td-props__label')
  lbl.textContent = label
  wrap.append(lbl, input)
  return wrap
}

function textInput(value: string, onChange: (v: string) => void): HTMLInputElement {
  const inp = el('input', 'td-props__input')
  inp.type = 'text'
  inp.value = value
  inp.addEventListener('input', () => onChange(inp.value))
  return inp
}

function numberInput(value: number | undefined, onChange: (v: number | undefined) => void): HTMLInputElement {
  const inp = el('input', 'td-props__input')
  inp.type = 'number'
  inp.value = value != null ? String(value) : ''
  inp.addEventListener('input', () => {
    const n = parseFloat(inp.value)
    onChange(isNaN(n) ? undefined : n)
  })
  return inp
}

function checkboxInput(
  label: string,
  checked: boolean,
  onChange: (v: boolean) => void
): HTMLDivElement {
  const wrap = el('div', 'td-props__checkbox-row')
  const id = `td-cb-${Math.random().toString(36).slice(2)}`
  const inp = el('input', 'td-props__checkbox')
  inp.type = 'checkbox'
  inp.id = id
  inp.checked = checked
  inp.addEventListener('change', () => onChange(inp.checked))
  const lbl = el('label', 'td-props__checkbox-label')
  lbl.htmlFor = id
  lbl.textContent = label
  wrap.append(inp, lbl)
  return wrap
}

function selectInput(
  options: { label: string; value: string }[],
  value: string,
  onChange: (v: string) => void
): HTMLSelectElement {
  const sel = el('select', 'td-props__select')
  for (const opt of options) {
    const o = el('option')
    o.value = opt.value
    o.textContent = opt.label
    if (opt.value === value) o.selected = true
    sel.append(o)
  }
  sel.addEventListener('change', () => onChange(sel.value))
  return sel
}

const ALIGN_ICONS: Record<string, string> = {
  left: `<svg width="15" height="13" viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="1.5" x2="15" y2="1.5" stroke="currentColor" stroke-width="1.5"/><line x1="0" y1="6.5" x2="10" y2="6.5" stroke="currentColor" stroke-width="1.5"/><line x1="0" y1="11.5" x2="15" y2="11.5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  center: `<svg width="15" height="13" viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="1.5" x2="15" y2="1.5" stroke="currentColor" stroke-width="1.5"/><line x1="2.5" y1="6.5" x2="12.5" y2="6.5" stroke="currentColor" stroke-width="1.5"/><line x1="0" y1="11.5" x2="15" y2="11.5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  right: `<svg width="15" height="13" viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="1.5" x2="15" y2="1.5" stroke="currentColor" stroke-width="1.5"/><line x1="5" y1="6.5" x2="15" y2="6.5" stroke="currentColor" stroke-width="1.5"/><line x1="0" y1="11.5" x2="15" y2="11.5" stroke="currentColor" stroke-width="1.5"/></svg>`,
  justify: `<svg width="15" height="13" viewBox="0 0 15 13" fill="none" xmlns="http://www.w3.org/2000/svg"><line x1="0" y1="1.5" x2="15" y2="1.5" stroke="currentColor" stroke-width="1.5"/><line x1="0" y1="6.5" x2="15" y2="6.5" stroke="currentColor" stroke-width="1.5"/><line x1="0" y1="11.5" x2="15" y2="11.5" stroke="currentColor" stroke-width="1.5"/></svg>`
}

const ALIGN_TITLES: Record<string, string> = {
  left: '左对齐', center: '居中', right: '右对齐', justify: '两端对齐'
}

function alignButtons(
  current: string | undefined,
  onChange: (v: string) => void,
  includeJustify = false
): HTMLDivElement {
  const btnGroup = el('div', 'td-props__btn-group')
  const values = ['left', 'center', 'right', ...(includeJustify ? ['justify'] : [])]
  for (const value of values) {
    const active = (current ?? 'left') === value
    const btn = el('button', `td-props__dir-btn td-props__align-btn${active ? ' td-props__dir-btn--active' : ''}`)
    btn.type = 'button'
    btn.title = ALIGN_TITLES[value]
    btn.innerHTML = ALIGN_ICONS[value]
    btn.addEventListener('click', () => onChange(value))
    btnGroup.append(btn)
  }
  return btnGroup
}

export class PropertiesPanel {
  private container: HTMLDivElement
  private options: IPropertiesPanelOptions
  private blocks: ITemplateBlock[] = []
  private selection: SelectionTarget = null
  private layout: ITemplateLayout = {}

  constructor(options: IPropertiesPanelOptions) {
    this.options = options
    this.container = el('div', 'td-props')
  }

  update(blocks: ITemplateBlock[], selection: SelectionTarget) {
    this.blocks = blocks
    this.selection = selection
    this._render()
  }

  setLayout(layout: ITemplateLayout | undefined) {
    this.layout = layout ?? {}
    if (!this.selection) this._render()
  }

  private _render() {
    this.container.innerHTML = ''

    if (!this.selection) {
      this._renderPageSettings()
      return
    }

    if (this.selection.kind === 'block') {
      this._renderBlockProps(this.selection.blockIndex)
    } else {
      this._renderFieldProps(this.selection.blockIndex, this.selection.fieldId)
    }
  }

  // ── Page / document settings ──────────────────────────────────────────────

  private _renderPageSettings() {
    const title = el('div', 'td-props__section-title')
    title.textContent = '页面设置'
    this.container.append(title)

    const layout = this.layout
    const onChg = (patch: Partial<ITemplateLayout>) => {
      const updated = { ...layout, ...patch }
      this.layout = updated
      this.options.onLayoutChange?.(updated)
    }

    // Paper size preset
    const sizeOpts = (Object.keys(PAGE_SIZE_PRESETS) as PageSizePreset[]).map(k => ({
      label: PAGE_SIZE_PRESETS[k].label,
      value: k
    }))
    this.container.append(
      row('纸张大小', selectInput(sizeOpts, layout.pageSize ?? 'A4', v => onChg({ pageSize: v as PageSizePreset })))
    )

    // Orientation toggle
    const oriWrap = el('div', 'td-props__row')
    const oriLbl = el('label', 'td-props__label')
    oriLbl.textContent = '纸张方向'
    const oriBtns = el('div', 'td-props__btn-group')
    const ori = layout.orientation ?? 'portrait'
    for (const opt of [{ value: 'portrait', label: '纵向' }, { value: 'landscape', label: '横向' }]) {
      const btn = el('button', `td-props__dir-btn${ori === opt.value ? ' td-props__dir-btn--active' : ''}`)
      btn.type = 'button'
      btn.textContent = opt.label
      btn.addEventListener('click', () => onChg({ orientation: opt.value as 'portrait' | 'landscape' }))
      oriBtns.append(btn)
    }
    oriWrap.append(oriLbl, oriBtns)
    this.container.append(oriWrap)

    // Margins
    const marginsTitle = el('div', 'td-props__subsection-title')
    marginsTitle.textContent = '页边距 (px)'
    this.container.append(marginsTitle)

    const marginGrid = el('div', 'td-props__margin-grid')
    const marginDefs: { label: string; index: 0 | 1 | 2 | 3 }[] = [
      { label: '上', index: 0 },
      { label: '右', index: 1 },
      { label: '下', index: 2 },
      { label: '左', index: 3 }
    ]
    const defaultMargins: [number, number, number, number] = [100, 120, 100, 120]
    for (const { label, index } of marginDefs) {
      const cell = el('div', 'td-props__margin-cell')
      const lbl = el('label', 'td-props__margin-label')
      lbl.textContent = label
      const inp = el('input', 'td-props__input td-props__margin-input')
      inp.type = 'number'
      inp.min = '0'
      inp.value = String((this.layout.margins ?? defaultMargins)[index])
      inp.addEventListener('input', () => {
        const val = parseInt(inp.value) || 0
        const current = (this.layout.margins ?? defaultMargins) as [number, number, number, number]
        const updated: [number, number, number, number] = [current[0], current[1], current[2], current[3]]
        updated[index] = val
        onChg({ margins: updated })
      })
      cell.append(lbl, inp)
      marginGrid.append(cell)
    }
    this.container.append(marginGrid)

    // Font defaults
    const fontTitle = el('div', 'td-props__subsection-title')
    fontTitle.textContent = '默认字体'
    this.container.append(fontTitle)

    const fontFamilyOpts = [
      { label: '(系统默认)', value: '' },
      { label: '宋体', value: 'SimSun' },
      { label: '黑体', value: 'SimHei' },
      { label: '楷体', value: 'KaiTi' },
      { label: '仿宋', value: 'FangSong' },
      { label: '微软雅黑', value: 'Microsoft YaHei' },
      { label: 'Arial', value: 'Arial' }
    ]
    this.container.append(
      row('字体', selectInput(fontFamilyOpts, layout.defaultFont ?? '', v =>
        onChg({ defaultFont: v || undefined })
      )),
      row('字号 (pt)', numberInput(layout.defaultFontSize, v =>
        onChg({ defaultFontSize: v })
      ))
    )

    const hint = el('div', 'td-props__empty')
    hint.textContent = '点击块或字段查看其属性'
    this.container.append(hint)
  }

  private _renderBlockProps(blockIndex: number) {
    const block = this.blocks[blockIndex]
    if (!block) return

    const title = el('div', 'td-props__section-title')
    title.textContent = '块属性'
    this.container.append(title)

    const onChange = (updated: ITemplateBlock) =>
      this.options.onBlockChange(blockIndex, updated)

    if (block.type === 'section') {
      const sec = block as ITemplateSectionBlock
      this.container.append(
        row('标题', textInput(sec.title, v => onChange({ ...sec, title: v }))),
        row(
          '级别',
          selectInput(
            [
              { label: '一级', value: 'first' },
              { label: '二级', value: 'second' },
              { label: '三级', value: 'third' },
              { label: '四级', value: 'fourth' },
              { label: '五级', value: 'fifth' },
              { label: '六级', value: 'sixth' }
            ],
            sec.level || 'first',
            v => onChange({ ...sec, level: v as ITemplateSectionBlock['level'] })
          )
        ),
        row(
          '标题对齐',
          alignButtons(sec.align, v => onChange({ ...sec, align: v as ITemplateSectionBlock['align'] }))
        )
      )
      const allFieldIds = this._getAllFieldIds()
      this.container.append(this._renderBlockRulesEditor(sec, blockIndex, onChange, allFieldIds))
    }

    if (block.type === 'group') {
      const grp = block as ITemplateGroupBlock
      const dir = grp.direction || 'column'

      const btnWrap = el('div', 'td-props__row')
      const lbl = el('label', 'td-props__label')
      lbl.textContent = '方向'
      const btnGroup = el('div', 'td-props__btn-group')

      const colBtn = el('button', `td-props__dir-btn${dir === 'column' ? ' td-props__dir-btn--active' : ''}`)
      colBtn.type = 'button'
      colBtn.textContent = '≡ 纵向'
      colBtn.addEventListener('click', () => onChange({ ...grp, direction: 'column' }))

      const rowBtn = el('button', `td-props__dir-btn${dir === 'row' ? ' td-props__dir-btn--active' : ''}`)
      rowBtn.type = 'button'
      rowBtn.textContent = '⊟ 横向'
      rowBtn.addEventListener('click', () => onChange({ ...grp, direction: 'row' }))

      btnGroup.append(colBtn, rowBtn)
      btnWrap.append(lbl, btnGroup)
      this.container.append(btnWrap)
      const allFieldIds = this._getAllFieldIds()
      this.container.append(this._renderBlockRulesEditor(grp, blockIndex, onChange, allFieldIds))
    }

    if (block.type === 'fieldRow') {
      const fr = block as ITemplateFieldRowBlock
      this.container.append(
        row('分隔符', textInput(fr.separator ?? '', v => onChange({ ...fr, separator: v || undefined }))),
        row(
          '行对齐',
          alignButtons(fr.align, v => onChange({ ...fr, align: v as ITemplateFieldRowBlock['align'] }), true)
        ),
        checkboxInput('等宽栅格（平均分配控件宽度）', fr.equalWidth ?? false, v =>
          onChange({ ...fr, equalWidth: v || undefined })
        )
      )
      const addBtn = el('button', 'td-props__btn')
      addBtn.textContent = '+ 添加字段'
      addBtn.addEventListener('click', () => this.options.onAddField(blockIndex))
      this.container.append(addBtn)
    }

    if (block.type === 'paragraph') {
      const para = block as ITemplateParagraphBlock
      this.container.append(
        row(
          '对齐方式',
          alignButtons(para.align, v => onChange({ ...para, align: v as ITemplateParagraphBlock['align'] }), true)
        )
      )
      this.container.append(this._renderParagraphSegmentsEditor(para, onChange))
    }

    if (block.type === 'staticText') {
      this.container.append(this._renderStaticTextEditor(block as ITemplateStaticTextBlock, onChange))
    }

    if (block.type === 'table') {
      const tb = block as ITemplateTableBlock
      this.container.append(
        checkboxInput('动态行（用户可追加行）', tb.dynamicRows ?? false, v =>
          onChange({ ...tb, dynamicRows: v })
        )
      )
      this.container.append(this._renderTableColumnsEditor(tb, onChange))
    }
  }

  // ── Paragraph segments editor ──────────────────────────────────────────────

  private _renderParagraphSegmentsEditor(
    block: ITemplateParagraphBlock,
    onChange: (updated: ITemplateBlock) => void
  ): HTMLDivElement {
    const section = el('div', 'td-props__subsection')
    const titleRow = el('div', 'td-props__subsection-header')
    const title = el('span', 'td-props__subsection-title')
    title.textContent = '段落内容'
    titleRow.append(title)
    section.append(titleRow)

    const segments: ITemplateSegment[] = [...block.segments]

    const renderList = () => {
      const existing = section.querySelector('.td-props__segments-list')
      if (existing) existing.remove()
      const list = el('div', 'td-props__segments-list')

      segments.forEach((seg, i) => {
        const segRow = el('div', 'td-props__segment-row')

        const badge = el('span', 'td-props__segment-badge')
        badge.textContent = seg.type === 'text' ? 'T' : '[F]'
        badge.title = seg.type === 'text' ? '文本段' : `字段: ${seg.field.id}`
        badge.style.background = seg.type === 'text' ? '#f0f2f5' : '#e8f0fe'
        badge.style.color = seg.type === 'text' ? '#666' : '#4285f4'
        segRow.append(badge)

        if (seg.type === 'text') {
          const inp = textInput(seg.value, v => {
            const newSegs = [...segments]
            newSegs[i] = { ...seg, value: v }
            onChange({ ...block, segments: newSegs })
          })
          inp.placeholder = '文本内容'
          segRow.append(inp)
        } else {
          const chip = el('span', 'td-props__segment-field-chip')
          chip.textContent = seg.field.label || seg.field.id
          chip.title = `ID: ${seg.field.id} | 类型: ${seg.field.type}`
          segRow.append(chip)
        }

        const del = el('button', 'td-props__option-del')
        del.textContent = '×'
        del.type = 'button'
        del.title = '删除此段'
        del.addEventListener('click', () => {
          segments.splice(i, 1)
          onChange({ ...block, segments: [...segments] })
          renderList()
        })
        segRow.append(del)
        list.append(segRow)
      })

      section.append(list)
    }
    renderList()

    // Add text segment button
    const addBtn = el('button', 'td-props__btn td-props__btn--sm')
    addBtn.type = 'button'
    addBtn.textContent = '+ 文本段'
    addBtn.addEventListener('click', () => {
      segments.push({ type: 'text', value: '' })
      onChange({ ...block, segments: [...segments] })
      renderList()
    })
    section.append(addBtn)

    return section
  }

  // ── Static text editor ────────────────────────────────────────────────────

  private _renderStaticTextEditor(
    block: ITemplateStaticTextBlock,
    onChange: (updated: ITemplateBlock) => void
  ): HTMLDivElement {
    const section = el('div', 'td-props__subsection')
    const titleEl = el('div', 'td-props__subsection-title')
    titleEl.textContent = '静态文本内容'
    section.append(titleEl)

    const ta = el('textarea', 'td-props__textarea')
    ta.value = block.text
    ta.rows = 5
    ta.placeholder = '在此输入固定显示的文字内容（如告知书条款、说明文字等）'
    ta.addEventListener('input', () => onChange({ ...block, text: ta.value }))
    section.append(ta)

    section.append(
      row(
        '对齐',
        selectInput(
          [
            { label: '左对齐', value: 'left' },
            { label: '居中', value: 'center' },
            { label: '右对齐', value: 'right' }
          ],
          block.align || 'left',
          v => onChange({ ...block, align: v as ITemplateStaticTextBlock['align'] })
        )
      ),
      row('字号', numberInput(block.style?.size, v =>
        onChange({ ...block, style: { ...block.style, size: v } })
      )),
      checkboxInput('加粗', block.style?.bold ?? false, v =>
        onChange({ ...block, style: { ...block.style, bold: v } })
      ),
      checkboxInput('斜体', block.style?.italic ?? false, v =>
        onChange({ ...block, style: { ...block.style, italic: v } })
      )
    )
    return section
  }

  // ── Table columns editor ───────────────────────────────────────────────────

  private _renderTableColumnsEditor(
    block: ITemplateTableBlock,
    onChange: (updated: ITemplateBlock) => void
  ): HTMLDivElement {
    const section = el('div', 'td-props__subsection')
    const titleRow = el('div', 'td-props__subsection-header')
    const title = el('span', 'td-props__subsection-title')
    title.textContent = '表格列'
    titleRow.append(title)
    section.append(titleRow)

    if (!block.dynamicRows) {
      section.append(row('数据行数', numberInput(block.rows ?? 1, v => {
        onChange({ ...block, rows: v ?? 1 })
      })))
    }

    const cols: ITemplateTableColumn[] = [...block.columns]

    const renderCols = () => {
      const existing = section.querySelector('.td-props__table-cols')
      if (existing) existing.remove()
      const list = el('div', 'td-props__table-cols')

      cols.forEach((col, i) => {
        const colRow = el('div', 'td-props__rule-row')

        const headerInp = textInput(col.header, v => {
          cols[i] = { ...cols[i], header: v }
          onChange({ ...block, columns: [...cols] })
        })
        headerInp.placeholder = '列标题'

        const hasField = el('input', 'td-props__checkbox') as HTMLInputElement
        hasField.type = 'checkbox'
        hasField.checked = !!col.field
        hasField.title = '启用字段控件'
        hasField.addEventListener('change', () => {
          if (hasField.checked) {
            cols[i] = {
              ...cols[i],
              field: {
                id: `field_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
                type: 'text',
                placeholder: '请输入'
              }
            }
          } else {
            cols[i] = { ...cols[i], field: undefined }
          }
          onChange({ ...block, columns: [...cols] })
          renderCols()
        })

        const del = el('button', 'td-props__option-del')
        del.textContent = '×'
        del.type = 'button'
        del.addEventListener('click', () => {
          cols.splice(i, 1)
          onChange({ ...block, columns: [...cols] })
          renderCols()
        })

        colRow.append(headerInp, hasField, del)
        list.append(colRow)
      })

      section.append(list)
    }

    renderCols()

    const addBtn = el('button', 'td-props__btn td-props__btn--sm')
    addBtn.textContent = '+ 添加列'
    addBtn.type = 'button'
    addBtn.addEventListener('click', () => {
      cols.push({ header: `列${cols.length + 1}` })
      onChange({ ...block, columns: [...cols] })
      renderCols()
    })
    section.append(addBtn)
    return section
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────

  private _getAllFieldIds(): string[] {
    const ids: string[] = []
    const walkBlocks = (blocks: ITemplateBlock[]) => {
      for (const block of blocks) {
        if (block.type === 'fieldRow') {
          ids.push(...(block as ITemplateFieldRowBlock).fields.map(f => f.id))
        } else if (block.type === 'paragraph') {
          for (const seg of (block as ITemplateParagraphBlock).segments) {
            if (seg.type === 'field') ids.push(seg.field.id)
          }
        } else if (block.type === 'section') {
          walkBlocks((block as ITemplateSectionBlock).blocks)
        } else if (block.type === 'group') {
          walkBlocks((block as ITemplateGroupBlock).blocks)
        } else if (block.type === 'table') {
          for (const col of (block as ITemplateTableBlock).columns) {
            if (col.field) ids.push(col.field.id)
          }
        }
      }
    }
    walkBlocks(this.blocks)
    return ids
  }

  private _fieldSelect(
    value: string,
    allFieldIds: string[],
    onChange: (v: string) => void
  ): HTMLSelectElement {
    const sel = el('select', 'td-props__select')
    const emptyOpt = el('option')
    emptyOpt.value = ''
    emptyOpt.textContent = '— 选择字段 —'
    sel.append(emptyOpt)
    for (const id of allFieldIds) {
      const o = el('option')
      o.value = id
      o.textContent = id
      if (id === value) o.selected = true
      sel.append(o)
    }
    if (value && !allFieldIds.includes(value)) {
      const o = el('option')
      o.value = value
      o.textContent = value
      o.selected = true
      sel.style.borderColor = '#e53935'
      sel.title = '引用字段不存在'
      sel.append(o)
    }
    sel.addEventListener('change', () => onChange(sel.value))
    return sel
  }

  // ── Field props ────────────────────────────────────────────────────────────

  private _renderFieldProps(blockIndex: number, fieldId: string) {
    const block = this.blocks[blockIndex]
    const field = this._findField(block, fieldId)
    if (!field) return

    const title = el('div', 'td-props__section-title')
    title.textContent = '字段属性'
    this.container.append(title)

    const onChange = (updated: ITemplateField) => {
      this.options.onFieldChange(blockIndex, fieldId, updated)
    }

    this.container.append(
      row('ID', textInput(field.id, v => onChange({ ...field, id: v }))),
      row(
        '类型',
        selectInput(
          [
            { label: '文本', value: 'text' },
            { label: '多行文本', value: 'textarea' },
            { label: '数值', value: 'number' },
            { label: '日期', value: 'date' },
            { label: '下拉选择', value: 'select' },
            { label: '单选', value: 'radio' },
            { label: '复选', value: 'checkbox' },
            { label: '手写签名', value: 'signature' }
          ],
          field.type,
          v => onChange({ ...field, type: v as ITemplateField['type'] })
        )
      ),
      row('标签', textInput(field.label ?? '', v => onChange({ ...field, label: v || undefined }))),
      row('占位符', textInput(field.placeholder ?? '', v => onChange({ ...field, placeholder: v || undefined }))),
      row('宽度', numberInput(field.width, v => onChange({ ...field, width: v }))),
      row('前缀', textInput(field.prefix ?? '', v => onChange({ ...field, prefix: v || undefined }))),
      row('后缀', textInput(field.postfix ?? '', v => onChange({ ...field, postfix: v || undefined }))),
      checkboxInput('必填', field.required ?? false, v => onChange({ ...field, required: v })),
      checkboxInput('只读', field.readonly ?? false, v => onChange({ ...field, readonly: v })),
      checkboxInput('隐藏', field.hidden ?? false, v => onChange({ ...field, hidden: v })),
      checkboxInput('下划线', field.underline ?? false, v => onChange({ ...field, underline: v }))
    )

    // Font / style settings
    const fontSection = el('div', 'td-props__subsection')
    const fontSectionTitle = el('div', 'td-props__subsection-title')
    fontSectionTitle.textContent = '字体样式'
    fontSection.append(fontSectionTitle)
    const fieldFontOpts = [
      { label: '(继承)', value: '' },
      { label: '宋体', value: 'SimSun' },
      { label: '黑体', value: 'SimHei' },
      { label: '楷体', value: 'KaiTi' },
      { label: '仿宋', value: 'FangSong' },
      { label: '微软雅黑', value: 'Microsoft YaHei' },
      { label: 'Arial', value: 'Arial' }
    ]
    fontSection.append(
      row('字体', selectInput(fieldFontOpts, field.style?.font ?? '', v =>
        onChange({ ...field, style: { ...field.style, font: v || undefined } })
      )),
      row('字号 (pt)', numberInput(field.style?.size, v =>
        onChange({ ...field, style: { ...field.style, size: v } })
      )),
      checkboxInput('加粗', field.style?.bold ?? false, v =>
        onChange({ ...field, style: { ...field.style, bold: v } })
      ),
      checkboxInput('斜体', field.style?.italic ?? false, v =>
        onChange({ ...field, style: { ...field.style, italic: v } })
      )
    )
    this.container.append(fontSection)

    // Number field enhancements
    if (field.type === 'number') {
      const numSection = el('div', 'td-props__subsection')
      const numTitle = el('div', 'td-props__subsection-title')
      numTitle.textContent = '数值属性'
      numSection.append(numTitle)
      numSection.append(
        row('最小值', numberInput(field.min, v => onChange({ ...field, min: v }))),
        row('最大值', numberInput(field.max, v => onChange({ ...field, max: v })))
      )
      const unitNote = el('div', 'td-props__hint')
      unitNote.textContent = '提示：单位请在"后缀"中填写（如 ℃、mmHg、ml）'
      numSection.append(unitNote)
      this.container.append(numSection)
    }

    if (['select', 'radio', 'checkbox'].includes(field.type)) {
      this.container.append(this._renderOptionsEditor(field, onChange))
    }

    const allFieldIds = this._getAllFieldIds()
    this.container.append(this._renderRulesEditor(field, onChange, allFieldIds))
  }

  // ── Block-level rules editor (section / group) ────────────────────────────

  private _renderBlockRulesEditor(
    block: ITemplateSectionBlock | ITemplateGroupBlock,
    _blockIndex: number,
    onChange: (updated: ITemplateBlock) => void,
    allFieldIds: string[]
  ): HTMLDivElement {
    const blockWithId: typeof block = block.id
      ? block
      : { ...block, id: `blk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` }

    const section = el('div', 'td-props__subsection')
    const titleRow = el('div', 'td-props__subsection-header')
    const title = el('span', 'td-props__subsection-title')
    title.textContent = '块级条件规则'
    titleRow.append(title)
    section.append(titleRow)

    const rules: ITemplateRule[] = [...(blockWithId.rules ?? [])]

    const renderRules = () => {
      const existing = section.querySelector('.td-props__rules-list')
      if (existing) existing.remove()
      const list = el('div', 'td-props__rules-list')

      rules.forEach((rule, i) => {
        const ruleCard = el('div', 'td-props__rule-card')
        const ruleHeader = el('div', 'td-props__rule-card-header')

        const typeSel = el('select', 'td-props__rule-type-sel')
        const blockRuleTypes = [
          { label: '显示条件', value: 'visibility' },
          { label: '隐藏条件', value: 'hidden' }
        ]
        for (const rt of blockRuleTypes) {
          const o = el('option')
          o.value = rt.value
          o.textContent = rt.label
          if (rt.value === rule.type) o.selected = true
          typeSel.append(o)
        }
        typeSel.style.borderColor = RULE_TYPE_COLORS[rule.type] || '#ccc'
        typeSel.style.color = RULE_TYPE_COLORS[rule.type] || '#333'
        typeSel.addEventListener('change', () => {
          rules[i] = { ...rules[i], type: typeSel.value as ITemplateRule['type'] }
          onChange({ ...blockWithId, rules: [...rules] })
          renderRules()
        })

        const del = el('button', 'td-props__option-del')
        del.textContent = '×'
        del.type = 'button'
        del.addEventListener('click', () => {
          rules.splice(i, 1)
          onChange({ ...blockWithId, rules: [...rules] })
          renderRules()
        })

        ruleHeader.append(typeSel, del)
        ruleCard.append(ruleHeader)
        ruleCard.append(this._renderBlockConditionEditor(rule, i, rules, blockWithId, onChange, allFieldIds))

        const desc = el('div', 'td-props__rule-desc')
        desc.textContent = this._describeRule(rule, allFieldIds)
        ruleCard.append(desc)
        list.append(ruleCard)
      })

      section.append(list)
    }

    renderRules()

    const addBtn = el('button', 'td-props__btn td-props__btn--sm')
    addBtn.textContent = '+ 添加规则'
    addBtn.type = 'button'
    addBtn.addEventListener('click', () => {
      rules.push({ type: 'visibility', condition: { field: '', operator: 'equals', value: '' } })
      onChange({ ...blockWithId, rules: [...rules] })
      renderRules()
    })
    section.append(addBtn)
    return section
  }

  private _renderBlockConditionEditor(
    rule: ITemplateRule,
    i: number,
    rules: ITemplateRule[],
    block: ITemplateSectionBlock | ITemplateGroupBlock,
    onChange: (updated: ITemplateBlock) => void,
    allFieldIds: string[]
  ): HTMLDivElement {
    const wrap = el('div', 'td-props__rule-condition')
    const fieldSel = this._fieldSelect(rule.condition?.field ?? '', allFieldIds, v => {
      rules[i] = { ...rules[i], condition: { ...rules[i].condition!, field: v } }
      onChange({ ...block, rules: [...rules] })
    })
    const opSel = selectInput(
      [
        { label: '等于', value: 'equals' },
        { label: '不等于', value: 'notEquals' },
        { label: '包含', value: 'includes' },
        { label: '不包含', value: 'notIncludes' }
      ],
      rule.condition?.operator ?? 'equals',
      v => {
        rules[i] = { ...rules[i], condition: { ...rules[i].condition!, operator: v as ITemplateCondition['operator'] } }
        onChange({ ...block, rules: [...rules] })
      }
    )
    const valueInp = textInput(
      Array.isArray(rule.condition?.value)
        ? (rule.condition!.value as string[]).join(',')
        : (rule.condition?.value as string) ?? '',
      v => {
        rules[i] = { ...rules[i], condition: { ...rules[i].condition!, value: v } }
        onChange({ ...block, rules: [...rules] })
      }
    )
    valueInp.placeholder = '值'
    wrap.append(row('字段', fieldSel), row('运算', opSel), row('值', valueInp))
    return wrap
  }

  // ── Options editor ─────────────────────────────────────────────────────────

  private _renderOptionsEditor(
    field: ITemplateField,
    onChange: (f: ITemplateField) => void
  ): HTMLDivElement {
    const section = el('div', 'td-props__subsection')
    const title = el('div', 'td-props__subsection-title')
    title.textContent = '选项'
    section.append(title)

    const list = el('div', 'td-props__options-list')
    const options: ITemplateOption[] = [...(field.options ?? [])]

    const renderList = () => {
      list.innerHTML = ''
      options.forEach((opt, i) => {
        const optRow = el('div', 'td-props__option-row')
        const inp = textInput(opt.label, v => {
          options[i] = { ...options[i], label: v }
          onChange({ ...field, options: [...options] })
        })
        const del = el('button', 'td-props__option-del')
        del.textContent = '×'
        del.type = 'button'
        del.addEventListener('click', () => {
          options.splice(i, 1)
          onChange({ ...field, options: [...options] })
          renderList()
        })
        optRow.append(inp, del)
        list.append(optRow)
      })
    }

    renderList()
    section.append(list)

    const addBtn = el('button', 'td-props__btn td-props__btn--sm')
    addBtn.textContent = '+ 添加选项'
    addBtn.type = 'button'
    addBtn.addEventListener('click', () => {
      options.push({ label: `选项${options.length + 1}` })
      onChange({ ...field, options: [...options] })
      renderList()
    })
    section.append(addBtn)
    return section
  }

  private _renderRulesEditor(
    field: ITemplateField,
    onChange: (f: ITemplateField) => void,
    allFieldIds: string[]
  ): HTMLDivElement {
    const section = el('div', 'td-props__subsection')
    const titleRow = el('div', 'td-props__subsection-header')
    const title = el('span', 'td-props__subsection-title')
    title.textContent = '条件规则'
    titleRow.append(title)
    section.append(titleRow)

    const rules: ITemplateRule[] = [...(field.rules ?? [])]

    const renderRules = () => {
      const existing = section.querySelector('.td-props__rules-list')
      if (existing) existing.remove()
      const list = el('div', 'td-props__rules-list')

      rules.forEach((rule, i) => {
        const ruleCard = el('div', 'td-props__rule-card')

        const ruleHeader = el('div', 'td-props__rule-card-header')

        const typeSel = el('select', 'td-props__rule-type-sel')
        const ruleTypes = [
          { label: '显示条件', value: 'visibility' },
          { label: '必填条件', value: 'required' },
          { label: '只读条件', value: 'readonly' },
          { label: '隐藏条件', value: 'hidden' },
          { label: '级联联动', value: 'cascade' }
        ]
        for (const rt of ruleTypes) {
          const o = el('option')
          o.value = rt.value
          o.textContent = rt.label
          if (rt.value === rule.type) o.selected = true
          typeSel.append(o)
        }
        typeSel.style.borderColor = RULE_TYPE_COLORS[rule.type] || '#ccc'
        typeSel.style.color = RULE_TYPE_COLORS[rule.type] || '#333'
        typeSel.addEventListener('change', () => {
          rules[i] = { ...rules[i], type: typeSel.value as ITemplateRule['type'] }
          onChange({ ...field, rules: [...rules] })
          renderRules()
        })

        const del = el('button', 'td-props__option-del')
        del.textContent = '×'
        del.type = 'button'
        del.addEventListener('click', () => {
          rules.splice(i, 1)
          onChange({ ...field, rules: [...rules] })
          renderRules()
        })

        ruleHeader.append(typeSel, del)
        ruleCard.append(ruleHeader)

        if (rule.type === 'cascade') {
          ruleCard.append(this._renderCascadeEditor(rule, i, rules, field, onChange, allFieldIds))
        } else {
          ruleCard.append(this._renderConditionEditor(rule, i, rules, field, onChange, allFieldIds))
        }

        const desc = el('div', 'td-props__rule-desc')
        desc.textContent = this._describeRule(rule, allFieldIds)
        ruleCard.append(desc)

        list.append(ruleCard)
      })

      section.append(list)
    }

    renderRules()

    const addBtn = el('button', 'td-props__btn td-props__btn--sm')
    addBtn.textContent = '+ 添加规则'
    addBtn.type = 'button'
    addBtn.addEventListener('click', () => {
      rules.push({
        type: 'visibility',
        condition: { field: '', operator: 'equals', value: '' }
      })
      onChange({ ...field, rules: [...rules] })
      renderRules()
    })
    section.append(addBtn)
    return section
  }

  private _renderConditionEditor(
    rule: ITemplateRule,
    i: number,
    rules: ITemplateRule[],
    field: ITemplateField,
    onChange: (f: ITemplateField) => void,
    allFieldIds: string[]
  ): HTMLDivElement {
    const wrap = el('div', 'td-props__rule-condition')

    const fieldSel = this._fieldSelect(rule.condition?.field ?? '', allFieldIds, v => {
      rules[i] = { ...rules[i], condition: { ...rules[i].condition!, field: v } }
      onChange({ ...field, rules: [...rules] })
    })

    const opSel = selectInput(
      [
        { label: '等于', value: 'equals' },
        { label: '不等于', value: 'notEquals' },
        { label: '包含', value: 'includes' },
        { label: '不包含', value: 'notIncludes' }
      ],
      rule.condition?.operator ?? 'equals',
      v => {
        rules[i] = {
          ...rules[i],
          condition: {
            ...rules[i].condition!,
            operator: v as ITemplateCondition['operator']
          }
        }
        onChange({ ...field, rules: [...rules] })
      }
    )

    const valueInp = textInput(
      Array.isArray(rule.condition?.value)
        ? (rule.condition!.value as string[]).join(',')
        : (rule.condition?.value as string) ?? '',
      v => {
        rules[i] = { ...rules[i], condition: { ...rules[i].condition!, value: v } }
        onChange({ ...field, rules: [...rules] })
      }
    )
    valueInp.placeholder = '值'

    wrap.append(
      row('字段', fieldSel),
      row('运算', opSel),
      row('值', valueInp)
    )
    return wrap
  }

  private _renderCascadeEditor(
    rule: ITemplateRule,
    i: number,
    rules: ITemplateRule[],
    field: ITemplateField,
    onChange: (f: ITemplateField) => void,
    allFieldIds: string[]
  ): HTMLDivElement {
    const wrap = el('div', 'td-props__rule-condition')
    const cascade = rule.cascade ?? { targetField: '' }

    const targetSel = this._fieldSelect(cascade.targetField, allFieldIds, v => {
      rules[i] = { ...rules[i], cascade: { ...cascade, targetField: v } }
      onChange({ ...field, rules: [...rules] })
    })
    wrap.append(row('目标字段', targetSel))

    const vmSection = el('div', 'td-props__cascade-section')
    const vmTitle = el('div', 'td-props__cascade-label')
    vmTitle.textContent = '自动填入 (触发值 → 填入值)'
    vmSection.append(vmTitle)

    const valueMap = { ...(cascade.valueMap ?? {}) }
    const vmList = el('div')

    const renderVmList = () => {
      vmList.innerHTML = ''
      Object.entries(valueMap).forEach(([trigger, fill]) => {
        const vmRow = el('div', 'td-props__option-row')
        const trigInp = textInput(trigger, newTrigger => {
          delete valueMap[trigger]
          if (newTrigger) valueMap[newTrigger] = fill
          rules[i] = { ...rules[i], cascade: { ...cascade, valueMap: { ...valueMap } } }
          onChange({ ...field, rules: [...rules] })
        })
        trigInp.placeholder = '触发值'
        const fillInp = textInput(fill, newFill => {
          valueMap[trigger] = newFill
          rules[i] = { ...rules[i], cascade: { ...cascade, valueMap: { ...valueMap } } }
          onChange({ ...field, rules: [...rules] })
        })
        fillInp.placeholder = '填入值'
        const del = el('button', 'td-props__option-del')
        del.textContent = '×'
        del.type = 'button'
        del.addEventListener('click', () => {
          delete valueMap[trigger]
          rules[i] = { ...rules[i], cascade: { ...cascade, valueMap: { ...valueMap } } }
          onChange({ ...field, rules: [...rules] })
          renderVmList()
        })
        vmRow.append(trigInp, fillInp, del)
        vmList.append(vmRow)
      })
    }
    renderVmList()
    vmSection.append(vmList)

    const addVmBtn = el('button', 'td-props__btn td-props__btn--sm')
    addVmBtn.type = 'button'
    addVmBtn.textContent = '+ 添加映射'
    addVmBtn.addEventListener('click', () => {
      valueMap[''] = ''
      rules[i] = { ...rules[i], cascade: { ...cascade, valueMap: { ...valueMap } } }
      onChange({ ...field, rules: [...rules] })
      renderVmList()
    })
    vmSection.append(addVmBtn)
    wrap.append(vmSection)
    return wrap
  }

  private _describeRule(rule: ITemplateRule, allFieldIds: string[]): string {
    if (rule.type === 'cascade') {
      const target = rule.cascade?.targetField || '(未设置)'
      return `当值变化 → 更新字段 ${target}`
    }
    if (!rule.condition || !rule.condition.field) {
      return `规则类型: ${rule.type}`
    }
    const typeLabel: Record<string, string> = {
      visibility: '显示', required: '必填', readonly: '只读', hidden: '隐藏'
    }
    const opLabel: Record<string, string> = {
      equals: '=', notEquals: '≠', includes: '含', notIncludes: '不含'
    }
    const invalid = rule.condition.field && !allFieldIds.includes(rule.condition.field)
    const fieldPart = invalid ? `⚠ ${rule.condition.field}` : rule.condition.field
    return `当 ${fieldPart} ${opLabel[rule.condition.operator] ?? rule.condition.operator} "${rule.condition.value}" 时 → ${typeLabel[rule.type] ?? rule.type}`
  }

  private _findField(
    block: ITemplateBlock,
    fieldId: string
  ): ITemplateField | null {
    if (block.type === 'fieldRow') {
      return (block as ITemplateFieldRowBlock).fields.find(f => f.id === fieldId) ?? null
    }
    if (block.type === 'paragraph') {
      for (const seg of (block as ITemplateParagraphBlock).segments) {
        if (seg.type === 'field' && seg.field.id === fieldId) return seg.field
      }
    }
    if (block.type === 'table') {
      for (const col of (block as ITemplateTableBlock).columns) {
        if (col.field?.id === fieldId) return col.field
      }
    }
    return null
  }

  getElement(): HTMLDivElement {
    return this.container
  }
}
