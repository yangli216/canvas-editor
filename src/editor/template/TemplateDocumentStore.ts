import type { TemplatePublishStatus } from './TemplateRegistry'
import type { ITemplateField, ITemplateSchema } from './index'
import { buildFieldIndex } from './index'

export type TemplateDocumentStatus = 'draft' | 'completed' | 'signed' | 'archived'
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

export interface ITemplateDocumentLineage {
  sourceDocumentId: string
  sourceTemplateId: string
  sourceTemplateVersion: string
  forkedAt: number
  reason?: string
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
  lineage?: ITemplateDocumentLineage
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
  reason?: 'required_fields_missing' | 'blocked_by_policy'
  message?: string
  plan: ITemplateDocumentMigrationPlan
  document?: ITemplateDocumentRecord
}

export interface ITemplateDocumentWorkflowPolicyDecision {
  allowed: boolean
  reason?: string
  message?: string
}

export interface ITemplateDocumentMigrationPolicyContext {
  currentDocument: ITemplateDocumentRecord
  nextSchema: ITemplateSchema
  plan: ITemplateDocumentMigrationPlan
  preview: ITemplateDocumentMigrationPreview
  options: ITemplateDocumentMigrationOptions
}

export interface ITemplateDocumentStatusTransitionPolicyContext {
  currentDocument: ITemplateDocumentRecord
  previousStatus: TemplateDocumentStatus
  nextStatus: TemplateDocumentStatus
}

export interface ITemplateDocumentStatusTransitionResult {
  applied: boolean
  previousStatus: TemplateDocumentStatus
  nextStatus: TemplateDocumentStatus
  reason?: 'blocked_by_policy'
  message?: string
  document?: ITemplateDocumentRecord
}

export interface ITemplateDocumentWorkflowPolicy {
  beforeMigrate?(
    context: ITemplateDocumentMigrationPolicyContext
  ): ITemplateDocumentWorkflowPolicyDecision | void
  beforeStatusChange?(
    context: ITemplateDocumentStatusTransitionPolicyContext
  ): ITemplateDocumentWorkflowPolicyDecision | void
}

export interface ITemplateDocumentAutosaveInput {
  flatValues?: Record<string, string | null>
  editorState?: unknown
}

export interface ITemplateDocumentAutosavePayload {
  documentId: string
  templateId: string
  templateVersion: string
  updatedAt: number
  flatValues: Record<string, string | null>
  editorState?: unknown
}

export interface ITemplateDocumentPersistenceRecord {
  documentId: string
  patientId?: string
  encounterId?: string
  title?: string
  status: TemplateDocumentStatus
  createdAt: number
  updatedAt: number
  templateId: string
  templateVersion: string
  templateName: string
  templateStatus?: TemplatePublishStatus
  templateBoundAt: number
  templateSnapshot: ITemplateSchema
  flatValues: Record<string, string | null>
  structuredValues?: Record<string, unknown>
  editorState?: unknown
  lineage?: ITemplateDocumentLineage
  migrationHistory: ITemplateDocumentMigrationRecord[]
}

export interface IForkTemplateDocumentOptions {
  id?: string
  title?: string
  status?: TemplateDocumentStatus
  reason?: string
  resetMigrationHistory?: boolean
}

export interface ITemplateDocumentMigrationPreview {
  documentId: string
  currentStatus: TemplateDocumentStatus
  fromTemplateId: string
  fromTemplateVersion: string
  toTemplateId: string
  toTemplateVersion: string
  nextValues: Record<string, string | null>
  mappings: ITemplateDocumentMigrationMapping[]
  unresolvedFields: ITemplateDocumentMigrationFieldIssue[]
  droppedFields: ITemplateDocumentDroppedField[]
  emptyFields: ITemplateDocumentEmptyField[]
  canAutoApply: boolean
  requiresManualConfirmation: boolean
}

export interface ITemplateDocumentStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

const STORAGE_KEY = 'canvas-editor:template-documents'
const memoryStorage = new Map<string, string>()

function getDefaultStorage(): ITemplateDocumentStorageLike {
  const candidate = (globalThis as { window?: { localStorage?: unknown }; localStorage?: unknown }).window?.localStorage
    ?? (globalThis as { localStorage?: unknown }).localStorage
  if (
    candidate
    && typeof candidate === 'object'
    && typeof (candidate as ITemplateDocumentStorageLike).getItem === 'function'
    && typeof (candidate as ITemplateDocumentStorageLike).setItem === 'function'
    && typeof (candidate as ITemplateDocumentStorageLike).removeItem === 'function'
  ) {
    return candidate as ITemplateDocumentStorageLike
  }
  return {
    getItem: key => memoryStorage.get(key) ?? null,
    setItem: (key, value) => {
      memoryStorage.set(key, value)
    },
    removeItem: key => {
      memoryStorage.delete(key)
    }
  }
}

