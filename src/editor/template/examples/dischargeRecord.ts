import { TitleLevel } from '../../dataset/enum/Title'
import type { ITemplateSchema } from '../index'

export const dischargeRecordTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'discharge-record',
  name: '出院记录模板',
  description: '用于住院患者出院记录的结构化模板',
  layout: {
    defaultControlWidth: 120,
    textareaWidth: 420,
    sectionSpacing: 1,
    pageDecorations: {
      header: {
        id: 'medical-record-header-classic'
      },
      footer: {
        id: 'medical-record-footer-audit'
      },
      variables: {
        hospitalName: '第一人民医院',
        documentTitle: '住院病历 · 出院记录'
      }
    },
    titleStyle: { size: 18 }
  },
  blocks: [
    {
      type: 'fieldRow',
      fields: [
        { id: 'patientName', type: 'text', label: '姓名', placeholder: '请输入姓名' },
        { id: 'gender', type: 'select', label: '性别', options: [{ label: '男' }, { label: '女' }] },
        { id: 'age', type: 'number', label: '年龄', placeholder: '岁' },
        { id: 'hospitalNo', type: 'text', label: '住院号', placeholder: '请输入住院号', width: 160 }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'admissionDate', type: 'date', label: '入院日期', placeholder: '选择日期' },
        { id: 'dischargeDate', type: 'date', label: '出院日期', placeholder: '选择日期' },
        { id: 'hospitalDays', type: 'number', label: '住院天数', placeholder: '天' }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'department', type: 'text', label: '科室', placeholder: '请输入科室' },
        { id: 'attendingPhysician', type: 'text', label: '主治医师', placeholder: '请输入医师姓名' }
      ]
    },
    {
      type: 'section',
      title: '入院诊断',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'admissionDiagnosis', type: 'textarea', placeholder: '请输入入院诊断', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '出院诊断',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'dischargeDiagnosis', type: 'textarea', placeholder: '请输入出院诊断', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '诊治经过',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'treatmentProcess', type: 'textarea', placeholder: '描述住院期间诊治过程', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '出院情况',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '出院状态：' },
            {
              type: 'field',
              field: {
                id: 'dischargeStatus',
                type: 'radio',
                options: [{ label: '治愈' }, { label: '好转' }, { label: '未愈' }, { label: '死亡' }],
                defaultValue: '好转'
              }
            }
          ]
        },
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'dischargeCondition', type: 'textarea', placeholder: '描述出院时情况', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '出院医嘱',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'dischargeOrders', type: 'textarea', placeholder: '请输入出院医嘱', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'physicianName', type: 'text', label: '住院医师', placeholder: '请输入医师姓名' },
        { id: 'signatureDate', type: 'date', label: '签署日期', placeholder: '选择日期' }
      ]
    }
  ]
}
