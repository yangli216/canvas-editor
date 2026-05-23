import type { ITemplateBlock, ITemplateFieldRowBlock, ITemplateParagraphBlock, ITemplateSectionBlock } from '../../editor/template/index'
import {
  clearActivePaletteDragPayload,
  PALETTE_DRAG_MIME,
  setActivePaletteDragPayload
} from './paletteDragState'

export interface IBlockPaletteItem {
  type: ITemplateBlock['type']
  label: string
  icon: string
  description: string
}

export interface ITemplatePreset {
  label: string
  icon: string
  description: string
  blocks: ITemplateBlock[]
}

let presetIdCounter = Date.now()
function pid(): string {
  return `fp_${presetIdCounter++}_${Math.random().toString(36).slice(2, 5)}`
}

const PALETTE_ITEMS: IBlockPaletteItem[] = [
  { type: 'staticText', label: '静态文本', icon: 'T', description: '只读固定文字，用于告知书说明文字等' },
  { type: 'paragraph', label: '段落', icon: '¶', description: '混合文本与字段的自由段落' },
  { type: 'fieldRow', label: '字段行', icon: '☰', description: '横排多个字段，带标签' },
  { type: 'section', label: '分节', icon: '§', description: '带标题的内容分组' },
  { type: 'group', label: '组合', icon: '⊞', description: '水平或垂直组合多个块' },
  { type: 'separator', label: '分隔线', icon: '—', description: '水平分隔线' },
  { type: 'spacer', label: '留白', icon: '↕', description: '插入空白区域，用于隔开上下内容' },
  { type: 'table', label: '表格', icon: '⊟', description: '多列表格，支持字段控件' }
]

