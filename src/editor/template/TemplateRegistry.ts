import type { ITemplateCondition, ITemplateSchema } from './index'
import { buildFieldIndex } from './index'

export type TemplatePublishStatus = 'draft' | 'review' | 'published' | 'archived'

export type TemplateAssetLifecycleStatus = 'planning' | 'trial' | 'online' | 'suspended'
export type TemplateAuditAction =
  | 'create'
  | 'save'
  | 'asset_update'
  | 'trial_run'
  | 'submit_review'
  | 'publish'
  | 'withdraw'
  | 'rollback'
  | 'revision_draft'

export interface ITemplateAssetMetadata {
  hospitalArea?: string
  department?: string
  documentType?: string
  owner?: string
  applicableRoles?: string[]
  scenario?: string
  lifecycleStatus?: TemplateAssetLifecycleStatus
}

export interface ITemplateReleaseNote {
  note?: string
  reason?: string
  impactScope?: string
  verifier?: string
  plannedAt?: string
}

export interface ITemplateTrialRunRecord {
  id: string
  scenario: string
  patientId?: string
  department?: string
  status: 'passed' | 'failed'
  summary?: string
  diagnostics?: string[]
  timestamp: number
}

export interface ITemplateAuditRecord {
  action: TemplateAuditAction
  timestamp: number
  operator?: string
  note?: string
  detail?: string
}

export interface ITemplateVersionRecord {
  status: TemplatePublishStatus
  version: string
  note?: string
  releaseNote?: ITemplateReleaseNote
  schemaSnapshot?: ITemplateSchema
  timestamp: number
}

export interface ITemplateRegistryEntry {
  schema: ITemplateSchema
  category: string
  builtIn: boolean
  createdAt: number
  updatedAt: number
  status: TemplatePublishStatus
  versionHistory: ITemplateVersionRecord[]
  asset?: ITemplateAssetMetadata
  trialRuns: ITemplateTrialRunRecord[]
  auditLogs: ITemplateAuditRecord[]
}

export interface ITemplateListItem {
  id: string
  name: string
  description?: string
  category: string
  builtIn: boolean
  updatedAt: number
}

export interface ITemplateRegisterOptions {
  note?: string
  operator?: string
  asset?: ITemplateAssetMetadata
}

export interface ITemplateImportRecord {
  schema: ITemplateSchema
  mode: 'created' | 'updated'
}

export interface ITemplateImportFailure {
  index: number
  name: string
  message: string
}

export interface ITemplateImportResult {
  imported: ITemplateImportRecord[]
  failed: ITemplateImportFailure[]
}

const STORAGE_KEY = 'canvas-editor:templates'

function createDefaultAssetMetadata(
  schema: ITemplateSchema,
  category: string,
  existing?: ITemplateAssetMetadata
): ITemplateAssetMetadata {
  return {
    hospitalArea: existing?.hospitalArea ?? '默认院区',
    department: existing?.department ?? category,
    documentType: existing?.documentType ?? category,
    owner: existing?.owner ?? '模板管理员',
    applicableRoles: existing?.applicableRoles ?? ['医生', '护士'],
    scenario: existing?.scenario ?? schema.description,
    lifecycleStatus: existing?.lifecycleStatus ?? 'planning'
  }
}

function cloneEntry(entry: ITemplateRegistryEntry): ITemplateRegistryEntry {
  return JSON.parse(JSON.stringify(entry)) as ITemplateRegistryEntry
}

function collectConditions(schema: ITemplateSchema): ITemplateCondition[] {
  const result: ITemplateCondition[] = []
  for (const block of schema.blocks) {
    if ('rules' in block && block.rules) {
      for (const rule of block.rules) {
        if (rule.condition) result.push(rule.condition)
      }
    }
    if (block.type === 'fieldRow') {
      for (const field of block.fields) {
        if (field.rules) {
          for (const rule of field.rules) {
            if (rule.condition) result.push(rule.condition)
          }
        }
      }
    } else if (block.type === 'group' && 'children' in block) {
      for (const child of (block as any).children ?? []) {
        if (child.type === 'fieldRow') {
          for (const field of child.fields ?? []) {
            if (field.rules) {
              for (const rule of field.rules) {
                if (rule.condition) result.push(rule.condition)
              }
            }
          }
        }
      }
    }
  }
  return result
}