function cloneSchema(schema: ITemplateSchema): ITemplateSchema {
  return JSON.parse(JSON.stringify(schema)) as ITemplateSchema
}

function cloneRecord(record: ITemplateDocumentRecord): ITemplateDocumentRecord {
  return JSON.parse(JSON.stringify(record)) as ITemplateDocumentRecord
}

function cloneUnknown<T>(value: T): T {
  return value == null
    ? value
    : JSON.parse(JSON.stringify(value)) as T
}

function createDocumentId() {
  return `template-document-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function toPersistenceRecord(
  record: ITemplateDocumentRecord
): ITemplateDocumentPersistenceRecord {
  return {
    documentId: record.id,
    patientId: record.patientId,
    encounterId: record.encounterId,
    title: record.title,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    templateId: record.template.id,
    templateVersion: record.template.version,
    templateName: record.template.name,
    templateStatus: record.template.status,
    templateBoundAt: record.template.boundAt,
    templateSnapshot: cloneSchema(record.template.snapshot),
    flatValues: { ...record.content.flatValues },
    structuredValues: cloneUnknown(record.content.structuredValues),
    editorState: cloneUnknown(record.content.editorState),
    lineage: cloneUnknown(record.lineage),
    migrationHistory: cloneUnknown(record.migrationHistory)
  }
}

function fromPersistenceRecord(
  record: ITemplateDocumentPersistenceRecord
): ITemplateDocumentRecord {
  return {
    id: record.documentId,
    patientId: record.patientId,
    encounterId: record.encounterId,
    title: record.title,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    template: {
      id: record.templateId,
      version: record.templateVersion,
      name: record.templateName,
      status: record.templateStatus,
      boundAt: record.templateBoundAt,
      snapshot: cloneSchema(record.templateSnapshot)
    },
    content: {
      flatValues: { ...record.flatValues },
      structuredValues: cloneUnknown(record.structuredValues),
      editorState: cloneUnknown(record.editorState)
    },
    lineage: cloneUnknown(record.lineage),
    migrationHistory: cloneUnknown(record.migrationHistory)
  }
}

function createMigrationPreview(
  document: ITemplateDocumentRecord,
  nextSchema: ITemplateSchema
): ITemplateDocumentMigrationPreview {
  const plan = analyzeTemplateDocumentMigration(
    document.template.snapshot,
    nextSchema,
    document.content.flatValues
  )
  const hasRequiredBlockingIssue = plan.unresolvedFields.some(
    item => item.reason === 'required'
  )

  return {
    documentId: document.id,
    currentStatus: document.status,
    fromTemplateId: plan.fromTemplateId,
    fromTemplateVersion: plan.fromTemplateVersion,
    toTemplateId: plan.toTemplateId,
    toTemplateVersion: plan.toTemplateVersion,
    nextValues: { ...plan.nextValues },
    mappings: cloneUnknown(plan.mappings),
    unresolvedFields: cloneUnknown(plan.unresolvedFields),
    droppedFields: cloneUnknown(plan.droppedFields),
    emptyFields: cloneUnknown(plan.emptyFields),
    canAutoApply: !hasRequiredBlockingIssue,
    requiresManualConfirmation: Boolean(
      plan.unresolvedFields.length || plan.droppedFields.length
    )
  }
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
  private readonly storage: ITemplateDocumentStorageLike
  private readonly workflowPolicy?: ITemplateDocumentWorkflowPolicy
  private records = new Map<string, ITemplateDocumentRecord>()

  constructor(
    storageKey = STORAGE_KEY,
    storage: ITemplateDocumentStorageLike = getDefaultStorage(),
    workflowPolicy?: ITemplateDocumentWorkflowPolicy
  ) {
    this.storageKey = storageKey
    this.storage = storage
    this.workflowPolicy = workflowPolicy
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

  fork(
    id: string,
    options: IForkTemplateDocumentOptions = {}
  ): ITemplateDocumentRecord | null {
    const current = this.records.get(id)
    if (!current) return null

    const now = Date.now()
    const forked: ITemplateDocumentRecord = {
      ...cloneRecord(current),
      id: options.id ?? createDocumentId(),
      title: options.title ?? current.title,
      status: options.status ?? 'draft',
      createdAt: now,
      updatedAt: now,
      template: {
        ...cloneUnknown(current.template),
        boundAt: now
      },
      lineage: {
        sourceDocumentId: current.id,
        sourceTemplateId: current.template.id,
        sourceTemplateVersion: current.template.version,
        forkedAt: now,
        reason: options.reason
      },
      migrationHistory: options.resetMigrationHistory !== false
        ? []
        : cloneUnknown(current.migrationHistory)
    }

    this.records.set(forked.id, forked)
    this._persist()
    return cloneRecord(forked)
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

  autosave(
    id: string,
    content: ITemplateDocumentAutosaveInput
  ): ITemplateDocumentRecord | null {
    const current = this.records.get(id)
    if (!current) return null

    const nextRecord: ITemplateDocumentRecord = {
      ...cloneRecord(current),
      updatedAt: Date.now(),
      content: {
        ...cloneUnknown(current.content),
        ...(content.flatValues ? { flatValues: { ...content.flatValues } } : {}),
        ...(Object.prototype.hasOwnProperty.call(content, 'editorState')
          ? { editorState: cloneUnknown(content.editorState) }
          : {})
      }
    }

    this.records.set(id, nextRecord)
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

    const preview = createMigrationPreview(current, nextSchema)
    const plan: ITemplateDocumentMigrationPlan = {
      fromTemplateId: preview.fromTemplateId,
      fromTemplateVersion: preview.fromTemplateVersion,
      toTemplateId: preview.toTemplateId,
      toTemplateVersion: preview.toTemplateVersion,
      nextValues: { ...preview.nextValues },
      mappings: cloneUnknown(preview.mappings),
      unresolvedFields: cloneUnknown(preview.unresolvedFields),
      droppedFields: cloneUnknown(preview.droppedFields),
      emptyFields: cloneUnknown(preview.emptyFields)
    }
    if (!options.allowPartial && !preview.canAutoApply) {
      return {
        applied: false,
        reason: 'required_fields_missing',
        plan
      }
    }

    const migrationDecision = this.workflowPolicy?.beforeMigrate?.({
      currentDocument: cloneRecord(current),
      nextSchema: cloneSchema(nextSchema),
      plan: cloneUnknown(plan),
      preview: cloneUnknown(preview),
      options: cloneUnknown(options)
    })
    if (migrationDecision?.allowed === false) {
      return {
        applied: false,
        reason: 'blocked_by_policy',
        message: migrationDecision.message ?? migrationDecision.reason,
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

  previewMigration(
    id: string,
    nextSchema: ITemplateSchema
  ): ITemplateDocumentMigrationPreview | null {
    const current = this.records.get(id)
    if (!current) return null
    return createMigrationPreview(current, nextSchema)
  }

  setStatus(
    id: string,
    nextStatus: TemplateDocumentStatus
  ): ITemplateDocumentStatusTransitionResult | null {
    const current = this.records.get(id)
    if (!current) return null

    const previousStatus = current.status
    const statusDecision = this.workflowPolicy?.beforeStatusChange?.({
      currentDocument: cloneRecord(current),
      previousStatus,
      nextStatus
    })
    if (statusDecision?.allowed === false) {
      return {
        applied: false,
        previousStatus,
        nextStatus,
        reason: 'blocked_by_policy',
        message: statusDecision.message ?? statusDecision.reason
      }
    }

    const nextRecord: ITemplateDocumentRecord = {
      ...cloneRecord(current),
      status: nextStatus,
      updatedAt: Date.now()
    }

    this.records.set(id, nextRecord)
    this._persist()

    return {
      applied: true,
      previousStatus,
      nextStatus,
      document: cloneRecord(nextRecord)
    }
  }

  exportPersistenceRecord(
    id: string
  ): ITemplateDocumentPersistenceRecord | null {
    const current = this.records.get(id)
    if (!current) return null
    return toPersistenceRecord(current)
  }

  exportAutosavePayload(
    id: string
  ): ITemplateDocumentAutosavePayload | null {
    const current = this.records.get(id)
    if (!current) return null
    return {
      documentId: current.id,
      templateId: current.template.id,
      templateVersion: current.template.version,
      updatedAt: current.updatedAt,
      flatValues: { ...current.content.flatValues },
      editorState: cloneUnknown(current.content.editorState)
    }
  }

  upsertFromPersistence(
    persisted: ITemplateDocumentPersistenceRecord
  ): ITemplateDocumentRecord {
    const record = fromPersistenceRecord(persisted)
    this.records.set(record.id, cloneRecord(record))
    this._persist()
    return cloneRecord(record)
  }

  loadFromStorage() {
    try {
      const raw = this.storage.getItem(this.storageKey)
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
    this.storage.removeItem(this.storageKey)
  }

  private _persist() {
    this.storage.setItem(this.storageKey, JSON.stringify(Array.from(this.records.values())))
  }
}