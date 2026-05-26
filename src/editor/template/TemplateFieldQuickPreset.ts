import type {
  ITemplateField,
  ITemplateFieldMetadata,
  ITemplateOption
} from './index'

export interface IBusinessFieldQuickPreset {
  id: string
  label: string
  description: string
  fieldPatch: Partial<ITemplateField>
  metadataPatch: Required<
    Pick<
      ITemplateFieldMetadata,
      'businessCode' | 'group' | 'dataSource' | 'permission' | 'exportPath'
    >
  >
}

export interface IBusinessFieldQuickPresetTarget {
  id: string
  label?: string
  placeholder?: string
  type?: ITemplateField['type']
  metadata?: ITemplateFieldMetadata
}

type IBusinessFieldQuickPresetDefinition = IBusinessFieldQuickPreset & {
  keywords: string[]
}

const GENDER_OPTIONS: ITemplateOption[] = [
  { label: '男', value: '男' },
  { label: '女', value: '女' }
]

const BUSINESS_FIELD_QUICK_PRESETS: IBusinessFieldQuickPresetDefinition[] = [
  {
    id: 'patient-name',
    label: '患者姓名',
    description: '短文本 / patient.name / his.patient',
    keywords: ['患者姓名', '姓名', 'patient name', 'patientname', 'name'],
    fieldPatch: {
      type: 'text',
      placeholder: '请输入姓名',
      width: undefined
    },
    metadataPatch: {
      businessCode: 'patient.name',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.name'
    }
  },
  {
    id: 'patient-gender',
    label: '患者性别',
    description: '单选枚举 / patient.gender / his.patient',
    keywords: ['患者性别', '性别', 'gender', 'sex'],
    fieldPatch: {
      type: 'select',
      placeholder: '请选择性别',
      options: GENDER_OPTIONS,
      width: 120
    },
    metadataPatch: {
      businessCode: 'patient.gender',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.gender'
    }
  },
  {
    id: 'patient-age',
    label: '患者年龄',
    description: '数值 / patient.age / his.patient',
    keywords: ['患者年龄', '年龄', 'age'],
    fieldPatch: {
      type: 'number',
      placeholder: '请输入年龄',
      postfix: '岁',
      width: 120
    },
    metadataPatch: {
      businessCode: 'patient.age',
      group: '基本信息',
      dataSource: 'his.patient',
      permission: 'patient.read.basic',
      exportPath: 'patient.age'
    }
  },
  {
    id: 'visit-number',
    label: '就诊号',
    description: '短文本 / visit.no / his.visit',
    keywords: ['就诊号', '住院号', '门诊号', 'hospital no', 'visit no'],
    fieldPatch: {
      type: 'text',
      placeholder: '请输入就诊号',
      width: 180
    },
    metadataPatch: {
      businessCode: 'visit.no',
      group: '就诊信息',
      dataSource: 'his.visit',
      permission: 'visit.read.basic',
      exportPath: 'visit.no'
    }
  },
  {
    id: 'visit-department',
    label: '就诊科室',
    description: '短文本 / visit.department / his.visit',
    keywords: ['就诊科室', '科室', 'department'],
    fieldPatch: {
      type: 'text',
      placeholder: '请输入科室',
      width: 180
    },
    metadataPatch: {
      businessCode: 'visit.department',
      group: '就诊信息',
      dataSource: 'his.visit',
      permission: 'visit.read.basic',
      exportPath: 'visit.department'
    }
  },
  {
    id: 'diagnosis-primary',
    label: '主诊断',
    description: '短文本 / diagnosis.primary / his.diagnosis',
    keywords: ['主诊断', '诊断', '初步诊断', 'admission diagnosis', 'diagnosis'],
    fieldPatch: {
      type: 'text',
      placeholder: '请输入主诊断',
      width: 260,
      required: true
    },
    metadataPatch: {
      businessCode: 'diagnosis.primary',
      group: '诊断信息',
      dataSource: 'his.diagnosis',
      permission: 'diagnosis.read.basic',
      exportPath: 'diagnosis.primary'
    }
  },
  {
    id: 'chief-complaint',
    label: '主诉',
    description: '长文本 / notes.chiefComplaint / emr.notes',
    keywords: ['主诉', 'chief complaint', 'complaint'],
    fieldPatch: {
      type: 'textarea',
      placeholder: '概括主要症状及持续时间',
      width: undefined,
      required: true
    },
    metadataPatch: {
      businessCode: 'notes.chiefComplaint',
      group: '病程记录',
      dataSource: 'emr.notes',
      permission: 'emr.read.note',
      exportPath: 'notes.chiefComplaint'
    }
  },
  {
    id: 'vital-temperature',
    label: '体温',
    description: '数值 / vitals.temperature / vitalsDevice',
    keywords: ['体温', 'temperature', 'temp'],
    fieldPatch: {
      type: 'number',
      placeholder: '请输入体温',
      postfix: '℃',
      width: 120
    },
    metadataPatch: {
      businessCode: 'vitals.temperature',
      group: '生命体征',
      dataSource: 'vitalsDevice',
      permission: 'vitals.read.basic',
      exportPath: 'vitals.temperature'
    }
  }
]

