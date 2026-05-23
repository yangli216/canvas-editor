import { FlexDirection } from '../dataset/enum/Common'
import { ControlType } from '../dataset/enum/Control'
import { FORMAT_PLACEHOLDER } from '../dataset/constant/PageNumber'
import { ElementType } from '../dataset/enum/Element'
import { ListStyle, ListType } from '../dataset/enum/List'
import { RowFlex } from '../dataset/enum/Row'
import { TitleLevel } from '../dataset/enum/Title'
import type { IControl, IValueSet } from '../interface/Control'
import type { IEditorData } from '../interface/Editor'
import type { IElement } from '../interface/Element'
import type { IPageNumber } from '../interface/PageNumber'
import type { ITr } from '../interface/table/Tr'
import { normalizeTemplateFieldValue } from './TemplateValueRender'

export type TemplateFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'signature'

export type TemplateRuleType = 'required' | 'readonly' | 'hidden' | 'visibility' | 'cascade'

export type TemplateConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'includes'
  | 'notIncludes'

export type TemplateConditionFieldSource = 'fieldId' | 'businessCode'

export interface ITemplateCondition {
  field: string
  fieldType?: TemplateConditionFieldSource
  operator: TemplateConditionOperator
  value: string | string[]
}

export interface ITemplateCascade {
  targetField: string
  targetFieldType?: TemplateConditionFieldSource
  optionMap?: Record<string, ITemplateOption[]>
  valueMap?: Record<string, string>
}

export interface ITemplateRule {
  type: TemplateRuleType
  condition?: ITemplateCondition
  message?: string
  cascade?: ITemplateCascade
}

export interface ITemplateOption {
  label: string
  value?: string
  code?: string
}

export interface ITemplateFieldMetadata {
  businessCode?: string
  group?: string
  exportPath?: string
  permission?: string
  dataSource?: string
  listeners?: string[]
  tags?: string[]
}

export type TemplateFieldValueRenderMode = 'plain' | 'list'

export interface ITemplateFieldValueRender {
  mode?: TemplateFieldValueRenderMode
  listType?: ListType
  listStyle?: ListStyle
}

export interface ITemplateField {
  id: string
  type: TemplateFieldType
  label?: string
  placeholder?: string
  defaultValue?: string | string[] | null
  options?: ITemplateOption[]
  width?: number
  prefix?: string
  postfix?: string
  preText?: string
  postText?: string
  underline?: boolean
  required?: boolean
  readonly?: boolean
  hidden?: boolean
  deletable?: boolean
  min?: number
  max?: number
  valueRender?: ITemplateFieldValueRender
  metadata?: ITemplateFieldMetadata
  rules?: ITemplateRule[]
  style?: Pick<
    IControl,
    'font' | 'size' | 'bold' | 'highlight' | 'italic' | 'strikeout'
  > &
    Partial<
      Pick<
        IControl,
        | 'border'
        | 'rowFlex'
        | 'minWidth'
        | 'numberExclusiveOptions'
        | 'isMultiSelect'
        | 'multiSelectDelimiter'
      >
    >
}

export interface ITemplateTextSegment {
  type: 'text'
  value: string
  style?: Partial<IElement>
}

export interface ITemplateFieldSegment {
  type: 'field'
  field: ITemplateField
}

export type ITemplateSegment = ITemplateTextSegment | ITemplateFieldSegment

export interface ITemplateParagraphBlock {
  type: 'paragraph'
  segments: ITemplateSegment[]
  style?: Partial<IElement>
  align?: 'left' | 'center' | 'right' | 'justify'
  lineBreak?: boolean
}

export interface ITemplateFieldRowBlock {
  type: 'fieldRow'
  fields: ITemplateField[]
  separator?: string
  align?: 'left' | 'center' | 'right' | 'justify'
  equalWidth?: boolean
  lineBreak?: boolean
}

export interface ITemplateGroupBlock {
  type: 'group'
  id?: string
  direction?: 'row' | 'column'
  blocks: ITemplateBlock[]
  separator?: string
  rules?: ITemplateRule[]
}