function validateSchema(schema: ITemplateSchema): string[] {
  const errors: string[] = []
  const fieldIndex = buildFieldIndex(schema)
  const allFieldIds = new Set(fieldIndex.keys())
  for (const condition of collectConditions(schema)) {
    if (!condition.fieldType || condition.fieldType === 'fieldId') {
      if (!allFieldIds.has(condition.field)) {
        errors.push(`条件引用了不存在的字段 "${condition.field}"`)
      }
    }
  }
  return errors
}

class TemplateRegistry {
  private entries = new Map<string, ITemplateRegistryEntry>()

  private _pushAudit(
    entry: ITemplateRegistryEntry,
    action: TemplateAuditAction,
    options: { operator?: string; note?: string; detail?: string } = {}
  ) {
    entry.auditLogs = entry.auditLogs ?? []
    entry.auditLogs.push({
      action,
      timestamp: Date.now(),
      operator: options.operator ?? '系统',
      note: options.note,
      detail: options.detail
    })
  }

  register(
    schema: ITemplateSchema,
    category: string,
    builtIn = false,
    options?: ITemplateRegisterOptions
  ) {
    const now = Date.now()
    const existing = this.entries.get(schema.id)
    const prevStatus = existing?.status ?? 'draft'
    const wasPublished = prevStatus === 'published' || prevStatus === 'review'
    const newStatus: TemplatePublishStatus = builtIn ? 'published' : 'draft'
    const versionHistory: ITemplateVersionRecord[] = existing?.versionHistory ?? []
    const auditLogs: ITemplateAuditRecord[] = existing?.auditLogs ?? []
    const trialRuns: ITemplateTrialRunRecord[] = existing?.trialRuns ?? []

    if (options?.note && existing) {
      versionHistory.push({
        status: 'draft',
        version: existing.schema.version,
        note: options.note,
        timestamp: now
      })
    } else if (wasPublished && !builtIn && existing) {
      versionHistory.push({
        status: 'draft',
        version: existing.schema.version,
        timestamp: now
      })
    }

    const nextEntry: ITemplateRegistryEntry = {
      schema,
      category,
      builtIn,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      status: newStatus,
      versionHistory,
      asset: createDefaultAssetMetadata(schema, category, {
        ...(existing?.asset ?? {}),
        ...(options?.asset ?? {})
      }),
      trialRuns,
      auditLogs
    }
    this._pushAudit(nextEntry, existing ? 'save' : 'create', {
      operator: options?.operator,
      note: options?.note,
      detail: builtIn ? '内置模板注册' : '模板保存'
    })
    this.entries.set(schema.id, nextEntry)
    if (!builtIn) {
      this._persist()
    }
  }

  get(id: string): ITemplateSchema | undefined {
    return this.entries.get(id)?.schema
  }

  getEntry(id: string): ITemplateRegistryEntry | undefined {
    const entry = this.entries.get(id)
    return entry
  }

  updateAssetMetadata(
    id: string,
    asset: Partial<ITemplateAssetMetadata>,
    operator?: string
  ): ITemplateRegistryEntry | undefined {
    const entry = this.entries.get(id)
    if (!entry || entry.builtIn) return undefined
    entry.asset = createDefaultAssetMetadata(entry.schema, entry.category, {
      ...(entry.asset ?? {}),
      ...asset
    })
    entry.updatedAt = Date.now()
    this._pushAudit(entry, 'asset_update', {
      operator,
      detail: '更新模板资产信息'
    })
    this._persist()
    return cloneEntry(entry)
  }

  addTrialRun(
    id: string,
    record: Omit<ITemplateTrialRunRecord, 'id' | 'timestamp'>,
    operator?: string
  ): ITemplateTrialRunRecord | undefined {
    const entry = this.entries.get(id)
    if (!entry) return undefined
    const trialRun: ITemplateTrialRunRecord = {
      ...record,
      id: `trial_${Date.now()}`,
      timestamp: Date.now()
    }
    entry.trialRuns = entry.trialRuns ?? []
    entry.trialRuns.push(trialRun)
    entry.updatedAt = Date.now()
    this._pushAudit(entry, 'trial_run', {
      operator,
      note: trialRun.summary,
      detail: `${trialRun.scenario} · ${trialRun.status === 'passed' ? '通过' : '失败'}`
    })
    if (!entry.builtIn) this._persist()
    return trialRun
  }

  getAuditLogs(id: string): ITemplateAuditRecord[] {
    return this.entries.get(id)?.auditLogs?.slice().reverse() ?? []
  }

