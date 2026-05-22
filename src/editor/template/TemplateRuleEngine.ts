import type { Editor } from '../index'
import type { ITemplateSchema, ITemplateRule, ITemplateCondition, ITemplateField } from './index'
import type { ISetControlProperties } from '../interface/Control'

function evaluateCondition(
  condition: ITemplateCondition,
  values: Map<string, string | null>
): boolean {
  const actual = values.get(condition.field) ?? ''
  const expected = condition.value
  switch (condition.operator) {
    case 'equals':
      return actual === expected
    case 'notEquals':
      return actual !== expected
    case 'includes':
      return Array.isArray(expected)
        ? expected.some(v => actual.includes(v))
        : actual.includes(String(expected))
    case 'notIncludes':
      return Array.isArray(expected)
        ? expected.every(v => !actual.includes(v))
        : !actual.includes(String(expected))
    default:
      return false
  }
}

function evaluateRule(
  rule: ITemplateRule,
  values: Map<string, string | null>
): boolean {
  if (!rule.condition) return true
  return evaluateCondition(rule.condition, values)
}

interface FieldInfo {
  field: ITemplateField
  blockId?: string
}

function collectFieldInfos(schema: ITemplateSchema): FieldInfo[] {
  const infos: FieldInfo[] = []

  function walkBlocks(blocks: typeof schema.blocks, blockId?: string) {
    for (const block of blocks) {
      if (block.type === 'fieldRow') {
        for (const field of block.fields) infos.push({ field, blockId })
      } else if (block.type === 'paragraph') {
        for (const seg of block.segments) {
          if (seg.type === 'field') infos.push({ field: seg.field, blockId })
        }
      } else if (block.type === 'section') {
        const childId = block.id ?? blockId
        walkBlocks(block.blocks, childId)
      } else if (block.type === 'group') {
        const childId = block.id ?? blockId
        walkBlocks(block.blocks, childId)
      } else if (block.type === 'table') {
        for (const col of block.columns) {
          if (col.field) infos.push({ field: col.field, blockId })
        }
      }
    }
  }

  const allZones = [
    ...(schema.header ?? []),
    ...schema.blocks,
    ...(schema.footer ?? [])
  ]
  walkBlocks(allZones)
  return infos
}

function collectBlockRules(schema: ITemplateSchema): Map<string, ITemplateRule[]> {
  const map = new Map<string, ITemplateRule[]>()

  function walkBlocks(blocks: typeof schema.blocks) {
    for (const block of blocks) {
      if ((block.type === 'section' || block.type === 'group') && block.id && block.rules?.length) {
        map.set(block.id, block.rules)
      }
      if (block.type === 'section' || block.type === 'group') {
        walkBlocks(block.blocks)
      }
    }
  }

  const allZones = [...(schema.header ?? []), ...schema.blocks, ...(schema.footer ?? [])]
  walkBlocks(allZones)
  return map
}

export class TemplateRuleEngine {
  private editor: Editor
  private fieldInfos: FieldInfo[]
  private blockRules: Map<string, ITemplateRule[]>
  private businessCodeToFieldId: Map<string, string>
  private _handler: () => void

  constructor(editor: Editor, schema: ITemplateSchema) {
    this.editor = editor
    this.fieldInfos = collectFieldInfos(schema)
    this.blockRules = collectBlockRules(schema)
    this.businessCodeToFieldId = new Map(
      this.fieldInfos
        .filter(i => i.field.metadata?.businessCode)
        .map(i => [i.field.metadata!.businessCode!, i.field.id])
    )
    this._handler = () => this._evaluate()
    this._subscribe()
    setTimeout(this._handler, 0)
  }

  private _subscribe() {
    this.editor.eventBus.on('controlContentChange', this._handler)
  }

  private _getFieldValues(): Map<string, string | null> {
    const map = new Map<string, string | null>()
    for (const { field } of this.fieldInfos) {
      const result = this.editor.command.getControlValue({ conceptId: field.id })
      const value = result?.[0]?.value ?? null
      map.set(field.id, value)
      if (field.metadata?.businessCode) {
        map.set(field.metadata.businessCode, value)
      }
    }
    return map
  }