export interface ITemplateSectionBlock {
  type: 'section'
  id?: string
  title: string
  align?: 'left' | 'center' | 'right'
  level?: TitleLevel
  titleLineBreak?: boolean
  spacing?: number
  titleStyle?: Partial<IElement>
  blocks: ITemplateBlock[]
  rules?: ITemplateRule[]
}

export interface ITemplateSeparatorBlock {
  type: 'separator'
  dashArray?: number[]
  lineWidth?: number
  color?: string
  width?: number
  align?: 'left' | 'center' | 'right'
  spacing?: number
  offsetY?: number
}

export interface ITemplateSpacerBlock {
  type: 'spacer'
  lines?: number
}

export interface ITemplateTableColumn {
  header: string
  field?: ITemplateField
  width?: number
}

export interface ITemplateTableBlock {
  type: 'table'
  id?: string
  columns: ITemplateTableColumn[]
  rows?: number
  dynamicRows?: boolean
  headerRowHeight?: number
  rowHeight?: number
  borderColor?: string
  borderWidth?: number
}

export interface ITemplateStaticTextBlock {
  type: 'staticText'
  text: string
  align?: 'left' | 'center' | 'right'
  style?: Partial<IElement>
}

export interface ITemplateFooterRuntimeLayout {
  enabledPageNumber?: boolean
  pageNumberFormat?: string
  pageNumberAlign?: 'left' | 'center' | 'right'
  pageNumberBottom?: number
  operatorName?: string
}

export type ITemplateBlock =
  | ITemplateParagraphBlock
  | ITemplateFieldRowBlock
  | ITemplateGroupBlock
  | ITemplateSectionBlock
  | ITemplateSeparatorBlock
  | ITemplateSpacerBlock
  | ITemplateTableBlock
  | ITemplateStaticTextBlock

export const PAGE_SIZE_PRESETS = {
  A4: { width: 794, height: 1123, label: 'A4 (210×297mm)' },
  A3: { width: 1123, height: 1587, label: 'A3 (297×420mm)' },
  A5: { width: 559, height: 794, label: 'A5 (148×210mm)' },
  A6: { width: 397, height: 559, label: 'A6 (105×148mm)' },
  B4: { width: 944, height: 1334, label: 'B4 (250×353mm)' },
  B5: { width: 668, height: 944, label: 'B5 (176×250mm)' },
  legal: { width: 816, height: 1344, label: 'Legal (8.5×14in)' },
  letter: { width: 816, height: 1056, label: 'Letter (8.5×11in)' }
} as const

export type PageSizePreset = keyof typeof PAGE_SIZE_PRESETS

export interface ITemplateLayout {
  labelSuffix?: string
  fieldSeparator?: string
  sectionSpacing?: number
  textareaWidth?: number
  defaultControlWidth?: number
  titleStyle?: Partial<IElement>
  pageSize?: PageSizePreset
  orientation?: 'portrait' | 'landscape'
  margins?: [number, number, number, number]
  defaultFont?: string
  defaultFontSize?: number
  footerRuntime?: ITemplateFooterRuntimeLayout
}

export interface ITemplateSchema {
  version: string
  id: string
  name: string
  description?: string
  layout?: ITemplateLayout
  header?: ITemplateBlock[]
  blocks: ITemplateBlock[]
  footer?: ITemplateBlock[]
}

const DEFAULT_LAYOUT: Required<
  Pick<
    ITemplateLayout,
    | 'labelSuffix'
    | 'fieldSeparator'
    | 'sectionSpacing'
    | 'textareaWidth'
    | 'defaultFont'
    | 'defaultFontSize'
  >
> = {
  labelSuffix: '：',
  fieldSeparator: '    ',
  sectionSpacing: 0,
  textareaWidth: 320,
  defaultFont: 'SimSun',
  defaultFontSize: 14
}

interface ITemplateContext {
  schema: ITemplateSchema
  layout: ITemplateLayout & typeof DEFAULT_LAYOUT
  blockId?: string
  blockRules?: ITemplateRule[]
  runtime: ITemplateRuntimeValues
}

export interface ITemplateRuntimeValues {
  printTime?: Date | string
  operatorName?: string
}

