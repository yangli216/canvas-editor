import { describe, expect, it, vi } from 'vitest'
import {
  buildTemplateFieldRuntimeIndex,
  createTemplateRuntime,
  ListStyle,
  ListType,
  type ITemplateSchema
} from '@/editor'

function createMockEditor(initialValues: Record<string, string | string[] | any[] | null>) {
  const values = new Map(Object.entries(initialValues))
  const subscriptions = new Map<string, Set<(payload: any) => void>>()

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
        executeSetControlValueList: vi.fn((payload: Array<{ conceptId?: string; value: string | any[] | null }>) => {
          payload.forEach(item => {
            if (!item.conceptId) return
            values.set(item.conceptId, item.value ?? null)
          })
        })
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

describe('template runtime', () => {
  const schema: ITemplateSchema = {
    version: '1.0.0',
    id: 'runtime-template',
    name: '运行时模板',
    blocks: [
      {
        type: 'section',
        id: 'subjective',
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
                  businessCode: 'chiefComplaint',
                  group: 'subjective',
                  exportPath: 'encounter.subjective.chiefComplaint',
                  permission: 'doctor',
                  dataSource: 'emr',
                  listeners: ['syncChiefComplaint'],
                  tags: ['clinical', 'summary']
                }
              }
            ]
          }
        ]
      },
      {
        type: 'group',
        id: 'vitals',
        direction: 'row',
        blocks: [
          {
            type: 'fieldRow',
            fields: [
              {
                id: 'temperature',
                type: 'text',
                label: '体温',
                metadata: {
                  businessCode: 'temperature',
                  group: 'vitals',
                  exportPath: 'encounter.vitals.temperature',
                  permission: 'nurse',
                  dataSource: 'vitalsDevice',
                  listeners: ['syncVitals']
                }
              },
              {
                id: 'pulse',
                type: 'text',
                label: '脉搏',
                metadata: {
                  businessCode: 'pulse',
                  group: 'vitals',
                  exportPath: 'encounter.vitals.pulse',
                  permission: 'nurse',
                  dataSource: 'vitalsDevice',
                  listeners: ['syncVitals'],
                  tags: ['clinical']
                }
              }
            ]
          }
        ]
      },
      {
        type: 'table',
        id: 'labPanel',
        columns: [
          {
            header: '检验项',
            field: {
              id: 'labItem',
              type: 'text',
              metadata: {
                businessCode: 'labItem',
                group: 'labs',
                exportPath: 'encounter.labs.items'
              }
            }
          },
          {
            header: '结果',
            field: {
              id: 'labResult',
              type: 'text',
              metadata: {
                businessCode: 'labResult',
                group: 'labs',
                exportPath: 'encounter.labs.results'
              }
            }
          }
        ],
        rows: 2
      }
    ],
    footer: [
      {
        type: 'fieldRow',
        fields: [
          {
            id: 'doctorSignature',
            type: 'signature',
            label: '医师签名',
            metadata: {
              businessCode: 'doctorSignature',
              group: 'footerAudit',
              exportPath: 'encounter.audit.doctorSignature'
            }
          }
        ]
      }
    ]
  }

  it('buildTemplateFieldRuntimeIndex 支持多维索引', () => {
    const index = buildTemplateFieldRuntimeIndex(schema)

    expect(index.byId.get('chiefComplaint')?.sectionId).toBe('subjective')
    expect(index.byBlockId.get('subjective')?.map(node => node.field.id)).toEqual(['chiefComplaint'])
    expect(index.byGroup.get('vitals')?.map(node => node.field.id)).toEqual(['temperature', 'pulse'])
    expect(index.byBusinessCode.get('doctorSignature')?.[0].zone).toBe('footer')
    expect(index.byPermission.get('doctor')?.[0].field.id).toBe('chiefComplaint')
    expect(index.byTableId.get('labPanel')?.map(node => node.field.id)).toEqual(['labItem', 'labResult'])
    expect(index.byListener.get('syncVitals')?.map(node => node.field.id)).toEqual(['temperature', 'pulse'])
    expect(index.byTag.get('clinical')?.map(node => node.field.id)).toEqual(['chiefComplaint', 'pulse'])
  })

  it('buildTemplateFieldRuntimeIndex 支持通过主数据快照重写业务索引', () => {
    const snapshotSchema: ITemplateSchema = {
      version: '1.0.0',
      id: 'snapshot-template',
      name: '主数据快照模板',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'patientName',
              type: 'text',
              label: '患者姓名',
              metadata: {
                metadataFieldId: 'meta-1',
                businessCode: 'legacy.patient.name',
                group: 'legacy',
                dataSource: 'legacy.patient',
                permission: 'legacy.read',
                exportPath: 'legacy.patient.name'
              }
            }
          ]
        }
      ]
    }

    const index = buildTemplateFieldRuntimeIndex(snapshotSchema, {
      metadataFieldsById: {
        'meta-1': {
          id: 'meta-1',
          code: 'patient.name',
          name: '患者姓名',
          group: '基本信息',
          dataSource: 'his.patient',
          permission: 'patient.read.basic',
          exportPath: 'patient.name'
        }
      }
    })

    expect(index.byBusinessCode.get('patient.name')?.[0].field.id).toBe('patientName')
    expect(index.byGroup.get('基本信息')?.[0].field.id).toBe('patientName')
    expect(index.byDataSource.get('his.patient')?.[0].field.id).toBe('patientName')
  })

  it('TemplateRuntime 支持批量写值、按元数据筛选取值和结构化导出', () => {
    const { editor, values } = createMockEditor({
      chiefComplaint: '胸痛3天',
      temperature: '37.2',
      pulse: '82',
      labItem: ['血糖', '白细胞'],
      labResult: ['6.1', '10.2'],
      doctorSignature: '张医生'
    })
    const runtime = createTemplateRuntime(editor as any, schema)

    const writeResult = runtime.setValues([
      { businessCode: 'temperature', value: '38.1' },
      { fieldId: 'pulse', value: '88' }
    ])

    expect(writeResult.appliedFieldIds).toEqual(['temperature', 'pulse'])
    expect(values.get('temperature')).toBe('38.1')
    expect(values.get('pulse')).toBe('88')
    expect(runtime.getValuesBySelector({ listener: 'syncVitals' })).toEqual({
      temperature: '38.1',
      pulse: '88'
    })

    const bulkWriteResult = runtime.setValuesBySelector({ permission: 'nurse' }, '待复测')
    expect(bulkWriteResult.appliedFieldIds).toEqual(['temperature', 'pulse'])
    expect(values.get('temperature')).toBe('待复测')
    expect(values.get('pulse')).toBe('待复测')

    expect(runtime.getValuesByBusinessCode()).toEqual({
      chiefComplaint: '胸痛3天',
      temperature: '待复测',
      pulse: '待复测',
      doctorSignature: '张医生'
    })

    const extracted = runtime.extract()
    expect(extracted.bySection).toEqual({
      subjective: {
        chiefComplaint: '胸痛3天'
      }
    })
    expect(extracted.byGroup).toEqual({
      subjective: {
        chiefComplaint: '胸痛3天'
      },
      vitals: {
        temperature: '待复测',
        pulse: '待复测'
      },
      labs: {
        labItem: '血糖',
        labResult: '6.1'
      },
      footerAudit: {
        doctorSignature: '张医生'
      }
    })
    expect(extracted.byTable).toEqual({
      labPanel: [
        { labItem: '血糖', labResult: '6.1' },
        { labItem: '白细胞', labResult: '10.2' }
      ]
    })
    expect(extracted.structured).toEqual({
      encounter: {
        subjective: {
          chiefComplaint: '胸痛3天'
        },
        vitals: {
          temperature: '待复测',
          pulse: '待复测'
        },
        labs: {
          items: '血糖',
          results: '6.1'
        },
        audit: {
          doctorSignature: '张医生'
        }
      }
    })
    expect(extracted.byPermission).toEqual({
      doctor: {
        chiefComplaint: '胸痛3天'
      },
      nurse: {
        temperature: '待复测',
        pulse: '待复测'
      }
    })
    expect(extracted.byDataSource).toEqual({
      emr: {
        chiefComplaint: '胸痛3天'
      },
      vitalsDevice: {
        temperature: '待复测',
        pulse: '待复测'
      }
    })
    expect(extracted.byListener).toEqual({
      syncChiefComplaint: {
        chiefComplaint: '胸痛3天'
      },
      syncVitals: {
        temperature: '待复测',
        pulse: '待复测'
      }
    })
    expect(extracted.byTag).toEqual({
      clinical: {
        chiefComplaint: '胸痛3天',
        pulse: '待复测'
      },
      summary: {
        chiefComplaint: '胸痛3天'
      }
    })
    expect(extracted.structuredByPermission).toEqual({
      doctor: {
        encounter: {
          subjective: {
            chiefComplaint: '胸痛3天'
          }
        }
      },
      nurse: {
        encounter: {
          vitals: {
            temperature: '待复测',
            pulse: '待复测'
          }
        }
      }
    })
    expect(extracted.structuredByDataSource).toEqual({
      emr: {
        encounter: {
          subjective: {
            chiefComplaint: '胸痛3天'
          }
        }
      },
      vitalsDevice: {
        encounter: {
          vitals: {
            temperature: '待复测',
            pulse: '待复测'
          }
        }
      }
    })
    expect(extracted.structuredByListener).toEqual({
      syncChiefComplaint: {
        encounter: {
          subjective: {
            chiefComplaint: '胸痛3天'
          }
        }
      },
      syncVitals: {
        encounter: {
          vitals: {
            temperature: '待复测',
            pulse: '待复测'
          }
        }
      }
    })
    expect(extracted.structuredByTag).toEqual({
      clinical: {
        encounter: {
          subjective: {
            chiefComplaint: '胸痛3天'
          },
          vitals: {
            pulse: '待复测'
          }
        }
      },
      summary: {
        encounter: {
          subjective: {
            chiefComplaint: '胸痛3天'
          }
        }
      }
    })
    expect(extracted.structuredByPermissionAndTag).toEqual({
      doctor: {
        clinical: {
          encounter: {
            subjective: {
              chiefComplaint: '胸痛3天'
            }
          }
        },
        summary: {
          encounter: {
            subjective: {
              chiefComplaint: '胸痛3天'
            }
          }
        }
      },
      nurse: {
        clinical: {
          encounter: {
            vitals: {
              pulse: '待复测'
            }
          }
        }
      }
    })
    expect(extracted.document.main).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'subjective',
        type: 'section',
        children: [
          expect.objectContaining({
            type: 'fieldRow',
            fields: {
              chiefComplaint: '胸痛3天'
            }
          })
        ]
      }),
      expect.objectContaining({
        key: 'vitals',
        type: 'group'
      }),
      expect.objectContaining({
        key: 'labPanel',
        type: 'table',
        rows: [
          { labItem: '血糖', labResult: '6.1' },
          { labItem: '白细胞', labResult: '10.2' }
        ]
      })
    ]))
  })

  it('文本类字段可把数组值写成项目符号列表元素', () => {
    const { editor } = createMockEditor({})
    const runtime = createTemplateRuntime(editor as any, {
      version: '1.0.0',
      id: 'list-runtime',
      name: '列表运行时',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'diagnosisList',
              type: 'textarea',
              metadata: {
                businessCode: 'diagnosis.list',
                dataSource: 'his.diagnosis'
              },
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

    const result = runtime.setValues([
      {
        fieldId: 'diagnosisList',
        value: ['冠状动脉粥样硬化性心脏病', '2 型糖尿病']
      }
    ])

    expect(result.appliedFieldIds).toEqual(['diagnosisList'])
    expect(editor.command.executeSetControlValueList).toHaveBeenCalledTimes(1)
    expect(editor.command.executeSetControlValueList).toHaveBeenCalledWith([
      {
        conceptId: 'diagnosisList',
        value: [
          expect.objectContaining({
            value: '\u200B',
            listType: ListType.UL,
            listStyle: ListStyle.DISC
          }),
          expect.objectContaining({
            value: '冠状动脉粥样硬化性心脏病',
            listType: ListType.UL,
            listStyle: ListStyle.DISC
          }),
          expect.objectContaining({
            value: '\u200B',
            listType: ListType.UL,
            listStyle: ListStyle.DISC
          }),
          expect.objectContaining({
            value: '2 型糖尿病',
            listType: ListType.UL,
            listStyle: ListStyle.DISC
          })
        ],
        isSubmitHistory: undefined
      }
    ])
  })

  it('TemplateRuntime 支持字段级与分组级监听', () => {
    const { editor, values } = createMockEditor({
      chiefComplaint: '头晕1天',
      temperature: '36.8',
      pulse: '76',
      doctorSignature: null
    })
    const runtime = createTemplateRuntime(editor as any, schema)
    const fieldListener = vi.fn()
    const groupListener = vi.fn()

    const disposeField = runtime.observeField('chiefComplaint', fieldListener)
    const disposeGroup = runtime.observeGroup('vitals', groupListener)

    values.set('chiefComplaint', '头晕伴恶心')
    editor.eventBus.emit('controlContentChange', {
      control: { conceptId: 'chiefComplaint' },
      controlId: 'ctrl-chiefComplaint'
    })

    values.set('temperature', '37.5')
    editor.eventBus.emit('controlContentChange', {
      control: { conceptId: 'temperature' },
      controlId: 'ctrl-temperature'
    })

    expect(fieldListener).toHaveBeenCalledWith(expect.objectContaining({
      fieldId: 'chiefComplaint',
      oldValue: '头晕1天',
      value: '头晕伴恶心'
    }))
    expect(groupListener).toHaveBeenCalledWith(expect.objectContaining({
      fieldId: 'temperature',
      oldValue: '36.8',
      value: '37.5'
    }))

    disposeField()
    disposeGroup()
  })
})