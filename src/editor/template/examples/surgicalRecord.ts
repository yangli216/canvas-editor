import { TitleLevel } from '../../dataset/enum/Title'
import type { ITemplateSchema } from '../index'

export const surgicalRecordTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'surgical-record',
  name: '手术记录模板',
  description: '用于外科手术操作记录的结构化模板',
  layout: {
    defaultControlWidth: 130,
    textareaWidth: 440,
    sectionSpacing: 1,
    pageDecorations: {
      header: {
        id: 'surgical-record-header-operative'
      },
      footer: {
        id: 'surgical-record-footer-audit'
      },
      variables: {
        hospitalName: '第一人民医院',
        documentTitle: '住院病历 · 手术记录',
        departmentName: '普外科',
        footerNote: '术后请及时完成归档与麻醉记录核对'
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
        { id: 'operationDate', type: 'date', label: '手术日期', placeholder: '选择日期' },
        { id: 'startTime', type: 'text', label: '开始时间', placeholder: 'HH:mm', width: 80 },
        { id: 'endTime', type: 'text', label: '结束时间', placeholder: 'HH:mm', width: 80 },
        { id: 'department', type: 'text', label: '手术科室', placeholder: '请输入科室' }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'operationName', type: 'text', label: '手术名称', placeholder: '请输入手术名称', width: 280, required: true },
        {
          id: 'anesthesiaType',
          type: 'select',
          label: '麻醉方式',
          options: [
            { label: '全身麻醉' },
            { label: '硬膜外麻醉' },
            { label: '腰麻' },
            { label: '局部麻醉' },
            { label: '神经阻滞' }
          ]
        }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'surgeon', type: 'text', label: '主刀医师', placeholder: '请输入医师姓名', required: true },
        { id: 'firstAssistant', type: 'text', label: '第一助手', placeholder: '请输入医师姓名' },
        { id: 'anesthesiologist', type: 'text', label: '麻醉医师', placeholder: '请输入医师姓名' }
      ]
    },
    {
      type: 'section',
      title: '术前诊断',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'preopDiagnosis', type: 'textarea', placeholder: '请输入术前诊断', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '手术经过',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'operationProcess', type: 'textarea', placeholder: '详细描述手术步骤及经过', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '术中情况',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '术中出血：' },
            { type: 'field', field: { id: 'bloodLoss', type: 'number', placeholder: 'ml', width: 80 } },
            { type: 'text', value: '  输液量：' },
            { type: 'field', field: { id: 'fluidInput', type: 'number', placeholder: 'ml', width: 80 } },
            { type: 'text', value: '  输血量：' },
            { type: 'field', field: { id: 'bloodTransfusion', type: 'number', placeholder: 'ml', width: 80 } }
          ]
        },
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '标本送检：' },
            {
              type: 'field',
              field: {
                id: 'specimenSent',
                type: 'radio',
                options: [{ label: '是' }, { label: '否' }],
                defaultValue: '否'
              }
            }
          ]
        }
      ]
    },
    {
      type: 'section',
      title: '术后诊断',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'postopDiagnosis', type: 'textarea', placeholder: '请输入术后诊断', width: 520 }
          }]
        }
      ]
    }
  ]
}
