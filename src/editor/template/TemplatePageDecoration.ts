import { TitleLevel } from '../dataset/enum/Title'
import type { ITemplateBlock } from './index'

export type TemplatePageDecorationZone = 'header' | 'footer'
export type TemplatePageDecorationMode = 'replace' | 'prepend' | 'append'
export type TemplatePageDecorationVariableKey =
  | 'hospitalName'
  | 'documentTitle'
  | 'departmentName'
  | 'documentCode'
  | 'footerNote'

export interface ITemplatePageDecorationVariableDefinition {
  key: TemplatePageDecorationVariableKey
  label: string
  placeholder?: string
  description?: string
}

export interface ITemplatePageDecorationPreset {
  id: string
  zone: TemplatePageDecorationZone
  name: string
  description?: string
  variables: ITemplatePageDecorationVariableDefinition[]
  blocks: ITemplateBlock[]
}

export const TEMPLATE_PAGE_DECORATION_VARIABLES: Record<
  Uppercase<TemplatePageDecorationVariableKey>,
  string
> = {
  HOSPITALNAME: '{{医院名称}}',
  DOCUMENTTITLE: '{{文书标题}}',
  DEPARTMENTNAME: '{{科室名称}}',
  DOCUMENTCODE: '{{文书编号}}',
  FOOTERNOTE: '{{页脚附注}}'
}

export const TEMPLATE_PAGE_DECORATION_VARIABLE_DEFINITIONS: ITemplatePageDecorationVariableDefinition[] = [
  {
    key: 'hospitalName',
    label: '医院名称',
    placeholder: '如 第一人民医院',
    description: '常用于页眉主标题'
  },
  {
    key: 'documentTitle',
    label: '文书标题',
    placeholder: '默认取模板名称',
    description: '页眉的文书名称，未配置时回退 schema.name'
  },
  {
    key: 'departmentName',
    label: '科室名称',
    placeholder: '如 心内科',
    description: '适合页眉辅助信息或页脚归属信息'
  },
  {
    key: 'documentCode',
    label: '文书编号',
    placeholder: '如 MR-AD-001',
    description: '用于打印追踪或文书标识'
  },
  {
    key: 'footerNote',
    label: '页脚附注',
    placeholder: '如 canvas-editor template demo',
    description: '用于页脚补充说明'
  }
]

const variableMap = new Map(
  TEMPLATE_PAGE_DECORATION_VARIABLE_DEFINITIONS.map(item => [item.key, item])
)

function pickVariableDefinitions(
  keys: TemplatePageDecorationVariableKey[]
): ITemplatePageDecorationVariableDefinition[] {
  return keys
    .map(key => variableMap.get(key))
    .filter(Boolean) as ITemplatePageDecorationVariableDefinition[]
}

