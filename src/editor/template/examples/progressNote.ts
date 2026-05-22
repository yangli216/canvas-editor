import { TitleLevel } from '../../dataset/enum/Title'
import type { ITemplateSchema } from '../index'

export const progressNoteTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'progress-note',
  name: '病程记录模板',
  description: '用于住院患者日常病程记录的结构化模板',
  layout: {
    defaultControlWidth: 120,
    textareaWidth: 420,
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
      segments: [{ type: 'text', value: '住院病历 · 病程记录' }]
    },
    { type: 'separator' }
  ],
  blocks: [
    {
      type: 'fieldRow',
      fields: [
        { id: 'patientName', type: 'text', label: '姓名', placeholder: '请输入姓名' },
        { id: 'hospitalNo', type: 'text', label: '住院号', placeholder: '请输入住院号', width: 160 },
        { id: 'recordDate', type: 'date', label: '记录日期', placeholder: '选择日期' },
        { id: 'recordTime', type: 'text', label: '时间', placeholder: 'HH:mm', width: 80 }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'department', type: 'text', label: '科室', placeholder: '请输入科室' },
        { id: 'bedNo', type: 'text', label: '床号', placeholder: '请输入床号' },
        {
          id: 'noteType',
          type: 'select',
          label: '记录类型',
          options: [
            { label: '首次病程记录' },
            { label: '日常病程记录' },
            { label: '上级医师查房记录' },
            { label: '疑难病例讨论记录' },
            { label: '交接班记录' }
          ]
        }
      ]
    },
    {
      type: 'section',
      title: '病情记录',
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
            { type: 'field', field: { id: 'respiration', type: 'number', placeholder: '次/分', width: 80 } },
            { type: 'text', value: '  血压：' },
            { type: 'field', field: { id: 'bloodPressure', type: 'text', placeholder: 'mmHg', width: 100 } }
          ]
        },
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'conditionDescription', type: 'textarea', placeholder: '描述患者当前病情', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '诊疗分析',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'analysisContent', type: 'textarea', placeholder: '诊疗分析及处理措施', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '处理措施',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'treatmentMeasures', type: 'textarea', placeholder: '请输入处理措施', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'physicianName', type: 'text', label: '记录医师', placeholder: '请输入医师姓名', required: true }
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
