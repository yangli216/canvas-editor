import { describe, expect, it } from 'vitest'
import {
  compileTemplate,
  ControlType,
  ElementType,
  TitleLevel,
  type ITemplateSchema
} from '@/editor'

describe('template compiler', () => {
  const schema: ITemplateSchema = {
    version: '1.0.0',
    id: 'test-template',
    name: '测试模板',
    header: [
      {
        type: 'paragraph',
        segments: [{ type: 'text', value: '页眉标题' }]
      }
    ],
    blocks: [
      {
        type: 'fieldRow',
        fields: [
          {
            id: 'patientName',
            type: 'text',
            label: '姓名',
            placeholder: '请输入姓名',
            required: true
          },
          {
            id: 'gender',
            type: 'select',
            label: '性别',
            options: [{ label: '男' }, { label: '女' }]
          }
        ]
      },
      {
        type: 'section',
        title: '现病史',
        level: TitleLevel.FIRST,
        blocks: [
          {
            type: 'paragraph',
            segments: [
              {
                type: 'text',
                value: '内容'
              },
              {
                type: 'field',
                field: {
                  id: 'history',
                  type: 'textarea',
                  width: 300,
                  rules: [
                    {
                      type: 'visibility',
                      condition: {
                        field: 'gender',
                        operator: 'equals',
                        value: '女'
                      }
                    }
                  ]
                }
              }
            ]
          }
        ]
      }
    ],
    footer: [
      {
        type: 'paragraph',
        segments: [{ type: 'text', value: '页脚文案' }]
      }
    ]
  }

  it('编译出 header、main、footer', () => {
    const result = compileTemplate(schema)

    expect(result.header?.some(element => element.value === '页眉标题')).toBe(true)
    expect(result.main.length).toBeGreaterThan(0)
    expect(result.footer?.some(element => element.value === '页脚文案')).toBe(true)
  })

  it('字段会编译成 control 元素并保留模板元数据', () => {
    const result = compileTemplate(schema)
    const nameControl = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'patientName'
    )

    expect(nameControl?.control?.type).toBe(ControlType.TEXT)
    expect(nameControl?.control?.deletable).toBe(false)
    expect(nameControl?.extension).toMatchObject({
      template: {
        schemaId: 'test-template',
        fieldId: 'patientName',
        fieldType: 'text'
      }
    })
  })

  it('枚举字段会生成 valueSets', () => {
    const result = compileTemplate(schema)
    const genderControl = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'gender'
    )

    expect(genderControl?.control?.type).toBe(ControlType.SELECT)
    expect(genderControl?.control?.valueSets).toEqual([
      {
        value: '男',
        code: '男'
      },
      {
        value: '女',
        code: '女'
      }
    ])
  })

  it('section 会编译为标题元素，并把规则写进 extension.template', () => {
    const result = compileTemplate(schema)
    const titleElement = result.main.find(
      element => element.type === ElementType.TITLE
    )
    const historyControl = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'history'
    )

    expect(titleElement?.valueList?.[0].value).toBe('现病史')
    expect(historyControl?.extension).toMatchObject({
      template: {
        blockType: 'paragraph',
        fieldId: 'history',
        rules: [
          {
            type: 'visibility',
            condition: {
              field: 'gender',
              operator: 'equals',
              value: '女'
            }
          }
        ]
      }
    })
  })
})
