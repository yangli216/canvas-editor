import { beforeEach, describe, expect, it } from 'vitest'
import {
  analyzeTemplateDocumentMigration,
  TemplateDocumentStore,
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

  beforeEach(() => {
    localStorage.removeItem(storageKey)
  })

  it('病历实例保存时会绑定模板快照和字段值', () => {
    const store = new TemplateDocumentStore(storageKey)
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

    const restored = new TemplateDocumentStore(storageKey).get(record.id)
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
    const store = new TemplateDocumentStore(storageKey)
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
})