  private _evaluate() {
    const values = this._getFieldValues()
    const updates: ISetControlProperties[] = []

    // Field-level rules
    for (const { field } of this.fieldInfos) {
      if (!field.rules?.length) continue

      const visibilityRules = field.rules.filter(r => r.type === 'visibility')
      const readonlyRules = field.rules.filter(r => r.type === 'readonly' && r.condition)
      const hiddenRules = field.rules.filter(r => r.type === 'hidden' && r.condition)

      const props: Partial<ISetControlProperties['properties']> = {}
      let hasUpdate = false

      if (visibilityRules.length > 0) {
        const visible = visibilityRules.some(r => evaluateRule(r, values))
        props.hide = !visible
        hasUpdate = true
      }

      if (hiddenRules.length > 0) {
        const hidden = hiddenRules.some(r => evaluateRule(r, values))
        props.hide = hidden
        hasUpdate = true
      }

      if (readonlyRules.length > 0) {
        const readonly = readonlyRules.some(r => evaluateRule(r, values))
        props.disabled = readonly
        hasUpdate = true
      }

      if (hasUpdate) {
        updates.push({ conceptId: field.id, properties: props })
      }
    }

    // Block-level rules — apply hide/show to all fields within the block
    for (const [blockId, blockRules] of this.blockRules.entries()) {
      const fieldIds = this.fieldInfos
        .filter(i => i.blockId === blockId)
        .map(i => i.field.id)

      if (fieldIds.length === 0) continue

      const visibilityRules = blockRules.filter(r => r.type === 'visibility')
      const hiddenRules = blockRules.filter(r => r.type === 'hidden' && r.condition)

      let hide: boolean | undefined

      if (visibilityRules.length > 0) {
        hide = !visibilityRules.some(r => evaluateRule(r, values))
      }

      if (hiddenRules.length > 0) {
        hide = hiddenRules.some(r => evaluateRule(r, values))
      }

      if (hide !== undefined) {
        for (const conceptId of fieldIds) {
          const existing = updates.find(u => u.conceptId === conceptId)
          if (existing) {
            existing.properties.hide = hide
          } else {
            updates.push({ conceptId, properties: { hide } })
          }
        }
      }
    }

    if (updates.length > 0) {
      this.editor.command.executeSetControlPropertiesList(updates)
    }

    this._applyCascadeRules(values)
  }

  private _applyCascadeRules(values: Map<string, string | null>) {
    for (const { field } of this.fieldInfos) {
      if (!field.rules?.length) continue
      const cascadeRules = field.rules.filter(r => r.type === 'cascade' && r.cascade)
      if (cascadeRules.length === 0) continue

      const currentValue = values.get(field.id) ?? ''

      for (const rule of cascadeRules) {
        const { cascade } = rule
        if (!cascade) continue

        const targetFieldId = cascade.targetFieldType === 'businessCode'
          ? (this.businessCodeToFieldId.get(cascade.targetField) ?? cascade.targetField)
          : cascade.targetField

        if (cascade.optionMap && cascade.optionMap[currentValue] !== undefined) {
          const newOptions = cascade.optionMap[currentValue]
          const valueSets = newOptions.map(opt => ({
            value: opt.value || opt.label,
            code: opt.code || opt.value || opt.label
          }))
          this.editor.command.executeSetControlPropertiesList([
            { conceptId: targetFieldId, properties: { valueSets } }
          ])
        }

        if (cascade.valueMap && cascade.valueMap[currentValue] !== undefined) {
          const newValue = cascade.valueMap[currentValue]
          this.editor.command.executeSetControlValueList([{
            conceptId: targetFieldId,
            value: newValue
          }])
        }
      }
    }
  }

  evaluate() {
    this._evaluate()
  }

  dispose() {
    this.editor.eventBus.off('controlContentChange', this._handler)
  }
}