export const TEMPLATE_SYSTEM_VARIABLES = {
  PRINT_TIME: '{{打印时间}}',
  OPERATOR_NAME: '{{操作者}}',
  PAGE_NO: '{{页码}}',
  PAGE_COUNT: '{{总页数}}'
} as const

export const DEFAULT_SEPARATOR_OFFSET_Y = -6

interface ITemplateExtension {
  template: {
    schemaId: string
    schemaName: string
    blockType?: ITemplateBlock['type']
    fieldId?: string
    fieldType?: TemplateFieldType
    rules?: ITemplateRule[]
    blockId?: string
    blockRules?: ITemplateRule[]
  }
}

function createTemplateExtension(
  ctx: ITemplateContext,
  metadata: Omit<ITemplateExtension['template'], 'schemaId' | 'schemaName'>
): ITemplateExtension {
  return {
    template: {
      schemaId: ctx.schema.id,
      schemaName: ctx.schema.name,
      ...(ctx.blockId ? { blockId: ctx.blockId } : {}),
      ...(ctx.blockRules?.length ? { blockRules: ctx.blockRules } : {}),
      ...metadata
    }
  }
}

function createTextElement(
  value: string,
  style: Partial<IElement> = {},
  extension?: ITemplateExtension
): IElement {
  return {
    value,
    ...style,
    ...(extension ? { extension } : {})
  }
}

function createLockedLabelElement(
  ctx: ITemplateContext,
  field: ITemplateField,
  blockType: ITemplateBlock['type']
): IElement {
  return createTextElement(
    `${field.label}${ctx.layout.labelSuffix}`,
    {
      titleId: `template-field-label-${field.id}`,
      title: {
        disabled: true,
        deletable: false
      }
    },
    createTemplateExtension(ctx, {
      blockType,
      fieldId: field.id,
      fieldType: field.type,
      rules: field.rules
    })
  )
}

function createNewline(count = 1): IElement[] {
  return Array.from({ length: count }, () => ({ value: '\n' }))
}

function trimTrailingNewline(elementList: IElement[]): IElement[] {
  const next = [...elementList]
  while (next.length && next[next.length - 1].value === '\n') {
    next.pop()
  }
  return next
}

function appendCompiledBlock(target: IElement[], blockElements: IElement[]) {
  if (!blockElements.length) return
  if (blockElements[0].type === ElementType.SEPARATOR) {
    while (target.length && target[target.length - 1].value === '\n') {
      target.pop()
    }
  }
  target.push(...blockElements)
}

