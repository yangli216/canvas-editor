import { TitleLevel } from '../../dataset/enum/Title'
import type { ITemplateSchema } from '../index'

export const informedConsentTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'informed-consent',
  name: '知情同意书模板',
  description: '用于医疗操作知情同意的结构化模板',
  layout: {
    defaultControlWidth: 130,
    textareaWidth: 440,
    sectionSpacing: 1,
    pageDecorations: {
      header: {
        id: 'informed-consent-header-compact'
      },
      footer: {
        id: 'medical-record-footer-audit'
      },
      variables: {
        hospitalName: '第一人民医院',
        documentTitle: '知情同意书'
      }
    },
    titleStyle: { size: 18 }
  },
  blocks: [
    {
      type: 'fieldRow',
      fields: [
        { id: 'patientName', type: 'text', label: '患者姓名', placeholder: '请输入姓名', required: true },
        { id: 'gender', type: 'select', label: '性别', options: [{ label: '男' }, { label: '女' }] },
        { id: 'age', type: 'number', label: '年龄', placeholder: '岁' },
        { id: 'hospitalNo', type: 'text', label: '住院号', placeholder: '请输入住院号', width: 160 }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'diagnosis', type: 'text', label: '诊断', placeholder: '请输入诊断', width: 280, required: true },
        { id: 'operationName', type: 'text', label: '拟行操作/手术', placeholder: '请输入操作或手术名称', width: 280, required: true }
      ]
    },
    {
      type: 'section',
      title: '病情及手术必要性说明',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'diseaseExplanation', type: 'textarea', placeholder: '说明患者病情及手术必要性', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '手术/操作方案',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'procedurePlan', type: 'textarea', placeholder: '描述手术或操作方案', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '风险与并发症',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'risksAndComplications', type: 'textarea', placeholder: '列明可能的风险及并发症', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '替代方案',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'alternatives', type: 'textarea', placeholder: '描述可选替代方案', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '患方声明',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '本人已充分了解上述内容，自愿同意接受' },
            { type: 'field', field: { id: 'operationNameConfirm', type: 'text', placeholder: '手术/操作名称', width: 200 } },
            { type: 'text', value: '，并对可能出现的风险表示理解。' }
          ]
        },
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '患者签名：' },
            { type: 'field', field: { id: 'patientSignature', type: 'text', placeholder: '患者本人签名', width: 160, required: true } },
            { type: 'text', value: '  签名日期：' },
            { type: 'field', field: { id: 'patientSignDate', type: 'date', placeholder: '选择日期' } }
          ]
        },
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '法定代理人/委托人：' },
            { type: 'field', field: {
              id: 'agentName',
              type: 'text',
              placeholder: '代理人姓名',
              width: 160,
              rules: [{
                type: 'visibility',
                condition: { field: 'patientSignature', operator: 'equals', value: '' }
              }]
            }},
            { type: 'text', value: '  与患者关系：' },
            { type: 'field', field: {
              id: 'agentRelation',
              type: 'select',
              options: [{ label: '父母' }, { label: '配偶' }, { label: '子女' }, { label: '兄弟姐妹' }, { label: '其他' }],
              rules: [{
                type: 'visibility',
                condition: { field: 'patientSignature', operator: 'equals', value: '' }
              }]
            }}
          ]
        }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'physicianName', type: 'text', label: '谈话医师', placeholder: '请输入医师姓名', required: true },
        { id: 'physicianSignDate', type: 'date', label: '谈话日期', placeholder: '选择日期' }
      ]
    }
  ]
}
