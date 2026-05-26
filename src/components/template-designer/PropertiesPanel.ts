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
  ITemplateSeparatorBlock,
  ITemplateSpacerBlock,
  ITemplateRule,
  ITemplateCondition,
  ITemplateOption,
  ITemplateSegment,
  ITemplateLayout
} from '../../editor/template/index'
import {
  PAGE_SIZE_PRESETS,
  TEMPLATE_SYSTEM_VARIABLES
} from '../../editor/template/index'
import type { PageSizePreset } from '../../editor/template/index'
import { ListStyle, ListType } from '../../editor/dataset/enum/List'
import {
  getTemplatePageDecorationPreset,
  getTemplatePageDecorationPresets,
  type ITemplatePageDecorationVariableDefinition
} from '../../editor/template/TemplatePageDecoration'
import {
  applyBusinessFieldQuickPreset,
  getBusinessFieldQuickPresets,
  recommendBusinessFieldQuickPresets
} from '../../editor/template/TemplateFieldQuickPreset'
import type { SelectionTarget } from './SchemaCanvas'

export type PropertiesChangePhase = 'input' | 'commit'

export interface IPropertiesPanelOptions {
  onBlockChange: (
    blockIndex: number,
    updated: ITemplateBlock,
    phase?: PropertiesChangePhase
  ) => void
  onFieldChange: (
    blockIndex: number,
    fieldId: string,
    updated: ITemplateField,
    phase?: PropertiesChangePhase
  ) => void
  onAddField: (blockIndex: number) => void
  onLayoutChange?: (layout: ITemplateLayout, phase?: PropertiesChangePhase) => void
}

const RULE_TYPE_COLORS: Record<string, string> = {
  visibility: '#4285f4',
  hidden: '#ff9800',
  readonly: '#9c27b0',
  required: '#e53935',
  cascade: '#2e7d32'
}

const RUNTIME_TEXT_TOKENS = [
  {
    label: '打印时间',
    value: TEMPLATE_SYSTEM_VARIABLES.PRINT_TIME
  },
  {
    label: '操作者',
    value: TEMPLATE_SYSTEM_VARIABLES.OPERATOR_NAME
  }
]

let activeChangePhase: PropertiesChangePhase = 'commit'

