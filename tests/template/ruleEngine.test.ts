import { afterEach, describe, expect, it, vi } from 'vitest'
import { TemplateRuleEngine } from '@/editor/template/TemplateRuleEngine'
import type { ITemplateSchema } from '@/editor'

function createRuleEngineEditor(initialValues: Record<string, string | null>) {
  const values = new Map(Object.entries(initialValues))
  const subscriptions = new Map<string, Set<(payload: any) => void>>()
  const executeSetControlPropertiesList = vi.fn()
  const executeSetControlValue = vi.fn()
  const executeSetControlValueList = vi.fn((payload: Array<{ conceptId?: string; value: string | null }>) => {
    payload.forEach(item => {
      if (!item.conceptId) return
      values.set(item.conceptId, item.value ?? null)
    })
  })

  return {
    values,
    executeSetControlPropertiesList,
    executeSetControlValue,
    executeSetControlValueList,
    editor: {
      command: {
        getControlValue: vi.fn(({ conceptId }: { conceptId?: string }) => {
          if (!conceptId) return null
          return [{ value: values.get(conceptId) ?? null }]
        }),
        executeSetControlPropertiesList,
        executeSetControlValue,
        executeSetControlValueList
      },
      eventBus: {
        on: vi.fn((event: string, handler: (payload: any) => void) => {
          const list = subscriptions.get(event) ?? new Set()
          list.add(handler)
          subscriptions.set(event, list)
        }),
        off: vi.fn((event: string, handler: (payload: any) => void) => {
          subscriptions.get(event)?.delete(handler)
        }),
        emit(event: string, payload: any) {
          subscriptions.get(event)?.forEach(handler => handler(payload))
        }
      }
    }
  }
}

describe('TemplateRuleEngine', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('基于运行时索引评估字段级和块级规则', () => {
    vi.useFakeTimers()

    const schema: ITemplateSchema = {
      version: '1.0.0',
      id: 'rule-template',
      name: '规则模板',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'gender',
              type: 'select',
              label: '性别',
              metadata: {
                businessCode: 'patient.gender'
              },
              options: [{ label: '男' }, { label: '女' }]
            }
          ]
        },
        {
          type: 'section',
          id: 'subjective',
          title: '主诉',
          rules: [
            {
              type: 'hidden',
              condition: {
                field: 'patient.gender',
                fieldType: 'businessCode',
                operator: 'equals',
                value: '男'
              }
            }
          ],
          blocks: [
            {
              type: 'fieldRow',
              fields: [
                {
                  id: 'chiefComplaint',
                  type: 'textarea',
                  label: '主诉',
                  rules: [
                    {
                      type: 'readonly',
                      condition: {
                        field: 'patient.gender',
                        fieldType: 'businessCode',
                        operator: 'equals',
                        value: '女'
                      }
                    }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }

    const { editor, values, executeSetControlPropertiesList } = createRuleEngineEditor({
      gender: '女',
      chiefComplaint: '咽痛2天'
    })

    const engine = new TemplateRuleEngine(editor as any, schema)
    vi.runAllTimers()

    expect(executeSetControlPropertiesList).toHaveBeenCalledWith([
      {
        conceptId: 'chiefComplaint',
        properties: {
          disabled: true,
          hide: false
        }
      }
    ])

    executeSetControlPropertiesList.mockClear()
    values.set('gender', '男')
    editor.eventBus.emit('controlContentChange', {
      control: { conceptId: 'gender' },
      controlId: 'ctrl-gender'
    })

    expect(executeSetControlPropertiesList).toHaveBeenCalledWith([
      {
        conceptId: 'chiefComplaint',
        properties: {
          disabled: false,
          hide: true
        }
      }
    ])

    engine.dispose()
  })

  it('支持按业务编码目标执行级联赋值', () => {
    vi.useFakeTimers()

    const schema: ITemplateSchema = {
      version: '1.0.0',
      id: 'rule-cascade-template',
      name: '级联模板',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'temperatureLevel',
              type: 'select',
              label: '体温等级',
              options: [{ label: '高热' }, { label: '正常' }],
              rules: [
                {
                  type: 'cascade',
                  cascade: {
                    targetField: 'vitals.temperature',
                    targetFieldType: 'businessCode',
                    valueMap: {
                      高热: '39.5',
                      正常: '36.8'
                    }
                  }
                }
              ]
            },
            {
              id: 'temperature',
              type: 'text',
              label: '体温',
              metadata: {
                businessCode: 'vitals.temperature'
              }
            }
          ]
        }
      ]
    }

    const {
      editor,
      values,
      executeSetControlValueList
    } = createRuleEngineEditor({
      temperatureLevel: '高热',
      temperature: '38.0'
    })

    const engine = new TemplateRuleEngine(editor as any, schema)
    vi.runAllTimers()

    expect(executeSetControlValueList).toHaveBeenCalledWith([
      {
        conceptId: 'temperature',
        value: '39.5'
      }
    ])
    expect(values.get('temperature')).toBe('39.5')

    engine.dispose()
  })
})