import type { TemplatePublishStatus } from './TemplateRegistry'
import type { ITemplateField, ITemplateSchema } from './index'
import { buildFieldIndex } from './index'

export type TemplateDocumentStatus = 'draft' | 'completed' | 'signed' | 'archived'
export type TemplateDocumentMigrationMatchMode = 'fieldId' | 'businessCode' | 'exportPath'
export type TemplateDocumentTraceAction =
  | 'create'
  | 'fork'
  | 'writing_start'
  | 'writing_update'
  | 'writing_save'
  | 'autosave'
  | 'save'
  | 'sign'
  | 'review'
  | 'status_change'
  | 'migrate'
  | 'manual'

export interface ITemplateDocumentTraceFieldDiff {
  fieldId: string
  before: string | null
  after: string | null
}

export interface ITemplateDocumentTraceEvent {
  id: string
  action: TemplateDocumentTraceAction
  timestamp: number
  operator?: string
  source?: 'system' | 'templateManager' | 'editor' | 'autosave' | 'migration' | 'api'
  title: string
  summary?: string
  templateId: string
  templateVersion: string
  statusBefore?: TemplateDocumentStatus
  statusAfter?: TemplateDocumentStatus
  changedFields?: ITemplateDocumentTraceFieldDiff[]
  metadata?: Record<string, unknown>
}

export interface ITemplateDocumentTraceOptions {
  action?: TemplateDocumentTraceAction
  operator?: string
  source?: ITemplateDocumentTraceEvent['source']
  title?: string
  summary?: string
  metadata?: Record<string, unknown>
}

export interface ITemplateDocumentWritingContext extends ITemplateDocumentTraceOptions {
  role?: string
  department?: string
  workstation?: string
}

export interface ITemplateDocumentWritingInput extends ITemplateDocumentWritingContext {
  flatValues?: Record<string, string | null>
  editorState?: unknown
  commit?: boolean
  reason?: string
}

export interface ITemplateDocumentWritingSummary {
  documentId: string
  patientId?: string
  encounterId?: string
  title?: string
  status: TemplateDocumentStatus
  templateId: string
  templateVersion: string
  firstWrittenAt?: number
  lastWrittenAt?: number
  latestEvent?: ITemplateDocumentTraceEvent
  writers: string[]
  changedFieldIds: string[]
  fieldChangeCount: number
  writingEventCount: number
  autosaveCount: number
  saveCount: number
  signCount: number
  reviewCount: number
}

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
  traceEvents: ITemplateDocumentTraceEvent[]
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
  trace?: ITemplateDocumentTraceOptions
}

export interface ITemplateDocumentMigrationOptions {
  note?: string
  allowPartial?: boolean
  templateStatus?: TemplatePublishStatus
  trace?: ITemplateDocumentTraceOptions
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
  trace?: ITemplateDocumentTraceOptions
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
  traceEvents?: ITemplateDocumentTraceEvent[]
}