function formatRuntimePrintTime(value?: Date | string): string {
  const date = value instanceof Date
    ? value
    : typeof value === 'string' && value
      ? new Date(value)
      : new Date()
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date
  const yyyy = safeDate.getFullYear()
  const mm = `${safeDate.getMonth() + 1}`.padStart(2, '0')
  const dd = `${safeDate.getDate()}`.padStart(2, '0')
  const hh = `${safeDate.getHours()}`.padStart(2, '0')
  const min = `${safeDate.getMinutes()}`.padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`
}

function resolveRuntimeText(
  value: string,
  runtime: ITemplateRuntimeValues,
  allowPageTokens = false
): string {
  let next = value
  next = next.replaceAll(
    TEMPLATE_SYSTEM_VARIABLES.PRINT_TIME,
    formatRuntimePrintTime(runtime.printTime)
  )
  next = next.replaceAll(
    TEMPLATE_SYSTEM_VARIABLES.OPERATOR_NAME,
    runtime.operatorName || '当前操作者'
  )
  if (!allowPageTokens) {
    next = next
      .replaceAll(TEMPLATE_SYSTEM_VARIABLES.PAGE_NO, '')
      .replaceAll(TEMPLATE_SYSTEM_VARIABLES.PAGE_COUNT, '')
  }
  return next
}

function mapPageNumberFormat(format?: string): string {
  const raw = format?.trim() || `第 ${TEMPLATE_SYSTEM_VARIABLES.PAGE_NO} / ${TEMPLATE_SYSTEM_VARIABLES.PAGE_COUNT} 页`
  return raw
    .replaceAll(TEMPLATE_SYSTEM_VARIABLES.PAGE_NO, FORMAT_PLACEHOLDER.PAGE_NO)
    .replaceAll(TEMPLATE_SYSTEM_VARIABLES.PAGE_COUNT, FORMAT_PLACEHOLDER.PAGE_COUNT)
}

export function getTemplatePageNumberOptions(
  schema: ITemplateSchema
): IPageNumber {
  const runtime = schema.layout?.footerRuntime
  if (!runtime?.enabledPageNumber) {
    return {
      disabled: true
    }
  }
  const rowFlex = runtime.pageNumberAlign === 'right'
    ? RowFlex.RIGHT
    : runtime.pageNumberAlign === 'left'
      ? RowFlex.LEFT
      : RowFlex.CENTER
  return {
    disabled: false,
    bottom: runtime.pageNumberBottom ?? 60,
    rowFlex,
    format: mapPageNumberFormat(runtime.pageNumberFormat)
  }
}

function createTitleElement(
  ctx: ITemplateContext,
  block: ITemplateSectionBlock
): IElement {
  const rowFlex = block.align === 'center'
    ? RowFlex.CENTER
    : block.align === 'right'
      ? RowFlex.RIGHT
      : undefined
  return {
    type: ElementType.TITLE,
    value: '',
    level: block.level || TitleLevel.FIRST,
    ...(rowFlex ? { rowFlex } : {}),
    valueList: [
      {
        value: block.title,
        ...ctx.layout.titleStyle,
        ...block.titleStyle
      }
    ],
    title: {
      deletable: false,
      disabled: true
    },
    extension: createTemplateExtension(ctx, {
      blockType: block.type
    })
  }
}

function createValueSets(options: ITemplateOption[] = []): IValueSet[] {
  return options.map(option => ({
    value: option.value || option.label,
    code: option.code || option.value || option.label
  }))
}

function createControlValue(value: string | string[] | null | undefined) {
  if (value == null) return null
  return [
    {
      value
    }
  ]
}

function estimateTextWidth(text: string, fontSize: number) {
  let units = 0
  for (const char of text) {
    units += char.charCodeAt(0) <= 0xff ? 0.65 : 1
  }
  return Math.ceil(units * fontSize)
}

function estimateOptionControlMinWidth(
  field: ITemplateField,
  layout: ITemplateLayout & typeof DEFAULT_LAYOUT
) {
  if (field.type !== 'select' && field.type !== 'radio') return undefined
  const fontSize = field.style?.size ?? layout.defaultFontSize
  const candidates = (field.options ?? [])
    .map(option => option.label || option.value || option.code || '')
    .filter(Boolean)
  if (!candidates.length) return undefined
  const longest = candidates.reduce((current, option) =>
    option.length > current.length ? option : current
  )
  const affixes = [field.preText, field.prefix, field.postfix, field.postText]
    .filter(Boolean)
    .join('')
  const padding = field.type === 'select' ? 40 : 28
  return Math.max(56, estimateTextWidth(`${affixes}${longest}`, fontSize) + padding)
}

function mapFieldTypeToControlType(type: TemplateFieldType): ControlType {
  switch (type) {
    case 'number':
      return ControlType.NUMBER
    case 'date':
      return ControlType.DATE
    case 'select':
      return ControlType.SELECT
    case 'radio':
      return ControlType.RADIO
    case 'checkbox':
      return ControlType.CHECKBOX
    default:
      return ControlType.TEXT
  }
}

function mergeFieldAffixText(...parts: Array<string | undefined>) {
  const text = parts.filter(Boolean).join('')
  return text || undefined
}

function createControlElement(
  ctx: ITemplateContext,
  field: ITemplateField,
  blockType: ITemplateBlock['type']
): IElement {
  const controlType = mapFieldTypeToControlType(field.type)
  const rules = [
    ...(field.required ? [{ type: 'required' as const }] : []),
    ...(field.readonly ? [{ type: 'readonly' as const }] : []),
    ...(field.hidden ? [{ type: 'hidden' as const }] : []),
    ...(field.rules || [])
  ]
  const control: IControl = {
    type: controlType,
    value: (() => {
      const normalizedValue = normalizeTemplateFieldValue(field, field.defaultValue)
      if (normalizedValue == null) return null
      return Array.isArray(normalizedValue)
        ? normalizedValue
        : createControlValue(normalizedValue)
    })(),
    conceptId: field.id,
    placeholder: field.placeholder,
    preText: mergeFieldAffixText(field.preText, field.prefix),
    postText: mergeFieldAffixText(field.postfix, field.postText),
    minWidth:
      field.width ||
      field.style?.minWidth ||
      (field.type === 'textarea'
        ? ctx.layout.textareaWidth
        : estimateOptionControlMinWidth(field, ctx.layout)),
    underline: field.underline ?? false,
    disabled: field.readonly,
    hide: field.hidden,
    deletable: field.deletable ?? false,
    extension: createTemplateExtension(ctx, {
      blockType,
      fieldId: field.id,
      fieldType: field.type,
      rules
    }),
    ...field.style
  }
  if (field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') {
    control.valueSets = createValueSets(field.options)
    control.code =
      Array.isArray(field.defaultValue) || field.defaultValue == null
        ? null
        : String(field.defaultValue)
    control.flexDirection = FlexDirection.ROW
  }
  if (field.type === 'date') {
    control.dateFormat = 'YYYY-MM-DD'
  }
  if (field.type === 'number') {
    control.numberExclusiveOptions = {
      calculatorDisabled: false,
      ...field.style?.numberExclusiveOptions
    }
  }
  return {
    type: ElementType.CONTROL,
    value: '',
    control,
    extension: createTemplateExtension(ctx, {
      blockType,
      fieldId: field.id,
      fieldType: field.type,
      rules
    })
  }
}

function createFieldElements(
  ctx: ITemplateContext,
  field: ITemplateField,
  blockType: ITemplateBlock['type']
): IElement[] {
  const elementList: IElement[] = []
  if (field.label) {
    elementList.push(
      blockType === 'fieldRow'
        ? createLockedLabelElement(ctx, field, blockType)
        : createTextElement(
            `${field.label}${ctx.layout.labelSuffix}`,
            {},
            createTemplateExtension(ctx, {
              blockType,
              fieldId: field.id,
              fieldType: field.type,
              rules: field.rules
            })
          )
    )
  }
  elementList.push(createControlElement(ctx, field, blockType))
  return elementList
}

function compileParagraphBlock(
  ctx: ITemplateContext,
  block: ITemplateParagraphBlock
): IElement[] {
  const elementList: IElement[] = []
  for (const segment of block.segments) {
    if (segment.type === 'text') {
      elementList.push(
        createTextElement(
          resolveRuntimeText(segment.value, ctx.runtime),
          {
            ...block.style,
            ...segment.style
          },
          createTemplateExtension(ctx, {
            blockType: block.type
          })
        )
      )
    } else {
      elementList.push(...createFieldElements(ctx, segment.field, block.type))
    }
  }
  if (block.lineBreak !== false) {
    elementList.push(...createNewline())
  }

  if (block.align) {
    const rowFlex = block.align === 'center'
      ? RowFlex.CENTER
      : block.align === 'right'
        ? RowFlex.RIGHT
        : block.align === 'justify'
          ? RowFlex.JUSTIFY
          : RowFlex.LEFT
    elementList.forEach(e => { if (e.value !== '\n') e.rowFlex = rowFlex })
  }

  return elementList
}

function compileFieldRowBlock(
  ctx: ITemplateContext,
  block: ITemplateFieldRowBlock
): IElement[] {
  let fields = block.fields
  if (block.equalWidth && fields.length > 0) {
    const equalW = Math.floor(460 / fields.length)
    fields = fields.map(f => ({ ...f, width: equalW }))
  }

  const separator = block.separator ?? ctx.layout.fieldSeparator
  const elementList: IElement[] = []
  fields.forEach((field, index) => {
    if (index > 0 && separator) {
      elementList.push(
        createTextElement(
          separator,
          {},
          createTemplateExtension(ctx, {
            blockType: block.type
          })
        )
      )
    }
    elementList.push(...createFieldElements(ctx, field, block.type))
  })
  if (block.lineBreak !== false) {
    elementList.push(...createNewline())
  }

  if (block.align) {
    const rowFlex = block.align === 'center'
      ? RowFlex.CENTER
      : block.align === 'right'
        ? RowFlex.RIGHT
        : block.align === 'justify'
          ? RowFlex.JUSTIFY
          : RowFlex.LEFT
    elementList.forEach(e => { if (e.value !== '\n') e.rowFlex = rowFlex })
  }

  return elementList
}

function compileGroupBlock(
  ctx: ITemplateContext,
  block: ITemplateGroupBlock
): IElement[] {
  const childCtx: ITemplateContext = (block.id && block.rules?.length)
    ? { ...ctx, blockId: block.id, blockRules: block.rules }
    : ctx

  if (block.direction === 'row') {
    const rowElements: IElement[] = []
    block.blocks.forEach((child, index) => {
      if (index > 0 && block.separator) {
        rowElements.push(
          createTextElement(
            block.separator,
            {},
            createTemplateExtension(childCtx, {
              blockType: block.type
            })
          )
        )
      }
      rowElements.push(...trimTrailingNewline(compileTemplateBlock(childCtx, child)))
    })
    if (rowElements.length) {
      rowElements.push(...createNewline())
    }
    return rowElements
  }

  const elementList: IElement[] = []
  block.blocks.forEach((child, index) => {
    appendCompiledBlock(elementList, compileTemplateBlock(childCtx, child))
    if (index < block.blocks.length - 1) {
      const lastElement = elementList[elementList.length - 1]
      if (lastElement?.value !== '\n') {
        elementList.push(...createNewline())
      }
    }
  })
  return elementList
}

function compileSectionBlock(
  ctx: ITemplateContext,
  block: ITemplateSectionBlock
): IElement[] {
  const childCtx: ITemplateContext = (block.id && block.rules?.length)
    ? { ...ctx, blockId: block.id, blockRules: block.rules }
    : ctx
  const elementList: IElement[] = [createTitleElement(ctx, block)]
  if (block.titleLineBreak !== false) {
    elementList.push(...createNewline())
  }
  for (const child of block.blocks) {
    appendCompiledBlock(elementList, compileTemplateBlock(childCtx, child))
  }
  const spacing = block.spacing ?? ctx.layout.sectionSpacing
  if (spacing > 0) {
    elementList.push(...createNewline(spacing))
  }
  return elementList
}

function compileSeparatorBlock(
  ctx: ITemplateContext,
  block: ITemplateSeparatorBlock
): IElement[] {
  const rowFlex = block.align === 'center'
    ? RowFlex.CENTER
    : block.align === 'right'
      ? RowFlex.RIGHT
      : undefined

  return [
    {
      type: ElementType.SEPARATOR,
      value: '\n',
      dashArray: block.dashArray,
      lineWidth: block.lineWidth,
      color: block.color,
      width: block.width,
      rowMargin: block.spacing,
      offsetY: block.offsetY ?? DEFAULT_SEPARATOR_OFFSET_Y,
      ...(rowFlex ? { rowFlex } : {}),
      extension: createTemplateExtension(ctx, {
        blockType: block.type
      })
    }
  ]
}

function compileTableBlock(
  ctx: ITemplateContext,
  block: ITemplateTableBlock
): IElement[] {
  const cols = block.columns
  const dataRows = block.dynamicRows ? 1 : (block.rows ?? 1)
  const colWidth = Math.floor(460 / cols.length)

  const headerTr: ITr = {
    height: block.headerRowHeight ?? 40,
    pagingRepeat: true,
    tdList: cols.map(col => ({
      colspan: 1,
      rowspan: 1,
      value: [
        createTextElement(
          col.header,
          { bold: true },
          createTemplateExtension(ctx, { blockType: block.type })
        )
      ],
      width: col.width || colWidth,
      disabled: true
    }))
  }

  const dataTrList: ITr[] = Array.from({ length: dataRows }, () => ({
    height: block.rowHeight ?? 40,
    tdList: cols.map(col => ({
      colspan: 1,
      rowspan: 1,
      width: col.width || colWidth,
      value: col.field
        ? [createControlElement(ctx, col.field, block.type)]
        : [createTextElement('', {}, createTemplateExtension(ctx, { blockType: block.type }))]
    }))
  }))

  return [
    {
      type: ElementType.TABLE,
      value: '\n',
      trList: [headerTr, ...dataTrList],
      borderColor: block.borderColor,
      borderWidth: block.borderWidth,
      extension: createTemplateExtension(ctx, { blockType: block.type })
    }
  ]
}

function compileStaticTextBlock(
  ctx: ITemplateContext,
  block: ITemplateStaticTextBlock
): IElement[] {
  const ext = createTemplateExtension(ctx, { blockType: block.type })
  const style: Partial<IElement> = {}
  if (block.style?.size != null) style.size = block.style.size
  if (block.style?.bold) style.bold = true
  if (block.style?.italic) style.italic = true
  if (block.style?.color) style.color = block.style.color
  if (block.align === 'center') style.rowFlex = RowFlex.CENTER
  else if (block.align === 'right') style.rowFlex = RowFlex.RIGHT
  const lines = block.text.split('\n')
  const elements: IElement[] = []
  for (const line of lines) {
    elements.push(createTextElement(resolveRuntimeText(line, ctx.runtime), style, ext))
    elements.push({ value: '\n' })
  }
  return elements
}

function compileSpacerBlock(
  ctx: ITemplateContext,
  block: ITemplateSpacerBlock
): IElement[] {
  const lines = Math.max(1, Math.floor(block.lines ?? 1))
  return createNewline(lines).map(element => ({
    ...element,
    extension: createTemplateExtension(ctx, { blockType: block.type })
  }))
}

export function compileTemplateBlock(
  ctx: ITemplateContext,
  block: ITemplateBlock
): IElement[] {
  switch (block.type) {
    case 'paragraph':
      return compileParagraphBlock(ctx, block)
    case 'fieldRow':
      return compileFieldRowBlock(ctx, block)
    case 'group':
      return compileGroupBlock(ctx, block)
    case 'section':
      return compileSectionBlock(ctx, block)
    case 'separator':
      return compileSeparatorBlock(ctx, block)
    case 'spacer':
      return compileSpacerBlock(ctx, block)
    case 'table':
      return compileTableBlock(ctx, block)
    case 'staticText':
      return compileStaticTextBlock(ctx, block)
  }
  return []
}

export function buildFieldIndex(schema: ITemplateSchema): Map<string, ITemplateField> {
  const index = new Map<string, ITemplateField>()

  function walkBlocks(blocks: ITemplateBlock[]) {
    for (const block of blocks) {
      if (block.type === 'fieldRow') {
        for (const field of block.fields) index.set(field.id, field)
      } else if (block.type === 'paragraph') {
        for (const seg of block.segments) {
          if (seg.type === 'field') index.set(seg.field.id, seg.field)
        }
      } else if (block.type === 'section') {
        walkBlocks(block.blocks)
      } else if (block.type === 'group') {
        walkBlocks(block.blocks)
      } else if (block.type === 'table') {
        for (const col of block.columns) {
          if (col.field) index.set(col.field.id, col.field)
        }
      }
    }
  }

  walkBlocks([...(schema.header ?? []), ...schema.blocks, ...(schema.footer ?? [])])
  return index
}

export interface ISchemaValidationError {
  code: 'duplicate_field_id' | 'dangling_condition_field'
  fieldId: string
  message: string
  ruleIndex?: number
}

export function validateSchema(schema: ITemplateSchema): ISchemaValidationError[] {
  const errors: ISchemaValidationError[] = []
  const fieldIndex = buildFieldIndex(schema)
  const seen = new Set<string>()

  function checkBlock(block: ITemplateBlock) {
    if (block.type === 'fieldRow') {
      for (const field of block.fields) {
        if (seen.has(field.id)) {
          errors.push({ code: 'duplicate_field_id', fieldId: field.id, message: `字段 ID 重复: "${field.id}"` })
        }
        seen.add(field.id)
      }
    } else if (block.type === 'paragraph') {
      for (const seg of block.segments) {
        if (seg.type === 'field') {
          if (seen.has(seg.field.id)) {
            errors.push({ code: 'duplicate_field_id', fieldId: seg.field.id, message: `字段 ID 重复: "${seg.field.id}"` })
          }
          seen.add(seg.field.id)
        }
      }
    } else if (block.type === 'section') {
      for (const child of block.blocks) checkBlock(child)
    } else if (block.type === 'group') {
      for (const child of block.blocks) checkBlock(child)
    } else if (block.type === 'table') {
      for (const col of block.columns) {
        if (col.field) {
          if (seen.has(col.field.id)) {
            errors.push({ code: 'duplicate_field_id', fieldId: col.field.id, message: `字段 ID 重复: "${col.field.id}"` })
          }
          seen.add(col.field.id)
        }
      }
    }
  }

  for (const block of [...(schema.header ?? []), ...schema.blocks, ...(schema.footer ?? [])]) {
    checkBlock(block)
  }

  for (const [fieldId, field] of fieldIndex.entries()) {
    if (!field.rules) continue
    field.rules.forEach((rule, i) => {
      if (rule.condition && !fieldIndex.has(rule.condition.field)) {
        errors.push({
          code: 'dangling_condition_field',
          fieldId,
          message: `字段 "${fieldId}" 规则 ${i + 1} 引用了不存在的字段 "${rule.condition.field}"`,
          ruleIndex: i
        })
      }
    })
  }

  return errors
}

export interface IPageConfig {
  width: number
  height: number
  orientation: 'portrait' | 'landscape'
  margins: [number, number, number, number]
}

export function getPageConfig(schema: ITemplateSchema): IPageConfig {
  const layout = schema.layout ?? {}
  const orientation = layout.orientation ?? 'portrait'
  const preset = layout.pageSize ? PAGE_SIZE_PRESETS[layout.pageSize] : PAGE_SIZE_PRESETS.A4
  const isLandscape = orientation === 'landscape'
  return {
    width: isLandscape ? preset.height : preset.width,
    height: isLandscape ? preset.width : preset.height,
    orientation,
    margins: layout.margins ?? [100, 120, 100, 120]
  }
}

export function compileTemplate(
  schema: ITemplateSchema,
  options: {
    headerRowFlex?: RowFlex
    footerRowFlex?: RowFlex
    runtime?: ITemplateRuntimeValues
  } = {}
): IEditorData {
  const ctx: ITemplateContext = {
    schema,
    layout: {
      ...DEFAULT_LAYOUT,
      ...schema.layout
    },
    runtime: {
      printTime: options.runtime?.printTime,
      operatorName: options.runtime?.operatorName || schema.layout?.footerRuntime?.operatorName
    }
  }
  const header = (schema.header || []).reduce<IElement[]>((elementList, block) => {
    appendCompiledBlock(elementList, compileTemplateBlock(ctx, block))
    return elementList
  }, [])
  const main = schema.blocks.reduce<IElement[]>((elementList, block) => {
    appendCompiledBlock(elementList, compileTemplateBlock(ctx, block))
    return elementList
  }, [])
  const footer = (schema.footer || []).reduce<IElement[]>((elementList, block) => {
    appendCompiledBlock(elementList, compileTemplateBlock(ctx, block))
    return elementList
  }, [])
  if (header.length && options.headerRowFlex) {
    header.forEach(element => {
      if (element.value !== '\n') {
        element.rowFlex = options.headerRowFlex
      }
    })
  }
  if (footer.length && options.footerRowFlex) {
    footer.forEach(element => {
      if (element.value !== '\n') {
        element.rowFlex = options.footerRowFlex
      }
    })
  }
  const defaultFont = ctx.layout.defaultFont
  const defaultFontSize = ctx.layout.defaultFontSize
  if (defaultFont || defaultFontSize) {
    const applyFontDefaults = (elements: IElement[]) => {
      for (const el of elements) {
        if (el.value === '\n') continue
        if (defaultFont && !el.font) el.font = defaultFont
        if (defaultFontSize && !el.size) el.size = defaultFontSize
        if (el.type === ElementType.TABLE && el.trList) {
          for (const tr of el.trList) {
            for (const td of tr.tdList ?? []) {
              applyFontDefaults(td.value ?? [])
            }
          }
        }
      }
    }
    applyFontDefaults(header)
    applyFontDefaults(main)
    applyFontDefaults(footer)
  }
  return {
    header,
    main,
    footer
  }
}
