import type { ITemplateCondition, ITemplateSchema } from './index'
import { buildFieldIndex } from './index'

export type TemplatePublishStatus = 'draft' | 'review' | 'published' | 'archived'

export interface ITemplateVersionRecord {
  status: TemplatePublishStatus
  version: string
  note?: string
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
}

const STORAGE_KEY = 'canvas-editor:templates'

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

    this.entries.set(schema.id, {
      schema,
      category,
      builtIn,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      status: newStatus,
      versionHistory
    })
    if (!builtIn) {
      this._persist()
    }
  }

  get(id: string): ITemplateSchema | undefined {
    return this.entries.get(id)?.schema
  }

  getEntry(id: string): ITemplateRegistryEntry | undefined {
    return this.entries.get(id)
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

  submitForReview(id: string, note?: string): string[] {
    const entry = this.entries.get(id)
    if (!entry || entry.builtIn) return [`模板 "${id}" 不存在或为内置模板`]
    const errors = validateSchema(entry.schema)
    if (errors.length) return errors
    const now = Date.now()
    entry.versionHistory.push({
      status: 'review',
      version: entry.schema.version,
      note,
      timestamp: now
    })
    entry.status = 'review'
    entry.updatedAt = now
    this._persist()
    return []
  }

  publish(id: string, note?: string): string[] {
    const entry = this.entries.get(id)
    if (!entry || entry.builtIn) return [`模板 "${id}" 不存在或为内置模板`]
    const errors = validateSchema(entry.schema)
    if (errors.length) return errors
    const now = Date.now()
    entry.versionHistory.push({
      status: 'published',
      version: entry.schema.version,
      note,
      schemaSnapshot: JSON.parse(JSON.stringify(entry.schema)) as ITemplateSchema,
      timestamp: now
    })
    entry.status = 'published'
    entry.updatedAt = now
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

  importSchema(json: string, category: string): ITemplateSchema {
    const schema = JSON.parse(json) as ITemplateSchema
    if (!schema.id || !schema.name || !schema.version) {
      throw new Error('Invalid template schema: missing required fields (id, name, version)')
    }
    this.register(schema, category, false)
    return schema
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as ITemplateRegistryEntry[]
      for (const entry of stored) {
        if (!this.entries.has(entry.schema.id)) {
          this.entries.set(entry.schema.id, entry)
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
