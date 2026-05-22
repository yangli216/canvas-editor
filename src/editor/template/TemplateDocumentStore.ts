import type { TemplatePublishStatus } from './TemplateRegistry'
import type { ITemplateField, ITemplateSchema } from './index'
import { buildFieldIndex } from './index'

export type TemplateDocumentStatus = 'draft' | 'completed' | 'archived'
export type TemplateDocumentMigrationMatchMode = 'fieldId' | 'businessCode' | 'exportPath'

export interface ITemplateDocumentTemplateBinding {
  id: string
  version: string
  name: string
  status?: TemplatePublishStatus
  boundAt: number
  snapshot: ITemplateSchema
}

export interface ITemplateDocumentContent {
  flatValues: Record<string, string | null>
  structuredValues?: Record<string, unknown>
  editorState?: unknown
}

export interface ITemplateDocumentMigrationMapping {
  fromFieldId: string
  toFieldId: string
  matchBy: TemplateDocumentMigrationMatchMode
}

export interface ITemplateDocumentMigrationFieldIssue {
  fieldId: string
  label?: string
  reason: 'required' | 'ambiguous'
  candidateFieldIds?: string[]
}

export interface ITemplateDocumentDroppedField {
  fieldId: string
  label?: string
  value: string | null
}

export interface ITemplateDocumentEmptyField {
  fieldId: string
  label?: string
  required: boolean
}

export interface ITemplateDocumentMigrationPlan {
  fromTemplateId: string
  fromTemplateVersion: string
  toTemplateId: string
  toTemplateVersion: string
  nextValues: Record<string, string | null>
  mappings: ITemplateDocumentMigrationMapping[]
  unresolvedFields: ITemplateDocumentMigrationFieldIssue[]
  droppedFields: ITemplateDocumentDroppedField[]
  emptyFields: ITemplateDocumentEmptyField[]
}

export interface ITemplateDocumentMigrationRecord {
  migratedAt: number
  fromTemplateVersion: string
  toTemplateVersion: string
  note?: string
  mappings: ITemplateDocumentMigrationMapping[]
  unresolvedFieldIds: string[]
  droppedFieldIds: string[]
}

export interface ITemplateDocumentRecord {
  id: string
  patientId?: string
  encounterId?: string
  title?: string
  status: TemplateDocumentStatus
  createdAt: number
  updatedAt: number
  template: ITemplateDocumentTemplateBinding
  content: ITemplateDocumentContent
  migrationHistory: ITemplateDocumentMigrationRecord[]
}

export interface ICreateTemplateDocumentOptions {
  id?: string
  title?: string
  patientId?: string
  encounterId?: string
  status?: TemplateDocumentStatus
  templateStatus?: TemplatePublishStatus
  schema: ITemplateSchema
  flatValues?: Record<string, string | null>
  structuredValues?: Record<string, unknown>
  editorState?: unknown
}

export interface ITemplateDocumentMigrationOptions {
  note?: string
  allowPartial?: boolean
  templateStatus?: TemplatePublishStatus
}

export interface ITemplateDocumentMigrationResult {
  applied: boolean
  reason?: 'required_fields_missing'
  plan: ITemplateDocumentMigrationPlan
  document?: ITemplateDocumentRecord
}

const STORAGE_KEY = 'canvas-editor:template-documents'

function cloneSchema(schema: ITemplateSchema): ITemplateSchema {
  return JSON.parse(JSON.stringify(schema)) as ITemplateSchema
}

function cloneRecord(record: ITemplateDocumentRecord): ITemplateDocumentRecord {
  return JSON.parse(JSON.stringify(record)) as ITemplateDocumentRecord
}

