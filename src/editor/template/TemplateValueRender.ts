import { ZERO } from '../dataset/constant/Common'
import { ListStyle, ListType } from '../dataset/enum/List'
import type { IElement } from '../interface/Element'
import { getUUID } from '../utils'
import type { ITemplateField } from './index'

export type TemplateRenderableValue = string | IElement[] | null

const LIST_RENDER_FIELD_TYPES = new Set<ITemplateField['type']>([
  'text',
  'textarea'
])

function isElementArray(value: unknown): value is IElement[] {
  if (!Array.isArray(value) || !value.length) return false
  return value.every(
    item => typeof item === 'object' && item !== null && 'value' in item
  )
}

function getListType(field: ITemplateField): ListType {
  return field.valueRender?.listType ?? ListType.UL
}

function getListStyle(
  field: ITemplateField,
  listType = getListType(field)
): ListStyle {
  const style = field.valueRender?.listStyle
  if (listType === ListType.OL) {
    return style === ListStyle.DECIMAL ? style : ListStyle.DECIMAL
  }
  if (
    style === ListStyle.DISC ||
    style === ListStyle.CIRCLE ||
    style === ListStyle.SQUARE
  ) {
    return style
  }
  return ListStyle.DISC
}

function sanitizeStringArray(value: string[]): string[] {
  return value
    .map(item => item == null ? '' : String(item))
    .filter(item => item.length > 0)
}

function createListItemValue(field: ITemplateField, value: string): IElement {
  return {
    value,
    font: field.style?.font,
    size: field.style?.size,
    bold: field.style?.bold,
    highlight: field.style?.highlight,
    italic: field.style?.italic,
    strikeout: field.style?.strikeout,
    rowFlex: field.style?.rowFlex
  }
}

function createListValueElements(
  field: ITemplateField,
  items: string[],
  listType: ListType,
  listStyle: ListStyle
): IElement[] {
  const listId = getUUID()
  const elementList: IElement[] = []

  items.forEach(item => {
    elementList.push({
      value: ZERO,
      listId,
      listType,
      listStyle
    })
    elementList.push({
      ...createListItemValue(field, item),
      listId,
      listType,
      listStyle
    })
  })

  return elementList
}

export function normalizeTemplateFieldValue(
  field: ITemplateField,
  value: string | string[] | IElement[] | null | undefined
): TemplateRenderableValue {
  if (value == null) return null
  if (isElementArray(value)) return value.length ? value : null
  if (!Array.isArray(value)) return value

  const items = sanitizeStringArray(value)
  if (!items.length) return null

  if (
    field.valueRender?.mode === 'list' &&
    LIST_RENDER_FIELD_TYPES.has(field.type)
  ) {
    const listType = getListType(field)
    const listStyle = getListStyle(field, listType)
    return createListValueElements(field, items, listType, listStyle)
  }

  return items.join('、')
}