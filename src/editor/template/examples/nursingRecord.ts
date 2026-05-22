import { TitleLevel } from '../../dataset/enum/Title'
import type { ITemplateSchema } from '../index'

export const nursingRecordTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'nursing-record',
  name: '护理记录模板',
  description: '用于护士日常护理记录的结构化模板',
  layout: {
    defaultControlWidth: 120,
    textareaWidth: 400,
    sectionSpacing: 1,
    titleStyle: { size: 18 }
  },
  header: [
    {
      type: 'paragraph',
      style: { size: 28 },
      segments: [{ type: 'text', value: '第一人民医院' }]
    },
    {
      type: 'paragraph',
      style: { size: 18 },
      segments: [{ type: 'text', value: '护理记录单' }]
    },
    { type: 'separator' }
  ],
  blocks: [
    {
      type: 'fieldRow',
      fields: [
        { id: 'patientName', type: 'text', label: '姓名', placeholder: '请输入姓名' },
        { id: 'bedNo', type: 'text', label: '床号', placeholder: '请输入床号' },
        { id: 'hospitalNo', type: 'text', label: '住院号', placeholder: '请输入住院号', width: 160 },
        { id: 'department', type: 'text', label: '科室', placeholder: '请输入科室' }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'recordDate', type: 'date', label: '记录日期', placeholder: '选择日期' },
        { id: 'shift', type: 'select', label: '班次', options: [{ label: '白班' }, { label: '小夜班' }, { label: '大夜班' }] }
      ]
    },
    {
      type: 'section',
      title: '生命体征',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '体温：' },
            { type: 'field', field: { id: 'temperature', type: 'number', placeholder: '℃', width: 80 } },
            { type: 'text', value: '  脉搏：' },
            { type: 'field', field: { id: 'pulse', type: 'number', placeholder: '次/分', width: 80 } },
            { type: 'text', value: '  呼吸：' },
            { type: 'field', field: { id: 'respiration', type: 'number', placeholder: '次/分', width: 80 } }
          ]
        },
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '血压：' },
            { type: 'field', field: { id: 'bloodPressure', type: 'text', placeholder: 'mmHg', width: 100 } },
            { type: 'text', value: '  血氧饱和度：' },
            { type: 'field', field: { id: 'spo2', type: 'number', placeholder: '%', width: 80 } }
          ]
        }
      ]
    },
    {
      type: 'section',
      title: '护理观察',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '意识状态：' },
            {
              type: 'field',
              field: {
                id: 'consciousness',
                type: 'radio',
                options: [{ label: '清醒' }, { label: '模糊' }, { label: '昏迷' }],
                defaultValue: '清醒'
              }
            }
          ]
        },
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '皮肤状况：' },
            {
              type: 'field',
              field: {
                id: 'skinCondition',
                type: 'checkbox',
                options: [{ label: '完整' }, { label: '红肿' }, { label: '破溃' }, { label: '压疮' }]
              }
            }
          ]
        },
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'nursingObservation', type: 'textarea', placeholder: '护理观察记录', width: 480 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '护理措施',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'nursingMeasures', type: 'textarea', placeholder: '请输入护理措施', width: 480, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '出入量记录',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '入量：' },
            { type: 'field', field: { id: 'fluidInput', type: 'number', placeholder: 'ml', width: 100 } },
            { type: 'text', value: '  出量：' },
            { type: 'field', field: { id: 'fluidOutput', type: 'number', placeholder: 'ml', width: 100 } }
          ]
        }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'nurseName', type: 'text', label: '护士签名', placeholder: '请输入护士姓名', required: true }
      ]
    }
  ],
  footer: [
    {
      type: 'paragraph',
      style: { size: 12 },
      segments: [{ type: 'text', value: 'canvas-editor template dsl demo' }]
    }
  ]
}