function buildPresets(): ITemplatePreset[] {
  return [
    {
      label: '患者基本信息',
      icon: '👤',
      description: '姓名/性别/年龄/住院号/床号/科室 字段行',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            { id: pid(), type: 'text', label: '姓名', placeholder: '请输入姓名' },
            { id: pid(), type: 'select', label: '性别', options: [{ label: '男' }, { label: '女' }] },
            { id: pid(), type: 'number', label: '年龄', placeholder: '岁', postfix: '岁' },
            { id: pid(), type: 'text', label: '住院号', placeholder: '住院号', width: 160 }
          ]
        } as ITemplateFieldRowBlock,
        {
          type: 'fieldRow',
          fields: [
            { id: pid(), type: 'text', label: '床号', placeholder: '床号', width: 80 },
            { id: pid(), type: 'text', label: '科室', placeholder: '科室' },
            { id: pid(), type: 'date', label: '入院日期', placeholder: '选择日期' }
          ]
        } as ITemplateFieldRowBlock
      ]
    },
    {
      label: '生命体征',
      icon: '♥',
      description: '体温/脉搏/呼吸/血压/SpO₂ 段落',
      blocks: [
        {
          type: 'paragraph',
          segments: [
            { type: 'text', value: '体温：' },
            { type: 'field', field: { id: pid(), type: 'number', placeholder: '℃', width: 80, postfix: '℃' } },
            { type: 'text', value: '  脉搏：' },
            { type: 'field', field: { id: pid(), type: 'number', placeholder: '次/分', width: 80, postfix: '次/分' } },
            { type: 'text', value: '  呼吸：' },
            { type: 'field', field: { id: pid(), type: 'number', placeholder: '次/分', width: 80, postfix: '次/分' } },
            { type: 'text', value: '  血压：' },
            { type: 'field', field: { id: pid(), type: 'text', placeholder: 'mmHg', width: 100 } },
            { type: 'text', value: '  SpO₂：' },
            { type: 'field', field: { id: pid(), type: 'number', placeholder: '%', width: 80, postfix: '%' } }
          ]
        } as ITemplateParagraphBlock
      ]
    },
    {
      label: '医师签名行',
      icon: '✍',
      description: '住院医师/上级医师/日期',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            { id: pid(), type: 'text', label: '住院医师', placeholder: '签名' },
            { id: pid(), type: 'text', label: '上级医师', placeholder: '签名' },
            { id: pid(), type: 'date', label: '签署日期', placeholder: '选择日期' }
          ]
        } as ITemplateFieldRowBlock
      ]
    },
    {
      label: '知情确认签名',
      icon: '📝',
      description: '患者/家属签名 + 日期（用于知情同意书底部）',
      blocks: [
        {
          type: 'staticText',
          text: '本人已充分了解上述医疗风险及替代方案，自愿同意接受上述治疗。',
          align: 'left'
        },
        {
          type: 'fieldRow',
          fields: [
            { id: pid(), type: 'text', label: '患者签名', placeholder: '本人签名' },
            { id: pid(), type: 'text', label: '与患者关系', placeholder: '如代签需填写' },
            { id: pid(), type: 'date', label: '签署日期', placeholder: '选择日期' }
          ]
        } as ITemplateFieldRowBlock
      ]
    },
    {
      label: '主诉与现病史',
      icon: '📋',
      description: '主诉文本框 + 现病史大文本区域',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            { id: pid(), type: 'text', label: '主诉', placeholder: '请简述主要症状及持续时间', width: 320 }
          ]
        } as ITemplateFieldRowBlock,
        {
          type: 'fieldRow',
          fields: [
            { id: pid(), type: 'textarea', label: '现病史', placeholder: '详细描述起病时间、诱因、主要症状…', width: 480 }
          ]
        } as ITemplateFieldRowBlock
      ]
    },
    {
      label: '体格检查',
      icon: '🔍',
      description: '体温/脉搏/血压/体重等常规体格检查字段',
      blocks: [
        {
          type: 'section',
          title: '体格检查',
          blocks: [
            {
              type: 'paragraph',
              segments: [
                { type: 'text', value: '体温：' },
                { type: 'field', field: { id: pid(), type: 'number', placeholder: '℃', width: 70, postfix: '℃', min: 35, max: 42 } },
                { type: 'text', value: '  脉搏：' },
                { type: 'field', field: { id: pid(), type: 'number', placeholder: '次/分', width: 70, postfix: '次/分', min: 40, max: 200 } },
                { type: 'text', value: '  血压：' },
                { type: 'field', field: { id: pid(), type: 'text', placeholder: 'mmHg', width: 100 } }
              ]
            } as ITemplateParagraphBlock,
            {
              type: 'paragraph',
              segments: [
                { type: 'text', value: '身高：' },
                { type: 'field', field: { id: pid(), type: 'number', placeholder: 'cm', width: 80, postfix: 'cm' } },
                { type: 'text', value: '  体重：' },
                { type: 'field', field: { id: pid(), type: 'number', placeholder: 'kg', width: 80, postfix: 'kg' } },
                { type: 'text', value: '  BMI：' },
                { type: 'field', field: { id: pid(), type: 'number', placeholder: 'kg/m²', width: 80 } }
              ]
            } as ITemplateParagraphBlock,
            {
              type: 'fieldRow',
              fields: [
                { id: pid(), type: 'textarea', label: '专科情况', placeholder: '描述专科查体所见…', width: 480 }
              ]
            } as ITemplateFieldRowBlock
          ]
        } as ITemplateSectionBlock
      ]
    },
    {
      label: '手术基本信息',
      icon: '🏥',
      description: '手术名称/术者/麻醉方式/手术时间等',
      blocks: [
        {
          type: 'fieldRow',
          fields: [
            { id: pid(), type: 'text', label: '手术名称', placeholder: '请输入', width: 280 },
            { id: pid(), type: 'select', label: '手术级别', options: [{ label: '一级' }, { label: '二级' }, { label: '三级' }, { label: '四级' }] }
          ]
        } as ITemplateFieldRowBlock,
        {
          type: 'fieldRow',
          fields: [
            { id: pid(), type: 'text', label: '主刀医师', placeholder: '姓名' },
            { id: pid(), type: 'text', label: '第一助手', placeholder: '姓名' },
            { id: pid(), type: 'text', label: '第二助手', placeholder: '姓名' }
          ]
        } as ITemplateFieldRowBlock,
        {
          type: 'fieldRow',
          fields: [
            { id: pid(), type: 'select', label: '麻醉方式', options: [{ label: '全身麻醉' }, { label: '硬膜外麻醉' }, { label: '脊椎麻醉' }, { label: '局部麻醉' }] },
            { id: pid(), type: 'text', label: '麻醉医师', placeholder: '姓名' },
            { id: pid(), type: 'date', label: '手术日期', placeholder: '选择日期' }
          ]
        } as ITemplateFieldRowBlock
      ]
    },
    {
      label: '护理记录条目',
      icon: '💊',
      description: '护理时间/类型/执行护士/备注',
      blocks: [
        {
          type: 'table',
          columns: [
            { header: '时间', field: { id: pid(), type: 'date', placeholder: '记录时间' }, width: 120 },
            { header: '护理项目', field: { id: pid(), type: 'select', options: [{ label: '生命体征监测' }, { label: '用药' }, { label: '换药' }, { label: '注射' }, { label: '其他' }] }, width: 130 },
            { header: '执行情况', field: { id: pid(), type: 'textarea', placeholder: '描述执行情况…' }, width: 200 },
            { header: '执行护士', field: { id: pid(), type: 'text', placeholder: '签名' }, width: 90 }
          ],
          rows: 5,
          dynamicRows: true
        }
      ]
    },
    {
      label: '出院信息',
      icon: '🚪',
      description: '出院诊断/出院日期/出院方式/出院医嘱',
      blocks: [
        {
          type: 'section',
          title: '出院信息',
          blocks: [
            {
              type: 'fieldRow',
              fields: [
                { id: pid(), type: 'text', label: '出院诊断', placeholder: '请填写', width: 280 },
                { id: pid(), type: 'date', label: '出院日期', placeholder: '选择日期' },
                { id: pid(), type: 'select', label: '出院方式', options: [{ label: '治愈' }, { label: '好转' }, { label: '未愈' }, { label: '死亡' }, { label: '其他' }] }
              ]
            } as ITemplateFieldRowBlock,
            {
              type: 'fieldRow',
              fields: [
                { id: pid(), type: 'textarea', label: '出院医嘱', placeholder: '注意休息，定期复查…', width: 480 }
              ]
            } as ITemplateFieldRowBlock
          ]
        } as ITemplateSectionBlock
      ]
    }
  ]
}

