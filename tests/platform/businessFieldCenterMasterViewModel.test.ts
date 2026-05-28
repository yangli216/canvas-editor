import { describe, expect, it } from 'vitest'
import {
  buildBusinessFieldCenterViewModel,
  type IBusinessFieldCenterFilters
} from '@/platform/emr-workbench/modules'
import type {
  IBusinessMetadataConflict,
  IBusinessMetadataField,
  IBusinessMetadataFieldCandidate,
  IBusinessMetadataHospitalFieldMapping,
  IBusinessMetadataTemplateBinding
} from '@/platform/emr-workbench/domain'

const filters: IBusinessFieldCenterFilters = {
  keyword: '',
  group: '',
  dataSource: '',
  permission: '',
  scope: 'all'
}

describe('buildBusinessFieldCenterViewModel', () => {
  it('会输出主数据摘要、绑定字段和冲突风险', () => {
    const metadataFields: IBusinessMetadataField[] = [
      {
        id: 'meta-1',
        code: 'patient.name',
        name: '患者姓名',
        group: '基本信息',
        dataSource: 'his.patient',
        permission: 'patient.read.basic',
        exportPath: 'patient.name',
        status: 'active',
        createdAt: 1,
        updatedAt: 1
      }
    ]
    const bindings: IBusinessMetadataTemplateBinding[] = [
      {
        templateId: 'tpl-1',
        templateName: '入院记录',
        templateCategory: '住院',
        fieldId: 'field-1',
        fieldLabel: '患者姓名',
        metadataFieldId: 'meta-1',
        bindMode: 'reference',
        boundAt: 1
      }
    ]
    const candidates: IBusinessMetadataFieldCandidate[] = [
      {
        code: 'patient.name',
        name: '患者姓名',
        group: '基本信息',
        dataSource: 'his.patient',
        permission: 'patient.read.basic',
        exportPath: 'patient.name',
        usageCount: 2,
        templateIds: ['tpl-1', 'tpl-2'],
        fieldIds: ['field-1', 'field-2']
      }
    ]
    const conflicts: IBusinessMetadataConflict[] = [
      {
        code: 'patient.name',
        reason: 'dataSourceMismatch',
        templateIds: ['tpl-1', 'tpl-2'],
        fieldIds: ['field-1', 'field-2']
      }
    ]
    const hospitalMappings: IBusinessMetadataHospitalFieldMapping[] = [
      {
        id: 'mapping-1',
        hospitalId: 'hospital-a',
        metadataFieldId: 'meta-1',
        vendorId: 'vendor-general',
        dataSource: 'his.patient',
        interfaceField: 'patient_name',
        createdAt: 1,
        updatedAt: 1
      }
    ]

    const model = buildBusinessFieldCenterViewModel({
      items: [],
      adapters: [],
      metadataFields,
      bindings,
      hospitalMappings,
      candidates,
      conflicts,
      filters
    })

    expect(model.summary.masterFieldText).toBe('1/1')
    expect(model.summary.boundFieldText).toBe('1/2')
    expect(model.summary.conflictCount).toBe(1)
    expect(model.fields[0]).toMatchObject({
      assetId: 'meta-1',
      label: '患者姓名',
      businessCode: 'patient.name',
      bindingCount: 1,
      hospitalMappingCount: 1,
      hospitalMappingText: '1 个医院映射',
      candidateCount: 1,
      statusText: '1 处引用'
    })
    expect(model.risks[0]).toMatchObject({
      code: 'patient.name',
      badgeText: '数据源冲突'
    })
  })

  it('会按分组、数据源和关键字筛选主数据字段', () => {
    const model = buildBusinessFieldCenterViewModel({
      items: [],
      adapters: [],
      metadataFields: [
        {
          id: 'meta-1',
          code: 'patient.name',
          name: '患者姓名',
          group: '基本信息',
          dataSource: 'his.patient',
          permission: 'patient.read.basic',
          exportPath: 'patient.name',
          status: 'active',
          createdAt: 1,
          updatedAt: 1
        },
        {
          id: 'meta-2',
          code: 'notes.chiefComplaint',
          name: '主诉',
          group: '病程记录',
          dataSource: 'emr.notes',
          permission: 'emr.read.note',
          exportPath: 'notes.chiefComplaint',
          status: 'active',
          createdAt: 1,
          updatedAt: 1
        }
      ],
      bindings: [],
      candidates: [],
      conflicts: [],
      filters: {
        ...filters,
        keyword: '主诉',
        group: '病程记录',
        dataSource: 'emr.notes'
      }
    })

    expect(model.fields).toHaveLength(1)
    expect(model.fields[0].assetId).toBe('meta-2')
    expect([...model.filters.groups].sort()).toEqual(['基本信息', '病程记录'].sort())
    expect(model.filters.dataSources).toEqual(['emr.notes', 'his.patient'])
  })

  it('会输出待生成或待绑定的主数据候选', () => {
    const candidates: IBusinessMetadataFieldCandidate[] = [
      {
        code: 'patient.gender',
        name: '性别',
        group: '基本信息',
        dataSource: 'his.patient',
        permission: 'patient.read.basic',
        exportPath: 'patient.gender',
        usageCount: 1,
        templateIds: ['tpl-1'],
        fieldIds: ['field-1']
      },
      {
        code: 'patient.name',
        name: '患者姓名',
        group: '基本信息',
        dataSource: 'his.patient',
        permission: 'patient.read.basic',
        exportPath: 'patient.name',
        usageCount: 2,
        templateIds: ['tpl-1', 'tpl-2'],
        fieldIds: ['field-2', 'field-3']
      }
    ]
    const metadataFields: IBusinessMetadataField[] = [
      {
        id: 'meta-1',
        code: 'patient.name',
        name: '患者姓名',
        group: '基本信息',
        dataSource: 'his.patient',
        permission: 'patient.read.basic',
        exportPath: 'patient.name',
        status: 'active',
        createdAt: 1,
        updatedAt: 1
      }
    ]
    const bindings: IBusinessMetadataTemplateBinding[] = [
      {
        templateId: 'tpl-1',
        templateName: '入院记录',
        templateCategory: '住院',
        fieldId: 'field-2',
        fieldLabel: '患者姓名',
        metadataFieldId: 'meta-1',
        bindMode: 'reference',
        boundAt: 1
      }
    ]

    const model = buildBusinessFieldCenterViewModel({
      items: [
        {
          id: 'tpl-1',
          name: '入院记录',
          category: '住院',
          builtIn: false,
          updatedAt: 1,
          entry: { schema: { id: 'tpl-1', version: '1.0.0', name: '入院记录', blocks: [] } },
          fieldCount: 1,
          businessFieldCount: 1,
          dataSourceCount: 1,
          admissionReport: { dataBindingCoverage: 100, issues: [] }
        },
        {
          id: 'tpl-2',
          name: '病程记录',
          category: '住院',
          builtIn: false,
          updatedAt: 1,
          entry: { schema: { id: 'tpl-2', version: '1.0.0', name: '病程记录', blocks: [] } },
          fieldCount: 1,
          businessFieldCount: 1,
          dataSourceCount: 1,
          admissionReport: { dataBindingCoverage: 100, issues: [] }
        }
      ],
      adapters: [],
      metadataFields,
      bindings,
      candidates,
      conflicts: [],
      filters
    })

    expect(
      model.pendingCandidates.map(item => ({
        code: item.code,
        pendingUsageCount: item.pendingUsageCount,
        metadataFieldId: item.metadataFieldId
      })).sort((a, b) => a.code.localeCompare(b.code))
    ).toEqual([
      {
        code: 'patient.gender',
        pendingUsageCount: 1,
        metadataFieldId: undefined
      },
      {
        code: 'patient.name',
        pendingUsageCount: 1,
        metadataFieldId: 'meta-1'
      }
    ])
  })
})