function normalizeText(text = ''): string {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.\-/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function clonePreset(
  preset: IBusinessFieldQuickPresetDefinition
): IBusinessFieldQuickPreset {
  return {
    id: preset.id,
    label: preset.label,
    description: preset.description,
    fieldPatch: {
      ...preset.fieldPatch,
      options: preset.fieldPatch.options?.map(option => ({ ...option })),
      style: preset.fieldPatch.style
        ? { ...preset.fieldPatch.style }
        : undefined
    },
    metadataPatch: { ...preset.metadataPatch }
  }
}

function getPresetScore(
  target: IBusinessFieldQuickPresetTarget,
  preset: IBusinessFieldQuickPresetDefinition
): number {
  let score = 0
  const businessCode = target.metadata?.businessCode
  const exportPath = target.metadata?.exportPath
  if (businessCode && businessCode === preset.metadataPatch.businessCode) {
    score += 160
  }
  if (exportPath && exportPath === preset.metadataPatch.exportPath) {
    score += 140
  }

  const haystack = [
    normalizeText(target.id),
    normalizeText(target.label),
    normalizeText(target.placeholder),
    normalizeText(businessCode),
    normalizeText(exportPath)
  ].filter(Boolean)

  const compactHaystack = haystack.map(text => text.replace(/\s+/g, ''))
  const keywords = Array.from(
    new Set([
      preset.label,
      preset.metadataPatch.businessCode,
      preset.metadataPatch.exportPath,
      ...preset.keywords
    ].map(normalizeText).filter(Boolean))
  )

  keywords.forEach(keyword => {
    if (haystack.some(text => text === keyword)) {
      score += 80
      return
    }
    if (haystack.some(text => text.includes(keyword))) {
      score += Math.max(24, Math.min(keyword.length * 4, 48))
      return
    }
    const compactKeyword = keyword.replace(/\s+/g, '')
    if (compactHaystack.some(text => text.includes(compactKeyword))) {
      score += 24
    }
  })

  if (target.type && preset.fieldPatch.type === target.type) {
    score += 8
  }

  return score
}

export function getBusinessFieldQuickPresets(): IBusinessFieldQuickPreset[] {
  return BUSINESS_FIELD_QUICK_PRESETS.map(clonePreset)
}

export function recommendBusinessFieldQuickPresets(
  target: IBusinessFieldQuickPresetTarget,
  limit = 3
): IBusinessFieldQuickPreset[] {
  return BUSINESS_FIELD_QUICK_PRESETS
    .map(preset => ({ preset, score: getPresetScore(target, preset) }))
    .filter(item => item.score > 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score
      }
      return left.preset.label.localeCompare(right.preset.label, 'zh-CN')
    })
    .slice(0, limit)
    .map(item => clonePreset(item.preset))
}

export function applyBusinessFieldQuickPreset(
  field: ITemplateField,
  preset: IBusinessFieldQuickPreset
): ITemplateField {
  return {
    ...field,
    ...preset.fieldPatch,
    style: preset.fieldPatch.style
      ? {
          ...field.style,
          ...preset.fieldPatch.style
        }
      : field.style,
    metadata: {
      ...field.metadata,
      ...preset.metadataPatch
    }
  }
}