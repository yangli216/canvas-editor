import { describe, expect, it, vi } from 'vitest'
import {
  PropertiesPanel,
  type ITemplateMetadataFieldBindingOption
} from '@/components/template-designer/PropertiesPanel'
import { TemplateDesigner } from '@/components/template-designer/TemplateDesigner'
import type { SelectionTarget } from '@/components/template-designer/SchemaCanvas'
import type { ITemplateBlock } from '@/editor/template'

describe('PropertiesPanel 主数据绑定', () => {
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
    },
    {
      id: 'meta-2',
      code: 'encounter.bedNo',
      name: '床号',
      group: '就诊信息',
      dataSource: 'his.encounter',
      permission: 'encounter.read.basic',
      exportPath: 'encounter.bedNo',
      tags: ['encounter']
    }
  ]

  it('选择主数据后会同时写入 metadataFieldId 和本地回退元数据', () => {
    const onFieldChange = vi.fn()
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

  it('字段行可以双击业务数据元快速新增已绑定字段', () => {
    const onAddField = vi.fn()
    const blocks: ITemplateBlock[] = [
      {
        type: 'fieldRow',
        fields: []
      }
    ]

    const panel = new PropertiesPanel({
      onBlockChange: () => {},
      onFieldChange: () => {},
      onAddField,
      metadataFields
    })

    panel.update(blocks, { kind: 'block', blockIndex: 0 })

    const quickAddButton = Array.from(
      panel.getElement().querySelectorAll('button')
    ).find(button =>
      button.textContent?.includes('患者姓名') && button.draggable
    )

    expect(quickAddButton).toBeTruthy()
    quickAddButton?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

    expect(onAddField).toHaveBeenCalledWith(0, metadataFields[0])
  })

  it('字段行可以过滤定位业务数据元', () => {
    const blocks: ITemplateBlock[] = [
      {
        type: 'fieldRow',
        fields: []
      }
    ]

    const panel = new PropertiesPanel({
      onBlockChange: () => {},
      onFieldChange: () => {},
      onAddField: () => {},
      metadataFields
    })

    panel.update(blocks, { kind: 'block', blockIndex: 0 })

    const search = panel.getElement().querySelector(
      '[data-testid="business-metadata-field-search"]'
    ) as HTMLInputElement | null

    expect(search).toBeTruthy()
    search!.value = '床号'
    search!.dispatchEvent(new Event('input', { bubbles: true }))

    const visibleCards = Array.from(
      panel.getElement().querySelectorAll<HTMLButtonElement>(
        '.td-props__metadata-source-card:not([hidden])'
      )
    )

    expect(visibleCards).toHaveLength(1)
    expect(visibleCards[0].textContent).toContain('床号')
  })

  it('字段行可以接收拖拽业务数据元新增已绑定字段', () => {
    const onAddField = vi.fn()
    const blocks: ITemplateBlock[] = [
      {
        type: 'fieldRow',
        fields: []
      }
    ]
    const data = new Map<string, string>()
    const dataTransfer = {
      types: [] as string[],
      setData: (type: string, value: string) => {
        data.set(type, value)
        if (!dataTransfer.types.includes(type)) {
          dataTransfer.types.push(type)
        }
      },
      getData: (type: string) => data.get(type) ?? '',
      effectAllowed: '',
      dropEffect: ''
    }

    const panel = new PropertiesPanel({
      onBlockChange: () => {},
      onFieldChange: () => {},
      onAddField,
      metadataFields
    })

    panel.update(blocks, { kind: 'block', blockIndex: 0 })

    const quickAddButton = Array.from(
      panel.getElement().querySelectorAll('button')
    ).find(button =>
      button.textContent?.includes('患者姓名') && button.draggable
    )
    const dropZone = panel.getElement().querySelector(
      '[data-testid="business-metadata-field-drop-zone"]'
    )

    expect(quickAddButton).toBeTruthy()
    expect(dropZone).toBeTruthy()

    const dragStart = new Event('dragstart', { bubbles: true })
    Object.defineProperty(dragStart, 'dataTransfer', { value: dataTransfer })
    quickAddButton?.dispatchEvent(dragStart)

    const drop = new Event('drop', { bubbles: true, cancelable: true })
    Object.defineProperty(drop, 'dataTransfer', { value: dataTransfer })
    dropZone?.dispatchEvent(drop)

    expect(onAddField).toHaveBeenCalledWith(0, metadataFields[0])
  })

  it('设计器从属性栏业务数据元新增字段时会生成主数据绑定字段', () => {
    const onSave = vi.fn()
    const designer = new TemplateDesigner({
      onSave,
      onClose: () => {},
      metadataFields
    }, {
      id: 'tpl-1',
      name: '测试模板',
      version: '1.0.0',
      blocks: [
        {
          type: 'fieldRow',
          fields: []
        }
      ]
    })

    ;(designer as any).props.options.onAddField(0, metadataFields[0])
    ;(designer as any)._handleSave()

    const savedField = onSave.mock.calls[0][0].blocks[0].fields[0]

    expect(savedField.label).toBe('患者姓名')
    expect(savedField.metadata).toMatchObject({
      metadataFieldId: 'meta-1',
      businessCode: 'patient.name',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.name'
    })
  })
})