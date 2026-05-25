import { TitleLevel } from '../../dataset/enum/Title'
import type {
  ITemplateFieldRowBlock,
  ITemplateSchema,
  ITemplateSectionBlock
} from '../index'

const progressPageDecorations = {
  header: {
    id: 'medical-record-header-classic'
  },
  footer: {
    id: 'medical-record-footer-audit'
  },
  variables: {
    hospitalName: '第一人民医院'
  }
} as const

function createProgressIdentityBlocks(): ITemplateFieldRowBlock[] {
  return [
    {
      type: 'fieldRow' as const,
      fields: [
        { id: 'patientName', type: 'text', label: '姓名', placeholder: '请输入姓名' },
        { id: 'hospitalNo', type: 'text', label: '住院号', placeholder: '请输入住院号', width: 160 },
        { id: 'recordDate', type: 'date', label: '记录日期', placeholder: '选择日期' },
        { id: 'recordTime', type: 'text', label: '时间', placeholder: 'HH:mm', width: 80 }
      ]
    },
    {
      type: 'fieldRow' as const,
      fields: [
        { id: 'department', type: 'text', label: '科室', placeholder: '请输入科室' },
        { id: 'bedNo', type: 'text', label: '床号', placeholder: '请输入床号' },
        { id: 'attendingPhysician', type: 'text', label: '主治医师', placeholder: '请输入医师姓名' }
      ]
    }
  ]
}

function createVitalSignsSection(title = '病情记录'): ITemplateSectionBlock {
  return {
    type: 'section' as const,
    title,
    level: TitleLevel.FIRST,
    blocks: [
      {
        type: 'paragraph' as const,
        segments: [
          { type: 'text' as const, value: '体温：' },
          { type: 'field' as const, field: { id: 'temperature', type: 'number', placeholder: '℃', width: 80 } },
          { type: 'text' as const, value: '  脉搏：' },
          { type: 'field' as const, field: { id: 'pulse', type: 'number', placeholder: '次/分', width: 80 } },
          { type: 'text' as const, value: '  呼吸：' },
          { type: 'field' as const, field: { id: 'respiration', type: 'number', placeholder: '次/分', width: 80 } },
          { type: 'text' as const, value: '  血压：' },
          { type: 'field' as const, field: { id: 'bloodPressure', type: 'text', placeholder: 'mmHg', width: 100 } }
        ]
      }
    ]
  }
}

export const progressNoteTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'progress-note',
  name: '病程记录模板（通用）',
  description: '用于住院患者病程记录的通用结构化模板，兼容首次、日常和查房等场景。',
  layout: {
    defaultControlWidth: 120,
    textareaWidth: 420,
    sectionSpacing: 1,
    pageDecorations: {
      ...progressPageDecorations,
      variables: {
        ...progressPageDecorations.variables,
        documentTitle: '住院病历 · 病程记录'
      }
    },
    titleStyle: { size: 18 }
  },
  blocks: [
    ...createProgressIdentityBlocks(),
    {
      type: 'fieldRow',
      fields: [
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
        },
        { id: 'recorderRole', type: 'text', label: '书写角色', placeholder: '如 住院医师 / 主治医师', width: 180 }
      ]
    },
    {
      ...createVitalSignsSection(),
      blocks: [
        ...createVitalSignsSection().blocks,
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'conditionDescription', type: 'textarea', placeholder: '描述患者当前病情、症状变化及阳性体征', width: 520, required: true }
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
      type: 'section',
      title: '后续计划',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'followUpPlan', type: 'textarea', placeholder: '请输入后续观察要点、复查计划和宣教要求', width: 520 }
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
  ]
}

