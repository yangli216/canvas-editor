import { describe, expect, it, vi } from 'vitest'
import {
  PropertiesPanel,
  type ITemplateMetadataFieldBindingOption
} from '@/components/template-designer/PropertiesPanel'
import type { SelectionTarget } from '@/components/template-designer/SchemaCanvas'
import type { ITemplateBlock } from '@/editor/template'

describe('PropertiesPanel 主数据绑定', () => {
  it('选择主数据后会同时写入 metadataFieldId 和本地回退元数据', () => {
    const onFieldChange = vi.fn()
    const metadataFields: ITemplateMetadataFieldBindingOption[] = [
      {
        id: 'meta-1',
        code: 'patient.name',
        name: '患者姓名',
        group: '基本信息',
        dataSource: 'his.patient',
        permission: 'patient.read.basic',
        exportPath: 'patient.name',
        tags: ['core']
      }
    ]
    const blocks: ITemplateBlock[] = [
      {
        type: 'fieldRow',
        fields: [
          {
            id: 'field-1',
            type: 'text',
            label: '患者姓名',
            metadata: {
              listeners: ['sync.patient']
            }
          }
        ]
      }
    ]
    const selection: SelectionTarget = {
      kind: 'field',
      blockIndex: 0,
      fieldId: 'field-1'
    }

    const panel = new PropertiesPanel({
      onBlockChange: () => {},
      onFieldChange,
      onAddField: () => {},
      metadataFields
    })

    panel.update(blocks, selection)

    const bindingSelect = Array.from(panel.getElement().querySelectorAll('select'))
      .find(select => Array.from(select.options).some(option => option.textContent === '未绑定主数据'))

    expect(bindingSelect).toBeTruthy()

    ;(bindingSelect as HTMLSelectElement).value = 'meta-1'
    bindingSelect?.dispatchEvent(new Event('change', { bubbles: true }))

    expect(onFieldChange).toHaveBeenCalledTimes(1)
    const updatedField = onFieldChange.mock.calls[0][2]

    expect(updatedField.metadata).toMatchObject({
      metadataFieldId: 'meta-1',
      businessCode: 'patient.name',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.name',
      tags: ['core'],
      listeners: ['sync.patient']
    })
  })
})