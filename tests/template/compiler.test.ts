import { describe, expect, it } from 'vitest'
import {
  compileTemplate,
  ControlType,
  DEFAULT_SEPARATOR_OFFSET_Y,
  ElementType,
  getTemplatePageDecorationPresets,
  getTemplatePageNumberOptions,
  ListStyle,
  ListType,
  TEMPLATE_PAGE_DECORATION_SYSTEM_VARIABLES,
  TitleLevel,
  TEMPLATE_SYSTEM_VARIABLES,
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
    expect(nameControl?.control?.minWidth).toBeUndefined()
    expect(nameControl?.control?.underline).toBe(false)
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
    expect(genderControl?.control?.minWidth).toBe(56)
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


  it('字段行 label 保持在控件外侧，并带不可编辑不可删除标记', () => {
    const result = compileTemplate(schema)
    const nameControl = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'patientName'
    )
    const fieldLabel = result.main.find(
      element =>
        element.type !== ElementType.CONTROL &&
        element.extension &&
        typeof element.extension === 'object' &&
        'template' in element.extension &&
        (element.extension as { template?: { fieldId?: string } }).template?.fieldId === 'patientName' &&
        element.value.includes('姓名')
    )

    expect(nameControl?.control?.preText).toBeUndefined()
    expect(fieldLabel?.value).toBe('姓名：')
    expect(fieldLabel?.title).toMatchObject({
      disabled: true,
      deletable: false
    })
    expect(fieldLabel?.titleId).toBe('template-field-label-patientName')
  })
  it('字段宽度留空时按内容自适应，枚举字段会按选项文本估算初始最小宽度', () => {
    const result = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'adaptiveSelect',
              type: 'select',
              label: '自适应下拉',
              options: [{ label: '短值' }, { label: '较长的选项文本' }]
            },
            {
              id: 'adaptiveText',
              type: 'text',
              label: '自适应文本'
            },
            {
              id: 'adaptiveRadio',
              type: 'radio',
              label: '自适应单选',
              options: [{ label: '是' }, { label: '需要进一步人工确认' }]
            },
            {
              id: 'sizedSelect',
              type: 'select',
              label: '字号前后缀联动下拉',
              prefix: '左',
              postfix: '右',
              style: { size: 18 },
              options: [{ label: '较长的选项文本' }]
            },
            {
              id: 'fixedSelect',
              type: 'select',
              label: '固定下拉',
              width: 180,
              options: [{ label: 'A' }, { label: 'B' }]
            }
          ]
        }
      ]
    })
    const adaptiveSelect = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'adaptiveSelect'
    )
    const adaptiveText = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'adaptiveText'
    )
    const adaptiveRadio = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'adaptiveRadio'
    )
    const sizedSelect = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'sizedSelect'
    )
    const fixedSelect = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'fixedSelect'
    )

    expect(adaptiveSelect?.control?.minWidth).toBe(138)
    expect(adaptiveText?.control?.minWidth).toBeUndefined()
    expect(adaptiveRadio?.control?.minWidth).toBe(154)
    expect(sizedSelect?.control?.minWidth).toBe(202)
    expect(sizedSelect?.control?.prefix).toBeUndefined()
    expect(sizedSelect?.control?.postfix).toBeUndefined()
    expect(sizedSelect?.control?.preText).toBe('左')
    expect(sizedSelect?.control?.postText).toBe('右')
    expect(fixedSelect?.control?.minWidth).toBe(180)
  })

  it('字段下划线仅在显式配置时启用，默认不启用', () => {
    const result = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'plainText',
              type: 'text',
              label: '普通输入'
            },
            {
              id: 'underlinedText',
              type: 'text',
              label: '带下划线输入',
              underline: true
            }
          ]
        }
      ]
    })
    const plainText = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'plainText'
    )
    const underlinedText = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'underlinedText'
    )

    expect(plainText?.control?.underline).toBe(false)
    expect(underlinedText?.control?.underline).toBe(true)
  })

  it('文本字段的数组默认值可按列表方式编译', () => {
    const result = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'diagnosisList',
              type: 'textarea',
              label: '诊断',
              defaultValue: ['冠心病', '2 型糖尿病'],
              valueRender: {
                mode: 'list',
                listType: ListType.UL,
                listStyle: ListStyle.DISC
              }
            }
          ]
        }
      ]
    })

    const diagnosisControl = result.main.find(
      element =>
        element.type === ElementType.CONTROL &&
        element.control?.conceptId === 'diagnosisList'
    )

    expect(Array.isArray(diagnosisControl?.control?.value)).toBe(true)
    expect(diagnosisControl?.control?.value?.[0]).toMatchObject({
      value: '\u200B',
      listType: ListType.UL,
      listStyle: ListStyle.DISC
    })
    expect(diagnosisControl?.control?.value?.[1]).toMatchObject({
      value: '冠心病',
      listType: ListType.UL,
      listStyle: ListStyle.DISC
    })
    expect(diagnosisControl?.control?.value?.[2]).toMatchObject({
      value: '\u200B',
      listType: ListType.UL,
      listStyle: ListStyle.DISC
    })
    expect(diagnosisControl?.control?.value?.[3]).toMatchObject({
      value: '2 型糖尿病',
      listType: ListType.UL,
      listStyle: ListStyle.DISC
    })
    expect(diagnosisControl?.control?.value?.[0].listId).toBe(
      diagnosisControl?.control?.value?.[3].listId
    )
  })

  it('支持引入预定义页眉页脚并配置变量', () => {
    const result = compileTemplate({
      ...schema,
      name: '入院记录模板',
      layout: {
        pageDecorations: {
          header: {
            id: 'medical-record-header-classic'
          },
          footer: {
            id: 'medical-record-footer-audit'
          },
          variables: {
            hospitalName: '第一人民医院',
            footerNote: '模板页脚说明'
          }
        },
        footerRuntime: {
          operatorName: '张医生'
        }
      },
      header: [],
      footer: []
    }, {
      runtime: {
        printTime: '2026-05-23 09:20'
      }
    })

    const header = result.header ?? []
    const footer = result.footer ?? []

    expect(header.some(element => element.value === '第一人民医院')).toBe(true)
    expect(header.some(element => element.value === '入院记录模板')).toBe(true)
    expect(footer.some(element => element.value.includes('张医生'))).toBe(true)
    expect(footer.some(element => element.value === '模板页脚说明')).toBe(true)
  })

  it('页眉页脚 preset 支持 prepend / append 合并模式', () => {
    const prepend = compileTemplate({
      ...schema,
      layout: {
        pageDecorations: {
          header: {
            id: 'medical-record-header-classic',
            mode: 'prepend'
          },
          variables: {
            hospitalName: '第一人民医院',
            documentTitle: '模板标题'
          }
        }
      },
      header: [
        {
          type: 'staticText',
          text: '补充页眉',
          align: 'center'
        }
      ]
    })
    const append = compileTemplate({
      ...schema,
      layout: {
        pageDecorations: {
          footer: {
            id: 'medical-record-footer-audit',
            mode: 'append'
          },
          variables: {
            footerNote: '尾部说明'
          }
        }
      },
      footer: [
        {
          type: 'staticText',
          text: '自定义页脚',
          align: 'center'
        }
      ]
    })

    const prependHeader = prepend.header ?? []
    const appendFooter = append.footer ?? []

    expect(prependHeader.findIndex(element => element.value === '第一人民医院')).toBeLessThan(
      prependHeader.findIndex(element => element.value === '补充页眉')
    )
    expect(appendFooter.findIndex(element => element.value === '自定义页脚')).toBeLessThan(
      appendFooter.findIndex(element => element.value === '尾部说明')
    )
  })

  it('页眉页脚 preset 变量支持在普通文本编译时替换', () => {
    const result = compileTemplate({
      ...schema,
      header: [
        {
          type: 'paragraph',
          segments: [
            {
              type: 'text',
              value: `${TEMPLATE_PAGE_DECORATION_SYSTEM_VARIABLES.HOSPITALNAME} · ${TEMPLATE_PAGE_DECORATION_SYSTEM_VARIABLES.DOCUMENTTITLE}`
            }
          ]
        }
      ],
      layout: {
        pageDecorations: {
          variables: {
            hospitalName: '第一人民医院',
            documentTitle: '测试文书'
          }
        }
      }
    })

    expect((result.header ?? []).some(element => element.value === '第一人民医院 · 测试文书')).toBe(true)
  })

  it('业务场景页眉 preset 已纳入模板库', () => {
    const headerPresetIds = getTemplatePageDecorationPresets('header').map(item => item.id)

    expect(headerPresetIds).toEqual(expect.arrayContaining([
      'lab-report-header',
      'informed-consent-header-compact',
      'ultrasound-report-header-compact',
      'surgical-record-header-operative',
      'consultation-record-header-mdt'
    ]))
  })

  it('业务场景页脚 preset 已纳入模板库', () => {
    const footerPresetIds = getTemplatePageDecorationPresets('footer').map(item => item.id)

    expect(footerPresetIds).toEqual(expect.arrayContaining([
      'lab-report-footer-signoff',
      'ultrasound-report-footer-signoff',
      'surgical-record-footer-audit',
      'consultation-record-footer-summary'
    ]))
  })

  it('检验报告页眉 preset 可按变量编译', () => {
    const result = compileTemplate({
      ...schema,
      header: [],
      layout: {
        pageDecorations: {
          header: {
            id: 'lab-report-header'
          },
          variables: {
            hospitalName: '第一人民医院',
            documentTitle: '检验报告单',
            departmentName: '检验科',
            documentCode: 'LAB-2026-001'
          }
        }
      }
    })

    const header = result.header ?? []
    expect(header.some(element => element.value === '第一人民医院')).toBe(true)
    expect(header.some(element => element.value === '检验报告单')).toBe(true)
    expect(header.some(element => element.value === '检验科')).toBe(true)
    expect(header.some(element => element.value === 'LAB-2026-001')).toBe(true)
  })

  it('会诊页眉页脚 preset 可按变量编译', () => {
    const result = compileTemplate({
      ...schema,
      header: [],
      footer: [],
      layout: {
        pageDecorations: {
          header: {
            id: 'consultation-record-header-mdt'
          },
          footer: {
            id: 'consultation-record-footer-summary'
          },
          variables: {
            hospitalName: '第一人民医院',
            documentTitle: '多学科会诊记录',
            departmentName: '肿瘤中心',
            documentCode: 'MDT-2026-008',
            footerNote: '会诊后 24 小时内补录最终意见'
          }
        }
      }
    })

    const header = result.header ?? []
    const footer = result.footer ?? []
    const headerText = header.flatMap(element => [
      ...(element.value ? [element.value] : []),
      ...(element.valueList?.map(item => item.value) ?? [])
    ]).join('')
    const footerText = footer.flatMap(element => [
      ...(element.value ? [element.value] : []),
      ...(element.valueList?.map(item => item.value) ?? [])
    ]).join('')
    const consultationTitle = header.find(
      element => element.type === ElementType.TITLE
    )

    expect(consultationTitle?.valueList?.[0].value).toBe('多学科会诊记录')
    expect(headerText).toContain('第一人民医院 · 肿瘤中心 · 会诊编号 MDT-2026-008')
    expect(footerText).toContain('会诊归属：肿瘤中心    更新时间：')
    expect(footerText).toContain('会诊后 24 小时内补录最终意见')
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

  it('分节标题后换行默认开启，也可按配置关闭', () => {
    const withBreak = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'section',
          title: '默认换行分节',
          blocks: [{ type: 'paragraph', segments: [{ type: 'text', value: '内容A' }] }]
        }
      ]
    })
    const withoutBreak = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'section',
          title: '同行分节',
          titleLineBreak: false,
          blocks: [{ type: 'paragraph', segments: [{ type: 'text', value: '内容B' }], lineBreak: false }]
        }
      ]
    })

    const breakTitleIndex = withBreak.main.findIndex(element => element.type === ElementType.TITLE)
    const noBreakTitleIndex = withoutBreak.main.findIndex(element => element.type === ElementType.TITLE)

    expect(withBreak.main[breakTitleIndex + 1]?.value).toBe('\n')
    expect(withoutBreak.main[noBreakTitleIndex + 1]?.value).toBe('内容B')
  })

  it('分节默认不再额外插入空白行，并支持显式配置段后间距', () => {
    const compact = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'section',
          title: '紧凑分节',
          blocks: [{ type: 'paragraph', segments: [{ type: 'text', value: '内容A' }] }]
        },
        {
          type: 'paragraph',
          lineBreak: false,
          segments: [{ type: 'text', value: '内容B' }]
        }
      ]
    })
    const spaced = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'section',
          title: '带间距分节',
          spacing: 1,
          blocks: [{ type: 'paragraph', segments: [{ type: 'text', value: '内容C' }] }]
        },
        {
          type: 'paragraph',
          lineBreak: false,
          segments: [{ type: 'text', value: '内容D' }]
        }
      ]
    })

    const compactIndex = compact.main.findIndex(element => element.value === '内容A')
    const spacedIndex = spaced.main.findIndex(element => element.value === '内容C')

    expect(compact.main[compactIndex + 1]?.value).toBe('\n')
    expect(compact.main[compactIndex + 2]?.value).toBe('内容B')
    expect(spaced.main[spacedIndex + 1]?.value).toBe('\n')
    expect(spaced.main[spacedIndex + 2]?.value).toBe('\n')
    expect(spaced.main[spacedIndex + 3]?.value).toBe('内容D')
  })

  it('spacer 会按空行数插入留白，不改变前后内容顺序', () => {
    const result = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'staticText',
          text: '上方内容'
        },
        {
          type: 'spacer',
          lines: 2
        },
        {
          type: 'paragraph',
          lineBreak: false,
          segments: [{ type: 'text', value: '下方内容' }]
        }
      ]
    })

    expect(result.main.slice(0, 5).map(element => element.value)).toEqual([
      '上方内容',
      '\n',
      '\n',
      '\n',
      '下方内容'
    ])
  })

  it('分割线在未显式配置时使用默认上移偏移量', () => {
    const result = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'separator',
          align: 'center',
          width: 520,
          spacing: 8
        }
      ]
    })
    const separator = result.main.find(element => element.type === ElementType.SEPARATOR)

    expect(separator?.offsetY).toBe(DEFAULT_SEPARATOR_OFFSET_Y)
  })

  it('横向组合会把子块编译到同一行，纵向组合保持逐行堆叠', () => {
    const rowGroup = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'group',
          direction: 'row',
          blocks: [
            { type: 'paragraph', segments: [{ type: 'text', value: '左侧' }] },
            { type: 'paragraph', segments: [{ type: 'text', value: '右侧' }] }
          ]
        }
      ]
    })
    const columnGroup = compileTemplate({
      ...schema,
      blocks: [
        {
          type: 'group',
          direction: 'column',
          blocks: [
            { type: 'paragraph', segments: [{ type: 'text', value: '上方' }] },
            { type: 'paragraph', segments: [{ type: 'text', value: '下方' }] }
          ]
        }
      ]
    })

    expect(rowGroup.main.slice(0, 3).map(element => element.value)).toEqual([
      '左侧',
      '右侧',
      '\n'
    ])
    expect(columnGroup.main.slice(0, 4).map(element => element.value)).toEqual([
      '上方',
      '\n',
      '下方',
      '\n'
    ])
  })

  it('静态文本与段落支持打印时间和操作者变量', () => {
    const runtimeSchema: ITemplateSchema = {
      ...schema,
      footer: [
        {
          type: 'staticText',
          text: `打印时间：${TEMPLATE_SYSTEM_VARIABLES.PRINT_TIME}`
        },
        {
          type: 'paragraph',
          segments: [{ type: 'text', value: `操作者：${TEMPLATE_SYSTEM_VARIABLES.OPERATOR_NAME}` }]
        }
      ]
    }

    const result = compileTemplate(runtimeSchema, {
      runtime: {
        printTime: '2026-05-21 15:30',
        operatorName: '张医生'
      }
    })

    expect(result.footer?.some(element => element.value === '打印时间：2026-05-21 15:30')).toBe(true)
    expect(result.footer?.some(element => element.value === '操作者：张医生')).toBe(true)
  })

  it('可从 layout 提取页码运行态配置', () => {
    const pageNumber = getTemplatePageNumberOptions({
      ...schema,
      layout: {
        footerRuntime: {
          enabledPageNumber: true,
          pageNumberFormat: `第 ${TEMPLATE_SYSTEM_VARIABLES.PAGE_NO} / ${TEMPLATE_SYSTEM_VARIABLES.PAGE_COUNT} 页`,
          pageNumberAlign: 'right',
          pageNumberBottom: 72
        }
      }
    })

    expect(pageNumber).toMatchObject({
      disabled: false,
      bottom: 72,
      format: '第 {pageNo} / {pageCount} 页'
    })
  })
})
