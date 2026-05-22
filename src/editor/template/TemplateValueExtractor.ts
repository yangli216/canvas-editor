import type { Editor } from '../index'
import type { ITemplateSchema, ITemplateField } from './index'
import { buildFieldIndex } from './index'

export interface ITemplateFieldValue {
  fieldId: string
  fieldType: ITemplateField['type']
  label?: string
  value: string | null
}

export interface IValidationError {
  fieldId: string
  label?: string
  message: string
}

export interface ITemplateExtractResult {
  values: ITemplateFieldValue[]
  errors: IValidationError[]
  isValid: boolean
  toRecord(): Record<string, string | null>
}

export function extractTemplateValues(
  editor: Editor,
  schema: ITemplateSchema
): ITemplateExtractResult {
  const fields = Array.from(buildFieldIndex(schema).values())
  const values: ITemplateFieldValue[] = []
  const errors: IValidationError[] = []

  for (const field of fields) {
    const result = editor.command.getControlValue({ conceptId: field.id })
    const raw = result?.[0]?.value ?? null
    values.push({
      fieldId: field.id,
      fieldType: field.type,
      label: field.label,
      value: raw
    })

    const isEmpty = raw == null || raw.trim() === ''
    if (field.required && isEmpty) {
      errors.push({
        fieldId: field.id,
        label: field.label,
        message: field.label ? `${field.label}不能为空` : `字段 ${field.id} 不能为空`
      })
    }
  }

  return {
    values,
    errors,
    isValid: errors.length === 0,
    toRecord() {
      return Object.fromEntries(values.map(v => [v.fieldId, v.value]))
    }
  }
}

export function validateTemplateForm(
  editor: Editor,
  schema: ITemplateSchema
): IValidationError[] {
  return extractTemplateValues(editor, schema).errors
}
