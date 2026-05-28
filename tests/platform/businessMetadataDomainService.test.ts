import { describe, expect, it } from 'vitest'
import {
  BusinessMetadataDomainService,
  type IBusinessMetadataFieldInput,
  type IBusinessMetadataTemplateFieldAsset
} from '@/platform/emr-workbench/domain'

describe('BusinessMetadataDomainService', () => {
  it('默认会加载常用电子病历主数据', () => {
    const service = new BusinessMetadataDomainService()
    const fields = service.listFields()

    expect(fields.length).toBeGreaterThanOrEqual(12)
    expect(fields).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'patient.name',
        name: '患者姓名',
        group: '基本信息'
      }),
      expect.objectContaining({
        code: 'encounter.admissionTime',
        name: '入院时间',
        group: '就诊信息'
      }),
      expect.objectContaining({
        code: 'notes.chiefComplaint',
        name: '主诉',
        group: '病程记录'
      }),
      expect.objectContaining({
        code: 'diagnosis.primary',
        name: '主要诊断',
        group: '诊断信息'
      })
    ]))
  })

  it('会创建字段主数据并允许模板字段绑定和解绑', () => {
    const service = new BusinessMetadataDomainService({
      includeDefaultFields: false
    })
    const fieldInput: IBusinessMetadataFieldInput = {
      code: 'patient.name',
      name: '患者姓名',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.name'
    }
    const field = service.createField(fieldInput)

    service.bindTemplateField({
      templateId: 'tpl-1',
      templateName: '入院记录',
      templateCategory: '住院',
      fieldId: 'field-1',
      fieldLabel: '患者姓名',
      metadataFieldId: field.id
    })

    expect(service.listFields()).toHaveLength(1)
    expect(service.getFieldUsage(field.id)).toMatchObject([
      {
        templateId: 'tpl-1',
        fieldId: 'field-1',
        fieldLabel: '患者姓名'
      }
    ])

    service.unbindTemplateField({
      templateId: 'tpl-1',
      fieldId: 'field-1'
    })

    expect(service.getFieldUsage(field.id)).toEqual([])
  })

  it('会从模板字段资产生成候选并识别同码冲突', () => {
    const service = new BusinessMetadataDomainService({
      includeDefaultFields: false
    })
    const assets: IBusinessMetadataTemplateFieldAsset[] = [
      {
        templateId: 'tpl-1',
        templateName: '入院记录',
        templateCategory: '住院',
        fieldId: 'field-a',
        fieldLabel: '患者姓名',
        metadata: {
          businessCode: 'patient.name',
          group: '基本信息',
          dataSource: 'his.patient',
          permission: 'patient.read.basic',
          exportPath: 'patient.name'
        }
      },
      {
        templateId: 'tpl-2',
        templateName: '病程记录',
        templateCategory: '住院',
        fieldId: 'field-b',
        fieldLabel: '患者姓名',
        metadata: {
          businessCode: 'patient.name',
          group: '基本信息',
          dataSource: 'emr.patient',
          permission: 'patient.read.basic',
          exportPath: 'patient.name'
        }
      }
    ]

    const snapshot = service.buildFieldCandidatesFromTemplates(assets)

    expect(snapshot.candidates).toHaveLength(1)
    expect(snapshot.candidates[0]).toMatchObject({
      code: 'patient.name',
      name: '患者姓名',
      usageCount: 2
    })
    expect(snapshot.conflicts).toMatchObject([
      {
        code: 'patient.name',
        reason: 'dataSourceMismatch',
        templateIds: ['tpl-1', 'tpl-2']
      }
    ])
  })

  it('会基于模板字段资产初始化主数据并保留已存在主记录', () => {
    const service = new BusinessMetadataDomainService({
      includeDefaultFields: false
    })
    const existing = service.createField({
      code: 'patient.name',
      name: '患者姓名',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.name'
    })

    service.syncFieldsFromTemplateAssets([
      {
        templateId: 'tpl-1',
        templateName: '入院记录',
        templateCategory: '住院',
        fieldId: 'field-a',
        fieldLabel: '患者姓名',
        metadata: {
          metadataFieldId: existing.id,
          businessCode: 'patient.name',
          group: '基本信息',
          dataSource: 'his.patient',
          permission: 'patient.read.basic',
          exportPath: 'patient.name'
        }
      },
      {
        templateId: 'tpl-2',
        templateName: '病程记录',
        templateCategory: '住院',
        fieldId: 'field-b',
        fieldLabel: '主诉',
        metadata: {
          businessCode: 'notes.chiefComplaint',
          group: '病程记录',
          dataSource: 'emr.notes',
          permission: 'emr.read.note',
          exportPath: 'notes.chiefComplaint'
        }
      }
    ])

    const fields = service.listFields()
    expect(fields).toHaveLength(2)
    expect(fields.find(item => item.code === 'patient.name')?.id).toBe(existing.id)
    expect(fields.find(item => item.code === 'notes.chiefComplaint')).toMatchObject({
      group: '病程记录',
      dataSource: 'emr.notes'
    })
    expect(service.listBindings()).toMatchObject([
      {
        templateId: 'tpl-1',
        fieldId: 'field-a',
        metadataFieldId: existing.id
      }
    ])

    service.updateField(existing.id, {
      name: '患者姓名（标准）',
      dataSource: 'empi.patient'
    })

    expect(service.listFields().find(item => item.id === existing.id)).toMatchObject({
      name: '患者姓名（标准）',
      dataSource: 'empi.patient'
    })
  })

  it('会按医院、科室和文书类型解析字段映射并转换字典值', () => {
    const service = new BusinessMetadataDomainService({
      includeDefaultFields: false
    })
    const gender = service.createField({
      code: 'patient.gender',
      name: '性别',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.gender'
    })

    service.upsertHospitalFieldMapping({
      hospitalId: 'hospital-a',
      metadataFieldId: gender.id,
      vendorId: 'vendor-general',
      dataSource: 'his.patient',
      interfaceField: 'gender_code',
      contextKey: 'patientGender',
      dictionaryCode: 'gender',
      defaultValue: '9'
    })
    service.upsertHospitalFieldMapping({
      hospitalId: 'hospital-a',
      departmentId: 'cardiology',
      documentType: 'admission',
      metadataFieldId: gender.id,
      vendorId: 'vendor-cardiology',
      dataSource: 'his.inpatient',
      interfaceField: 'PAT_SEX',
      dictionaryCode: 'gender'
    })
    service.upsertDictionaryMapping({
      hospitalId: 'hospital-a',
      dictionaryCode: 'gender',
      sourceValue: '男',
      targetValue: '1',
      label: '男性'
    })

    const resolved = service.resolveHospitalFieldMappings({
      hospitalId: 'hospital-a',
      departmentId: 'cardiology',
      documentType: 'admission',
      metadataFieldIds: [gender.id]
    })

    expect(resolved).toMatchObject([
      {
        metadataFieldId: gender.id,
        vendorId: 'vendor-cardiology',
        dataSource: 'his.inpatient',
        interfaceField: 'PAT_SEX',
        dictionaryCode: 'gender'
      }
    ])
    expect(service.translateDictionaryValue({
      hospitalId: 'hospital-a',
      dictionaryCode: 'gender',
      value: '男'
    })).toBe('1')
    expect(service.translateDictionaryValue({
      hospitalId: 'hospital-a',
      dictionaryCode: 'gender',
      value: '未知'
    })).toBe('未知')
  })

  it('会为医院映射生成版本快照、执行预检并比较差异', () => {
    const service = new BusinessMetadataDomainService({
      includeDefaultFields: false
    })
    const name = service.createField({
      code: 'patient.name',
      name: '患者姓名',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.name'
    })
    const gender = service.createField({
      code: 'patient.gender',
      name: '性别',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.gender'
    })

    service.upsertHospitalFieldMapping({
      hospitalId: 'hospital-a',
      metadataFieldId: name.id,
      vendorId: 'vendor-a',
      dataSource: 'his.patient',
      interfaceField: 'patient_name'
    })
    const baseline = service.createHospitalMappingSnapshot({
      hospitalId: 'hospital-a',
      version: 'v1',
      note: '首版映射'
    })

    service.upsertHospitalFieldMapping({
      hospitalId: 'hospital-a',
      metadataFieldId: name.id,
      vendorId: 'vendor-a',
      dataSource: 'his.patient.master',
      interfaceField: 'PAT_NAME'
    })
    service.upsertHospitalFieldMapping({
      hospitalId: 'hospital-a',
      metadataFieldId: gender.id,
      vendorId: 'vendor-a',
      dataSource: 'his.patient.master',
      interfaceField: 'PAT_SEX',
      dictionaryCode: 'gender'
    })
    const next = service.createHospitalMappingSnapshot({
      hospitalId: 'hospital-a',
      version: 'v2'
    })

    const precheck = service.precheckHospitalMappings({
      hospitalId: 'hospital-a',
      requiredMetadataFieldIds: [name.id, gender.id],
      requiredDictionaryCodes: ['gender']
    })
    const diff = service.compareHospitalMappingSnapshots(baseline.id, next.id)

    expect(precheck).toMatchObject({
      status: 'warning',
      mappedFieldCount: 2,
      missingFieldIds: [],
      missingDictionaryCodes: ['gender']
    })
    expect(diff).toMatchObject({
      addedCount: 1,
      changedCount: 1,
      removedCount: 0
    })
    expect(diff.changed[0]).toMatchObject({
      metadataFieldId: name.id,
      beforeInterfaceField: 'patient_name',
      afterInterfaceField: 'PAT_NAME'
    })
  })
})