export class BlockPalette {
  private container: HTMLDivElement
  private onInsert: (type: ITemplateBlock['type']) => void
  private onInsertBlocks?: (blocks: ITemplateBlock[]) => void

  constructor(
    onInsert: (type: ITemplateBlock['type']) => void,
    onInsertBlocks?: (blocks: ITemplateBlock[]) => void
  ) {
    this.onInsert = onInsert
    this.onInsertBlocks = onInsertBlocks
    this.container = this._render()
  }

  private _render(): HTMLDivElement {
    const panel = document.createElement('div')
    panel.className = 'td-palette'

    // Block types section
    const typeTitle = document.createElement('div')
    typeTitle.className = 'td-palette__title'
    typeTitle.textContent = '块类型'
    panel.append(typeTitle)

    const list = document.createElement('div')
    list.className = 'td-palette__list'

    for (const item of PALETTE_ITEMS) {
      const el = document.createElement('div')
      el.className = 'td-palette__item'
      el.title = item.description
      el.draggable = true

      const icon = document.createElement('span')
      icon.className = 'td-palette__item-icon'
      icon.textContent = item.icon

      const label = document.createElement('span')
      label.className = 'td-palette__item-label'
      label.textContent = item.label

      el.append(icon, label)
      el.addEventListener('dragstart', event => {
        setActivePaletteDragPayload({ kind: 'type', type: item.type })
        event.dataTransfer?.setData(
          PALETTE_DRAG_MIME,
          JSON.stringify({ kind: 'type', type: item.type })
        )
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'copy'
        }
      })
      el.addEventListener('dragend', () => {
        clearActivePaletteDragPayload()
      })
      el.addEventListener('click', () => this.onInsert(item.type))
      list.append(el)
    }
    panel.append(list)

    // Preset groups section
    if (this.onInsertBlocks) {
      const presetTitle = document.createElement('div')
      presetTitle.className = 'td-palette__title'
      presetTitle.textContent = '常用片段'
      panel.append(presetTitle)

      const presetList = document.createElement('div')
      presetList.className = 'td-palette__list'

      for (const preset of buildPresets()) {
        const el = document.createElement('div')
        el.className = 'td-palette__item td-palette__item--preset'
        el.title = preset.description
        el.draggable = true

        const icon = document.createElement('span')
        icon.className = 'td-palette__item-icon'
        icon.textContent = preset.icon

        const label = document.createElement('span')
        label.className = 'td-palette__item-label'
        label.textContent = preset.label

        el.append(icon, label)
        el.addEventListener('dragstart', event => {
          setActivePaletteDragPayload({ kind: 'blocks', blocks: preset.blocks })
          event.dataTransfer?.setData(
            PALETTE_DRAG_MIME,
            JSON.stringify({ kind: 'blocks', blocks: preset.blocks })
          )
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy'
          }
        })
        el.addEventListener('dragend', () => {
          clearActivePaletteDragPayload()
        })
        el.addEventListener('click', () => this.onInsertBlocks!(preset.blocks))
        presetList.append(el)
      }
      panel.append(presetList)
    }

    return panel
  }

  getElement(): HTMLDivElement {
    return this.container
  }
}