function withChangePhase(phase: PropertiesChangePhase, callback: () => void) {
  const previous = activeChangePhase
  activeChangePhase = phase
  try {
    callback()
  } finally {
    activeChangePhase = previous
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (className) e.className = className
  return e
}

function row(label: string, input: HTMLElement, help?: string): HTMLDivElement {
  const wrap = el('div', 'td-props__row')
  const lbl = el('label', 'td-props__label')
  const labelText = el('span')
  labelText.textContent = label
  lbl.append(labelText)
  if (help) {
    const helpIcon = el('span', 'td-props__help')
    helpIcon.textContent = '?'
    helpIcon.setAttribute('data-tooltip', help)
    lbl.append(helpIcon)
  }
  wrap.append(lbl, input)
  return wrap
}

function textInput(
  value: string,
  onChange: (v: string) => void,
  placeholder?: string
): HTMLInputElement {
  const inp = el('input', 'td-props__input')
  inp.type = 'text'
  inp.value = value
  if (placeholder) inp.placeholder = placeholder
  let composing = false
  inp.addEventListener('compositionstart', () => { composing = true })
  inp.addEventListener('compositionend', () => {
    composing = false
    withChangePhase('input', () => onChange(inp.value))
  })
  inp.addEventListener('input', () => {
    if (composing) return
    withChangePhase('input', () => onChange(inp.value))
  })
  inp.addEventListener('blur', () => {
    withChangePhase('commit', () => onChange(inp.value))
  })
  return inp
}

function numberInput(
  value: number | undefined,
  onChange: (v: number | undefined) => void,
  placeholder?: string
): HTMLInputElement {
  const inp = el('input', 'td-props__input')
  inp.type = 'number'
  inp.value = value != null ? String(value) : ''
  if (placeholder) inp.placeholder = placeholder
  const readValue = () => {
    const n = parseFloat(inp.value)
    return isNaN(n) ? undefined : n
  }
  inp.addEventListener('input', () => {
    withChangePhase('input', () => onChange(readValue()))
  })
  inp.addEventListener('blur', () => {
    withChangePhase('commit', () => onChange(readValue()))
  })
  return inp
}

function textareaInput(
  value: string,
  onChange: (v: string) => void,
  placeholder?: string,
  rows = 4
): HTMLTextAreaElement {
  const ta = el('textarea', 'td-props__textarea')
  ta.value = value
  ta.rows = rows
  if (placeholder) ta.placeholder = placeholder
  let composing = false
  ta.addEventListener('compositionstart', () => { composing = true })
  ta.addEventListener('compositionend', () => {
    composing = false
    withChangePhase('input', () => onChange(ta.value))
  })
  ta.addEventListener('input', () => {
    if (composing) return
    withChangePhase('input', () => onChange(ta.value))
  })
  ta.addEventListener('blur', () => {
    withChangePhase('commit', () => onChange(ta.value))
  })
  return ta
}

function normalizeListRender(
  render: ITemplateField['valueRender'] | undefined
): NonNullable<ITemplateField['valueRender']> {
  const listType = render?.listType ?? ListType.UL
  const listStyle = listType === ListType.OL
    ? ListStyle.DECIMAL
    : render?.listStyle === ListStyle.CIRCLE || render?.listStyle === ListStyle.SQUARE
      ? render.listStyle
      : ListStyle.DISC
  return {
    mode: 'list',
    listType,
    listStyle
  }
}

function card(title: string, children: HTMLElement[], help?: string): HTMLDivElement {
  const wrap = el('div', 'td-props__card')
  const header = el('div', 'td-props__card-title')
  const text = el('span')
  text.textContent = title
  header.append(text)
  if (help) {
    const helpIcon = el('span', 'td-props__help')
    helpIcon.textContent = '?'
    helpIcon.setAttribute('data-tooltip', help)
    header.append(helpIcon)
  }
  wrap.append(header, ...children)
  return wrap
}

function tokenChips(
  items: Array<{ label: string; value: string }>,
  onPick: (value: string) => void
): HTMLDivElement {
  const wrap = el('div', 'td-props__chip-row')
  items.forEach(item => {
    const btn = el('button', 'td-props__chip-btn')
    btn.type = 'button'
    btn.textContent = item.label
    btn.title = item.value
    btn.addEventListener('click', () => onPick(item.value))
    wrap.append(btn)
  })
  return wrap
}

function note(text: string): HTMLDivElement {
  const wrap = el('div', 'td-props__hint')
  wrap.textContent = text
  return wrap
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

    const onChg = (patch: Partial<ITemplateLayout>) => {
      const updated = { ...this.layout, ...patch }
      this.layout = updated
      this.options.onLayoutChange?.(updated, activeChangePhase)
    }
    const onFooterRuntimeChange = (patch: Partial<NonNullable<ITemplateLayout['footerRuntime']>>) => {
      onChg({
        footerRuntime: {
          ...(this.layout.footerRuntime ?? {}),
          ...patch
        }
      })
    }
    const onPageDecorationChange = (
      patch: Partial<NonNullable<ITemplateLayout['pageDecorations']>>
    ) => {
      onChg({
        pageDecorations: {
          ...(this.layout.pageDecorations ?? {}),
          ...patch
        }
      })
    }

    // Paper size preset
    const sizeOpts = (Object.keys(PAGE_SIZE_PRESETS) as PageSizePreset[]).map(k => ({
      label: PAGE_SIZE_PRESETS[k].label,
      value: k
    }))
    const pageRows: HTMLElement[] = [
      row('纸张大小', selectInput(sizeOpts, this.layout.pageSize ?? 'A4', v => onChg({ pageSize: v as PageSizePreset })))
    ]

    // Orientation toggle
    const oriWrap = el('div', 'td-props__row')
    const oriLbl = el('label', 'td-props__label')
    oriLbl.textContent = '纸张方向'
    const oriBtns = el('div', 'td-props__btn-group')
    const ori = this.layout.orientation ?? 'portrait'
    for (const opt of [{ value: 'portrait', label: '纵向' }, { value: 'landscape', label: '横向' }]) {
      const btn = el('button', `td-props__dir-btn${ori === opt.value ? ' td-props__dir-btn--active' : ''}`)
      btn.type = 'button'
      btn.textContent = opt.label
      btn.addEventListener('click', () => onChg({ orientation: opt.value as 'portrait' | 'landscape' }))
      oriBtns.append(btn)
    }
    oriWrap.append(oriLbl, oriBtns)
    pageRows.push(oriWrap)
    const paperCard = card(
      '纸张版式',
      pageRows,
      '控制设计画布与运行预览使用的纸张尺寸、方向和默认页面尺寸。'
    )
    paperCard.dataset.layoutSection = 'paper'
    this.container.append(paperCard)

    // Margins
    const marginRows: HTMLElement[] = []

    const presets = el('div', 'td-props__preset-grid')
    const marginPresets: Array<{
      label: string
      desc: string
      value: [number, number, number, number]
    }> = [
      { label: '病历常规', desc: '上100 / 右120 / 下100 / 左120', value: [100, 120, 100, 120] },
      { label: '紧凑打印', desc: '上72 / 右88 / 下72 / 左88', value: [72, 88, 72, 88] },
      { label: '签章留白', desc: '上100 / 右120 / 下150 / 左120', value: [100, 120, 150, 120] }
    ]
    marginPresets.forEach(preset => {
      const btn = el('button', 'td-props__preset-card')
      btn.type = 'button'
      const label = el('strong')
      label.textContent = preset.label
      const desc = el('span')
      desc.textContent = preset.desc
      btn.append(label, desc)
      btn.addEventListener('click', () => {
        onChg({ margins: preset.value })
        this._render()
      })
      presets.append(btn)
    })
    marginRows.push(presets)

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
        withChangePhase('input', () => onChg({ margins: updated }))
      })
      inp.addEventListener('blur', () => {
        const val = parseInt(inp.value) || 0
        const current = (this.layout.margins ?? defaultMargins) as [number, number, number, number]
        const updated: [number, number, number, number] = [current[0], current[1], current[2], current[3]]
        updated[index] = val
        withChangePhase('commit', () => onChg({ margins: updated }))
      })
      cell.append(lbl, inp)
      marginGrid.append(cell)
    }
    marginRows.push(marginGrid)
    const marginsCard = card(
      '页边距',
      marginRows,
      '常用病历页面预设可一键套用，数字框仍可继续精调。'
    )
    marginsCard.dataset.layoutSection = 'margins'
    this.container.append(marginsCard)

    // Font defaults
    const fontFamilyOpts = [
      { label: '(系统默认)', value: '' },
      { label: '宋体', value: 'SimSun' },
      { label: '黑体', value: 'SimHei' },
      { label: '楷体', value: 'KaiTi' },
      { label: '仿宋', value: 'FangSong' },
      { label: '微软雅黑', value: 'Microsoft YaHei' },
      { label: 'Arial', value: 'Arial' }
    ]
    this.container.append(card('默认字体', [
      row('字体', selectInput(fontFamilyOpts, this.layout.defaultFont ?? '', v =>
        onChg({ defaultFont: v || undefined })
      )),
      row('字号', numberInput(this.layout.defaultFontSize, v =>
        onChg({ defaultFontSize: v })
      ))
    ], '模板默认正文建议使用宋体 14 号，贴近真实病历文书。'))

    const pageDecorations = this.layout.pageDecorations ?? {}
    const headerPreset = getTemplatePageDecorationPreset(pageDecorations.header?.id)
    const footerPreset = getTemplatePageDecorationPreset(pageDecorations.footer?.id)
    const headerPresetOptions = [
      { label: '不使用预定义页眉', value: '' },
      ...getTemplatePageDecorationPresets('header').map(item => ({
        label: item.name,
        value: item.id
      }))
    ]
    const footerPresetOptions = [
      { label: '不使用预定义页脚', value: '' },
      ...getTemplatePageDecorationPresets('footer').map(item => ({
        label: item.name,
        value: item.id
      }))
    ]
    const modeOptions = [
      { label: '替换当前区块', value: 'replace' },
      { label: '前置合并', value: 'prepend' },
      { label: '后置合并', value: 'append' }
    ]
    const variableDefs = Array.from(new Map(
      [
        ...(headerPreset?.variables ?? []),
        ...(footerPreset?.variables ?? [])
      ].map((item: ITemplatePageDecorationVariableDefinition) => [item.key, item])
    ).values())
    const decorationRows: HTMLElement[] = [
      row('页眉模板', selectInput(
        headerPresetOptions,
        pageDecorations.header?.id ?? '',
        v => onPageDecorationChange({
          header: {
            ...(pageDecorations.header ?? {}),
            id: v || undefined
          }
        })
      )),
      row('页眉合并', selectInput(
        modeOptions,
        pageDecorations.header?.mode ?? 'replace',
        v => onPageDecorationChange({
          header: {
            ...(pageDecorations.header ?? {}),
            mode: v as 'replace' | 'prepend' | 'append'
          }
        })
      )),
      row('页脚模板', selectInput(
        footerPresetOptions,
        pageDecorations.footer?.id ?? '',
        v => onPageDecorationChange({
          footer: {
            ...(pageDecorations.footer ?? {}),
            id: v || undefined
          }
        })
      )),
      row('页脚合并', selectInput(
        modeOptions,
        pageDecorations.footer?.mode ?? 'replace',
        v => onPageDecorationChange({
          footer: {
            ...(pageDecorations.footer ?? {}),
            mode: v as 'replace' | 'prepend' | 'append'
          }
        })
      ))
    ]
    if (variableDefs.length) {
      variableDefs.forEach(def => {
        decorationRows.push(row(
          def.label,
          textInput(
            pageDecorations.variables?.[def.key] ?? '',
            v => onPageDecorationChange({
              variables: {
                ...(pageDecorations.variables ?? {}),
                [def.key]: v || undefined
              }
            }),
            def.placeholder
          ),
          def.description
        ))
      })
    }
    if (headerPreset || footerPreset) {
      decorationRows.push(note('若需修改通用页眉页脚的具体内容，请到左侧页眉/页脚区点击“转为可编辑页眉/页脚”，展开为当前模板自己的区块后再编辑。'))
    }
    decorationRows.push(note('文书标题默认回退模板名称；页码仍建议通过“页脚运行态”统一控制。'))
    const decorationCard = card(
      '页眉页脚模板',
      decorationRows,
      '通过预定义页眉页脚快速复用医院文书头尾样式，并支持少量变量和合并模式配置。'
    )
    decorationCard.dataset.layoutSection = 'decorations'
    this.container.append(decorationCard)

    const footerRuntime = this.layout.footerRuntime ?? {}
    this.container.append(card('页脚运行态', [
      checkboxInput('显示页码', footerRuntime.enabledPageNumber ?? false, v =>
        onFooterRuntimeChange({ enabledPageNumber: v })
      ),
      row('页码格式', textInput(
        footerRuntime.pageNumberFormat ?? `第 ${TEMPLATE_SYSTEM_VARIABLES.PAGE_NO} / ${TEMPLATE_SYSTEM_VARIABLES.PAGE_COUNT} 页`,
        v => onFooterRuntimeChange({ pageNumberFormat: v || undefined }),
        `第 ${TEMPLATE_SYSTEM_VARIABLES.PAGE_NO} / ${TEMPLATE_SYSTEM_VARIABLES.PAGE_COUNT} 页`
      ), '页码使用专用占位符渲染，适合统一分页页脚。'),
      row(
        '页码对齐',
        alignButtons(footerRuntime.pageNumberAlign, v =>
          onFooterRuntimeChange({ pageNumberAlign: v as 'left' | 'center' | 'right' })
        )
      ),
      row('底边距', numberInput(footerRuntime.pageNumberBottom, v =>
        onFooterRuntimeChange({ pageNumberBottom: v })
      ), '默认 60'),
      row('预览操作者', textInput(
        footerRuntime.operatorName ?? '',
        v => onFooterRuntimeChange({ operatorName: v || undefined }),
        '如 张医生'
      ), '用于设计器预览和运行时默认操作者展示。'),
      note(`可用于静态文本/段落：${TEMPLATE_SYSTEM_VARIABLES.PRINT_TIME}、${TEMPLATE_SYSTEM_VARIABLES.OPERATOR_NAME}`)
    ], '静态文本和段落文本支持 {{打印时间}}、{{操作者}} 两个系统变量；页码建议通过本分组统一控制。'))

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
      this.options.onBlockChange(blockIndex, updated, activeChangePhase)

    if (block.type === 'section') {
      const sec = block as ITemplateSectionBlock
      this.container.append(card('分节标题', [
        row('标题', textInput(sec.title, v => onChange({ ...sec, title: v }), '请输入分节标题')),
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
        ),
        checkboxInput('标题后换行', sec.titleLineBreak ?? true, v =>
          onChange({ ...sec, titleLineBreak: v })
        ),
        row('段后间距', numberInput(sec.spacing, v =>
          onChange({ ...sec, spacing: v })
        ), '默认 0，不额外插空行'),
        row('标题字号', numberInput(sec.titleStyle?.size, v =>
          onChange({ ...sec, titleStyle: { ...sec.titleStyle, size: v } })
        ), '继承默认'),
        checkboxInput('标题加粗', sec.titleStyle?.bold ?? false, v =>
          onChange({ ...sec, titleStyle: { ...sec.titleStyle, bold: v } })
        )
      ], '分节用于病历结构组织，标题样式会直接影响文书层级。'))
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
      this.container.append(card('字段行', [
        row('分隔符', textInput(fr.separator ?? '', v => onChange({ ...fr, separator: v || undefined }), '默认空格')),
        row(
          '行对齐',
          alignButtons(fr.align, v => onChange({ ...fr, align: v as ITemplateFieldRowBlock['align'] }), true)
        ),
        checkboxInput('等宽栅格（平均分配控件宽度）', fr.equalWidth ?? false, v =>
          onChange({ ...fr, equalWidth: v || undefined })
        ),
        checkboxInput('字段行后换行', fr.lineBreak ?? true, v =>
          onChange({ ...fr, lineBreak: v })
        )
      ], '字段行适合横向排布多个短字段，等宽栅格可提升对齐稳定性。'))
      const addBtn = el('button', 'td-props__btn')
      addBtn.textContent = '+ 添加字段'
      addBtn.addEventListener('click', () => this.options.onAddField(blockIndex))
      this.container.append(addBtn)
    }

    if (block.type === 'paragraph') {
      const para = block as ITemplateParagraphBlock
      this.container.append(card('段落版式', [
        row(
          '对齐方式',
          alignButtons(para.align, v => onChange({ ...para, align: v as ITemplateParagraphBlock['align'] }), true)
        ),
        checkboxInput('段落后换行', para.lineBreak ?? true, v =>
          onChange({ ...para, lineBreak: v })
        ),
        row('字号', numberInput(para.style?.size, v =>
          onChange({ ...para, style: { ...para.style, size: v } })
        ), '继承默认'),
        checkboxInput('加粗', para.style?.bold ?? false, v =>
          onChange({ ...para, style: { ...para.style, bold: v } })
        )
      ], '段落可混排静态文本和字段，适合病史、专科情况等长文本结构。'))
      this.container.append(this._renderParagraphSegmentsEditor(para, onChange))
    }

    if (block.type === 'staticText') {
      this.container.append(this._renderStaticTextEditor(block as ITemplateStaticTextBlock, onChange))
    }

    if (block.type === 'separator') {
      this.container.append(this._renderSeparatorEditor(block as ITemplateSeparatorBlock, onChange))
    }

    if (block.type === 'spacer') {
      this.container.append(this._renderSpacerEditor(block as ITemplateSpacerBlock, onChange))
    }

    if (block.type === 'table') {
      const tb = block as ITemplateTableBlock
      this.container.append(card('表格版式', [
        checkboxInput('动态行（用户可追加行）', tb.dynamicRows ?? false, v =>
          onChange({ ...tb, dynamicRows: v })
        ),
        row('表头高度', numberInput(tb.headerRowHeight, v =>
          onChange({ ...tb, headerRowHeight: v })
        ), '默认高度'),
        row('行高', numberInput(tb.rowHeight, v =>
          onChange({ ...tb, rowHeight: v })
        ), '默认行高'),
        row('边框宽度', numberInput(tb.borderWidth, v =>
          onChange({ ...tb, borderWidth: v })
        ), '默认 1'),
        row('边框颜色', textInput(tb.borderColor ?? '', v =>
          onChange({ ...tb, borderColor: v || undefined })
        , '#d8dde6'))
      ], '表格适合结构化清单、检查结果和护理记录。'))
      this.container.append(this._renderTableColumnsEditor(tb, onChange))
    }
  }

  private _renderSeparatorEditor(
    block: ITemplateSeparatorBlock,
    onChange: (updated: ITemplateBlock) => void
  ): HTMLDivElement {
    const presets = el('div', 'td-props__preset-grid')
    const presetItems: Array<{ label: string; desc: string; patch: Partial<ITemplateSeparatorBlock> }> = [
      { label: '实线', desc: '常规分隔', patch: { dashArray: undefined, lineWidth: 1, color: '#d8dde6' } },
      { label: '虚线', desc: '轻量分隔', patch: { dashArray: [4, 4], lineWidth: 1, color: '#9aa3b2' } },
      { label: '签章线', desc: '签名留痕', patch: { dashArray: undefined, lineWidth: 1, width: 180, align: 'right' } },
      { label: '标题线', desc: '章节强调', patch: { dashArray: undefined, lineWidth: 2, color: '#303744' } }
    ]
    presetItems.forEach(item => {
      const btn = el('button', 'td-props__preset-card')
      btn.type = 'button'
      const label = el('strong')
      label.textContent = item.label
      const desc = el('span')
      desc.textContent = item.desc
      btn.append(label, desc)
      btn.addEventListener('click', () => onChange({ ...block, ...item.patch }))
      presets.append(btn)
    })

    const dashValue = block.dashArray?.join(',') ?? ''
    return card('分割线', [
      presets,
      row('颜色', textInput(block.color ?? '', v => onChange({ ...block, color: v || undefined }), '#d8dde6')),
      row('线宽', numberInput(block.lineWidth, v => onChange({ ...block, lineWidth: v }), '1')),
      row('长度', numberInput(block.width, v => onChange({ ...block, width: v }), '留空撑满')),
      row('虚线', textInput(dashValue, v => {
        const dashArray = v.split(',').map(item => Number(item.trim())).filter(item => !Number.isNaN(item))
        onChange({ ...block, dashArray: dashArray.length ? dashArray : undefined })
      }, '如 4,4')),
      row(
        '对齐',
        alignButtons(block.align, v => onChange({ ...block, align: v as ITemplateSeparatorBlock['align'] }))
      ),
      row('上下留白', numberInput(block.spacing, v => onChange({ ...block, spacing: v }), '默认')),
      row('垂直偏移', numberInput(block.offsetY, v => onChange({ ...block, offsetY: v }), '默认'))
    ], '常用文书分割线可先套预设，再精调颜色、长度和偏移。')
  }

  private _renderSpacerEditor(
    block: ITemplateSpacerBlock,
    onChange: (updated: ITemplateBlock) => void
  ): HTMLDivElement {
    const presets = el('div', 'td-props__preset-grid')
    const presetItems = [
      { label: '小留白', desc: '1 行，轻量分隔', lines: 1 },
      { label: '中留白', desc: '2 行，常规间隔', lines: 2 },
      { label: '大留白', desc: '4 行，明显留区', lines: 4 }
    ]

    presetItems.forEach(item => {
      const btn = el('button', 'td-props__preset-card')
      btn.type = 'button'
      const label = el('strong')
      label.textContent = item.label
      const desc = el('span')
      desc.textContent = item.desc
      btn.append(label, desc)
      btn.addEventListener('click', () => onChange({ ...block, lines: item.lines }))
      presets.append(btn)
    })

    return card('留白块', [
      presets,
      row('空行数', numberInput(block.lines, v => {
        const lines = v == null ? undefined : Math.max(1, Math.floor(v))
        onChange({ ...block, lines })
      }, '默认 1'), '按空行数插入留白，适合隔开上下内容。')
    ], '留白块会编译成纯空白行，适合正文流里的间隔区域，不负责贴底布局。')
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

    section.append(card('系统变量', [
      tokenChips(RUNTIME_TEXT_TOKENS, value => {
        const last = segments[segments.length - 1]
        if (last?.type === 'text') {
          segments[segments.length - 1] = {
            ...last,
            value: `${last.value}${value}`
          }
        } else {
          segments.push({ type: 'text', value })
        }
        onChange({ ...block, segments: [...segments] })
        renderList()
      })
    ], '段落中的纯文本段会在运行时替换 {{打印时间}}、{{操作者}}。'))

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

    const ta = textareaInput(
      block.text,
      v => onChange({ ...block, text: v }),
      '在此输入固定显示的文字内容（如告知书条款、说明文字等）',
      5
    )
    section.append(ta)
    section.append(card('系统变量', [
      tokenChips(RUNTIME_TEXT_TOKENS, value => {
        ta.value = `${ta.value}${value}`
        ta.dispatchEvent(new Event('input'))
        ta.focus()
      })
    ], '静态文本支持 {{打印时间}}、{{操作者}}，适合打印信息和落款说明。'))

    section.append(card('静态文本样式', [
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
      row('字体', textInput(block.style?.font ?? '', v =>
        onChange({ ...block, style: { ...block.style, font: v || undefined } }), '继承默认'
      )),
      checkboxInput('加粗', block.style?.bold ?? false, v =>
        onChange({ ...block, style: { ...block.style, bold: v } })
      ),
      checkboxInput('斜体', block.style?.italic ?? false, v =>
        onChange({ ...block, style: { ...block.style, italic: v } })
      )
    ], '静态文本适合固定说明、告知内容和页眉页脚文案。'))
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

        const widthInp = numberInput(col.width, v => {
          cols[i] = { ...cols[i], width: v }
          onChange({ ...block, columns: [...cols] })
        }, '列宽')
        widthInp.classList.add('td-props__input--sm')

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

        colRow.append(headerInp, widthInp, hasField, del)
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
      this.options.onFieldChange(blockIndex, fieldId, updated, activeChangePhase)
    }

    this.container.append(this._renderFieldPresetPanel(field, onChange))

    this.container.append(card('基础配置', [
      row('ID', textInput(field.id, v => onChange({ ...field, id: v }), '如 patientName')),
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
      row('标签', textInput(field.label ?? '', v => onChange({ ...field, label: v || undefined }), '展示名称')),
      row('占位符', textInput(field.placeholder ?? '', v => onChange({ ...field, placeholder: v || undefined }), '请输入')),
      row('宽度', numberInput(field.width, v => onChange({ ...field, width: v }), '留空自适应'), '留空按内容自适应；仅明确配置 width 时固定宽度。'),
      row('最小宽度', numberInput(field.style?.minWidth, v =>
        onChange({ ...field, style: { ...field.style, minWidth: v } }), '留空自适应'
      )),
      row('前置文本', textInput(field.preText ?? '', v => onChange({ ...field, preText: v || undefined }), '控件前静态文案')),
      row('后置文本', textInput(field.postText ?? '', v => onChange({ ...field, postText: v || undefined }), '控件后静态文案')),
      row('前缀', textInput(field.prefix ?? '', v => onChange({ ...field, prefix: v || undefined }), '如：体温')),
      row('后缀', textInput(field.postfix ?? '', v => onChange({ ...field, postfix: v || undefined }), '如：℃')),
      checkboxInput('必填', field.required ?? false, v => onChange({ ...field, required: v })),
      checkboxInput('只读', field.readonly ?? false, v => onChange({ ...field, readonly: v })),
      checkboxInput('隐藏', field.hidden ?? false, v => onChange({ ...field, hidden: v })),
      checkboxInput('下划线', field.underline ?? false, v => onChange({ ...field, underline: v }))
    ], '字段基础语义影响设计期、运行期和结构化导出。'))

    const isListRenderableField = field.type === 'text' || field.type === 'textarea'
    if (isListRenderableField) {
      const renderMode = field.valueRender?.mode ?? 'plain'
      const listRender = normalizeListRender(field.valueRender)
      const defaultValueControl = renderMode === 'list'
        ? textareaInput(
            Array.isArray(field.defaultValue)
              ? field.defaultValue.join('\n')
              : field.defaultValue ?? '',
            value => {
              const list = value
                .split('\n')
                .map(item => item.trim())
                .filter(Boolean)
              onChange({
                ...field,
                defaultValue: list.length ? list : undefined
              })
            },
            '每行一个默认值'
          )
        : textInput(
            Array.isArray(field.defaultValue)
              ? field.defaultValue.join(',')
              : field.defaultValue ?? '',
            value => onChange({ ...field, defaultValue: value || undefined }),
            '留空无默认值'
          )

      this.container.append(card('值显示', [
        row(
          '显示方式',
          selectInput(
            [
              { label: '普通文本', value: 'plain' },
              { label: '列表展示', value: 'list' }
            ],
            renderMode,
            value => onChange({
              ...field,
              valueRender: value === 'list' ? listRender : undefined
            })
          )
        ),
        ...(renderMode === 'list'
          ? [
              row(
                '列表类型',
                selectInput(
                  [
                    { label: '项目符号', value: ListType.UL },
                    { label: '项目编号', value: ListType.OL }
                  ],
                  listRender.listType ?? ListType.UL,
                  value => {
                    const listType = value as ListType
                    onChange({
                      ...field,
                      valueRender: {
                        ...listRender,
                        listType,
                        listStyle: listType === ListType.OL
                          ? ListStyle.DECIMAL
                          : listRender.listStyle === ListStyle.CIRCLE || listRender.listStyle === ListStyle.SQUARE
                            ? listRender.listStyle
                            : ListStyle.DISC
                      }
                    })
                  }
                )
              ),
              row(
                '列表样式',
                selectInput(
                  listRender.listType === ListType.OL
                    ? [{ label: '阿拉伯数字', value: ListStyle.DECIMAL }]
                    : [
                        { label: '实心圆点', value: ListStyle.DISC },
                        { label: '空心圆点', value: ListStyle.CIRCLE },
                        { label: '方块', value: ListStyle.SQUARE }
                      ],
                  listRender.listStyle ?? ListStyle.DISC,
                  value => onChange({
                    ...field,
                    valueRender: {
                      ...listRender,
                      listStyle: value as ListStyle
                    }
                  })
                )
              ),
              row('列表默认值', defaultValueControl, '每行一条；运行时业务回填数组时也会按此配置展示。')
            ]
          : [row('默认值', defaultValueControl, '留空无默认值')])
      ], '文本和多行文本字段可把多条值渲染为多行项目符号或编号列表。'))
    } else {
      this.container.append(card('值显示', [
        row('默认值', textInput(
          Array.isArray(field.defaultValue) ? field.defaultValue.join(',') : field.defaultValue ?? '',
          value => onChange({ ...field, defaultValue: value || undefined }),
          '留空无默认值'
        ))
      ], '当前字段类型仅支持普通文本默认值。'))
    }

    // Font / style settings
    const fieldFontOpts = [
      { label: '(继承)', value: '' },
      { label: '宋体', value: 'SimSun' },
      { label: '黑体', value: 'SimHei' },
      { label: '楷体', value: 'KaiTi' },
      { label: '仿宋', value: 'FangSong' },
      { label: '微软雅黑', value: 'Microsoft YaHei' },
      { label: 'Arial', value: 'Arial' }
    ]
    this.container.append(card('字体样式', [
      this._renderTextStylePresets(field, onChange),
      row('字体', selectInput(fieldFontOpts, field.style?.font ?? '', v =>
        onChange({ ...field, style: { ...field.style, font: v || undefined } })
      )),
      row('字号', numberInput(field.style?.size, v =>
        onChange({ ...field, style: { ...field.style, size: v } })
      )),
      checkboxInput('加粗', field.style?.bold ?? false, v =>
        onChange({ ...field, style: { ...field.style, bold: v } })
      ),
      checkboxInput('斜体', field.style?.italic ?? false, v =>
        onChange({ ...field, style: { ...field.style, italic: v } })
      )
    ], '常用文本样式可先套预设，再按需微调。'))

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

    this.container.append(this._renderMetadataEditor(field, onChange))

    const allFieldIds = this._getAllFieldIds()
    this.container.append(this._renderRulesEditor(field, onChange, allFieldIds))
  }

  private _renderFieldPresetPanel(
    field: ITemplateField,
    onChange: (f: ITemplateField) => void
  ): HTMLDivElement {
    const wrap = el('div')
    const createPresetGrid = (
      items: Array<{ label: string; desc: string; onClick: () => void }>
    ) => {
      const grid = el('div', 'td-props__preset-grid')
      items.forEach(item => {
        const btn = el('button', 'td-props__preset-card')
        btn.type = 'button'
        const label = el('strong')
        label.textContent = item.label
        const desc = el('span')
        desc.textContent = item.desc
        btn.append(label, desc)
        btn.addEventListener('click', item.onClick)
        grid.append(btn)
      })
      return grid
    }

    const recommended = recommendBusinessFieldQuickPresets(field)
    if (recommended.length) {
      const recommendedTitle = el('div', 'td-props__subsection-title')
      recommendedTitle.textContent = '智能推荐'
      const recommendedHint = el('div', 'td-props__hint')
      recommendedHint.textContent = `已根据字段名、标签和现有元数据推荐：${recommended.map(item => item.label).join('、')}`
      wrap.append(
        recommendedTitle,
        recommendedHint,
        createPresetGrid(
          recommended.map(preset => ({
            label: preset.label,
            desc: preset.description,
            onClick: () => onChange(applyBusinessFieldQuickPreset(field, preset))
          }))
        )
      )
    } else {
      const recommendedHint = el('div', 'td-props__hint')
      recommendedHint.textContent = '未命中明确的智能推荐，可直接从下方业务快配里选择。'
      wrap.append(recommendedHint)
    }

    const businessPresetTitle = el('div', 'td-props__subsection-title')
    businessPresetTitle.textContent = '业务字段快配'
    wrap.append(
      businessPresetTitle,
      createPresetGrid(
        getBusinessFieldQuickPresets().map(preset => ({
          label: preset.label,
          desc: preset.description,
          onClick: () => onChange(applyBusinessFieldQuickPreset(field, preset))
        }))
      )
    )

    const genericTitle = el('div', 'td-props__subsection-title')
    genericTitle.textContent = '通用控件快配'
    wrap.append(genericTitle)

    const items: Array<{ label: string; desc: string; patch: Partial<ITemplateField> }> = [
      { label: '短文本', desc: '姓名、床号、主诊断', patch: { type: 'text', width: undefined, placeholder: '请输入' } },
      { label: '长文本', desc: '主诉、现病史、说明', patch: { type: 'textarea', width: undefined, placeholder: '请输入详细内容' } },
      { label: '日期', desc: '入院、手术、签署时间', patch: { type: 'date', placeholder: '请选择日期' } },
      { label: '数值', desc: '体温、血压、评分', patch: { type: 'number', placeholder: '请输入数值' } },
      { label: '签名', desc: '医生、患者、家属签字', patch: { type: 'signature', width: 160, placeholder: '签名' } },
      { label: '风险强调', desc: '红色加粗重点提示', patch: { style: { ...field.style, bold: true, highlight: '#fff1f0' } } }
    ]
    wrap.append(createPresetGrid(items.map(item => ({
      label: item.label,
      desc: item.desc,
      onClick: () => onChange({ ...field, ...item.patch })
    }))))
    return card('字段快配', [wrap], '业务字段中心和属性栏已复用同一套业务快配预设，并支持按字段名/标签智能推荐。')
  }

  private _renderTextStylePresets(
    field: ITemplateField,
    onChange: (f: ITemplateField) => void
  ): HTMLDivElement {
    const presets = el('div', 'td-props__chip-row')
    const items = [
      { label: '正文', style: { font: 'SimSun', size: 14, bold: false } },
      { label: '标题', style: { font: 'SimHei', size: 16, bold: true } },
      { label: '提示', style: { font: 'SimSun', size: 12, italic: true } },
      { label: '风险', style: { font: 'SimSun', size: 14, bold: true, highlight: '#fff1f0' } }
    ]
    items.forEach(item => {
      const btn = el('button', 'td-props__chip-btn')
      btn.type = 'button'
      btn.textContent = item.label
      btn.addEventListener('click', () => {
        onChange({ ...field, style: { ...field.style, ...item.style } })
      })
      presets.append(btn)
    })
    return presets
  }

  private _renderMetadataEditor(
    field: ITemplateField,
    onChange: (f: ITemplateField) => void
  ): HTMLDivElement {
    const metadata = field.metadata ?? {}
    const listToText = (value?: string[]) => value?.join(', ') ?? ''
    const textToList = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean)
    return card('业务元数据', [
      row('业务编码', textInput(metadata.businessCode ?? '', v =>
        onChange({ ...field, metadata: { ...metadata, businessCode: v || undefined } }), '如 patient.name'
      ), 'HIS/EHR 回填、规则条件和结构化导出的业务稳定键。'),
      row('字段分组', textInput(metadata.group ?? '', v =>
        onChange({ ...field, metadata: { ...metadata, group: v || undefined } }), '如 patient'
      )),
      row('导出路径', textInput(metadata.exportPath ?? '', v =>
        onChange({ ...field, metadata: { ...metadata, exportPath: v || undefined } }), '如 encounter.patient.name'
      )),
      row('权限标签', textInput(metadata.permission ?? '', v =>
        onChange({ ...field, metadata: { ...metadata, permission: v || undefined } }), '如 doctor'
      )),
      row('数据源', textInput(metadata.dataSource ?? '', v =>
        onChange({ ...field, metadata: { ...metadata, dataSource: v || undefined } }), '如 his.patient'
      )),
      row('监听事件', textInput(listToText(metadata.listeners), v =>
        onChange({ ...field, metadata: { ...metadata, listeners: textToList(v) } }), '逗号分隔'
      )),
      row('业务标签', textInput(listToText(metadata.tags), v =>
        onChange({ ...field, metadata: { ...metadata, tags: textToList(v) } }), '逗号分隔'
      ))
    ], '业务参数用于运行时回填、权限分桶、规则联动和结构化导出。')
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

  focusLayoutSection(section: 'paper' | 'margins' | 'decorations') {
    const target = this.container.querySelector(
      `[data-layout-section="${section}"]`
    ) as HTMLElement | null
    target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }
}
