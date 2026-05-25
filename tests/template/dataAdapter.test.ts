import { describe, expect, it, vi } from 'vitest'
import {
  createMockHisAdapter,
  createTemplateRuntime,
  ListStyle,
  ListType,
  TemplateDataAdapterRegistry,
  type ITemplateSchema
} from '@/editor'

function createMockEditor(initialValues: Record<string, string | any[] | null> = {}) {
  const values = new Map(Object.entries(initialValues))
  return {
    values,
    editor: {
      command: {
        getControlValue: vi.fn(({ conceptId }: { conceptId?: string }) => {
          if (!conceptId) return null
          const value = values.get(conceptId) ?? null
          return Array.isArray(value)
            ? value.map(item => ({
                value:
                  typeof item === 'object' && item !== null && 'value' in item
                    ? item.value ?? null
                    : item ?? null
              }))
            : [{ value }]
        }),
        executeSetControlValueList: vi.fn(
          (payload: Array<{ conceptId?: string; value: string | any[] | null }>) => {
            payload.forEach(item => {
              if (!item.conceptId) return
              values.set(item.conceptId, item.value ?? null)
            })
          }
        )
      },
      eventBus: {
        on: vi.fn(),
        off: vi.fn(),
        emit() {}
      }
    }
  }
}

const schema: ITemplateSchema = {
  version: '1.0.0',
  id: 'his-test',
  name: 'HIS 接入测试',
  blocks: [
    {
      type: 'section',
      id: 'patient',
      title: '基本信息',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'patientName',
              type: 'text',
              label: '姓名',
              required: true,
              metadata: {
                businessCode: 'patient.name',
                dataSource: 'his.patient',
                group: 'patient'
              }
            },
            {
              id: 'patientGender',
              type: 'select',
              label: '性别',
              options: [
                { label: '男', value: '男' },
                { label: '女', value: '女' }
              ],
              metadata: {
                businessCode: 'patient.gender',
                dataSource: 'his.patient',
                group: 'patient'
              }
            },
            {
              id: 'patientAge',
              type: 'number',
              label: '年龄',
              metadata: {
                businessCode: 'patient.age',
                dataSource: 'his.patient',
                exportPath: 'encounter.patient.age',
                group: 'patient'
              }
            }
          ]
        }
      ]
    },
    {
      type: 'section',
      id: 'notes',
      title: '主诉',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'chiefComplaint',
              type: 'textarea',
              label: '主诉',
              metadata: {
                businessCode: 'notes.chiefComplaint',
                dataSource: 'emr.notes',
                exportPath: 'encounter.subjective.chiefComplaint',
                group: 'subjective'
              }
            }
          ]
        }
      ]
    },
    {
      type: 'section',
      id: 'unmatched',
      title: '未接入',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'remoteFlag',
              type: 'text',
              label: '远程标记',
              metadata: {
                businessCode: 'extension.remote',
                dataSource: 'unknown-source'
              }
            }
          ]
        }
      ]
    }
  ]
}

const listSchema: ITemplateSchema = {
  version: '1.0.0',
  id: 'his-list-test',
  name: 'HIS 列表接入测试',
  blocks: [
    {
      type: 'fieldRow',
      fields: [
        {
          id: 'orderSummaryList',
          type: 'textarea',
          label: '处方列表',
          metadata: {
            businessCode: 'order.summaryList',
            dataSource: 'his.order'
          },
          valueRender: {
            mode: 'list',
            listType: ListType.OL,
            listStyle: ListStyle.DECIMAL
          }
        }
      ]
    }
  ]
}

