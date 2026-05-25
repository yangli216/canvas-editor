import { beforeEach, describe, expect, it } from 'vitest'
import {
  analyzeTemplateDocumentMigration,
  TemplateDocumentStore,
  type ITemplateDocumentStorageLike,
  type ITemplateDocumentWorkflowPolicy,
  type ITemplateSchema
} from '@/editor'

function createLegacySchema(): ITemplateSchema {
  return {
    version: '1.0.0',
    id: 'admission-record',
    name: '入院记录模板',
    blocks: [
      {
        type: 'fieldRow',
        fields: [
          {
            id: 'patientName',
            type: 'text',
            label: '姓名',
            metadata: {
              businessCode: 'patient.name',
              exportPath: 'patient.name'
            }
          },
          {
            id: 'diagnosis',
            type: 'textarea',
            label: '入院诊断',
            metadata: {
              businessCode: 'encounter.admissionDiagnosis',
              exportPath: 'encounter.admissionDiagnosis'
            }
          },
          {
            id: 'legacyRemark',
            type: 'text',
            label: '旧备注',
            metadata: {
              businessCode: 'encounter.legacyRemark',
              exportPath: 'encounter.legacyRemark'
            }
          }
        ]
      }
    ]
  }
}

function createNextSchema(): ITemplateSchema {
  return {
    version: '1.1.0',
    id: 'admission-record',
    name: '入院记录模板',
    blocks: [
      {
        type: 'fieldRow',
        fields: [
          {
            id: 'patientFullName',
            type: 'text',
            label: '患者姓名',
            metadata: {
              businessCode: 'patient.name',
              exportPath: 'patient.name'
            }
          },
          {
            id: 'diagnosis',
            type: 'textarea',
            label: '入院诊断',
            metadata: {
              businessCode: 'encounter.admissionDiagnosis',
              exportPath: 'encounter.admissionDiagnosis'
            }
          },
          {
            id: 'chiefComplaint',
            type: 'textarea',
            label: '主诉',
            required: true,
            metadata: {
              businessCode: 'encounter.chiefComplaint',
              exportPath: 'encounter.chiefComplaint'
            }
          }
        ]
      }
    ]
  }
}

