import { describe, expect, it } from 'vitest'
import {
  resolveTemplateFieldMetadata,
  type ITemplateFieldMetadata,
  type ITemplateMetadataFieldSnapshotMap
} from '@/editor'

describe('resolveTemplateFieldMetadata', () => {
  it('优先返回 metadataFieldId 对应的主数据记录，并保留监听事件', () => {
    const metadata: ITemplateFieldMetadata = {
      metadataFieldId: 'meta-1',
      businessCode: 'legacy.patient.name',
      listeners: ['syncPatient'],
      tags: ['legacy-tag']
    }
    const metadataFieldsById: ITemplateMetadataFieldSnapshotMap = {
      'meta-1': {
        id: 'meta-1',
        code: 'patient.name',
        name: '患者姓名',
        group: '基本信息',
        dataSource: 'his.patient',
        permission: 'patient.read.basic',
        exportPath: 'patient.name',
        tags: ['master-tag']
      }
    }

    const resolved = resolveTemplateFieldMetadata(metadata, metadataFieldsById)

    expect(resolved).toMatchObject({
      metadataFieldId: 'meta-1',
      businessCode: 'patient.name',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.name',
      listeners: ['syncPatient'],
      tags: ['master-tag']
    })
  })

  it('主数据绑定失效时回退到字段自身元数据', () => {
    const metadata: ITemplateFieldMetadata = {
      metadataFieldId: 'missing-meta',
      businessCode: 'legacy.patient.name',
      group: '旧分组',
      dataSource: 'legacy.patient',
      permission: 'legacy.read',
      exportPath: 'legacy.patient.name'
    }

    const resolved = resolveTemplateFieldMetadata(metadata, {})

    expect(resolved).toEqual(metadata)
  })
})