  getTrialRuns(id: string): ITemplateTrialRunRecord[] {
    return this.entries.get(id)?.trialRuns?.slice().reverse() ?? []
  }

  getAll(): ITemplateListItem[] {
    return Array.from(this.entries.values()).map(e => ({
      id: e.schema.id,
      name: e.schema.name,
      description: e.schema.description,
      category: e.category,
      builtIn: e.builtIn,
      updatedAt: e.updatedAt
    }))
  }

  getPublished(): ITemplateListItem[] {
    return Array.from(this.entries.values())
      .filter(e => e.status === 'published')
      .map(e => ({
        id: e.schema.id,
        name: e.schema.name,
        description: e.schema.description,
        category: e.category,
        builtIn: e.builtIn,
        updatedAt: e.updatedAt
      }))
  }

  getByCategory(category: string): ITemplateListItem[] {
    return this.getAll().filter(item => item.category === category)
  }

  getCategories(): string[] {
    return Array.from(new Set(Array.from(this.entries.values()).map(e => e.category)))
  }

  submitForReview(id: string, note?: string | ITemplateReleaseNote): string[] {
    const entry = this.entries.get(id)
    if (!entry || entry.builtIn) return [`模板 "${id}" 不存在或为内置模板`]
    const errors = validateSchema(entry.schema)
    if (errors.length) return errors
    const now = Date.now()
    const releaseNote = typeof note === 'string' ? { note } : note
    entry.versionHistory.push({
      status: 'review',
      version: entry.schema.version,
      note: releaseNote?.note,
      releaseNote,
      timestamp: now
    })
    entry.status = 'review'
    entry.updatedAt = now
    entry.asset = createDefaultAssetMetadata(entry.schema, entry.category, {
      ...(entry.asset ?? {}),
      lifecycleStatus: 'trial'
    })
    this._pushAudit(entry, 'submit_review', {
      note: releaseNote?.note,
      detail: releaseNote?.reason
    })
    this._persist()
    return []
  }

  publish(id: string, note?: string | ITemplateReleaseNote): string[] {
    const entry = this.entries.get(id)
    if (!entry || entry.builtIn) return [`模板 "${id}" 不存在或为内置模板`]
    const errors = validateSchema(entry.schema)
    if (errors.length) return errors
    const now = Date.now()
    const releaseNote = typeof note === 'string' ? { note } : note
    entry.versionHistory.push({
      status: 'published',
      version: entry.schema.version,
      note: releaseNote?.note,
      releaseNote,
      schemaSnapshot: JSON.parse(JSON.stringify(entry.schema)) as ITemplateSchema,
      timestamp: now
    })
    entry.status = 'published'
    entry.updatedAt = now
    entry.asset = createDefaultAssetMetadata(entry.schema, entry.category, {
      ...(entry.asset ?? {}),
      lifecycleStatus: 'online'
    })
    this._pushAudit(entry, 'publish', {
      note: releaseNote?.note,
      detail: releaseNote?.reason
    })
    this._persist()
    return []
  }

  withdraw(id: string): string[] {
    const entry = this.entries.get(id)
    if (!entry || entry.builtIn) return [`模板 "${id}" 不存在或为内置模板`]
    const now = Date.now()
    entry.versionHistory.push({
      status: 'archived',
      version: entry.schema.version,
      timestamp: now
    })
    entry.status = 'archived'
    entry.updatedAt = now
    entry.asset = createDefaultAssetMetadata(entry.schema, entry.category, {
      ...(entry.asset ?? {}),
      lifecycleStatus: 'suspended'
    })
    this._pushAudit(entry, 'withdraw', { detail: '撤回线上模板' })
    this._persist()
    return []
  }

  cloneAsDraft(id: string): ITemplateSchema | undefined {
    const entry = this.entries.get(id)
    if (!entry) return undefined
    const now = Date.now()
    const newSchema: ITemplateSchema = {
      ...JSON.parse(JSON.stringify(entry.schema)) as ITemplateSchema,
      id: `${entry.schema.id}_copy_${now}`,
      name: `${entry.schema.name} 副本`
    }
    this.register(newSchema, entry.category, false)
    return newSchema
  }