describe('template document store', () => {
  const storageKey = `canvas-editor:template-documents:test:${Date.now()}`
  const restoreStorageKey = `${storageKey}:restore`
  const storageData = new Map<string, string>()
  const storage: ITemplateDocumentStorageLike = {
    getItem: key => storageData.get(key) ?? null,
    setItem: (key, value) => {
      storageData.set(key, value)
    },
    removeItem: key => {
      storageData.delete(key)
    }
  }

  beforeEach(() => {
    storageData.clear()
  })

  it('病历实例保存时会绑定模板快照和字段值', () => {
    const store = new TemplateDocumentStore(storageKey, storage)
    const record = store.create({
      schema: createLegacySchema(),
      patientId: 'p-001',
      encounterId: 'enc-001',
      flatValues: {
        patientName: '张三',
        diagnosis: '肺部感染'
      }
    })

    expect(record.template.id).toBe('admission-record')
    expect(record.template.version).toBe('1.0.0')
    expect(record.template.snapshot.blocks).toHaveLength(1)
    expect(record.content.flatValues).toEqual({
      patientName: '张三',
      diagnosis: '肺部感染'
    })

    const restored = new TemplateDocumentStore(storageKey, storage).get(record.id)
    expect(restored?.patientId).toBe('p-001')
    expect(restored?.template.snapshot.version).toBe('1.0.0')
  })

  it('模板迁移分析会保留可映射字段，并标记新增必填和遗留字段', () => {
    const plan = analyzeTemplateDocumentMigration(
      createLegacySchema(),
      createNextSchema(),
      {
        patientName: '张三',
        diagnosis: '肺部感染',
        legacyRemark: '旧模板备注'
      }
    )

    expect(plan.nextValues).toEqual({
      patientFullName: '张三',
      diagnosis: '肺部感染'
    })
    expect(plan.mappings).toEqual([
      {
        fromFieldId: 'patientName',
        toFieldId: 'patientFullName',
        matchBy: 'businessCode'
      },
      {
        fromFieldId: 'diagnosis',
        toFieldId: 'diagnosis',
        matchBy: 'fieldId'
      }
    ])
    expect(plan.unresolvedFields).toEqual([
      {
        fieldId: 'chiefComplaint',
        label: '主诉',
        reason: 'required'
      }
    ])
    expect(plan.droppedFields).toEqual([
      {
        fieldId: 'legacyRemark',
        label: '旧备注',
        value: '旧模板备注'
      }
    ])
  })

  it('已有病历默认不会在缺少新增必填字段时自动迁移，允许人工确认后再迁移', () => {
    const store = new TemplateDocumentStore(storageKey, storage)
    const record = store.create({
      schema: createLegacySchema(),
      flatValues: {
        patientName: '张三',
        diagnosis: '肺部感染',
        legacyRemark: '旧模板备注'
      }
    })

    const blocked = store.migrate(record.id, createNextSchema())
    expect(blocked).toMatchObject({
      applied: false,
      reason: 'required_fields_missing'
    })
    expect(store.get(record.id)?.template.version).toBe('1.0.0')

    const migrated = store.migrate(record.id, createNextSchema(), {
      allowPartial: true,
      note: '升级到 1.1.0 模板'
    })
    expect(migrated?.applied).toBe(true)
    expect(migrated?.document?.template.version).toBe('1.1.0')
    expect(migrated?.document?.content.flatValues).toEqual({
      patientFullName: '张三',
      diagnosis: '肺部感染'
    })
    expect(migrated?.document?.migrationHistory).toHaveLength(1)
    expect(migrated?.document?.migrationHistory[0]).toMatchObject({
      fromTemplateVersion: '1.0.0',
      toTemplateVersion: '1.1.0',
      unresolvedFieldIds: ['chiefComplaint'],
      droppedFieldIds: ['legacyRemark']
    })
  })

  it('可导出自动暂存 payload 和正式持久化记录', () => {
    const store = new TemplateDocumentStore(storageKey, storage)
    const record = store.create({
      schema: createLegacySchema(),
      patientId: 'p-001',
      encounterId: 'enc-001',
      flatValues: {
        patientName: '张三',
        diagnosis: '肺部感染'
      },
      structuredValues: {
        patient: {
          name: '张三'
        }
      },
      editorState: {
        cursor: 'field:patientName'
      }
    })

    const autosaved = store.autosave(record.id, {
      flatValues: {
        patientName: '李四',
        diagnosis: '上呼吸道感染'
      },
      editorState: {
        cursor: 'field:diagnosis'
      }
    })
    const autosavePayload = store.exportAutosavePayload(record.id)
    const persistence = store.exportPersistenceRecord(record.id)

    expect(autosaved?.content.flatValues).toEqual({
      patientName: '李四',
      diagnosis: '上呼吸道感染'
    })
    expect(autosavePayload).toMatchObject({
      documentId: record.id,
      templateId: 'admission-record',
      templateVersion: '1.0.0',
      flatValues: {
        patientName: '李四',
        diagnosis: '上呼吸道感染'
      },
      editorState: {
        cursor: 'field:diagnosis'
      }
    })
    expect(persistence).toMatchObject({
      documentId: record.id,
      patientId: 'p-001',
      encounterId: 'enc-001',
      templateId: 'admission-record',
      templateVersion: '1.0.0',
      flatValues: {
        patientName: '李四',
        diagnosis: '上呼吸道感染'
      },
      structuredValues: {
        patient: {
          name: '张三'
        }
      }
    })
    expect(persistence?.templateSnapshot.version).toBe('1.0.0')
  })

  it('可输出迁移预览并从持久化对象回灌病历记录', () => {
    const store = new TemplateDocumentStore(storageKey, storage)
    const record = store.create({
      schema: createLegacySchema(),
      status: 'signed',
      flatValues: {
        patientName: '张三',
        diagnosis: '肺部感染',
        legacyRemark: '旧模板备注'
      }
    })

    const preview = store.previewMigration(record.id, createNextSchema())
    const persisted = store.exportPersistenceRecord(record.id)
    const restoredStore = new TemplateDocumentStore(restoreStorageKey, storage)
    const restored = persisted
      ? restoredStore.upsertFromPersistence(persisted)
      : null

    expect(preview).toMatchObject({
      documentId: record.id,
      currentStatus: 'signed',
      fromTemplateVersion: '1.0.0',
      toTemplateVersion: '1.1.0',
      canAutoApply: false,
      requiresManualConfirmation: true
    })
    expect(preview?.unresolvedFields).toEqual([
      {
        fieldId: 'chiefComplaint',
        label: '主诉',
        reason: 'required'
      }
    ])
    expect(restored?.status).toBe('signed')
    expect(restored?.template.snapshot.version).toBe('1.0.0')
    expect(restored?.content.flatValues.legacyRemark).toBe('旧模板备注')
  })

  it('可通过外部 workflow policy 阻止已签名病历迁移，保持编辑器内核通用', () => {
    const workflowPolicy: ITemplateDocumentWorkflowPolicy = {
      beforeMigrate: ({ currentDocument }) => {
        if (currentDocument.status === 'signed') {
          return {
            allowed: false,
            reason: 'signed_document_locked',
            message: '已签名文书禁止直接迁移'
          }
        }
        return undefined
      }
    }
    const store = new TemplateDocumentStore(storageKey, storage, workflowPolicy)
    const record = store.create({
      schema: createLegacySchema(),
      status: 'signed',
      flatValues: {
        patientName: '张三',
        diagnosis: '肺部感染'
      }
    })

    const migrated = store.migrate(record.id, createNextSchema(), {
      allowPartial: true,
      note: '尝试升级模板'
    })

    expect(migrated).toMatchObject({
      applied: false,
      reason: 'blocked_by_policy',
      message: '已签名文书禁止直接迁移'
    })
    expect(store.get(record.id)?.template.version).toBe('1.0.0')
  })

  it('提供通用状态流转入口，并允许业务侧注入约束', () => {
    const workflowPolicy: ITemplateDocumentWorkflowPolicy = {
      beforeStatusChange: ({ previousStatus, nextStatus }) => {
        if (previousStatus === 'draft' && nextStatus === 'archived') {
          return {
            allowed: false,
            reason: 'direct_archive_not_allowed',
            message: '草稿不能直接归档'
          }
        }
        return undefined
      }
    }
    const store = new TemplateDocumentStore(storageKey, storage, workflowPolicy)
    const record = store.create({
      schema: createLegacySchema()
    })

    const blocked = store.setStatus(record.id, 'archived')
    expect(blocked).toMatchObject({
      applied: false,
      previousStatus: 'draft',
      nextStatus: 'archived',
      reason: 'blocked_by_policy',
      message: '草稿不能直接归档'
    })

    const signed = store.setStatus(record.id, 'signed')
    expect(signed).toMatchObject({
      applied: true,
      previousStatus: 'draft',
      nextStatus: 'signed'
    })
    expect(store.get(record.id)?.status).toBe('signed')
  })

  it('可先 fork 新文档再迁移，以支持业务侧实现复制新版本后升级', () => {
    const workflowPolicy: ITemplateDocumentWorkflowPolicy = {
      beforeMigrate: ({ currentDocument }) => {
        if (currentDocument.status === 'archived') {
          return {
            allowed: false,
            reason: 'archived_document_locked',
            message: '已归档文书需复制新版本后再迁移'
          }
        }
        return undefined
      }
    }
    const store = new TemplateDocumentStore(storageKey, storage, workflowPolicy)
    const archived = store.create({
      schema: createLegacySchema(),
      status: 'archived',
      flatValues: {
        patientName: '张三',
        diagnosis: '肺部感染',
        legacyRemark: '归档版本备注'
      }
    })

    const blocked = store.migrate(archived.id, createNextSchema(), {
      allowPartial: true
    })
    expect(blocked).toMatchObject({
      applied: false,
      reason: 'blocked_by_policy',
      message: '已归档文书需复制新版本后再迁移'
    })

    const forked = store.fork(archived.id, {
      reason: '基于归档版本生成修订稿'
    })

    expect(forked?.id).not.toBe(archived.id)
    expect(forked?.status).toBe('draft')
    expect(forked?.lineage).toMatchObject({
      sourceDocumentId: archived.id,
      sourceTemplateId: 'admission-record',
      sourceTemplateVersion: '1.0.0',
      reason: '基于归档版本生成修订稿'
    })

    const migrated = forked
      ? store.migrate(forked.id, createNextSchema(), {
        allowPartial: true,
        note: '升级到新模板版本'
      })
      : null

    expect(migrated?.applied).toBe(true)
    expect(migrated?.document?.template.version).toBe('1.1.0')
    expect(store.get(archived.id)?.template.version).toBe('1.0.0')
  })
})