describe('template data adapter', () => {
  it('mock HIS adapter 能按 businessCode 解析病人数据', async () => {
    const { editor, values } = createMockEditor()
    const adapter = createMockHisAdapter()
    const registry = new TemplateDataAdapterRegistry()
    registry.register(adapter)

    const runtime = createTemplateRuntime(editor as any, schema)
    const result = await runtime.applyAdapterValues({
      registry,
      context: { variables: { patientId: 'P-1001' } }
    })

    expect(result.appliedFieldIds.sort()).toEqual(
      ['patientAge', 'patientGender', 'patientName', 'chiefComplaint'].sort()
    )
    expect(values.get('patientName')).toBe('张三')
    expect(values.get('patientGender')).toBe('男')
    expect(values.get('patientAge')).toBe('58')
    expect(values.get('chiefComplaint')).toBe('反复胸闷、胸痛 3 月，加重 1 周')
    expect(result.unresolvedFieldIds).toContain('remoteFlag')
    expect(result.diagnostics.some(item => item.includes('unknown-source'))).toBe(
      true
    )
  })

  it('未指定 patientId 时返回诊断信息但不会写入字段', async () => {
    const { editor, values } = createMockEditor()
    const adapter = createMockHisAdapter()
    const registry = new TemplateDataAdapterRegistry()
    registry.register(adapter)

    const runtime = createTemplateRuntime(editor as any, schema)
    const result = await runtime.applyAdapterValues({ registry })

    expect(result.appliedFieldIds).toHaveLength(0)
    expect(values.size).toBe(0)
    expect(result.diagnostics.some(item => item.includes('未指定 patientId'))).toBe(
      true
    )
  })

  it('结构化导出能从适配器注入的值中按 dataSource 分组', async () => {
    const { editor } = createMockEditor()
    const adapter = createMockHisAdapter()
    const registry = new TemplateDataAdapterRegistry()
    registry.register(adapter)

    const runtime = createTemplateRuntime(editor as any, schema)
    await runtime.applyAdapterValues({
      registry,
      context: { variables: { patientId: 'P-1002' } }
    })

    const structured = runtime.extract()
    expect(structured.structuredByDataSource['his.patient']).toMatchObject({
      patient: { name: '李娜', gender: '女' }
    })
    expect(
      (structured.structuredByDataSource['emr.notes'] as Record<string, any>)
        ?.encounter?.subjective?.chiefComplaint
    ).toBe('咳嗽、咳痰伴发热 5 天')
  })

  it('adapter 返回数组值时，文本字段可按列表配置写入列表元素', async () => {
    const { editor, values } = createMockEditor()
    const adapter = createMockHisAdapter()
    const registry = new TemplateDataAdapterRegistry()
    registry.register(adapter)

    const runtime = createTemplateRuntime(editor as any, listSchema)
    const result = await runtime.applyAdapterValues({
      registry,
      context: { variables: { patientId: 'P-1001' } }
    })

    expect(result.appliedFieldIds).toEqual(['orderSummaryList'])
    expect(values.get('orderSummaryList')).toEqual([
      expect.objectContaining({
        value: '\u200B',
        listType: ListType.OL,
        listStyle: ListStyle.DECIMAL
      }),
      expect.objectContaining({
        value: '阿司匹林肠溶片 100mg qd 口服',
        listType: ListType.OL,
        listStyle: ListStyle.DECIMAL
      }),
      expect.objectContaining({
        value: '\u200B',
        listType: ListType.OL,
        listStyle: ListStyle.DECIMAL
      }),
      expect.objectContaining({
        value: '阿托伐他汀钙片 20mg qn 口服',
        listType: ListType.OL,
        listStyle: ListStyle.DECIMAL
      })
    ])
  })

  it('适配器注册表能按 dataSource 反查并支持取消注册', () => {
    const registry = new TemplateDataAdapterRegistry()
    const adapter = createMockHisAdapter({ id: 'mock-his-test' })
    registry.register(adapter)
    expect(registry.getByDataSource('his.patient')?.id).toBe('mock-his-test')
    expect(registry.list()).toHaveLength(1)
    registry.unregister(adapter.id)
    expect(registry.getByDataSource('his.patient')).toBeUndefined()
    expect(registry.list()).toHaveLength(0)
  })

  it('运行时能输出业务数据绑定预检摘要', () => {
    const { editor } = createMockEditor()
    const registry = new TemplateDataAdapterRegistry()
    registry.register(createMockHisAdapter({ id: 'mock-his-test' }))

    const runtime = createTemplateRuntime(editor as any, schema)
    const inspection = runtime.inspectDataBinding({ registry })

    expect(inspection.totalFieldCount).toBe(5)
    expect(inspection.businessFieldCount).toBe(5)
    expect(inspection.boundDataSourceCount).toBe(3)
    expect(inspection.adapterCoveredFieldCount).toBe(4)
    expect(inspection.requiredFieldCount).toBe(1)
    expect(inspection.requiredEmptyFieldCount).toBe(1)
    expect(
      inspection.dataSources.find(item => item.dataSource === 'his.patient')
        ?.adapterId
    ).toBe('mock-his-test')
    expect(
      inspection.issues.some(
        item => item.type === 'missingAdapter' && item.fieldId === 'remoteFlag'
      )
    ).toBe(true)
    expect(
      inspection.issues.some(
        item => item.type === 'requiredEmpty' && item.fieldId === 'patientName'
      )
    ).toBe(true)
  })
})