function createDocumentId() {
  return `template-document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function hasValue(value: string | null | undefined) {
  return value != null && value !== ''
}

function getFieldMatchKey(
  field: ITemplateField,
  matchBy: Exclude<TemplateDocumentMigrationMatchMode, 'fieldId'>
) {
  if (matchBy === 'businessCode') return field.metadata?.businessCode
  return field.metadata?.exportPath
}

function collectCandidates(
  sourceFields: ITemplateField[],
  targetField: ITemplateField,
  matchBy: Exclude<TemplateDocumentMigrationMatchMode, 'fieldId'>,
  usedSourceIds: Set<string>
) {
  const targetKey = getFieldMatchKey(targetField, matchBy)
  if (!targetKey) return []
  return sourceFields.filter(field => {
    if (usedSourceIds.has(field.id)) return false
    if (field.type !== targetField.type) return false
    return getFieldMatchKey(field, matchBy) === targetKey
  })
}

export function analyzeTemplateDocumentMigration(
  previousSchema: ITemplateSchema,
  nextSchema: ITemplateSchema,
  previousValues: Record<string, string | null>
): ITemplateDocumentMigrationPlan {
  const previousFieldIndex = buildFieldIndex(previousSchema)
  const nextFieldIndex = buildFieldIndex(nextSchema)
  const previousFields = Array.from(previousFieldIndex.values())
  const usedSourceIds = new Set<string>()
  const nextValues: Record<string, string | null> = {}
  const mappings: ITemplateDocumentMigrationMapping[] = []
  const unresolvedFields: ITemplateDocumentMigrationFieldIssue[] = []
  const emptyFields: ITemplateDocumentEmptyField[] = []

  nextFieldIndex.forEach(targetField => {
    const directMatch = previousFieldIndex.get(targetField.id)
    if (directMatch && directMatch.type === targetField.type) {
      usedSourceIds.add(directMatch.id)
      if (Object.prototype.hasOwnProperty.call(previousValues, directMatch.id)) {
        nextValues[targetField.id] = previousValues[directMatch.id] ?? null
      }
      mappings.push({
        fromFieldId: directMatch.id,
        toFieldId: targetField.id,
        matchBy: 'fieldId'
      })
      return
    }

    const businessMatches = collectCandidates(
      previousFields,
      targetField,
      'businessCode',
      usedSourceIds
    )
    if (businessMatches.length === 1) {
      const sourceField = businessMatches[0]
      usedSourceIds.add(sourceField.id)
      if (Object.prototype.hasOwnProperty.call(previousValues, sourceField.id)) {
        nextValues[targetField.id] = previousValues[sourceField.id] ?? null
      }
      mappings.push({
        fromFieldId: sourceField.id,
        toFieldId: targetField.id,
        matchBy: 'businessCode'
      })
      return
    }
    if (businessMatches.length > 1) {
      unresolvedFields.push({
        fieldId: targetField.id,
        label: targetField.label,
        reason: 'ambiguous',
        candidateFieldIds: businessMatches.map(field => field.id)
      })
      emptyFields.push({
        fieldId: targetField.id,
        label: targetField.label,
        required: !!targetField.required
      })
      return
    }

    const exportPathMatches = collectCandidates(
      previousFields,
      targetField,
      'exportPath',
      usedSourceIds
    )
    if (exportPathMatches.length === 1) {
      const sourceField = exportPathMatches[0]
      usedSourceIds.add(sourceField.id)
      if (Object.prototype.hasOwnProperty.call(previousValues, sourceField.id)) {
        nextValues[targetField.id] = previousValues[sourceField.id] ?? null
      }
      mappings.push({
        fromFieldId: sourceField.id,
        toFieldId: targetField.id,
        matchBy: 'exportPath'
      })
      return
    }
    if (exportPathMatches.length > 1) {
      unresolvedFields.push({
        fieldId: targetField.id,
        label: targetField.label,
        reason: 'ambiguous',
        candidateFieldIds: exportPathMatches.map(field => field.id)
      })
      emptyFields.push({
        fieldId: targetField.id,
        label: targetField.label,
        required: !!targetField.required
      })
      return
    }

    if (targetField.required) {
      unresolvedFields.push({
        fieldId: targetField.id,
        label: targetField.label,
        reason: 'required'
      })
    }
    emptyFields.push({
      fieldId: targetField.id,
      label: targetField.label,
      required: !!targetField.required
    })
  })

  const droppedFields = Array.from(previousFieldIndex.values())
    .filter(field => usedSourceIds.has(field.id) === false && hasValue(previousValues[field.id]))
    .map(field => ({
      fieldId: field.id,
      label: field.label,
      value: previousValues[field.id] ?? null
    }))

  return {
    fromTemplateId: previousSchema.id,
    fromTemplateVersion: previousSchema.version,
    toTemplateId: nextSchema.id,
    toTemplateVersion: nextSchema.version,
    nextValues,
    mappings,
    unresolvedFields,
    droppedFields,
    emptyFields
  }
}

export class TemplateDocumentStore {
  private readonly storageKey: string
  private records = new Map<string, ITemplateDocumentRecord>()

  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey
    this.loadFromStorage()
  }

  create(options: ICreateTemplateDocumentOptions): ITemplateDocumentRecord {
    const now = Date.now()
    const record: ITemplateDocumentRecord = {
      id: options.id ?? createDocumentId(),
      patientId: options.patientId,
      encounterId: options.encounterId,
      title: options.title ?? options.schema.name,
      status: options.status ?? 'draft',
      createdAt: now,
      updatedAt: now,
      template: {
        id: options.schema.id,
        version: options.schema.version,
        name: options.schema.name,
        status: options.templateStatus,
        boundAt: now,
        snapshot: cloneSchema(options.schema)
      },
      content: {
        flatValues: { ...(options.flatValues ?? {}) },
        structuredValues: options.structuredValues
          ? JSON.parse(JSON.stringify(options.structuredValues))
          : undefined,
        editorState: options.editorState
          ? JSON.parse(JSON.stringify(options.editorState))
          : undefined
      },
      migrationHistory: []
    }
    this.records.set(record.id, record)
    this._persist()
    return cloneRecord(record)
  }

  get(id: string): ITemplateDocumentRecord | undefined {
    const record = this.records.get(id)
    return record ? cloneRecord(record) : undefined
  }

  list(): ITemplateDocumentRecord[] {
    return Array.from(this.records.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(record => cloneRecord(record))
  }

  save(record: ITemplateDocumentRecord): ITemplateDocumentRecord {
    const nextRecord = cloneRecord(record)
    nextRecord.updatedAt = Date.now()
    this.records.set(nextRecord.id, nextRecord)
    this._persist()
    return cloneRecord(nextRecord)
  }

  delete(id: string): boolean {
    const deleted = this.records.delete(id)
    if (deleted) this._persist()
    return deleted
  }

  migrate(
    id: string,
    nextSchema: ITemplateSchema,
    options: ITemplateDocumentMigrationOptions = {}
  ): ITemplateDocumentMigrationResult | null {
    const current = this.records.get(id)
    if (!current) return null

    const plan = analyzeTemplateDocumentMigration(
      current.template.snapshot,
      nextSchema,
      current.content.flatValues
    )
    if (!options.allowPartial && plan.unresolvedFields.some(item => item.reason === 'required')) {
      return {
        applied: false,
        reason: 'required_fields_missing',
        plan
      }
    }

    const now = Date.now()
    const migrated: ITemplateDocumentRecord = {
      ...current,
      updatedAt: now,
      template: {
        id: nextSchema.id,
        version: nextSchema.version,
        name: nextSchema.name,
        status: options.templateStatus,
        boundAt: now,
        snapshot: cloneSchema(nextSchema)
      },
      content: {
        ...current.content,
        flatValues: { ...plan.nextValues }
      },
      migrationHistory: [
        ...current.migrationHistory,
        {
          migratedAt: now,
          fromTemplateVersion: plan.fromTemplateVersion,
          toTemplateVersion: plan.toTemplateVersion,
          note: options.note,
          mappings: plan.mappings,
          unresolvedFieldIds: plan.unresolvedFields.map(item => item.fieldId),
          droppedFieldIds: plan.droppedFields.map(item => item.fieldId)
        }
      ]
    }
    this.records.set(id, migrated)
    this._persist()
    return {
      applied: true,
      plan,
      document: cloneRecord(migrated)
    }
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) return
      const stored = JSON.parse(raw) as ITemplateDocumentRecord[]
      this.records.clear()
      stored.forEach(record => {
        this.records.set(record.id, cloneRecord(record))
      })
    } catch {
      this.records.clear()
    }
  }

  clear() {
    this.records.clear()
    localStorage.removeItem(this.storageKey)
  }

  private _persist() {
    localStorage.setItem(this.storageKey, JSON.stringify(Array.from(this.records.values())))
  }
}