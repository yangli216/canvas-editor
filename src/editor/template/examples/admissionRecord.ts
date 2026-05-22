import { TitleLevel } from '../../dataset/enum/Title'
import type { ITemplateSchema } from '../index'

export const admissionRecordTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'admission-record',
  name: '入院记录模板',
  description: '用于住院入院记录的结构化模板示例',
  layout: {
    textareaWidth: 420,
    sectionSpacing: 1,
    titleStyle: {
      size: 18
    }
  },
  header: [
    {
      type: 'paragraph',
      style: {
        size: 28
      },
      segments: [
        {
          type: 'text',
          value: '第一人民医院'
        }
      ]
    },
    {
      type: 'paragraph',
      style: {
        size: 18
      },
      segments: [
        {
          type: 'text',
          value: '住院病历 · 入院记录'
        }
      ]
    },
    {
      type: 'separator'
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
          placeholder: '请输入姓名'
        },
        {
          id: 'gender',
          type: 'select',
          label: '性别',
          placeholder: '请选择性别',
          options: [{ label: '男' }, { label: '女' }, { label: '其他' }]
        },
        {
          id: 'age',
          type: 'number',
          label: '年龄',
          placeholder: '岁'
        },
        {
          id: 'admissionDate',
          type: 'date',
          label: '入院日期',
          placeholder: '选择日期'
        }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        {
          id: 'department',
          type: 'text',
          label: '科室',
          placeholder: '请输入科室'
        },
        {
          id: 'bedNo',
          type: 'text',
          label: '床号',
          placeholder: '请输入床号'
        },
        {
          id: 'hospitalNo',
          type: 'text',
          label: '住院号',
          placeholder: '请输入住院号',
          width: 180
        }
      ]
    },
    {
      type: 'section',
      title: '主诉',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [
            {
              type: 'field',
              field: {
                id: 'chiefComplaint',
                type: 'textarea',
                placeholder: '例如：反复胸闷、气促 3 天',
                width: 520,
                required: true
              }
            }
          ]
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
              type: 'field',
              field: {
                id: 'presentHistory',
                type: 'textarea',
                placeholder: '描述起病经过、伴随症状、诊疗过程',
                width: 520
              }
            }
          ]
        }
      ]
    },
    {
      type: 'section',
      title: '既往史',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [
            {
              type: 'field',
              field: {
                id: 'pastHistory',
                type: 'textarea',
                placeholder: '既往疾病、手术、外伤、输血史等',
                width: 520
              }
            }
          ]
        },
        {
          type: 'paragraph',
          segments: [
            {
              type: 'text',
              value: '过敏史'
            },
            {
              type: 'text',
              value: '：'
            },
            {
              type: 'field',
              field: {
                id: 'allergyFlag',
                type: 'radio',
                options: [{ label: '无' }, { label: '有' }],
                defaultValue: '无'
              }
            },
            {
              type: 'text',
              value: '  过敏原'
            },
            {
              type: 'text',
              value: '：'
            },
            {
              type: 'field',
              field: {
                id: 'allergySource',
                type: 'text',
                placeholder: '请输入过敏原',
                width: 220,
                rules: [
                  {
                    type: 'visibility',
                    condition: {
                      field: 'allergyFlag',
                      operator: 'equals',
                      value: '有'
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    },
    {
      type: 'section',
      title: '体格检查',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            {
              id: 'temperature',
              type: 'number',
              label: 'T',
              placeholder: '℃'
            },
            {
              id: 'pulse',
              type: 'number',
              label: 'P',
              placeholder: '次/分'
            },
            {
              id: 'respiration',
              type: 'number',
              label: 'R',
              placeholder: '次/分'
            },
            {
              id: 'bloodPressure',
              type: 'text',
              label: 'BP',
              placeholder: 'mmHg'
            }
          ]
        },
        {
          type: 'paragraph',
          segments: [
            {
              type: 'text',
              value: '阳性体征'
            },
            {
              type: 'text',
              value: '：'
            },
            {
              type: 'field',
              field: {
                id: 'positiveSigns',
                type: 'textarea',
                placeholder: '请输入阳性体征',
                width: 480
              }
            }
          ]
        }
      ]
    },
    {
      type: 'section',
      title: '初步诊断',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [
            {
              type: 'field',
              field: {
                id: 'initialDiagnosis',
                type: 'textarea',
                placeholder: '请输入初步诊断',
                width: 520
              }
            }
          ]
        }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        {
          id: 'physicianName',
          type: 'text',
          label: '住院医师',
          placeholder: '请输入医师姓名'
        },
        {
          id: 'signatureDate',
          type: 'date',
          label: '签署日期',
          placeholder: '选择日期'
        }
      ]
    }
  ],
  footer: [
    {
      type: 'paragraph',
      style: {
        size: 12
      },
      segments: [
        {
          type: 'text',
          value: 'canvas-editor template dsl demo'
        }
      ]
    }
  ]
}
