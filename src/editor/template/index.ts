import { FlexDirection } from '../dataset/enum/Common'
import { ControlType } from '../dataset/enum/Control'
import { ElementType } from '../dataset/enum/Element'
import { RowFlex } from '../dataset/enum/Row'
import { TitleLevel } from '../dataset/enum/Title'
import type { IControl, IValueSet } from '../interface/Control'
import type { IEditorData } from '../interface/Editor'
import type { IElement } from '../interface/Element'

export type TemplateFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'radio'
  | 'checkbox'

export type TemplateRuleType = 'required' | 'readonly' | 'hidden' | 'visibility'

export type TemplateConditionOperator =
  | 'equals'
  | 'notEquals'
  | 'includes'
  | 'notIncludes'

export interface ITemplateCondition {
  field: string
  operator: TemplateConditionOperator
  value: string | string[]
}

export interface ITemplateRule {
  type: TemplateRuleType
  condition?: ITemplateCondition
  message?: string
}

export interface ITemplateOption {
  label: string
  value?: string
  code?: string
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
  lineBreak?: boolean
}

export interface ITemplateFieldRowBlock {
  type: 'fieldRow'
  fields: ITemplateField[]
  separator?: string
  lineBreak?: boolean
}

export interface ITemplateGroupBlock {
  type: 'group'
  direction?: 'row' | 'column'
  blocks: ITemplateBlock[]
  separator?: string
}

export interface ITemplateSectionBlock {
  type: 'section'
  title: string
  level?: TitleLevel
  blocks: ITemplateBlock[]
}

export interface ITemplateSeparatorBlock {
  type: 'separator'
  dashArray?: number[]
  lineWidth?: number
}

export type ITemplateBlock =
  | ITemplateParagraphBlock
  | ITemplateFieldRowBlock
  | ITemplateGroupBlock
  | ITemplateSectionBlock
  | ITemplateSeparatorBlock

export interface ITemplateLayout {
  labelSuffix?: string
  fieldSeparator?: string
  sectionSpacing?: number
  defaultControlWidth?: number
  textareaWidth?: number
  titleStyle?: Partial<IElement>
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
    | 'defaultControlWidth'
    | 'textareaWidth'
  >
> = {
  labelSuffix: '：',
  fieldSeparator: '    ',
  sectionSpacing: 1,
  defaultControlWidth: 140,
  textareaWidth: 320
}

interface ITemplateContext {
  schema: ITemplateSchema
  layout: ITemplateLayout & typeof DEFAULT_LAYOUT
}

interface ITemplateExtension {
  template: {
    schemaId: string
    schemaName: string
    blockType?: ITemplateBlock['type']
    fieldId?: string
    fieldType?: TemplateFieldType
    rules?: ITemplateRule[]
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

function createNewline(count = 1): IElement[] {
  return Array.from({ length: count }, () => ({ value: '\n' }))
}

function createTitleElement(
  ctx: ITemplateContext,
  block: ITemplateSectionBlock
): IElement {
  return {
    type: ElementType.TITLE,
    value: '',
    level: block.level || TitleLevel.FIRST,
    valueList: [
      {
        value: block.title,
        ...ctx.layout.titleStyle
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
  const content = Array.isArray(value) ? value.join('、') : value
  return content
    ? [
        {
          value: content
        }
      ]
    : null
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

function createControlElement(
  ctx: ITemplateContext,
  field: ITemplateField,
  blockType: ITemplateBlock['type']
): IElement {
  const isTextLike = field.type === 'text' || field.type === 'textarea'
  const controlType = mapFieldTypeToControlType(field.type)
  const rules = [
    ...(field.required ? [{ type: 'required' as const }] : []),
    ...(field.readonly ? [{ type: 'readonly' as const }] : []),
    ...(field.hidden ? [{ type: 'hidden' as const }] : []),
    ...(field.rules || [])
  ]
  const control: IControl = {
    type: controlType,
    value: createControlValue(field.defaultValue),
    conceptId: field.id,
    placeholder: field.placeholder,
    prefix: field.prefix,
    postfix: field.postfix,
    preText: field.preText,
    postText: field.postText,
    minWidth:
      field.width ||
      field.style?.minWidth ||
      (field.type === 'textarea'
        ? ctx.layout.textareaWidth
        : ctx.layout.defaultControlWidth),
    underline:
      field.underline ??
      (isTextLike || field.type === 'date' || field.type === 'number'),
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
      createTextElement(
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
          segment.value,
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
  return elementList
}

function compileFieldRowBlock(
  ctx: ITemplateContext,
  block: ITemplateFieldRowBlock
): IElement[] {
  const separator = block.separator ?? ctx.layout.fieldSeparator
  const elementList: IElement[] = []
  block.fields.forEach((field, index) => {
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
  return elementList
}

function compileGroupBlock(
  ctx: ITemplateContext,
  block: ITemplateGroupBlock
): IElement[] {
  const elementList: IElement[] = []
  block.blocks.forEach((child, index) => {
    if (block.direction === 'row' && index > 0 && block.separator) {
      elementList.push(
        createTextElement(
          block.separator,
          {},
          createTemplateExtension(ctx, {
            blockType: block.type
          })
        )
      )
    }
    elementList.push(...compileTemplateBlock(ctx, child))
    if (block.direction === 'column' && index < block.blocks.length - 1) {
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
  const elementList: IElement[] = [createTitleElement(ctx, block), ...createNewline()]
  for (const child of block.blocks) {
    elementList.push(...compileTemplateBlock(ctx, child))
  }
  elementList.push(...createNewline(ctx.layout.sectionSpacing))
  return elementList
}

function compileSeparatorBlock(
  ctx: ITemplateContext,
  block: ITemplateSeparatorBlock
): IElement[] {
  return [
    {
      type: ElementType.SEPARATOR,
      value: '\n',
      dashArray: block.dashArray,
      lineWidth: block.lineWidth,
      extension: createTemplateExtension(ctx, {
        blockType: block.type
      })
    }
  ]
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
  }
  return []
}

export function compileTemplate(
  schema: ITemplateSchema,
  options: {
    headerRowFlex?: RowFlex
    footerRowFlex?: RowFlex
  } = {}
): IEditorData {
  const ctx: ITemplateContext = {
    schema,
    layout: {
      ...DEFAULT_LAYOUT,
      ...schema.layout
    }
  }
  const header = (schema.header || []).flatMap(block => compileTemplateBlock(ctx, block))
  const main = schema.blocks.flatMap(block => compileTemplateBlock(ctx, block))
  const footer = (schema.footer || []).flatMap(block => compileTemplateBlock(ctx, block))
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
  return {
    header,
    main,
    footer
  }
}