export const firstProgressNoteTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'first-progress-note',
  name: '首次病程记录模板',
  description: '用于患者入院后首次病程记录，强调诊断依据、鉴别分析与初始诊疗计划。',
  layout: {
    defaultControlWidth: 120,
    textareaWidth: 420,
    sectionSpacing: 1,
    pageDecorations: {
      ...progressPageDecorations,
      variables: {
        ...progressPageDecorations.variables,
        documentTitle: '住院病历 · 首次病程记录'
      }
    },
    titleStyle: { size: 18 }
  },
  blocks: [
    ...createProgressIdentityBlocks(),
    {
      type: 'fieldRow',
      fields: [
        { id: 'chiefComplaint', type: 'textarea', label: '主诉', placeholder: '概括主要症状及持续时间', width: 320, required: true },
        { id: 'admittingDiagnosis', type: 'text', label: '初步诊断', placeholder: '请输入初步诊断', width: 220, required: true }
      ]
    },
    {
      type: 'section',
      title: '病例特点',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'caseHighlights', type: 'textarea', placeholder: '总结病史、体征、检验检查中的关键信息', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '诊断依据与鉴别诊断',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'diagnosticBasis', type: 'textarea', placeholder: '请输入诊断依据', width: 520, required: true }
          }]
        },
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'differentialDiagnosis', type: 'textarea', placeholder: '请输入鉴别诊断分析', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '初始诊疗计划',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'initialPlan', type: 'textarea', placeholder: '请输入诊疗计划、检查安排和告知内容', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'residentPhysician', type: 'text', label: '住院医师', placeholder: '请输入医师姓名', required: true },
        { id: 'supervisorReview', type: 'text', label: '上级审核', placeholder: '如 已汇报主治医师', width: 220 }
      ]
    }
  ]
}

export const dailyProgressNoteTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'daily-progress-note',
  name: '日常病程记录模板',
  description: '用于住院患者日常病程追踪，强调病情变化、分析判断和当日处理计划。',
  layout: {
    defaultControlWidth: 120,
    textareaWidth: 420,
    sectionSpacing: 1,
    pageDecorations: {
      ...progressPageDecorations,
      variables: {
        ...progressPageDecorations.variables,
        documentTitle: '住院病历 · 日常病程记录'
      }
    },
    titleStyle: { size: 18 }
  },
  blocks: [
    ...createProgressIdentityBlocks(),
    createVitalSignsSection('客观情况'),
    {
      type: 'section',
      title: '病情变化',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'illnessChange', type: 'textarea', placeholder: '记录症状、体征及病情变化', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '检查结果与分析',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'examReview', type: 'textarea', placeholder: '请输入检验检查结果、疗效评估和分析意见', width: 520 }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '处理与计划',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'dailyPlan', type: 'textarea', placeholder: '请输入今日处理措施和后续计划', width: 520, required: true }
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
  ]
}

export const attendingWardRoundTemplate: ITemplateSchema = {
  version: '1.0.0',
  id: 'attending-ward-round-note',
  name: '上级医师查房记录模板',
  description: '用于主治/副主任/主任医师查房场景，重点记录上级查房意见与诊疗调整。',
  layout: {
    defaultControlWidth: 120,
    textareaWidth: 420,
    sectionSpacing: 1,
    pageDecorations: {
      ...progressPageDecorations,
      variables: {
        ...progressPageDecorations.variables,
        documentTitle: '住院病历 · 上级医师查房记录'
      }
    },
    titleStyle: { size: 18 }
  },
  blocks: [
    ...createProgressIdentityBlocks(),
    {
      type: 'fieldRow',
      fields: [
        {
          id: 'roundLevel',
          type: 'select',
          label: '查房级别',
          options: [{ label: '主治医师查房' }, { label: '副主任医师查房' }, { label: '主任医师查房' }],
          required: true
        },
        { id: 'roundPhysician', type: 'text', label: '查房医师', placeholder: '请输入上级医师姓名', width: 180, required: true },
        { id: 'residentPhysician', type: 'text', label: '陪同医师', placeholder: '请输入住院医师姓名', width: 180 }
      ]
    },
    createVitalSignsSection('查房时客观情况'),
    {
      type: 'section',
      title: '病情汇总',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'roundSummary', type: 'textarea', placeholder: '请输入患者当前病情、治疗反应及存在问题', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '上级医师意见',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'superiorOpinion', type: 'textarea', placeholder: '请输入上级医师对诊断、治疗和复查的意见', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'section',
      title: '执行计划',
      level: TitleLevel.FIRST,
      blocks: [
        {
          type: 'paragraph',
          segments: [{
            type: 'field',
            field: { id: 'executionPlan', type: 'textarea', placeholder: '请输入医嘱调整、检查安排和随访计划', width: 520, required: true }
          }]
        }
      ]
    },
    {
      type: 'fieldRow',
      fields: [
        { id: 'recordPhysician', type: 'text', label: '记录医师', placeholder: '请输入记录者姓名', required: true },
        { id: 'superiorSignoff', type: 'text', label: '上级签名', placeholder: '请输入签名/电子签章标识', width: 220 }
      ]
    }
  ]
}