export interface IForkTemplateDocumentOptions {
  id?: string
  title?: string
  status?: TemplateDocumentStatus
  reason?: string
  resetMigrationHistory?: boolean
  trace?: ITemplateDocumentTraceOptions
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

function createTraceId() {
  return `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createFieldDiffs(
  before: Record<string, string | null> = {},
  after: Record<string, string | null> = {}
): ITemplateDocumentTraceFieldDiff[] {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]))
  return keys
    .filter(key => (before[key] ?? null) !== (after[key] ?? null))
    .map(key => ({
      fieldId: key,
      before: before[key] ?? null,
      after: after[key] ?? null
    }))
}

function createTraceEvent(
  record: ITemplateDocumentRecord,
  action: TemplateDocumentTraceAction,
  options: ITemplateDocumentTraceOptions & {
    statusBefore?: TemplateDocumentStatus
    statusAfter?: TemplateDocumentStatus
    changedFields?: ITemplateDocumentTraceFieldDiff[]
  } = {}
): ITemplateDocumentTraceEvent {
  const defaultTitle: Record<TemplateDocumentTraceAction, string> = {
    create: '创建病历实例',
    fork: '复制病历实例',
    writing_start: '开始书写病历',
    writing_update: '书写病历内容',
    writing_save: '保存书写内容',
    autosave: '自动暂存',
    save: '保存病历内容',
    sign: '医生签名',
    review: '病历复核',
    status_change: '变更病历状态',
    migrate: '迁移模板版本',
    manual: '手工留痕'
  }
  return {
    id: createTraceId(),
    action,
    timestamp: Date.now(),
    operator: options.operator ?? '系统',
    source: options.source ?? 'system',
    title: options.title ?? defaultTitle[action],
    summary: options.summary,
    templateId: record.template.id,
    templateVersion: record.template.version,
    statusBefore: options.statusBefore,
    statusAfter: options.statusAfter,
    changedFields: options.changedFields,
    metadata: options.metadata
  }
}

function appendTraceEvent(
  record: ITemplateDocumentRecord,
  event: ITemplateDocumentTraceEvent
) {
  record.traceEvents = [...(record.traceEvents ?? []), event]
}

function createWritingMetadata(
  context: ITemplateDocumentWritingContext | ITemplateDocumentWritingInput
): Record<string, unknown> | undefined {
  const metadata = {
    ...(context.metadata ?? {}),
    ...(context.role ? { role: context.role } : {}),
    ...(context.department ? { department: context.department } : {}),
    ...(context.workstation ? { workstation: context.workstation } : {})
  }
  return Object.keys(metadata).length ? metadata : undefined
}

function getTraceTimeline(events: ITemplateDocumentTraceEvent[]) {
  return cloneUnknown(events)
    .map((event, index) => ({ event, index }))
    .sort((a, b) => b.event.timestamp - a.event.timestamp || b.index - a.index)
    .map(item => item.event)
}

function isWritingTraceAction(action: TemplateDocumentTraceAction) {
  return [
    'writing_start',
    'writing_update',
    'writing_save',
    'autosave',
    'save',
    'sign',
    'review',
    'manual',
    'status_change'
  ].includes(action)
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
    migrationHistory: cloneUnknown(record.migrationHistory),
    traceEvents: cloneUnknown(record.traceEvents)
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
    migrationHistory: cloneUnknown(record.migrationHistory),
    traceEvents: cloneUnknown(record.traceEvents ?? [])
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
      migrationHistory: [],
      traceEvents: []
    }
    appendTraceEvent(record, createTraceEvent(record, 'create', {
      source: options.trace?.source ?? 'templateManager',
      operator: options.trace?.operator,
      title: options.trace?.title,
      summary: options.trace?.summary ?? `绑定模板 ${record.template.name} v${record.template.version}`,
      statusAfter: record.status,
      metadata: options.trace?.metadata
    }))
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
        : cloneUnknown(current.migrationHistory),
      traceEvents: []
    }
    appendTraceEvent(forked, createTraceEvent(forked, 'fork', {
      source: options.trace?.source ?? 'api',
      operator: options.trace?.operator,
      title: options.trace?.title,
      summary: options.trace?.summary ?? `从病历 ${current.id} 复制`,
      statusAfter: forked.status,
      metadata: {
        sourceDocumentId: current.id,
        reason: options.reason,
        ...(options.trace?.metadata ?? {})
      }
    }))

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

  getTraceTimeline(id: string): ITemplateDocumentTraceEvent[] {
    const current = this.records.get(id)
    if (!current) return []
    return getTraceTimeline(current.traceEvents ?? [])
  }

  getFieldTraceTimeline(
    id: string,
    fieldId: string
  ): ITemplateDocumentTraceEvent[] {
    return this.getTraceTimeline(id)
      .filter(event => event.changedFields?.some(diff => diff.fieldId === fieldId))
  }

  getWritingTraceSummary(id: string): ITemplateDocumentWritingSummary | null {
    const current = this.records.get(id)
    if (!current) return null
    const timeline = getTraceTimeline(current.traceEvents ?? [])
    const writingEvents = timeline.filter(event => isWritingTraceAction(event.action))
    const chronologicalEvents = [...writingEvents].reverse()
    const changedFieldIds = new Set<string>()
    let fieldChangeCount = 0
    writingEvents.forEach(event => {
      event.changedFields?.forEach(diff => {
        changedFieldIds.add(diff.fieldId)
        fieldChangeCount += 1
      })
    })
    return {
      documentId: current.id,
      patientId: current.patientId,
      encounterId: current.encounterId,
      title: current.title,
      status: current.status,
      templateId: current.template.id,
      templateVersion: current.template.version,
      firstWrittenAt: chronologicalEvents[0]?.timestamp,
      lastWrittenAt: writingEvents[0]?.timestamp,
      latestEvent: writingEvents[0] ? cloneUnknown(writingEvents[0]) : undefined,
      writers: Array.from(new Set(
        writingEvents
          .map(event => event.operator)
          .filter((operator): operator is string => Boolean(operator))
      )),
      changedFieldIds: Array.from(changedFieldIds),
      fieldChangeCount,
      writingEventCount: writingEvents.length,
      autosaveCount: writingEvents.filter(event => event.action === 'autosave').length,
      saveCount: writingEvents.filter(event => (
        event.action === 'save' || event.action === 'writing_save'
      )).length,
      signCount: writingEvents.filter(event => event.action === 'sign').length,
      reviewCount: writingEvents.filter(event => event.action === 'review').length
    }
  }

  startWriting(
    id: string,
    context: ITemplateDocumentWritingContext = {}
  ): ITemplateDocumentTraceEvent | null {
    return this.appendTrace(id, {
      action: 'writing_start',
      source: context.source ?? 'editor',
      operator: context.operator,
      title: context.title,
      summary: context.summary ?? '医生打开病历并开始书写',
      metadata: createWritingMetadata(context)
    })
  }

  write(
    id: string,
    input: ITemplateDocumentWritingInput
  ): ITemplateDocumentRecord | null {
    const current = this.records.get(id)
    if (!current) return null
    const nextFlatValues = input.flatValues
      ? { ...current.content.flatValues, ...input.flatValues }
      : current.content.flatValues
    const changedFields = createFieldDiffs(current.content.flatValues, nextFlatValues)
    const action: TemplateDocumentTraceAction = input.commit
      ? 'writing_save'
      : 'writing_update'
    const nextRecord: ITemplateDocumentRecord = {
      ...cloneRecord(current),
      updatedAt: Date.now(),
      content: {
        ...cloneUnknown(current.content),
        flatValues: { ...nextFlatValues },
        ...(Object.prototype.hasOwnProperty.call(input, 'editorState')
          ? { editorState: cloneUnknown(input.editorState) }
          : {})
      }
    }
    appendTraceEvent(nextRecord, createTraceEvent(nextRecord, action, {
      source: input.source ?? 'editor',
      operator: input.operator,
      title: input.title,
      summary: input.summary ?? (changedFields.length
        ? `医生书写 ${changedFields.length} 个字段`
        : '医生更新编辑状态'),
      changedFields,
      metadata: {
        ...(createWritingMetadata(input) ?? {}),
        ...(input.reason ? { reason: input.reason } : {})
      }
    }))
    this.records.set(id, nextRecord)
    this._persist()
    return cloneRecord(nextRecord)
  }

  signDocument(
    id: string,
    context: ITemplateDocumentWritingContext = {}
  ): ITemplateDocumentStatusTransitionResult | null {
    return this.setStatus(id, 'signed', {
      ...context,
      action: 'sign',
      source: context.source ?? 'editor',
      title: context.title ?? '医生签名',
      summary: context.summary ?? '医生完成病历签名',
      metadata: createWritingMetadata(context)
    })
  }

  reviewWriting(
    id: string,
    context: ITemplateDocumentWritingContext = {}
  ): ITemplateDocumentTraceEvent | null {
    return this.appendTrace(id, {
      action: 'review',
      source: context.source ?? 'editor',
      operator: context.operator,
      title: context.title ?? '病历复核',
      summary: context.summary ?? '完成病历书写复核',
      metadata: createWritingMetadata(context)
    })
  }

  appendTrace(
    id: string,
    trace: ITemplateDocumentTraceOptions & {
      action?: TemplateDocumentTraceAction
      changedFields?: ITemplateDocumentTraceFieldDiff[]
      statusBefore?: TemplateDocumentStatus
      statusAfter?: TemplateDocumentStatus
    }
  ): ITemplateDocumentTraceEvent | null {
    const current = this.records.get(id)
    if (!current) return null
    const event = createTraceEvent(current, trace.action ?? 'manual', {
      source: trace.source ?? 'api',
      operator: trace.operator,
      title: trace.title,
      summary: trace.summary,
      metadata: trace.metadata,
      changedFields: trace.changedFields,
      statusBefore: trace.statusBefore,
      statusAfter: trace.statusAfter
    })
    appendTraceEvent(current, event)
    current.updatedAt = Date.now()
    this.records.set(id, current)
    this._persist()
    return cloneUnknown(event)
  }

  save(
    record: ITemplateDocumentRecord,
    trace: ITemplateDocumentTraceOptions = {}
  ): ITemplateDocumentRecord {
    const current = this.records.get(record.id)
    const nextRecord = cloneRecord(record)
    nextRecord.updatedAt = Date.now()
    const changedFields = createFieldDiffs(
      current?.content.flatValues,
      nextRecord.content.flatValues
    )
    nextRecord.traceEvents = current?.traceEvents
      ? cloneUnknown(current.traceEvents)
      : cloneUnknown(nextRecord.traceEvents ?? [])
    appendTraceEvent(nextRecord, createTraceEvent(nextRecord, 'save', {
      source: trace.source ?? 'editor',
      operator: trace.operator,
      title: trace.title,
      summary: trace.summary ?? (changedFields.length
        ? `保存 ${changedFields.length} 个字段变更`
        : '保存病历内容'),
      changedFields,
      metadata: trace.metadata
    }))
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

    const changedFields = content.flatValues
      ? createFieldDiffs(current.content.flatValues, nextRecord.content.flatValues)
      : []
    appendTraceEvent(nextRecord, createTraceEvent(nextRecord, 'autosave', {
      source: content.trace?.source ?? 'autosave',
      operator: content.trace?.operator,
      title: content.trace?.title,
      summary: content.trace?.summary ?? (changedFields.length
        ? `自动暂存 ${changedFields.length} 个字段变更`
        : '自动暂存编辑状态'),
      changedFields,
      metadata: content.trace?.metadata
    }))
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
    appendTraceEvent(migrated, createTraceEvent(migrated, 'migrate', {
      source: options.trace?.source ?? 'migration',
      operator: options.trace?.operator,
      title: options.trace?.title,
      summary: options.trace?.summary ?? `模板从 v${plan.fromTemplateVersion} 迁移到 v${plan.toTemplateVersion}`,
      changedFields: createFieldDiffs(current.content.flatValues, plan.nextValues),
      metadata: {
        note: options.note,
        mappings: plan.mappings.length,
        unresolvedFieldIds: plan.unresolvedFields.map(item => item.fieldId),
        droppedFieldIds: plan.droppedFields.map(item => item.fieldId),
        ...(options.trace?.metadata ?? {})
      }
    }))
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
    nextStatus: TemplateDocumentStatus,
    trace: ITemplateDocumentTraceOptions = {}
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
    appendTraceEvent(nextRecord, createTraceEvent(nextRecord, trace.action ?? 'status_change', {
      source: trace.source ?? 'api',
      operator: trace.operator,
      title: trace.title,
      summary: trace.summary ?? `状态从 ${previousStatus} 变更为 ${nextStatus}`,
      statusBefore: previousStatus,
      statusAfter: nextStatus,
      metadata: trace.metadata
    }))

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
        this.records.set(record.id, {
          ...cloneRecord(record),
          traceEvents: cloneUnknown(record.traceEvents ?? [])
        })
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