import { describe, expect, it } from 'vitest'
import {
  applyBusinessFieldQuickPreset,
  getBusinessFieldQuickPresets,
  recommendBusinessFieldQuickPresets
} from '@/platform/emr-workbench/modules'
import type { ITemplateField } from '@/editor'

describe('business field quick presets', () => {
  it('会暴露可用于业务字段中心的一键快配预设', () => {
    const presets = getBusinessFieldQuickPresets()

    expect(presets.length).toBeGreaterThanOrEqual(6)
    expect(presets.map(item => item.id)).toContain('patient-name')
    expect(presets.map(item => item.id)).toContain('chief-complaint')
  })

  it('套用快配时会同时更新控件类型和业务绑定元数据', () => {
    const presets = getBusinessFieldQuickPresets()
    const chiefComplaintPreset = presets.find(item => item.id === 'chief-complaint')
    const field: ITemplateField = {
      id: 'field-1',
      type: 'text',
      label: '待配置字段',
      metadata: {
        listeners: ['change']
      },
      style: {
        bold: false
      }
    }

    const updated = applyBusinessFieldQuickPreset(field, chiefComplaintPreset!)

    expect(updated.type).toBe('textarea')
    expect(updated.required).toBe(true)
    expect(updated.placeholder).toContain('概括主要症状')
    expect(updated.metadata).toMatchObject({
      businessCode: 'notes.chiefComplaint',
      dataSource: 'emr.notes',
      group: '病程记录',
      permission: 'emr.read.note',
      exportPath: 'notes.chiefComplaint',
      listeners: ['change']
    })
  })

  it('会按字段名和标签智能推荐更可能命中的快配', () => {
    const recommendations = recommendBusinessFieldQuickPresets({
      id: 'patientName',
      label: '患者姓名',
      placeholder: '请输入姓名'
    })

    expect(recommendations[0]?.id).toBe('patient-name')
    expect(recommendations.map(item => item.id)).toContain('patient-name')
  })
})