export const TEMPLATE_PAGE_DECORATION_PRESETS: ITemplatePageDecorationPreset[] = [
  {
    id: 'medical-record-header-classic',
    zone: 'header',
    name: '病历通用页眉',
    description: '适合住院病历、病程记录、出院记录等常规文书。',
    variables: pickVariableDefinitions([
      'hospitalName',
      'documentTitle'
    ]),
    blocks: [
      {
        type: 'paragraph',
        style: {
          size: 28,
          bold: true
        },
        align: 'center',
        segments: [{ type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.HOSPITALNAME }]
      },
      {
        type: 'paragraph',
        style: {
          size: 18
        },
        align: 'center',
        segments: [{ type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTTITLE }]
      },
      {
        type: 'separator'
      }
    ]
  },
  {
    id: 'medical-record-header-compact',
    zone: 'header',
    name: '病历紧凑页眉',
    description: '适合空间较紧的护理、告知或单页类文书。',
    variables: pickVariableDefinitions([
      'hospitalName',
      'documentTitle',
      'documentCode'
    ]),
    blocks: [
      {
        type: 'section',
        title: TEMPLATE_PAGE_DECORATION_VARIABLES.HOSPITALNAME,
        level: TitleLevel.FIRST,
        align: 'center',
        titleLineBreak: true,
        spacing: 0,
        titleStyle: {
          size: 22
        },
        blocks: [
          {
            type: 'paragraph',
            style: {
              size: 14,
              color: '#666666'
            },
            align: 'center',
            segments: [
              { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTTITLE },
              { type: 'text', value: ' · ' },
              { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTCODE }
            ]
          }
        ]
      },
      {
        type: 'separator'
      }
    ]
  },
  {
    id: 'lab-report-header',
    zone: 'header',
    name: '检验报告页眉',
    description: '适合检验报告、检查报告等带科室与编号的业务文书。',
    variables: pickVariableDefinitions([
      'hospitalName',
      'documentTitle',
      'departmentName',
      'documentCode'
    ]),
    blocks: [
      {
        type: 'paragraph',
        style: {
          size: 24,
          bold: true
        },
        align: 'center',
        segments: [{ type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.HOSPITALNAME }]
      },
      {
        type: 'paragraph',
        style: {
          size: 16,
          bold: true
        },
        align: 'center',
        segments: [{ type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTTITLE }]
      },
      {
        type: 'paragraph',
        style: {
          size: 12,
          color: '#666666'
        },
        align: 'center',
        segments: [
          { type: 'text', value: '送检科室：' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DEPARTMENTNAME },
          { type: 'text', value: '    报告编号：' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTCODE }
        ]
      },
      {
        type: 'separator'
      }
    ]
  },
  {
    id: 'informed-consent-header-compact',
    zone: 'header',
    name: '知情同意紧凑页眉',
    description: '适合知情同意书、授权书等单页类文书，标题更聚焦。',
    variables: pickVariableDefinitions([
      'documentTitle',
      'hospitalName'
    ]),
    blocks: [
      {
        type: 'paragraph',
        style: {
          size: 26,
          bold: true
        },
        align: 'center',
        segments: [{ type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTTITLE }]
      },
      {
        type: 'paragraph',
        style: {
          size: 12,
          color: '#666666'
        },
        align: 'center',
        segments: [{ type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.HOSPITALNAME }]
      },
      {
        type: 'separator'
      }
    ]
  },
  {
    id: 'ultrasound-report-header-compact',
    zone: 'header',
    name: '超声影像页眉',
    description: '适合超声、心电、影像等检查报告型文书。',
    variables: pickVariableDefinitions([
      'hospitalName',
      'documentTitle',
      'departmentName',
      'documentCode'
    ]),
    blocks: [
      {
        type: 'paragraph',
        style: {
          size: 24,
          bold: true
        },
        align: 'center',
        segments: [{ type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTTITLE }]
      },
      {
        type: 'paragraph',
        style: {
          size: 12,
          color: '#666666'
        },
        align: 'center',
        segments: [
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.HOSPITALNAME },
          { type: 'text', value: ' · ' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DEPARTMENTNAME },
          { type: 'text', value: ' · 编号 ' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTCODE }
        ]
      },
      {
        type: 'separator'
      }
    ]
  },
  {
    id: 'surgical-record-header-operative',
    zone: 'header',
    name: '手术记录页眉',
    description: '适合手术记录、麻醉记录、术后记录等围手术期文书。',
    variables: pickVariableDefinitions([
      'hospitalName',
      'documentTitle',
      'departmentName'
    ]),
    blocks: [
      {
        type: 'paragraph',
        style: {
          size: 26,
          bold: true
        },
        align: 'center',
        segments: [{ type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.HOSPITALNAME }]
      },
      {
        type: 'paragraph',
        style: {
          size: 17,
          bold: true
        },
        align: 'center',
        segments: [{ type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTTITLE }]
      },
      {
        type: 'paragraph',
        style: {
          size: 12,
          color: '#666666'
        },
        align: 'center',
        segments: [
          { type: 'text', value: '执行科室：' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DEPARTMENTNAME }
        ]
      },
      {
        type: 'separator'
      }
    ]
  },
  {
    id: 'consultation-record-header-mdt',
    zone: 'header',
    name: '会诊记录页眉',
    description: '适合院内会诊、多学科会诊和专家会诊等协作文书。',
    variables: pickVariableDefinitions([
      'hospitalName',
      'documentTitle',
      'departmentName',
      'documentCode'
    ]),
    blocks: [
      {
        type: 'section',
        title: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTTITLE,
        level: TitleLevel.FIRST,
        align: 'center',
        titleLineBreak: true,
        spacing: 0,
        titleStyle: {
          size: 22
        },
        blocks: [
          {
            type: 'paragraph',
            style: {
              size: 12,
              color: '#666666'
            },
            align: 'center',
            segments: [
              { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.HOSPITALNAME },
              { type: 'text', value: ' · ' },
              { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DEPARTMENTNAME },
              { type: 'text', value: ' · 会诊编号 ' },
              { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTCODE }
            ]
          }
        ]
      },
      {
        type: 'separator'
      }
    ]
  },
  {
    id: 'medical-record-footer-audit',
    zone: 'footer',
    name: '打印审计页脚',
    description: '适合带打印时间、操作者和文书编号的通用页脚。',
    variables: pickVariableDefinitions(['footerNote']),
    blocks: [
      {
        type: 'separator'
      },
      {
        type: 'paragraph',
        style: {
          size: 12,
          color: '#666666'
        },
        align: 'center',
        segments: [
          { type: 'text', value: '打印时间：{{打印时间}}  操作者：{{操作者}}' }
        ]
      },
      {
        type: 'staticText',
        text: TEMPLATE_PAGE_DECORATION_VARIABLES.FOOTERNOTE,
        align: 'center',
        style: {
          size: 12,
          color: '#666666'
        }
      }
    ]
  },
  {
    id: 'lab-report-footer-signoff',
    zone: 'footer',
    name: '检验报告签发页脚',
    description: '适合检验类报告单，突出科室签发和临床说明。',
    variables: pickVariableDefinitions([
      'departmentName',
      'documentCode',
      'footerNote'
    ]),
    blocks: [
      {
        type: 'separator'
      },
      {
        type: 'paragraph',
        style: {
          size: 12,
          color: '#666666'
        },
        align: 'center',
        segments: [
          { type: 'text', value: '签发科室：' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DEPARTMENTNAME },
          { type: 'text', value: '    报告编号：' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DOCUMENTCODE }
        ]
      },
      {
        type: 'staticText',
        text: TEMPLATE_PAGE_DECORATION_VARIABLES.FOOTERNOTE,
        align: 'center',
        style: {
          size: 11,
          color: '#666666'
        }
      }
    ]
  },
  {
    id: 'ultrasound-report-footer-signoff',
    zone: 'footer',
    name: '超声影像签发页脚',
    description: '适合超声影像报告，强调出具科室与结果说明。',
    variables: pickVariableDefinitions([
      'departmentName',
      'footerNote'
    ]),
    blocks: [
      {
        type: 'separator'
      },
      {
        type: 'paragraph',
        style: {
          size: 12,
          color: '#666666'
        },
        align: 'center',
        segments: [
          { type: 'text', value: '出具科室：' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DEPARTMENTNAME },
          { type: 'text', value: '    打印时间：{{打印时间}}' }
        ]
      },
      {
        type: 'staticText',
        text: TEMPLATE_PAGE_DECORATION_VARIABLES.FOOTERNOTE,
        align: 'center',
        style: {
          size: 11,
          color: '#666666'
        }
      }
    ]
  },
  {
    id: 'surgical-record-footer-audit',
    zone: 'footer',
    name: '手术归档页脚',
    description: '适合手术记录归档与打印留痕，突出科室和归档说明。',
    variables: pickVariableDefinitions([
      'departmentName',
      'footerNote'
    ]),
    blocks: [
      {
        type: 'separator'
      },
      {
        type: 'paragraph',
        style: {
          size: 12,
          color: '#666666'
        },
        align: 'center',
        segments: [
          { type: 'text', value: '归档科室：' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DEPARTMENTNAME },
          { type: 'text', value: '    记录时间：{{打印时间}}' }
        ]
      },
      {
        type: 'staticText',
        text: TEMPLATE_PAGE_DECORATION_VARIABLES.FOOTERNOTE,
        align: 'center',
        style: {
          size: 11,
          color: '#666666'
        }
      }
    ]
  },
  {
    id: 'consultation-record-footer-summary',
    zone: 'footer',
    name: '会诊追踪页脚',
    description: '适合会诊记录和会诊申请单，补充会诊归属和随访备注。',
    variables: pickVariableDefinitions([
      'departmentName',
      'footerNote'
    ]),
    blocks: [
      {
        type: 'separator'
      },
      {
        type: 'paragraph',
        style: {
          size: 12,
          color: '#666666'
        },
        align: 'center',
        segments: [
          { type: 'text', value: '会诊归属：' },
          { type: 'text', value: TEMPLATE_PAGE_DECORATION_VARIABLES.DEPARTMENTNAME },
          { type: 'text', value: '    更新时间：{{打印时间}}' }
        ]
      },
      {
        type: 'staticText',
        text: TEMPLATE_PAGE_DECORATION_VARIABLES.FOOTERNOTE,
        align: 'center',
        style: {
          size: 11,
          color: '#666666'
        }
      }
    ]
  }
]

export function getTemplatePageDecorationPresets(
  zone?: TemplatePageDecorationZone
): ITemplatePageDecorationPreset[] {
  return zone
    ? TEMPLATE_PAGE_DECORATION_PRESETS.filter(item => item.zone === zone)
    : TEMPLATE_PAGE_DECORATION_PRESETS
}

export function getTemplatePageDecorationPreset(
  id?: string
): ITemplatePageDecorationPreset | undefined {
  if (!id) return undefined
  return TEMPLATE_PAGE_DECORATION_PRESETS.find(item => item.id === id)
}