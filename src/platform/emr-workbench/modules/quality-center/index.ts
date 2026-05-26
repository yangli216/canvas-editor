import {
  buildQualityCenterViewModel,
  type IQualityCenterTemplateItem,
  type IQualityCenterTraceDomain
} from './service'
import { createQualityCenterView } from './view'

export interface IQualityRulePreset {
  id: string
  label: string
  category: 'schema' | 'dataBinding' | 'release' | 'documentTrace'
  description: string
}

const QUALITY_RULE_PRESETS: IQualityRulePreset[] = [
  {
    id: 'required-field-coverage',
    label: '必填字段覆盖检查',
    category: 'schema',
    description: '校验必填字段是否完整配置并可在模板运行端被正确识别。'
  },
  {
    id: 'data-binding-coverage',
    label: '业务字段数据绑定检查',
    category: 'dataBinding',
    description: '校验业务编码、导出路径与数据源配置是否齐备。'
  },
  {
    id: 'release-admission',
    label: '发布准入阻断规则',
    category: 'release',
    description: '汇总结构、规则、数据覆盖和页眉页脚问题，阻止不合格模板发布。'
  },
  {
    id: 'document-trace-completeness',
    label: '病历留痕完整性检查',
    category: 'documentTrace',
    description: '检查病历实例是否具备创建、书写、签名、复核等关键留痕事件。'
  }
]

export class QualityCenterModule {
  private disabledRuleIds = new Set<string>()

  getRulePresets() {
    return QUALITY_RULE_PRESETS.slice()
  }

  getDisabledRuleIds() {
    return Array.from(this.disabledRuleIds)
  }

  toggleRule(ruleId: string) {
    if (this.disabledRuleIds.has(ruleId)) {
      this.disabledRuleIds.delete(ruleId)
    } else {
      this.disabledRuleIds.add(ruleId)
    }
  }

  resetRuleState() {
    this.disabledRuleIds.clear()
  }

  createDialogContent(args: {
    items: IQualityCenterTemplateItem[]
    medicalRecordDomain: IQualityCenterTraceDomain
  }) {
    return createQualityCenterView({
      getModel: () =>
        buildQualityCenterViewModel({
          rules: this.getRulePresets(),
          disabledRuleIds: this.getDisabledRuleIds(),
          items: args.items,
          medicalRecordDomain: args.medicalRecordDomain
        }),
      onToggleRule: (ruleId: string) => this.toggleRule(ruleId),
      onResetRules: () => this.resetRuleState()
    })
  }
}

export {
  buildQualityCenterViewModel,
  type IQualityCenterRule,
  type IQualityCenterTemplateItem,
  type IQualityCenterTraceDomain,
  type IQualityCenterViewModel
} from './service'
export {
  createQualityCenterView
} from './view'