  createRevisionDraftFromPublished(
    id: string,
    options?: { note?: string; operator?: string }
  ): ITemplateSchema | undefined {
    const entry = this.entries.get(id)
    const latestPublished = this.getLatestPublishedRecord(id)
    if (!entry || entry.builtIn || !latestPublished?.schemaSnapshot) {
      return undefined
    }

    const now = Date.now()
    const snapshot = JSON.parse(
      JSON.stringify(latestPublished.schemaSnapshot)
    ) as ITemplateSchema
    const note = options?.note
      ?? `基于线上版本 ${latestPublished.version} 生成修订草稿`
    const nextEntry: ITemplateRegistryEntry = {
      ...entry,
      schema: snapshot,
      status: 'draft',
      updatedAt: now,
      trialRuns: [],
      versionHistory: [
        ...entry.versionHistory,
        {
          status: 'draft',
          version: snapshot.version,
          note,
          timestamp: now
        }
      ]
    }
    this._pushAudit(nextEntry, 'revision_draft', {
      operator: options?.operator,
      note,
      detail: `从线上版本 ${latestPublished.version} 创建修订草稿并清空试运行记录`
    })
    this.entries.set(id, nextEntry)
    this._persist()
    return JSON.parse(JSON.stringify(snapshot)) as ITemplateSchema
  }

  rollbackToVersion(id: string, historyIndex: number): ITemplateSchema | undefined {
    const entry = this.entries.get(id)
    if (!entry) return undefined
    const record = entry.versionHistory[historyIndex]
    if (!record?.schemaSnapshot) return undefined
    const snapshot = JSON.parse(JSON.stringify(record.schemaSnapshot)) as ITemplateSchema
    const now = Date.now()
    this.entries.set(id, {
      ...entry,
      schema: snapshot,
      status: 'draft',
      updatedAt: now,
      versionHistory: [
        ...entry.versionHistory,
        {
          status: 'draft',
          version: snapshot.version,
          note: `回滚到版本 ${snapshot.version}`,
          timestamp: now
        }
      ]
    })
    const nextEntry = this.entries.get(id)
    if (nextEntry) {
      this._pushAudit(nextEntry, 'rollback', {
        note: `回滚到版本 ${snapshot.version}`
      })
    }
    this._persist()
    return snapshot
  }

  getLatestPublishedRecord(id: string): ITemplateVersionRecord | undefined {
    const entry = this.entries.get(id)
    if (!entry) return undefined
    const published = entry.versionHistory.filter(r => r.status === 'published')
    return published[published.length - 1]
  }

  delete(id: string): boolean {
    const entry = this.entries.get(id)
    if (!entry || entry.builtIn) return false
    this.entries.delete(id)
    this._persist()
    return true
  }

  exportSchema(id: string): string | null {
    const schema = this.get(id)
    return schema ? JSON.stringify(schema, null, 2) : null
  }

  importSchemas(json: string, category: string): ITemplateImportResult {
    const payload = JSON.parse(json) as ITemplateSchema | ITemplateSchema[]
    const schemaList = Array.isArray(payload) ? payload : [payload]
    const imported: ITemplateImportRecord[] = []
    const failed: ITemplateImportFailure[] = []

    schemaList.forEach((schema, index) => {
      const displayName = schema?.name || schema?.id || `第 ${index + 1} 项`
      if (!schema?.id || !schema?.name || !schema?.version) {
        failed.push({
          index,
          name: displayName,
          message: '缺少必填字段（id、name、version）'
        })
        return
      }

      const mode = this.entries.has(schema.id) ? 'updated' : 'created'
      this.register(schema, category, false)
      imported.push({ schema, mode })
    })

    return {
      imported,
      failed
    }
  }

  importSchema(json: string, category: string): ITemplateSchema {
    const result = this.importSchemas(json, category)
    if (!result.imported.length) {
      const error = result.failed[0]
      throw new Error(
        error
          ? `Invalid template schema: ${error.message}`
          : 'Invalid template schema: import payload is empty'
      )
    }
    return result.imported[0].schema
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as ITemplateRegistryEntry[]
      for (const entry of stored) {
        const existing = this.entries.get(entry.schema.id)
        if (!existing || existing.builtIn || existing.updatedAt <= entry.updatedAt) {
          this.entries.set(entry.schema.id, {
            ...entry,
            asset: createDefaultAssetMetadata(entry.schema, entry.category, entry.asset),
            trialRuns: entry.trialRuns ?? [],
            auditLogs: entry.auditLogs ?? []
          })
        }
      }
    } catch {
      // ignore corrupt storage
    }
  }

  private _persist() {
    const custom = Array.from(this.entries.values()).filter(e => !e.builtIn)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
  }
}

export const templateRegistry = new TemplateRegistry()
